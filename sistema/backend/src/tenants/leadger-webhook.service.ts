import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { DEMO_LEGACY_DB_NAMES } from './demo-store.seed';

export type LeadgerEventType =
  | 'base.upsert'
  | 'invoice.upsert'
  | 'client.upsert'
  | 'lead.demo_accessed';
export type LeadgerPaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'bank_transfer' | 'cash';

export interface LeadgerValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class LeadgerWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadgerWebhookService.name);
  private outboxTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessingOutbox = false;

  constructor(private readonly heartPrisma: HeartPrismaService) {}

  onModuleInit() {
    this.outboxTimer = setInterval(async () => {
      if (this.isProcessingOutbox) return;
      const cfg = this.getLeadgerConfig();
      if (!cfg.configured) return;
      this.isProcessingOutbox = true;
      try {
        await this.dispatchDueOutboxEvents(10);
      } catch (err: any) {
        this.logger.warn(`Erro no processamento periódico do Outbox Leadger: ${err.message}`);
      } finally {
        this.isProcessingOutbox = false;
      }
    }, 60_000);
    if (this.outboxTimer && typeof this.outboxTimer.unref === 'function') {
      this.outboxTimer.unref();
    }
  }

  onModuleDestroy() {
    if (this.outboxTimer) {
      clearInterval(this.outboxTimer);
      this.outboxTimer = null;
    }
  }

  getLeadgerConfig() {
    const source = (process.env.LEADGER_SOURCE || 'pdv_lojista').trim();
    const baseUrl = (process.env.LEADGER_WEBHOOK_URL || '').trim();
    const secret = (process.env.LEADGER_WEBHOOK_SECRET || '').trim();
    const publicBaseUrl = (
      process.env.PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://pdv-lojista-production.up.railway.app'
    )
      .trim()
      .replace(/\/+$/, '');

    const endpointUrl = baseUrl
      ? baseUrl.includes('/api/webhooks/inbound/')
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, '')}/api/webhooks/inbound/${source}`
      : `https://leadger.teltech.com.br/api/webhooks/inbound/${source}`;

    return {
      source,
      endpointUrl,
      secret,
      publicBaseUrl,
      configured: Boolean(secret && secret.length >= 32),
      secretTooShort: Boolean(secret && secret.length > 0 && secret.length < 32),
    };
  }

  signLeadgerPayload(secret: string, timestamp: string, source: string, rawBodyUtf8: string): string {
    const signingInput = `${timestamp}.${source}.${rawBodyUtf8}`;
    return crypto.createHmac('sha256', secret).update(signingInput, 'utf8').digest('hex');
  }

  signPublicLogoToken(tenantId: string, version: number): string {
    const { secret } = this.getLeadgerConfig();
    const key = secret || process.env.JWT_SECRET || 'pdv-lojista-logo-signing-key';
    return crypto
      .createHmac('sha256', key)
      .update(`logo:${tenantId}:v${version}`, 'utf8')
      .digest('hex')
      .slice(0, 32);
  }

  verifyPublicLogoToken(tenantId: string, version: number, token: string): boolean {
    if (!token) return false;
    const expected = this.signPublicLogoToken(tenantId, version);
    if (expected.length !== token.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
    } catch {
      return false;
    }
  }

  buildPublicLogoUrl(tenant: { id: string; logoUrl?: string | null; clientVersion?: number | null }): string | undefined {
    if (!tenant.logoUrl) return undefined;
    const { publicBaseUrl } = this.getLeadgerConfig();
    if (tenant.logoUrl.startsWith('http://') || tenant.logoUrl.startsWith('https://')) {
      return tenant.logoUrl;
    }
    const pathPart = tenant.logoUrl.startsWith('/') ? tenant.logoUrl : `/${tenant.logoUrl}`;
    return `${publicBaseUrl}${pathPart}`;
  }

  normalizeCnpjOrCpf(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11 || digits.length === 14) return digits;
    return digits.length > 0 ? digits : undefined;
  }

  normalizeE164Phone(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    const trimmed = String(raw).trim();
    if (!trimmed) return undefined;
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return undefined;
    if (trimmed.startsWith('+')) return `+${digits}`;
    if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
    return `+${digits}`;
  }

  toBrlCents(value?: any): number {
    if (value == null) return 0;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.round(num * 100);
  }

  toIsoDateOnly(dateInput?: Date | string | null): string | undefined {
    if (!dateInput) return undefined;
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  }

  toReferenceMonth(dateInput?: Date | string | null): string {
    const iso = this.toIsoDateOnly(dateInput);
    if (iso) return iso.slice(0, 7);
    return new Date().toISOString().slice(0, 7);
  }

  mapTenantStatusToLeadger(status?: string | null): 'active' | 'paused' | 'cancelled' {
    const s = (status || 'active').toLowerCase();
    if (s === 'active') return 'active';
    if (s === 'suspended' || s === 'paused' || s === 'blocked') return 'paused';
    if (s === 'canceled' || s === 'cancelled' || s === 'deleted' || s === 'inactive') return 'cancelled';
    return 'active';
  }

  mapPaymentMethodToLeadger(method?: string | null): LeadgerPaymentMethod | undefined {
    if (!method) return undefined;
    const m = method.toLowerCase().trim();
    if (m === 'pix') return 'pix';
    if (m === 'boleto') return 'boleto';
    if (m === 'credit_card' || m === 'cartao' || m === 'cartão') return 'credit_card';
    if (m === 'bank_transfer' || m === 'ted' || m === 'transferencia' || m === 'transferência') return 'bank_transfer';
    if (m === 'cash' || m === 'dinheiro' || m === 'especie' || m === 'espécie') return 'cash';
    return 'pix';
  }

  async ensureTenantExternalIds(tenantId: string) {
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true, name: true },
        },
      },
    });
    if (!tenant) throw new Error(`Tenant ${tenantId} não encontrado no Heart.`);

    const needsClientExt = !tenant.clientExternalId;
    const needsBaseExt = !tenant.baseExternalId;

    if (needsClientExt || needsBaseExt) {
      return await this.heartPrisma.tenant.update({
        where: { id: tenantId },
        data: {
          clientExternalId: tenant.clientExternalId || `cli-${tenant.id}`,
          baseExternalId: tenant.baseExternalId || `base-${tenant.id}`,
        },
        include: {
          users: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { email: true, name: true },
          },
        },
      });
    }

    return tenant;
  }

  buildClientObject(tenant: any) {
    const rawEmail = (tenant.emailContato || tenant.emailContador || tenant.users?.[0]?.email || '').trim();
    const validEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail.slice(0, 254) : null;
    const document = this.normalizeCnpjOrCpf(tenant.cnpj) || null;
    const phone = this.normalizeE164Phone(tenant.telefoneContato || tenant.telefone) || null;

    const addressParts = [
      tenant.logradouro,
      tenant.numero,
      tenant.bairro,
      tenant.municipio,
      tenant.uf,
    ].filter(Boolean);

    const extraNotes = [
      tenant.nomeFantasia && tenant.razaoSocial && tenant.nomeFantasia !== tenant.razaoSocial
        ? `Fantasia: ${tenant.nomeFantasia}`
        : null,
      addressParts.length > 0 ? `Endereço: ${addressParts.join(', ')}` : null,
      tenant.observacoes ? String(tenant.observacoes).trim() : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      externalId: tenant.clientExternalId || `cli-${tenant.id}`,
      version: Math.max(1, Number(tenant.clientVersion || 1)),
      name: (tenant.razaoSocial || tenant.nomeFantasia || tenant.name || 'Cliente PDV Lojista').trim().slice(0, 200),
      document,
      email: validEmail,
      phone,
      status: (tenant.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
      notes: extraNotes ? extraNotes.slice(0, 2000) : null,
    };
  }

  buildBaseObject(tenant: any) {
    const dueDateIso = this.toIsoDateOnly(tenant.mensalidadeVencimento);
    const billingDay = dueDateIso ? Math.min(31, Math.max(1, Number(dueDateIso.split('-')[2]))) : 10;
    const startDate = this.toIsoDateOnly(tenant.createdAt) || new Date().toISOString().slice(0, 10);
    const candidateEffective = dueDateIso || startDate;
    const effectiveDate = candidateEffective >= startDate ? candidateEffective : startDate;

    return {
      externalId: tenant.baseExternalId || `base-${tenant.id}`,
      version: Math.max(1, Number(tenant.baseVersion || 1)),
      name: `${(tenant.nomeFantasia || tenant.name || 'PDV Lojista').trim()} - Mensalidade PDV Lojista`.slice(0, 200),
      monthlyAmount: this.toBrlCents(tenant.mensalidadeValor),
      billingDay,
      startDate,
      endDate: null,
      effectiveDate,
      status: this.mapTenantStatusToLeadger(tenant.status),
    };
  }

  buildInvoiceObject(invoice: any) {
    const status = (invoice.status || 'pending') as 'pending' | 'paid' | 'cancelled';
    const isPaid = status === 'paid';
    return {
      externalId: invoice.externalId,
      version: Math.max(1, Number(invoice.version || 1)),
      description: String(invoice.description || `Mensalidade ${invoice.referenceMonth}`).trim().slice(0, 300),
      amount: Number(invoice.amount || 0),
      dueDate: this.toIsoDateOnly(invoice.dueDate) || new Date().toISOString().slice(0, 10),
      referenceMonth: invoice.referenceMonth,
      status,
      paidAt: isPaid ? (invoice.paidAt ? new Date(invoice.paidAt).toISOString() : new Date().toISOString()) : null,
      paymentMethod: isPaid ? (this.mapPaymentMethodToLeadger(invoice.paymentMethod || 'pix') || 'pix') : null,
    };
  }

  buildTenantEventData(eventType: LeadgerEventType, tenant: any, invoice?: any): Record<string, any> {
    if (eventType === 'client.upsert') {
      return this.buildClientObject(tenant);
    }
    if (eventType === 'invoice.upsert') {
      return {
        baseExternalId: tenant.baseExternalId || `base-${tenant.id}`,
        invoice: invoice ? this.buildInvoiceObject(invoice) : undefined,
      };
    }
    const invoices =
      invoice && Number(invoice.amount || 0) > 0 ? [this.buildInvoiceObject(invoice)] : [];
    return {
      client: this.buildClientObject(tenant),
      base: this.buildBaseObject(tenant),
      invoices,
    };
  }

  validateLeadgerEnvelope(eventType: LeadgerEventType, data: Record<string, any>): LeadgerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (eventType === 'lead.demo_accessed') {
      if (!data.externalId) errors.push('`externalId` do lead é obrigatório.');
      if (!data.name || String(data.name).trim().length < 1) errors.push('`name` do lead é obrigatório.');
      const phoneDigits = String(data.phone || '').replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        errors.push('`phone` do lead deve conter DDD + número válido.');
      }
      return { valid: errors.length === 0, errors, warnings };
    }

    if (eventType === 'invoice.upsert') {
      if (!data.baseExternalId) {
        errors.push('`data.baseExternalId` é obrigatório em `invoice.upsert`.');
      }
      const inv = data.invoice;
      if (!inv) {
        errors.push('Objeto `data.invoice` é obrigatório em `invoice.upsert`.');
      } else {
        if (!inv.externalId) errors.push('`invoice.externalId` é obrigatório.');
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(inv.referenceMonth || ''))) {
          errors.push('`invoice.referenceMonth` deve estar no formato YYYY-MM.');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inv.dueDate || ''))) {
          errors.push('`invoice.dueDate` deve estar no formato YYYY-MM-DD.');
        }
        if (typeof inv.amount !== 'number' || !Number.isInteger(inv.amount) || inv.amount <= 0) {
          errors.push('`invoice.amount` deve ser inteiro positivo em centavos (> 0).');
        }
        if (!['pending', 'paid', 'cancelled'].includes(inv.status)) {
          errors.push('`invoice.status` deve ser `pending`, `paid` ou `cancelled`.');
        }
        if (inv.status === 'paid' && !inv.paidAt) {
          errors.push('`invoice.paidAt` (ISO-8601) é obrigatório quando `status === "paid"`.');
        }
      }
      return { valid: errors.length === 0, errors, warnings };
    }

    const client = eventType === 'client.upsert' ? data : data.client;
    if (!client) {
      errors.push('Objeto de cliente ausente no payload.');
    } else {
      if (!client.externalId) errors.push('`client.externalId` é obrigatório.');
      if (!client.name) errors.push('`client.name` é obrigatório.');
      if (!client.document && !client.email) {
        warnings.push(
          'Cliente sem CNPJ/CPF (`document`) e sem `email`: o Leadger criará um novo cadastro sem conseguir conciliar por documento/e-mail.'
        );
      }
      if (client.document && ![11, 14].includes(String(client.document).length)) {
        errors.push(`\`client.document\` deve conter 11 (CPF) ou 14 (CNPJ) dígitos (atual: "${client.document}").`);
      }
    }

    if (eventType === 'base.upsert') {
      const base = data.base;
      if (!base) {
        errors.push('Objeto `data.base` é obrigatório.');
      } else {
        if (!base.externalId) errors.push('`base.externalId` é obrigatório.');
        if (typeof base.monthlyAmount !== 'number' || !Number.isInteger(base.monthlyAmount) || base.monthlyAmount <= 0) {
          errors.push('`base.monthlyAmount` deve ser inteiro positivo em centavos (> 0). Defina o valor da mensalidade.');
        }
        if (typeof base.billingDay !== 'number' || base.billingDay < 1 || base.billingDay > 31) {
          errors.push('`base.billingDay` deve estar entre 1 e 31.');
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private getBackoffDelayMs(attempts: number): number {
    const scheduleMinutes = [1, 2, 5, 15, 30, 60, 120, 240, 360, 720, 1440];
    const idx = Math.min(Math.max(0, attempts - 1), scheduleMinutes.length - 1);
    return scheduleMinutes[idx] * 60 * 1000;
  }

  async deliverOutboxItem(outboxId: string) {
    const item = await this.heartPrisma.webhookOutbox.findUnique({ where: { id: outboxId } });
    if (!item) return { delivered: false, error: 'Registro Outbox não encontrado.' };
    if (item.status === 'delivered') {
      return { delivered: true, statusCode: item.lastStatusCode || 200, alreadyDelivered: true };
    }

    const config = this.getLeadgerConfig();
    if (!config.configured) {
      const msg = config.secretTooShort
        ? 'LEADGER_WEBHOOK_SECRET muito curto (o Teltech Leadger exige mínimo de 32 caracteres). Evento mantido na fila.'
        : 'LEADGER_WEBHOOK_SECRET não configurado (mínimo 32 caracteres). Evento mantido na fila.';
      await this.heartPrisma.webhookOutbox.update({
        where: { id: outboxId },
        data: {
          status: 'retry_scheduled',
          lastError: msg,
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      return { delivered: false, queued: true, error: msg };
    }

    const envelope = item.payload as Record<string, any>;
    const rawBodyUtf8 = JSON.stringify(envelope);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.signLeadgerPayload(config.secret, timestamp, config.source, rawBodyUtf8);

    const attemptNumber = item.attempts + 1;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Leadger-Timestamp': timestamp,
          'X-Leadger-Signature': `sha256=${signature}`,
          'X-Webhook-Source': config.source,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Idempotency-Key': item.eventId,
        },
        body: rawBodyUtf8,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const responseText = await res.text();

      if (res.status >= 200 && res.status < 300) {
        await this.heartPrisma.webhookOutbox.update({
          where: { id: outboxId },
          data: {
            status: 'delivered',
            attempts: attemptNumber,
            lastStatusCode: res.status,
            lastResponse: responseText.slice(0, 4000),
            lastError: null,
            deliveredAt: new Date(),
          },
        });
        return {
          delivered: true,
          statusCode: res.status,
          response: responseText,
        };
      }

      const isPermanentClientError = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
      const exhausted = attemptNumber >= item.maxAttempts;
      const nextStatus = isPermanentClientError ? 'blocked' : exhausted ? 'failed' : 'retry_scheduled';

      await this.heartPrisma.webhookOutbox.update({
        where: { id: outboxId },
        data: {
          status: nextStatus,
          attempts: attemptNumber,
          lastStatusCode: res.status,
          lastResponse: responseText.slice(0, 4000),
          lastError: `HTTP ${res.status}: ${responseText.slice(0, 500)}`,
          nextRetryAt: new Date(Date.now() + this.getBackoffDelayMs(attemptNumber)),
        },
      });

      return {
        delivered: false,
        status: nextStatus,
        statusCode: res.status,
        error: `HTTP ${res.status}: ${responseText.slice(0, 300)}`,
      };
    } catch (err: any) {
      const exhausted = attemptNumber >= item.maxAttempts;
      const nextStatus = exhausted ? 'failed' : 'retry_scheduled';
      const errorMsg = err?.name === 'AbortError' ? 'Timeout (12s) ao conectar no Leadger' : err?.message || 'Erro de rede';

      await this.heartPrisma.webhookOutbox.update({
        where: { id: outboxId },
        data: {
          status: nextStatus,
          attempts: attemptNumber,
          lastError: errorMsg,
          nextRetryAt: new Date(Date.now() + this.getBackoffDelayMs(attemptNumber)),
        },
      });

      return {
        delivered: false,
        status: nextStatus,
        error: errorMsg,
      };
    }
  }

  async enqueueAndDeliverLeadgerEvent(params: {
    eventType: LeadgerEventType;
    tenantId: string;
    invoiceId?: string;
    bumpClientVersion?: boolean;
    bumpBaseVersion?: boolean;
    bumpInvoiceVersion?: boolean;
    awaitDelivery?: boolean;
  }) {
    let tenant = await this.ensureTenantExternalIds(params.tenantId);

    if (params.bumpClientVersion || params.bumpBaseVersion) {
      tenant = await this.heartPrisma.tenant.update({
        where: { id: params.tenantId },
        data: {
          clientVersion: params.bumpClientVersion ? { increment: 1 } : undefined,
          baseVersion: params.bumpBaseVersion ? { increment: 1 } : undefined,
        },
        include: {
          users: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { email: true, name: true },
          },
        },
      });
    }

    let invoice: any = null;
    if (params.invoiceId) {
      invoice = params.bumpInvoiceVersion
        ? await this.heartPrisma.tenantInvoice.update({
            where: { id: params.invoiceId },
            data: { version: { increment: 1 } },
          })
        : await this.heartPrisma.tenantInvoice.findUnique({
            where: { id: params.invoiceId },
          });
    } else if (params.eventType === 'base.upsert' || params.eventType === 'invoice.upsert') {
      invoice = await this.heartPrisma.tenantInvoice.findFirst({
        where: { tenantId: params.tenantId },
        orderBy: { dueDate: 'desc' },
      });
    }

    const dataObj = this.buildTenantEventData(params.eventType, tenant, invoice);

    const validation = this.validateLeadgerEnvelope(params.eventType, dataObj);
    const eventId = `evt_${crypto.randomUUID()}`;
    const envelope = {
      schemaVersion: 1 as const,
      eventId,
      eventType: params.eventType,
      occurredAt: new Date().toISOString(),
      data: dataObj,
    };

    const outbox = await this.heartPrisma.webhookOutbox.create({
      data: {
        eventId,
        eventType: params.eventType,
        tenantId: tenant.id,
        invoiceId: invoice?.id || null,
        payload: envelope,
        status: validation.valid ? 'pending' : 'blocked',
        lastError: validation.valid ? null : `Bloqueado antes do envio: ${validation.errors.join(' | ')}`,
      },
    });

    if (!validation.valid) {
      return {
        outboxId: outbox.id,
        eventId,
        valid: false,
        errors: validation.errors,
        warnings: validation.warnings,
        delivered: false,
      };
    }

    if (params.awaitDelivery !== false) {
      const delivery = await this.deliverOutboxItem(outbox.id);
      return {
        outboxId: outbox.id,
        eventId,
        valid: true,
        warnings: validation.warnings,
        ...delivery,
      };
    } else {
      this.deliverOutboxItem(outbox.id).catch((e) => {
        this.logger.error(`[LeadgerOutbox] Erro assíncrono em ${outbox.id}: ${e?.message}`);
      });
      return {
        outboxId: outbox.id,
        eventId,
        valid: true,
        warnings: validation.warnings,
        queued: true,
      };
    }
  }

  async dispatchDueOutboxEvents(limit = 25) {
    const now = new Date();
    const dueItems = await this.heartPrisma.webhookOutbox.findMany({
      where: {
        status: { in: ['pending', 'retry_scheduled'] },
        nextRetryAt: { lte: now },
      },
      orderBy: { nextRetryAt: 'asc' },
      take: limit,
    });

    const results: any[] = [];
    for (const item of dueItems) {
      const res = await this.deliverOutboxItem(item.id);
      results.push({ id: item.id, eventId: item.eventId, eventType: item.eventType, ...res });
    }

    return {
      processed: results.length,
      delivered: results.filter((r: any) => r.delivered).length,
      results,
    };
  }

  async rebuildAndDeliverOutboxItem(outboxId: string) {
    const item = await this.heartPrisma.webhookOutbox.findUnique({ where: { id: outboxId } });
    if (!item) return { delivered: false, error: 'Registro Outbox não encontrado.' };

    const eventType = item.eventType as LeadgerEventType;

    if (!item.tenantId) {
      if (eventType === 'lead.demo_accessed') {
        const prevPayload = (item.payload || {}) as Record<string, any>;
        const extId = String(prevPayload?.data?.externalId || '');
        const leadId = extId.startsWith('lead-') ? extId.slice(5) : '';
        if (leadId) {
          const lead = await this.heartPrisma.lead.findUnique({ where: { id: leadId } });
          if (lead) {
            return await this.enqueueDemoLeadEvent(lead, {
              isFirstAccess: (lead.accessCount || 1) <= 1,
              awaitDelivery: true,
            });
          }
        }
      }
      return { delivered: false, error: 'Evento não possui tenantId vinculado para reconstrução.' };
    }

    const tenant = await this.ensureTenantExternalIds(item.tenantId);

    let invoice: any = null;
    if (item.invoiceId) {
      invoice = await this.heartPrisma.tenantInvoice.findUnique({ where: { id: item.invoiceId } });
    } else if (eventType === 'base.upsert' || eventType === 'invoice.upsert') {
      invoice = await this.heartPrisma.tenantInvoice.findFirst({
        where: { tenantId: item.tenantId },
        orderBy: { dueDate: 'desc' },
      });
    }

    const dataObj = this.buildTenantEventData(eventType, tenant, invoice);

    const validation = this.validateLeadgerEnvelope(eventType, dataObj);
    const rebuiltEnvelope = {
      schemaVersion: 1 as const,
      eventId: item.eventId,
      eventType,
      occurredAt: new Date().toISOString(),
      data: dataObj,
    };

    if (!validation.valid) {
      await this.heartPrisma.webhookOutbox.update({
        where: { id: outboxId },
        data: {
          payload: rebuiltEnvelope,
          status: 'blocked',
          lastError: `Bloqueado após reconstrução: ${validation.errors.join(' | ')}`,
        },
      });
      return {
        delivered: false,
        valid: false,
        errors: validation.errors,
        warnings: validation.warnings,
        error: `Dados ainda incompletos: ${validation.errors.join(' | ')}`,
      };
    }

    await this.heartPrisma.webhookOutbox.update({
      where: { id: outboxId },
      data: {
        payload: rebuiltEnvelope,
        status: 'pending',
        lastError: null,
        nextRetryAt: new Date(),
      },
    });

    const delivery = await this.deliverOutboxItem(outboxId);
    return {
      valid: true,
      warnings: validation.warnings,
      ...delivery,
    };
  }

  async enqueueDemoLeadEvent(
    lead: {
      id: string;
      name: string;
      whatsapp: string;
      accessCount?: number | null;
      notes?: string | null;
    },
    opts?: {
      isFirstAccess?: boolean;
      previousAccessAt?: Date | string | null;
      awaitDelivery?: boolean;
    },
  ) {
    const prevCount = await this.heartPrisma.webhookOutbox.count({
      where: {
        eventType: 'lead.demo_accessed',
        eventId: { startsWith: `evt_lead_${lead.id}_` },
      },
    });

    const accessCount = Math.max(1, Number(lead.accessCount || 1));
    const version = Math.max(accessCount, prevCount + 1);
    const cleanDigits = String(lead.whatsapp || '').replace(/\D/g, '');
    const phone =
      this.normalizeE164Phone(lead.whatsapp) ||
      (cleanDigits.startsWith('55') ? `+${cleanDigits}` : `+55${cleanDigits}`);

    let previousAccessIso: string | null = null;
    if (opts?.previousAccessAt) {
      const parsed = new Date(opts.previousAccessAt);
      if (!isNaN(parsed.getTime())) {
        previousAccessIso = parsed.toISOString();
      }
    }

    const dataObj = {
      externalId: `lead-${lead.id}`,
      version,
      name: String(lead.name || 'Visitante Demo').trim().slice(0, 200),
      phone,
      email: null,
      accessCount,
      isFirstAccess: opts?.isFirstAccess ?? accessCount <= 1,
      previousAccessAt: previousAccessIso,
      sourceLabel: 'PDV Lojista',
      notes: lead.notes ? String(lead.notes).trim().slice(0, 2000) : null,
    };

    const validation = this.validateLeadgerEnvelope('lead.demo_accessed', dataObj);
    const shortRand = crypto.randomBytes(3).toString('hex');
    const eventId = `evt_lead_${lead.id}_v${version}_${shortRand}`;
    const envelope = {
      schemaVersion: 1 as const,
      eventId,
      eventType: 'lead.demo_accessed' as const,
      occurredAt: new Date().toISOString(),
      data: dataObj,
    };

    const outbox = await this.heartPrisma.webhookOutbox.create({
      data: {
        eventId,
        eventType: 'lead.demo_accessed',
        tenantId: null,
        invoiceId: null,
        payload: envelope,
        status: validation.valid ? 'pending' : 'blocked',
        lastError: validation.valid
          ? null
          : `Bloqueado antes do envio: ${validation.errors.join(' | ')}`,
      },
    });

    if (!validation.valid) {
      return {
        outboxId: outbox.id,
        eventId,
        valid: false,
        errors: validation.errors,
        delivered: false,
      };
    }

    if (opts?.awaitDelivery !== false) {
      const delivery = await this.deliverOutboxItem(outbox.id);
      return {
        outboxId: outbox.id,
        eventId,
        valid: true,
        ...delivery,
      };
    }

    this.deliverOutboxItem(outbox.id).catch((e) => {
      this.logger.warn(`[LeadgerOutbox] Falha assíncrona ao enviar lead demo ${lead.id}: ${e?.message}`);
    });

    return {
      outboxId: outbox.id,
      eventId,
      valid: true,
      queued: true,
    };
  }

  private canonicalBrDigits(raw?: string | null): string {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      digits = digits.slice(2);
    }
    if (digits.length === 11 && digits[2] === '9') {
      return digits.slice(0, 2) + digits.slice(3);
    }
    return digits;
  }

  async getDemoLeadsLeadgerSummary(leads: Array<{ id: string; whatsapp: string }>) {
    const config = this.getLeadgerConfig();
    const outboxRows = await this.heartPrisma.webhookOutbox.findMany({
      where: { eventType: 'lead.demo_accessed' },
      orderBy: { createdAt: 'desc' },
      take: 400,
      select: {
        id: true,
        eventId: true,
        status: true,
        lastError: true,
        deliveredAt: true,
        createdAt: true,
        payload: true,
      },
    });

    const latestOutboxByExternalId = new Map<string, any>();
    for (const row of outboxRows) {
      const payload = (row.payload || {}) as Record<string, any>;
      const extId = String(payload?.data?.externalId || '');
      if (extId && !latestOutboxByExternalId.has(extId)) {
        latestOutboxByExternalId.set(extId, row);
      }
    }

    let remoteOnline = false;
    let remoteStats: any = null;
    const remoteByExtId = new Map<string, any>();
    const remoteByCanonicalPhone = new Map<string, any>();

    if (config.configured && leads.length > 0) {
      try {
        const summaryUrl = `${config.endpointUrl.replace(/\/+$/, '')}/leads-summary`;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.signLeadgerPayload(config.secret, timestamp, config.source, '');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(summaryUrl, {
          method: 'GET',
          headers: {
            'X-Leadger-Timestamp': timestamp,
            'X-Leadger-Signature': `sha256=${signature}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const json: any = await res.json();
          remoteOnline = true;
          remoteStats = json?.stats || null;
          const remoteLeads = Array.isArray(json?.leads) ? json.leads : [];
          for (const rl of remoteLeads) {
            if (rl?.externalId) {
              remoteByExtId.set(String(rl.externalId), rl);
            }
            const canon = this.canonicalBrDigits(rl?.phoneNormalized || rl?.phone);
            if (canon && !remoteByCanonicalPhone.has(canon)) {
              remoteByCanonicalPhone.set(canon, rl);
            }
          }
        }
      } catch (err: any) {
        this.logger.debug(
          `[LeadgerSummary] Não foi possível consultar resumo remoto no Leadger: ${err?.message}`,
        );
      }
    }

    const byLeadId: Record<string, any> = {};
    for (const lead of leads) {
      const extId = `lead-${lead.id}`;
      const localOutbox = latestOutboxByExternalId.get(extId) || null;
      const remote =
        remoteByExtId.get(extId) ||
        remoteByCanonicalPhone.get(this.canonicalBrDigits(lead.whatsapp)) ||
        null;

      byLeadId[lead.id] = {
        synced: Boolean(remote || localOutbox?.status === 'delivered'),
        outboxStatus: localOutbox?.status || null,
        outboxDeliveredAt: localOutbox?.deliveredAt
          ? new Date(localOutbox.deliveredAt).toISOString()
          : null,
        outboxError: localOutbox?.lastError || null,
        cadenceStatus: remote?.status || null,
        pauseReason: remote?.pauseReason || null,
        sentCount: Number(remote?.sentCount ?? 0),
        totalSteps: Number(remote?.totalSteps ?? 7),
        nextStepOrder: remote?.nextStepOrder ?? null,
        nextStepAt: remote?.nextStepAt || null,
        lastSentAt: remote?.lastSentAt || null,
        repliedAt: remote?.repliedAt || null,
      };
    }

    return {
      configured: config.configured,
      secretTooShort: config.secretTooShort,
      source: config.source,
      endpointUrl: config.endpointUrl,
      remoteOnline,
      remoteStats,
      byLeadId,
    };
  }

  async ensureCurrentInvoiceForTenant(
    tenantId: string,
    override?: {
      referenceMonth?: string;
      dueDate?: Date | string;
      amountCents?: number;
      status?: 'pending' | 'paid' | 'cancelled';
      paidAt?: Date | null;
      paymentMethod?: LeadgerPaymentMethod | null;
      description?: string;
      notes?: string;
    }
  ) {
    const tenant = await this.ensureTenantExternalIds(tenantId);
    const dueDate = override?.dueDate
      ? new Date(override.dueDate)
      : tenant.mensalidadeVencimento
      ? new Date(tenant.mensalidadeVencimento)
      : new Date();

    const refMonth = override?.referenceMonth || this.toReferenceMonth(dueDate);
    const amountCents =
      override?.amountCents !== undefined ? override.amountCents : this.toBrlCents(tenant.mensalidadeValor);

    const externalId = `inv-${tenant.id}-${refMonth}`;

    const existing = await this.heartPrisma.tenantInvoice.findUnique({
      where: {
        tenantId_referenceMonth: {
          tenantId: tenant.id,
          referenceMonth: refMonth,
        },
      },
    });

    if (existing) {
      return await this.heartPrisma.tenantInvoice.update({
        where: { id: existing.id },
        data: {
          dueDate,
          amount: amountCents > 0 ? amountCents : existing.amount,
          status: override?.status ?? existing.status,
          paidAt: override?.paidAt !== undefined ? override.paidAt : existing.paidAt,
          paymentMethod: override?.paymentMethod !== undefined ? override.paymentMethod : existing.paymentMethod,
          description: override?.description ?? existing.description ?? `Mensalidade ${refMonth}`,
          notes: override?.notes !== undefined ? override.notes : existing.notes,
          version: { increment: 1 },
        },
      });
    }

    return await this.heartPrisma.tenantInvoice.create({
      data: {
        externalId,
        tenantId: tenant.id,
        referenceMonth: refMonth,
        dueDate,
        amount: amountCents,
        status: override?.status || 'pending',
        paidAt: override?.paidAt || null,
        paymentMethod: override?.paymentMethod || null,
        description: override?.description || `Mensalidade ${refMonth}`,
        notes: override?.notes || null,
        version: 1,
      },
    });
  }

  async getLeadgerPanelStatus(tenantId?: string, statusFilter?: string, limit = 50) {
    const config = this.getLeadgerConfig();
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (statusFilter && statusFilter !== 'all') where.status = statusFilter;

    const [events, countsRaw, tenants] = await Promise.all([
      this.heartPrisma.webhookOutbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(200, Math.max(1, limit)),
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              nomeFantasia: true,
              cnpj: true,
              clientExternalId: true,
              baseExternalId: true,
              clientVersion: true,
              baseVersion: true,
            },
          },
        },
      }),
      this.heartPrisma.webhookOutbox.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.heartPrisma.tenant.findMany({
        where: { databaseName: { notIn: DEMO_LEGACY_DB_NAMES } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          nomeFantasia: true,
          razaoSocial: true,
          cnpj: true,
          emailContato: true,
          emailContador: true,
          telefone: true,
          telefoneContato: true,
          mensalidadeValor: true,
          mensalidadeVencimento: true,
          status: true,
          clientExternalId: true,
          baseExternalId: true,
          clientVersion: true,
          baseVersion: true,
          leadgerSyncEnabled: true,
          _count: { select: { invoices: true, webhookOutboxEvents: true } },
        },
      }),
    ]);

    const counts: Record<string, number> = {
      pending: 0,
      delivering: 0,
      delivered: 0,
      retry_scheduled: 0,
      failed: 0,
      blocked: 0,
    };
    for (const c of countsRaw) {
      counts[c.status] = c._count._all;
    }

    return {
      config: {
        source: config.source,
        endpointUrl: config.endpointUrl,
        publicBaseUrl: config.publicBaseUrl,
        configured: config.configured,
        secretTooShort: config.secretTooShort,
        secretPreview: config.secret
          ? `${config.secret.slice(0, 4)}••••••${config.secret.slice(-4)}`
          : null,
      },
      counts,
      tenants: tenants.map((t: any) => ({
        ...t,
        emailContato: t.emailContato || t.emailContador || null,
        telefone: t.telefoneContato || t.telefone || null,
      })),
      events,
    };
  }

  async handleLeadgerPanelAction(body: any) {
    const action = body?.action;

    if (action === 'dispatch_due') {
      return await this.dispatchDueOutboxEvents(Number(body?.limit || 30));
    }

    if (action === 'retry_event') {
      const outboxId = body?.outboxId;
      if (!outboxId) throw new Error('outboxId é obrigatório.');
      await this.heartPrisma.webhookOutbox.update({
        where: { id: outboxId },
        data: { status: 'pending', nextRetryAt: new Date() },
      });
      return await this.deliverOutboxItem(outboxId);
    }

    if (action === 'rebuild_blocked_event') {
      const outboxId = body?.outboxId;
      if (!outboxId) throw new Error('outboxId é obrigatório.');
      return await this.rebuildAndDeliverOutboxItem(outboxId);
    }

    if (action === 'sync_tenant') {
      const tenantId = body?.tenantId;
      const eventType = (body?.eventType || 'base.upsert') as LeadgerEventType;
      if (!tenantId) throw new Error('tenantId é obrigatório.');

      if (this.toBrlCents((await this.heartPrisma.tenant.findUnique({ where: { id: tenantId } }))?.mensalidadeValor) > 0) {
        await this.ensureCurrentInvoiceForTenant(tenantId);
      }

      return await this.enqueueAndDeliverLeadgerEvent({
        eventType,
        tenantId,
        bumpClientVersion: Boolean(body?.bumpVersion),
        bumpBaseVersion: Boolean(body?.bumpVersion),
        awaitDelivery: true,
      });
    }

    if (action === 'sync_all') {
      const tenants = await this.heartPrisma.tenant.findMany({
        where: { leadgerSyncEnabled: true },
        orderBy: { createdAt: 'asc' },
      });

      const results: any[] = [];
      for (const t of tenants) {
        if (this.toBrlCents(t.mensalidadeValor) > 0) {
          await this.ensureCurrentInvoiceForTenant(t.id);
        }
        const evType: LeadgerEventType = this.toBrlCents(t.mensalidadeValor) > 0 ? 'base.upsert' : 'client.upsert';
        const res = await this.enqueueAndDeliverLeadgerEvent({
          eventType: evType,
          tenantId: t.id,
          awaitDelivery: true,
        });
        results.push({ tenantId: t.id, name: t.nomeFantasia || t.name, eventType: evType, ...res });
      }

      return {
        total: results.length,
        delivered: results.filter((r: any) => r.delivered).length,
        blocked: results.filter((r: any) => !r.valid).length,
        results,
      };
    }

    if (action === 'sync_batch') {
      const offset = Math.max(0, Number(body?.offset || 0));
      const limit = Math.min(25, Math.max(1, Number(body?.limit || 10)));

      const [totalEligible, batchTenants] = await Promise.all([
        this.heartPrisma.tenant.count({ where: { leadgerSyncEnabled: true } }),
        this.heartPrisma.tenant.findMany({
          where: { leadgerSyncEnabled: true },
          orderBy: { createdAt: 'asc' },
          skip: offset,
          take: limit,
        }),
      ]);

      const results: any[] = [];
      for (const t of batchTenants) {
        if (this.toBrlCents(t.mensalidadeValor) > 0) {
          await this.ensureCurrentInvoiceForTenant(t.id);
        }
        const evType: LeadgerEventType = this.toBrlCents(t.mensalidadeValor) > 0 ? 'base.upsert' : 'client.upsert';
        const res = await this.enqueueAndDeliverLeadgerEvent({
          eventType: evType,
          tenantId: t.id,
          awaitDelivery: true,
        });
        results.push({
          tenantId: t.id,
          name: t.nomeFantasia || t.name,
          eventType: evType,
          ...res,
        });
      }

      const nextOffset = offset + results.length;
      return {
        totalEligible,
        offset,
        limit,
        processedInBatch: results.length,
        nextOffset,
        hasMore: nextOffset < totalEligible,
        delivered: results.filter((r: any) => r.delivered).length,
        blocked: results.filter((r: any) => !r.valid).length,
        results,
      };
    }

    if (action === 'export_reconciliation') {
      const tenants = await this.heartPrisma.tenant.findMany({
        where: { databaseName: { notIn: DEMO_LEGACY_DB_NAMES } },
        orderBy: { createdAt: 'asc' },
        include: {
          users: { orderBy: { createdAt: 'asc' }, take: 1, select: { email: true } },
          invoices: { orderBy: { referenceMonth: 'desc' }, take: 6 },
        },
      });

      const items: any[] = [];
      for (const raw of tenants) {
        const t = await this.ensureTenantExternalIds(raw.id);
        items.push({
          tenantId: t.id,
          databaseName: t.databaseName,
          clientExternalId: t.clientExternalId,
          baseExternalId: t.baseExternalId,
          name: t.razaoSocial || t.nomeFantasia || t.name,
          tradeName: t.nomeFantasia || t.name,
          document: this.normalizeCnpjOrCpf(t.cnpj) || null,
          email: t.emailContato || t.emailContador || t.users?.[0]?.email || null,
          phone: this.normalizeE164Phone(t.telefoneContato || t.telefone) || null,
          amountCents: this.toBrlCents(t.mensalidadeValor),
          nextDueDate: this.toIsoDateOnly(t.mensalidadeVencimento) || null,
          status: this.mapTenantStatusToLeadger(t.status),
          clientVersion: t.clientVersion,
          baseVersion: t.baseVersion,
          invoices: raw.invoices.map((i) => ({
            externalId: i.externalId,
            referenceMonth: i.referenceMonth,
            dueDate: this.toIsoDateOnly(i.dueDate),
            amountCents: i.amount,
            status: i.status,
            paidAt: i.paidAt ? i.paidAt.toISOString() : null,
            paymentMethod: i.paymentMethod,
            version: i.version,
          })),
        });
      }

      return {
        exportedAt: new Date().toISOString(),
        source: this.getLeadgerConfig().source,
        totalTenants: items.length,
        items,
      };
    }

    throw new Error('Ação Leadger inválida.');
  }
}
