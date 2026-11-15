import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { computeDataVersion } from '../cash-registers/cash-registers-data-version';
import { DEMO_OPERATOR_AVATARS, DEMO_OPERATOR_PIN } from './demo-store.seed';

export type HistoryScaleProfile = 'compact' | 'medium' | 'busy';

export interface PopulateTenantHistoryOptions {
  months?: number;
  profile?: HistoryScaleProfile;
  cleanExistingMovements?: boolean;
  complementTeam?: boolean;
  seed?: number;
  now?: Date;
  tenantName?: string;
}

export interface PopulateTenantHistoryResult {
  monthsCovered: number;
  daysSpan: number;
  businessDaysOpen: number;
  profile: HistoryScaleProfile;
  cleanedPreviousMovements: boolean;
  preservedFiscalSales: number;
  catalogPreserved: {
    activeProducts: number;
    retailGroups: number;
    categories: number;
    storefrontPublished: boolean;
  };
  team: {
    totalActiveOperators: number;
    createdOperators: Array<{
      id: string;
      name: string;
      jobTitle: string | null;
      imageUrl: string;
    }>;
    allOperatorsWithAvatars: Array<{
      id: string;
      name: string;
      imageUrl?: string | null;
    }>;
  };
  generated: {
    salesCompleted: number;
    salesCancelled: number;
    saleItems: number;
    grossRevenue: number;
    netRevenue: number;
    averageTicket: number;
    averageMonthlyRevenue: number;
    cashRegistersClosed: number;
    openRegisterCode: number | null;
    cashMovements: number;
    customersTotal: number;
    suppliersTotal: number;
    purchaseOrders: number;
    stockLots: number;
    payablesTotal: number;
    payablesPaid: number;
    payablesPending: number;
    crediarioInstallments: number;
    crediarioPaid: number;
    crediarioOpen: number;
    returnsCount: number;
    activeStoreCredits: number;
    storefrontOrdersTotal: number;
    storefrontOrdersActiveQueue: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  durationMs: number;
}

const PROFILE_TARGETS: Record<
  HistoryScaleProfile,
  {
    targetMonthlyRevenue: number;
    minMonthlySales: number;
    maxMonthlySales: number;
    storeMonthlyGoal: number;
    defaultSellerGoal: number;
  }
> = {
  compact: {
    targetMonthlyRevenue: 24500,
    minMonthlySales: 85,
    maxMonthlySales: 130,
    storeMonthlyGoal: 24000,
    defaultSellerGoal: 7500,
  },
  medium: {
    targetMonthlyRevenue: 48500,
    minMonthlySales: 155,
    maxMonthlySales: 225,
    storeMonthlyGoal: 45000,
    defaultSellerGoal: 12500,
  },
  busy: {
    targetMonthlyRevenue: 88000,
    minMonthlySales: 265,
    maxMonthlySales: 380,
    storeMonthlyGoal: 82000,
    defaultSellerGoal: 22000,
  },
};

const MONTH_SEASONALITY: Record<number, number> = {
  1: 0.83, // Janeiro — pós-festas / liquidação
  2: 0.86, // Fevereiro — carnaval / retorno
  3: 0.94, // Março
  4: 0.97, // Abril
  5: 1.18, // Maio — Dia das Mães
  6: 1.13, // Junho — Dia dos Namorados / inverno
  7: 0.98, // Julho — férias
  8: 1.10, // Agosto — Dia dos Pais
  9: 0.96, // Setembro
  10: 1.06, // Outubro — Dia das Crianças / primavera
  11: 1.26, // Novembro — Black Friday
  12: 1.44, // Dezembro — Natal & Ano Novo
};

const WEEKDAY_FACTORS: Record<number, number> = {
  0: 0.52, // Domingo (quando abre em datas sazonais)
  1: 0.78, // Segunda
  2: 0.86, // Terça
  3: 0.95, // Quarta
  4: 1.05, // Quinta
  5: 1.28, // Sexta
  6: 1.54, // Sábado
};

const EXTRA_TEAM_PERSONAS = [
  {
    name: 'Mariana Consultora',
    jobTitle: 'Consultora Sênior',
    avatar: DEMO_OPERATOR_AVATARS.mariana,
  },
  {
    name: 'Beatriz Vendas',
    jobTitle: 'Consultora de Estilo',
    avatar: DEMO_OPERATOR_AVATARS.beatriz,
  },
  {
    name: 'Lucas Atendimento',
    jobTitle: 'Caixa & Atendimento',
    avatar: DEMO_OPERATOR_AVATARS.cashier,
  },
  {
    name: 'Gabriel Comercial',
    jobTitle: 'Consultor Comercial',
    avatar: DEMO_OPERATOR_AVATARS.manager,
  },
];

const SUPPLIER_TEMPLATES = [
  {
    name: 'Matriz Têxtil & Confecções Atacado LTDA',
    cnpjCpf: '41238910000154',
    whatsapp: '11988112201',
    email: 'pedidos@matriztextil.com.br',
    bairro: 'Brás',
    municipio: 'São Paulo',
    uf: 'SP',
  },
  {
    name: 'Distribuidora Prime Varejo & Grade S.A.',
    cnpjCpf: '52891430000182',
    whatsapp: '11988112202',
    email: 'comercial@distribuidoraprime.com.br',
    bairro: 'Bom Retiro',
    municipio: 'São Paulo',
    uf: 'SP',
  },
  {
    name: 'Importadora Urbana Acessórios & Linha Geral LTDA',
    cnpjCpf: '63910274000119',
    whatsapp: '11988112203',
    email: 'atacado@importadoraurbana.com.br',
    bairro: 'Centro',
    municipio: 'São Paulo',
    uf: 'SP',
  },
];

const CUSTOMER_FIRST_NAMES = [
  'Fernanda', 'Rafael', 'Camila', 'Bruno', 'Juliana', 'Thiago', 'Larissa', 'Diego',
  'Patrícia', ' Rodrigo', 'Aline', 'Gustavo', 'Carolina', 'Marcelo', 'Letícia', 'Felipe',
  'Amanda', 'Leonardo', 'Bianca', 'Eduardo', 'Vanessa', 'Matheus', 'Renata', 'André',
  'Natália', 'Vinícius', 'Priscila', 'Daniel', 'Tatiane', 'Caio', 'Gabriela', 'Henrique',
  'Isabela', 'Lucas', 'Débora', 'Ricardo', 'Helena', 'Murilo', 'Sabrina', 'Alexandre',
  'Mônica', 'Otávio', 'Paula', 'Samuel', 'Vitória', 'Fábio', 'Cláudia', 'Igor',
];

const CUSTOMER_LAST_NAMES = [
  'Oliveira', 'Mendes', 'Santos', 'Costa', 'Ferreira', 'Almeida', 'Rodrigues', 'Pereira',
  'Lima', 'Gomes', 'Ribeiro', 'Martins', 'Carvalho', 'Araújo', 'Nogueira', 'Barbosa',
  'Cardoso', 'Teixeira', 'Moreira', 'Monteiro', 'Vieira', 'Rocha', 'Freitas', 'Campos',
];

const NEIGHBORHOODS = [
  'Centro', 'Jardins', 'Bela Vista', 'Pinheiros', 'Moema', 'Vila Mariana',
  'Perdizes', 'Tatuapé', 'Santana', 'Itaim Bibi', 'Consolação', 'Brooklin',
];

const RETURN_REASONS = [
  'Troca de numeração — cliente optou por vale-troca para nova peça',
  'Troca de cor — preferência por outra variação da coleção',
  'Presente repetido — convertido em crédito na loja',
  'Ajuste de caimento — cliente deixou saldo para próxima compra',
];

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function round4(n: number): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function toSaoPauloParts(date: Date): {
  isoDay: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const rawHour = Number(get('hour'));
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(get('minute'));
  return {
    isoDay: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    year,
    month,
    day,
    hour,
    minute,
  };
}

function addDaysIso(dayIso: string, deltaDays: number): string {
  const d = new Date(`${dayIso}T12:00:00Z`);
  return new Date(d.getTime() + deltaDays * 86400000).toISOString().slice(0, 10);
}

function makeSpDate(dayIso: string, hour: number, minute: number, second = 0): Date {
  const hh = String(clamp(Math.floor(hour), 0, 23)).padStart(2, '0');
  const mm = String(clamp(Math.floor(minute), 0, 59)).padStart(2, '0');
  const ss = String(clamp(Math.floor(second), 0, 59)).padStart(2, '0');
  return new Date(`${dayIso}T${hh}:${mm}:${ss}-03:00`);
}

function buildValidCpf(index: number): string {
  const base = String(128450900 + ((index * 7919) % 700000000))
    .padStart(9, '0')
    .slice(0, 9)
    .split('')
    .map(Number);
  if (base.every((d) => d === base[0])) base[8] = (base[8] + 1) % 10;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) sum1 += base[i] * (10 - i);
  const rem1 = (sum1 * 10) % 11;
  const d1 = rem1 >= 10 ? 0 : rem1;

  let sum2 = 0;
  for (let i = 0; i < 9; i++) sum2 += base[i] * (11 - i);
  sum2 += d1 * 2;
  const rem2 = (sum2 * 10) % 11;
  const d2 = rem2 >= 10 ? 0 : rem2;

  return `${base.join('')}${d1}${d2}`;
}

async function insertManyChunked<T>(
  delegate: { createMany?: (args: { data: T[]; skipDuplicates?: boolean }) => Promise<any> } | undefined,
  rows: T[],
  chunkSize = 500,
  skipDuplicates = false,
): Promise<void> {
  if (!delegate?.createMany || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    await delegate.createMany({
      data: slice,
      ...(skipDuplicates ? { skipDuplicates: true } : {}),
    });
  }
}

function pickWeighted<T>(items: T[], weights: number[], rng: () => number): T {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export async function populateTenantOperationalHistory(
  client: PrismaClient,
  options: PopulateTenantHistoryOptions = {},
): Promise<PopulateTenantHistoryResult> {
  const startedAt = Date.now();
  const months = clamp(Math.round(Number(options.months) || 12), 1, 24);
  const profile: HistoryScaleProfile =
    options.profile === 'compact' || options.profile === 'busy' ? options.profile : 'medium';
  const cleanExistingMovements = options.cleanExistingMovements !== false;
  const complementTeam = options.complementTeam !== false;
  const now = options.now ? new Date(options.now) : new Date();
  const rng = createMulberry32(
    options.seed ?? hashSeed(`${options.tenantName || 'tenant'}:${months}:${profile}`),
  );

  // 1. Descobrir tabelas existentes para compatibilidade defensiva entre versões de schema
  let existingTables: Set<string> | null = null;
  if (typeof (client as any).$queryRaw === 'function') {
    try {
      const rows = await client.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;
      if (Array.isArray(rows) && rows.length > 0) {
        existingTables = new Set(rows.map((r) => String(r.tablename)));
      }
    } catch {
      existingTables = null;
    }
  }
  const hasTable = (tableName: string, delegate?: any): boolean => {
    if (!delegate) return false;
    if (!existingTables) return true;
    return existingTables.has(tableName);
  };

  // 2. Carregar catálogo existente (100% preservado)
  const [activeProducts, retailGroupsCount, categoriesCount, storefrontSettings, storefrontProducts] =
    await Promise.all([
      client.product.findMany({
        where: { active: true },
        include: {
          retailGroup: {
            select: {
              id: true,
              name: true,
              priceSell: true,
              priceCost: true,
              imageUrl: true,
              ncm: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      hasTable('retail_groups', (client as any).retailGroup)
        ? client.retailGroup.count({ where: { active: true } }).catch(() => 0)
        : Promise.resolve(0),
      client.category.count().catch(() => 0),
      hasTable('storefront_settings', (client as any).storefrontSettings)
        ? client.storefrontSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null)
        : Promise.resolve(null),
      hasTable('storefront_products', (client as any).storefrontProduct)
        ? client.storefrontProduct
            .findMany({
              where: { visible: true },
              select: { retailGroupId: true, commercialTitle: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

  if (!activeProducts.length) {
    throw new BadRequestException(
      'Esta loja ainda não possui produtos ativos cadastrados. Cadastre as mercadorias primeiro para simular os 12 meses usando o catálogo real.',
    );
  }

  // Normalizar leitura de preço e custo sem alterar preços do catálogo
  const catalogItems = activeProducts
    .map((p) => {
      const groupPriceSell = Number(p.retailGroup?.priceSell || 0);
      const rawSell = Number(p.priceSell || 0) > 0 ? Number(p.priceSell) : groupPriceSell;
      const sell = round2(rawSell > 0 ? rawSell : 79.9);
      const groupCost = Number(p.retailGroup?.priceCost || 0);
      const rawCost = Number(p.priceCost || 0) > 0 ? Number(p.priceCost) : groupCost;
      const cost = round4(rawCost > 0 && rawCost < sell ? rawCost : sell * 0.46);
      return {
        id: p.id,
        retailGroupId: p.retailGroupId || null,
        name: p.name,
        unit: p.unit || 'UN',
        size: p.size || null,
        color: p.color || null,
        barcode: p.barcode || null,
        shortCode: p.shortCode || null,
        imageUrl: p.retailGroup?.imageUrl || p.imageUrl || null,
        priceSell: sell,
        priceCost: cost,
        ncm: p.ncm || p.retailGroup?.ncm || '61091000',
      };
    })
    .filter((p) => p.priceSell > 0);

  // Pesos Pareto (Curva ABC realista entre grupos e tamanhos centrais)
  const groupWeights = new Map<string, number>();
  const uniqueGroupKeys = Array.from(
    new Set(catalogItems.map((item) => item.retailGroupId || item.id)),
  );
  uniqueGroupKeys.forEach((gKey, idx) => {
    const ratio = uniqueGroupKeys.length > 1 ? idx / (uniqueGroupKeys.length - 1) : 0;
    // Curva A (~25% iniciais): peso alto; Curva B (~45%): peso médio; Curva C (~30%): cauda longa
    const baseWeight =
      ratio < 0.25 ? 4.2 - ratio * 4 : ratio < 0.7 ? 2.1 - (ratio - 0.25) * 1.8 : 0.9 - (ratio - 0.7) * 0.5;
    groupWeights.set(gKey, Math.max(0.35, baseWeight * (0.85 + rng() * 0.35)));
  });

  const productWeights = catalogItems.map((item) => {
    const gWeight = groupWeights.get(item.retailGroupId || item.id) || 1;
    const sizeUpper = (item.size || '').toUpperCase().trim();
    const sizeBoost =
      sizeUpper === 'M' || sizeUpper === 'G' || sizeUpper === '39' || sizeUpper === '40' || sizeUpper === '41'
        ? 1.35
        : sizeUpper === 'P' || sizeUpper === '38' || sizeUpper === '42' || sizeUpper === 'U' || sizeUpper === 'UNICO'
          ? 1.12
          : 0.78;
    return gWeight * sizeBoost;
  });

  const visibleStorefrontGroupIds = new Set(storefrontProducts.map((sp) => sp.retailGroupId));
  const storefrontEligibleItems = catalogItems.filter(
    (item) => item.retailGroupId && visibleStorefrontGroupIds.has(item.retailGroupId),
  );
  const onlinePool = storefrontEligibleItems.length >= 3 ? storefrontEligibleItems : catalogItems;
  const onlineWeights = onlinePool.map((item) => {
    const idx = catalogItems.findIndex((c) => c.id === item.id);
    return idx >= 0 ? productWeights[idx] : 1;
  });

  // 3. Limpeza segura de movimentações de teste (preservando 100% de notas fiscais autorizadas!)
  let preservedFiscalSales = 0;
  let startingSaleCode = 1;
  let startingRegisterCode = 1;
  let startingStorefrontOrderCode = 1;

  if (cleanExistingMovements) {
    const fiscalSales = await client.sale
      .findMany({
        where: {
          OR: [
            { nfceStatus: { in: ['autorizada', 'AUTORIZADA'] } },
            { nfceXml: { not: null } },
          ],
        },
        select: { id: true, code: true, cashRegisterId: true },
      })
      .catch(() => []);

    preservedFiscalSales = fiscalSales.length;
    const fiscalSaleIds = fiscalSales.map((s) => s.id);
    const fiscalRegisterIds = Array.from(
      new Set(fiscalSales.map((s) => s.cashRegisterId).filter(Boolean) as string[]),
    );

    const nonFiscalSaleFilter =
      fiscalSaleIds.length > 0 ? { id: { notIn: fiscalSaleIds } } : {};
    const nonFiscalSaleRefFilter =
      fiscalSaleIds.length > 0 ? { saleId: { notIn: fiscalSaleIds } } : {};
    const nonFiscalRegisterFilter =
      fiscalRegisterIds.length > 0 ? { id: { notIn: fiscalRegisterIds } } : {};
    const nonFiscalRegisterRefFilter =
      fiscalRegisterIds.length > 0 ? { cashRegisterId: { notIn: fiscalRegisterIds } } : {};

    if (hasTable('storefront_order_events', (client as any).storefrontOrderEvent)) {
      await client.storefrontOrderEvent.deleteMany({});
    }
    if (hasTable('stock_reservations', (client as any).stockReservation)) {
      await client.stockReservation.deleteMany({});
    }
    if (hasTable('storefront_order_items', (client as any).storefrontOrderItem)) {
      await client.storefrontOrderItem.deleteMany({});
    }
    if (hasTable('storefront_orders', (client as any).storefrontOrder)) {
      await client.storefrontOrder.deleteMany({});
    }

    if (hasTable('crediario_notification_logs', (client as any).crediarioNotificationLog)) {
      await client.crediarioNotificationLog.deleteMany({});
    }
    if (hasTable('customer_receivable_payments', (client as any).customerReceivablePayment)) {
      await client.customerReceivablePayment.deleteMany({});
    }
    if (hasTable('customer_receivables', (client as any).customerReceivable)) {
      await client.customerReceivable.deleteMany({});
    }

    if (hasTable('store_credit_uses', (client as any).storeCreditUse)) {
      await client.storeCreditUse.deleteMany({});
    }
    if (hasTable('store_credits', (client as any).storeCredit)) {
      await client.storeCredit.deleteMany({});
    }
    if (hasTable('retail_return_items', (client as any).retailReturnItem)) {
      await client.retailReturnItem.deleteMany({});
    }
    if (hasTable('retail_returns', (client as any).retailReturn)) {
      await client.retailReturn.deleteMany({});
    }

    if (hasTable('stock_lot_consumptions', (client as any).stockLotConsumption)) {
      if (fiscalSaleIds.length > 0) {
        await client.stockLotConsumption.deleteMany({
          where: { saleItem: { saleId: { notIn: fiscalSaleIds } } },
        });
      } else {
        await client.stockLotConsumption.deleteMany({});
      }
    }
    if (hasTable('sale_item_modifiers', (client as any).saleItemModifier)) {
      if (fiscalSaleIds.length > 0) {
        await client.saleItemModifier.deleteMany({
          where: { saleItem: { saleId: { notIn: fiscalSaleIds } } },
        });
      } else {
        await client.saleItemModifier.deleteMany({});
      }
    }
    if (hasTable('sale_delivery_jobs', (client as any).saleDeliveryJob)) {
      await client.saleDeliveryJob.deleteMany({ where: nonFiscalSaleRefFilter });
    }
    if (hasTable('operator_consumptions', (client as any).operatorConsumption)) {
      await client.operatorConsumption.deleteMany({ where: nonFiscalSaleRefFilter });
    }
    if (hasTable('comandas', (client as any).comanda)) {
      await client.comanda
        .updateMany({
          where: nonFiscalSaleRefFilter,
          data: { saleId: null },
        })
        .catch(() => {});
    }

    await client.payment.deleteMany({ where: nonFiscalSaleRefFilter });
    await client.saleItem.deleteMany({ where: nonFiscalSaleRefFilter });
    await client.sale.deleteMany({ where: nonFiscalSaleFilter });

    if (
      hasTable(
        'cash_register_conference_revisions',
        (client as any).cashRegisterConferenceRevision,
      )
    ) {
      await client.cashRegisterConferenceRevision.deleteMany({
        where: nonFiscalRegisterRefFilter,
      });
    }
    await client.cashMovement.deleteMany({ where: nonFiscalRegisterRefFilter });
    await client.cashRegister.deleteMany({ where: nonFiscalRegisterFilter });

    await client.inventoryLog.deleteMany({
      where: {
        OR: [{ origin: null }, { origin: { notIn: ['IMPORT_XML', 'IMPORT_DFE'] } }],
      },
    });
    if (hasTable('stock_lots', (client as any).stockLot)) {
      if (fiscalSaleIds.length > 0) {
        await client.stockLot.deleteMany({
          where: { consumptions: { none: {} } },
        });
      } else {
        await client.stockLot.deleteMany({});
      }
    }
    if (hasTable('purchase_order_items', (client as any).purchaseOrderItem)) {
      await client.purchaseOrderItem.deleteMany({});
    }
    if (hasTable('purchase_orders', (client as any).purchaseOrder)) {
      await client.purchaseOrder.deleteMany({});
    }
    if (hasTable('payables', (client as any).payable)) {
      await client.payable.deleteMany({});
    }
  }

  // Calcular próximos códigos sequenciais livres caso existam registros preservados
  const [maxSaleRow, maxRegRow, maxOrderRow] = await Promise.all([
    client.sale
      .findFirst({ where: { code: { not: null } }, orderBy: { code: 'desc' }, select: { code: true } })
      .catch(() => null),
    client.cashRegister
      .findFirst({ where: { code: { not: null } }, orderBy: { code: 'desc' }, select: { code: true } })
      .catch(() => null),
    hasTable('storefront_orders', (client as any).storefrontOrder)
      ? client.storefrontOrder
          .findFirst({ orderBy: { code: 'desc' }, select: { code: true } })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  startingSaleCode = (maxSaleRow?.code || 0) + 1;
  startingRegisterCode = (maxRegRow?.code || 0) + 1;
  startingStorefrontOrderCode = (maxOrderRow?.code || 0) + 1;

  // 4. Equipe de vendas (preserva operadores reais e completa se houver < 4)
  const existingOperators = await client.operator.findMany({
    where: { active: true },
    orderBy: [{ isManager: 'desc' }, { createdAt: 'asc' }],
  });

  const createdOperators: Array<{
    id: string;
    name: string;
    jobTitle: string | null;
    imageUrl: string;
  }> = [];

  const activeTeam: Array<{
    id: string;
    name: string;
    jobTitle: string | null;
    isManager: boolean;
    imageUrl?: string | null;
  }> = existingOperators.map((op, i) => ({
    id: op.id,
    name: op.name,
    jobTitle: op.jobTitle,
    isManager: Boolean(op.isManager),
    imageUrl: Object.values(DEMO_OPERATOR_AVATARS)[i % 4],
  }));

  if (complementTeam && activeTeam.length < 4) {
    const defaultPinHash = await bcrypt.hash(DEMO_OPERATOR_PIN, 10);
    const usedFirstNames = new Set(
      activeTeam.map((op) => op.name.trim().split(/\s+/)[0].toLowerCase()),
    );

    for (const persona of EXTRA_TEAM_PERSONAS) {
      if (activeTeam.length >= 4) break;
      const firstName = persona.name.split(/\s+/)[0].toLowerCase();
      if (usedFirstNames.has(firstName)) continue;

      const created = await client.operator.create({
        data: {
          name: persona.name,
          pin: defaultPinHash,
          jobTitle: persona.jobTitle,
          active: true,
          isManager: activeTeam.length === 0,
        },
      });
      usedFirstNames.add(firstName);
      createdOperators.push({
        id: created.id,
        name: created.name,
        jobTitle: created.jobTitle,
        imageUrl: persona.avatar,
      });
      activeTeam.push({
        id: created.id,
        name: created.name,
        jobTitle: created.jobTitle,
        isManager: Boolean(created.isManager),
        imageUrl: persona.avatar,
      });
    }
  }

  if (activeTeam.length === 0) {
    const defaultPinHash = await bcrypt.hash(DEMO_OPERATOR_PIN, 10);
    const fallbackOp = await client.operator.create({
      data: {
        name: 'Gerente Comercial',
        pin: defaultPinHash,
        jobTitle: 'Gerente de Loja',
        active: true,
        isManager: true,
      },
    });
    activeTeam.push({
      id: fallbackOp.id,
      name: fallbackOp.name,
      jobTitle: fallbackOp.jobTitle,
      isManager: true,
      imageUrl: DEMO_OPERATOR_AVATARS.manager,
    });
  }

  // Pesos de vendas por vendedor para pódio bem definido (ex: 36%, 29%, 21%, 14%)
  const rankedTeam = [
    ...activeTeam.filter((op) => !op.isManager),
    ...activeTeam.filter((op) => op.isManager),
  ];
  const sellerWeights = rankedTeam.map((_, idx) => {
    const base = [0.36, 0.29, 0.21, 0.14, 0.10][idx] ?? 0.08;
    return base;
  });
  const managerOp = activeTeam.find((op) => op.isManager) || activeTeam[0];

  // Configurar metas da Inteligência Comercial caso ainda não personalizadas
  const profileCfg = PROFILE_TARGETS[profile];
  if (hasTable('tenant_settings', (client as any).tenantSettings)) {
    const currentSettings = await client.tenantSettings
      .findUnique({ where: { id: 'singleton' } })
      .catch(() => null);
    const paymentCfg =
      currentSettings?.paymentMethodsConfig &&
      typeof currentSettings.paymentMethodsConfig === 'object'
        ? (currentSettings.paymentMethodsConfig as Record<string, any>)
        : {};
    if (!paymentCfg._commercialIntelligenceConfig) {
      await client.tenantSettings
        .upsert({
          where: { id: 'singleton' },
          update: {
            paymentMethodsConfig: {
              ...paymentCfg,
              _commercialIntelligenceConfig: {
                storeMonthlyGoal: profileCfg.storeMonthlyGoal,
                defaultSellerGoal: profileCfg.defaultSellerGoal,
                defaultCommissionPct: 3.0,
                commissionBasis: 'net',
                maxHealthyDiscountPct: 8.0,
                maxHealthyReturnPct: 10.0,
                sellerOverrides: {},
              },
            } as any,
          },
          create: {
            id: 'singleton',
            paymentMethodsConfig: {
              _commercialIntelligenceConfig: {
                storeMonthlyGoal: profileCfg.storeMonthlyGoal,
                defaultSellerGoal: profileCfg.defaultSellerGoal,
                defaultCommissionPct: 3.0,
                commissionBasis: 'net',
                maxHealthyDiscountPct: 8.0,
                maxHealthyReturnPct: 10.0,
                sellerOverrides: {},
              },
            } as any,
          },
        })
        .catch(() => {});
    }
  }

  // 5. Garantir fornecedores e carteira recorrente de clientes (preservando os já existentes)
  const spNow = toSaoPauloParts(now);
  const todayIso = spNow.isoDay;
  const daysSpan = Math.max(30, Math.round(months * 30.4167));
  const startDayIso = addDaysIso(todayIso, -(daysSpan - 1));
  const startCreatedAt = makeSpDate(startDayIso, 8, 30, 0);

  let suppliers: Array<{ id: string; name: string }> = [];
  if (hasTable('suppliers', (client as any).supplier)) {
    const existingSuppliers = await client.supplier.findMany({
      select: { id: true, name: true, cnpjCpf: true },
      orderBy: { createdAt: 'asc' },
    });
    suppliers = existingSuppliers.map((s) => ({ id: s.id, name: s.name }));

    for (const tpl of SUPPLIER_TEMPLATES) {
      if (suppliers.length >= 3) break;
      const already = existingSuppliers.find(
        (s) => s.cnpjCpf === tpl.cnpjCpf || s.name.toLowerCase() === tpl.name.toLowerCase(),
      );
      if (already) continue;
      const created = await client.supplier.create({
        data: {
          ...tpl,
          createdAt: startCreatedAt,
        },
      });
      suppliers.push({ id: created.id, name: created.name });
    }

    if (hasTable('supplier_products', (client as any).supplierProduct) && suppliers.length > 0) {
      const supplierProductRows = catalogItems.map((item, idx) => ({
        id: randomUUID(),
        supplierId: suppliers[idx % suppliers.length].id,
        productId: item.id,
        cProdFornecedor: item.shortCode || `REF-${1000 + idx}`,
        expectedCost: item.priceCost,
      }));
      await insertManyChunked(
        (client as any).supplierProduct,
        supplierProductRows,
        500,
        true,
      );
    }
  }

  const existingCustomers = await client.customer.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      cpfCnpj: true,
      creditLimit: true,
      preferredDueDay: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const existingPhones = new Set(existingCustomers.map((c) => c.phone));
  const targetCustomerCount = 46;
  const newCustomerRows: any[] = [];
  let customerSeq = 0;

  while (existingCustomers.length + newCustomerRows.length < targetCustomerCount && customerSeq < 120) {
    const idx = customerSeq++;
    const phone = `1197${String(4100000 + idx * 137).slice(0, 7)}`;
    if (existingPhones.has(phone)) continue;
    existingPhones.add(phone);

    const first = CUSTOMER_FIRST_NAMES[idx % CUSTOMER_FIRST_NAMES.length].trim();
    const last =
      CUSTOMER_LAST_NAMES[
        (idx * 5 + Math.floor(idx / CUSTOMER_FIRST_NAMES.length)) % CUSTOMER_LAST_NAMES.length
      ];
    const neighborhood = NEIGHBORHOODS[idx % NEIGHBORHOODS.length];
    const createdDay = addDaysIso(startDayIso, Math.min(daysSpan - 10, Math.floor(idx * 4.5)));

    newCustomerRows.push({
      id: randomUUID(),
      name: `${first} ${last}`,
      phone,
      cpfCnpj: buildValidCpf(idx + 1),
      address: `Rua Comercial, ${110 + idx * 17} · ${neighborhood}`,
      creditLimit: [600, 800, 1000, 1200, 1500][idx % 5],
      creditBlocked: false,
      preferredDueDay: [5, 10, 15, 20][idx % 4],
      whatsappOptIn: true,
      createdAt: makeSpDate(createdDay, 10, 15, 0),
      updatedAt: makeSpDate(createdDay, 10, 15, 0),
    });
  }

  await insertManyChunked(client.customer as any, newCustomerRows, 500, true);

  const allCustomers: Array<{
    id: string;
    name: string;
    phone: string;
    cpfCnpj: string | null;
    creditLimit: number;
    preferredDueDay: number;
  }> = [
    ...existingCustomers.map((c, idx) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      cpfCnpj: c.cpfCnpj || null,
      creditLimit: Number(c.creditLimit || 0) > 0 ? Number(c.creditLimit) : 800,
      preferredDueDay: c.preferredDueDay || [5, 10, 15, 20][idx % 4],
    })),
    ...newCustomerRows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      cpfCnpj: c.cpfCnpj,
      creditLimit: Number(c.creditLimit),
      preferredDueDay: c.preferredDueDay,
    })),
  ];

  // Pesos de fidelidade para clientes recorrentes
  const customerWeights = allCustomers.map((_, idx) =>
    idx < 12 ? 2.8 : idx < 28 ? 1.5 : 0.75,
  );

  // Garantir configurações padrão de Crediário se a tabela existir
  const hasCrediario = hasTable('customer_receivables', (client as any).customerReceivable);
  if (hasCrediario && hasTable('crediario_settings', (client as any).crediarioSettings)) {
    await client.crediarioSettings
      .upsert({
        where: { id: 'singleton' },
        update: {},
        create: {
          id: 'singleton',
          enabled: true,
          defaultCreditLimit: 800,
          defaultDueDays: 30,
          maxInstallments: 4,
        },
      })
      .catch(() => {});
  }

  // 6. Calibrar volume diário adaptando ao ticket médio real das mercadorias do tenant
  const sortedPrices = catalogItems.map((p) => p.priceSell).sort((a, b) => a - b);
  const trimStart = Math.floor(sortedPrices.length * 0.1);
  const trimEnd = Math.max(trimStart + 1, Math.ceil(sortedPrices.length * 0.9));
  const trimmedSlice = sortedPrices.slice(trimStart, trimEnd);
  const avgUnitPrice =
    trimmedSlice.reduce((acc, v) => acc + v, 0) / Math.max(1, trimmedSlice.length);

  // Ajustar média de itens por cesta conforme o preço unitário médio
  const avgPiecesTarget = avgUnitPrice < 55 ? 2.45 : avgUnitPrice > 240 ? 1.45 : 1.85;
  const estimatedTicket = clamp(avgUnitPrice * avgPiecesTarget, 55, 1200);
  const targetMonthlySales = clamp(
    Math.round(profileCfg.targetMonthlyRevenue / estimatedTicket),
    profileCfg.minMonthlySales,
    profileCfg.maxMonthlySales,
  );
  // ~26.2 dias abertos por mês em média
  const baseDailySales = targetMonthlySales / 26.2;

  // 7. Simulação dia a dia ao longo dos 12 meses
  const cashRegisterRows: any[] = [];
  const cashMovementRows: any[] = [];
  const conferenceRevisionRows: any[] = [];
  const saleRows: any[] = [];
  const saleItemRows: any[] = [];
  const paymentRows: any[] = [];
  const receivableRows: any[] = [];
  const receivablePaymentRows: any[] = [];
  const returnRows: any[] = [];
  const returnItemRows: any[] = [];
  const storeCreditRows: any[] = [];
  const storeCreditUseRows: any[] = [];
  const storefrontOrderRows: any[] = [];
  const storefrontOrderItemRows: any[] = [];
  const stockReservationRows: any[] = [];
  const storefrontOrderEventRows: any[] = [];

  // Créditos de troca disponíveis por cliente para resgate futuro realista
  const availableCustomerCredits = new Map<
    string,
    Array<{ id: string; balance: number; createdAt: Date }>
  >();

  // Controle de unidades vendidas por produto para gerar compras, lotes FIFO e saldo final exato
  const soldQtyByProduct = new Map<string, number>();
  const restockedReturnQtyByProduct = new Map<string, number>();
  const activeReservedQtyByProduct = new Map<string, number>();
  const saleEventsForInventory: Array<{
    productId: string;
    saleItemId: string;
    quantity: number;
    costPrice: number;
    createdAt: Date;
    origin: string;
    saleCode: number;
  }> = [];

  let nextSaleCode = startingSaleCode;
  let nextRegCode = startingRegisterCode;
  let nextOrderCode = startingStorefrontOrderCode;
  let openRegisterCode: number | null = null;

  const hasStorefrontTable = hasTable('storefront_orders', (client as any).storefrontOrder);

  for (let dayIdx = 0; dayIdx < daysSpan; dayIdx++) {
    const dayIso = addDaysIso(startDayIso, dayIdx);
    const isToday = dayIso === todayIso;
    const noonUtc = new Date(`${dayIso}T12:00:00Z`);
    const weekday = noonUtc.getUTCDay(); // 0=Dom..6=Sáb
    const monthNum = Number(dayIso.slice(5, 7));
    const dayOfMonth = Number(dayIso.slice(8, 10));

    // Domingos: abre em dezembro, semana de Black Friday, véspera de Dia das Mães ou se hoje for domingo
    const isPeakSunday =
      weekday === 0 &&
      (isToday ||
        monthNum === 12 ||
        (monthNum === 11 && dayOfMonth >= 22) ||
        (monthNum === 5 && dayOfMonth >= 5 && dayOfMonth <= 13));

    if (weekday === 0 && !isPeakSunday) {
      continue;
    }

    const progress = daysSpan > 1 ? dayIdx / (daysSpan - 1) : 1;
    const maturityFactor = 0.88 + progress * 0.24; // Crescimento orgânico de ~27% ao longo de 12 meses
    const seasonFactor = MONTH_SEASONALITY[monthNum] || 1.0;
    const weekdayFactor = WEEKDAY_FACTORS[weekday] || 1.0;
    const paydayFactor =
      dayOfMonth >= 5 && dayOfMonth <= 10
        ? 1.13
        : dayOfMonth >= 20 && dayOfMonth <= 25
          ? 1.07
          : 0.97;
    const specialEventBoost =
      monthNum === 11 && dayOfMonth >= 24 && dayOfMonth <= 29
        ? 1.38 // Semana Black Friday
        : monthNum === 12 && dayOfMonth >= 15 && dayOfMonth <= 24
          ? 1.35 // Pico Natal
          : 1.0;

    // Se for hoje, proporcional ao horário atual em São Paulo (mínimo 2 a 5 vendas para o dia já ter movimento)
    let intradayFraction = 1.0;
    let maxMinuteToday = 19 * 60 + 30;
    if (isToday) {
      const nowTotalMin = spNow.hour * 60 + spNow.minute;
      maxMinuteToday = Math.max(9 * 60 + 25, nowTotalMin - 4);
      intradayFraction = clamp((nowTotalMin - 8 * 60) / (11 * 60), 0.28, 0.95);
    }

    const expectedSalesFloat =
      baseDailySales *
      maturityFactor *
      seasonFactor *
      weekdayFactor *
      paydayFactor *
      specialEventBoost *
      intradayFraction *
      (0.84 + rng() * 0.32);

    const dailySalesCount = isToday
      ? Math.max(3, Math.round(expectedSalesFloat))
      : Math.max(2, Math.round(expectedSalesFloat));

    // Abertura de caixa do dia
    const regId = randomUUID();
    const regCode = nextRegCode++;
    const regOperator =
      isToday
        ? managerOp
        : activeTeam[(dayIdx + (weekday === 6 ? 0 : 1)) % activeTeam.length];

    const openMinuteOfDay = isToday
      ? Math.min(8 * 60 + 45, Math.max(60, spNow.hour * 60 + spNow.minute - 95))
      : weekday === 0
        ? 9 * 60 + 50 + Math.floor(rng() * 15)
        : 8 * 60 + 50 + Math.floor(rng() * 18);

    const openingTime = makeSpDate(
      dayIso,
      Math.floor(openMinuteOfDay / 60),
      openMinuteOfDay % 60,
      Math.floor(rng() * 45),
    );
    const openingValue = weekday >= 5 ? 250.0 : 200.0;

    const dayMovementsForHash: Array<{
      id: string;
      type: string;
      value: number;
    }> = [];
    const daySalesForHash: Array<{
      id: string;
      total: number;
      status: string;
      source: string;
      payments: Array<{ id: string; value: number; method: string }>;
    }> = [];

    let cashSalesDayTotal = 0;
    let pixSalesDayTotal = 0;
    let creditSalesDayTotal = 0;
    let debitSalesDayTotal = 0;
    let cashInDay = 0;
    let cashOutDay = 0;

    // Suprimento ocasional de troco pela manhã
    if (isToday || rng() < 0.34) {
      const inVal = isToday ? 50.0 : [50, 80, 100][Math.floor(rng() * 3)];
      const movId = randomUUID();
      const movTime = new Date(openingTime.getTime() + (14 + Math.floor(rng() * 20)) * 60000);
      cashInDay = round2(cashInDay + inVal);
      cashMovementRows.push({
        id: movId,
        cashRegisterId: regId,
        type: 'IN',
        value: inVal,
        reason: 'Reforço de troco em cédulas e moedas',
        createdAt: movTime,
      });
      dayMovementsForHash.push({ id: movId, type: 'IN', value: inVal });
    }

    const windowStartMin = openMinuteOfDay + 12;
    const windowEndMin = isToday
      ? Math.max(windowStartMin + 15, maxMinuteToday)
      : weekday === 0
        ? 16 * 60 + 10
        : 19 * 60 + 25;

    // Gerar horários ordenados das vendas do dia
    const saleMinutes: number[] = [];
    for (let s = 0; s < dailySalesCount; s++) {
      // Duas ondas comerciais naturais (almoço 11h30-14h e tarde 16h-19h)
      const u = rng();
      let pickedMin: number;
      if (!isToday && weekday !== 0 && u < 0.42) {
        pickedMin = 11 * 60 + 15 + Math.floor(rng() * 165);
      } else if (!isToday && weekday !== 0 && u < 0.86) {
        pickedMin = 15 * 60 + 20 + Math.floor(rng() * 235);
      } else {
        pickedMin =
          windowStartMin +
          Math.floor(rng() * Math.max(10, windowEndMin - windowStartMin));
      }
      saleMinutes.push(clamp(pickedMin, windowStartMin, windowEndMin));
    }
    saleMinutes.sort((a, b) => a - b);

    for (let s = 0; s < dailySalesCount; s++) {
      const saleId = randomUUID();
      const saleCode = nextSaleCode++;
      const minuteOfDay = saleMinutes[s];
      const saleDate = makeSpDate(
        dayIso,
        Math.floor(minuteOfDay / 60),
        minuteOfDay % 60,
        5 + Math.floor(rng() * 50),
      );

      const seller = pickWeighted(rankedTeam, sellerWeights, rng);
      const isSellerTop = seller.id === rankedTeam[0]?.id;

      // ~14% das vendas concluídas via Loja Virtual quando tabela existe
      const isCancelled = !isToday && s > 0 && rng() < 0.014;
      const isStorefrontSale =
        !isCancelled && hasStorefrontTable && rng() < 0.14;
      const saleSource = isStorefrontSale ? 'loja_virtual' : 'pdv';

      // Identificação de cliente: obrigatória na Loja Virtual / Crediário, ~56% no balcão
      const wantsCustomer = isStorefrontSale || rng() < 0.56;
      const customer = wantsCustomer
        ? pickWeighted(allCustomers, customerWeights, rng)
        : null;

      // Quantidade de linhas no cupom (1 a 4 produtos distintos)
      const linesRoll = rng() + (isSellerTop ? 0.08 : 0) + (avgPiecesTarget > 2 ? 0.15 : 0);
      const distinctLines =
        linesRoll < 0.52 ? 1 : linesRoll < 0.84 ? 2 : linesRoll < 0.96 ? 3 : 4;

      const chosenPool = isStorefrontSale ? onlinePool : catalogItems;
      const chosenWeights = isStorefrontSale ? onlineWeights : productWeights;
      const usedProductIds = new Set<string>();
      const currentSaleItems: Array<{
        id: string;
        product: (typeof catalogItems)[number];
        qty: number;
        priceUnit: number;
        priceCost: number;
        subtotal: number;
      }> = [];

      for (let l = 0; l < distinctLines; l++) {
        const picked = pickWeighted(chosenPool, chosenWeights, rng);
        if (usedProductIds.has(picked.id)) continue;
        usedProductIds.add(picked.id);

        const qty =
          picked.priceSell < 70 && rng() < 0.28
            ? 2
            : picked.priceSell < 45 && rng() < 0.12
              ? 3
              : 1;
        const lineSub = round2(picked.priceSell * qty);
        currentSaleItems.push({
          id: randomUUID(),
          product: picked,
          qty,
          priceUnit: picked.priceSell,
          priceCost: picked.priceCost,
          subtotal: lineSub,
        });
      }

      if (currentSaleItems.length === 0) {
        const fallback = chosenPool[0];
        currentSaleItems.push({
          id: randomUUID(),
          product: fallback,
          qty: 1,
          priceUnit: fallback.priceSell,
          priceCost: fallback.priceCost,
          subtotal: fallback.priceSell,
        });
      }

      const rawSubtotal = round2(
        currentSaleItems.reduce((acc, it) => acc + it.subtotal, 0),
      );

      // Desconto saudável em ~11% das vendas (5% a 8%, média geral ~0.7% << limite 8%)
      const hasDiscount = !isCancelled && !isStorefrontSale && rawSubtotal >= 90 && rng() < 0.11;
      const discountPct = hasDiscount ? (rng() < 0.65 ? 0.05 : 0.08) : 0;
      const saleDiscount = hasDiscount
        ? Math.min(round2(rawSubtotal * discountPct), round2(rawSubtotal - 10))
        : 0;
      const saleTotal = round2(rawSubtotal - saleDiscount);

      // Montar pagamentos
      const thisSalePayments: Array<{
        id: string;
        saleId: string;
        tPag: string;
        method: string;
        label: string;
        value: number;
        troco: number;
      }> = [];

      let remainingToPay = saleTotal;

      // Verificar se o cliente possui vale-troca anterior disponível para abater (deixa os 4 mais recentes em aberto)
      if (
        !isCancelled &&
        !isStorefrontSale &&
        customer &&
        daysSpan - dayIdx > 18 &&
        availableCustomerCredits.has(customer.id)
      ) {
        const custCredits = availableCustomerCredits.get(customer.id)!;
        const usable = custCredits.find(
          (cr) => cr.balance > 0 && cr.createdAt.getTime() + 86400000 < saleDate.getTime(),
        );
        if (usable && usable.balance < remainingToPay) {
          const usedAmt = round2(usable.balance);
          usable.balance = 0;
          remainingToPay = round2(remainingToPay - usedAmt);

          const creditPayId = randomUUID();
          thisSalePayments.push({
            id: creditPayId,
            saleId,
            tPag: '99',
            method: 'credito_loja',
            label: 'Vale-Troca',
            value: usedAmt,
            troco: 0,
          });
          storeCreditUseRows.push({
            id: randomUUID(),
            creditId: usable.id,
            saleId,
            amount: usedAmt,
            createdAt: saleDate,
          });
        }
      }

      // Escolher forma de pagamento principal para o saldo restante
      const payRoll = rng();
      const canUseCrediario =
        hasCrediario &&
        !isCancelled &&
        !isStorefrontSale &&
        Boolean(customer) &&
        remainingToPay >= 110 &&
        thisSalePayments.length === 0;

      if (canUseCrediario && payRoll < 0.065 && customer) {
        // Venda no Crediário da Loja (2x ou 3x)
        const payId = randomUUID();
        thisSalePayments.push({
          id: payId,
          saleId,
          tPag: '05',
          method: 'crediario',
          label: 'Crediário da Loja',
          value: remainingToPay,
          troco: 0,
        });

        const installments = remainingToPay >= 260 && rng() < 0.45 ? 3 : 2;
        const totalCents = Math.round(remainingToPay * 100);
        const baseInstCents = Math.floor(totalCents / installments);
        const remainderCents = totalCents - baseInstCents * installments;

        for (let inst = 1; inst <= installments; inst++) {
          const instAmount = round2(
            (baseInstCents + (inst === 1 ? remainderCents : 0)) / 100,
          );
          const dueDayIso = addDaysIso(dayIso, inst * 30);
          const dueDate = makeSpDate(dueDayIso, 12, 0, 0);
          const daysPastDue = Math.floor(
            (now.getTime() - dueDate.getTime()) / 86400000,
          );

          const recId = randomUUID();
          let recStatus = 'OPEN';
          let paidAmount = 0;
          let remainingAmount = instAmount;
          let paidAt: Date | null = null;

          if (daysPastDue > 14) {
            // Parcelas antigas: 97% quitadas pontualmente, ~3% em atraso demonstrativo
            if (rng() < 0.97) {
              recStatus = 'PAID';
              paidAmount = instAmount;
              remainingAmount = 0;
              const payOffsetDays = Math.floor(rng() * 5) - 2;
              const paidDayIso = addDaysIso(dueDayIso, payOffsetDays);
              paidAt = makeSpDate(
                paidDayIso > todayIso ? todayIso : paidDayIso,
                14,
                20,
                0,
              );
              receivablePaymentRows.push({
                id: randomUUID(),
                requestKey: `hist-recpay-${recId.slice(0, 18)}`,
                receivableId: recId,
                customerId: customer.id,
                amount: instAmount,
                paymentMethod: rng() < 0.78 ? 'pix' : 'dinheiro',
                operatorId: seller.id,
                notes: 'Recebimento de parcela registrado na loja.',
                createdAt: paidAt,
              });
            }
          } else if (daysPastDue >= 2 && daysPastDue <= 14) {
            // Janela recente: algumas pagas, algumas parciais e algumas em aberto/vencidas
            const recentRoll = rng();
            if (recentRoll < 0.55) {
              recStatus = 'PAID';
              paidAmount = instAmount;
              remainingAmount = 0;
              paidAt = makeSpDate(dueDayIso, 15, 10, 0);
              receivablePaymentRows.push({
                id: randomUUID(),
                requestKey: `hist-recpay-${recId.slice(0, 18)}`,
                receivableId: recId,
                customerId: customer.id,
                amount: instAmount,
                paymentMethod: 'pix',
                operatorId: seller.id,
                notes: 'Parcela quitada via PIX.',
                createdAt: paidAt,
              });
            } else if (recentRoll < 0.75 && instAmount >= 80) {
              recStatus = 'PARTIAL';
              paidAmount = round2(instAmount * 0.5);
              remainingAmount = round2(instAmount - paidAmount);
              const partialPaidAt = makeSpDate(dueDayIso, 16, 0, 0);
              receivablePaymentRows.push({
                id: randomUUID(),
                requestKey: `hist-recpay-${recId.slice(0, 18)}`,
                receivableId: recId,
                customerId: customer.id,
                amount: paidAmount,
                paymentMethod: 'pix',
                operatorId: seller.id,
                notes: 'Amortização parcial da parcela.',
                createdAt: partialPaidAt,
              });
            }
          }

          receivableRows.push({
            id: recId,
            customerId: customer.id,
            saleId,
            installmentNumber: inst,
            totalInstallments: installments,
            description: `Venda #${saleCode} · Parcela ${inst}/${installments}`,
            originalAmount: instAmount,
            paidAmount,
            remainingAmount,
            dueDate,
            status: recStatus,
            paidAt,
            operatorId: seller.id,
            createdAt: saleDate,
            updatedAt: paidAt || saleDate,
          });
        }
      } else if (payRoll < 0.50) {
        // PIX (~44%)
        thisSalePayments.push({
          id: randomUUID(),
          saleId,
          tPag: '17',
          method: 'pix',
          label: 'Pix',
          value: remainingToPay,
          troco: 0,
        });
        if (!isCancelled) pixSalesDayTotal = round2(pixSalesDayTotal + remainingToPay);
      } else if (payRoll < 0.80) {
        // Cartão de Crédito (~30%)
        thisSalePayments.push({
          id: randomUUID(),
          saleId,
          tPag: '03',
          method: 'credito',
          label: 'Cartão de Crédito',
          value: remainingToPay,
          troco: 0,
        });
        if (!isCancelled) creditSalesDayTotal = round2(creditSalesDayTotal + remainingToPay);
      } else if (payRoll < 0.93 || isStorefrontSale) {
        // Cartão de Débito (~13%)
        thisSalePayments.push({
          id: randomUUID(),
          saleId,
          tPag: '04',
          method: 'debito',
          label: 'Cartão de Débito',
          value: remainingToPay,
          troco: 0,
        });
        if (!isCancelled) debitSalesDayTotal = round2(debitSalesDayTotal + remainingToPay);
      } else {
        // Dinheiro (~7%)
        const roundedBill =
          remainingToPay % 10 === 0 ? 0 : Math.ceil(remainingToPay / 10) * 10 - remainingToPay;
        const troco = rng() < 0.45 ? round2(roundedBill) : 0;
        thisSalePayments.push({
          id: randomUUID(),
          saleId,
          tPag: '01',
          method: 'dinheiro',
          label: 'Dinheiro',
          value: remainingToPay,
          troco,
        });
        if (!isCancelled) cashSalesDayTotal = round2(cashSalesDayTotal + remainingToPay);
      }

      saleRows.push({
        id: saleId,
        code: saleCode,
        customerId: customer?.id || null,
        operatorId: seller.id,
        cashRegisterId: regId,
        subtotal: rawSubtotal,
        discount: saleDiscount,
        addition: 0,
        total: saleTotal,
        status: isCancelled ? 'cancelled' : 'completed',
        source: saleSource,
        emitirNfce: false,
        consumidorCpf: customer?.cpfCnpj && rng() < 0.35 ? customer.cpfCnpj : null,
        consumidorNome: customer ? customer.name : null,
        cancelReason: isCancelled
          ? ' desistência de pagamento / lançamento refeito pelo operador'.trim()
          : null,
        cancelledAt: isCancelled ? new Date(saleDate.getTime() + 6 * 60000) : null,
        createdAt: saleDate,
        updatedAt: saleDate,
      });

      for (const item of currentSaleItems) {
        saleItemRows.push({
          id: item.id,
          saleId,
          productId: item.product.id,
          productName: item.product.name,
          unit: item.product.unit,
          quantity: item.qty,
          priceUnit: item.priceUnit,
          priceCost: item.priceCost,
          discount: 0,
          subtotal: item.subtotal,
          ncm: item.product.ncm,
          cfop: '5102',
          origem: 0,
          csosn: '102',
          cstPis: '99',
          cstCofins: '99',
        });

        if (!isCancelled) {
          soldQtyByProduct.set(
            item.product.id,
            (soldQtyByProduct.get(item.product.id) || 0) + item.qty,
          );
          saleEventsForInventory.push({
            productId: item.product.id,
            saleItemId: item.id,
            quantity: item.qty,
            costPrice: item.priceCost,
            createdAt: saleDate,
            origin: isStorefrontSale ? 'LOJA_VIRTUAL' : 'PDV',
            saleCode,
          });
        }
      }

      for (const p of thisSalePayments) {
        paymentRows.push(p);
      }

      daySalesForHash.push({
        id: saleId,
        total: saleTotal,
        status: isCancelled ? 'cancelled' : 'completed',
        source: saleSource,
        payments: thisSalePayments.map((p) => ({
          id: p.id,
          value: p.value,
          method: p.method,
        })),
      });

      // Se a venda veio da Loja Virtual, criar o Pedido Online concluído correspondente
      if (isStorefrontSale && customer) {
        const orderId = randomUUID();
        const orderCode = nextOrderCode++;
        const orderCreatedAt = new Date(saleDate.getTime() - 42 * 60000);
        const orderConfirmedAt = new Date(saleDate.getTime() - 25 * 60000);
        const isDelivery = rng() < 0.58;

        storefrontOrderRows.push({
          id: orderId,
          code: orderCode,
          reference: `LV-${dayIso.slice(2, 4)}${dayIso.slice(5, 7)}-${String(orderCode).padStart(4, '0')}`,
          idempotencyKey: `hist-lv-idem-${orderId}`,
          requestFingerprint: createHash('sha256').update(orderId).digest('hex').slice(0, 64),
          accessTokenHash: createHash('sha256').update(`tok-${orderId}`).digest('hex'),
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerCpf: customer.cpfCnpj,
          fulfillmentMode: isDelivery ? 'DELIVERY' : 'PICKUP',
          deliveryAddressJson: isDelivery
            ? {
                street: 'Endereço cadastrado do cliente',
                neighborhood: NEIGHBORHOODS[orderCode % NEIGHBORHOODS.length],
                city: 'São Paulo',
                state: 'SP',
              }
            : null,
          notes: isDelivery
            ? 'Entrega combinada via WhatsApp da loja.'
            : 'Retirada rápida no balcão da loja.',
          subtotal: rawSubtotal,
          discount: saleDiscount,
          total: saleTotal,
          commercialStatus: 'COMPLETED',
          reservationStatus: 'CONSUMED',
          fulfillmentStatus: isDelivery ? 'DELIVERED' : 'PICKED_UP',
          paymentStatus: 'REGISTERED_IN_SALE',
          reservationExpiresAt: new Date(orderCreatedAt.getTime() + 24 * 3600000),
          confirmedAt: orderConfirmedAt,
          confirmedByName: seller.name,
          completedAt: saleDate,
          saleId,
          version: 3,
          createdAt: orderCreatedAt,
          updatedAt: saleDate,
        });

        for (const item of currentSaleItems) {
          storefrontOrderItemRows.push({
            id: randomUUID(),
            orderId,
            retailGroupId: item.product.retailGroupId,
            productId: item.product.id,
            productName: item.product.name,
            size: item.product.size,
            color: item.product.color,
            variantLabel: [item.product.size, item.product.color].filter(Boolean).join(' · ') || null,
            sku: item.product.shortCode,
            barcode: item.product.barcode,
            imageUrl: item.product.imageUrl,
            unit: item.product.unit,
            quantity: item.qty,
            priceUnit: item.priceUnit,
            subtotal: item.subtotal,
            createdAt: orderCreatedAt,
          });

          stockReservationRows.push({
            id: randomUUID(),
            orderId,
            productId: item.product.id,
            quantity: item.qty,
            status: 'CONSUMED',
            expiresAt: new Date(orderCreatedAt.getTime() + 24 * 3600000),
            consumedAt: saleDate,
            createdAt: orderCreatedAt,
            updatedAt: saleDate,
          });
        }

        storefrontOrderEventRows.push(
          {
            id: randomUUID(),
            orderId,
            eventType: 'ORDER_CREATED',
            fromStatus: null,
            toStatus: 'AWAITING_CONFIRMATION',
            actorType: 'CUSTOMER',
            actorName: customer.name,
            createdAt: orderCreatedAt,
          },
          {
            id: randomUUID(),
            orderId,
            eventType: 'ORDER_COMPLETED',
            fromStatus: 'CONFIRMED',
            toStatus: 'COMPLETED',
            actorType: 'OPERATOR',
            actorName: seller.name,
            createdAt: saleDate,
          },
        );
      }

      // Gerar trocas realistas (~1.1% das vendas identificadas sem desconto)
      if (
        !isCancelled &&
        !isStorefrontSale &&
        saleDiscount === 0 &&
        customer &&
        hasTable('retail_returns', (client as any).retailReturn) &&
        returnRows.length < Math.max(12, Math.round(months * 2)) &&
        rng() < 0.018
      ) {
        const targetItem = currentSaleItems[0];
        const returnId = randomUUID();
        const creditId = randomUUID();
        const returnVal = round2(targetItem.priceUnit);
        const returnDayOffset = isToday ? 0 : Math.min(3, Math.max(1, daysSpan - 1 - dayIdx));
        const returnDayIso = addDaysIso(dayIso, returnDayOffset);
        const returnDate = isToday
          ? new Date(Math.min(now.getTime() - 60000, saleDate.getTime() + 15 * 60000))
          : makeSpDate(returnDayIso, 14, 15 + Math.floor(rng() * 40), 0);

        returnRows.push({
          id: returnId,
          requestKey: `hist-ret-${returnId.slice(0, 24)}`,
          requestFingerprint: createHash('sha256').update(returnId).digest('hex').slice(0, 64),
          saleId,
          customerId: customer.id,
          reason: RETURN_REASONS[returnRows.length % RETURN_REASONS.length],
          operatorId: seller.id,
          total: returnVal,
          createdAt: returnDate,
        });

        returnItemRows.push({
          id: randomUUID(),
          returnId,
          saleItemId: targetItem.id,
          quantity: 1,
          restock: true,
          value: returnVal,
        });

        restockedReturnQtyByProduct.set(
          targetItem.product.id,
          (restockedReturnQtyByProduct.get(targetItem.product.id) || 0) + 1,
        );

        const creditObj = {
          id: creditId,
          returnId,
          customerId: customer.id,
          amount: returnVal,
          balance: returnVal,
          createdAt: returnDate,
        };
        storeCreditRows.push(creditObj);

        const list = availableCustomerCredits.get(customer.id) || [];
        list.push(creditObj);
        availableCustomerCredits.set(customer.id, list);
      }
    }

    // Sangria de cofre no fim da tarde quando houve entrada relevante em dinheiro
    const availableCashBeforeOut = round2(openingValue + cashSalesDayTotal + cashInDay);
    if (!isToday && availableCashBeforeOut > 380 && rng() < 0.65) {
      const sangriaVal = round2(Math.floor((availableCashBeforeOut - 200) / 50) * 50);
      if (sangriaVal >= 50) {
        const movId = randomUUID();
        const sangriaTime = makeSpDate(dayIso, 18, 10 + Math.floor(rng() * 35), 0);
        cashOutDay = round2(cashOutDay + sangriaVal);
        cashMovementRows.push({
          id: movId,
          cashRegisterId: regId,
          type: 'OUT',
          value: sangriaVal,
          reason: 'Sangria para cofre administrativo',
          createdAt: sangriaTime,
        });
        dayMovementsForHash.push({ id: movId, type: 'OUT', value: sangriaVal });
      }
    }

    if (isToday) {
      openRegisterCode = regCode;
      cashRegisterRows.push({
        id: regId,
        code: regCode,
        operatorId: regOperator.id,
        openingTime,
        closingTime: null,
        openingValue,
        closingValue: null,
        closingDetails: null,
        status: 'open',
      });
    } else {
      const closeHour = weekday === 0 ? 16 : 19;
      const closeMin = 32 + Math.floor(rng() * 24);
      const closingTime = makeSpDate(dayIso, closeHour, closeMin, 15);
      const expectedDrawerCash = round2(
        openingValue + cashSalesDayTotal + cashInDay - cashOutDay,
      );
      const dataVersion = computeDataVersion(daySalesForHash, dayMovementsForHash);
      const detailsObj = {
        dataVersion,
        declaredPix: pixSalesDayTotal,
        declaredCredit: creditSalesDayTotal,
        declaredDebit: debitSalesDayTotal,
        notes: 'Turno encerrado e conferido sem divergências.',
      };
      const serializedDetails = JSON.stringify(detailsObj);

      cashRegisterRows.push({
        id: regId,
        code: regCode,
        operatorId: regOperator.id,
        openingTime,
        closingTime,
        openingValue,
        closingValue: expectedDrawerCash,
        closingDetails: serializedDetails,
        status: 'closed',
      });

      conferenceRevisionRows.push({
        id: randomUUID(),
        cashRegisterId: regId,
        details: serializedDetails,
        savedByOpId: regOperator.id,
        savedByOpName: regOperator.name,
        pinAuthType: 'manager_pin',
        pinAuthManagerId: managerOp.id,
        pinAuthManagerName: managerOp.name,
        savedAt: closingTime,
      });
    }
  }

  // Sincronizar saldos finais dos créditos de troca que foram resgatados durante a simulação
  for (const sc of storeCreditRows) {
    sc.balance = round2(sc.balance);
  }

  // 8. Criar 2 pedidos recentes ativos na fila da Loja Virtual (Aguardando confirmação / Em separação)
  let storefrontOrdersActiveQueue = 0;
  if (hasStorefrontTable && allCustomers.length >= 2) {
    const queueSpecs = [
      {
        status: 'AWAITING_CONFIRMATION',
        fulfillment: 'WAITING_SEPARATION',
        mode: 'DELIVERY',
        minutesAgo: 28,
        holdHours: 2,
      },
      {
        status: 'CONFIRMED',
        fulfillment: 'SEPARATING',
        mode: 'PICKUP',
        minutesAgo: 95,
        holdHours: 22,
      },
    ];

    for (let q = 0; q < queueSpecs.length; q++) {
      const spec = queueSpecs[q];
      const cust = allCustomers[q % allCustomers.length];
      const itemA = onlinePool[(q * 2) % onlinePool.length];
      const itemB =
        onlinePool.length > 1 ? onlinePool[(q * 2 + 1) % onlinePool.length] : null;
      const pickedItems = itemB && itemB.id !== itemA.id ? [itemA, itemB] : [itemA];

      const orderId = randomUUID();
      const orderCode = nextOrderCode++;
      const createdAt = new Date(now.getTime() - spec.minutesAgo * 60000);
      const expiresAt = new Date(now.getTime() + spec.holdHours * 3600000);
      const orderTotal = round2(
        pickedItems.reduce((acc, it) => acc + it.priceSell, 0),
      );

      storefrontOrderRows.push({
        id: orderId,
        code: orderCode,
        reference: `LV-${todayIso.slice(2, 4)}${todayIso.slice(5, 7)}-${String(orderCode).padStart(4, '0')}`,
        idempotencyKey: `hist-lv-live-${orderId}`,
        requestFingerprint: createHash('sha256').update(orderId).digest('hex').slice(0, 64),
        accessTokenHash: createHash('sha256').update(`tok-${orderId}`).digest('hex'),
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerCpf: cust.cpfCnpj,
        fulfillmentMode: spec.mode,
        deliveryAddressJson:
          spec.mode === 'DELIVERY'
            ? {
                street: 'Av. Principal, 740',
                neighborhood: 'Centro',
                city: 'São Paulo',
                state: 'SP',
              }
            : null,
        notes:
          spec.mode === 'DELIVERY'
            ? 'Cliente pediu confirmação pelo WhatsApp antes do envio.'
            : 'Cliente passa no fim da tarde para retirar na loja.',
        subtotal: orderTotal,
        discount: 0,
        total: orderTotal,
        commercialStatus: spec.status,
        reservationStatus: 'ACTIVE',
        fulfillmentStatus: spec.fulfillment,
        paymentStatus: 'UNREGISTERED',
        reservationExpiresAt: expiresAt,
        confirmedAt: spec.status === 'CONFIRMED' ? new Date(createdAt.getTime() + 12 * 60000) : null,
        confirmedByName: spec.status === 'CONFIRMED' ? managerOp.name : null,
        version: spec.status === 'CONFIRMED' ? 2 : 1,
        createdAt,
        updatedAt: createdAt,
      });

      for (const it of pickedItems) {
        storefrontOrderItemRows.push({
          id: randomUUID(),
          orderId,
          retailGroupId: it.retailGroupId,
          productId: it.id,
          productName: it.name,
          size: it.size,
          color: it.color,
          variantLabel: [it.size, it.color].filter(Boolean).join(' · ') || null,
          sku: it.shortCode,
          barcode: it.barcode,
          imageUrl: it.imageUrl,
          unit: it.unit,
          quantity: 1,
          priceUnit: it.priceSell,
          subtotal: it.priceSell,
          createdAt,
        });

        stockReservationRows.push({
          id: randomUUID(),
          orderId,
          productId: it.id,
          quantity: 1,
          status: 'ACTIVE',
          expiresAt,
          createdAt,
          updatedAt: createdAt,
        });

        activeReservedQtyByProduct.set(
          it.id,
          (activeReservedQtyByProduct.get(it.id) || 0) + 1,
        );
      }

      storefrontOrderEventRows.push({
        id: randomUUID(),
        orderId,
        eventType: 'ORDER_CREATED',
        fromStatus: null,
        toStatus: 'AWAITING_CONFIRMATION',
        actorType: 'CUSTOMER',
        actorName: cust.name,
        createdAt,
      });

      storefrontOrdersActiveQueue++;
    }
  }

  // 9. Pedidos de Compra quinzenais, Lotes PEPS/FIFO consistentes e Logs de Estoque
  const purchaseOrderRows: any[] = [];
  const purchaseOrderItemRows: any[] = [];
  const stockLotRows: any[] = [];
  const stockLotConsumptionRows: any[] = [];
  const inventoryLogRows: any[] = [];
  const finalProductUpdates: Array<{ id: string; stock: number; salesCount: number }> = [];

  // Planejar 2 reposições por mês (ex: 24 pedidos COMPLETED) + 1 pedido SENT recente
  const replenishmentCount = Math.max(2, months * 2);
  const purchaseDates: Date[] = [];
  for (let p = 0; p < replenishmentCount; p++) {
    const dayOffset = Math.min(
      daysSpan - 3,
      Math.max(0, Math.round((p * (daysSpan - 6)) / replenishmentCount)),
    );
    const poDayIso = addDaysIso(startDayIso, dayOffset);
    purchaseDates.push(makeSpDate(poDayIso, 9, 20, 0));
  }

  const poBuckets: Array<{
    id: string;
    supplierId: string;
    date: Date;
    total: number;
  }> = suppliers.length
    ? purchaseDates.map((date, idx) => ({
        id: randomUUID(),
        supplierId: suppliers[idx % suppliers.length].id,
        date,
        total: 0,
      }))
    : [];

  catalogItems.forEach((item, idx) => {
    const soldQty = soldQtyByProduct.get(item.id) || 0;
    const restockedQty = restockedReturnQtyByProduct.get(item.id) || 0;
    const reservedActive = activeReservedQtyByProduct.get(item.id) || 0;

    // Saldo disponível final saudável (alguns itens em alerta de estoque baixo p/ enriquecer o Dashboard)
    const desiredEndingStock =
      (idx % 17 === 0 ? 2 : idx % 11 === 0 ? 4 : 9 + (idx % 14)) + reservedActive;
    const totalNeededIn = Math.max(
      desiredEndingStock,
      soldQty - restockedQty + desiredEndingStock,
    );

    // Dividir entradas em 1 lote de implantação inicial + reposições mensais/quinzenais bem distribuídas
    const maxReplenishments = Math.min(
      poBuckets.length,
      catalogItems.length <= 8 ? 12 : 6,
    );
    const lotSplits =
      soldQty > 24 && maxReplenishments >= 4
        ? 1 + maxReplenishments
        : soldQty > 6 && poBuckets.length >= 2
          ? 3
          : 1;
    const baseLotQty = Math.floor(totalNeededIn / lotSplits);
    let remainderLotQty = totalNeededIn - baseLotQty * lotSplits;

    const productLots: Array<{
      id: string;
      quantity: number;
      remaining: number;
      costPrice: number;
      createdAt: Date;
    }> = [];

    // Escolher buckets ordenados cronologicamente e defasados por produto (idx) para cobrir todos os meses
    const chosenBucketIndices: number[] = [];
    if (lotSplits > 1 && poBuckets.length > 0) {
      const replCount = lotSplits - 1;
      const usedSet = new Set<number>();
      for (let r = 0; r < replCount; r++) {
        const rawIdx =
          (Math.floor((r * poBuckets.length) / replCount) + idx) %
          poBuckets.length;
        usedSet.add(rawIdx);
      }
      chosenBucketIndices.push(...Array.from(usedSet).sort((a, b) => a - b));
    }

    const effectiveSplits = 1 + chosenBucketIndices.length;
    const effBaseQty = Math.floor(totalNeededIn / effectiveSplits);
    remainderLotQty = totalNeededIn - effBaseQty * effectiveSplits;

    for (let l = 0; l < effectiveSplits; l++) {
      const qty = effBaseQty + (remainderLotQty > 0 ? 1 : 0);
      if (remainderLotQty > 0) remainderLotQty--;
      if (qty <= 0) continue;

      const lotId = randomUUID();
      const bucket = l === 0 ? undefined : poBuckets[chosenBucketIndices[l - 1]];
      const lotDate = l === 0 ? startCreatedAt : bucket?.date || startCreatedAt;
      // Leve variação realista de custo (+-3%) ao longo do ano
      const lotCost = round4(
        item.priceCost * (0.97 + (l / Math.max(1, effectiveSplits)) * 0.05),
      );

      productLots.push({
        id: lotId,
        quantity: qty,
        remaining: qty,
        costPrice: lotCost,
        createdAt: lotDate,
      });

      stockLotRows.push({
        id: lotId,
        productId: item.id,
        costPrice: lotCost,
        quantity: qty,
        remaining: qty, // ajustado logo abaixo pelo consumo FIFO
        lotNumber: `LT-${lotDate.toISOString().slice(2, 4)}${lotDate.toISOString().slice(5, 7)}-${100 + idx}-${l + 1}`,
        supplierId: bucket?.supplierId || suppliers[0]?.id || null,
        createdAt: lotDate,
        updatedAt: lotDate,
      });

      inventoryLogRows.push({
        id: randomUUID(),
        productId: item.id,
        type: 'IN',
        quantity: qty,
        costPrice: lotCost,
        origin: l === 0 ? 'MANUAL' : 'PEDIDO_COMPRA',
        reason:
          l === 0
            ? 'Saldo inicial de implantação de estoque'
            : `Entrada de mercadoria — reposição lote #${l + 1}`,
        referenceId: l > 0 && bucket ? bucket.id : null,
        createdAt: lotDate,
      });

      if (l > 0 && bucket) {
        const lineTotal = round2(qty * lotCost);
        bucket.total = round2(bucket.total + lineTotal);
        purchaseOrderItemRows.push({
          id: randomUUID(),
          purchaseOrderId: bucket.id,
          productId: item.id,
          quantity: qty,
          unitMultiplier: 1,
          unitName: item.unit,
          expectedCost: lotCost,
          realCost: lotCost,
        });
      }
    }

    // Caso o lote 0 tenha sido o único e tenhamos pedidos de compra vazios, vincular alguns itens ao primeiro pedido
    if (lotSplits === 1 && poBuckets.length > 0 && idx < 8 && productLots[0]) {
      const b = poBuckets[idx % poBuckets.length];
      const q = productLots[0].quantity;
      const c = productLots[0].costPrice;
      b.total = round2(b.total + round2(q * c));
      purchaseOrderItemRows.push({
        id: randomUUID(),
        purchaseOrderId: b.id,
        productId: item.id,
        quantity: q,
        unitMultiplier: 1,
        unitName: item.unit,
        expectedCost: c,
        realCost: c,
      });
    }

    // Consumir lotes em ordem FIFO para cada venda deste produto
    let netToConsume = Math.max(0, soldQty - restockedQty);
    let lotCursor = 0;
    const itemSaleEvents = saleEventsForInventory.filter((ev) => ev.productId === item.id);

    for (const ev of itemSaleEvents) {
      inventoryLogRows.push({
        id: randomUUID(),
        productId: item.id,
        type: 'SALE',
        quantity: ev.quantity,
        costPrice: ev.costPrice,
        origin: ev.origin,
        reason: `Venda #${ev.saleCode}`,
        createdAt: ev.createdAt,
      });

      let reqQty = Math.min(ev.quantity, netToConsume);
      netToConsume -= reqQty;

      while (reqQty > 0 && lotCursor < productLots.length) {
        const currentLot = productLots[lotCursor];
        if (currentLot.remaining <= 0) {
          lotCursor++;
          continue;
        }
        const take = Math.min(reqQty, currentLot.remaining);
        currentLot.remaining -= take;
        reqQty -= take;

        stockLotConsumptionRows.push({
          id: randomUUID(),
          saleItemId: ev.saleItemId,
          lotId: currentLot.id,
          quantity: take,
        });

        if (currentLot.remaining <= 0) {
          lotCursor++;
        }
      }
    }

    // Atualizar remaining real na linha de StockLot
    for (const pLot of productLots) {
      const row = stockLotRows.find((r) => r.id === pLot.id);
      if (row) row.remaining = pLot.remaining;
    }

    const endingPhysicalStock = productLots.reduce((acc, l) => acc + l.remaining, 0);
    finalProductUpdates.push({
      id: item.id,
      stock: endingPhysicalStock,
      salesCount: soldQty,
    });
  });

  // Consolidar PurchaseOrders com itens
  for (const bucket of poBuckets) {
    if (bucket.total <= 0) continue;
    purchaseOrderRows.push({
      id: bucket.id,
      supplierId: bucket.supplierId,
      status: 'COMPLETED',
      totalEstimated: bucket.total,
      totalReal: bucket.total,
      createdAt: new Date(bucket.date.getTime() - 2 * 86400000),
      updatedAt: bucket.date,
      receivedAt: bucket.date,
    });
  }

  // Adicionar 1 Pedido de Compra "SENT" (aguardando entrega do fornecedor na semana atual)
  if (suppliers.length > 0 && catalogItems.length > 0) {
    const sentPoId = randomUUID();
    const sentItems = catalogItems.slice(0, Math.min(4, catalogItems.length));
    let sentTotal = 0;
    for (const si of sentItems) {
      const qty = 12;
      sentTotal = round2(sentTotal + round2(qty * si.priceCost));
      purchaseOrderItemRows.push({
        id: randomUUID(),
        purchaseOrderId: sentPoId,
        productId: si.id,
        quantity: qty,
        unitMultiplier: 1,
        unitName: si.unit,
        expectedCost: si.priceCost,
        realCost: null,
      });
    }
    const sentCreated = new Date(now.getTime() - 2 * 86400000);
    purchaseOrderRows.push({
      id: sentPoId,
      supplierId: suppliers[0].id,
      status: 'SENT',
      totalEstimated: sentTotal,
      totalReal: 0,
      createdAt: sentCreated,
      updatedAt: sentCreated,
      receivedAt: null,
    });
  }

  // 10. Financeiro — Contas a Pagar (12 meses de despesas fixas + boletos de fornecedores)
  const payableRows: any[] = [];
  if (hasTable('payables', (client as any).payable)) {
    const uniqueYearMonths = Array.from(
      new Set(
        Array.from({ length: daysSpan }, (_, i) => addDaysIso(startDayIso, i).slice(0, 7)),
      ),
    );

    const scaleExpense = profile === 'compact' ? 0.65 : profile === 'busy' ? 1.55 : 1.0;
    const fixedBillsSpec = [
      {
        recId: 'hist-rec-aluguel',
        desc: 'Aluguel do Ponto Comercial',
        category: 'aluguel',
        day: 5,
        baseAmount: round2(3200 * scaleExpense),
      },
      {
        recId: 'hist-rec-energia',
        desc: 'Energia Elétrica Comercial (Iluminação + Climatização)',
        category: 'luz',
        day: 10,
        baseAmount: round2(485 * scaleExpense),
      },
      {
        recId: 'hist-rec-internet',
        desc: 'Internet Fibra Empresarial & Telefonia',
        category: 'internet',
        day: 12,
        baseAmount: 159.9,
      },
      {
        recId: 'hist-rec-contabil',
        desc: 'Assessoria Contábil & Fiscal',
        category: 'servicos',
        day: 15,
        baseAmount: round2(590 * scaleExpense),
      },
      {
        recId: 'hist-rec-das',
        desc: 'Simples Nacional — Guia DAS Mensal',
        category: 'impostos',
        day: 20,
        baseAmount: round2(1890 * scaleExpense),
      },
      {
        recId: 'hist-rec-folha',
        desc: 'Folha Salarial & Comissões da Equipe',
        category: 'funcionario',
        day: 28,
        baseAmount: round2(6400 * scaleExpense),
      },
    ];

    const todayStart = makeSpDate(todayIso, 0, 0, 0);

    for (const ym of uniqueYearMonths) {
      const [yStr, mStr] = ym.split('-');
      const lastDay = new Date(Number(yStr), Number(mStr), 0).getDate();

      for (const spec of fixedBillsSpec) {
        const safeDay = Math.min(spec.day, lastDay);
        const dueIso = `${ym}-${String(safeDay).padStart(2, '0')}`;
        const dueDate = makeSpDate(dueIso, 12, 0, 0);
        const isVariableUtility = spec.category === 'luz' || spec.category === 'impostos';
        const amount = isVariableUtility
          ? round2(spec.baseAmount * (0.9 + rng() * 0.22))
          : spec.baseAmount;

        const isPaid = dueDate < todayStart;
        payableRows.push({
          id: randomUUID(),
          description: `${spec.desc} (${mStr}/${yStr})`,
          amount,
          dueDate,
          status: isPaid ? 'PAID' : 'PENDING',
          type: 'FIXED',
          isRecurring: true,
          recurrenceId: spec.recId,
          recurrenceMonth: ym,
          recurrenceDay: spec.day,
          category: spec.category,
          supplierId: null,
          paidAt: isPaid ? dueDate : null,
          notes: isPaid ? 'Quitado via transferência bancária / PIX.' : 'Programado no fluxo mensal.',
          createdAt: makeSpDate(`${ym}-01`, 9, 0, 0),
          updatedAt: isPaid ? dueDate : makeSpDate(`${ym}-01`, 9, 0, 0),
        });
      }
    }

    // Boletos variáveis vinculados aos Pedidos de Compra recebidos
    for (let i = 0; i < purchaseOrderRows.length; i++) {
      const po = purchaseOrderRows[i];
      if (po.status !== 'COMPLETED' || Number(po.totalReal) <= 0) continue;
      const poDayIso = toSaoPauloParts(po.receivedAt).isoDay;
      const dueIso = addDaysIso(poDayIso, 21);
      const dueDate = makeSpDate(dueIso, 12, 0, 0);
      const isPaid = dueDate < todayStart;

      payableRows.push({
        id: randomUUID(),
        description: `Fatura Fornecedor — Reposição de Mercadorias #${i + 1}`,
        amount: round2(Number(po.totalReal)),
        dueDate,
        status: isPaid ? 'PAID' : 'PENDING',
        type: 'VARIABLE',
        isRecurring: false,
        recurrenceId: null,
        recurrenceMonth: null,
        recurrenceDay: null,
        category: 'fornecedor',
        supplierId: po.supplierId,
        paidAt: isPaid ? dueDate : null,
        notes: 'Boleto comercial referente à entrada de estoque.',
        createdAt: po.receivedAt,
        updatedAt: isPaid ? dueDate : po.receivedAt,
      });
    }

    // Garantir ao menos 1 conta vencendo nos próximos 2 dias para acionar o card de alerta do Dashboard
    const twoDaysAheadIso = addDaysIso(todayIso, 2);
    payableRows.push({
      id: randomUUID(),
      description: 'Reposição de Sacolas Personalizadas & Etiquetas',
      amount: 380.0,
      dueDate: makeSpDate(twoDaysAheadIso, 12, 0, 0),
      status: 'PENDING',
      type: 'VARIABLE',
      isRecurring: false,
      category: 'embalagens',
      supplierId: suppliers[0]?.id || null,
      notes: 'Vencimento próximo — conferido pelo financeiro.',
      createdAt: now,
      updatedAt: now,
    });
  }

  // 11. Inserção em lotes de alta performance (createMany em chunks de 500)
  await insertManyChunked(client.cashRegister as any, cashRegisterRows, 500);
  await insertManyChunked(client.cashMovement as any, cashMovementRows, 500);
  if (
    hasTable(
      'cash_register_conference_revisions',
      (client as any).cashRegisterConferenceRevision,
    )
  ) {
    await insertManyChunked(
      (client as any).cashRegisterConferenceRevision,
      conferenceRevisionRows,
      500,
    );
  }

  await insertManyChunked(client.sale as any, saleRows, 500);
  await insertManyChunked(client.saleItem as any, saleItemRows, 500);
  await insertManyChunked(client.payment as any, paymentRows, 500);

  if (hasTable('purchase_orders', (client as any).purchaseOrder)) {
    await insertManyChunked((client as any).purchaseOrder, purchaseOrderRows, 500);
  }
  if (hasTable('purchase_order_items', (client as any).purchaseOrderItem)) {
    await insertManyChunked((client as any).purchaseOrderItem, purchaseOrderItemRows, 500);
  }
  if (hasTable('stock_lots', (client as any).stockLot)) {
    await insertManyChunked((client as any).stockLot, stockLotRows, 500);
  }
  if (hasTable('stock_lot_consumptions', (client as any).stockLotConsumption)) {
    await insertManyChunked((client as any).stockLotConsumption, stockLotConsumptionRows, 500);
  }
  await insertManyChunked(client.inventoryLog as any, inventoryLogRows, 600);

  if (hasTable('payables', (client as any).payable)) {
    await insertManyChunked((client as any).payable, payableRows, 500, true);
  }

  if (hasCrediario) {
    await insertManyChunked((client as any).customerReceivable, receivableRows, 500);
    if (hasTable('customer_receivable_payments', (client as any).customerReceivablePayment)) {
      await insertManyChunked(
        (client as any).customerReceivablePayment,
        receivablePaymentRows,
        500,
        true,
      );
    }
  }

  if (hasTable('retail_returns', (client as any).retailReturn)) {
    await insertManyChunked((client as any).retailReturn, returnRows, 500, true);
    await insertManyChunked((client as any).retailReturnItem, returnItemRows, 500, true);
    await insertManyChunked((client as any).storeCredit, storeCreditRows, 500, true);
    await insertManyChunked((client as any).storeCreditUse, storeCreditUseRows, 500, true);
  }

  if (hasStorefrontTable) {
    await insertManyChunked((client as any).storefrontOrder, storefrontOrderRows, 500, true);
    await insertManyChunked(
      (client as any).storefrontOrderItem,
      storefrontOrderItemRows,
      500,
    );
    await insertManyChunked(
      (client as any).stockReservation,
      stockReservationRows,
      500,
    );
    await insertManyChunked(
      (client as any).storefrontOrderEvent,
      storefrontOrderEventRows,
      500,
    );
  }

  // 12. Atualizar apenas stock e salesCount dos produtos existentes (preservando 100% de fotos, preços e descrições)
  if (finalProductUpdates.length > 0) {
    let bulkUpdated = false;
    if (typeof (client as any).$executeRawUnsafe === 'function') {
      try {
        for (let i = 0; i < finalProductUpdates.length; i += 200) {
          const chunk = finalProductUpdates.slice(i, i + 200);
          const params: any[] = [];
          const valuesSql = chunk
            .map((u, idx) => {
              const base = idx * 3;
              params.push(u.id, u.stock, u.salesCount);
              return `($${base + 1}, $${base + 2}::numeric(10,3), $${base + 3}::integer)`;
            })
            .join(', ');
          await (client as any).$executeRawUnsafe(
            `UPDATE "products" AS p SET "stock" = v.stock, "salesCount" = v.sales_count, "updatedAt" = NOW() FROM (VALUES ${valuesSql}) AS v(id, stock, sales_count) WHERE p."id" = v.id`,
            ...params,
          );
        }
        bulkUpdated = true;
      } catch {
        bulkUpdated = false;
      }
    }

    if (!bulkUpdated) {
      for (const u of finalProductUpdates) {
        await client.product.update({
          where: { id: u.id },
          data: { stock: u.stock, salesCount: u.salesCount },
        });
      }
    }
  }

  // 13. Montar resumo executivo
  const completedSales = saleRows.filter((s) => s.status === 'completed');
  const cancelledSales = saleRows.filter((s) => s.status === 'cancelled');
  const grossRevenue = round2(
    completedSales.reduce((acc, s) => acc + Number(s.total || 0), 0),
  );
  const returnsTotal = round2(
    returnRows.reduce((acc, r) => acc + Number(r.total || 0), 0),
  );
  const netRevenue = round2(grossRevenue - returnsTotal);
  const averageTicket =
    completedSales.length > 0 ? round2(grossRevenue / completedSales.length) : 0;

  return {
    monthsCovered: months,
    daysSpan,
    businessDaysOpen: cashRegisterRows.length,
    profile,
    cleanedPreviousMovements: cleanExistingMovements,
    preservedFiscalSales,
    catalogPreserved: {
      activeProducts: catalogItems.length,
      retailGroups: retailGroupsCount,
      categories: categoriesCount,
      storefrontPublished: Boolean(storefrontSettings?.isPublished),
    },
    team: {
      totalActiveOperators: activeTeam.length,
      createdOperators,
      allOperatorsWithAvatars: activeTeam.map((op) => ({
        id: op.id,
        name: op.name,
        imageUrl: op.imageUrl ?? null,
      })),
    },
    generated: {
      salesCompleted: completedSales.length,
      salesCancelled: cancelledSales.length,
      saleItems: saleItemRows.length,
      grossRevenue,
      netRevenue,
      averageTicket,
      averageMonthlyRevenue: round2(grossRevenue / months),
      cashRegistersClosed: cashRegisterRows.filter((r) => r.status === 'closed').length,
      openRegisterCode,
      cashMovements: cashMovementRows.length,
      customersTotal: allCustomers.length,
      suppliersTotal: suppliers.length,
      purchaseOrders: purchaseOrderRows.length,
      stockLots: stockLotRows.length,
      payablesTotal: payableRows.length,
      payablesPaid: payableRows.filter((p) => p.status === 'PAID').length,
      payablesPending: payableRows.filter((p) => p.status === 'PENDING').length,
      crediarioInstallments: receivableRows.length,
      crediarioPaid: receivableRows.filter((r) => r.status === 'PAID').length,
      crediarioOpen: receivableRows.filter((r) => r.status !== 'PAID').length,
      returnsCount: returnRows.length,
      activeStoreCredits: storeCreditRows.filter((c) => Number(c.balance) > 0).length,
      storefrontOrdersTotal: storefrontOrderRows.length,
      storefrontOrdersActiveQueue,
    },
    period: {
      startDate: startDayIso,
      endDate: todayIso,
    },
    durationMs: Date.now() - startedAt,
  };
}
