import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { WhatsappBaileysService } from './whatsapp-baileys.service';
import {
  DEFAULT_CREDIARIO_TEMPLATES,
  splitInstallmentsInCents,
  allocateCustomerPaymentFIFO,
  renderBillingTemplate,
  toCents,
  fromCents,
  diffDaysIso,
} from './crediario.rules';

export function todayIsoSaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function currentHourMinuteSaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === 'hour')?.value || '00';
  const m = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
}

@Injectable()
export class CrediarioService {
  private readonly logger = new Logger(CrediarioService.name);

  constructor(
    private readonly tenantManager: TenantConnectionManager,
    private readonly tenantContext: TenantContextService,
    private readonly heartPrisma: HeartPrismaService,
    private readonly whatsappService: WhatsappBaileysService,
  ) {}

  private async getPrisma() {
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.tenantManager.getTenantClient(tenantId, databaseUrl);
  }

  private parseModulos(raw: any): Record<string, boolean> {
    try {
      if (!raw) return {};
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  }

  async isModuleEnabledForTenant(tenantId: string): Promise<{
    enabled: boolean;
    storeName: string;
    tenant: any;
  }> {
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Loja não encontrada.');
    }
    const modulos = this.parseModulos(tenant.modulos);
    const enabled = Boolean(modulos.crediario);
    const storeName =
      tenant.nomeFantasia || tenant.razaoSocial || tenant.name || 'Nossa Loja';
    return { enabled, storeName, tenant };
  }

  async requireModuleEnabled(): Promise<{ storeName: string; tenant: any }> {
    const { tenantId } = this.tenantContext.get();
    const { enabled, storeName, tenant } =
      await this.isModuleEnabledForTenant(tenantId);
    if (!enabled) {
      throw new ForbiddenException(
        'O módulo de Crediário (Fiado) e Cobrança Automática não está habilitado para esta loja. Ative-o no painel /sys-init.',
      );
    }
    return { storeName, tenant };
  }

  private isSchemaError(error: any): boolean {
    if (['P2021', 'P2022', 'P2010'].includes(error?.code)) return true;
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('does not exist') ||
      msg.includes('unknown field') ||
      msg.includes('unknown column') ||
      ['42P01', '42703'].includes(String(error?.meta?.code || ''))
    );
  }

  private handleSchemaError(error: any): never {
    if (this.isSchemaError(error)) {
      throw new BadRequestException(
        'O banco de dados desta loja ainda não possui as tabelas do Módulo de Crediário. Acesse /sys-init, selecione a loja e clique em "Atualizar Bancos".',
      );
    }
    throw error;
  }

  private async runWithSchemaRecovery<T>(
    prisma: any,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (this.isSchemaError(error) && typeof prisma?.$executeRawUnsafe === 'function') {
        try {
          const { tenantId } = this.tenantContext.get();
          await this.tenantManager.ensureTenantRuntimeSchema(prisma, tenantId);
          return await fn();
        } catch (retryErr: any) {
          this.handleSchemaError(retryErr);
        }
      }
      this.handleSchemaError(error);
    }
  }

  async getOrCreateSettings(prismaClient?: any) {
    const prisma = prismaClient || (await this.getPrisma());
    return this.runWithSchemaRecovery(prisma, async () => {
      const existing = await prisma.crediarioSettings.findUnique({
        where: { id: 'singleton' },
      });
      if (existing) return existing;

      try {
        return await prisma.crediarioSettings.create({
          data: {
            id: 'singleton',
            ...DEFAULT_CREDIARIO_TEMPLATES,
          },
        });
      } catch (createErr: any) {
        if (createErr?.code === 'P2002') {
          const afterRace = await prisma.crediarioSettings.findUnique({
            where: { id: 'singleton' },
          });
          if (afterRace) return afterRace;
        }
        throw createErr;
      }
    });
  }

  async getSettings() {
    await this.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    const prisma = await this.getPrisma();
    const settings = await this.getOrCreateSettings(prisma);
    const whatsapp = await this.whatsappService.getStatus(
      tenantId,
      databaseUrl,
    );
    return { settings, whatsapp };
  }

  async updateSettings(body: any) {
    await this.requireModuleEnabled();
    const prisma = await this.getPrisma();
    await this.getOrCreateSettings(prisma);

    const data: any = {};
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (body.defaultCreditLimit !== undefined) {
      const lim = Number(body.defaultCreditLimit);
      if (!Number.isFinite(lim) || lim < 0) {
        throw new BadRequestException('Limite padrão inválido.');
      }
      data.defaultCreditLimit = new Prisma.Decimal(lim.toFixed(2));
    }
    if (body.defaultDueDays !== undefined) {
      const days = Number(body.defaultDueDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        throw new BadRequestException('Prazo padrão deve ser entre 1 e 365 dias.');
      }
      data.defaultDueDays = days;
    }
    if (body.maxInstallments !== undefined) {
      const maxInst = Number(body.maxInstallments);
      if (!Number.isInteger(maxInst) || maxInst < 1 || maxInst > 24) {
        throw new BadRequestException('Máximo de parcelas deve ser entre 1 e 24.');
      }
      data.maxInstallments = maxInst;
    }
    if (typeof body.allowPartialPayment === 'boolean') {
      data.allowPartialPayment = body.allowPartialPayment;
    }
    if (typeof body.blockOverdueCustomer === 'boolean') {
      data.blockOverdueCustomer = body.blockOverdueCustomer;
    }
    if (body.pixKey !== undefined) {
      data.pixKey = body.pixKey ? String(body.pixKey).trim() : null;
    }
    if (body.pixBeneficiary !== undefined) {
      data.pixBeneficiary = body.pixBeneficiary
        ? String(body.pixBeneficiary).trim()
        : null;
    }
    if (typeof body.whatsappAutoBilling === 'boolean') {
      data.whatsappAutoBilling = body.whatsappAutoBilling;
    }
    if (body.dispatchHour !== undefined) {
      const h = String(body.dispatchHour).trim();
      if (!/^\d{2}:\d{2}$/.test(h)) {
        throw new BadRequestException('Horário de disparo deve estar no formato HH:MM.');
      }
      data.dispatchHour = h;
    }
    if (typeof body.sendOnSale === 'boolean') data.sendOnSale = body.sendOnSale;
    if (typeof body.sendBeforeDue === 'boolean') {
      data.sendBeforeDue = body.sendBeforeDue;
    }
    if (body.daysBeforeDue !== undefined) {
      data.daysBeforeDue = Math.max(1, Math.min(30, Number(body.daysBeforeDue) || 3));
    }
    if (typeof body.sendOnDueDate === 'boolean') {
      data.sendOnDueDate = body.sendOnDueDate;
    }
    if (typeof body.sendOverdue === 'boolean') {
      data.sendOverdue = body.sendOverdue;
    }
    if (body.overdueIntervalDays !== undefined) {
      data.overdueIntervalDays = Math.max(
        1,
        Math.min(60, Number(body.overdueIntervalDays) || 3),
      );
    }
    if (body.maxOverdueReminders !== undefined) {
      data.maxOverdueReminders = Math.max(
        1,
        Math.min(30, Number(body.maxOverdueReminders) || 5),
      );
    }
    if (typeof body.sendOnPayment === 'boolean') {
      data.sendOnPayment = body.sendOnPayment;
    }
    if (typeof body.templateOnSale === 'string' && body.templateOnSale.trim()) {
      data.templateOnSale = body.templateOnSale.trim();
    }
    if (
      typeof body.templateBeforeDue === 'string' &&
      body.templateBeforeDue.trim()
    ) {
      data.templateBeforeDue = body.templateBeforeDue.trim();
    }
    if (
      typeof body.templateOnDueDate === 'string' &&
      body.templateOnDueDate.trim()
    ) {
      data.templateOnDueDate = body.templateOnDueDate.trim();
    }
    if (typeof body.templateOverdue === 'string' && body.templateOverdue.trim()) {
      data.templateOverdue = body.templateOverdue.trim();
    }
    if (
      typeof body.templateOnPayment === 'string' &&
      body.templateOnPayment.trim()
    ) {
      data.templateOnPayment = body.templateOnPayment.trim();
    }

    return this.runWithSchemaRecovery(prisma, () =>
      prisma.crediarioSettings.update({
        where: { id: 'singleton' },
        data,
      }),
    );
  }

  async getOverview() {
    await this.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    const prisma = await this.getPrisma();
    return this.runWithSchemaRecovery(prisma, async () => {
      const settings = await this.getOrCreateSettings(prisma);
      const whatsapp = await this.whatsappService.getStatus(
        tenantId,
        databaseUrl,
      );
      const todayIso = todayIsoSaoPaulo();
      const monthStart = new Date(`${todayIso.slice(0, 7)}-01T00:00:00-03:00`);

      const [openReceivables, monthPayments, recentLogs] = await Promise.all([
        prisma.customerReceivable.findMany({
          where: { status: { in: ['OPEN', 'PARTIAL'] } },
          select: {
            id: true,
            customerId: true,
            remainingAmount: true,
            dueDate: true,
          },
        }),
        prisma.customerReceivablePayment.aggregate({
          where: { reversedAt: null, createdAt: { gte: monthStart } },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.crediarioNotificationLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            customer: { select: { id: true, name: true, phone: true } },
          },
        }),
      ]);

      let totalOpenCents = 0;
      let totalOverdueCents = 0;
      let dueTodayCents = 0;
      const customersWithDebt = new Set<string>();
      const overdueCustomers = new Set<string>();

      for (const r of openReceivables) {
        const remCents = toCents(r.remainingAmount as any);
        if (remCents <= 0) continue;
        totalOpenCents += remCents;
        customersWithDebt.add(r.customerId);

        const dueIso = new Date(r.dueDate).toISOString().slice(0, 10);
        const diff = diffDaysIso(dueIso, todayIso);
        if (diff < 0) {
          totalOverdueCents += remCents;
          overdueCustomers.add(r.customerId);
        } else if (diff === 0) {
          dueTodayCents += remCents;
        }
      }

      return {
        settings,
        whatsapp,
        totals: {
          totalOpen: fromCents(totalOpenCents),
          totalOverdue: fromCents(totalOverdueCents),
          dueToday: fromCents(dueTodayCents),
          receivedThisMonth: Number(monthPayments._sum.amount || 0),
          paymentsCountThisMonth: monthPayments._count.id,
          customersWithDebtCount: customersWithDebt.size,
          overdueCustomersCount: overdueCustomers.size,
          openInstallmentsCount: openReceivables.length,
        },
        recentLogs,
      };
    });
  }

  private computeCustomerCreditMetrics(
    customer: any,
    openReceivables: any[],
    settings: any,
    todayIso: string,
  ) {
    const customLimit = Number(customer.creditLimit || 0);
    const defaultLimit = Number(settings?.defaultCreditLimit || 0);
    const effectiveCreditLimit = customLimit > 0 ? customLimit : defaultLimit;

    let usedCents = 0;
    let overdueCents = 0;
    let overdueCount = 0;
    let nextDueDate: string | null = null;

    for (const r of openReceivables) {
      if (r.status !== 'OPEN' && r.status !== 'PARTIAL') continue;
      const remCents = toCents(r.remainingAmount);
      if (remCents <= 0) continue;
      usedCents += remCents;

      const dueIso = new Date(r.dueDate).toISOString().slice(0, 10);
      if (!nextDueDate || dueIso < nextDueDate) {
        nextDueDate = dueIso;
      }
      if (diffDaysIso(dueIso, todayIso) < 0) {
        overdueCents += remCents;
        overdueCount += 1;
      }
    }

    const usedCredit = fromCents(usedCents);
    const overdueAmount = fromCents(overdueCents);
    const availableCredit = fromCents(
      Math.max(0, toCents(effectiveCreditLimit) - usedCents),
    );

    let canBuyOnCrediario = true;
    let blockReason: string | null = null;

    if (!settings?.enabled) {
      canBuyOnCrediario = false;
      blockReason = 'O crediário está desativado nas configurações da loja.';
    } else if (customer.creditBlocked) {
      canBuyOnCrediario = false;
      blockReason = 'Conta bloqueada manualmente para novas compras a prazo.';
    } else if (settings?.blockOverdueCustomer && overdueCount > 0) {
      canBuyOnCrediario = false;
      blockReason = `Cliente possui ${overdueCount} parcela(s) vencida(s) (${overdueAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`;
    } else if (availableCredit <= 0) {
      canBuyOnCrediario = false;
      blockReason = 'Limite de crédito esgotado.';
    }

    return {
      effectiveCreditLimit,
      customCreditLimit: customLimit,
      usedCredit,
      availableCredit,
      overdueAmount,
      overdueCount,
      openInstallmentsCount: openReceivables.length,
      nextDueDate,
      canBuyOnCrediario,
      blockReason,
    };
  }

  async listCustomers(query?: { search?: string; filter?: string }) {
    await this.requireModuleEnabled();
    const prisma = await this.getPrisma();
    return this.runWithSchemaRecovery(prisma, async () => {
      const settings = await this.getOrCreateSettings(prisma);
      const todayIso = todayIsoSaoPaulo();
      const search = query?.search?.trim();

      const customers = await prisma.customer.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { cpfCnpj: { contains: search } },
              ],
            }
          : undefined,
        include: {
          receivables: {
            where: { status: { in: ['OPEN', 'PARTIAL'] } },
            orderBy: { dueDate: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      const enriched = customers.map((c: any) => {
        const metrics = this.computeCustomerCreditMetrics(
          c,
          c.receivables || [],
          settings,
          todayIso,
        );
        const { receivables, ...rest } = c;
        return {
          ...rest,
          ...metrics,
        };
      });

      const filter = (query?.filter || 'ALL').toUpperCase();
      if (filter === 'WITH_DEBT') {
        return enriched.filter((c) => c.usedCredit > 0);
      }
      if (filter === 'OVERDUE') {
        return enriched.filter((c) => c.overdueCount > 0);
      }
      if (filter === 'BLOCKED') {
        return enriched.filter((c) => c.creditBlocked);
      }
      return enriched;
    });
  }

  async getCustomerAccount(customerId: string) {
    await this.requireModuleEnabled();
    const prisma = await this.getPrisma();
    return this.runWithSchemaRecovery(prisma, async () => {
      const settings = await this.getOrCreateSettings(prisma);
      const todayIso = todayIsoSaoPaulo();

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          receivables: {
            orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
            include: {
              sale: { select: { id: true, code: true, total: true, createdAt: true } },
              payments: {
                where: { reversedAt: null },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          receivablePayments: {
            where: { reversedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: {
              receivable: {
                select: {
                  id: true,
                  description: true,
                  installmentNumber: true,
                  totalInstallments: true,
                },
              },
            },
          },
          crediarioLogs: {
            orderBy: { createdAt: 'desc' },
            take: 25,
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Cliente não encontrado.');
      }

      const openReceivables = customer.receivables.filter(
        (r: any) => r.status === 'OPEN' || r.status === 'PARTIAL',
      );
      const metrics = this.computeCustomerCreditMetrics(
        customer,
        openReceivables,
        settings,
        todayIso,
      );

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          cpfCnpj: customer.cpfCnpj,
          address: customer.address,
          reference: customer.reference,
          creditLimit: Number(customer.creditLimit || 0),
          creditBlocked: customer.creditBlocked,
          preferredDueDay: customer.preferredDueDay,
          whatsappOptIn: customer.whatsappOptIn,
          creditNotes: customer.creditNotes,
          createdAt: customer.createdAt,
        },
        summary: metrics,
        settings: {
          enabled: settings.enabled,
          defaultCreditLimit: Number(settings.defaultCreditLimit),
          defaultDueDays: settings.defaultDueDays,
          maxInstallments: settings.maxInstallments,
          allowPartialPayment: settings.allowPartialPayment,
          blockOverdueCustomer: settings.blockOverdueCustomer,
        },
        receivables: customer.receivables,
        payments: customer.receivablePayments,
        logs: customer.crediarioLogs,
      };
    });
  }

  async updateCustomerCredit(customerId: string, body: any) {
    await this.requireModuleEnabled();
    const prisma = await this.getPrisma();
    return this.runWithSchemaRecovery(prisma, async () => {
      const existing = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!existing) throw new NotFoundException('Cliente não encontrado.');

      const data: any = {};
      if (body.name !== undefined && String(body.name).trim()) {
        data.name = String(body.name).trim();
      }
      if (body.phone !== undefined && String(body.phone).replace(/\D/g, '')) {
        data.phone = String(body.phone).replace(/\D/g, '');
      }
      if (body.cpfCnpj !== undefined) {
        data.cpfCnpj = body.cpfCnpj ? String(body.cpfCnpj).trim() : null;
      }
      if (body.address !== undefined) {
        data.address = body.address ? String(body.address).trim() : null;
      }
      if (body.creditLimit !== undefined) {
        const limit = Number(body.creditLimit);
        if (!Number.isFinite(limit) || limit < 0) {
          throw new BadRequestException('Informe um limite de crédito válido (>= 0).');
        }
        data.creditLimit = new Prisma.Decimal(limit.toFixed(2));
      }
      if (typeof body.creditBlocked === 'boolean') {
        data.creditBlocked = body.creditBlocked;
      }
      if (body.preferredDueDay !== undefined) {
        if (body.preferredDueDay === null || body.preferredDueDay === '') {
          data.preferredDueDay = null;
        } else {
          const day = Number(body.preferredDueDay);
          if (!Number.isInteger(day) || day < 1 || day > 28) {
            throw new BadRequestException(
              'O dia preferencial de vencimento deve ser entre 1 e 28.',
            );
          }
          data.preferredDueDay = day;
        }
      }
      if (typeof body.whatsappOptIn === 'boolean') {
        data.whatsappOptIn = body.whatsappOptIn;
      }
      if (body.creditNotes !== undefined) {
        data.creditNotes = body.creditNotes ? String(body.creditNotes) : null;
      }

      await prisma.customer.update({
        where: { id: customerId },
        data,
      });

      return this.getCustomerAccount(customerId);
    });
  }

  async listReceivables(query?: {
    filter?: string;
    customerId?: string;
    search?: string;
  }) {
    await this.requireModuleEnabled();
    const prisma = await this.getPrisma();
    return this.runWithSchemaRecovery(prisma, async () => {
      const todayIso = todayIsoSaoPaulo();
      const where: any = {};

      if (query?.customerId) {
        where.customerId = query.customerId;
      }
      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { description: { contains: s, mode: 'insensitive' } },
          { customer: { name: { contains: s, mode: 'insensitive' } } },
          { customer: { phone: { contains: s } } },
        ];
      }

      const filter = (query?.filter || 'OPEN_ALL').toUpperCase();
      if (filter === 'PAID') {
        where.status = 'PAID';
      } else if (filter === 'CANCELLED') {
        where.status = 'CANCELLED';
      } else if (filter !== 'ALL') {
        where.status = { in: ['OPEN', 'PARTIAL'] };
      }

      const rows = await prisma.customerReceivable.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              cpfCnpj: true,
              whatsappOptIn: true,
            },
          },
          sale: { select: { id: true, code: true, total: true, createdAt: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
        take: 400,
      });

      return rows
        .map((r: any) => {
          const dueIso = new Date(r.dueDate).toISOString().slice(0, 10);
          const daysDiff = diffDaysIso(dueIso, todayIso);
          const isOverdue =
            (r.status === 'OPEN' || r.status === 'PARTIAL') && daysDiff < 0;
          const isDueToday =
            (r.status === 'OPEN' || r.status === 'PARTIAL') && daysDiff === 0;
          return {
            ...r,
            dueIso,
            daysDiff,
            isOverdue,
            isDueToday,
          };
        })
        .filter((r: any) => {
          if (filter === 'OVERDUE') return r.isOverdue;
          if (filter === 'DUE_TODAY') return r.isDueToday;
          if (filter === 'UPCOMING_7_DAYS') {
            return (
              (r.status === 'OPEN' || r.status === 'PARTIAL') &&
              r.daysDiff >= 0 &&
              r.daysDiff <= 7
            );
          }
          return true;
        });
    });
  }

  /**
   * Chamado DENTRO da transação `prisma.$transaction` do `SalesService.checkout`
   * quando a venda possui pagamentos com `method === 'crediario'`.
   */
  async createReceivablesFromSale(
    tx: any,
    params: {
      saleId: string;
      saleCode: number;
      customerId?: string | null;
      operatorId?: string | null;
      payments: any[];
    },
  ): Promise<{ createdReceivables: any[]; totalCrediario: number }> {
    const crediarioPayments = (params.payments || []).filter(
      (p) => p.method === 'crediario',
    );
    if (crediarioPayments.length === 0) {
      return { createdReceivables: [], totalCrediario: 0 };
    }

    await this.requireModuleEnabled();

    if (!params.customerId) {
      throw new BadRequestException(
        'Selecione um cliente cadastrado para finalizar uma venda no Fiado / Crediário.',
      );
    }

    // Lock pessimista no registro do cliente para evitar estouro concorrente de limite
    await tx.$queryRaw`SELECT id FROM "customers" WHERE id = ${params.customerId} FOR UPDATE`;

    const customer = await tx.customer.findUnique({
      where: { id: params.customerId },
    });
    if (!customer) {
      throw new BadRequestException('Cliente selecionado para o crediário não foi encontrado.');
    }

    const settings = await this.getOrCreateSettings(tx);
    if (!settings.enabled) {
      throw new BadRequestException(
        'O lançamento no crediário está desativado nas configurações desta loja.',
      );
    }
    if (customer.creditBlocked) {
      throw new BadRequestException(
        `A conta do cliente "${customer.name}" está bloqueada para compras a prazo.`,
      );
    }

    const openReceivables = await tx.customerReceivable.findMany({
      where: {
        customerId: customer.id,
        status: { in: ['OPEN', 'PARTIAL'] },
      },
    });

    const todayIso = todayIsoSaoPaulo();
    const metrics = this.computeCustomerCreditMetrics(
      customer,
      openReceivables,
      settings,
      todayIso,
    );

    if (settings.blockOverdueCustomer && metrics.overdueCount > 0) {
      throw new BadRequestException(
        `O cliente "${customer.name}" possui ${metrics.overdueCount} parcela(s) vencida(s) em aberto. Regularize o débito ou desative a trava antes de vender no fiado.`,
      );
    }

    const totalCrediarioCents = crediarioPayments.reduce(
      (sum, p) => sum + toCents(p.value),
      0,
    );
    const totalCrediario = fromCents(totalCrediarioCents);

    if (totalCrediarioCents > toCents(metrics.availableCredit)) {
      throw new BadRequestException(
        `Limite de crediário insuficiente para "${customer.name}". Disponível: R$ ${metrics.availableCredit.toFixed(2)} · Solicitado no fiado: R$ ${totalCrediario.toFixed(2)}.`,
      );
    }

    const firstPayment = crediarioPayments[0];
    const requestedInstallments = Number(firstPayment.installments || 1);
    if (requestedInstallments > settings.maxInstallments) {
      throw new BadRequestException(
        `O número máximo de parcelas permitido pela loja é ${settings.maxInstallments}x.`,
      );
    }

    let firstDueDateStr: string | undefined = firstPayment.firstDueDate;
    if (!firstDueDateStr && customer.preferredDueDay) {
      const now = new Date();
      const target = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, customer.preferredDueDay, 15, 0, 0),
      );
      firstDueDateStr = target.toISOString().slice(0, 10);
    }

    const plan = splitInstallmentsInCents(
      totalCrediario,
      requestedInstallments,
      firstDueDateStr,
      settings.defaultDueDays,
    );

    const createdReceivables: any[] = [];
    for (const item of plan) {
      const rec = await tx.customerReceivable.create({
        data: {
          customerId: customer.id,
          saleId: params.saleId,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
          description:
            item.totalInstallments > 1
              ? `Venda #${params.saleCode} · Parcela ${item.installmentNumber}/${item.totalInstallments}`
              : `Venda #${params.saleCode} · Crediário`,
          originalAmount: new Prisma.Decimal(item.amount.toFixed(2)),
          paidAmount: new Prisma.Decimal(0),
          remainingAmount: new Prisma.Decimal(item.amount.toFixed(2)),
          dueDate: item.dueDate,
          status: 'OPEN',
          operatorId: params.operatorId || null,
        },
      });
      createdReceivables.push(rec);
    }

    return { createdReceivables, totalCrediario };
  }

  /**
   * Chamado no cancelamento de venda (`SalesService.cancelSale`) dentro da mesma transação.
   */
  async cancelSaleReceivables(tx: any, saleId: string): Promise<void> {
    try {
      const receivables = await tx.customerReceivable.findMany({
        where: { saleId, NOT: { status: 'CANCELLED' } },
      });
      if (!receivables.length) return;

      const hasPaidAny = receivables.some((r: any) => toCents(r.paidAmount) > 0);
      if (hasPaidAny) {
        throw new BadRequestException(
          'Esta venda possui parcelas do crediário que já receberam baixa/pagamento. Não é possível cancelar a venda sem antes estornar o recebimento.',
        );
      }

      await tx.customerReceivable.updateMany({
        where: { saleId },
        data: {
          status: 'CANCELLED',
          remainingAmount: new Prisma.Decimal(0),
        },
      });
    } catch (error: any) {
      if (['P2021', 'P2022'].includes(error?.code)) return;
      throw error;
    }
  }

  /**
   * Criação manual de conta/título avulso (ex.: migração de caderneta antiga).
   */
  async createManualReceivable(body: {
    customerId: string;
    description?: string;
    amount: number;
    installments?: number;
    firstDueDate?: string;
    notes?: string;
    sendWhatsappNotification?: boolean;
  }) {
    const { storeName } = await this.requireModuleEnabled();
    const { userId } = this.tenantContext.get();
    const prisma = await this.getPrisma();

    if (!body?.customerId) {
      throw new BadRequestException('Selecione o cliente.');
    }

    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    const settings = await this.getOrCreateSettings(prisma);
    const plan = splitInstallmentsInCents(
      body.amount,
      Number(body.installments || 1),
      body.firstDueDate,
      settings.defaultDueDays,
    );

    const baseDesc = (body.description || 'Lançamento em Conta').trim();
    const created = await prisma.$transaction(async (tx: any) => {
      const list: any[] = [];
      for (const item of plan) {
        const rec = await tx.customerReceivable.create({
          data: {
            customerId: customer.id,
            installmentNumber: item.installmentNumber,
            totalInstallments: item.totalInstallments,
            description:
              item.totalInstallments > 1
                ? `${baseDesc} (${item.installmentNumber}/${item.totalInstallments})`
                : baseDesc,
            originalAmount: new Prisma.Decimal(item.amount.toFixed(2)),
            paidAmount: new Prisma.Decimal(0),
            remainingAmount: new Prisma.Decimal(item.amount.toFixed(2)),
            dueDate: item.dueDate,
            status: 'OPEN',
            operatorId: userId || null,
            notes: body.notes || null,
          },
        });
        list.push(rec);
      }
      return list;
    });

    if (body.sendWhatsappNotification && customer.whatsappOptIn) {
      void this.notifySaleOnWhatsapp({
        customerId: customer.id,
        totalCrediario: Number(body.amount),
        installmentsCount: plan.length,
        firstDueDate: plan[0].dueDate,
        storeName,
      });
    }

    return created;
  }

  /**
   * Registra pagamento total/parcial de uma parcela específica ou amortização FIFO no saldo do cliente.
   */
  async registerPayment(body: {
    customerId: string;
    receivableId?: string;
    amount: number;
    paymentMethod?: string;
    registerInCashRegister?: boolean;
    notes?: string;
    requestKey?: string;
  }) {
    const { storeName } = await this.requireModuleEnabled();
    const { userId } = this.tenantContext.get();
    const prisma = await this.getPrisma();

    if (!body?.customerId) {
      throw new BadRequestException('Informe o cliente.');
    }

    const amountCents = toCents(body.amount);
    if (amountCents <= 0) {
      throw new BadRequestException('Informe um valor de baixa maior que zero.');
    }

    const paymentMethod = (body.paymentMethod || 'pix').toLowerCase();
    const settings = await this.getOrCreateSettings(prisma);

    const outcome = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM "customers" WHERE id = ${body.customerId} FOR UPDATE`;

      if (body.requestKey) {
        const existingPayment = await tx.customerReceivablePayment.findUnique({
          where: { requestKey: body.requestKey },
        });
        if (existingPayment) {
          return { alreadyProcessed: true, payments: [existingPayment], totalPaid: Number(existingPayment.amount) };
        }
      }

      const customer = await tx.customer.findUnique({
        where: { id: body.customerId },
      });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');

      const candidateWhere: any = {
        customerId: body.customerId,
        status: { in: ['OPEN', 'PARTIAL'] },
      };
      if (body.receivableId) {
        candidateWhere.id = body.receivableId;
      }

      const openReceivables = await tx.customerReceivable.findMany({
        where: candidateWhere,
        orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
      });

      if (openReceivables.length === 0) {
        throw new BadRequestException(
          'Nenhuma parcela em aberto encontrada para realizar a baixa.',
        );
      }

      if (
        !settings.allowPartialPayment &&
        body.receivableId &&
        amountCents < toCents(openReceivables[0].remainingAmount)
      ) {
        throw new BadRequestException(
          'Pagamentos parciais estão desabilitados nas configurações do crediário desta loja.',
        );
      }

      const allocationPlan = allocateCustomerPaymentFIFO(
        openReceivables,
        fromCents(amountCents),
      );

      let cashRegisterId: string | null = null;
      let cashMovementId: string | null = null;

      if (body.registerInCashRegister) {
        const openReg = await tx.cashRegister.findFirst({
          where: { status: 'open' },
          orderBy: { openingTime: 'desc' },
        });
        if (!openReg) {
          throw new BadRequestException(
            'Não há um caixa aberto no momento para registrar a entrada. Abra o caixa ou desmarque a opção de vincular ao caixa.',
          );
        }
        cashRegisterId = openReg.id;
        const mov = await tx.cashMovement.create({
          data: {
            cashRegisterId: openReg.id,
            type: 'IN',
            value: new Prisma.Decimal(allocationPlan.totalAllocated.toFixed(2)),
            reason: `Recebimento Crediário (${paymentMethod.toUpperCase()}) — ${customer.name}`,
          },
        });
        cashMovementId = mov.id;
      }

      const createdPayments: any[] = [];
      const now = new Date();

      for (let idx = 0; idx < allocationPlan.allocations.length; idx++) {
        const alloc = allocationPlan.allocations[idx];
        await tx.customerReceivable.update({
          where: { id: alloc.receivableId },
          data: {
            paidAmount: new Prisma.Decimal(alloc.newPaidAmount.toFixed(2)),
            remainingAmount: new Prisma.Decimal(
              alloc.newRemainingAmount.toFixed(2),
            ),
            status: alloc.newStatus,
            paidAt: alloc.newStatus === 'PAID' ? now : null,
          },
        });

        const paymentKey =
          body.requestKey && idx === 0
            ? body.requestKey
            : body.requestKey
              ? `${body.requestKey}:${idx}`
              : null;

        const paymentRecord = await tx.customerReceivablePayment.create({
          data: {
            requestKey: paymentKey,
            receivableId: alloc.receivableId,
            customerId: customer.id,
            amount: new Prisma.Decimal(alloc.allocatedAmount.toFixed(2)),
            paymentMethod,
            cashRegisterId,
            cashMovementId,
            operatorId: userId || null,
            notes: body.notes || null,
          },
        });
        createdPayments.push(paymentRecord);
      }

      const remainingAgg = await tx.customerReceivable.aggregate({
        where: {
          customerId: customer.id,
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        _sum: { remainingAmount: true },
      });

      return {
        alreadyProcessed: false,
        customer,
        payments: createdPayments,
        totalPaid: allocationPlan.totalAllocated,
        newTotalDebt: Number(remainingAgg._sum.remainingAmount || 0),
      };
    });

    if (
      !outcome.alreadyProcessed &&
      settings.sendOnPayment &&
      outcome.customer?.whatsappOptIn
    ) {
      void this.notifyPaymentOnWhatsapp({
        customer: outcome.customer,
        paidAmount: outcome.totalPaid,
        newTotalDebt: Number(outcome.newTotalDebt ?? 0),
        paymentId: outcome.payments[0]?.id,
        receivableId: outcome.payments[0]?.receivableId,
        storeName,
        settings,
      });
    }

    return outcome;
  }

  /**
   * Dispara comprovante automático no WhatsApp após uma venda no crediário (`ON_SALE`).
   */
  async notifySaleOnWhatsapp(params: {
    saleId?: string;
    saleCode?: number;
    customerId: string;
    totalCrediario: number;
    installmentsCount: number;
    firstDueDate: Date | string;
    storeName?: string;
  }): Promise<void> {
    try {
      const { tenantId, databaseUrl } = this.tenantContext.get();
      const prisma = await this.tenantManager.getTenantClient(
        tenantId,
        databaseUrl,
      );
      const settings = await this.getOrCreateSettings(prisma);
      if (!settings.sendOnSale) return;

      const customer = await prisma.customer.findUnique({
        where: { id: params.customerId },
      });
      if (!customer || !customer.whatsappOptIn || !customer.phone) return;

      const { storeName } = params.storeName
        ? { storeName: params.storeName }
        : await this.isModuleEnabledForTenant(tenantId);

      const remainingAgg = await prisma.customerReceivable.aggregate({
        where: {
          customerId: customer.id,
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        _sum: { remainingAmount: true },
      });

      const message = renderBillingTemplate(settings.templateOnSale, {
        cliente: customer.name,
        loja: storeName,
        valor: params.totalCrediario,
        vencimento: params.firstDueDate,
        parcela:
          params.installmentsCount > 1
            ? `${params.installmentsCount}x`
            : 'Parcela única',
        saldo_devedor: Number(remainingAgg._sum.remainingAmount || params.totalCrediario),
        pix: settings.pixKey,
        beneficiario_pix: settings.pixBeneficiary || storeName,
      });

      const log = await prisma.crediarioNotificationLog.create({
        data: {
          customerId: customer.id,
          saleId: params.saleId || null,
          triggerType: 'ON_SALE',
          triggerReferenceDate: params.saleId || randomUUID(),
          phone: customer.phone,
          message,
          status: 'PENDING',
        },
      });

      try {
        await this.whatsappService.sendTextMessage(
          tenantId,
          databaseUrl,
          customer.phone,
          message,
        );
        await prisma.crediarioNotificationLog.update({
          where: { id: log.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } catch (sendErr: any) {
        await prisma.crediarioNotificationLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', error: sendErr?.message || 'Erro no envio' },
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `Não foi possível enviar comprovante de crediário no WhatsApp: ${err.message}`,
      );
    }
  }

  /**
   * Dispara recibo automático no WhatsApp após pagamento/baixa (`ON_PAYMENT`).
   */
  private async notifyPaymentOnWhatsapp(params: {
    customer: any;
    paidAmount: number;
    newTotalDebt: number;
    paymentId?: string;
    receivableId?: string;
    storeName: string;
    settings: any;
  }): Promise<void> {
    try {
      const { tenantId, databaseUrl } = this.tenantContext.get();
      const prisma = await this.tenantManager.getTenantClient(
        tenantId,
        databaseUrl,
      );

      const message = renderBillingTemplate(params.settings.templateOnPayment, {
        cliente: params.customer.name,
        loja: params.storeName,
        valor: params.paidAmount,
        saldo_devedor: params.newTotalDebt,
        pix: params.settings.pixKey,
        beneficiario_pix: params.settings.pixBeneficiary || params.storeName,
      });

      const log = await prisma.crediarioNotificationLog.create({
        data: {
          customerId: params.customer.id,
          receivableId: params.receivableId || null,
          paymentId: params.paymentId || null,
          triggerType: 'ON_PAYMENT',
          triggerReferenceDate: params.paymentId || randomUUID(),
          phone: params.customer.phone,
          message,
          status: 'PENDING',
        },
      });

      try {
        await this.whatsappService.sendTextMessage(
          tenantId,
          databaseUrl,
          params.customer.phone,
          message,
        );
        await prisma.crediarioNotificationLog.update({
          where: { id: log.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } catch (sendErr: any) {
        await prisma.crediarioNotificationLog.update({
          where: { id: log.id },
          data: { status: 'FAILED', error: sendErr?.message || 'Erro no envio' },
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `Não foi possível enviar recibo de pagamento no WhatsApp: ${err.message}`,
      );
    }
  }

  /**
   * Disparo manual de cobrança/lembrete em 1 clique pelo painel do Crediário.
   */
  async sendManualReminder(receivableId: string, customMessage?: string) {
    const { storeName } = await this.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    const prisma = await this.getPrisma();

    const receivable = await prisma.customerReceivable.findUnique({
      where: { id: receivableId },
      include: { customer: true },
    });
    if (!receivable) {
      throw new NotFoundException('Parcela não encontrada.');
    }
    if (receivable.status !== 'OPEN' && receivable.status !== 'PARTIAL') {
      throw new BadRequestException('Esta parcela já está quitada ou cancelada.');
    }

    const settings = await this.getOrCreateSettings(prisma);
    const todayIso = todayIsoSaoPaulo();
    const dueIso = new Date(receivable.dueDate).toISOString().slice(0, 10);
    const daysDiff = diffDaysIso(dueIso, todayIso);

    const remainingAgg = await prisma.customerReceivable.aggregate({
      where: {
        customerId: receivable.customerId,
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      _sum: { remainingAmount: true },
    });
    const totalCustomerDebt = Number(
      remainingAgg._sum.remainingAmount || receivable.remainingAmount,
    );

    const baseTemplate =
      customMessage?.trim() ||
      (daysDiff < 0
        ? settings.templateOverdue
        : daysDiff === 0
          ? settings.templateOnDueDate
          : settings.templateBeforeDue);

    const message = renderBillingTemplate(baseTemplate, {
      cliente: receivable.customer.name,
      loja: storeName,
      valor: Number(receivable.remainingAmount),
      vencimento: receivable.dueDate,
      parcela: `${receivable.installmentNumber}/${receivable.totalInstallments}`,
      saldo_devedor: totalCustomerDebt,
      pix: settings.pixKey,
      beneficiario_pix: settings.pixBeneficiary || storeName,
    });

    const log = await prisma.crediarioNotificationLog.create({
      data: {
        customerId: receivable.customerId,
        receivableId: receivable.id,
        triggerType: 'MANUAL_REMINDER',
        triggerReferenceDate: randomUUID(),
        phone: receivable.customer.phone,
        message,
        status: 'PENDING',
      },
    });

    try {
      await this.whatsappService.sendTextMessage(
        tenantId,
        databaseUrl,
        receivable.customer.phone,
        message,
      );

      await Promise.all([
        prisma.crediarioNotificationLog.update({
          where: { id: log.id },
          data: { status: 'SENT', sentAt: new Date() },
        }),
        prisma.customerReceivable.update({
          where: { id: receivable.id },
          data: {
            lastReminderAt: new Date(),
            reminderCount: { increment: 1 },
          },
        }),
      ]);

      return {
        success: true,
        phone: receivable.customer.phone,
        message,
      };
    } catch (err: any) {
      await prisma.crediarioNotificationLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', error: err?.message || 'Falha no envio' },
      });
      throw err;
    }
  }

  async getLogs(limit = 50) {
    await this.requireModuleEnabled();
    const prisma = await this.getPrisma();
    return this.runWithSchemaRecovery(prisma, () =>
      prisma.crediarioNotificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(200, Math.max(1, Number(limit) || 50)),
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          receivable: {
            select: {
              id: true,
              description: true,
              installmentNumber: true,
              totalInstallments: true,
              dueDate: true,
            },
          },
        },
      }),
    );
  }

  async getWhatsappStatus() {
    await this.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.whatsappService.getStatus(tenantId, databaseUrl);
  }

  async connectWhatsapp(resetSession = false) {
    await this.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.whatsappService.connect(tenantId, databaseUrl, resetSession);
  }

  async disconnectWhatsapp() {
    await this.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.whatsappService.disconnect(tenantId, databaseUrl);
  }

  async sendTestWhatsapp(phone: string, message?: string) {
    const { storeName } = await this.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    const text =
      message?.trim() ||
      `✅ Teste de conexão do *PDV Lojista* (${storeName}): o envio automático de cobranças do Crediário via WhatsApp (Baileys) está ativo e funcionando!`;
    const res = await this.whatsappService.sendTextMessage(
      tenantId,
      databaseUrl,
      phone,
      text,
    );
    return {
      success: true,
      ...res,
    };
  }
}
