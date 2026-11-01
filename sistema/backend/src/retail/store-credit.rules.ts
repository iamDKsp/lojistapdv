import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Mesma transação da venda: nenhum saldo é consumido antes do commit. */
export async function redeemStoreCredits(
  tx: Prisma.TransactionClient,
  payments: any[],
  saleId: string,
  customerId?: string,
) {
  const requests = payments.filter((pay) => pay.method === 'credito_loja');
  if (!requests.length) return;
  if (!customerId)
    throw new BadRequestException('Selecione o titular do crédito.');
  const grouped = new Map<string, Prisma.Decimal>();
  for (const payment of requests) {
    if (typeof payment.creditId !== 'string' || !payment.creditId)
      throw new BadRequestException('Informe qual crédito será utilizado.');
    const amount = new Prisma.Decimal(payment.value);
    if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 2)
      throw new BadRequestException('Valor de crédito inválido.');
    grouped.set(
      payment.creditId,
      (grouped.get(payment.creditId) || new Prisma.Decimal(0)).add(amount),
    );
  }
  for (const [id, amount] of [...grouped].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const updated = await tx.storeCredit.updateMany({
      where: { id, customerId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (updated.count !== 1)
      throw new BadRequestException(
        'Crédito indisponível, saldo insuficiente ou titular diferente. Atualize os saldos.',
      );
    await tx.storeCreditUse.create({ data: { creditId: id, saleId, amount } });
  }
}

export async function restoreStoreCredits(
  tx: Prisma.TransactionClient,
  saleId: string,
) {
  const uses = await tx.storeCreditUse.findMany({
    where: { saleId, reversedAt: null },
    orderBy: { creditId: 'asc' },
  });
  for (const use of uses) {
    await tx.storeCredit.update({
      where: { id: use.creditId },
      data: { balance: { increment: use.amount } },
    });
    await tx.storeCreditUse.update({
      where: { id: use.id },
      data: { reversedAt: new Date() },
    });
  }
}
