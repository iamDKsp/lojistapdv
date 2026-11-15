import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../prisma/tenant-context.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';

const saoPauloDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function addDaysIso(day: string, deltaDays: number): string {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + deltaDays * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function toSaoPauloDay(value: Date | string): string {
  const parts = saoPauloDateFormatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

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

    const spanDays =
      Math.round(
        (new Date(`${endDate}T12:00:00Z`).getTime() -
          new Date(`${startDate}T12:00:00Z`).getTime()) /
          86400000,
      ) + 1;

    const nextDay = addDaysIso(endDate, 1);
    const createdAt = { gte: start, lt: businessDayStart(nextDay) };

    const prevEndDate = addDaysIso(startDate, -1);
    const prevStartDate = addDaysIso(startDate, -spanDays);
    const prevCreatedAt = {
      gte: businessDayStart(prevStartDate),
      lt: start,
    };

    const { tenantId, databaseUrl } = this.context.get();
    const db = await this.manager.getTenantClient(tenantId, databaseUrl);
    const where = {
      createdAt,
      status: 'completed',
      NOT: { source: 'ajuste_fiscal' },
    };
    const prevWhere = {
      createdAt: prevCreatedAt,
      status: 'completed',
      NOT: { source: 'ajuste_fiscal' },
    };

    const hasFullSeries = typeof (db.sale as any)?.findMany === 'function';

    const [
      sales,
      returns,
      credits,
      openRegisters,
      items,
      periodSalesRows,
      periodReturnsRows,
      prevSales,
      prevReturns,
      prevItemsAgg,
    ] = await Promise.all([
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
        _sum: { quantity: true, subtotal: true },
      }),
      hasFullSeries
        ? db.sale.findMany({
            where,
            select: { createdAt: true, total: true },
          })
        : Promise.resolve([]),
      typeof (db.retailReturn as any)?.findMany === 'function'
        ? db.retailReturn.findMany({
            where: { createdAt },
            select: { createdAt: true, total: true },
          })
        : Promise.resolve([]),
      hasFullSeries
        ? db.sale.aggregate({
            where: prevWhere,
            _sum: { total: true },
            _count: { id: true },
          })
        : Promise.resolve({ _sum: { total: null }, _count: { id: 0 } }),
      typeof (db.retailReturn as any)?.findMany === 'function'
        ? db.retailReturn.aggregate({
            where: { createdAt: prevCreatedAt },
            _sum: { total: true },
          })
        : Promise.resolve({ _sum: { total: null } }),
      typeof (db.saleItem as any)?.aggregate === 'function'
        ? db.saleItem.aggregate({
            where: { sale: prevWhere },
            _sum: { quantity: true },
          })
        : Promise.resolve({ _sum: { quantity: null } }),
    ]);

    const products = items.length
      ? await db.product.findMany({
          where: { id: { in: items.map((item) => item.productId) } },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            priceSell: true,
            retailGroup: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                priceSell: true,
              },
            },
          },
        })
      : [];

    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        quantity: number;
        revenue: number;
        imageUrl: string | null;
        priceSell: number | null;
      }
    >();

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const id = product.retailGroup?.id || product.id;
      const groupImage =
        (product.retailGroup as any)?.imageUrl ||
        (product as any).imageUrl ||
        null;
      const rawPrice =
        (product.retailGroup as any)?.priceSell ??
        (product as any).priceSell ??
        null;

      if (!groups.has(id)) {
        groups.set(id, {
          id,
          name: product.retailGroup?.name || product.name,
          quantity: 0,
          revenue: 0,
          imageUrl: groupImage,
          priceSell:
            rawPrice !== null && rawPrice !== undefined
              ? Number(rawPrice)
              : null,
        });
      }
      const entry = groups.get(id)!;
      if (!entry.imageUrl && groupImage) entry.imageUrl = groupImage;

      const qty = Number(item._sum?.quantity || 0);
      const itemSubtotal = (item._sum as any)?.subtotal;
      const sub =
        itemSubtotal !== undefined && itemSubtotal !== null
          ? Number(itemSubtotal)
          : entry.priceSell != null
            ? qty * entry.priceSell
            : 0;

      entry.quantity += qty;
      entry.revenue = Number((entry.revenue + sub).toFixed(2));
    }

    const dailyMap = new Map<
      string,
      {
        date: string;
        label: string;
        revenue: number;
        returns: number;
        net: number;
        transactions: number;
      }
    >();
    for (let i = 0; i < spanDays; i++) {
      const day = addDaysIso(startDate, i);
      dailyMap.set(day, {
        date: day,
        label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
        revenue: 0,
        returns: 0,
        net: 0,
        transactions: 0,
      });
    }
    for (const row of periodSalesRows as any[]) {
      const day = toSaoPauloDay(row.createdAt);
      const bucket = dailyMap.get(day);
      if (bucket) {
        bucket.revenue = Number(
          (bucket.revenue + Number(row.total || 0)).toFixed(2),
        );
        bucket.transactions += 1;
      }
    }
    for (const row of periodReturnsRows as any[]) {
      const day = toSaoPauloDay(row.createdAt);
      const bucket = dailyMap.get(day);
      if (bucket) {
        bucket.returns = Number(
          (bucket.returns + Number(row.total || 0)).toFixed(2),
        );
      }
    }
    const dailySeries = [...dailyMap.values()].map((bucket) => ({
      ...bucket,
      net: Number((bucket.revenue - bucket.returns).toFixed(2)),
    }));

    const revenue = Number(sales._sum.total || 0),
      returned = Number(returns._sum.total || 0),
      transactions = Number(sales._count.id || 0),
      pieces = items.reduce(
        (n, item) => n + Number(item._sum.quantity || 0),
        0,
      );

    const avgTicket =
      transactions > 0 ? Number((revenue / transactions).toFixed(2)) : 0;
    const pa =
      transactions > 0 ? Number((pieces / transactions).toFixed(2)) : 0;
    const returnRatePct =
      revenue > 0 ? Number(((returned / revenue) * 100).toFixed(1)) : 0;

    const prevRevenue = Number((prevSales as any)?._sum?.total || 0);
    const prevReturned = Number((prevReturns as any)?._sum?.total || 0);
    const prevTransactions = Number((prevSales as any)?._count?.id || 0);
    const prevPieces = Number((prevItemsAgg as any)?._sum?.quantity || 0);

    return {
      startDate,
      endDate,
      revenue,
      returns: returned,
      netMerchandise: Number((revenue - returned).toFixed(2)),
      transactions,
      pieces,
      avgTicket,
      pa,
      returnRatePct,
      outstandingCredits: Number(credits._sum.balance || 0),
      openRegisters,
      previousPeriod: {
        startDate: prevStartDate,
        endDate: prevEndDate,
        revenue: prevRevenue,
        returns: prevReturned,
        netMerchandise: Number((prevRevenue - prevReturned).toFixed(2)),
        transactions: prevTransactions,
        pieces: prevPieces,
        avgTicket:
          prevTransactions > 0
            ? Number((prevRevenue / prevTransactions).toFixed(2))
            : 0,
        pa:
          prevTransactions > 0
            ? Number((prevPieces / prevTransactions).toFixed(2))
            : 0,
      },
      dailySeries,
      topGroups: [...groups.values()]
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 10),
    };
  }
}
