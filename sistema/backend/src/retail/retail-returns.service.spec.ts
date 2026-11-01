import { RetailReturnsService } from './retail-returns.service';

describe('troca de mercadorias', () => {
  const payload = {
    requestKey: 'attempt-1',
    saleId: 'sale',
    customerId: 'customer',
    reason: 'Troca de tamanho',
    items: [{ saleItemId: 'item', quantity: 1, restock: true }],
  };
  function fixture() {
    let created: any;
    const tx: any = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      retailReturn: {
        findUnique: jest.fn().mockImplementation(() => created),
        create: jest.fn().mockImplementation(({ data }) => {
          created = { ...data, id: 'return', credit: { balance: data.total } };
          return created;
        }),
      },
      sale: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            status: 'completed',
            id: 'sale',
            code: 1,
            total: 90,
            items: [
              {
                id: 'item',
                productId: 'variant-M',
                quantity: 2,
                subtotal: 100,
                priceCost: 20,
                retailReturnItems: [],
              },
            ],
          }),
      },
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'customer' }) },
      product: { update: jest.fn() },
      stockLot: { create: jest.fn() },
      inventoryLog: { create: jest.fn() },
    };
    const manager: any = {
        getTenantClient: jest
          .fn()
          .mockResolvedValue({ $transaction: (fn) => fn(tx) }),
      },
      context: any = {
        get: () => ({
          tenantId: 'tenant',
          databaseUrl: 'mysql://tenant',
          userId: 'admin',
        }),
      },
      products: any = { invalidateCache: jest.fn() };
    return {
      service: new RetailReturnsService(manager, context, products),
      tx,
    };
  }
  it('usa valor líquido com desconto e devolve somente a variação correta', async () => {
    const f = fixture();
    const result = await f.service.create(payload);
    expect(Number(result.total)).toBe(45);
    expect(f.tx.product.update).toHaveBeenCalledWith({
      where: { id: 'variant-M' },
      data: { stock: { increment: 1 } },
    });
    expect(f.tx.$executeRaw).toHaveBeenCalled();
  });
  it('repetir a requisição recupera a mesma troca sem duplicar crédito ou estoque', async () => {
    const f = fixture();
    await f.service.create(payload);
    await f.service.create(payload);
    expect(f.tx.retailReturn.create).toHaveBeenCalledTimes(1);
    expect(f.tx.product.update).toHaveBeenCalledTimes(1);
    await expect(
      f.service.create({ ...payload, reason: 'Outro motivo' }),
    ).rejects.toThrow('outros dados');
  });
  it('não devolve ao estoque uma peça sem condição de venda', async () => {
    const f = fixture();
    await f.service.create({
      ...payload,
      items: [{ ...payload.items[0], restock: false }],
    });
    expect(f.tx.product.update).not.toHaveBeenCalled();
    expect(f.tx.retailReturn.create).toHaveBeenCalledTimes(1);
  });
  it('impede devolver a mesma quantidade novamente', async () => {
    const f = fixture();
    f.tx.sale.findUnique.mockResolvedValue({
      status: 'completed',
      total: 90,
      items: [
        {
          id: 'item',
          productId: 'p',
          quantity: 2,
          subtotal: 100,
          retailReturnItems: [{ quantity: 2 }],
        },
      ],
    });
    await expect(f.service.create(payload)).rejects.toThrow('excede');
    expect(f.tx.product.update).not.toHaveBeenCalled();
  });
  it('não credita outro cliente nem vendas canceladas', async () => {
    const f = fixture();
    f.tx.sale.findUnique.mockResolvedValue({ status: 'cancelled', items: [] });
    await expect(f.service.create(payload)).rejects.toThrow('concluída');
    f.tx.sale.findUnique.mockResolvedValue({
      status: 'completed',
      customerId: 'other',
      items: [],
    });
    await expect(f.service.create(payload)).rejects.toThrow('cliente');
  });
});
