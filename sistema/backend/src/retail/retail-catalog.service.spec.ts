import { RetailCatalogService } from './retail-catalog.service';

describe('catálogo por grupo e variação', () => {
  const payload = () => ({
    name: 'Camiseta Peruana',
    categoryId: 'cat',
    priceSell: 49.9,
    priceCost: 20,
    imageUrl: '/api/products/uploads/images/photo',
    variants: [
      { size: 'M', color: 'Preta', stockToAdd: 5 },
      { size: 'G', color: 'Branca', stockToAdd: 2 },
    ],
  });
  function fixture() {
    const tx: any = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'cat' }) },
      retailGroup: {
        create: jest.fn().mockResolvedValue({ id: 'group' }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      product: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...data, id: `${data.size}-${data.color}` }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
        findUnique: jest.fn(),
      },
      stockLot: { create: jest.fn() },
      inventoryLog: { create: jest.fn() },
    };
    const db = {
      $transaction: jest.fn((fn) => fn(tx)),
      retailGroup: { findUnique: jest.fn().mockResolvedValue({ id: 'group' }) },
    };
    const manager: any = { getTenantClient: jest.fn().mockResolvedValue(db) },
      context: any = {
        get: () => ({
          tenantId: 'tenant-A',
          databaseUrl: 'mysql://tenant-A',
          userId: 'admin',
        }),
      },
      products: any = { invalidateCache: jest.fn() };
    return {
      service: new RetailCatalogService(manager, context, products),
      tx,
      manager,
      products,
    };
  }
  it('usa banco do tenant e compartilha foto/preço sem misturar saldos', async () => {
    const f = fixture();
    await f.service.save(null, payload());
    expect(f.manager.getTenantClient).toHaveBeenCalledWith(
      'tenant-A',
      'mysql://tenant-A',
    );
    const data = f.tx.product.create.mock.calls.map((call) => call[0].data);
    expect(data).toHaveLength(2);
    expect(
      data.every(
        (d) =>
          Number(d.priceSell) === 49.9 &&
          d.imageUrl.endsWith('/photo') &&
          d.retailGroupId === 'group',
      ),
    ).toBe(true);
    expect(
      f.tx.stockLot.create.mock.calls.map((call) => call[0].data.quantity),
    ).toEqual([5, 2]);
    expect(f.products.invalidateCache).toHaveBeenCalledWith('tenant-A');
  });
  it('não aceita categoria de outra loja', async () => {
    const f = fixture();
    f.tx.category.findUnique.mockResolvedValue(null);
    await expect(f.service.save(null, payload())).rejects.toThrow('Categoria');
    expect(f.tx.product.create).not.toHaveBeenCalled();
  });
  it('recusa grade duplicada e estoque fracionado antes da transação', async () => {
    const f = fixture();
    const data = payload();
    data.variants[1] = { size: 'm', color: 'preta', stockToAdd: 2 };
    await expect(f.service.save(null, data)).rejects.toThrow('combinação');
    data.variants[1].stockToAdd = 1.5;
    await expect(f.service.save(null, data)).rejects.toThrow('estoque');
  });
  it('recusa editor desatualizado sem reescrever variantes', async () => {
    const f = fixture();
    f.tx.retailGroup.findUnique.mockResolvedValue({ version: 2, variants: [] });
    await expect(
      f.service.save('group', { ...payload(), version: 1 }),
    ).rejects.toThrow('outro terminal');
    expect(f.tx.product.update).not.toHaveBeenCalled();
  });
  it('organiza item importado preservando ID e estoque já existentes', async () => {
    const f = fixture();
    f.tx.product.findUnique.mockResolvedValue({
      id: 'imported',
      active: true,
      retailGroupId: null,
    });
    await f.service.save(null, {
      ...payload(),
      variants: [
        {
          existingProductId: 'imported',
          size: 'M',
          color: 'Preta',
          stockToAdd: 0,
        },
      ],
    });
    expect(f.tx.product.create).not.toHaveBeenCalled();
    const update = f.tx.product.update.mock.calls[0][0];
    expect(update.where.id).toBe('imported');
    expect(update.data.stock).toBeUndefined();
    expect(f.tx.stockLot.create).not.toHaveBeenCalled();
  });
});
