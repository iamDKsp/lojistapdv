import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { WhatsappBaileysService } from './whatsapp-baileys.service';
import {
  DEFAULT_CREDIARIO_TEMPLATES,
  evaluateReceivableBillingTrigger,
  renderBillingTemplate,
  toCents,
} from './crediario.rules';
import {
  todayIsoSaoPaulo,
  currentHourMinuteSaoPaulo,
} from './crediario.service';

@Injectable()
export class CrediarioCronService {
  private readonly logger = new Logger(CrediarioCronService.name);
  private isRunning = false;

  constructor(
    private readonly heartPrisma: HeartPrismaService,
    private readonly tenantManager: TenantConnectionManager,
    private readonly whatsappService: WhatsappBaileysService,
  ) {}

  private parseModulos(raw: any): Record<string, boolean> {
    try {
      if (!raw) return {};
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleScheduledBillingSweep() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const tenants = await this.heartPrisma.tenant.findMany({
        where: { status: 'active' },
      });

      const now = new Date();
      const todayIso = todayIsoSaoPaulo(now);
      const currentHm = currentHourMinuteSaoPaulo(now);

      for (const tenant of tenants) {
        const modulos = this.parseModulos(tenant.modulos);
        if (!modulos.crediario) continue;

        try {
          const storeName =
            tenant.nomeFantasia ||
            tenant.razaoSocial ||
            tenant.name ||
            'Nossa Loja';
          await this.processTenantBilling(
            tenant.id,
            tenant.databaseUrl,
            storeName,
            todayIso,
            currentHm,
            false,
          );
        } catch (err: any) {
          if (!['P2021', 'P2022'].includes(err?.code)) {
            this.logger.warn(
              `Erro ao processar régua de cobrança do tenant ${tenant.id}: ${err.message}`,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Falha global na varredura CRON do Crediário: ${err.message}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Processa a régua de cobrança de um tenant específico.
   * Quando `ignoreScheduleHour === true` (acionamento manual pelo lojista), ignora a trava de horário `dispatchHour`.
   */
  async processTenantBilling(
    tenantId: string,
    databaseUrl: string,
    storeName: string,
    todayIso = todayIsoSaoPaulo(),
    currentHm = currentHourMinuteSaoPaulo(),
    ignoreScheduleHour = false,
  ): Promise<{
    evaluated: number;
    sent: number;
    failed: number;
    skippedAlreadySent: number;
  }> {
    const prisma = await this.tenantManager.getTenantClient(
      tenantId,
      databaseUrl,
    );

    const settings = await prisma.crediarioSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: {
        id: 'singleton',
        ...DEFAULT_CREDIARIO_TEMPLATES,
      },
    });

    if (!settings.enabled || !settings.whatsappAutoBilling) {
      return { evaluated: 0, sent: 0, failed: 0, skippedAlreadySent: 0 };
    }

    const targetHour = settings.dispatchHour || '09:00';
    if (!ignoreScheduleHour && currentHm < targetHour) {
      return { evaluated: 0, sent: 0, failed: 0, skippedAlreadySent: 0 };
    }

    const waStatus = await this.whatsappService.getStatus(
      tenantId,
      databaseUrl,
    );
    if (waStatus.status !== 'CONNECTED') {
      return { evaluated: 0, sent: 0, failed: 0, skippedAlreadySent: 0 };
    }

    const openReceivables = await prisma.customerReceivable.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIAL'] },
        customer: { whatsappOptIn: true },
      },
      include: {
        customer: true,
      },
      orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
      take: 200,
    });

    // Soma o saldo total por cliente para preencher {saldo_devedor}
    const customerTotalDebtMap = new Map<string, number>();
    for (const r of openReceivables) {
      const prev = customerTotalDebtMap.get(r.customerId) || 0;
      customerTotalDebtMap.set(
        r.customerId,
        Number((prev + Number(r.remainingAmount)).toFixed(2)),
      );
    }

    let evaluated = 0;
    let sent = 0;
    let failed = 0;
    let skippedAlreadySent = 0;

    for (const receivable of openReceivables) {
      if (toCents(receivable.remainingAmount as any) <= 0) continue;
      if (!receivable.customer?.phone) continue;

      const triggerType = evaluateReceivableBillingTrigger({
        dueDate: receivable.dueDate,
        status: receivable.status,
        remainingAmount: Number(receivable.remainingAmount),
        lastReminderAt: receivable.lastReminderAt,
        reminderCount: receivable.reminderCount,
        todayIso,
        settings: {
          sendBeforeDue: settings.sendBeforeDue,
          daysBeforeDue: settings.daysBeforeDue,
          sendOnDueDate: settings.sendOnDueDate,
          sendOverdue: settings.sendOverdue,
          overdueIntervalDays: settings.overdueIntervalDays,
          maxOverdueReminders: settings.maxOverdueReminders,
        },
      });

      if (!triggerType) continue;
      evaluated += 1;

      const existingLog = await prisma.crediarioNotificationLog.findUnique({
        where: {
          receivableId_triggerType_triggerReferenceDate: {
            receivableId: receivable.id,
            triggerType,
            triggerReferenceDate: todayIso,
          },
        },
      });

      if (existingLog && existingLog.status === 'SENT') {
        skippedAlreadySent += 1;
        continue;
      }

      const template =
        triggerType === 'BEFORE_DUE'
          ? settings.templateBeforeDue
          : triggerType === 'ON_DUE_DATE'
            ? settings.templateOnDueDate
            : settings.templateOverdue;

      const message = renderBillingTemplate(template, {
        cliente: receivable.customer.name,
        loja: storeName,
        valor: Number(receivable.remainingAmount),
        vencimento: receivable.dueDate,
        parcela: `${receivable.installmentNumber}/${receivable.totalInstallments}`,
        saldo_devedor:
          customerTotalDebtMap.get(receivable.customerId) ||
          Number(receivable.remainingAmount),
        pix: settings.pixKey,
        beneficiario_pix: settings.pixBeneficiary || storeName,
      });

      const logRecord = existingLog
        ? await prisma.crediarioNotificationLog.update({
            where: { id: existingLog.id },
            data: { status: 'PENDING', message, error: null },
          })
        : await prisma.crediarioNotificationLog.create({
            data: {
              customerId: receivable.customerId,
              receivableId: receivable.id,
              triggerType,
              triggerReferenceDate: todayIso,
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
            where: { id: logRecord.id },
            data: { status: 'SENT', sentAt: new Date(), error: null },
          }),
          prisma.customerReceivable.update({
            where: { id: receivable.id },
            data: {
              lastReminderAt: new Date(),
              reminderCount:
                triggerType === 'OVERDUE'
                  ? { increment: 1 }
                  : receivable.reminderCount,
            },
          }),
        ]);

        sent += 1;
        // Intervalo seguro entre disparos para proteger o número da loja
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: any) {
        failed += 1;
        await prisma.crediarioNotificationLog.update({
          where: { id: logRecord.id },
          data: {
            status: 'FAILED',
            error: err?.message || 'Erro no envio via Baileys',
          },
        });
      }
    }

    return { evaluated, sent, failed, skippedAlreadySent };
  }
}
