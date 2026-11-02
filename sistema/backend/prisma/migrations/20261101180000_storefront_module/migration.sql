-- Incremental migration: Módulo Loja Virtual (Storefront) no banco do Tenant

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

DO $$
BEGIN
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
END $$;
