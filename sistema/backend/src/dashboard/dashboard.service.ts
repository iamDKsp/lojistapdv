import { Injectable, Optional } from '@nestjs/common';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { EntityPhotoResolverService } from '../prisma/entity-photo-resolver.service';

const brPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

function getSaoPauloParts(value: Date | string) {
  const parts = brPartsFormatter.formatToParts(new Date(value));
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 1970);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const isoDay = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, isoDay };
}

function addDaysIso(day: string, deltaDays: number): string {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() + deltaDays * 86400000)
    .toISOString()
    .slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(
    private tenantManager: TenantConnectionManager,
    private tenantContext: TenantContextService,
    @Optional() private photoResolver?: EntityPhotoResolverService,
  ) {}

  async getSummary(
    tenantId: string,
    startDate: string,
    endDate: string,
  ) {
    const { databaseUrl } = this.tenantContext.get();
    const prisma = await this.tenantManager.getTenantClient(tenantId, databaseUrl);

    // ── Definir janelas de tempo consistentes em America/Sao_Paulo (-03:00) ──
    const nowParts = getSaoPauloParts(new Date());
    const todayStr = nowParts.isoDay;
    const todayStart = new Date(`${todayStr}T00:00:00-03:00`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999-03:00`);

    // Segunda-feira da semana corrente no fuso de São Paulo
    const todayNoonUtc = new Date(`${todayStr}T12:00:00Z`);
    const dow = todayNoonUtc.getUTCDay(); // 0=Dom..6=Sáb
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const weekStartStr = addDaysIso(todayStr, diffToMonday);
    const prevWeekStartStr = addDaysIso(weekStartStr, -7);
    const prevWeekEndStr = addDaysIso(weekStartStr, -1);
    const monthStartStr = `${todayStr.slice(0, 8)}01`;

    const weekStart = new Date(`${weekStartStr}T00:00:00-03:00`);
    const prevWeekStart = new Date(`${prevWeekStartStr}T00:00:00-03:00`);
    const prevWeekEnd = new Date(`${prevWeekEndStr}T23:59:59.999-03:00`);
    const monthStart = new Date(`${monthStartStr}T00:00:00-03:00`);

    // ── Janela de período customizado do filtro (Ajustado para fuso -03:00) ──
    const safeStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : todayStr;
    const safeEnd = /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= safeStart ? endDate : safeStart;
    const periodStart = new Date(`${safeStart}T00:00:00-03:00`);
    const periodEnd = new Date(`${safeEnd}T23:59:59.999-03:00`);

    const spanDays = Math.max(
      1,
      Math.round(
        (new Date(`${safeEnd}T12:00:00Z`).getTime() -
          new Date(`${safeStart}T12:00:00Z`).getTime()) /
          86400000,
      ) + 1,
    );
    const prevPeriodEndStr = addDaysIso(safeStart, -1);
    const prevPeriodStartStr = addDaysIso(safeStart, -spanDays);
    const prevPeriodStart = new Date(`${prevPeriodStartStr}T00:00:00-03:00`);
    const prevPeriodEnd = new Date(`${prevPeriodEndStr}T23:59:59.999-03:00`);

    // ── Todas as queries em PARALELO para máxima performance ──────────────
    const [
      openRegisters,
      todayAgg,
      weekAgg,
      prevWeekAgg,
      monthAgg,
      prevPeriodAgg,
      periodSales,
      payablesAlerts,
      actors,
    ] = await Promise.all([
      // 1. Caixas abertos
      prisma.cashRegister.findMany({
        where: { status: 'open' },
        include: { operator: { select: { name: true } } },
        orderBy: { openingTime: 'asc' },
      }),

      // 2. Faturamento de Hoje (exclui notas de ajuste fiscal)
      prisma.sale.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
        _sum: { total: true },
        _count: { id: true },
      }),

      // 3. Faturamento da Semana (exclui notas de ajuste fiscal)
      prisma.sale.aggregate({
        where: { createdAt: { gte: weekStart, lte: todayEnd }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
        _sum: { total: true },
      }),

      // 4. Semana anterior (exclui notas de ajuste fiscal)
      prisma.sale.aggregate({
        where: { createdAt: { gte: prevWeekStart, lte: prevWeekEnd }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
        _sum: { total: true },
      }),

      // 5. Faturamento do Mês (exclui notas de ajuste fiscal)
      prisma.sale.aggregate({
        where: { createdAt: { gte: monthStart, lte: todayEnd }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
        _sum: { total: true },
      }),

      // 6. Período equivalente anterior para tendência comparativa
      prisma.sale.aggregate({
        where: { createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
        _sum: { total: true, discount: true },
        _count: { id: true },
      }),

      // 7. Dados do período filtrado (exclui notas de ajuste fiscal)
      prisma.sale.findMany({
        where: { createdAt: { gte: periodStart, lte: periodEnd }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
        include: {
          payments: { select: { method: true, value: true, label: true } },
          items: {
            select: {
              quantity: true,
              priceUnit: true,
              discount: true,
              subtotal: true,
              productName: true,
              productId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 8. Alertas de contas a pagar (próximos 3 dias)
      prisma.payable.findMany({
        where: {
          status: 'PENDING',
          dueDate: { lte: new Date(todayEnd.getTime() + 3 * 86400000) },
        },
        orderBy: { dueDate: 'asc' },
      }),

      // 9. Fotos de operadores/usuários da loja
      this.photoResolver
        ? this.photoResolver.loadTenantActors(tenantId, prisma)
        : Promise.resolve(null),
    ]);

    // Calcula receita por caixa (paralelo para os caixas abertos)
    const openRegistersWithRevenue = await Promise.all(
      openRegisters.map(async (reg) => {
        const regSales = await prisma.sale.aggregate({
          where: { cashRegisterId: reg.id, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
          _sum: { total: true },
          _count: { id: true },
        });
        const rawOpName = (reg as any).operator?.name;
        const resolvedActor = actors
          ? actors.resolveActor(
              { operatorId: reg.operatorId, name: rawOpName },
              rawOpName || 'Operador',
            )
          : { name: rawOpName || 'Operador', imageUrl: null };
        return {
          cashRegisterId: reg.id,
          code: reg.code,
          operatorName: resolvedActor.name ?? 'Operador',
          operatorId: reg.operatorId,
          operatorImageUrl: resolvedActor.imageUrl,
          openedAt: (reg as any).openingTime,
          openingValue: Number(reg.openingValue ?? 0),
          total: Number(regSales._sum.total ?? 0),
          salesCount: Number(regSales._count.id ?? 0),
        };
      }),
    );

    const weekRevenue = Number(weekAgg._sum.total ?? 0);
    const prevWeekRevenue = Number(prevWeekAgg._sum.total ?? 0);
    const vsLastWeek = prevWeekRevenue > 0
      ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100
      : null;

    // Agrega pagamentos por método (valor e contagem de vendas)
    const byPaymentMethod: Record<string, number> = {
      dinheiro: 0,
      pix: 0,
      credito: 0,
      debito: 0,
      crediario: 0,
    };
    const countByPaymentMethod: Record<string, number> = {};

    periodSales.forEach((sale) => {
      const methodsInSale = new Set<string>();
      sale.payments.forEach((p) => {
        const rawKey = (
          p.method && isNaN(Number(p.method))
            ? p.method
            : p.label && isNaN(Number(p.label))
              ? p.label
              : 'credito'
        ).toLowerCase();
        let normKey = 'credito';
        if (rawKey.includes('dinh')) normKey = 'dinheiro';
        else if (rawKey.includes('pix')) normKey = 'pix';
        else if (
          rawKey === 'crediario' ||
          rawKey === 'fiado' ||
          rawKey.includes('crediário') ||
          rawKey.includes('crediario')
        )
          normKey = 'crediario';
        else if (
          rawKey === 'credito_loja' ||
          rawKey === 'store_credit' ||
          rawKey.includes('credito_loja') ||
          rawKey.includes('crédito da loja') ||
          rawKey.includes('vale-troca')
        )
          normKey = 'credito_loja';
        else if (rawKey.includes('cred')) normKey = 'credito';
        else if (rawKey.includes('deb')) normKey = 'debito';
        else if (rawKey.includes('consumo')) normKey = 'consumo_funcionario';

        byPaymentMethod[normKey] = (byPaymentMethod[normKey] ?? 0) + Number(p.value);
        methodsInSale.add(normKey);
      });
      methodsInSale.forEach((m) => {
        countByPaymentMethod[m] = (countByPaymentMethod[m] ?? 0) + 1;
      });
    });

    // Agrega faturamento e contagem por recortes temporais (Hora, Dia, Semana, Mês)
    const byHour: Record<number, number> = {};
    const countByHour: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      byHour[h] = 0;
      countByHour[h] = 0;
    }

    const byDay: Record<string, number> = {};
    const countByDay: Record<string, number> = {};
    if (spanDays <= 366) {
      for (let i = 0; i < spanDays; i++) {
        const dayKey = addDaysIso(safeStart, i);
        byDay[dayKey] = 0;
        countByDay[dayKey] = 0;
      }
    }

    const byWeek: Record<string, number> = {};
    const countByWeek: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const countByMonth: Record<string, number> = {};

    const productMap: Record<
      string,
      { productId: string; name: string; qty: number; revenue: number }
    > = {};

    let totalPieces = 0;
    let totalDiscount = 0;
    let maxTicket = 0;
    let identifiedSalesCount = 0;

    periodSales.forEach((sale) => {
      const sp = getSaoPauloParts((sale as any).createdAt);
      const saleTotal = Number((sale as any).total || 0);
      if (saleTotal > maxTicket) maxTicket = saleTotal;
      if ((sale as any).customerId || (sale as any).consumidorCpf) {
        identifiedSalesCount += 1;
      }

      const headerDisc = Number((sale as any).discount || 0);
      let itemsDisc = 0;
      sale.items.forEach((it) => {
        itemsDisc += Number((it as any).discount || 0);
      });
      totalDiscount += Math.max(headerDisc, itemsDisc);

      // 1. Agregação por Hora
      byHour[sp.hour] = (byHour[sp.hour] ?? 0) + saleTotal;
      countByHour[sp.hour] = (countByHour[sp.hour] ?? 0) + 1;

      // 2. Agregação por Dia (YYYY-MM-DD)
      const dayKey = sp.isoDay;
      byDay[dayKey] = (byDay[dayKey] ?? 0) + saleTotal;
      countByDay[dayKey] = (countByDay[dayKey] ?? 0) + 1;

      // 3. Agregação por Semana (YYYY-MM-DD da segunda-feira correspondente)
      const dayNoon = new Date(`${dayKey}T12:00:00Z`);
      const dWeek = dayNoon.getUTCDay();
      const weekKey = addDaysIso(dayKey, dWeek === 0 ? -6 : 1 - dWeek);
      byWeek[weekKey] = (byWeek[weekKey] ?? 0) + saleTotal;
      countByWeek[weekKey] = (countByWeek[weekKey] ?? 0) + 1;

      // 4. Agregação por Mês (YYYY-MM)
      const monthKey = dayKey.slice(0, 7);
      byMonth[monthKey] = (byMonth[monthKey] ?? 0) + saleTotal;
      countByMonth[monthKey] = (countByMonth[monthKey] ?? 0) + 1;

      // Agregação de produtos vendidos
      sale.items.forEach((item) => {
        const key = item.productId as string;
        const name = (item.productName as string) || 'Desconhecido';
        const qty = Number(item.quantity || 0);
        totalPieces += qty;
        if (!productMap[key]) {
          productMap[key] = { productId: key, name, qty: 0, revenue: 0 };
        }
        productMap[key].qty += qty;
        productMap[key].revenue += Number(item.subtotal || 0);
      });
    });

    const soldProductIds = Object.keys(productMap);
    const productMetaList = soldProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: soldProductIds } },
          select: {
            id: true,
            size: true,
            color: true,
            imageUrl: true,
            retailGroup: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
        })
      : [];
    const productMetaMap = new Map(productMetaList.map((p) => [p.id, p]));

    const periodRevenue = periodSales.reduce(
      (acc, s) => acc + Number((s as any).total || 0),
      0,
    );

    // Lista total de produtos vendidos ordenados por faturamento decrescente
    const productsSold = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => {
        const meta = productMetaMap.get(p.productId);
        return {
          productId: p.productId,
          name: p.name,
          groupName: meta?.retailGroup?.name ?? null,
          size: meta?.size ?? null,
          color: meta?.color ?? null,
          imageUrl: meta?.retailGroup?.imageUrl || meta?.imageUrl || null,
          qty: p.qty,
          revenue: Number(p.revenue.toFixed(2)),
        };
      });

    // Top 8 produtos para a widget lateral (com foto compartilhada do grupo e grade)
    const topProducts = productsSold.slice(0, 8).map((p) => ({
      ...p,
      pct: periodRevenue > 0 ? (p.revenue / periodRevenue) * 100 : 0,
    }));

    const avgTicket =
      periodSales.length > 0 ? periodRevenue / periodSales.length : 0;
    const pa =
      periodSales.length > 0
        ? Number((totalPieces / periodSales.length).toFixed(2))
        : 0;
    const grossPotential = periodRevenue + totalDiscount;
    const discountRatePct =
      grossPotential > 0
        ? Number(((totalDiscount / grossPotential) * 100).toFixed(1))
        : 0;

    const prevPeriodRevenue = Number(prevPeriodAgg._sum.total ?? 0);
    const prevPeriodTransactions = Number(prevPeriodAgg._count.id ?? 0);
    const prevPeriodAvgTicket =
      prevPeriodTransactions > 0
        ? prevPeriodRevenue / prevPeriodTransactions
        : 0;
    const vsPreviousPct =
      prevPeriodRevenue > 0
        ? Number(
            (
              ((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) *
              100
            ).toFixed(1),
          )
        : null;

    const overduePayables = payablesAlerts.filter((p) => p.dueDate < todayStart);
    const upcomingPayables = payablesAlerts.filter((p) => p.dueDate >= todayStart);

    return {
      openRegisters: openRegistersWithRevenue,
      // Compat: currentRegister aponta para o primeiro caixa aberto (se houver)
      currentRegister:
        openRegistersWithRevenue.length > 0 ? openRegistersWithRevenue[0] : null,
      today: {
        revenue: Number(todayAgg._sum.total ?? 0),
        transactions: Number(todayAgg._count.id ?? 0),
      },
      week: {
        revenue: weekRevenue,
        vsLastWeek,
      },
      month: {
        revenue: Number(monthAgg._sum.total ?? 0),
      },
      period: {
        revenue: periodRevenue,
        transactions: periodSales.length,
        pieces: totalPieces,
        pa,
        avgTicket,
        maxTicket,
        totalDiscount: Number(totalDiscount.toFixed(2)),
        discountRatePct,
        identifiedSalesCount,
        previousPeriod: {
          startDate: prevPeriodStartStr,
          endDate: prevPeriodEndStr,
          revenue: prevPeriodRevenue,
          transactions: prevPeriodTransactions,
          avgTicket: prevPeriodAvgTicket,
          vsPreviousPct,
        },
        byPaymentMethod,
        countByPaymentMethod,
        byHour,
        countByHour,
        byDay,
        countByDay,
        byWeek,
        countByWeek,
        byMonth,
        countByMonth,
        topProducts,
        productsSold,
      },
      alerts: {
        overduePayables,
        upcomingPayables,
      },
    };
  }
}
