import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService — CRM Lojista', () => {
  function makeSut(dbOverrides: Record<string, any> = {}) {
    const db: any = {
      customer: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'cust-new',
          createdAt: new Date('2026-10-01T10:00:00Z'),
          updatedAt: new Date('2026-10-01T10:00:00Z'),
          ...data,
        })),
        update: jest.fn().mockImplementation(async ({ where, data }) => ({
          id: where.id,
          createdAt: new Date('2026-10-01T10:00:00Z'),
          updatedAt: new Date('2026-11-01T10:00:00Z'),
          ...data,
        })),
      },
      sale: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      retailReturn: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      storeCredit: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...dbOverrides,
    };
    const manager: any = {
      getTenantClient: jest.fn().mockResolvedValue(db),
    };
    const context: any = {
      get: () => ({ tenantId: 'tenant-A', databaseUrl: 'postgresql://tenant-A' }),
    };
    const service = new CustomersService(manager, context);
    return { service, db, manager };
  }

  it('normaliza telefone, valida campos e impede duplicidade no cadastro', async () => {
    const { service, db } = makeSut();

    await expect(service.create({ name: '', phone: '11999998888' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.create({ name: 'Ana', phone: '123' })).rejects.toThrow(
      BadRequestException,
    );

    const created = await service.create({
      name: '  Marina Costa  ',
      phone: '(11) 98888-7777',
      cpfCnpj: '123.456.789-00',
      address: 'Rua das Flores, 100',
      reference: 'Veste M / Calçado 37',
    });

    expect(created).toMatchObject({
      name: 'Marina Costa',
      phone: '11988887777',
      cpfCnpj: '123.456.789-00',
      address: 'Rua das Flores, 100',
      reference: 'Veste M / Calçado 37',
    });

    db.customer.findUnique.mockResolvedValueOnce({ id: 'cust-1', phone: '11988887777' });
    await expect(
      service.create({ name: 'Outra Pessoa', phone: '11 98888-7777' }),
    ).rejects.toThrow(ConflictException);
  });

  it('atualiza dados do cliente e bloqueia telefone duplicado de outro cadastro', async () => {
    const { service, db } = makeSut();

    await expect(
      service.update('inexistente', { name: 'Ana', phone: '11999990000' }),
    ).rejects.toThrow(NotFoundException);

    db.customer.findUnique
      .mockResolvedValueOnce({ id: 'cust-1', name: 'Ana', phone: '11999990000' })
      .mockResolvedValueOnce({ id: 'cust-2', name: 'Bia', phone: '11977776666' });

    await expect(
      service.update('cust-1', { name: 'Ana', phone: '11977776666' }),
    ).rejects.toThrow(ConflictException);
  });

  it('calcula KPIs RFM, VIPs, clientes sumidos e DNA rápido em getInsights', async () => {
    const now = new Date('2026-11-01T15:00:00Z');
    const { service, db } = makeSut();

    db.customer.findMany.mockResolvedValue([
      {
        id: 'c-vip',
        name: 'Carlos VIP',
        phone: '11911112222',
        cpfCnpj: '11122233344',
        address: 'Centro',
        reference: 'Prefere camiseta oversized',
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
      {
        id: 'c-sumido',
        name: 'Fernanda Sumida',
        phone: '11933334444',
        cpfCnpj: null,
        address: null,
        reference: null,
        createdAt: new Date('2026-05-01T10:00:00Z'),
      },
      {
        id: 'c-novo',
        name: 'Gabriel Novo',
        phone: '11955556666',
        cpfCnpj: null,
        address: null,
        reference: null,
        createdAt: new Date('2026-10-28T10:00:00Z'),
      },
    ]);

    db.sale.findMany.mockResolvedValue([
      {
        id: 's1',
        customerId: 'c-vip',
        total: 620,
        createdAt: new Date('2026-10-25T14:00:00Z'),
        items: [{ productId: 'p-camiseta-g', quantity: 3 }],
      },
      {
        id: 's2',
        customerId: 'c-sumido',
        total: 240,
        createdAt: new Date('2026-08-01T14:00:00Z'),
        items: [{ productId: 'p-tenis-38', quantity: 1 }],
      },
      {
        id: 's3',
        customerId: null,
        total: 100,
        createdAt: new Date('2026-10-30T14:00:00Z'),
        items: [],
      },
    ]);

    db.retailReturn.findMany.mockResolvedValue([
      {
        id: 'ret-1',
        customerId: 'c-vip',
        total: 80,
        createdAt: new Date('2026-10-26T14:00:00Z'),
      },
    ]);

    db.storeCredit.findMany.mockResolvedValue([
      {
        id: 'cred-1',
        customerId: 'c-sumido',
        amount: 80,
        balance: 50,
        createdAt: new Date('2026-08-05T14:00:00Z'),
      },
    ]);

    db.product.findMany.mockResolvedValue([
      { id: 'p-camiseta-g', size: 'G', color: 'Preto' },
      { id: 'p-tenis-38', size: '38', color: 'Branco' },
    ]);

    const insights = await service.getInsights({}, now);

    expect(insights.summary).toMatchObject({
      totalCustomers: 3,
      activeCustomers30d: 1,
      inactiveCustomers60d: 1,
      vipCustomersCount: 1,
      withoutPurchaseCount: 1,
      customersWithCreditCount: 1,
      totalOutstandingCredit: 50,
      identifiedSalesCount: 2,
      unidentifiedSalesCount: 1,
      identifiedSharePercent: 67,
      identifiedRevenue: 860,
      unidentifiedRevenue: 100,
      avgTicketIdentified: 430,
      avgTicketUnidentified: 100,
    });

    const vipRow = insights.customers.find((c) => c.id === 'c-vip')!;
    expect(vipRow).toMatchObject({
      netSpent: 540,
      favoriteSize: 'G',
      favoriteColor: 'Preto',
      segment: 'vip',
      isVip: true,
    });

    const sumidoRow = insights.customers.find((c) => c.id === 'c-sumido')!;
    expect(sumidoRow).toMatchObject({
      segment: 'inactive',
      isInactive: true,
      creditBalance: 50,
    });
  });

  it('monta o Raio-X 360º do cliente com DNA de tamanhos, cores, grupos, pagamentos e elegibilidade de troca', async () => {
    const now = new Date('2026-11-01T15:00:00Z');
    const { service, db } = makeSut();

    db.customer.findUnique.mockResolvedValue({
      id: 'c-1',
      name: 'Lucas Almeida',
      phone: '11988881111',
      cpfCnpj: '12345678909',
      address: 'Av. Paulista, 1000',
      reference: 'Cliente fiel',
      createdAt: new Date('2026-01-10T10:00:00Z'),
      updatedAt: new Date('2026-10-10T10:00:00Z'),
    });

    db.sale.findMany.mockResolvedValue([
      {
        id: 'sale-2',
        code: 102,
        createdAt: new Date('2026-10-20T12:00:00Z'),
        status: 'completed',
        subtotal: 300,
        discount: 20,
        total: 280,
        operator: { id: 'op-1', name: 'Julio' },
        payments: [{ id: 'p2', method: 'pix', label: 'Pix', value: 280, troco: 0 }],
        items: [
          {
            id: 'si-2',
            productId: 'prod-1',
            productName: 'Camiseta Peruana · M / Preto',
            quantity: 2,
            priceUnit: 150,
            subtotal: 300,
            retailReturnItems: [{ quantity: 1 }],
            product: {
              id: 'prod-1',
              name: 'Camiseta Peruana · M / Preto',
              size: 'M',
              color: 'Preto',
              category: { id: 'cat-1', name: 'Camisetas' },
              retailGroup: { id: 'grp-1', name: 'Camiseta Peruana' },
            },
          },
        ],
      },
      {
        id: 'sale-1',
        code: 90,
        createdAt: new Date('2026-09-20T12:00:00Z'),
        status: 'completed',
        subtotal: 250,
        discount: 0,
        total: 250,
        operator: { id: 'op-1', name: 'Julio' },
        payments: [{ id: 'p1', method: 'credito', label: 'Cartão de crédito', value: 250, troco: 0 }],
        items: [
          {
            id: 'si-1',
            productId: 'prod-2',
            productName: 'Calça Cargo · 40 / Bege',
            quantity: 1,
            priceUnit: 250,
            subtotal: 250,
            retailReturnItems: [{ quantity: 1 }],
            product: {
              id: 'prod-2',
              name: 'Calça Cargo · 40 / Bege',
              size: '40',
              color: 'Bege',
              category: { id: 'cat-2', name: 'Calças' },
              retailGroup: { id: 'grp-2', name: 'Calça Cargo' },
            },
          },
        ],
      },
    ]);

    db.retailReturn.findMany.mockResolvedValue([
      {
        id: 'ret-1',
        saleId: 'sale-2',
        sale: { id: 'sale-2', code: 102 },
        reason: 'Troca de numeração',
        total: 140,
        createdAt: new Date('2026-10-22T12:00:00Z'),
        credit: { id: 'cr-1', amount: 140, balance: 40 },
        items: [
          {
            id: 'ri-1',
            saleItemId: 'si-2',
            quantity: 1,
            restock: true,
            value: 140,
            saleItem: { id: 'si-2', productName: 'Camiseta Peruana · M / Preto', priceUnit: 150 },
          },
        ],
      },
    ]);

    db.storeCredit.findMany.mockResolvedValue([
      {
        id: 'cr-1',
        returnId: 'ret-1',
        amount: 140,
        balance: 40,
        createdAt: new Date('2026-10-22T12:00:00Z'),
        retailReturn: {
          id: 'ret-1',
          saleId: 'sale-2',
          reason: 'Troca de numeração',
          sale: { id: 'sale-2', code: 102 },
        },
        uses: [
          {
            id: 'use-1',
            saleId: 'sale-3',
            amount: 100,
            reversedAt: null,
            createdAt: new Date('2026-10-25T12:00:00Z'),
            sale: { id: 'sale-3', code: 110, status: 'completed' },
          },
        ],
      },
    ]);

    const profile = await service.getProfile('c-1', now);

    expect(profile.metrics).toMatchObject({
      purchasesCount: 2,
      totalPieces: 3,
      totalSpent: 530,
      totalReturned: 140,
      netSpent: 390,
      avgTicket: 265,
      avgDaysBetweenPurchases: 30,
      totalCreditIssued: 140,
      creditBalance: 40,
      totalCreditUsed: 100,
    });

    expect(profile.dna.topSizes[0]).toEqual({ label: 'M', quantity: 2 });
    expect(profile.dna.topColors[0]).toEqual({ label: 'Preto', quantity: 2 });
    expect(profile.dna.topGroups[0]).toMatchObject({
      name: 'Camiseta Peruana',
      quantity: 2,
    });
    expect(profile.dna.operators[0]).toEqual({
      id: 'op-1',
      name: 'Julio',
      count: 2,
    });

    expect(profile.sales[0].canInitiateReturn).toBe(true);
    expect(profile.sales[1].canInitiateReturn).toBe(false);
  });
});
