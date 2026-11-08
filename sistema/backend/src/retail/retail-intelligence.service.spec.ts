import { RetailIntelligenceService } from './retail-intelligence.service';

describe('RetailIntelligenceService', () => {
  function createMockEnv() {
    const state = {
      settings: {
        id: 'singleton',
        paymentMethodsConfig: {
          pix: { emitirNfce: false },
        },
      } as any,
      operators: [
        {
          id: 'op-1',
          name: 'Mariana Consultora',
          jobTitle: 'Vendas & Grade',
          active: true,
          isManager: false,
        },
        {
          id: 'op-2',
          name: 'Lucas Atendimento',
          jobTitle: 'Caixa / Balcão',
          active: true,
          isManager: false,
        },
        {
          id: 'op-3',
          name: 'Beatriz Moda',
          jobTitle: 'Consultora de Estilo',
          active: true,
          isManager: false,
        },
      ],
      sales: [
        {
          id: 'sale-1',
          code: 101,
          operatorId: 'op-1',
          operator: {
            id: 'op-1',
            name: 'Mariana Consultora',
            jobTitle: 'Vendas & Grade',
            isManager: false,
          },
          customerId: 'cust-1',
          customer: { id: 'cust-1', name: 'Fernanda Oliveira', phone: '11999990000' },
          subtotal: 300,
          discount: 20,
          total: 280,
          status: 'completed',
          source: 'pdv',
          createdAt: new Date('2026-11-05T14:30:00-03:00'),
          payments: [{ method: 'pix', label: 'Pix', value: 280 }],
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              productName: 'Camiseta Pima · M · Preta',
              quantity: 2,
              priceUnit: 150,
              priceCost: 60,
              discount: 0,
              subtotal: 300,
              product: {
                id: 'prod-1',
                name: 'Camiseta Pima · M · Preta',
                size: 'M',
                color: 'Preta',
                category: { id: 'cat-1', name: 'Camisetas' },
                retailGroup: { id: 'grp-1', name: 'Camiseta Pima' },
              },
            },
          ],
        },
        {
          id: 'sale-2',
          code: 102,
          operatorId: 'op-2',
          operator: {
            id: 'op-2',
            name: 'Lucas Atendimento',
            jobTitle: 'Caixa / Balcão',
            isManager: false,
          },
          customerId: null,
          customer: null,
          subtotal: 200,
          discount: 0,
          total: 200,
          status: 'completed',
          source: 'pdv',
          createdAt: new Date('2026-11-06T16:10:00-03:00'),
          payments: [{ method: 'credito', label: 'Cartão de Crédito', value: 200 }],
          items: [
            {
              id: 'item-2',
              productId: 'prod-2',
              productName: 'Calça Jeans · 40 · Azul',
              quantity: 1,
              priceUnit: 200,
              priceCost: 80,
              discount: 0,
              subtotal: 200,
              product: {
                id: 'prod-2',
                name: 'Calça Jeans · 40 · Azul',
                size: '40',
                color: 'Azul',
                category: { id: 'cat-2', name: 'Calças & Jeans' },
                retailGroup: { id: 'grp-2', name: 'Calça Jeans' },
              },
            },
          ],
        },
      ],
      returns: [
        {
          id: 'ret-1',
          saleId: 'sale-1',
          customerId: 'cust-1',
          operatorId: 'op-2', // processado no balcão por op-2, mas venda original foi de op-1
          reason: 'Troca de tamanho M por G',
          total: 50,
          createdAt: new Date('2026-11-06T17:00:00-03:00'),
          customer: { id: 'cust-1', name: 'Fernanda Oliveira', phone: '11999990000' },
          sale: {
            id: 'sale-1',
            code: 101,
            operatorId: 'op-1',
            createdAt: new Date('2026-11-05T14:30:00-03:00'),
            total: 280,
          },
          items: [
            {
              id: 'ri-1',
              saleItemId: 'item-1',
              quantity: 1,
              restock: true,
              value: 50,
              saleItem: {
                id: 'item-1',
                productName: 'Camiseta Pima · M · Preta',
                quantity: 2,
                priceUnit: 150,
              },
            },
          ],
        },
      ],
    };

    const db = {
      operator: {
        findMany: jest.fn(async () => state.operators),
      },
      sale: {
        findMany: jest.fn(async () => state.sales),
      },
      retailReturn: {
        findMany: jest.fn(async () => state.returns),
      },
      tenantSettings: {
        findUnique: jest.fn(async () => state.settings),
        upsert: jest.fn(async ({ update, create }: any) => {
          state.settings = {
            ...(state.settings || {}),
            ...(update || create),
          };
          return state.settings;
        }),
      },
    };

    const context = {
      get: () => ({
        tenantId: 'tenant-test-1',
        databaseUrl: 'postgresql://local/test',
      }),
    } as any;

    const manager = {
      getTenantClient: jest.fn(async () => db),
    } as any;

    const heartPrisma = {
      $queryRawUnsafe: jest.fn(async () => [
        { operator_id: 'op-1', image_url: '/uploads/mariana.png' },
      ]),
      user: {
        findMany: jest.fn(async () => []),
      },
    } as any;

    const service = new RetailIntelligenceService(
      context,
      manager,
      heartPrisma,
    );
    return { service, state, db };
  }

  it('calcula ranking, descontos, taxa de trocas atribuída à venda original e calendário diário', async () => {
    const { service } = createMockEnv();
    const res = await service.getIntelligence('2026-11-01', '2026-11-08');

    expect(res.summary.grossRevenue).toBe(480);
    expect(res.summary.returnsTotal).toBe(50);
    expect(res.summary.netRevenue).toBe(430);
    expect(res.summary.totalDiscounts).toBe(20);
    expect(res.summary.totalSales).toBe(2);
    expect(res.summary.totalPieces).toBe(3);

    // Mariana (op-1): 280 bruto - 50 troca = 230 líquido, 20 de desconto sobre 300 (6.7%), 1 vitória diária
    const mariana = res.sellers.find((s) => s.operatorId === 'op-1')!;
    expect(mariana).toBeDefined();
    expect(mariana.imageUrl).toBe('/uploads/mariana.png');
    expect(mariana.grossRevenue).toBe(280);
    expect(mariana.returnsAmount).toBe(50);
    expect(mariana.netRevenue).toBe(230);
    expect(mariana.discountTotal).toBe(20);
    expect(mariana.discountRatePct).toBeCloseTo(6.7, 1);
    expect(mariana.returnRatePct).toBeCloseTo(17.9, 1);
    expect(mariana.pa).toBe(2);
    expect(mariana.dailyWinsCount).toBe(1);
    expect(mariana.bestDay?.date).toBe('2026-11-05');

    // Lucas (op-2): 200 bruto, 0 trocas de vendas dele, 1 vitória diária em 2026-11-06
    const lucas = res.sellers.find((s) => s.operatorId === 'op-2')!;
    expect(lucas.grossRevenue).toBe(200);
    expect(lucas.returnsAmount).toBe(0);
    expect(lucas.netRevenue).toBe(200);
    expect(lucas.dailyWinsCount).toBe(1);

    // Calendário de vendas
    const day05 = res.calendar.days.find((d) => d.date === '2026-11-05')!;
    expect(day05.hasSales).toBe(true);
    expect(day05.revenue).toBe(280);
    expect(day05.champion?.operatorId).toBe('op-1');
    expect(day05.sales).toHaveLength(1);
    expect(day05.sales[0].hasReturn).toBe(true);
  });

  it('persiste metas e comissões sem sobrescrever configurações existentes de pagamento', async () => {
    const { service, state } = createMockEnv();
    const updated = await service.updateGoals({
      storeMonthlyGoal: 40000,
      defaultSellerGoal: 12000,
      defaultCommissionPct: 4.5,
      sellerOverrides: {
        'op-1': { goal: 15000, commissionPct: 5 },
      },
    });

    expect(updated.storeMonthlyGoal).toBe(40000);
    expect(updated.sellerOverrides['op-1'].goal).toBe(15000);
    expect(state.settings.paymentMethodsConfig.pix).toEqual({
      emitirNfce: false,
    });
  });
});
