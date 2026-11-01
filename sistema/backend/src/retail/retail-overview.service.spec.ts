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
          { productId: 'M', _sum: { quantity: 2 } },
          { productId: 'G', _sum: { quantity: 3 } },
        ]),
      },
      product: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            ['M', 'G'].map((id) => ({
              id,
              name: id,
              retailGroup: { id: 'group', name: 'Camiseta Peruana' },
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
    expect(result.topGroups).toEqual([
      { id: 'group', name: 'Camiseta Peruana', quantity: 5 },
    ]);
    expect(manager.getTenantClient).toHaveBeenCalledWith(
      'tenant-A',
      'mysql://A',
    );
  });
});
