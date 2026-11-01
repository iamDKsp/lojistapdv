import { redeemStoreCredits, restoreStoreCredits } from './store-credit.rules';
import { Prisma } from '@prisma/client';

describe('créditos de loja na transação da venda', () => {
  function mockTx() {
    return {
      storeCredit: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      storeCreditUse: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    } as any;
  }
  it('pagamento comum não acessa saldo de crédito', async () => {
    const tx = mockTx();
    await redeemStoreCredits(tx, [{ method: 'pix', value: 10 }], 'sale');
    expect(tx.storeCredit.updateMany).not.toHaveBeenCalled();
  });
  it('exige titular e origem do crédito', async () => {
    const tx = mockTx();
    await expect(
      redeemStoreCredits(
        tx,
        [{ method: 'credito_loja', creditId: 'c', value: 10 }],
        'sale',
      ),
    ).rejects.toThrow();
    await expect(
      redeemStoreCredits(
        tx,
        [{ method: 'credito_loja', value: 10 }],
        'sale',
        'customer',
      ),
    ).rejects.toThrow();
  });
  it.each([-1, 0, 'NaN', 10.001])(
    'recusa valor de crédito inválido %s',
    async (value) => {
      const tx = mockTx();
      await expect(
        redeemStoreCredits(
          tx,
          [{ method: 'credito_loja', creditId: 'c', value }],
          'sale',
          'customer',
        ),
      ).rejects.toThrow();
      expect(tx.storeCredit.updateMany).not.toHaveBeenCalled();
    },
  );
  it('agrega repetições e exige saldo e cliente no UPDATE atômico', async () => {
    const tx = mockTx();
    await redeemStoreCredits(
      tx,
      [
        { method: 'credito_loja', creditId: 'c', value: 10 },
        { method: 'credito_loja', creditId: 'c', value: 5 },
      ],
      'sale',
      'customer',
    );
    expect(tx.storeCredit.updateMany).toHaveBeenCalledTimes(1);
    const args = tx.storeCredit.updateMany.mock.calls[0][0];
    expect(args.where.customerId).toBe('customer');
    expect(args.where.balance.gte.toString()).toBe('15');
    expect(args.data.balance.decrement.toString()).toBe('15');
    expect(tx.storeCreditUse.create).toHaveBeenCalledTimes(1);
  });
  it('recusa saldo insuficiente sem registrar resgate', async () => {
    const tx = mockTx();
    tx.storeCredit.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      redeemStoreCredits(
        tx,
        [{ method: 'credito_loja', creditId: 'c', value: 20 }],
        'sale',
        'customer',
      ),
    ).rejects.toThrow();
    expect(tx.storeCreditUse.create).not.toHaveBeenCalled();
  });
  it('restaura e audita o crédito usado em uma venda cancelada', async () => {
    const tx = mockTx();
    tx.storeCreditUse.findMany.mockResolvedValue([
      { id: 'use', creditId: 'c', amount: new Prisma.Decimal(15) },
    ]);
    await restoreStoreCredits(tx, 'sale');
    expect(tx.storeCredit.update).toHaveBeenCalledWith({
      where: { id: 'c' },
      data: { balance: { increment: new Prisma.Decimal(15) } },
    });
    expect(
      tx.storeCreditUse.update.mock.calls[0][0].data.reversedAt,
    ).toBeInstanceOf(Date);
  });
});
