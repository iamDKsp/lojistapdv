import {
  businessDayStart,
  RetailOverviewService,
} from './retail-overview.service';
describe('resumo para lojistas', () => {
  it('interpreta o começo do dia no fuso da loja', () =>
    expect(businessDayStart('2026-11-01').toISOString()).toBe(
      '2026-11-01T03:00:00.000Z',
    ));
  it('recusa data sem formato válido', () =>
    expect(() => businessDayStart('01/11/2026')).toThrow());
  it.each(['2026-99-99', '2026-02-31'])('recusa data inexistente %s', (value) =>
    expect(() => businessDayStart(value)).toThrow('Data inválida'),
  );
  it('subtrai trocas e agrupa tamanhos da mesma mercadoria no ranking', async () => {
    const db: any = {
      sale: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { total: 200 }, _count: { id: 3 } }),
      },
      retailReturn: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 50 } }),
      },
      storeCredit: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 20 } }),
      },
      cashRegister: { count: jest.fn().mockResolvedValue(1) },
      saleItem: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: 'M', _sum: { quantity: 2, subtotal: 80 } },
          { productId: 'G', _sum: { quantity: 3, subtotal: 120 } },
        ]),
      },
      product: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            ['M', 'G'].map((id) => ({
              id,
              name: id,
              imageUrl: null,
              priceSell: 40,
              retailGroup: {
                id: 'group',
                name: 'Camiseta Peruana',
                imageUrl: '/uploads/camiseta.png',
                priceSell: 40,
              },
            })),
          ),
      },
    };
    const manager: any = { getTenantClient: jest.fn().mockResolvedValue(db) };
    const context: any = {
      get: () => ({ tenantId: 'tenant-A', databaseUrl: 'mysql://A' }),
    };
    const result = await new RetailOverviewService(context, manager).overview(
      '2026-11-01',
      '2026-11-01',
    );
    expect(result.netMerchandise).toBe(150);
    expect(result.outstandingCredits).toBe(20);
    expect(result.avgTicket).toBe(66.67);
    expect(result.pa).toBe(1.67);
    expect(result.returnRatePct).toBe(25);
    expect(result.topGroups).toEqual([
      {
        id: 'group',
        name: 'Camiseta Peruana',
        quantity: 5,
        revenue: 200,
        imageUrl: '/uploads/camiseta.png',
        priceSell: 40,
      },
    ]);
    expect(result.dailySeries).toEqual([
      {
        date: '2026-11-01',
        label: '01/11',
        revenue: 0,
        returns: 0,
        net: 0,
        transactions: 0,
      },
    ]);
    expect(manager.getTenantClient).toHaveBeenCalledWith(
      'tenant-A',
      'mysql://A',
    );
  });

  it('constrói série diária contínua incluindo dias sem venda e comparativo anterior', async () => {
    const db: any = {
      sale: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { total: 350 }, _count: { id: 2 } })
          .mockResolvedValueOnce({ _sum: { total: 100 }, _count: { id: 1 } }),
        findMany: jest.fn().mockResolvedValue([
          { createdAt: new Date('2026-11-01T14:00:00-03:00'), total: 150 },
          { createdAt: new Date('2026-11-03T16:30:00-03:00'), total: 200 },
        ]),
      },
      retailReturn: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { total: 50 } })
          .mockResolvedValueOnce({ _sum: { total: 0 } }),
        findMany: jest.fn().mockResolvedValue([
          { createdAt: new Date('2026-11-03T18:00:00-03:00'), total: 50 },
        ]),
      },
      storeCredit: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 50 } }),
      },
      cashRegister: { count: jest.fn().mockResolvedValue(2) },
      saleItem: {
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 3 } }),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const manager: any = { getTenantClient: jest.fn().mockResolvedValue(db) };
    const context: any = {
      get: () => ({ tenantId: 'tenant-A', databaseUrl: 'mysql://A' }),
    };

    const result = await new RetailOverviewService(context, manager).overview(
      '2026-11-01',
      '2026-11-03',
    );

    expect(result.dailySeries).toEqual([
      { date: '2026-11-01', label: '01/11', revenue: 150, returns: 0, net: 150, transactions: 1 },
      { date: '2026-11-02', label: '02/11', revenue: 0, returns: 0, net: 0, transactions: 0 },
      { date: '2026-11-03', label: '03/11', revenue: 200, returns: 50, net: 150, transactions: 1 },
    ]);
    expect(result.previousPeriod).toEqual({
      startDate: '2026-10-29',
      endDate: '2026-10-31',
      revenue: 100,
      returns: 0,
      netMerchandise: 100,
      transactions: 1,
      pieces: 3,
      avgTicket: 100,
      pa: 3,
    });
  });
});
