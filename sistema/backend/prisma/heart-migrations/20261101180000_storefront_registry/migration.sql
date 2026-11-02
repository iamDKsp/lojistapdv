-- Incremental migration: StorefrontRegistry (Loja Virtual public registry in Heart DB)

CREATE TABLE IF NOT EXISTS "storefront_registry" (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "storefront_registry_public_id_key" ON "storefront_registry"("public_id");
CREATE UNIQUE INDEX IF NOT EXISTS "storefront_registry_tenant_id_key" ON "storefront_registry"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "storefront_registry_slug_key" ON "storefront_registry"("slug");
CREATE INDEX IF NOT EXISTS "storefront_registry_slug_enabled_published_idx" ON "storefront_registry"("slug", "enabled", "published");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'storefront_registry_tenant_id_fkey'
    ) THEN
        ALTER TABLE "storefront_registry"
        ADD CONSTRAINT "storefront_registry_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
