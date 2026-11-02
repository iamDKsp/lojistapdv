import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

interface CachedClient {
  client: PrismaClient;
  lastUsed: number;
}

@Injectable()
export class TenantConnectionManager implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionManager.name);
  private clients = new Map<string, CachedClient>();
  private connectionPromises = new Map<string, Promise<PrismaClient>>();
  private readonly MAX_CLIENTS = 100;
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutos

  /**
   * Obtém ou cria uma conexão cacheada para um tenant em específico.
   * Agora com limites de pool e limpeza automática.
   */
  async getTenantClient(tenantId: string, databaseUrl: string): Promise<PrismaClient> {
    // 1. Executa limpeza de conexões ociosas periodicamente
    this.runCleanup();

    // 2. Verifica se já temos o cliente em cache
    if (this.clients.has(tenantId)) {
      const entry = this.clients.get(tenantId)!;
      entry.lastUsed = Date.now();
      return entry.client;
    }

    // 3. Se já existe uma promessa de conexão em andamento, espera por ela (evita race condition)
    if (this.connectionPromises.has(tenantId)) {
      return this.connectionPromises.get(tenantId)!;
    }

    // 4. Gerenciamento de capacidade (LRU simples)
    if (this.clients.size >= this.MAX_CLIENTS) {
      this.evictOldest();
    }

    // 5. Injeta limite de conexões na URL (Bulletproof para escalabilidade)
    const url = new URL(databaseUrl);
    url.searchParams.set('connection_limit', process.env.TENANT_DB_CONNECTION_LIMIT || '5');
    url.searchParams.set('pool_timeout', '20'); // segundos
    const optimizedUrl = url.toString();

    this.logger.log(`Iniciando novo Pool Prisma para Tenant: ${tenantId} (limit=10)`);

    const client = new PrismaClient({
      datasources: {
        db: {
          url: optimizedUrl,
        },
      },
    });

    const connectPromise = (async () => {
      try {
        await client.$connect();
        await this.ensureTenantRuntimeSchema(client, tenantId);
        this.clients.set(tenantId, { client, lastUsed: Date.now() });
        return client;
      } catch (error: any) {
        this.logger.error(`Falha ao conectar no banco do tenant ${tenantId}: ${error.message}`);
        throw error;
      } finally {
        this.connectionPromises.delete(tenantId);
      }
    })();

    this.connectionPromises.set(tenantId, connectPromise);
    return connectPromise;
  }

  /**
   * Garante de forma idempotente (em um único bloco PL/pgSQL compatível com prepared statements)
   * que as colunas e tabelas estruturais do Módulo de Crediário e Categorias existam no banco do tenant.
   */
  async ensureTenantRuntimeSchema(client: PrismaClient, tenantId?: string): Promise<void> {
    try {
      await client.$executeRawUnsafe(`
        DO $crediario_schema$
        BEGIN
          ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(10,2) NOT NULL DEFAULT 0;
          ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "creditBlocked" BOOLEAN NOT NULL DEFAULT false;
          ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferredDueDay" INTEGER;
          ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true;
          ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "creditNotes" TEXT;
          ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(60);
          ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

          CREATE TABLE IF NOT EXISTS "customer_receivables" (
              "id" TEXT NOT NULL,
              "customerId" TEXT NOT NULL,
              "saleId" TEXT,
              "installmentNumber" INTEGER NOT NULL DEFAULT 1,
              "totalInstallments" INTEGER NOT NULL DEFAULT 1,
              "description" VARCHAR(240) NOT NULL,
              "originalAmount" DECIMAL(10,2) NOT NULL,
              "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
              "remainingAmount" DECIMAL(10,2) NOT NULL,
              "dueDate" TIMESTAMP(3) NOT NULL,
              "status" TEXT NOT NULL DEFAULT 'OPEN',
              "paidAt" TIMESTAMP(3),
              "lastReminderAt" TIMESTAMP(3),
              "reminderCount" INTEGER NOT NULL DEFAULT 0,
              "operatorId" TEXT,
              "notes" TEXT,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "customer_receivables_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "customer_receivable_payments" (
              "id" TEXT NOT NULL,
              "requestKey" VARCHAR(80),
              "receivableId" TEXT NOT NULL,
              "customerId" TEXT NOT NULL,
              "amount" DECIMAL(10,2) NOT NULL,
              "paymentMethod" TEXT NOT NULL DEFAULT 'pix',
              "cashRegisterId" TEXT,
              "cashMovementId" TEXT,
              "operatorId" TEXT,
              "notes" TEXT,
              "reversedAt" TIMESTAMP(3),
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "customer_receivable_payments_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "crediario_settings" (
              "id" TEXT NOT NULL DEFAULT 'singleton',
              "enabled" BOOLEAN NOT NULL DEFAULT true,
              "defaultCreditLimit" DECIMAL(10,2) NOT NULL DEFAULT 500,
              "defaultDueDays" INTEGER NOT NULL DEFAULT 30,
              "maxInstallments" INTEGER NOT NULL DEFAULT 6,
              "allowPartialPayment" BOOLEAN NOT NULL DEFAULT true,
              "blockOverdueCustomer" BOOLEAN NOT NULL DEFAULT true,
              "pixKey" VARCHAR(180),
              "pixBeneficiary" VARCHAR(160),
              "whatsappAutoBilling" BOOLEAN NOT NULL DEFAULT true,
              "dispatchHour" VARCHAR(10) NOT NULL DEFAULT '09:00',
              "sendOnSale" BOOLEAN NOT NULL DEFAULT true,
              "sendBeforeDue" BOOLEAN NOT NULL DEFAULT true,
              "daysBeforeDue" INTEGER NOT NULL DEFAULT 3,
              "sendOnDueDate" BOOLEAN NOT NULL DEFAULT true,
              "sendOverdue" BOOLEAN NOT NULL DEFAULT true,
              "overdueIntervalDays" INTEGER NOT NULL DEFAULT 3,
              "maxOverdueReminders" INTEGER NOT NULL DEFAULT 5,
              "sendOnPayment" BOOLEAN NOT NULL DEFAULT true,
              "templateOnSale" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Confirmamos sua compra no crediário na *{loja}* no valor de *{valor}* ({parcela}). Próximo vencimento: *{vencimento}*. Qualquer dúvida, estamos à disposição!',
              "templateBeforeDue" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Lembrete amigável da *{loja}*: sua parcela ({parcela}) no valor de *{valor}* vence em *{vencimento}*. Chave PIX para pagamento: *{pix}* ({beneficiario_pix}).',
              "templateOnDueDate" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Hoje (*{vencimento}*) é o vencimento da sua parcela ({parcela}) de *{valor}* na *{loja}*. Você pode pagar na loja ou via PIX: *{pix}* ({beneficiario_pix}).',
              "templateOverdue" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Identificamos que a parcela ({parcela}) de *{valor}* na *{loja}*, vencida em *{vencimento}*, encontra-se em aberto (Saldo total: *{saldo_devedor}*). Para regularizar via PIX utilize a chave: *{pix}* ({beneficiario_pix}). Caso já tenha efetuado o pagamento, desconsidere.',
              "templateOnPayment" TEXT NOT NULL DEFAULT 'Olá, *{cliente}*! Recebemos seu pagamento de *{valor}* na *{loja}*. Seu saldo atualizado em aberto é de *{saldo_devedor}*. Muito obrigado pela preferência!',
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "crediario_settings_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "whatsapp_auth_states" (
              "id" VARCHAR(160) NOT NULL,
              "data" TEXT NOT NULL,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "whatsapp_auth_states_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "crediario_notification_logs" (
              "id" TEXT NOT NULL,
              "customerId" TEXT NOT NULL,
              "receivableId" TEXT,
              "paymentId" TEXT,
              "saleId" TEXT,
              "triggerType" VARCHAR(40) NOT NULL,
              "triggerReferenceDate" VARCHAR(32) NOT NULL,
              "phone" VARCHAR(40) NOT NULL,
              "message" TEXT NOT NULL,
              "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
              "error" TEXT,
              "sentAt" TIMESTAMP(3),
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "crediario_notification_logs_pkey" PRIMARY KEY ("id")
          );

          CREATE INDEX IF NOT EXISTS "customer_receivables_customerId_status_idx" ON "customer_receivables"("customerId", "status");
          CREATE INDEX IF NOT EXISTS "customer_receivables_status_dueDate_idx" ON "customer_receivables"("status", "dueDate");
          CREATE INDEX IF NOT EXISTS "customer_receivables_saleId_idx" ON "customer_receivables"("saleId");
          CREATE UNIQUE INDEX IF NOT EXISTS "customer_receivable_payments_requestKey_key" ON "customer_receivable_payments"("requestKey");
          CREATE INDEX IF NOT EXISTS "customer_receivable_payments_customerId_createdAt_idx" ON "customer_receivable_payments"("customerId", "createdAt");
          CREATE INDEX IF NOT EXISTS "customer_receivable_payments_receivableId_idx" ON "customer_receivable_payments"("receivableId");
          CREATE INDEX IF NOT EXISTS "crediario_notification_logs_customerId_createdAt_idx" ON "crediario_notification_logs"("customerId", "createdAt");
          CREATE INDEX IF NOT EXISTS "crediario_notification_logs_status_createdAt_idx" ON "crediario_notification_logs"("status", "createdAt");
          CREATE UNIQUE INDEX IF NOT EXISTS "crediario_notification_logs_receivableId_triggerType_trigge_key" ON "crediario_notification_logs"("receivableId", "triggerType", "triggerReferenceDate");

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_receivables_customerId_fkey') THEN
              ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_receivables_saleId_fkey') THEN
              ALTER TABLE "customer_receivables" ADD CONSTRAINT "customer_receivables_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_receivable_payments_receivableId_fkey') THEN
              ALTER TABLE "customer_receivable_payments" ADD CONSTRAINT "customer_receivable_payments_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "customer_receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_receivable_payments_customerId_fkey') THEN
              ALTER TABLE "customer_receivable_payments" ADD CONSTRAINT "customer_receivable_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crediario_notification_logs_customerId_fkey') THEN
              ALTER TABLE "crediario_notification_logs" ADD CONSTRAINT "crediario_notification_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crediario_notification_logs_receivableId_fkey') THEN
              ALTER TABLE "crediario_notification_logs" ADD CONSTRAINT "crediario_notification_logs_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "customer_receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;

          EXECUTE 'INSERT INTO "crediario_settings" ("id", "updatedAt") VALUES (''singleton'', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING';
        END $crediario_schema$;
      `);
    } catch (err: any) {
      this.logger.warn(
        `Aviso ao garantir schema runtime do tenant ${tenantId || ''}: ${err?.message || err}`,
      );
    }
  }

  private runCleanup() {
    const now = Date.now();
    for (const [id, entry] of this.clients.entries()) {
      if (now - entry.lastUsed > this.IDLE_TIMEOUT) {
        this.logger.log(`Limpando conexão ociosa do Tenant: ${id}`);
        entry.client.$disconnect().catch(() => {});
        this.clients.delete(id);
      }
    }
  }

  private evictOldest() {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.clients.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.logger.log(`Limite de cache atingido. Removendo cliente mais antigo: ${oldestId}`);
      const entry = this.clients.get(oldestId)!;
      entry.client.$disconnect().catch(() => {});
      this.clients.delete(oldestId);
    }
  }

  async disconnectTenant(tenantId: string) {
    const entry = this.clients.get(tenantId);
    if (entry) {
      this.clients.delete(tenantId);
      await entry.client.$disconnect().catch(() => {});
    }
  }

  async onModuleDestroy() {
    this.logger.log('Encerrando todas as conexões de tenants...');
    const disconnectPromises = Array.from(this.clients.values()).map((entry) =>
      entry.client.$disconnect(),
    );
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }
}
