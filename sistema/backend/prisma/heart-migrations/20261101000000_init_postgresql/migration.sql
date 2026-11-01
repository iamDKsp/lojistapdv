-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "database_name" TEXT NOT NULL,
    "database_url" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "logoUrl" TEXT,
    "modulos" JSONB DEFAULT '{"nfce": true, "estoque": true, "dashboardMobile": true}',
    "tv_public_id" TEXT,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "cnpj" TEXT,
    "ie" TEXT,
    "im" TEXT,
    "crt" INTEGER NOT NULL DEFAULT 1,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "municipio" TEXT,
    "codMunicipio" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "telefone" TEXT,
    "emailContador" TEXT,
    "nfceAtivo" BOOLEAN NOT NULL DEFAULT false,
    "nfceAutoSync" BOOLEAN NOT NULL DEFAULT true,
    "nfceSerie" INTEGER NOT NULL DEFAULT 1,
    "nfceAmbiente" INTEGER NOT NULL DEFAULT 2,
    "nfceCsc" TEXT,
    "nfceIdCsc" TEXT,
    "certPfx" BYTEA,
    "certSenha" TEXT,
    "certValidade" TIMESTAMP(3),
    "cosmosApiKey" TEXT,
    "mensalidade_valor" DECIMAL(10,2) DEFAULT 0.00,
    "mensalidade_vencimento" TIMESTAMP(3),
    "telefone_contato" TEXT,
    "email_contato" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "terms_accepted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_access_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_access_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "pin" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_products" (
    "id" TEXT NOT NULL,
    "ean" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "ncm" TEXT,
    "cest" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "imageUrl" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'openfoodfacts',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_integrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "credentials" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "alias" TEXT,

    CONSTRAINT "tenant_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_sync_states" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ultimoNSU" TEXT NOT NULL DEFAULT '0',
    "ultimaConsulta" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'idle',
    "notasBaixadas" INTEGER NOT NULL DEFAULT 0,
    "tempoGastoMs" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "correlationId" TEXT,
    "lastDiagnostico" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfe_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProfile" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,

    CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProfileFiscal" (
    "storeProfileId" TEXT NOT NULL,
    "fiscalProfileId" TEXT NOT NULL,

    CONSTRAINT "StoreProfileFiscal_pkey" PRIMARY KEY ("storeProfileId","fiscalProfileId")
);

-- CreateTable
CREATE TABLE "FiscalProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "group" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "tenantId" TEXT,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "emiteNfce" BOOLEAN NOT NULL DEFAULT true,
    "ncm" TEXT,
    "cest" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "observacoes" TEXT,

    CONSTRAINT "FiscalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalTaxRule" (
    "id" TEXT NOT NULL,
    "fiscalProfileId" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "csosn" TEXT,
    "cstIcms" TEXT,
    "aliqIcms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cstPis" TEXT NOT NULL DEFAULT '99',
    "aliqPis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cstCofins" TEXT NOT NULL DEFAULT '99',
    "aliqCofins" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ibsCst" TEXT NOT NULL DEFAULT '99',
    "ibsAliq" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cbsCst" TEXT NOT NULL DEFAULT '99',
    "cbsAliq" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "FiscalTaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalProfileHistory" (
    "id" TEXT NOT NULL,
    "fiscalProfileId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "FiscalProfileHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalFavorite" (
    "tenantId" TEXT NOT NULL,
    "fiscalProfileId" TEXT NOT NULL,

    CONSTRAINT "FiscalFavorite_pkey" PRIMARY KEY ("tenantId","fiscalProfileId")
);

-- CreateTable
CREATE TABLE "payment_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimentoAntes" TIMESTAMP(3) NOT NULL,
    "vencimentoApos" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "registradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOVO',
    "source" TEXT NOT NULL DEFAULT 'demo',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_database_name_key" ON "tenants"("database_name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_tv_public_id_key" ON "tenants"("tv_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "station_access_links_tokenHash_key" ON "station_access_links"("tokenHash");

-- CreateIndex
CREATE INDEX "station_access_links_tenantId_station_idx" ON "station_access_links"("tenantId", "station");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "master_products_ean_key" ON "master_products"("ean");

-- CreateIndex
CREATE INDEX "master_products_ean_idx" ON "master_products"("ean");

-- CreateIndex
CREATE INDEX "master_products_name_idx" ON "master_products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_integrations_tenantId_provider_key" ON "tenant_integrations"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_group_members_groupId_tenantId_key" ON "tenant_group_members"("groupId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_sync_states_tenantId_key" ON "nfe_sync_states"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreProfile_slug_key" ON "StoreProfile"("slug");

-- CreateIndex
CREATE INDEX "payment_logs_tenantId_idx" ON "payment_logs"("tenantId");

-- CreateIndex
CREATE INDEX "payment_logs_createdAt_idx" ON "payment_logs"("createdAt");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- AddForeignKey
ALTER TABLE "station_access_links" ADD CONSTRAINT "station_access_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "tenant_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_integrations" ADD CONSTRAINT "tenant_integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_group_members" ADD CONSTRAINT "tenant_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "tenant_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_group_members" ADD CONSTRAINT "tenant_group_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProfileFiscal" ADD CONSTRAINT "StoreProfileFiscal_storeProfileId_fkey" FOREIGN KEY ("storeProfileId") REFERENCES "StoreProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreProfileFiscal" ADD CONSTRAINT "StoreProfileFiscal_fiscalProfileId_fkey" FOREIGN KEY ("fiscalProfileId") REFERENCES "FiscalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTaxRule" ADD CONSTRAINT "FiscalTaxRule_fiscalProfileId_fkey" FOREIGN KEY ("fiscalProfileId") REFERENCES "FiscalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalProfileHistory" ADD CONSTRAINT "FiscalProfileHistory_fiscalProfileId_fkey" FOREIGN KEY ("fiscalProfileId") REFERENCES "FiscalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalFavorite" ADD CONSTRAINT "FiscalFavorite_fiscalProfileId_fkey" FOREIGN KEY ("fiscalProfileId") REFERENCES "FiscalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

