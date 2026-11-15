import { BadRequestException } from '@nestjs/common';
import { validateConferenceDetails } from '../cash-registers/cash-registers-data-version';
import { populateTenantOperationalHistory } from './tenant-history-seed';

function createInMemoryTenantMock(options?: {
  emptyCatalog?: boolean;
  withFiscalSale?: boolean;
  initialOperators?: number;
}) {
  const store: Record<string, any[]> = {
    products: options?.emptyCatalog
      ? []
      : [
          {
            id: 'prod-1',
            retailGroupId: 'grp-1',
            name: 'Camiseta Oversized Street · M · Preta',
            unit: 'UN',
            size: 'M',
            color: 'Preta',
            shortCode: '101',
            barcode: '789000000101',
            imageUrl: '/uploads/camiseta.png',
            priceSell: 119.9,
            priceCost: 52.0,
            stock: 10,
            salesCount: 0,
            ncm: '61091000',
            active: true,
            createdAt: new Date('2025-01-10T12:00:00Z'),
            retailGroup: {
              id: 'grp-1',
              name: 'Camiseta Oversized Street',
              priceSell: 119.9,
              priceCost: 52.0,
              imageUrl: '/uploads/camiseta.png',
              ncm: '61091000',
            },
          },
          {
            id: 'prod-2',
            retailGroupId: 'grp-2',
            name: 'Calça Cargo Utilitária · 40 · Off-White',
            unit: 'UN',
            size: '40',
            color: 'Off-White',
            shortCode: '102',
            barcode: '789000000102',
            imageUrl: '/uploads/calca.png',
            priceSell: 189.9,
            priceCost: 84.0,
            stock: 8,
            salesCount: 0,
            ncm: '62034200',
            active: true,
            createdAt: new Date('2025-01-10T12:05:00Z'),
            retailGroup: {
              id: 'grp-2',
              name: 'Calça Cargo Utilitária',
              priceSell: 189.9,
              priceCost: 84.0,
              imageUrl: '/uploads/calca.png',
              ncm: '62034200',
            },
          },
          {
            id: 'prod-3',
            retailGroupId: 'grp-3',
            name: 'Boné Five Panel · Único · Roxo',
            unit: 'UN',
            size: 'U',
            color: 'Roxo',
            shortCode: '103',
            barcode: '789000000103',
            imageUrl: '/uploads/bone.png',
            priceSell: 79.9,
            priceCost: 31.0,
            stock: 15,
            salesCount: 0,
            ncm: '65050011',
            active: true,
            createdAt: new Date('2025-01-10T12:10:00Z'),
            retailGroup: {
              id: 'grp-3',
              name: 'Boné Five Panel',
              priceSell: 79.9,
              priceCost: 31.0,
              imageUrl: '/uploads/bone.png',
              ncm: '65050011',
            },
          },
          {
            id: 'prod-4',
            retailGroupId: 'grp-4',
            name: 'Tênis Urbano Low · 41 · Branco',
            unit: 'UN',
            size: '41',
            color: 'Branco',
            shortCode: '104',
            barcode: '789000000104',
            imageUrl: '/uploads/tenis.png',
            priceSell: 249.9,
            priceCost: 112.0,
            stock: 6,
            salesCount: 0,
            ncm: '64041900',
            active: true,
            createdAt: new Date('2025-01-10T12:15:00Z'),
            retailGroup: {
              id: 'grp-4',
              name: 'Tênis Urbano Low',
              priceSell: 249.9,
              priceCost: 112.0,
              imageUrl: '/uploads/tenis.png',
              ncm: '64041900',
            },
          },
        ],
    operators: Array.from({ length: options?.initialOperators ?? 1 }, (_, i) => ({
      id: `op-existing-${i + 1}`,
      name: i === 0 ? 'Teltech Admin' : `Vendedor ${i}`,
      pin: 'hashed',
      jobTitle: i === 0 ? 'Gerente' : 'Vendedor',
      active: true,
      isManager: i === 0,
      createdAt: new Date('2025-01-01T10:00:00Z'),
    })),
    sales: options?.withFiscalSale
      ? [
          {
            id: 'sale-fiscal-1',
            code: 42,
            cashRegisterId: 'reg-fiscal-1',
            total: 199.9,
            status: 'completed',
            nfceStatus: 'autorizada',
            nfceXml: '<xml/>',
          },
          {
            id: 'sale-test-old',
            code: 43,
            cashRegisterId: 'reg-test-old',
            total: 50.0,
            status: 'completed',
            nfceStatus: null,
            nfceXml: null,
          },
        ]
      : [],
    saleItems: [],
    payments: [],
    cashRegisters: options?.withFiscalSale
      ? [
          { id: 'reg-fiscal-1', code: 10, status: 'closed' },
          { id: 'reg-test-old', code: 11, status: 'closed' },
        ]
      : [],
    cashMovements: [],
    conferenceRevisions: [],
    customers: [
      {
        id: 'cust-existing-1',
        name: 'Cliente Antigo Teltech',
        phone: '11999991111',
        cpfCnpj: '12345678909',
        creditLimit: 900,
        preferredDueDay: 10,
        createdAt: new Date('2025-01-05T10:00:00Z'),
      },
    ],
    suppliers: [],
    supplierProducts: [],
    purchaseOrders: [],
    purchaseOrderItems: [],
    stockLots: [],
    stockLotConsumptions: [],
    inventoryLogs: [
      {
        id: 'inv-xml-1',
        productId: 'prod-1',
        type: 'IN',
        quantity: 10,
        origin: 'IMPORT_XML',
      },
      {
        id: 'inv-manual-old',
        productId: 'prod-1',
        type: 'IN',
        quantity: 5,
        origin: 'MANUAL',
      },
    ],
    payables: [],
    receivables: [],
    receivablePayments: [],
    returns: [],
    returnItems: [],
    storeCredits: [],
    storeCreditUses: [],
    storefrontOrders: [],
    storefrontOrderItems: [],
    stockReservations: [],
    storefrontOrderEvents: [],
  };

  let opSeq = 100;
  let supSeq = 100;
  let settingsObj: any = { id: 'singleton', paymentMethodsConfig: { pixEnabled: true } };

  const makeCollectionDelegate = (key: string) => ({
    createMany: jest.fn(async ({ data }: { data: any[] }) => {
      store[key].push(...data);
      return { count: data.length };
    }),
    deleteMany: jest.fn(async ({ where }: { where?: any } = {}) => {
      if (!where || Object.keys(where).length === 0) {
        const count = store[key].length;
        store[key] = [];
        return { count };
      }
      const before = store[key].length;
      if (where.id?.notIn) {
        const keep = new Set(where.id.notIn);
        store[key] = store[key].filter((r) => keep.has(r.id));
      } else if (where.saleId?.notIn) {
        const keep = new Set(where.saleId.notIn);
        store[key] = store[key].filter((r) => keep.has(r.saleId));
      } else if (where.cashRegisterId?.notIn) {
        const keep = new Set(where.cashRegisterId.notIn);
        store[key] = store[key].filter((r) => keep.has(r.cashRegisterId));
      } else if (where.OR) {
        // inventoryLog cleanup preserves IMPORT_XML / IMPORT_DFE
        store[key] = store[key].filter(
          (r) => r.origin === 'IMPORT_XML' || r.origin === 'IMPORT_DFE',
        );
      } else {
        store[key] = [];
      }
      return { count: before - store[key].length };
    }),
    findFirst: jest.fn(async ({ orderBy }: any = {}) => {
      if (!store[key].length) return null;
      if (orderBy?.code === 'desc') {
        return [...store[key]]
          .filter((r) => r.code != null)
          .sort((a, b) => b.code - a.code)[0] || null;
      }
      return store[key][0];
    }),
  });

  const client: any = {
    _store: store,
    _getSettings: () => settingsObj,
    product: {
      findMany: jest.fn(async () => store.products),
      update: jest.fn(async ({ where, data }: any) => {
        const target = store.products.find((p) => p.id === where.id);
        if (target) Object.assign(target, data);
        return target;
      }),
    },
    retailGroup: {
      count: jest.fn(async () => 4),
    },
    category: {
      count: jest.fn(async () => 3),
    },
    storefrontSettings: {
      findUnique: jest.fn(async () => ({
        id: 'singleton',
        isPublished: true,
        storeName: 'Teltech Store',
      })),
    },
    storefrontProduct: {
      findMany: jest.fn(async () => [
        { retailGroupId: 'grp-1', commercialTitle: 'Camiseta Oversized' },
        { retailGroupId: 'grp-2', commercialTitle: 'Calça Cargo' },
        { retailGroupId: 'grp-4', commercialTitle: 'Tênis Urbano' },
      ]),
    },
    operator: {
      findMany: jest.fn(async () => store.operators),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `op-new-${++opSeq}`, ...data };
        store.operators.push(row);
        return row;
      }),
    },
    tenantSettings: {
      findUnique: jest.fn(async () => settingsObj),
      upsert: jest.fn(async ({ update, create }: any) => {
        settingsObj = settingsObj ? { ...settingsObj, ...update } : create;
        return settingsObj;
      }),
    },
    supplier: {
      findMany: jest.fn(async () => store.suppliers),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `sup-${++supSeq}`, ...data };
        store.suppliers.push(row);
        return row;
      }),
    },
    supplierProduct: makeCollectionDelegate('supplierProducts'),
    customer: {
      ...makeCollectionDelegate('customers'),
      findMany: jest.fn(async () => store.customers),
    },
    crediarioSettings: {
      upsert: jest.fn(async () => ({ id: 'singleton', enabled: true })),
    },
    sale: {
      ...makeCollectionDelegate('sales'),
      findMany: jest.fn(async ({ where }: any) => {
        if (where?.OR) {
          return store.sales.filter(
            (s) =>
              s.nfceStatus === 'autorizada' ||
              s.nfceStatus === 'AUTORIZADA' ||
              s.nfceXml != null,
          );
        }
        return store.sales;
      }),
    },
    saleItem: makeCollectionDelegate('saleItems'),
    payment: makeCollectionDelegate('payments'),
    saleDeliveryJob: makeCollectionDelegate('saleDeliveryJobs'),
    saleItemModifier: makeCollectionDelegate('saleItemModifiers'),
    operatorConsumption: makeCollectionDelegate('operatorConsumptions'),
    comanda: {
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    cashRegister: makeCollectionDelegate('cashRegisters'),
    cashMovement: makeCollectionDelegate('cashMovements'),
    cashRegisterConferenceRevision: makeCollectionDelegate('conferenceRevisions'),
    inventoryLog: makeCollectionDelegate('inventoryLogs'),
    stockLot: makeCollectionDelegate('stockLots'),
    stockLotConsumption: makeCollectionDelegate('stockLotConsumptions'),
    purchaseOrder: makeCollectionDelegate('purchaseOrders'),
    purchaseOrderItem: makeCollectionDelegate('purchaseOrderItems'),
    payable: makeCollectionDelegate('payables'),
    customerReceivable: makeCollectionDelegate('receivables'),
    customerReceivablePayment: makeCollectionDelegate('receivablePayments'),
    crediarioNotificationLog: makeCollectionDelegate('crediarioLogs'),
    retailReturn: makeCollectionDelegate('returns'),
    retailReturnItem: makeCollectionDelegate('returnItems'),
    storeCredit: makeCollectionDelegate('storeCredits'),
    storeCreditUse: makeCollectionDelegate('storeCreditUses'),
    storefrontOrder: makeCollectionDelegate('storefrontOrders'),
    storefrontOrderItem: makeCollectionDelegate('storefrontOrderItems'),
    stockReservation: makeCollectionDelegate('stockReservations'),
    storefrontOrderEvent: makeCollectionDelegate('storefrontOrderEvents'),
  };

  store.saleDeliveryJobs = [];
  store.saleItemModifiers = [];
  store.operatorConsumptions = [];
  store.crediarioLogs = [];

  return client;
}

describe('populateTenantOperationalHistory', () => {
  const fixedNow = new Date('2026-11-15T15:30:00-03:00');

  it('rejeita quando o tenant não possui mercadorias ativas cadastradas', async () => {
    const mockClient = createInMemoryTenantMock({ emptyCatalog: true });
    await expect(
      populateTenantOperationalHistory(mockClient, {
        months: 12,
        profile: 'medium',
        now: fixedNow,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('gera 12 meses realistas no porte médio preservando catálogo, preços, fotos e Loja Virtual', async () => {
    const mockClient = createInMemoryTenantMock({ initialOperators: 1 });
    const originalCatalogSnapshot = mockClient._store.products.map((p: any) => ({
      id: p.id,
      name: p.name,
      priceSell: p.priceSell,
      priceCost: p.priceCost,
      imageUrl: p.imageUrl,
    }));

    const result = await populateTenantOperationalHistory(mockClient, {
      months: 12,
      profile: 'medium',
      cleanExistingMovements: true,
      complementTeam: true,
      seed: 20261115,
      now: fixedNow,
      tenantName: 'Teltech',
    });

    expect(result.monthsCovered).toBe(12);
    expect(result.catalogPreserved.activeProducts).toBe(4);
    expect(result.catalogPreserved.storefrontPublished).toBe(true);

    // Equipe complementada para 4 vendedores ativos para enriquecer o Pódio
    expect(result.team.totalActiveOperators).toBe(4);
    expect(result.team.createdOperators).toHaveLength(3);

    // Escala mensal do porte médio (~150-235 vendas/mês e ~R$ 35k-65k/mês)
    const monthlyAvgSales = result.generated.salesCompleted / 12;
    expect(monthlyAvgSales).toBeGreaterThanOrEqual(140);
    expect(monthlyAvgSales).toBeLessThanOrEqual(260);
    expect(result.generated.averageMonthlyRevenue).toBeGreaterThanOrEqual(32000);
    expect(result.generated.averageMonthlyRevenue).toBeLessThanOrEqual(70000);

    // 1 caixa aberto hoje + caixas fechados nos dias anteriores com closingDetails válidos
    const openRegs = mockClient._store.cashRegisters.filter((r: any) => r.status === 'open');
    const closedRegs = mockClient._store.cashRegisters.filter((r: any) => r.status === 'closed');
    expect(openRegs).toHaveLength(1);
    expect(closedRegs.length).toBeGreaterThan(280);
    expect(() =>
      validateConferenceDetails(JSON.parse(closedRegs[0].closingDetails), true),
    ).not.toThrow();

    // Pedidos de compra, contas a pagar, crediário, trocas e Loja Virtual alimentados
    expect(result.generated.purchaseOrders).toBeGreaterThanOrEqual(20);
    expect(result.generated.payablesPaid).toBeGreaterThan(50);
    expect(result.generated.payablesPending).toBeGreaterThanOrEqual(1);
    expect(result.generated.crediarioInstallments).toBeGreaterThan(10);
    expect(result.generated.returnsCount).toBeGreaterThan(5);
    expect(result.generated.storefrontOrdersTotal).toBeGreaterThan(30);
    expect(result.generated.storefrontOrdersActiveQueue).toBe(2);

    // Catálogo original (nomes, fotos, preços) 100% intacto e estoque consistente com lotes FIFO
    for (const orig of originalCatalogSnapshot) {
      const current = mockClient._store.products.find((p: any) => p.id === orig.id);
      expect(current.name).toBe(orig.name);
      expect(current.priceSell).toBe(orig.priceSell);
      expect(current.priceCost).toBe(orig.priceCost);
      expect(current.imageUrl).toBe(orig.imageUrl);
      expect(current.stock).toBeGreaterThan(0);
      expect(current.salesCount).toBeGreaterThan(0);

      const lotsRemaining = mockClient._store.stockLots
        .filter((l: any) => l.productId === orig.id)
        .reduce((acc: number, l: any) => acc + l.remaining, 0);
      expect(current.stock).toBe(lotsRemaining);
    }
  });

  it('preserva vendas fiscais com NFC-e autorizada e logs XML durante a limpeza', async () => {
    const mockClient = createInMemoryTenantMock({
      withFiscalSale: true,
      initialOperators: 4,
    });

    const result = await populateTenantOperationalHistory(mockClient, {
      months: 1,
      profile: 'compact',
      cleanExistingMovements: true,
      complementTeam: false,
      seed: 777,
      now: fixedNow,
      tenantName: 'Teltech',
    });

    expect(result.preservedFiscalSales).toBe(1);
    expect(result.team.createdOperators).toHaveLength(0);

    // A venda fiscal #42 permaneceu e a venda de teste antiga #43 foi limpa
    const survivingFiscal = mockClient._store.sales.find(
      (s: any) => s.id === 'sale-fiscal-1',
    );
    const removedTestSale = mockClient._store.sales.find(
      (s: any) => s.id === 'sale-test-old',
    );
    expect(survivingFiscal).toBeDefined();
    expect(removedTestSale).toBeUndefined();

    // Novas vendas continuaram a numeração a partir do código 43
    const generatedCodes = mockClient._store.sales
      .filter((s: any) => s.id !== 'sale-fiscal-1')
      .map((s: any) => s.code);
    expect(Math.min(...generatedCodes)).toBe(43);

    // Log de importação XML permaneceu intacto
    expect(
      mockClient._store.inventoryLogs.some((l: any) => l.id === 'inv-xml-1'),
    ).toBe(true);
    expect(
      mockClient._store.inventoryLogs.some((l: any) => l.id === 'inv-manual-old'),
    ).toBe(false);
  });
});
