import { BadRequestException, Injectable } from '@nestjs/common';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { businessDayStart } from './retail-overview.service';

export interface CommercialGoalsConfig {
  storeMonthlyGoal: number;
  defaultSellerGoal: number;
  defaultCommissionPct: number;
  commissionBasis: 'net' | 'gross';
  maxHealthyDiscountPct: number;
  maxHealthyReturnPct: number;
  sellerOverrides: Record<
    string,
    {
      goal?: number;
      commissionPct?: number;
    }
  >;
}

export const DEFAULT_COMMERCIAL_GOALS_CONFIG: CommercialGoalsConfig = {
  storeMonthlyGoal: 25000,
  defaultSellerGoal: 8000,
  defaultCommissionPct: 3.0,
  commissionBasis: 'net',
  maxHealthyDiscountPct: 8.0,
  maxHealthyReturnPct: 10.0,
  sellerOverrides: {},
};

const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cash: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de crédito',
  credit: 'Cartão de crédito',
  debito: 'Cartão de débito',
  debit: 'Cartão de débito',
  credito_loja: 'Crédito na loja',
  crediario: 'Crediário',
};

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function round1(val: number): number {
  return Math.round((Number(val) || 0) * 10) / 10;
}

export function formatSaoPauloDateTimeParts(date: Date): {
  dateStr: string;
  timeStr: string;
  hour: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const rawHour = Number(get('hour') || 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = get('minute') || '00';
  const wkShort = get('weekday');
  const wkMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${String(hour).padStart(2, '0')}:${minute}`,
    hour,
    weekday: wkMap[wkShort] ?? date.getUTCDay(),
  };
}

export function buildDateSequence(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  let cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cursor <= end && result.length <= 370) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return result;
}

export function normalizeGoalsConfig(raw: any): CommercialGoalsConfig {
  const source = raw && typeof raw === 'object' ? raw : {};
  const overridesRaw =
    source.sellerOverrides && typeof source.sellerOverrides === 'object'
      ? source.sellerOverrides
      : {};
  const sellerOverrides: CommercialGoalsConfig['sellerOverrides'] = {};
  for (const [opId, cfg] of Object.entries(overridesRaw)) {
    if (!opId || !cfg || typeof cfg !== 'object') continue;
    const goalNum = Number((cfg as any).goal);
    const commNum = Number((cfg as any).commissionPct);
    sellerOverrides[opId] = {
      ...(Number.isFinite(goalNum) && goalNum >= 0 ? { goal: round2(goalNum) } : {}),
      ...(Number.isFinite(commNum) && commNum >= 0 && commNum <= 100
        ? { commissionPct: round2(commNum) }
        : {}),
    };
  }

  const numOrDefault = (val: any, fallback: number, min = 0, max = 100000000) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= min && n <= max ? round2(n) : fallback;
  };

  return {
    storeMonthlyGoal: numOrDefault(
      source.storeMonthlyGoal,
      DEFAULT_COMMERCIAL_GOALS_CONFIG.storeMonthlyGoal,
      0,
    ),
    defaultSellerGoal: numOrDefault(
      source.defaultSellerGoal,
      DEFAULT_COMMERCIAL_GOALS_CONFIG.defaultSellerGoal,
      0,
    ),
    defaultCommissionPct: numOrDefault(
      source.defaultCommissionPct,
      DEFAULT_COMMERCIAL_GOALS_CONFIG.defaultCommissionPct,
      0,
      100,
    ),
    commissionBasis: source.commissionBasis === 'gross' ? 'gross' : 'net',
    maxHealthyDiscountPct: numOrDefault(
      source.maxHealthyDiscountPct,
      DEFAULT_COMMERCIAL_GOALS_CONFIG.maxHealthyDiscountPct,
      0,
      100,
    ),
    maxHealthyReturnPct: numOrDefault(
      source.maxHealthyReturnPct,
      DEFAULT_COMMERCIAL_GOALS_CONFIG.maxHealthyReturnPct,
      0,
      100,
    ),
    sellerOverrides,
  };
}

@Injectable()
export class RetailIntelligenceService {
  constructor(
    private readonly context: TenantContextService,
    private readonly manager: TenantConnectionManager,
    private readonly heartPrisma: HeartPrismaService,
  ) {}

  private async getOperatorImagesMap(tenantId: string): Promise<{
    byOperatorId: Map<string, string | null>;
    byName: Map<string, string | null>;
  }> {
    const byOperatorId = new Map<string, string | null>();
    const byName = new Map<string, string | null>();
    try {
      const [profileRows, tenantUsers] = await Promise.all([
        this.heartPrisma
          ?.$queryRawUnsafe<Array<{ operator_id: string; image_url: string | null }>>(
            `SELECT "operator_id", "image_url" FROM "operator_profiles" WHERE "tenant_id" = $1`,
            tenantId,
          )
          .catch(() => []),
        this.heartPrisma?.user
          ?.findMany({
            where: { tenantId },
            select: { name: true, imageUrl: true },
          })
          .catch(() => []),
      ]);

      for (const row of profileRows || []) {
        if (row.operator_id && row.image_url) {
          byOperatorId.set(row.operator_id, row.image_url);
        }
      }
      for (const u of tenantUsers || []) {
        if (u.name && u.imageUrl) {
          byName.set(u.name.trim().toLowerCase(), u.imageUrl);
        }
      }
    } catch {
      // Ignora caso heartPrisma não esteja disponível em testes unitários isolados
    }
    return { byOperatorId, byName };
  }

  async updateGoals(input: Partial<CommercialGoalsConfig>) {
    const { tenantId, databaseUrl } = this.context.get();
    const db = await this.manager.getTenantClient(tenantId, databaseUrl);
    const settings = await db.tenantSettings
      .findUnique({ where: { id: 'singleton' } })
      .catch(() => null);
    const currentPaymentCfg =
      (settings?.paymentMethodsConfig as Record<string, any>) || {};
    const existingGoals = normalizeGoalsConfig(
      currentPaymentCfg._commercialIntelligenceConfig,
    );

    const mergedGoals = normalizeGoalsConfig({
      ...existingGoals,
      ...input,
      sellerOverrides: {
        ...existingGoals.sellerOverrides,
        ...(input?.sellerOverrides || {}),
      },
    });

    const nextPaymentCfg = {
      ...currentPaymentCfg,
      _commercialIntelligenceConfig: mergedGoals,
    };

    await db.tenantSettings.upsert({
      where: { id: 'singleton' },
      update: { paymentMethodsConfig: nextPaymentCfg as any },
      create: { id: 'singleton', paymentMethodsConfig: nextPaymentCfg as any },
    });

    return mergedGoals;
  }

  async getIntelligence(startDate: string, endDate: string) {
    const start = businessDayStart(startDate);
    const endStart = businessDayStart(endDate);
    if (
      endStart < start ||
      endStart.getTime() - start.getTime() > 366 * 86400000
    ) {
      throw new BadRequestException('Selecione um período de até 366 dias.');
    }

    const nextDay = new Date(
      new Date(`${endDate}T12:00:00Z`).getTime() + 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const createdAt = { gte: start, lt: businessDayStart(nextDay) };

    const { tenantId, databaseUrl } = this.context.get();
    const db = await this.manager.getTenantClient(tenantId, databaseUrl);

    const [operators, sales, returns, settings, imagesMap] = await Promise.all([
      db.operator.findMany({
        select: {
          id: true,
          name: true,
          jobTitle: true,
          active: true,
          isManager: true,
        },
        orderBy: { name: 'asc' },
      }),
      db.sale.findMany({
        where: {
          createdAt,
          status: 'completed',
          NOT: { source: 'ajuste_fiscal' },
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
          operator: {
            select: { id: true, name: true, jobTitle: true, isManager: true },
          },
          payments: {
            select: { method: true, label: true, value: true },
          },
          items: {
            select: {
              id: true,
              productId: true,
              productName: true,
              quantity: true,
              priceUnit: true,
              priceCost: true,
              discount: true,
              subtotal: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  size: true,
                  color: true,
                  category: { select: { id: true, name: true } },
                  retailGroup: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.retailReturn.findMany({
        where: { createdAt },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          sale: {
            select: {
              id: true,
              code: true,
              operatorId: true,
              createdAt: true,
              total: true,
            },
          },
          items: {
            include: {
              saleItem: {
                select: {
                  id: true,
                  productName: true,
                  quantity: true,
                  priceUnit: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.tenantSettings
        .findUnique({ where: { id: 'singleton' } })
        .catch(() => null),
      this.getOperatorImagesMap(tenantId),
    ]);

    const savedPaymentCfg =
      (settings?.paymentMethodsConfig as Record<string, any>) || {};
    const goalsConfig = normalizeGoalsConfig(
      savedPaymentCfg._commercialIntelligenceConfig,
    );

    const resolveAvatar = (opId?: string | null, opName?: string | null) => {
      if (opId && imagesMap.byOperatorId.has(opId)) {
        return imagesMap.byOperatorId.get(opId) || null;
      }
      if (opName) {
        const key = opName.trim().toLowerCase();
        if (imagesMap.byName.has(key)) return imagesMap.byName.get(key) || null;
      }
      return null;
    };

    // Mapa de retornos por saleId para exibir selo de troca nas vendas do calendário
    const returnsBySaleId = new Map<
      string,
      { totalReturned: number; piecesReturned: number; reasons: string[] }
    >();
    for (const ret of returns) {
      const prev = returnsBySaleId.get(ret.saleId) || {
        totalReturned: 0,
        piecesReturned: 0,
        reasons: [],
      };
      prev.totalReturned = round2(prev.totalReturned + Number(ret.total || 0));
      const retPieces = (ret.items || []).reduce(
        (n, i) => n + Number(i.quantity || 0),
        0,
      );
      prev.piecesReturned += retPieces;
      if (ret.reason && !prev.reasons.includes(ret.reason)) {
        prev.reasons.push(ret.reason);
      }
      returnsBySaleId.set(ret.saleId, prev);
    }

    interface SellerAccumulator {
      operatorId: string;
      name: string;
      jobTitle: string;
      isManager: boolean;
      active: boolean;
      imageUrl: string | null;
      grossRevenue: number;
      subtotalBeforeDiscount: number;
      discountTotal: number;
      discountedSalesCount: number;
      returnsAmount: number;
      returnsCount: number;
      returnedPieces: number;
      returnReasonsMap: Map<string, { count: number; value: number }>;
      salesCount: number;
      piecesCount: number;
      multiItemSalesCount: number;
      totalCost: number;
      identifiedSalesCount: number;
      uniqueCustomerIds: Set<string>;
      activeDates: Set<string>;
      dailyWinsCount: number;
      top25DaysCount: number;
      byDate: Map<
        string,
        {
          date: string;
          revenue: number;
          discountTotal: number;
          returnsTotal: number;
          salesCount: number;
          piecesCount: number;
        }
      >;
      byWeekday: Map<number, { revenue: number; salesCount: number }>;
      byHour: Map<number, { revenue: number; salesCount: number }>;
      categoriesMap: Map<string, { name: string; quantity: number; revenue: number }>;
      groupsMap: Map<string, { id: string; name: string; quantity: number; revenue: number }>;
      recentSales: any[];
      recentReturns: any[];
    }

    const sellerMap = new Map<string, SellerAccumulator>();

    const ensureSeller = (
      id: string,
      name: string,
      jobTitle?: string | null,
      isManager = false,
      active = true,
    ): SellerAccumulator => {
      if (!sellerMap.has(id)) {
        sellerMap.set(id, {
          operatorId: id,
          name,
          jobTitle: jobTitle || (isManager ? 'Gerente de Loja' : 'Consultor(a) de Vendas'),
          isManager,
          active,
          imageUrl: resolveAvatar(id, name),
          grossRevenue: 0,
          subtotalBeforeDiscount: 0,
          discountTotal: 0,
          discountedSalesCount: 0,
          returnsAmount: 0,
          returnsCount: 0,
          returnedPieces: 0,
          returnReasonsMap: new Map(),
          salesCount: 0,
          piecesCount: 0,
          multiItemSalesCount: 0,
          totalCost: 0,
          identifiedSalesCount: 0,
          uniqueCustomerIds: new Set(),
          activeDates: new Set(),
          dailyWinsCount: 0,
          top25DaysCount: 0,
          byDate: new Map(),
          byWeekday: new Map(),
          byHour: new Map(),
          categoriesMap: new Map(),
          groupsMap: new Map(),
          recentSales: [],
          recentReturns: [],
        });
      }
      return sellerMap.get(id)!;
    };

    for (const op of operators) {
      ensureSeller(op.id, op.name, op.jobTitle, op.isManager, op.active);
    }

    // Estrutura de calendário diário
    interface DayAccumulator {
      date: string;
      weekday: number;
      weekdayLabel: string;
      revenue: number;
      discountTotal: number;
      subtotalBeforeDiscount: number;
      returnsTotal: number;
      returnsCount: number;
      salesCount: number;
      piecesCount: number;
      sellers: Map<
        string,
        {
          operatorId: string;
          name: string;
          jobTitle: string;
          imageUrl: string | null;
          revenue: number;
          discountTotal: number;
          returnsTotal: number;
          salesCount: number;
          piecesCount: number;
        }
      >;
      sales: any[];
    }

    const calendarMap = new Map<string, DayAccumulator>();
    const dateSeq = buildDateSequence(startDate, endDate);
    for (const dStr of dateSeq) {
      const dt = new Date(`${dStr}T12:00:00Z`);
      const wk = dt.getUTCDay();
      calendarMap.set(dStr, {
        date: dStr,
        weekday: wk,
        weekdayLabel: WEEKDAY_LABELS[wk] || '',
        revenue: 0,
        discountTotal: 0,
        subtotalBeforeDiscount: 0,
        returnsTotal: 0,
        returnsCount: 0,
        salesCount: 0,
        piecesCount: 0,
        sellers: new Map(),
        sales: [],
      });
    }

    const ensureDay = (dateStr: string, weekday: number): DayAccumulator => {
      if (!calendarMap.has(dateStr)) {
        calendarMap.set(dateStr, {
          date: dateStr,
          weekday,
          weekdayLabel: WEEKDAY_LABELS[weekday] || '',
          revenue: 0,
          discountTotal: 0,
          subtotalBeforeDiscount: 0,
          returnsTotal: 0,
          returnsCount: 0,
          salesCount: 0,
          piecesCount: 0,
          sellers: new Map(),
          sales: [],
        });
      }
      return calendarMap.get(dateStr)!;
    };

    // Processar todas as vendas concluídas
    for (const sale of sales) {
      const opId = sale.operatorId || 'sem-vendedor';
      const opName = sale.operator?.name || 'Balcão (Sem Vendedor)';
      const seller = ensureSeller(
        opId,
        opName,
        sale.operator?.jobTitle,
        sale.operator?.isManager ?? false,
        true,
      );

      const { dateStr, timeStr, hour, weekday } = formatSaoPauloDateTimeParts(
        new Date(sale.createdAt),
      );
      const dayAcc = ensureDay(dateStr, weekday);

      const saleTotal = round2(Number(sale.total || 0));
      const headerDiscount = round2(Number(sale.discount || 0));
      let itemsDiscount = 0;
      let salePieces = 0;
      let saleCost = 0;

      const formattedItems = (sale.items || []).map((item) => {
        const qty = Number(item.quantity || 0);
        const unitPrice = round2(Number(item.priceUnit || 0));
        const itemSub = round2(Number(item.subtotal || 0));
        const itemDisc = round2(Number(item.discount || 0));
        const unitCost = Number(item.priceCost || 0);

        salePieces += qty;
        itemsDiscount = round2(itemsDiscount + itemDisc);
        saleCost = round2(saleCost + unitCost * qty);

        const catName = item.product?.category?.name || 'Geral';
        const catPrev = seller.categoriesMap.get(catName) || {
          name: catName,
          quantity: 0,
          revenue: 0,
        };
        catPrev.quantity += qty;
        catPrev.revenue = round2(catPrev.revenue + itemSub);
        seller.categoriesMap.set(catName, catPrev);

        const grpId = item.product?.retailGroup?.id || item.productId;
        const grpName =
          item.product?.retailGroup?.name || item.productName || 'Mercadoria';
        const grpPrev = seller.groupsMap.get(grpId) || {
          id: grpId,
          name: grpName,
          quantity: 0,
          revenue: 0,
        };
        grpPrev.quantity += qty;
        grpPrev.revenue = round2(grpPrev.revenue + itemSub);
        seller.groupsMap.set(grpId, grpPrev);

        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          groupName: grpName,
          categoryName: catName,
          size: item.product?.size || null,
          color: item.product?.color || null,
          quantity: qty,
          priceUnit: unitPrice,
          subtotal: itemSub,
        };
      });

      const totalSaleDiscount = round2(headerDiscount + itemsDiscount);
      const rawSubtotal = round2(
        Math.max(Number(sale.subtotal || 0), saleTotal + totalSaleDiscount),
      );

      seller.grossRevenue = round2(seller.grossRevenue + saleTotal);
      seller.subtotalBeforeDiscount = round2(
        seller.subtotalBeforeDiscount + rawSubtotal,
      );
      seller.discountTotal = round2(seller.discountTotal + totalSaleDiscount);
      if (totalSaleDiscount > 0.009) {
        seller.discountedSalesCount += 1;
      }
      seller.salesCount += 1;
      seller.piecesCount += salePieces;
      if (salePieces >= 2) {
        seller.multiItemSalesCount += 1;
      }
      seller.totalCost = round2(seller.totalCost + saleCost);

      if (sale.customerId) {
        seller.identifiedSalesCount += 1;
        seller.uniqueCustomerIds.add(sale.customerId);
      }

      seller.activeDates.add(dateStr);

      // Agregação por data no vendedor
      const sellerDay = seller.byDate.get(dateStr) || {
        date: dateStr,
        revenue: 0,
        discountTotal: 0,
        returnsTotal: 0,
        salesCount: 0,
        piecesCount: 0,
      };
      sellerDay.revenue = round2(sellerDay.revenue + saleTotal);
      sellerDay.discountTotal = round2(
        sellerDay.discountTotal + totalSaleDiscount,
      );
      sellerDay.salesCount += 1;
      sellerDay.piecesCount += salePieces;
      seller.byDate.set(dateStr, sellerDay);

      // Agregação por dia da semana no vendedor
      const wkEntry = seller.byWeekday.get(weekday) || {
        revenue: 0,
        salesCount: 0,
      };
      wkEntry.revenue = round2(wkEntry.revenue + saleTotal);
      wkEntry.salesCount += 1;
      seller.byWeekday.set(weekday, wkEntry);

      // Agregação por hora no vendedor
      const hrEntry = seller.byHour.get(hour) || {
        revenue: 0,
        salesCount: 0,
      };
      hrEntry.revenue = round2(hrEntry.revenue + saleTotal);
      hrEntry.salesCount += 1;
      seller.byHour.set(hour, hrEntry);

      const paymentMethods = (sale.payments || []).map((p) => {
        const key = String(p.method || '').toLowerCase();
        return p.label || PAYMENT_LABELS[key] || p.method || 'Pagamento';
      });

      const saleReturnInfo = returnsBySaleId.get(sale.id);
      const saleRecord = {
        id: sale.id,
        code: sale.code,
        date: dateStr,
        time: timeStr,
        createdAt: sale.createdAt,
        operatorId: opId,
        operatorName: seller.name,
        operatorImageUrl: seller.imageUrl,
        customerId: sale.customerId,
        customerName: sale.customer?.name || sale.consumidorNome || null,
        customerPhone: sale.customer?.phone || null,
        subtotal: rawSubtotal,
        discount: totalSaleDiscount,
        discountPct:
          rawSubtotal > 0 ? round1((totalSaleDiscount / rawSubtotal) * 100) : 0,
        total: saleTotal,
        piecesCount: salePieces,
        paymentMethods: [...new Set(paymentMethods)],
        hasReturn: Boolean(saleReturnInfo),
        returnedAmount: saleReturnInfo?.totalReturned || 0,
        returnedPieces: saleReturnInfo?.piecesReturned || 0,
        items: formattedItems,
      };

      if (seller.recentSales.length < 25) {
        seller.recentSales.push(saleRecord);
      }

      // Alimenta o calendário do dia
      dayAcc.revenue = round2(dayAcc.revenue + saleTotal);
      dayAcc.discountTotal = round2(dayAcc.discountTotal + totalSaleDiscount);
      dayAcc.subtotalBeforeDiscount = round2(
        dayAcc.subtotalBeforeDiscount + rawSubtotal,
      );
      dayAcc.salesCount += 1;
      dayAcc.piecesCount += salePieces;
      dayAcc.sales.push(saleRecord);

      const daySeller = dayAcc.sellers.get(opId) || {
        operatorId: opId,
        name: seller.name,
        jobTitle: seller.jobTitle,
        imageUrl: seller.imageUrl,
        revenue: 0,
        discountTotal: 0,
        returnsTotal: 0,
        salesCount: 0,
        piecesCount: 0,
      };
      daySeller.revenue = round2(daySeller.revenue + saleTotal);
      daySeller.discountTotal = round2(
        daySeller.discountTotal + totalSaleDiscount,
      );
      daySeller.salesCount += 1;
      daySeller.piecesCount += salePieces;
      dayAcc.sellers.set(opId, daySeller);
    }

    // Processar todas as trocas do período (atribuindo ao vendedor da venda original!)
    for (const ret of returns) {
      const originOpId = ret.sale?.operatorId || ret.operatorId || 'sem-vendedor';
      let seller = sellerMap.get(originOpId);
      if (!seller) {
        seller = ensureSeller(originOpId, 'Balcão (Sem Vendedor)', 'Balcão', false, true);
      }

      const retVal = round2(Number(ret.total || 0));
      const retPieces = (ret.items || []).reduce(
        (n, i) => n + Number(i.quantity || 0),
        0,
      );

      seller.returnsAmount = round2(seller.returnsAmount + retVal);
      seller.returnsCount += 1;
      seller.returnedPieces += retPieces;

      const reasonText = (ret.reason || 'Troca de mercadoria').trim();
      const prevReason = seller.returnReasonsMap.get(reasonText) || {
        count: 0,
        value: 0,
      };
      prevReason.count += 1;
      prevReason.value = round2(prevReason.value + retVal);
      seller.returnReasonsMap.set(reasonText, prevReason);

      const { dateStr, timeStr, weekday } = formatSaoPauloDateTimeParts(
        new Date(ret.createdAt),
      );
      const dayAcc = ensureDay(dateStr, weekday);
      dayAcc.returnsTotal = round2(dayAcc.returnsTotal + retVal);
      dayAcc.returnsCount += 1;

      const sellerDay = seller.byDate.get(dateStr) || {
        date: dateStr,
        revenue: 0,
        discountTotal: 0,
        returnsTotal: 0,
        salesCount: 0,
        piecesCount: 0,
      };
      sellerDay.returnsTotal = round2(sellerDay.returnsTotal + retVal);
      seller.byDate.set(dateStr, sellerDay);

      const daySeller = dayAcc.sellers.get(originOpId) || {
        operatorId: originOpId,
        name: seller.name,
        jobTitle: seller.jobTitle,
        imageUrl: seller.imageUrl,
        revenue: 0,
        discountTotal: 0,
        returnsTotal: 0,
        salesCount: 0,
        piecesCount: 0,
      };
      daySeller.returnsTotal = round2(daySeller.returnsTotal + retVal);
      dayAcc.sellers.set(originOpId, daySeller);

      if (seller.recentReturns.length < 15) {
        seller.recentReturns.push({
          id: ret.id,
          saleId: ret.saleId,
          saleCode: ret.sale?.code || null,
          date: dateStr,
          time: timeStr,
          customerName: ret.customer?.name || 'Cliente',
          reason: reasonText,
          total: retVal,
          piecesCount: retPieces,
          items: (ret.items || []).map((ri) => ({
            productName: ri.saleItem?.productName || 'Mercadoria',
            quantity: ri.quantity,
            value: round2(Number(ri.value || 0)),
            restock: ri.restock,
          })),
        });
      }
    }

    // Calcular Campeão do Dia (MVP de cada dia) e vitórias diárias (dailyWinsCount)
    const calendarDays = [...calendarMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => {
        const sellerBreakdown = [...day.sellers.values()]
          .map((s) => {
            const netRevenue = round2(s.revenue - s.returnsTotal);
            const pa = s.salesCount > 0 ? round2(s.piecesCount / s.salesCount) : 0;
            const shareOfDayPct =
              day.revenue > 0 ? round1((s.revenue / day.revenue) * 100) : 0;
            return {
              ...s,
              netRevenue,
              pa,
              shareOfDayPct,
            };
          })
          .sort((a, b) => b.revenue - a.revenue || b.piecesCount - a.piecesCount);

        let champion: {
          operatorId: string;
          name: string;
          jobTitle: string;
          imageUrl: string | null;
          revenue: number;
          netRevenue: number;
          salesCount: number;
          piecesCount: number;
          shareOfDayPct: number;
        } | null = null;

        const sellersWithSales = sellerBreakdown.filter((s) => s.salesCount > 0);
        if (sellersWithSales.length > 0) {
          const top = sellersWithSales[0];
          champion = {
            operatorId: top.operatorId,
            name: top.name,
            jobTitle: top.jobTitle,
            imageUrl: top.imageUrl,
            revenue: top.revenue,
            netRevenue: top.netRevenue,
            salesCount: top.salesCount,
            piecesCount: top.piecesCount,
            shareOfDayPct: top.shareOfDayPct,
          };
          const champAcc = sellerMap.get(top.operatorId);
          if (champAcc) {
            champAcc.dailyWinsCount += 1;
          }

          // Top 25% ou pódio do dia
          const topCutoff = Math.max(1, Math.ceil(sellersWithSales.length * 0.5));
          for (let i = 0; i < Math.min(topCutoff, sellersWithSales.length); i++) {
            const sAcc = sellerMap.get(sellersWithSales[i].operatorId);
            if (sAcc) sAcc.top25DaysCount += 1;
          }
        }

        const netRevenue = round2(day.revenue - day.returnsTotal);
        const pa =
          day.salesCount > 0 ? round2(day.piecesCount / day.salesCount) : 0;
        const avgTicket =
          day.salesCount > 0 ? round2(day.revenue / day.salesCount) : 0;
        const discountRatePct =
          day.subtotalBeforeDiscount > 0
            ? round1((day.discountTotal / day.subtotalBeforeDiscount) * 100)
            : 0;

        return {
          date: day.date,
          weekday: day.weekday,
          weekdayLabel: day.weekdayLabel,
          hasSales: day.salesCount > 0,
          revenue: day.revenue,
          netRevenue,
          discountTotal: day.discountTotal,
          discountRatePct,
          returnsTotal: day.returnsTotal,
          returnsCount: day.returnsCount,
          salesCount: day.salesCount,
          piecesCount: day.piecesCount,
          pa,
          avgTicket,
          champion,
          sellerBreakdown,
          sales: day.sales,
        };
      });

    // Totais da loja para cálculo de participação (Share %)
    const storeGrossRevenue = round2(
      [...sellerMap.values()].reduce((n, s) => n + s.grossRevenue, 0),
    );
    const storeReturnsTotal = round2(
      [...sellerMap.values()].reduce((n, s) => n + s.returnsAmount, 0),
    );
    const storeNetRevenue = round2(storeGrossRevenue - storeReturnsTotal);
    const storeSubtotalBeforeDiscount = round2(
      [...sellerMap.values()].reduce((n, s) => n + s.subtotalBeforeDiscount, 0),
    );
    const storeDiscountsTotal = round2(
      [...sellerMap.values()].reduce((n, s) => n + s.discountTotal, 0),
    );
    const storeDiscountedSalesCount = [...sellerMap.values()].reduce(
      (n, s) => n + s.discountedSalesCount,
      0,
    );
    const storeTotalSales = [...sellerMap.values()].reduce(
      (n, s) => n + s.salesCount,
      0,
    );
    const storeTotalPieces = [...sellerMap.values()].reduce(
      (n, s) => n + s.piecesCount,
      0,
    );
    const storeMultiItemSales = [...sellerMap.values()].reduce(
      (n, s) => n + s.multiItemSalesCount,
      0,
    );
    const storeIdentifiedSales = [...sellerMap.values()].reduce(
      (n, s) => n + s.identifiedSalesCount,
      0,
    );
    const storeTotalCost = round2(
      [...sellerMap.values()].reduce((n, s) => n + s.totalCost, 0),
    );
    const storeActiveDaysCount = calendarDays.filter((d) => d.hasSales).length;

    // Consolidar lista final de vendedores
    const sellers = [...sellerMap.values()]
      .filter((s) => s.operatorId !== 'sem-vendedor' || s.salesCount > 0)
      .map((s) => {
        const netRevenue = round2(s.grossRevenue - s.returnsAmount);
        const sharePct =
          storeGrossRevenue > 0
            ? round1((s.grossRevenue / storeGrossRevenue) * 100)
            : 0;
        const netSharePct =
          storeNetRevenue > 0
            ? round1((Math.max(0, netRevenue) / storeNetRevenue) * 100)
            : sharePct;
        const pa =
          s.salesCount > 0 ? round2(s.piecesCount / s.salesCount) : 0;
        const multiItemRatePct =
          s.salesCount > 0
            ? round1((s.multiItemSalesCount / s.salesCount) * 100)
            : 0;
        const avgTicket =
          s.salesCount > 0 ? round2(s.grossRevenue / s.salesCount) : 0;
        const avgPiecePrice =
          s.piecesCount > 0 ? round2(s.grossRevenue / s.piecesCount) : 0;
        const discountRatePct =
          s.subtotalBeforeDiscount > 0
            ? round1((s.discountTotal / s.subtotalBeforeDiscount) * 100)
            : 0;
        const discountedSalesRatePct =
          s.salesCount > 0
            ? round1((s.discountedSalesCount / s.salesCount) * 100)
            : 0;
        const returnRatePct =
          s.grossRevenue > 0
            ? round1((s.returnsAmount / s.grossRevenue) * 100)
            : 0;
        const returnPiecesRatePct =
          s.piecesCount > 0
            ? round1((s.returnedPieces / s.piecesCount) * 100)
            : 0;
        const estimatedMargin = round2(s.grossRevenue - s.totalCost);
        const marginRatePct =
          s.grossRevenue > 0
            ? round1((estimatedMargin / s.grossRevenue) * 100)
            : 0;
        const identifiedRatePct =
          s.salesCount > 0
            ? round1((s.identifiedSalesCount / s.salesCount) * 100)
            : 0;

        // Melhor dia do vendedor
        const dailyHistory = [...s.byDate.values()]
          .map((d) => ({
            ...d,
            netRevenue: round2(d.revenue - d.returnsTotal),
            pa: d.salesCount > 0 ? round2(d.piecesCount / d.salesCount) : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const bestDay =
          [...dailyHistory].sort(
            (a, b) => b.revenue - a.revenue || b.piecesCount - a.piecesCount,
          )[0] || null;

        // Melhor dia da semana
        const bestWeekdayEntry = [...s.byWeekday.entries()].sort(
          (a, b) => b[1].revenue - a[1].revenue,
        )[0];
        const bestWeekday = bestWeekdayEntry
          ? {
              weekday: bestWeekdayEntry[0],
              label: WEEKDAY_LABELS[bestWeekdayEntry[0]] || '',
              revenue: bestWeekdayEntry[1].revenue,
              salesCount: bestWeekdayEntry[1].salesCount,
            }
          : null;

        // Horário de pico
        const peakHourEntry = [...s.byHour.entries()].sort(
          (a, b) => b[1].revenue - a[1].revenue,
        )[0];
        const peakHour = peakHourEntry
          ? {
              hour: peakHourEntry[0],
              label: `${String(peakHourEntry[0]).padStart(2, '0')}h às ${String((peakHourEntry[0] + 1) % 24).padStart(2, '0')}h`,
              revenue: peakHourEntry[1].revenue,
              salesCount: peakHourEntry[1].salesCount,
            }
          : null;

        // Metas e comissões
        const override = goalsConfig.sellerOverrides[s.operatorId] || {};
        const goal =
          override.goal !== undefined
            ? override.goal
            : goalsConfig.defaultSellerGoal;
        const commissionPct =
          override.commissionPct !== undefined
            ? override.commissionPct
            : goalsConfig.defaultCommissionPct;
        const basisAmount =
          goalsConfig.commissionBasis === 'gross'
            ? s.grossRevenue
            : Math.max(0, netRevenue);
        const estimatedCommission = round2((basisAmount * commissionPct) / 100);
        const goalProgressPct =
          goal > 0 ? round1((basisAmount / goal) * 100) : 0;

        const winRatePct =
          storeActiveDaysCount > 0
            ? round1((s.dailyWinsCount / storeActiveDaysCount) * 100)
            : 0;

        return {
          operatorId: s.operatorId,
          name: s.name,
          jobTitle: s.jobTitle,
          isManager: s.isManager,
          active: s.active,
          imageUrl: s.imageUrl,
          grossRevenue: s.grossRevenue,
          returnsAmount: s.returnsAmount,
          returnsCount: s.returnsCount,
          returnedPieces: s.returnedPieces,
          netRevenue,
          sharePct,
          netSharePct,
          salesCount: s.salesCount,
          piecesCount: s.piecesCount,
          pa,
          multiItemSalesCount: s.multiItemSalesCount,
          multiItemRatePct,
          avgTicket,
          avgPiecePrice,
          subtotalBeforeDiscount: s.subtotalBeforeDiscount,
          discountTotal: s.discountTotal,
          discountRatePct,
          discountedSalesCount: s.discountedSalesCount,
          discountedSalesRatePct,
          returnRatePct,
          returnPiecesRatePct,
          returnReasons: [...s.returnReasonsMap.entries()]
            .map(([reason, data]) => ({
              reason,
              count: data.count,
              value: data.value,
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
          estimatedMargin,
          marginRatePct,
          identifiedSalesCount: s.identifiedSalesCount,
          identifiedRatePct,
          uniqueCustomersCount: s.uniqueCustomerIds.size,
          activeDaysCount: s.activeDates.size,
          dailyWinsCount: s.dailyWinsCount,
          winRatePct,
          top25DaysCount: s.top25DaysCount,
          bestDay,
          bestWeekday,
          peakHour,
          goal,
          goalProgressPct,
          commissionPct,
          estimatedCommission,
          topCategories: [...s.categoriesMap.values()]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5),
          topGroups: [...s.groupsMap.values()]
            .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
            .slice(0, 6),
          dailyHistory,
          recentSales: s.recentSales,
          recentReturns: s.recentReturns,
        };
      })
      .sort(
        (a, b) =>
          b.netRevenue - a.netRevenue ||
          b.grossRevenue - a.grossRevenue ||
          b.piecesCount - a.piecesCount,
      );

    // Melhor dia da loja no período
    const bestStoreDay =
      [...calendarDays]
        .filter((d) => d.hasSales)
        .sort((a, b) => b.revenue - a.revenue || b.piecesCount - a.piecesCount)[0] ||
      null;

    const topSeller = sellers[0] || null;
    const totalEstimatedCommission = round2(
      sellers.reduce((n, s) => n + s.estimatedCommission, 0),
    );
    const storeDiscountRatePct =
      storeSubtotalBeforeDiscount > 0
        ? round1((storeDiscountsTotal / storeSubtotalBeforeDiscount) * 100)
        : 0;
    const storeReturnRatePct =
      storeGrossRevenue > 0
        ? round1((storeReturnsTotal / storeGrossRevenue) * 100)
        : 0;
    const storePa =
      storeTotalSales > 0 ? round2(storeTotalPieces / storeTotalSales) : 0;
    const storeMultiItemRatePct =
      storeTotalSales > 0
        ? round1((storeMultiItemSales / storeTotalSales) * 100)
        : 0;
    const storeAvgTicket =
      storeTotalSales > 0 ? round2(storeGrossRevenue / storeTotalSales) : 0;
    const storeIdentifiedRatePct =
      storeTotalSales > 0
        ? round1((storeIdentifiedSales / storeTotalSales) * 100)
        : 0;
    const storeEstimatedMargin = round2(storeGrossRevenue - storeTotalCost);
    const storeMarginRatePct =
      storeGrossRevenue > 0
        ? round1((storeEstimatedMargin / storeGrossRevenue) * 100)
        : 0;
    const storeGoalProgressPct =
      goalsConfig.storeMonthlyGoal > 0
        ? round1(
            ((goalsConfig.commissionBasis === 'gross'
              ? storeGrossRevenue
              : Math.max(0, storeNetRevenue)) /
              goalsConfig.storeMonthlyGoal) *
              100,
          )
        : 0;

    // Gerar insights acionáveis para o gestor
    const insights: Array<{
      id: string;
      kind: 'leader' | 'pa' | 'discount' | 'return' | 'calendar' | 'loyalty';
      title: string;
      metric: string;
      description: string;
      operatorId?: string;
    }> = [];

    if (topSeller && topSeller.salesCount > 0) {
      insights.push({
        id: 'top-leader',
        kind: 'leader',
        title: `Liderança do Período · ${topSeller.name}`,
        metric: `R$ ${topSeller.netRevenue.toFixed(2)} líquidos (${topSeller.sharePct}% da loja)`,
        description: `Lidera o ranking com ${topSeller.salesCount} vendas, ${topSeller.piecesCount} peças e ${topSeller.dailyWinsCount} ${topSeller.dailyWinsCount === 1 ? 'dia em 1º lugar' : 'dias em 1º lugar'}.`,
        operatorId: topSeller.operatorId,
      });
    }

    const bestPaSeller = [...sellers]
      .filter((s) => s.salesCount >= 1)
      .sort((a, b) => b.pa - a.pa)[0];
    if (bestPaSeller) {
      insights.push({
        id: 'best-pa',
        kind: 'pa',
        title: `Especialista em Venda Casada (PA) · ${bestPaSeller.name}`,
        metric: `${bestPaSeller.pa.toFixed(2)} peças/venda (${bestPaSeller.multiItemRatePct}% combos)`,
        description: `Coloca mais peças por sacola e eleva o giro de grade com ticket médio de R$ ${bestPaSeller.avgTicket.toFixed(2)}.`,
        operatorId: bestPaSeller.operatorId,
      });
    }

    const highDiscountSeller = [...sellers]
      .filter((s) => s.discountTotal > 0)
      .sort((a, b) => b.discountRatePct - a.discountRatePct)[0];
    if (highDiscountSeller) {
      const isAlert =
        highDiscountSeller.discountRatePct > goalsConfig.maxHealthyDiscountPct;
      insights.push({
        id: 'discount-watch',
        kind: 'discount',
        title: isAlert
          ? `Alerta de Desconto Elevado · ${highDiscountSeller.name}`
          : `Maior Índice de Desconto · ${highDiscountSeller.name}`,
        metric: `${highDiscountSeller.discountRatePct}% de desconto (R$ ${highDiscountSeller.discountTotal.toFixed(2)})`,
        description: `Aplicou desconto em ${highDiscountSeller.discountedSalesCount} de ${highDiscountSeller.salesCount} vendas (${highDiscountSeller.discountedSalesRatePct}% dos atendimentos).`,
        operatorId: highDiscountSeller.operatorId,
      });
    }

    const highReturnSeller = [...sellers]
      .filter((s) => s.returnsAmount > 0)
      .sort((a, b) => b.returnRatePct - a.returnRatePct)[0];
    if (highReturnSeller) {
      const topReason =
        highReturnSeller.returnReasons[0]?.reason || 'Troca de tamanho/cor';
      insights.push({
        id: 'return-watch',
        kind: 'return',
        title: `Taxa de Trocas por Vendedor · ${highReturnSeller.name}`,
        metric: `${highReturnSeller.returnRatePct}% trocado (R$ ${highReturnSeller.returnsAmount.toFixed(2)})`,
        description: `${highReturnSeller.returnedPieces} ${highReturnSeller.returnedPieces === 1 ? 'peça retornou' : 'peças retornaram'} em ${highReturnSeller.returnsCount} ${highReturnSeller.returnsCount === 1 ? 'troca' : 'trocas'}. Principal motivo: "${topReason}".`,
        operatorId: highReturnSeller.operatorId,
      });
    }

    if (bestStoreDay) {
      insights.push({
        id: 'best-day',
        kind: 'calendar',
        title: `Recorde Diário · ${bestStoreDay.date.split('-').reverse().join('/')} (${bestStoreDay.weekdayLabel})`,
        metric: `R$ ${bestStoreDay.revenue.toFixed(2)} em ${bestStoreDay.salesCount} vendas`,
        description: bestStoreDay.champion
          ? `O destaque do dia foi ${bestStoreDay.champion.name} com R$ ${bestStoreDay.champion.revenue.toFixed(2)} (${bestStoreDay.champion.shareOfDayPct}% do dia).`
          : `${bestStoreDay.piecesCount} peças vendidas no dia mais forte do período.`,
        operatorId: bestStoreDay.champion?.operatorId,
      });
    }

    return {
      startDate,
      endDate,
      summary: {
        grossRevenue: storeGrossRevenue,
        returnsTotal: storeReturnsTotal,
        returnsCount: returns.length,
        returnedPieces: sellers.reduce((n, s) => n + s.returnedPieces, 0),
        netRevenue: storeNetRevenue,
        totalDiscounts: storeDiscountsTotal,
        discountRatePct: storeDiscountRatePct,
        discountedSalesCount: storeDiscountedSalesCount,
        returnRatePct: storeReturnRatePct,
        totalSales: storeTotalSales,
        totalPieces: storeTotalPieces,
        pa: storePa,
        multiItemRatePct: storeMultiItemRatePct,
        avgTicket: storeAvgTicket,
        identifiedCustomerRatePct: storeIdentifiedRatePct,
        estimatedGrossMargin: storeEstimatedMargin,
        marginRatePct: storeMarginRatePct,
        activeSellersCount: sellers.filter((s) => s.salesCount > 0).length,
        totalSellersCount: sellers.length,
        activeDaysCount: storeActiveDaysCount,
        storeGoal: goalsConfig.storeMonthlyGoal,
        storeGoalProgressPct,
        totalEstimatedCommission,
        bestDay: bestStoreDay
          ? {
              date: bestStoreDay.date,
              weekdayLabel: bestStoreDay.weekdayLabel,
              revenue: bestStoreDay.revenue,
              netRevenue: bestStoreDay.netRevenue,
              salesCount: bestStoreDay.salesCount,
              piecesCount: bestStoreDay.piecesCount,
              championName: bestStoreDay.champion?.name || null,
              championRevenue: bestStoreDay.champion?.revenue || 0,
            }
          : null,
        topSeller: topSeller
          ? {
              operatorId: topSeller.operatorId,
              name: topSeller.name,
              imageUrl: topSeller.imageUrl,
              netRevenue: topSeller.netRevenue,
              grossRevenue: topSeller.grossRevenue,
              salesCount: topSeller.salesCount,
              piecesCount: topSeller.piecesCount,
              dailyWinsCount: topSeller.dailyWinsCount,
            }
          : null,
      },
      goalsConfig,
      sellers,
      calendar: {
        days: calendarDays,
      },
      insights,
    };
  }
}
