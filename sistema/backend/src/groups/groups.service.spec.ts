import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { GroupsService } from './groups.service';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { ProductsService } from '../products/products.service';

describe('GroupsService (Rede Multi-Lojas)', () => {
  let service: GroupsService;
  let heartMock: any;
  let tenantManagerMock: any;
  let productsServiceMock: any;
  let tenantClients: Record<string, any>;

  beforeEach(async () => {
    tenantClients = {};

    heartMock = {
      ensureHeartColumnsAndTables: jest.fn().mockResolvedValue(undefined),
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      tenantGroup: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tenantGroupMember: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    tenantManagerMock = {
      getTenantClient: jest.fn(async (tenantId: string) => {
        const client = tenantClients[tenantId];
        if (!client) {
          throw new Error(`Mock client ausente para tenant ${tenantId}`);
        }
        return client;
      }),
    };

    productsServiceMock = {
      invalidateCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: HeartPrismaService, useValue: heartMock },
        { provide: ProductsService, useValue: productsServiceMock },
        { provide: TenantConnectionManager, useValue: tenantManagerMock },
        { provide: TenantContextService, useValue: {} },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-jwt-token') },
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  it('auto-provisiona TenantGroup sob demanda quando modulos.multiEmpresa = true (sem HTTP 401)', async () => {
    heartMock.tenantGroupMember.findFirst.mockResolvedValueOnce(null);
    heartMock.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-telltech',
      name: 'Telltech',
      nomeFantasia: 'Telltech',
      databaseName: 'telltech_db',
      databaseUrl: 'postgresql://localhost:5432/telltech_db',
      modulos: { estoque: true, multiEmpresa: true },
    });
    heartMock.tenantGroup.create.mockResolvedValueOnce({
      id: 'grp-auto-1',
      name: 'Rede Telltech',
    });
    heartMock.tenantGroupMember.upsert.mockResolvedValueOnce({
      id: 'mem-1',
      groupId: 'grp-auto-1',
      tenantId: 'tenant-telltech',
      alias: 'Telltech',
    });

    const resolvedGroupId = await service.resolveUserGroupId({
      sub: 'user-1',
      tenantId: 'tenant-telltech',
      role: 'admin',
      groupId: null,
    });

    expect(resolvedGroupId).toBe('grp-auto-1');
    expect(heartMock.ensureHeartColumnsAndTables).toHaveBeenCalled();
    expect(heartMock.tenantGroup.create).toHaveBeenCalledWith({
      data: { name: 'Rede Telltech' },
    });
    expect(heartMock.tenantGroupMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          groupId_tenantId: {
            groupId: 'grp-auto-1',
            tenantId: 'tenant-telltech',
          },
        },
      }),
    );
  });

  it('retorna 403 ForbiddenException (e nunca 401) para operador ou loja sem Multi-Empresa', async () => {
    await expect(
      service.resolveUserGroupId({
        sub: 'op-1',
        tenantId: 'tenant-1',
        role: 'operator',
      }),
    ).rejects.toThrow(ForbiddenException);

    heartMock.tenantGroupMember.findFirst.mockResolvedValueOnce(null);
    heartMock.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-single',
      name: 'Loja Simples',
      databaseName: 'loja_simples',
      modulos: { estoque: true, multiEmpresa: false },
    });

    await expect(
      service.resolveUserGroupId({
        sub: 'adm-1',
        tenantId: 'tenant-single',
        role: 'admin',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('linkStoreByCredentials valida credenciais de admin, move filial e remove grupo órfão vazio', async () => {
    const hashedPassword = await bcrypt.hash('SenhaForte123', 10);

    // Caller pertence ao grupo grp-matriz
    heartMock.tenantGroupMember.findFirst
      .mockResolvedValueOnce({ groupId: 'grp-matriz' }) // resolveUserGroupId
      .mockResolvedValueOnce({ groupId: 'grp-matriz' }); // getMyGroupContext -> resolveUserGroupId

    heartMock.tenantGroupMember.findMany.mockResolvedValueOnce([
      { groupId: 'grp-orfao-filial' },
    ]);

    heartMock.tenantGroup.findUnique
      .mockResolvedValueOnce({ id: 'grp-matriz' }) // resolveUserGroupId exists check
      .mockResolvedValueOnce({
        id: 'grp-matriz',
        name: 'Rede Matriz',
        members: [],
      }) // addMember -> getGroupWithMembers
      .mockResolvedValueOnce({
        id: 'grp-orfao-filial',
        _count: { members: 0, users: 0 },
      }) // cleanupEmptyOrphanGroup
      .mockResolvedValueOnce({ id: 'grp-matriz' }) // getMyGroupContext -> exists check
      .mockResolvedValueOnce({
        id: 'grp-matriz',
        name: 'Rede Matriz',
        members: [
          {
            tenantId: 't-matriz',
            alias: 'Matriz',
            tenant: {
              id: 't-matriz',
              name: 'Matriz',
              nomeFantasia: 'Matriz',
              status: 'active',
            },
          },
          {
            tenantId: 't-filial',
            alias: 'Filial Shopping',
            tenant: {
              id: 't-filial',
              name: 'Filial 2',
              nomeFantasia: 'Filial 2',
              status: 'active',
            },
          },
        ],
      });

    heartMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-filial',
      email: 'filial@loja.com',
      password: hashedPassword,
      role: 'admin',
      active: true,
      tenantId: 't-filial',
      tenant: {
        id: 't-filial',
        name: 'Filial 2',
        nomeFantasia: 'Filial 2',
        status: 'active',
      },
    });

    heartMock.tenant.findUnique.mockResolvedValueOnce({
      id: 't-filial',
      name: 'Filial 2',
      nomeFantasia: 'Filial 2',
    });
    heartMock.tenantGroupMember.deleteMany.mockResolvedValueOnce({ count: 1 });
    heartMock.tenantGroupMember.upsert.mockResolvedValueOnce({ id: 'm-new' });
    heartMock.tenantGroup.delete.mockResolvedValueOnce({ id: 'grp-orfao-filial' });

    const ctx = await service.linkStoreByCredentials(
      { sub: 'u-matriz', tenantId: 't-matriz', role: 'admin' },
      {
        email: 'FILIAL@LOJA.COM',
        password: 'SenhaForte123',
        alias: 'Filial Shopping',
      },
    );

    expect(ctx.hasGroup).toBe(true);
    expect(ctx.members).toHaveLength(2);
    expect(heartMock.tenantGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't-filial', groupId: { not: 'grp-matriz' } },
    });
    expect(heartMock.tenantGroup.delete).toHaveBeenCalledWith({
      where: { id: 'grp-orfao-filial' },
    });
  });

  it('updatePricePerTenant atualiza RetailGroup.priceSell e todas as variações irmãs e invalida cache', async () => {
    heartMock.tenantGroup.findUnique.mockResolvedValueOnce({
      id: 'grp-1',
      name: 'Rede Teste',
      members: [
        {
          tenantId: 't-1',
          alias: 'Matriz',
          tenant: {
            id: 't-1',
            name: 'Matriz',
            databaseUrl: 'postgresql://localhost/t1',
          },
        },
      ],
    });

    const txMock = {
      retailGroup: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rg-camiseta',
          name: 'Camiseta Básica',
          variants: [{ id: 'p-1' }, { id: 'p-2' }],
        }),
        update: jest.fn().mockResolvedValue({ id: 'rg-camiseta' }),
      },
      product: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 2 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    };

    tenantClients['t-1'] = {
      $transaction: jest.fn((cb) => cb(txMock)),
    };

    const res = await service.updatePricePerTenant('grp-1', {
      productName: 'Camiseta Básica',
      updates: [{ tenantId: 't-1', priceSell: 89.9 }],
    });

    expect(res.results[0]).toEqual({
      tenantId: 't-1',
      success: true,
      updatedCount: 2,
    });
    expect(txMock.retailGroup.update).toHaveBeenCalledWith({
      where: { id: 'rg-camiseta' },
      data: expect.objectContaining({
        priceSell: new Prisma.Decimal(89.9).toDecimalPlaces(2),
        version: { increment: 1 },
      }),
    });
    expect(txMock.product.updateMany).toHaveBeenCalledWith({
      where: { retailGroupId: 'rg-camiseta' },
      data: { priceSell: new Prisma.Decimal(89.9).toDecimalPlaces(2) },
    });
    expect(productsServiceMock.invalidateCache).toHaveBeenCalledWith('t-1');
  });

  it('createProductInTenants e syncProductsToTenants criam RetailGroup e variações sem product.upsert(where: { name })', async () => {
    heartMock.tenantGroup.findUnique.mockResolvedValue({
      id: 'grp-1',
      name: 'Rede Teste',
      members: [
        {
          tenantId: 't-1',
          alias: 'Matriz',
          tenant: { id: 't-1', name: 'Matriz', databaseUrl: 'pg://t1' },
        },
        {
          tenantId: 't-2',
          alias: 'Filial',
          tenant: { id: 't-2', name: 'Filial', databaseUrl: 'pg://t2' },
        },
      ],
    });

    const createdProductsT2: any[] = [];
    const txT2 = {
      category: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Camisetas' }),
      },
      retailGroup: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'rg-t2',
          name: 'Polo Piquet',
          imageUrl: '/uploads/polo.jpg',
          variants: [],
        }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => {
          createdProductsT2.push(data);
          return { id: `prod-${createdProductsT2.length}`, ...data };
        }),
      },
    };

    // Fonte esparsa em t-1: apenas (P, Preto) e (G, Branco) -> deve replicar exatamente 2 variações (não 4!)
    tenantClients['t-1'] = {
      retailGroup: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rg-t1',
          name: 'Polo Piquet',
          priceSell: new Prisma.Decimal(119.9),
          priceCost: new Prisma.Decimal(45),
          imageUrl: '/uploads/polo.jpg',
          ncm: '61051000',
          cest: null,
          origem: 0,
          category: { name: 'Camisetas', icon: null },
          variants: [
            { id: 'v1', size: 'P', color: 'Preto', unit: 'UN', barcode: '78900001' },
            { id: 'v2', size: 'G', color: 'Branco', unit: 'UN', barcode: '78900002' },
          ],
        }),
      },
    };

    tenantClients['t-2'] = {
      $transaction: jest.fn((cb) => cb(txT2)),
    };

    const syncRes = await service.syncProductsToTenants('grp-1', {
      products: [{ name: 'Polo Piquet', targetTenantIds: ['t-2'] }],
    });

    expect(syncRes.results).toEqual([
      { name: 'Polo Piquet', tenantId: 't-2', success: true },
    ]);
    expect(createdProductsT2).toHaveLength(2);
    expect(createdProductsT2.map((v) => `${v.size}:${v.color}`)).toEqual([
      'P:Preto',
      'G:Branco',
    ]);
    expect(productsServiceMock.invalidateCache).toHaveBeenCalledWith('t-2');
  });

  it('stockTransfer executa FIFO, grava InventoryLog.reason, respeita idempotência e cria produto no destino', async () => {
    heartMock.tenantGroup.findUnique.mockResolvedValue({
      id: 'grp-1',
      name: 'Rede Teste',
      members: [
        {
          tenantId: 't-origem',
          alias: 'Matriz Centro',
          tenant: { id: 't-origem', name: 'Matriz', databaseUrl: 'pg://orig' },
        },
        {
          tenantId: 't-destino',
          alias: 'Filial Norte',
          tenant: { id: 't-destino', name: 'Filial', databaseUrl: 'pg://dest' },
        },
      ],
    });

    const originLogs: any[] = [];
    const destLogs: any[] = [];
    let originStock = 10;

    const txOrigin = {
      inventoryLog: {
        findFirst: jest.fn(async ({ where }) =>
          originLogs.find(
            (l) => l.referenceKey === where.referenceKey && l.type === where.type,
          ) || null,
        ),
        create: jest.fn(async ({ data }) => {
          const rec = { id: `log-out-${originLogs.length + 1}`, ...data };
          originLogs.push(rec);
          return rec;
        }),
        delete: jest.fn(),
      },
      product: {
        findUnique: jest.fn(async () => ({
          id: 'p-orig-1',
          name: 'Calça Jeans · 40 · Azul',
          size: '40',
          color: 'Azul',
          variantKey: '40::AZUL',
          unit: 'UN',
          barcode: null,
          imageUrl: null,
          priceCost: new Prisma.Decimal(60),
          priceSell: new Prisma.Decimal(149.9),
          ncm: '62034200',
          cest: null,
          origem: 0,
          stock: originStock,
          category: { id: 'c1', name: 'Calças', icon: null },
          retailGroup: {
            id: 'rg1',
            name: 'Calça Jeans',
            imageUrl: null,
            priceCost: new Prisma.Decimal(60),
            priceSell: new Prisma.Decimal(149.9),
            ncm: '62034200',
            cest: null,
            origem: 0,
          },
        })),
        update: jest.fn(async ({ data }) => {
          originStock = data.stock;
          return { id: 'p-orig-1', stock: originStock };
        }),
      },
      stockLot: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'lot-1', remaining: 4 },
          { id: 'lot-2', remaining: 6 },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const txDest = {
      inventoryLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => {
          destLogs.push(data);
          return { id: 'log-in-1', ...data };
        }),
      },
      category: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cat-dest', name: 'Calças' }),
      },
      retailGroup: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rg-dest', name: 'Calça Jeans' }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'p-dest-1',
          name: 'Calça Jeans · 40 · Azul',
          stock: 0,
        }),
        update: jest.fn().mockResolvedValue({ id: 'p-dest-1', stock: 6 }),
      },
      stockLot: {
        create: jest.fn().mockResolvedValue({ id: 'lot-dest-1' }),
      },
    };

    tenantClients['t-origem'] = {
      $transaction: jest.fn((cb) => cb(txOrigin)),
    };
    tenantClients['t-destino'] = {
      $transaction: jest.fn((cb) => cb(txDest)),
    };

    const firstCall = await service.stockTransfer('grp-1', {
      fromTenantId: 't-origem',
      toTenantId: 't-destino',
      productId: 'p-orig-1',
      quantity: 6,
      requestKey: 'req-abc-123',
    });

    expect(firstCall).toEqual({
      success: true,
      fromNewStock: 4,
      toNewStock: 6,
    });
    expect(originLogs[0]).toEqual(
      expect.objectContaining({
        type: 'OUT',
        quantity: 6,
        referenceKey: 'TRF:req-abc-123',
        reason: 'Transferência enviada para Filial Norte',
      }),
    );
    expect((originLogs[0] as any).notes).toBeUndefined();
    expect(destLogs[0]).toEqual(
      expect.objectContaining({
        type: 'IN',
        quantity: 6,
        referenceKey: 'TRF:req-abc-123',
        reason: 'Transferência recebida de Matriz Centro',
      }),
    );

    // Segunda chamada com o mesmo requestKey não deve descontar novamente
    const duplicateCall = await service.stockTransfer('grp-1', {
      fromTenantId: 't-origem',
      toTenantId: 't-destino',
      productId: 'p-orig-1',
      quantity: 6,
      requestKey: 'req-abc-123',
    });

    expect(duplicateCall).toEqual({
      success: true,
      idempotent: true,
      fromNewStock: 4,
    });
    expect(originStock).toBe(4);
  });

  it('stockTransfer compensa (estorna) saldo e lotes na origem se o destino falhar', async () => {
    heartMock.tenantGroup.findUnique.mockResolvedValue({
      id: 'grp-1',
      name: 'Rede Teste',
      members: [
        {
          tenantId: 't-origem',
          alias: 'Matriz',
          tenant: { id: 't-origem', name: 'Matriz', databaseUrl: 'pg://orig' },
        },
        {
          tenantId: 't-destino',
          alias: 'Filial',
          tenant: { id: 't-destino', name: 'Filial', databaseUrl: 'pg://dest' },
        },
      ],
    });

    let originStock = 8;
    let lotRemaining = 8;

    const txOrigin = {
      inventoryLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'out-log-rollback' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p-1',
          name: 'Jaqueta Jeans',
          unit: 'UN',
          priceCost: new Prisma.Decimal(90),
          priceSell: new Prisma.Decimal(199.9),
          stock: originStock,
          category: { id: 'c1', name: 'Jaquetas' },
          retailGroup: null,
        }),
        update: jest.fn(async ({ data }) => {
          if (typeof data.stock === 'number') {
            originStock = data.stock;
          } else if (data.stock?.increment) {
            originStock += data.stock.increment;
          }
          return { id: 'p-1', stock: originStock };
        }),
      },
      stockLot: {
        findMany: jest.fn().mockResolvedValue([{ id: 'lot-1', remaining: lotRemaining }]),
        update: jest.fn(async ({ data }) => {
          if (typeof data.remaining === 'number') {
            lotRemaining = data.remaining;
          } else if (data.remaining?.increment) {
            lotRemaining += data.remaining.increment;
          }
          return { id: 'lot-1', remaining: lotRemaining };
        }),
      },
    };

    tenantClients['t-origem'] = {
      $transaction: jest.fn((cb) => cb(txOrigin)),
    };
    tenantClients['t-destino'] = {
      $transaction: jest.fn(async () => {
        throw new Error('Timeout de conexão na filial');
      }),
    };

    await expect(
      service.stockTransfer('grp-1', {
        fromTenantId: 't-origem',
        toTenantId: 't-destino',
        productId: 'p-1',
        quantity: 3,
      }),
    ).rejects.toThrow(BadRequestException);

    // Saldo e lote na origem devem ter sido restaurados integralmente para 8
    expect(originStock).toBe(8);
    expect(lotRemaining).toBe(8);
    expect(txOrigin.inventoryLog.delete).toHaveBeenCalledWith({
      where: { id: 'out-log-rollback' },
    });
  });
});
