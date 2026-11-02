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

          CREATE TABLE IF NOT EXISTS "storefront_settings" (
              "id" TEXT NOT NULL DEFAULT 'singleton',
              "publicId" VARCHAR(64) NOT NULL,
              "slug" VARCHAR(80) NOT NULL,
              "storeName" VARCHAR(140) NOT NULL DEFAULT '',
              "tagline" VARCHAR(240),
              "description" TEXT,
              "logoUrl" TEXT,
              "coverUrl" TEXT,
              "whatsappPhone" VARCHAR(32),
              "whatsappMessageIntro" VARCHAR(300),
              "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
              "pickupInstructions" TEXT,
              "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
              "deliveryInstructions" TEXT,
              "deliveryFeeNote" VARCHAR(240),
              "confirmReservationMinutes" INTEGER NOT NULL DEFAULT 15,
              "confirmedHoldHours" INTEGER NOT NULL DEFAULT 24,
              "draftThemeJson" JSONB NOT NULL DEFAULT '{}',
              "publishedThemeJson" JSONB NOT NULL DEFAULT '{}',
              "publishedVersion" INTEGER NOT NULL DEFAULT 0,
              "isPublished" BOOLEAN NOT NULL DEFAULT false,
              "publishedAt" TIMESTAMP(3),
              "publishedByUserId" TEXT,
              "publishedByName" TEXT,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "storefront_settings_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "storefront_revisions" (
              "id" TEXT NOT NULL,
              "version" INTEGER NOT NULL,
              "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
              "themeJson" JSONB NOT NULL,
              "settingsSnapshotJson" JSONB NOT NULL,
              "createdByUserId" TEXT,
              "createdByName" TEXT,
              "publishedAt" TIMESTAMP(3),
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "storefront_revisions_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "storefront_categories" (
              "id" TEXT NOT NULL,
              "categoryId" TEXT NOT NULL,
              "slug" VARCHAR(80) NOT NULL,
              "displayName" VARCHAR(120),
              "description" VARCHAR(300),
              "visible" BOOLEAN NOT NULL DEFAULT true,
              "featured" BOOLEAN NOT NULL DEFAULT false,
              "sortOrder" INTEGER NOT NULL DEFAULT 0,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "storefront_categories_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "storefront_products" (
              "id" TEXT NOT NULL,
              "retailGroupId" TEXT NOT NULL,
              "publicSlug" VARCHAR(140) NOT NULL,
              "visible" BOOLEAN NOT NULL DEFAULT false,
              "featured" BOOLEAN NOT NULL DEFAULT false,
              "sortOrder" INTEGER NOT NULL DEFAULT 0,
              "commercialTitle" VARCHAR(160),
              "commercialDescription" TEXT,
              "badgeLabel" VARCHAR(60),
              "galleryUrlsJson" JSONB NOT NULL DEFAULT '[]',
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "storefront_products_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "storefront_orders" (
              "id" TEXT NOT NULL,
              "code" INTEGER NOT NULL,
              "reference" VARCHAR(40) NOT NULL,
              "idempotencyKey" VARCHAR(80) NOT NULL,
              "requestFingerprint" VARCHAR(80) NOT NULL,
              "accessTokenHash" VARCHAR(128) NOT NULL,
              "customerId" TEXT,
              "customerName" VARCHAR(140) NOT NULL,
              "customerPhone" VARCHAR(40) NOT NULL,
              "customerCpf" VARCHAR(24),
              "fulfillmentMode" VARCHAR(24) NOT NULL DEFAULT 'PICKUP',
              "deliveryAddressJson" JSONB,
              "notes" TEXT,
              "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
              "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
              "total" DECIMAL(10,2) NOT NULL,
              "commercialStatus" VARCHAR(32) NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
              "reservationStatus" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
              "fulfillmentStatus" VARCHAR(32) NOT NULL DEFAULT 'WAITING_SEPARATION',
              "paymentStatus" VARCHAR(32) NOT NULL DEFAULT 'UNREGISTERED',
              "reservationExpiresAt" TIMESTAMP(3) NOT NULL,
              "confirmedAt" TIMESTAMP(3),
              "confirmedByUserId" TEXT,
              "confirmedByName" TEXT,
              "cancelledAt" TIMESTAMP(3),
              "cancelledByUserId" TEXT,
              "cancelledByName" TEXT,
              "cancelReason" TEXT,
              "completedAt" TIMESTAMP(3),
              "saleId" TEXT,
              "offlineConflictDetected" BOOLEAN NOT NULL DEFAULT false,
              "offlineConflictNote" TEXT,
              "version" INTEGER NOT NULL DEFAULT 1,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "storefront_orders_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "storefront_order_items" (
              "id" TEXT NOT NULL,
              "orderId" TEXT NOT NULL,
              "retailGroupId" TEXT,
              "productId" TEXT NOT NULL,
              "productName" VARCHAR(180) NOT NULL,
              "size" VARCHAR(40),
              "color" VARCHAR(60),
              "variantLabel" VARCHAR(120),
              "sku" VARCHAR(80),
              "barcode" VARCHAR(80),
              "imageUrl" TEXT,
              "unit" VARCHAR(16) NOT NULL DEFAULT 'UN',
              "quantity" INTEGER NOT NULL,
              "priceUnit" DECIMAL(10,4) NOT NULL,
              "subtotal" DECIMAL(10,2) NOT NULL,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "storefront_order_items_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "stock_reservations" (
              "id" TEXT NOT NULL,
              "orderId" TEXT NOT NULL,
              "productId" TEXT NOT NULL,
              "quantity" INTEGER NOT NULL,
              "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
              "expiresAt" TIMESTAMP(3) NOT NULL,
              "consumedAt" TIMESTAMP(3),
              "releasedAt" TIMESTAMP(3),
              "releaseReason" VARCHAR(240),
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
          );

          CREATE TABLE IF NOT EXISTS "storefront_order_events" (
              "id" TEXT NOT NULL,
              "orderId" TEXT NOT NULL,
              "eventType" VARCHAR(48) NOT NULL,
              "fromStatus" VARCHAR(48),
              "toStatus" VARCHAR(48),
              "actorType" VARCHAR(24) NOT NULL DEFAULT 'SYSTEM',
              "actorId" VARCHAR(80),
              "actorName" VARCHAR(120),
              "reason" TEXT,
              "metadataJson" JSONB,
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "storefront_order_events_pkey" PRIMARY KEY ("id")
          );

          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_settings_publicId_key" ON "storefront_settings"("publicId");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_settings_slug_key" ON "storefront_settings"("slug");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_revisions_version_key" ON "storefront_revisions"("version");
          CREATE INDEX IF NOT EXISTS "storefront_revisions_status_createdAt_idx" ON "storefront_revisions"("status", "createdAt");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_categories_categoryId_key" ON "storefront_categories"("categoryId");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_categories_slug_key" ON "storefront_categories"("slug");
          CREATE INDEX IF NOT EXISTS "storefront_categories_visible_sortOrder_idx" ON "storefront_categories"("visible", "sortOrder");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_products_retailGroupId_key" ON "storefront_products"("retailGroupId");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_products_publicSlug_key" ON "storefront_products"("publicSlug");
          CREATE INDEX IF NOT EXISTS "storefront_products_visible_featured_sortOrder_idx" ON "storefront_products"("visible", "featured", "sortOrder");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_orders_reference_key" ON "storefront_orders"("reference");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_orders_idempotencyKey_key" ON "storefront_orders"("idempotencyKey");
          CREATE UNIQUE INDEX IF NOT EXISTS "storefront_orders_saleId_key" ON "storefront_orders"("saleId");
          CREATE INDEX IF NOT EXISTS "storefront_orders_commercialStatus_createdAt_idx" ON "storefront_orders"("commercialStatus", "createdAt");
          CREATE INDEX IF NOT EXISTS "storefront_orders_reservationStatus_reservationExpiresAt_idx" ON "storefront_orders"("reservationStatus", "reservationExpiresAt");
          CREATE INDEX IF NOT EXISTS "storefront_orders_customerPhone_idx" ON "storefront_orders"("customerPhone");
          CREATE INDEX IF NOT EXISTS "storefront_orders_code_idx" ON "storefront_orders"("code");
          CREATE INDEX IF NOT EXISTS "storefront_order_items_orderId_idx" ON "storefront_order_items"("orderId");
          CREATE INDEX IF NOT EXISTS "storefront_order_items_productId_idx" ON "storefront_order_items"("productId");
          CREATE INDEX IF NOT EXISTS "stock_reservations_productId_status_expiresAt_idx" ON "stock_reservations"("productId", "status", "expiresAt");
          CREATE INDEX IF NOT EXISTS "stock_reservations_orderId_status_idx" ON "stock_reservations"("orderId", "status");
          CREATE INDEX IF NOT EXISTS "stock_reservations_status_expiresAt_idx" ON "stock_reservations"("status", "expiresAt");
          CREATE INDEX IF NOT EXISTS "storefront_order_events_orderId_createdAt_idx" ON "storefront_order_events"("orderId", "createdAt");

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_categories_categoryId_fkey') THEN
              ALTER TABLE "storefront_categories" ADD CONSTRAINT "storefront_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_products_retailGroupId_fkey') THEN
              ALTER TABLE "storefront_products" ADD CONSTRAINT "storefront_products_retailGroupId_fkey" FOREIGN KEY ("retailGroupId") REFERENCES "retail_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_orders_customerId_fkey') THEN
              ALTER TABLE "storefront_orders" ADD CONSTRAINT "storefront_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_orders_saleId_fkey') THEN
              ALTER TABLE "storefront_orders" ADD CONSTRAINT "storefront_orders_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_order_items_orderId_fkey') THEN
              ALTER TABLE "storefront_order_items" ADD CONSTRAINT "storefront_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "storefront_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_order_items_productId_fkey') THEN
              ALTER TABLE "storefront_order_items" ADD CONSTRAINT "storefront_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_reservations_orderId_fkey') THEN
              ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "storefront_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_reservations_productId_fkey') THEN
              ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_order_events_orderId_fkey') THEN
              ALTER TABLE "storefront_order_events" ADD CONSTRAINT "storefront_order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "storefront_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
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
