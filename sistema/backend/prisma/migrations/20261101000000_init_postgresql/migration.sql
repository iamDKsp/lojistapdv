-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FiscalImportStatus" AS ENUM ('RECEBIDA', 'PROCESSANDO', 'AGUARDANDO_CONCILIACAO', 'PRONTA_IMPORTAR', 'IMPORTANDO', 'IMPORTADA', 'CANCELADA', 'ERRO');

-- CreateEnum
CREATE TYPE "FiscalEventType" AS ENUM ('IMPORT_STARTED', 'IMPORT_FINISHED', 'IMPORT_PARTIAL', 'SUPPLIER_CREATED', 'PRODUCT_MATCHED', 'PRODUCT_CREATED', 'NFE_DOWNLOADED', 'XML_UPLOADED', 'SEFAZ_ERROR', 'NFE_CANCELLED', 'STATUS_CHECK', 'XML_GENERATED', 'DANFE_GENERATED');

-- CreateTable
CREATE TABLE "grupo_tributacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isPadrao" BOOLEAN NOT NULL DEFAULT false,
    "csosn" TEXT,
    "cstIcms" TEXT,
    "cfop" TEXT NOT NULL,
    "aliqIcms" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "redBcIcms" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cstPis" TEXT NOT NULL DEFAULT '99',
    "aliqPis" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cstCofins" TEXT NOT NULL DEFAULT '99',
    "aliqCofins" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cstIpi" TEXT,
    "aliqIpi" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupo_tributacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grupoTributacaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "requiresCarvoaria" BOOLEAN NOT NULL DEFAULT false,
    "serviceTimerMinutes" INTEGER,
    "assetTrackingTotal" INTEGER,
    "requiresKitchen" BOOLEAN NOT NULL DEFAULT false,
    "requiresBar" BOOLEAN NOT NULL DEFAULT false,
    "barStation" TEXT NOT NULL DEFAULT 'BAR',
    "preparationIngredients" TEXT,
    "id" TEXT NOT NULL,
    "retailGroupId" TEXT,
    "size" VARCHAR(40),
    "color" VARCHAR(60),
    "variantKey" VARCHAR(120),
    "categoryId" TEXT NOT NULL,
    "grupoTributacaoId" TEXT,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "barcode" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "priceCost" DECIMAL(10,4) NOT NULL,
    "priceSell" DECIMAL(10,4) NOT NULL,
    "stock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(10,3),
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "ncm" TEXT,
    "cest" TEXT,
    "origem" INTEGER NOT NULL DEFAULT 0,
    "fiscalProfileId" TEXT,
    "emiteNfce" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "volumeUnit" TEXT,
    "volumeCapacity" DECIMAL(10,3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "address" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "jobTitle" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_consumptions" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "requestFingerprint" VARCHAR(80),
    "customerId" TEXT,
    "operatorId" TEXT,
    "cashRegisterId" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "addition" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "source" TEXT NOT NULL DEFAULT 'pdv',
    "emitirNfce" BOOLEAN NOT NULL DEFAULT false,
    "nfceStatus" TEXT,
    "nfceNumero" INTEGER,
    "nfceSerie" INTEGER,
    "nfceChave" TEXT,
    "nfceProtocolo" TEXT,
    "nfceAutorizadaEm" TIMESTAMP(3),
    "nfceXml" TEXT,
    "nfceQrcode" TEXT,
    "nfceCodRejeicao" TEXT,
    "nfceMotivoRejeicao" TEXT,
    "consumidorCpf" TEXT,
    "consumidorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" INTEGER,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_delivery_jobs" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_delivery_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "quantity" DECIMAL(10,3) NOT NULL,
    "priceUnit" DECIMAL(10,4) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "ncm" TEXT,
    "cest" TEXT,
    "cfop" TEXT,
    "origem" INTEGER NOT NULL DEFAULT 0,
    "csosn" TEXT,
    "cstIcms" TEXT,
    "aliqIcms" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorIcms" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cstPis" TEXT NOT NULL DEFAULT '99',
    "aliqPis" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorPis" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cstCofins" TEXT NOT NULL DEFAULT '99',
    "aliqCofins" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorCofins" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "priceCost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "tPag" TEXT NOT NULL DEFAULT '99',
    "method" TEXT NOT NULL,
    "label" TEXT,
    "value" DECIMAL(10,2) NOT NULL,
    "troco" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_payment_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tPag" TEXT NOT NULL DEFAULT '99',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "emitirNfce" BOOLEAN NOT NULL DEFAULT false,
    "hasVariablePricing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_payment_method_prices" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_payment_method_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "code" INTEGER,
    "openingTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingTime" TIMESTAMP(3),
    "openingValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "closingValue" DECIMAL(10,2),
    "closingDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "conferenceDetails" TEXT,
    "conferenceSavedAt" TIMESTAMP(3),
    "conferenceSystemSnap" TEXT,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_register_conference_revisions" (
    "id" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "systemSnap" TEXT,
    "savedByUserId" TEXT,
    "savedByOpId" TEXT,
    "savedByOpName" TEXT,
    "pinAuthType" TEXT,
    "pinAuthManagerId" TEXT,
    "pinAuthManagerName" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_register_conference_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "costPrice" DECIMAL(10,4),
    "reason" TEXT,
    "origin" TEXT DEFAULT 'MANUAL',
    "referenceId" TEXT,
    "referenceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numeracao_nfce" (
    "id" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "numeracao_nfce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "discountPin" TEXT,
    "cashierPin" TEXT,
    "enableExpiryControl" BOOLEAN NOT NULL DEFAULT false,
    "expiryAlertDays" INTEGER NOT NULL DEFAULT 30,
    "lowStockAlertDefault" INTEGER NOT NULL DEFAULT 5,
    "paymentMethodsConfig" JSONB,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_modifier_groups" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelected" INTEGER NOT NULL DEFAULT 1,
    "maxSelected" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "product_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_modifier_options" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "priceAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "product_modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_item_modifiers" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "priceAdjustment" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "sale_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lots" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "costPrice" DECIMAL(10,4) NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "remaining" DECIMAL(10,3) NOT NULL,
    "lotNumber" TEXT,
    "expiresAt" TIMESTAMP(3),
    "supplierId" TEXT,
    "cProdFornecedor" TEXT,
    "loteFornecedor" TEXT,
    "dataFabricacao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lot_consumptions" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "stock_lot_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT,
    "cnpjCpf" TEXT,
    "email" TEXT,
    "ie" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "municipio" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cProdFornecedor" TEXT,
    "expectedCost" DECIMAL(10,4),

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packagings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiplier" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packagings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalEstimated" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalReal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitMultiplier" INTEGER NOT NULL DEFAULT 1,
    "unitName" TEXT NOT NULL DEFAULT 'UN',
    "expectedCost" DECIMAL(10,4) NOT NULL,
    "realCost" DECIMAL(10,4),

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL DEFAULT 'VARIABLE',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceId" VARCHAR(36),
    "recurrenceMonth" VARCHAR(7),
    "recurrenceDay" INTEGER,
    "category" TEXT,
    "supplierId" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_entradas" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "cnpjFornecedor" TEXT NOT NULL,
    "nomeFornecedor" TEXT NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "quantItens" INTEGER NOT NULL DEFAULT 0,
    "status" "FiscalImportStatus" NOT NULL DEFAULT 'RECEBIDA',
    "xmlPath" TEXT,
    "xmlHash" TEXT,
    "xmlSize" INTEGER,
    "xmlVersion" TEXT,
    "schemaVersion" TEXT,
    "importadaEm" TIMESTAMP(3),
    "nsu" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_entradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_entrada_itens" (
    "id" TEXT NOT NULL,
    "nfeEntradaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigoFornecedor" TEXT,
    "codigoBarras" TEXT,
    "ncm" TEXT,
    "cest" TEXT,
    "cfop" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'UN',
    "quantidade" DECIMAL(10,3) NOT NULL,
    "custoUnitario" DECIMAL(10,4) NOT NULL,
    "custoTotal" DECIMAL(10,2) NOT NULL,
    "uCom" TEXT,
    "qCom" DECIMAL(10,3),
    "vUnCom" DECIMAL(10,4),
    "cEANTrib" TEXT,
    "cstIcms" TEXT,
    "aliqIcms" DECIMAL(5,2),
    "vBCIcms" DECIMAL(10,2),
    "vIcms" DECIMAL(10,2),
    "cstPis" TEXT,
    "aliqPis" DECIMAL(5,2),
    "vPis" DECIMAL(10,2),
    "cstCofins" TEXT,
    "aliqCofins" DECIMAL(5,2),
    "vCofins" DECIMAL(10,2),
    "cstIpi" TEXT,
    "aliqIpi" DECIMAL(5,2),
    "vIpi" DECIMAL(10,2),
    "ibsCst" TEXT,
    "ibsAliq" DECIMAL(5,2),
    "vIbs" DECIMAL(10,2),
    "cbsCst" TEXT,
    "cbsAliq" DECIMAL(5,2),
    "vCbs" DECIMAL(10,2),
    "status" "FiscalImportStatus" NOT NULL DEFAULT 'RECEBIDA',
    "productId" TEXT,

    CONSTRAINT "nfe_entrada_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_events" (
    "id" TEXT NOT NULL,
    "nfeEntradaId" TEXT,
    "type" "FiscalEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_failed_jobs" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "error" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_failed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comandas" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "responsibleWaiterId" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comandas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comanda_items" (
    "assetNumber" INTEGER,
    "timerStartedAt" TIMESTAMP(3),
    "timerMinutes" INTEGER,
    "timerDueAt" TIMESTAMP(3),
    "assetReturnedAt" TIMESTAMP(3),
    "kdsDestination" TEXT,
    "kdsStatus" TEXT,
    "kdsSentAt" TIMESTAMP(3),
    "kdsReadyAt" TIMESTAMP(3),
    "kdsDeliveredAt" TIMESTAMP(3),
    "serveImmediately" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comanda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comanda_asset_reservations" (
    "assetNumber" INTEGER NOT NULL,
    "comandaItemId" TEXT NOT NULL,

    CONSTRAINT "comanda_asset_reservations_pkey" PRIMARY KEY ("assetNumber")
);

-- CreateTable
CREATE TABLE "comanda_item_modifiers" (
    "id" TEXT NOT NULL,
    "comandaItemId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "consumedQuantity" DECIMAL(10,3) NOT NULL,
    "priceAdjustment" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "comanda_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitrine_config" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "publishedByName" TEXT,
    "draftUpdatedAt" TIMESTAMP(3),
    "theme" TEXT NOT NULL DEFAULT 'dark_premium',
    "customBgUrl" TEXT,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "logoPosition" TEXT,
    "slideDuration" INTEGER NOT NULL DEFAULT 8,
    "draftSlides" JSONB NOT NULL DEFAULT '[]',
    "publishedSlides" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vitrine_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "priceSell" DECIMAL(10,2) NOT NULL,
    "priceCost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ncm" TEXT,
    "cest" TEXT,
    "origem" INTEGER NOT NULL DEFAULT 0,
    "grupoTributacaoId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_returns" (
    "id" TEXT NOT NULL,
    "requestKey" VARCHAR(80) NOT NULL,
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "operatorId" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restock" BOOLEAN NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "retail_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_credits" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_credit_uses" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credit_uses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_shortCode_key" ON "products"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_retailGroupId_variantKey_key" ON "products"("retailGroupId", "variantKey");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "operator_consumptions_saleId_key" ON "operator_consumptions"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_nfceChave_key" ON "sales"("nfceChave");

-- CreateIndex
CREATE INDEX "sales_code_idx" ON "sales"("code");

-- CreateIndex
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");

-- CreateIndex
CREATE INDEX "sale_delivery_jobs_status_availableAt_idx" ON "sale_delivery_jobs"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "sale_delivery_jobs_saleId_kind_key" ON "sale_delivery_jobs"("saleId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "product_payment_method_prices_productId_paymentMethodId_key" ON "product_payment_method_prices"("productId", "paymentMethodId");

-- CreateIndex
CREATE INDEX "cash_registers_code_idx" ON "cash_registers"("code");

-- CreateIndex
CREATE INDEX "cash_registers_status_idx" ON "cash_registers"("status");

-- CreateIndex
CREATE INDEX "cash_register_conference_revisions_cashRegisterId_idx" ON "cash_register_conference_revisions"("cashRegisterId");

-- CreateIndex
CREATE INDEX "cash_movements_createdAt_idx" ON "cash_movements"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "numeracao_nfce_serie_key" ON "numeracao_nfce"("serie");

-- CreateIndex
CREATE INDEX "stock_lots_expiresAt_idx" ON "stock_lots"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplierId_productId_key" ON "supplier_products"("supplierId", "productId");

-- CreateIndex
CREATE INDEX "payables_status_dueDate_idx" ON "payables"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "payables_recurrenceId_recurrenceMonth_key" ON "payables"("recurrenceId", "recurrenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_entradas_chave_key" ON "nfe_entradas"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_entradas_xmlHash_key" ON "nfe_entradas"("xmlHash");

-- CreateIndex
CREATE INDEX "nfe_entradas_status_idx" ON "nfe_entradas"("status");

-- CreateIndex
CREATE INDEX "nfe_entradas_cnpjFornecedor_idx" ON "nfe_entradas"("cnpjFornecedor");

-- CreateIndex
CREATE INDEX "nfe_entradas_createdAt_idx" ON "nfe_entradas"("createdAt");

-- CreateIndex
CREATE INDEX "nfe_entrada_itens_nfeEntradaId_idx" ON "nfe_entrada_itens"("nfeEntradaId");

-- CreateIndex
CREATE INDEX "nfe_entrada_itens_codigoBarras_idx" ON "nfe_entrada_itens"("codigoBarras");

-- CreateIndex
CREATE INDEX "fiscal_events_nfeEntradaId_idx" ON "fiscal_events"("nfeEntradaId");

-- CreateIndex
CREATE INDEX "fiscal_events_type_idx" ON "fiscal_events"("type");

-- CreateIndex
CREATE INDEX "fiscal_events_correlationId_idx" ON "fiscal_events"("correlationId");

-- CreateIndex
CREATE INDEX "fiscal_failed_jobs_resolved_idx" ON "fiscal_failed_jobs"("resolved");

-- CreateIndex
CREATE INDEX "fiscal_failed_jobs_action_idx" ON "fiscal_failed_jobs"("action");

-- CreateIndex
CREATE INDEX "comandas_status_idx" ON "comandas"("status");

-- CreateIndex
CREATE INDEX "comandas_responsibleWaiterId_idx" ON "comandas"("responsibleWaiterId");

-- CreateIndex
CREATE INDEX "comanda_items_kdsStatus_kdsSentAt_idx" ON "comanda_items"("kdsStatus", "kdsSentAt");

-- CreateIndex
CREATE INDEX "comanda_items_comandaId_idx" ON "comanda_items"("comandaId");

-- CreateIndex
CREATE INDEX "comanda_items_createdById_idx" ON "comanda_items"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "comanda_asset_reservations_comandaItemId_key" ON "comanda_asset_reservations"("comandaItemId");

-- CreateIndex
CREATE INDEX "comanda_item_modifiers_comandaItemId_idx" ON "comanda_item_modifiers"("comandaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "retail_groups_name_key" ON "retail_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "retail_returns_requestKey_key" ON "retail_returns"("requestKey");

-- CreateIndex
CREATE INDEX "retail_returns_saleId_idx" ON "retail_returns"("saleId");

-- CreateIndex
CREATE INDEX "retail_return_items_saleItemId_idx" ON "retail_return_items"("saleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "retail_return_items_returnId_saleItemId_key" ON "retail_return_items"("returnId", "saleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "store_credits_returnId_key" ON "store_credits"("returnId");

-- CreateIndex
CREATE INDEX "store_credits_customerId_idx" ON "store_credits"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "store_credit_uses_creditId_saleId_key" ON "store_credit_uses"("creditId", "saleId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_grupoTributacaoId_fkey" FOREIGN KEY ("grupoTributacaoId") REFERENCES "grupo_tributacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_retailGroupId_fkey" FOREIGN KEY ("retailGroupId") REFERENCES "retail_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_grupoTributacaoId_fkey" FOREIGN KEY ("grupoTributacaoId") REFERENCES "grupo_tributacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_consumptions" ADD CONSTRAINT "operator_consumptions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_consumptions" ADD CONSTRAINT "operator_consumptions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_delivery_jobs" ADD CONSTRAINT "sale_delivery_jobs_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_payment_method_prices" ADD CONSTRAINT "product_payment_method_prices_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "tenant_payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_conference_revisions" ADD CONSTRAINT "cash_register_conference_revisions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_options" ADD CONSTRAINT "product_modifier_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "product_modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_options" ADD CONSTRAINT "product_modifier_options_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item_modifiers" ADD CONSTRAINT "sale_item_modifiers_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_item_modifiers" ADD CONSTRAINT "sale_item_modifiers_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "stock_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entradas" ADD CONSTRAINT "nfe_entradas_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entrada_itens" ADD CONSTRAINT "nfe_entrada_itens_nfeEntradaId_fkey" FOREIGN KEY ("nfeEntradaId") REFERENCES "nfe_entradas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_entrada_itens" ADD CONSTRAINT "nfe_entrada_itens_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_events" ADD CONSTRAINT "fiscal_events_nfeEntradaId_fkey" FOREIGN KEY ("nfeEntradaId") REFERENCES "nfe_entradas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandas" ADD CONSTRAINT "comandas_responsibleWaiterId_fkey" FOREIGN KEY ("responsibleWaiterId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comandas" ADD CONSTRAINT "comandas_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "comandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_asset_reservations" ADD CONSTRAINT "comanda_asset_reservations_comandaItemId_fkey" FOREIGN KEY ("comandaItemId") REFERENCES "comanda_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_item_modifiers" ADD CONSTRAINT "comanda_item_modifiers_comandaItemId_fkey" FOREIGN KEY ("comandaItemId") REFERENCES "comanda_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_item_modifiers" ADD CONSTRAINT "comanda_item_modifiers_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_groups" ADD CONSTRAINT "retail_groups_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_returns" ADD CONSTRAINT "retail_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_returns" ADD CONSTRAINT "retail_returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_return_items" ADD CONSTRAINT "retail_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "retail_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_return_items" ADD CONSTRAINT "retail_return_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credits" ADD CONSTRAINT "store_credits_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "retail_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credits" ADD CONSTRAINT "store_credits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_uses" ADD CONSTRAINT "store_credit_uses_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "store_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_uses" ADD CONSTRAINT "store_credit_uses_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

