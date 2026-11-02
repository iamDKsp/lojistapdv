import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/heart-client';

@Injectable()
export class HeartPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(HeartPrismaService.name);

  async onModuleInit() {
    let retries = 5;
    let delay = 1000;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Conexão estabelecida com sucesso com o banco Heart.');
        await this.ensureHeartColumnsAndTables();
        break;
      } catch (err: any) {
        retries--;
        this.logger.warn(
          `Falha ao conectar no banco mestre (Heart): ${err.message}. Tentando novamente em ${delay}ms... (${retries} retentativas restantes)`
        );
        if (retries === 0) {
          this.logger.error('Não foi possível estabelecer conexão com o banco Heart após 5 tentativas.');
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  /**
   * Garante de forma idempotente que colunas e tabelas estruturais do banco mestre (Heart)
   * existam mesmo antes de o operador clicar em "Atualizar Bancos (Heart)" no /sys-init.
   * Nunca altera bancos de clientes (tenants).
   */
  public async ensureHeartColumnsAndTables() {
    const statements = [
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "client_external_id" TEXT`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "base_external_id" TEXT`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "client_version" INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "base_version" INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "leadger_sync_enabled" BOOLEAN NOT NULL DEFAULT true`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`,
      `CREATE TABLE IF NOT EXISTS "operator_profiles" (
        "tenant_id" TEXT NOT NULL,
        "operator_id" TEXT NOT NULL,
        "image_url" TEXT,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "operator_profiles_pkey" PRIMARY KEY ("tenant_id", "operator_id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tenants_client_external_id_key" ON "tenants"("client_external_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tenants_base_external_id_key" ON "tenants"("base_external_id")`,
      `ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "invoice_id" TEXT`,
      `ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "payment_method" TEXT DEFAULT 'pix'`,
      `ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'payment'`,
      `ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "estornado" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "estornado_em" TIMESTAMP(3)`,
      `CREATE TABLE IF NOT EXISTS "tenant_invoices" (
        "id" TEXT NOT NULL,
        "external_id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "reference_month" TEXT NOT NULL,
        "due_date" TIMESTAMP(3) NOT NULL,
        "amount" INTEGER NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "paid_at" TIMESTAMP(3),
        "payment_method" TEXT,
        "description" TEXT,
        "notes" TEXT,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tenant_invoices_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "tenant_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invoices_external_id_key" ON "tenant_invoices"("external_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invoices_tenant_id_reference_month_key" ON "tenant_invoices"("tenant_id", "reference_month")`,
      `CREATE INDEX IF NOT EXISTS "tenant_invoices_tenant_id_status_idx" ON "tenant_invoices"("tenant_id", "status")`,
      `CREATE INDEX IF NOT EXISTS "tenant_invoices_due_date_idx" ON "tenant_invoices"("due_date")`,
      `CREATE TABLE IF NOT EXISTS "webhook_outbox" (
        "id" TEXT NOT NULL,
        "event_id" TEXT NOT NULL,
        "event_type" TEXT NOT NULL,
        "tenant_id" TEXT,
        "invoice_id" TEXT,
        "payload" JSONB NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "max_attempts" INTEGER NOT NULL DEFAULT 12,
        "next_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_status_code" INTEGER,
        "last_response" TEXT,
        "last_error" TEXT,
        "delivered_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "webhook_outbox_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "webhook_outbox_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "webhook_outbox_event_id_key" ON "webhook_outbox"("event_id")`,
      `CREATE INDEX IF NOT EXISTS "webhook_outbox_status_next_retry_at_idx" ON "webhook_outbox"("status", "next_retry_at")`,
      `CREATE INDEX IF NOT EXISTS "webhook_outbox_tenant_id_created_at_idx" ON "webhook_outbox"("tenant_id", "created_at")`,
      `CREATE TABLE IF NOT EXISTS "leads" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "whatsapp" TEXT NOT NULL,
        "access_count" INTEGER NOT NULL DEFAULT 1,
        "last_access_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status" TEXT NOT NULL DEFAULT 'NOVO',
        "source" TEXT NOT NULL DEFAULT 'demo',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
      )`,
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "access_count" INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_access_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `UPDATE "leads" SET "whatsapp" = regexp_replace("whatsapp", '\\D', '', 'g') WHERE "whatsapp" ~ '\\D'`,
      `DELETE FROM "leads" a USING "leads" b WHERE a."whatsapp" = b."whatsapp" AND a."createdAt" < b."createdAt"`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "leads_whatsapp_key" ON "leads"("whatsapp")`,
      `CREATE INDEX IF NOT EXISTS "leads_status_idx" ON "leads"("status")`,
      `CREATE INDEX IF NOT EXISTS "leads_createdAt_idx" ON "leads"("createdAt")`,
      `CREATE TABLE IF NOT EXISTS "storefront_registry" (
        "id" TEXT NOT NULL,
        "public_id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "store_name" TEXT NOT NULL DEFAULT '',
        "enabled" BOOLEAN NOT NULL DEFAULT false,
        "published" BOOLEAN NOT NULL DEFAULT false,
        "published_version" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "storefront_registry_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "storefront_registry_public_id_key" ON "storefront_registry"("public_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "storefront_registry_tenant_id_key" ON "storefront_registry"("tenant_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "storefront_registry_slug_key" ON "storefront_registry"("slug")`,
      `CREATE INDEX IF NOT EXISTS "storefront_registry_slug_enabled_published_idx" ON "storefront_registry"("slug", "enabled", "published")`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'storefront_registry_tenant_id_fkey') THEN ALTER TABLE "storefront_registry" ADD CONSTRAINT "storefront_registry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$`,
    ];

    for (const sql of statements) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (err: any) {
        this.logger.warn(`Aviso ao garantir schema Heart: ${err.message}`);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
