-- Incremental migration: Teltech Leadger integration, Tenant Invoices, and Webhook Outbox

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "client_external_id" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "base_external_id" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "client_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "base_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "leadger_sync_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_client_external_id_key" ON "tenants"("client_external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_base_external_id_key" ON "tenants"("base_external_id");

ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "invoice_id" TEXT;
ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'pagamento';
ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "estornado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payment_logs" ADD COLUMN IF NOT EXISTS "estornado_em" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payment_logs_invoice_id_idx" ON "payment_logs"("invoice_id");

CREATE TABLE IF NOT EXISTS "tenant_invoices" (
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

    CONSTRAINT "tenant_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invoices_external_id_key" ON "tenant_invoices"("external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invoices_tenant_id_reference_month_key" ON "tenant_invoices"("tenant_id", "reference_month");
CREATE INDEX IF NOT EXISTS "tenant_invoices_tenant_id_status_idx" ON "tenant_invoices"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "tenant_invoices_due_date_idx" ON "tenant_invoices"("due_date");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invoices_tenant_id_fkey'
    ) THEN
        ALTER TABLE "tenant_invoices"
        ADD CONSTRAINT "tenant_invoices_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "webhook_outbox" (
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

    CONSTRAINT "webhook_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_outbox_event_id_key" ON "webhook_outbox"("event_id");
CREATE INDEX IF NOT EXISTS "webhook_outbox_status_next_retry_at_idx" ON "webhook_outbox"("status", "next_retry_at");
CREATE INDEX IF NOT EXISTS "webhook_outbox_tenant_id_created_at_idx" ON "webhook_outbox"("tenant_id", "created_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'webhook_outbox_tenant_id_fkey'
    ) THEN
        ALTER TABLE "webhook_outbox"
        ADD CONSTRAINT "webhook_outbox_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
