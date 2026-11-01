import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../prisma/tenant-context.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';

export function businessDayStart(day: string): Date {
  const parsed = new Date(day + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day
  )
    throw new BadRequestException('Data inválida.');
  const offset =
    new Intl.DateTimeFormat('en', {
      timeZone: 'America/Sao_Paulo',
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(day + 'T12:00:00Z'))
      .find((part) => part.type === 'timeZoneName')
      ?.value.replace('GMT', '') || '+00:00';
  return new Date(`${day}T00:00:00${offset}`);
}

@Injectable()
export class RetailOverviewService {
  constructor(
    private readonly context: TenantContextService,
    private readonly manager: TenantConnectionManager,
  ) {}
  async overview(startDate: string, endDate: string) {
    const start = businessDayStart(startDate),
      endStart = businessDayStart(endDate);
    if (
      endStart < start ||
      endStart.getTime() - start.getTime() > 92 * 86400000
    )
      throw new BadRequestException('Selecione um período de até 93 dias.');
    const nextDay = new Date(
      new Date(`${endDate}T12:00:00Z`).getTime() + 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const createdAt = { gte: start, lt: businessDayStart(nextDay) };
    const { tenantId, databaseUrl } = this.context.get();
    const db = await this.manager.getTenantClient(tenantId, databaseUrl);
    const where = {
      createdAt,
      status: 'completed',
      NOT: { source: 'ajuste_fiscal' },
    };
    const [sales, returns, credits, openRegisters, items] = await Promise.all([
      db.sale.aggregate({ where, _sum: { total: true }, _count: { id: true } }),
      db.retailReturn.aggregate({
        where: { createdAt },
        _sum: { total: true },
      }),
      db.storeCredit.aggregate({ _sum: { balance: true } }),
      db.cashRegister.count({ where: { status: 'open' } }),
      db.saleItem.groupBy({
        by: ['productId'],
        where: { sale: where },
        _sum: { quantity: true },
      }),
    ]);
    const products = await db.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: {
        id: true,
        name: true,
        retailGroup: { select: { id: true, name: true } },
      },
    });
    const groups = new Map<
      string,
      { id: string; name: string; quantity: number }
    >();
    for (const item of items) {
      const product = products.find((product) => product.id === item.productId);
      if (!product) continue;
      const id = product.retailGroup?.id || product.id;
      if (!groups.has(id))
        groups.set(id, {
          id,
          name: product.retailGroup?.name || product.name,
          quantity: 0,
        });
      groups.get(id)!.quantity += Number(item._sum.quantity || 0);
    }
    const revenue = Number(sales._sum.total || 0),
      returned = Number(returns._sum.total || 0);
    return {
      startDate,
      endDate,
      revenue,
      returns: returned,
      netMerchandise: Number((revenue - returned).toFixed(2)),
      transactions: sales._count.id,
      pieces: items.reduce((n, item) => n + Number(item._sum.quantity || 0), 0),
      outstandingCredits: Number(credits._sum.balance || 0),
      openRegisters,
      topGroups: [...groups.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10),
    };
  }
}
