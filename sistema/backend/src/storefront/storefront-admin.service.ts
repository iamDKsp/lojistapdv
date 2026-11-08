import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { getActiveReservedQuantities } from '../prisma/stock-reservations.helper';
import {
  checkStorefrontSchemaCompatibility,
  isStorefrontSchemaMissingError,
} from '../tenants/tenant-schema-upgrade';
import {
  assertValidStorefrontSlug,
  buildProductPublicSlug,
  getDefaultStorefrontTheme,
  normalizeStorefrontSlug,
  normalizeWhatsappPhone,
  sanitizePlainText,
  sanitizeSafeImageUrl,
  validateAndSanitizeTheme,
} from './storefront.rules';

@Injectable()
export class StorefrontAdminService {
  private readonly logger = new Logger(StorefrontAdminService.name);

  constructor(
    private readonly heartPrisma: HeartPrismaService,
    private readonly tenantManager: TenantConnectionManager,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async getContextAndDb() {
    const ctx = this.tenantContext.get();
    const db = await this.tenantManager.getTenantClient(
      ctx.tenantId,
      ctx.databaseUrl,
    );
    return { ctx, db };
  }

  private async getTenantRecord(tenantId: string) {
    if (!this.heartPrisma?.tenant?.findUnique) return null;
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
    });
    return tenant;
  }

  private isModuleEnabledOnTenant(tenant: any): boolean {
    if (!tenant || tenant.status !== 'active') return false;
    const modulos =
      typeof tenant.modulos === 'string'
        ? JSON.parse(tenant.modulos || '{}')
        : tenant.modulos || {};
    return Boolean(modulos.lojaVirtual);
  }

  async assertModuleAndSchemaReady(requireModuleEnabled = true) {
    const { ctx, db } = await this.getContextAndDb();
    const tenant = await this.getTenantRecord(ctx.tenantId);

    if (requireModuleEnabled && tenant && !this.isModuleEnabledOnTenant(tenant)) {
      throw new ForbiddenException(
        'O módulo Loja Virtual está desativado para esta empresa. Ative-o no painel /sys-init ou solicite a ativação ao suporte.',
      );
    }

    const compat = await checkStorefrontSchemaCompatibility(this.heartPrisma, db);
    if (!compat.compatible) {
      throw new ServiceUnavailableException({
        code: 'SCHEMA_UPGRADE_REQUIRED',
        message:
          compat.message ||
          'O banco de dados precisa ser atualizado via /sys-init para utilizar a Loja Virtual.',
        missingTables: compat.missingTables,
      });
    }

    return { ctx, db, tenant, compat };
  }

  private buildDefaultSlug(tenant: any, tenantId: string): string {
    const rawName =
      tenant?.nomeFantasia || tenant?.name || tenant?.databaseName || 'loja';
    const base = normalizeStorefrontSlug(rawName) || 'loja';
    const shortId = String(tenantId || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .slice(0, 6);
    const candidate = base.length >= 3 ? base : `loja-${base}`;
    return shortId ? `${candidate}-${shortId}` : candidate;
  }

  async ensureSettingsInitialized(db: any, tenant: any, tenantId: string) {
    let settings = await db.storefrontSettings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      const storeName =
        sanitizePlainText(
          tenant?.nomeFantasia || tenant?.name || 'Minha Loja',
          120,
        ) || 'Minha Loja';
      let defaultSlug = this.buildDefaultSlug(tenant, tenantId);

      // Evitar colisão no Heart se o slug já pertencer a outro tenant
      if (this.heartPrisma?.storefrontRegistry?.findUnique) {
        const collision = await this.heartPrisma.storefrontRegistry.findUnique({
          where: { slug: defaultSlug },
        });
        if (collision && collision.tenantId !== tenantId) {
          defaultSlug = `${defaultSlug}-${randomUUID().slice(0, 4)}`;
        }
      }

      const defaultTheme = getDefaultStorefrontTheme(storeName);
      let defaultPhone: string | null = null;
      try {
        if (tenant?.telefoneContato || tenant?.telefone) {
          defaultPhone = normalizeWhatsappPhone(
            tenant.telefoneContato || tenant.telefone,
          );
        }
      } catch {
        defaultPhone = null;
      }

      const initialPublished = tenant ? this.isModuleEnabledOnTenant(tenant) : true;
      settings = await db.storefrontSettings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: {
          id: 'singleton',
          publicId: randomUUID(),
          slug: defaultSlug,
          storeName,
          tagline: 'Moda, calçados e acessórios com atendimento pelo WhatsApp',
          description: `Catálogo oficial de ${storeName}. Escolha suas peças e finalize seu pedido pelo WhatsApp.`,
          logoUrl: tenant?.logoUrl || null,
          whatsappPhone: defaultPhone,
          whatsappMessageIntro: `Olá! Fiz um pedido pelo catálogo online da *${storeName}*.`,
          pickupEnabled: true,
          pickupInstructions:
            'Retire na loja física após a confirmação da separação pelo WhatsApp.',
          deliveryEnabled: true,
          deliveryInstructions:
            'Taxa e prazo de entrega combinados diretamente pelo WhatsApp.',
          deliveryFeeNote: 'Frete a combinar pelo WhatsApp',
          confirmReservationMinutes: 15,
          confirmedHoldHours: 24,
          draftThemeJson: defaultTheme as any,
          publishedThemeJson: defaultTheme as any,
          publishedVersion: initialPublished ? 1 : 0,
          isPublished: initialPublished,
          publishedAt: initialPublished ? new Date() : null,
        },
      });
    } else if (
      Number(settings.publishedVersion ?? 0) === 0 &&
      !settings.isPublished &&
      (tenant ? this.isModuleEnabledOnTenant(tenant) : true)
    ) {
      settings = await db.storefrontSettings.update({
        where: { id: 'singleton' },
        data: {
          publishedVersion: 1,
          isPublished: true,
          publishedAt: new Date(),
        },
      });
    }

    await this.syncRegistryToHeart(settings, tenant, tenantId);
    return settings;
  }

  /**
   * Sincronização idempotente entre StorefrontSettings (banco do tenant) e StorefrontRegistry (banco Heart).
   * Permite recuperação automática caso uma falha parcial ocorra entre os dois bancos.
   */
  async syncRegistryToHeart(settings: any, tenant: any, tenantId: string) {
    if (!this.heartPrisma?.storefrontRegistry?.upsert) return null;

    const moduleEnabled = this.isModuleEnabledOnTenant(tenant);
    const existingBySlug = await this.heartPrisma.storefrontRegistry.findUnique({
      where: { slug: settings.slug },
    });
    if (existingBySlug && existingBySlug.tenantId !== tenantId) {
      throw new ConflictException(
        `O endereço público "${settings.slug}" já está em uso por outra loja. Escolha outro endereço.`,
      );
    }

    return this.heartPrisma.storefrontRegistry.upsert({
      where: { tenantId },
      update: {
        publicId: settings.publicId,
        slug: settings.slug,
        storeName: settings.storeName || tenant?.nomeFantasia || tenant?.name || '',
        enabled: moduleEnabled,
        published: Boolean(settings.isPublished && moduleEnabled),
        publishedVersion: Number(settings.publishedVersion ?? 0),
      },
      create: {
        publicId: settings.publicId,
        tenantId,
        slug: settings.slug,
        storeName: settings.storeName || tenant?.nomeFantasia || tenant?.name || '',
        enabled: moduleEnabled,
        published: Boolean(settings.isPublished && moduleEnabled),
        publishedVersion: Number(settings.publishedVersion ?? 0),
      },
    });
  }

  async getOverview() {
    const { ctx, db } = await this.getContextAndDb();
    const tenant = await this.getTenantRecord(ctx.tenantId);
    const moduleEnabled = tenant ? this.isModuleEnabledOnTenant(tenant) : true;
    const compat = await checkStorefrontSchemaCompatibility(this.heartPrisma, db);

    if (!compat.compatible) {
      return {
        moduleEnabled,
        schemaCompatible: false,
        missingTables: compat.missingTables,
        message: compat.message,
        settings: null,
        stats: null,
      };
    }

    try {
      const settings = await this.ensureSettingsInitialized(
        db,
        tenant,
        ctx.tenantId,
      );
      await this.ensureCategoriesSynced(db);

      const now = new Date();
      const [
        totalRetailGroups,
        publishedProductsCount,
        featuredProductsCount,
        awaitingOrdersCount,
        confirmedOrdersCount,
        completedOrdersCount,
        conflictOrdersCount,
        activeReservationsAgg,
      ] = await Promise.all([
        db.retailGroup.count({ where: { active: true } }),
        db.storefrontProduct.count({
          where: { visible: true, retailGroup: { active: true } },
        }),
        db.storefrontProduct.count({
          where: { visible: true, featured: true, retailGroup: { active: true } },
        }),
        db.storefrontOrder.count({
          where: { commercialStatus: 'AWAITING_CONFIRMATION' },
        }),
        db.storefrontOrder.count({
          where: { commercialStatus: 'CONFIRMED' },
        }),
        db.storefrontOrder.count({
          where: { commercialStatus: 'COMPLETED' },
        }),
        db.storefrontOrder.count({
          where: {
            offlineConflictDetected: true,
            commercialStatus: { in: ['AWAITING_CONFIRMATION', 'CONFIRMED'] },
          },
        }),
        db.stockReservation.aggregate({
          where: { status: 'ACTIVE', expiresAt: { gt: now } },
          _sum: { quantity: true },
          _count: { id: true },
        }),
      ]);

      const visibleCategoriesCount =
        typeof db.storefrontCategory?.count === 'function'
          ? await db.storefrontCategory
              .count({ where: { visible: true } })
              .catch(() => 0)
          : 0;
      const convertedRevenueAgg =
        typeof db.storefrontOrder?.aggregate === 'function'
          ? await db.storefrontOrder
              .aggregate({
                where: { commercialStatus: 'COMPLETED' },
                _sum: { total: true },
              })
              .catch(() => null)
          : null;

      const formattedSettings = this.formatSettingsResponse(
        settings,
        moduleEnabled,
      );
      const statsObj = {
        totalRetailGroups,
        totalProductsCount: totalRetailGroups,
        publishedProductsCount,
        visibleProductsCount: publishedProductsCount,
        unpublishedProductsCount: Math.max(
          0,
          totalRetailGroups - publishedProductsCount,
        ),
        featuredProductsCount,
        visibleCategoriesCount,
        awaitingOrdersCount,
        awaitingConfirmationCount: awaitingOrdersCount,
        confirmedOrdersCount,
        completedOrdersCount,
        convertedOrdersCount: completedOrdersCount,
        convertedRevenue: Number(convertedRevenueAgg?._sum?.total ?? 0),
        conflictOrdersCount,
        activeReservationsCount: Number(activeReservationsAgg?._count?.id ?? 0),
        activeReservedUnits: Number(activeReservationsAgg?._sum?.quantity ?? 0),
      };

      const readinessChecklist = [
        {
          key: 'whatsapp',
          label: 'WhatsApp comercial configurado',
          done: Boolean(
            settings.whatsappPhone &&
              String(settings.whatsappPhone).replace(/\D/g, '').length >= 10,
          ),
        },
        {
          key: 'fulfillment',
          label: 'Modalidade de entrega ou retirada ativa',
          done: Boolean(settings.pickupEnabled || settings.deliveryEnabled),
        },
        {
          key: 'products',
          label: 'Pelo menos 1 produto visível na vitrine',
          done: publishedProductsCount > 0,
        },
        {
          key: 'branding',
          label: 'Identidade visual configurada (nome e tema)',
          done: Boolean(settings.storeName && settings.slug),
        },
      ];

      return {
        moduleEnabled,
        schemaCompatible: true,
        missingTables: [],
        publicPath: `/loja/${settings.slug}`,
        settings: formattedSettings,
        config: formattedSettings,
        stats: statsObj,
        metrics: statsObj,
        readinessChecklist,
      };
    } catch (err) {
      if (isStorefrontSchemaMissingError(err)) {
        return {
          moduleEnabled,
          schemaCompatible: false,
          missingTables: compat.missingTables,
          message:
            'Atualize o schema do banco via /sys-init para habilitar a Loja Virtual.',
          settings: null,
          stats: null,
        };
      }
      throw err;
    }
  }

  private formatSettingsResponse(settings: any, moduleEnabled = true) {
    const draftTheme = validateAndSanitizeTheme(
      settings.draftThemeJson,
      settings.storeName,
    );
    const publishedTheme = validateAndSanitizeTheme(
      settings.publishedThemeJson,
      settings.storeName,
    );
    const isPublished = Boolean(settings.isPublished);
    const confirmMins = Number(settings.confirmReservationMinutes ?? 15);
    return {
      publicId: settings.publicId,
      slug: settings.slug,
      publicPath: `/loja/${settings.slug}`,
      storeName: settings.storeName,
      tagline: settings.tagline || '',
      description: settings.description || '',
      logoUrl: settings.logoUrl || null,
      coverUrl: settings.coverUrl || null,
      whatsappPhone: settings.whatsappPhone || '',
      whatsappMessageIntro: settings.whatsappMessageIntro || '',
      pickupEnabled: Boolean(settings.pickupEnabled),
      pickupInstructions: settings.pickupInstructions || '',
      deliveryEnabled: Boolean(settings.deliveryEnabled),
      deliveryInstructions: settings.deliveryInstructions || '',
      deliveryNotes: settings.deliveryInstructions || '',
      deliveryFeeNote: settings.deliveryFeeNote || '',
      deliveryFeeDefault: 0,
      confirmReservationMinutes: confirmMins,
      reservationTtlMinutes: confirmMins,
      confirmedHoldHours: Number(settings.confirmedHoldHours ?? 24),
      draftTheme,
      publishedTheme,
      publishedVersion: Number(settings.publishedVersion ?? 0),
      isPublished,
      status: isPublished ? 'PUBLISHED' : 'DRAFT',
      effectivelyOnline: Boolean(isPublished && moduleEnabled),
      publishedAt: settings.publishedAt || null,
      publishedByName: settings.publishedByName || null,
      updatedAt: settings.updatedAt,
    };
  }

  async getSettings() {
    const { ctx, db, tenant } = await this.assertModuleAndSchemaReady(false);
    const settings = await this.ensureSettingsInitialized(
      db,
      tenant,
      ctx.tenantId,
    );
    const moduleEnabled = tenant ? this.isModuleEnabledOnTenant(tenant) : true;
    return this.formatSettingsResponse(settings, moduleEnabled);
  }

  async updateSettings(body: any) {
    const { ctx, db, tenant } = await this.assertModuleAndSchemaReady(true);
    const current = await this.ensureSettingsInitialized(
      db,
      tenant,
      ctx.tenantId,
    );

    const rawSlug = body?.slug !== undefined ? String(body.slug).trim() : '';
    const slug = rawSlug
      ? assertValidStorefrontSlug(rawSlug)
      : current.slug;

    if (slug !== current.slug && this.heartPrisma?.storefrontRegistry?.findUnique) {
      const existing = await this.heartPrisma.storefrontRegistry.findUnique({
        where: { slug },
      });
      if (existing && existing.tenantId !== ctx.tenantId) {
        throw new ConflictException(
          `O endereço "/loja/${slug}" já pertence a outra loja. Escolha outro identificador.`,
        );
      }
    }

    const rawStoreName =
      body?.storeName !== undefined ? String(body.storeName).trim() : '';
    const storeName = rawStoreName
      ? sanitizePlainText(rawStoreName, 140, 'Nome da loja')
      : current.storeName;
    if (!storeName || storeName.length < 2) {
      throw new BadRequestException('Informe o nome público da loja.');
    }

    let whatsappPhone = current.whatsappPhone;
    if (body?.whatsappPhone !== undefined) {
      const trimmedPhone = String(body.whatsappPhone || '').trim();
      if (!trimmedPhone) {
        whatsappPhone = null;
      } else {
        whatsappPhone = normalizeWhatsappPhone(trimmedPhone);
      }
    }

    const pickupEnabled =
      body?.pickupEnabled !== undefined
        ? Boolean(body.pickupEnabled)
        : Boolean(current.pickupEnabled);
    const deliveryEnabled =
      body?.deliveryEnabled !== undefined
        ? Boolean(body.deliveryEnabled)
        : Boolean(current.deliveryEnabled);

    if (!pickupEnabled && !deliveryEnabled) {
      throw new BadRequestException(
        'Habilite pelo menos uma modalidade de atendimento (Retirada na loja ou Entrega a combinar).',
      );
    }

    let confirmReservationMinutes = Number(
      current.confirmReservationMinutes ?? 15,
    );
    if (body?.confirmReservationMinutes !== undefined) {
      confirmReservationMinutes = Number(body.confirmReservationMinutes);
      if (
        !Number.isInteger(confirmReservationMinutes) ||
        confirmReservationMinutes < 5 ||
        confirmReservationMinutes > 120
      ) {
        throw new BadRequestException(
          'O prazo inicial de reserva deve ser entre 5 e 120 minutos.',
        );
      }
    } else if (body?.reservationTtlMinutes !== undefined) {
      const ttl = Number(body.reservationTtlMinutes);
      if (Number.isFinite(ttl) && ttl >= 5) {
        confirmReservationMinutes = Math.min(120, Math.max(5, Math.round(ttl)));
      }
    }

    const confirmedHoldHours =
      body?.confirmedHoldHours !== undefined
        ? Number(body.confirmedHoldHours)
        : Number(current.confirmedHoldHours ?? 24);
    if (
      !Number.isInteger(confirmedHoldHours) ||
      confirmedHoldHours < 1 ||
      confirmedHoldHours > 168
    ) {
      throw new BadRequestException(
        'O prazo de atendimento após confirmação deve ser entre 1 e 168 horas.',
      );
    }

    const rawDeliveryInstructions =
      body?.deliveryInstructions !== undefined
        ? body.deliveryInstructions
        : body?.deliveryNotes;

    const updated = await db.storefrontSettings.update({
      where: { id: 'singleton' },
      data: {
        slug,
        storeName,
        tagline:
          body?.tagline !== undefined
            ? sanitizePlainText(body.tagline, 240, 'Subtítulo') || null
            : current.tagline,
        description:
          body?.description !== undefined
            ? sanitizePlainText(body.description, 2000, 'Apresentação') || null
            : current.description,
        logoUrl:
          body?.logoUrl !== undefined
            ? sanitizeSafeImageUrl(body.logoUrl)
            : current.logoUrl,
        coverUrl:
          body?.coverUrl !== undefined
            ? sanitizeSafeImageUrl(body.coverUrl)
            : current.coverUrl,
        whatsappPhone,
        whatsappMessageIntro:
          body?.whatsappMessageIntro !== undefined
            ? sanitizePlainText(
                body.whatsappMessageIntro,
                300,
                'Mensagem inicial do WhatsApp',
              ) || null
            : current.whatsappMessageIntro,
        pickupEnabled,
        pickupInstructions:
          body?.pickupInstructions !== undefined
            ? sanitizePlainText(
                body.pickupInstructions,
                600,
                'Instruções de retirada',
              ) || null
            : current.pickupInstructions,
        deliveryEnabled,
        deliveryInstructions:
          rawDeliveryInstructions !== undefined
            ? sanitizePlainText(
                rawDeliveryInstructions,
                600,
                'Instruções de entrega',
              ) || null
            : current.deliveryInstructions,
        deliveryFeeNote:
          body?.deliveryFeeNote !== undefined
            ? sanitizePlainText(body.deliveryFeeNote, 240, 'Nota de entrega') ||
              null
            : current.deliveryFeeNote,
        confirmReservationMinutes,
        confirmedHoldHours,
      },
    });

    await this.syncRegistryToHeart(updated, tenant, ctx.tenantId);
    return this.formatSettingsResponse(updated, true);
  }

  async saveAppearanceDraft(body: any) {
    const { ctx, db, tenant } = await this.assertModuleAndSchemaReady(true);
    const current = await this.ensureSettingsInitialized(
      db,
      tenant,
      ctx.tenantId,
    );

    const storeName =
      body?.storeName !== undefined
        ? sanitizePlainText(body.storeName, 140, 'Nome da loja') ||
          current.storeName
        : current.storeName;

    const rawThemeCandidate =
      body?.theme ??
      body?.draftTheme ??
      (body && (body.template || body.sections || body.primaryColor)
        ? body
        : current.draftThemeJson);

    const draftTheme = validateAndSanitizeTheme(rawThemeCandidate, storeName);

    const updated = await db.storefrontSettings.update({
      where: { id: 'singleton' },
      data: {
        storeName,
        tagline:
          body?.tagline !== undefined
            ? sanitizePlainText(body.tagline, 240, 'Subtítulo') || null
            : current.tagline,
        description:
          body?.description !== undefined
            ? sanitizePlainText(body.description, 2000, 'Apresentação') || null
            : current.description,
        logoUrl:
          body?.logoUrl !== undefined
            ? sanitizeSafeImageUrl(body.logoUrl)
            : current.logoUrl,
        coverUrl:
          body?.coverUrl !== undefined
            ? sanitizeSafeImageUrl(body.coverUrl)
            : current.coverUrl,
        draftThemeJson: draftTheme as any,
      },
    });

    return this.formatSettingsResponse(updated, true);
  }

  async publishStorefront(actor?: { userId?: string; name?: string }) {
    const { ctx, db, tenant } = await this.assertModuleAndSchemaReady(true);
    const current = await this.ensureSettingsInitialized(
      db,
      tenant,
      ctx.tenantId,
    );

    if (!current.pickupEnabled && !current.deliveryEnabled) {
      throw new BadRequestException(
        'Habilite pelo menos uma modalidade (Retirada ou Entrega) antes de publicar.',
      );
    }

    const validatedTheme = validateAndSanitizeTheme(
      current.draftThemeJson,
      current.storeName,
    );
    const now = new Date();

    const updated = await db.$transaction(async (tx: any) => {
      const latestRevision = await tx.storefrontRevision.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion =
        Math.max(
          Number(current.publishedVersion ?? 0),
          Number(latestRevision?.version ?? 0),
        ) + 1;

      await tx.storefrontRevision.updateMany({
        where: { status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });

      const settings = await tx.storefrontSettings.update({
        where: { id: 'singleton' },
        data: {
          draftThemeJson: validatedTheme as any,
          publishedThemeJson: validatedTheme as any,
          publishedVersion: nextVersion,
          isPublished: true,
          publishedAt: now,
          publishedByUserId: actor?.userId || ctx.userId || null,
          publishedByName: actor?.name || null,
        },
      });

      await tx.storefrontRevision.create({
        data: {
          version: nextVersion,
          status: 'PUBLISHED',
          themeJson: validatedTheme as any,
          settingsSnapshotJson: {
            slug: settings.slug,
            storeName: settings.storeName,
            tagline: settings.tagline,
            description: settings.description,
            logoUrl: settings.logoUrl,
            coverUrl: settings.coverUrl,
            whatsappPhone: settings.whatsappPhone,
            pickupEnabled: settings.pickupEnabled,
            deliveryEnabled: settings.deliveryEnabled,
          },
          createdByUserId: actor?.userId || ctx.userId || null,
          createdByName: actor?.name || null,
          publishedAt: now,
        },
      });

      return settings;
    });

    await this.syncRegistryToHeart(updated, tenant, ctx.tenantId);
    return this.formatSettingsResponse(updated, true);
  }

  async unpublishStorefront() {
    const { ctx, db, tenant } = await this.assertModuleAndSchemaReady(true);
    await this.ensureSettingsInitialized(db, tenant, ctx.tenantId);

    const updated = await db.storefrontSettings.update({
      where: { id: 'singleton' },
      data: {
        isPublished: false,
      },
    });

    await this.syncRegistryToHeart(updated, tenant, ctx.tenantId);
    return this.formatSettingsResponse(updated, true);
  }

  // ── Categorias da Loja Virtual ────────────────────────────────────────────

  async ensureCategoriesSynced(db: any) {
    const [categories, storefrontCategories] = await Promise.all([
      db.category.findMany({ orderBy: { name: 'asc' } }),
      db.storefrontCategory.findMany(),
    ]);

    const existingByCategoryId = new Map(
      storefrontCategories.map((sc: any) => [sc.categoryId, sc]),
    );
    const usedSlugs = new Set(
      storefrontCategories.map((sc: any) => String(sc.slug)),
    );

    let maxOrder = storefrontCategories.reduce(
      (max: number, sc: any) => Math.max(max, Number(sc.sortOrder ?? 0)),
      0,
    );

    for (const cat of categories) {
      if (existingByCategoryId.has(cat.id)) continue;
      maxOrder += 10;
      let baseSlug = normalizeStorefrontSlug(cat.name) || 'categoria';
      if (usedSlugs.has(baseSlug)) {
        baseSlug = `${baseSlug}-${cat.id.slice(0, 6).toLowerCase()}`;
      }
      usedSlugs.add(baseSlug);

      await db.storefrontCategory
        .create({
          data: {
            categoryId: cat.id,
            slug: baseSlug,
            displayName: cat.name,
            visible: true,
            featured: false,
            sortOrder: maxOrder,
          },
        })
        .catch(() => {});
    }
  }

  async getCategories() {
    const { db } = await this.assertModuleAndSchemaReady(false);
    await this.ensureCategoriesSynced(db);

    const rows = await db.storefrontCategory.findMany({
      include: {
        category: {
          include: {
            _count: {
              select: { retailGroups: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((sc: any) => {
      const count = Number(sc.category?._count?.retailGroups ?? 0);
      const vis = Boolean(sc.visible);
      return {
        id: sc.categoryId || sc.id,
        storefrontCategoryId: sc.id,
        categoryId: sc.categoryId,
        name: sc.category?.name || '',
        displayName: sc.displayName || sc.category?.name || '',
        slug: sc.slug,
        publicSlug: sc.slug,
        description: sc.description || '',
        icon: sc.category?.icon || null,
        visible: vis,
        isVisible: vis,
        featured: Boolean(sc.featured),
        sortOrder: Number(sc.sortOrder ?? 0),
        groupsCount: count,
        productCount: count,
      };
    });
  }

  async updateCategories(items: any[]) {
    const { db } = await this.assertModuleAndSchemaReady(true);
    if (!Array.isArray(items)) {
      throw new BadRequestException('Informe a lista de categorias para atualizar.');
    }

    await db.$transaction(async (tx: any) => {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const categoryId = String(item?.categoryId || item?.id || '');
        if (!categoryId) continue;

        const displayName =
          item.displayName !== undefined
            ? sanitizePlainText(item.displayName, 120, 'Nome da categoria') || null
            : undefined;
        const description =
          item.description !== undefined
            ? sanitizePlainText(
                item.description,
                300,
                'Descrição da categoria',
              ) || null
            : undefined;
        const rawVisible =
          item.visible !== undefined ? item.visible : item.isVisible;
        const rawSlug = item.slug ?? item.publicSlug;
        const normalizedSlug =
          rawSlug !== undefined && String(rawSlug).trim()
            ? normalizeStorefrontSlug(rawSlug)
            : undefined;

        await tx.storefrontCategory.updateMany({
          where: {
            OR: [{ categoryId }, { id: categoryId }],
          },
          data: {
            ...(displayName !== undefined ? { displayName } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(normalizedSlug ? { slug: normalizedSlug } : {}),
            ...(rawVisible !== undefined
              ? { visible: Boolean(rawVisible) }
              : {}),
            ...(item.featured !== undefined
              ? { featured: Boolean(item.featured) }
              : {}),
            sortOrder:
              item.sortOrder !== undefined
                ? Number(item.sortOrder)
                : (idx + 1) * 10,
          },
        });
      }
    });

    return this.getCategories();
  }

  async createCategory(body: {
    name: string;
    description?: string;
    visible?: boolean;
    isVisible?: boolean;
    featured?: boolean;
  }) {
    const { db } = await this.assertModuleAndSchemaReady(true);
    const name = sanitizePlainText(body?.name, 80, 'Nome da categoria');
    if (!name || name.length < 2) {
      throw new BadRequestException('Informe um nome válido para a categoria.');
    }

    const existing = await db.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`A categoria "${name}" já existe no catálogo.`);
    }

    await db.category.create({
      data: { name },
    });

    await this.ensureCategoriesSynced(db);

    const rawVisible =
      body.visible !== undefined ? body.visible : body.isVisible;
    if (
      body.description ||
      rawVisible !== undefined ||
      body.featured !== undefined
    ) {
      const createdCat = await db.category.findUnique({ where: { name } });
      if (createdCat) {
        await db.storefrontCategory.updateMany({
          where: { categoryId: createdCat.id },
          data: {
            description: body.description
              ? sanitizePlainText(body.description, 300)
              : null,
            visible: rawVisible !== false,
            featured: Boolean(body.featured),
          },
        });
      }
    }

    return this.getCategories();
  }

  // ── Produtos Publicados na Loja Virtual ───────────────────────────────────

  async ensureProductsSynced(db: any) {
    const [groups, sfProducts] = await Promise.all([
      db.retailGroup.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      db.storefrontProduct.findMany(),
    ]);

    const isInitialBootstrap = sfProducts.length === 0;
    if (
      !isInitialBootstrap &&
      sfProducts.every((sp: any) => !sp.visible) &&
      typeof db.storefrontRevision?.count === 'function'
    ) {
      const revCount = await db.storefrontRevision.count().catch(() => 1);
      if (revCount === 0 && typeof db.storefrontProduct?.updateMany === 'function') {
        await db.storefrontProduct
          .updateMany({
            where: {},
            data: { visible: true },
          })
          .catch(() => {});
      }
    }
    const existingByGroupId = new Map(
      sfProducts.map((sp: any) => [sp.retailGroupId, sp]),
    );
    const usedSlugs = new Set(
      sfProducts.map((sp: any) => String(sp.publicSlug)),
    );
    let maxOrder = sfProducts.reduce(
      (max: number, sp: any) => Math.max(max, Number(sp.sortOrder ?? 0)),
      0,
    );

    let createdIdx = 0;
    for (const rg of groups) {
      if (existingByGroupId.has(rg.id)) continue;
      maxOrder += 10;
      let slug = buildProductPublicSlug(rg.name, rg.id);
      if (usedSlugs.has(slug)) {
        slug = `${slug}-${randomUUID().slice(0, 4)}`;
      }
      usedSlugs.add(slug);

      await db.storefrontProduct
        .create({
          data: {
            retailGroupId: rg.id,
            publicSlug: slug,
            visible: isInitialBootstrap,
            featured: isInitialBootstrap && createdIdx < 8,
            sortOrder: maxOrder,
            commercialTitle: rg.name,
          },
        })
        .catch(() => {});
      createdIdx++;
    }
  }

  async getProducts(filters?: {
    search?: string;
    categoryId?: string;
    visibility?: 'all' | 'visible' | 'hidden';
    featured?: boolean;
  }) {
    const { db } = await this.assertModuleAndSchemaReady(false);
    await this.ensureProductsSynced(db);

    const groups = await db.retailGroup.findMany({
      where: {
        active: true,
        ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters?.search?.trim()
          ? {
              name: {
                contains: filters.search.trim(),
                mode: 'insensitive',
              },
            }
          : {}),
      },
      include: {
        category: true,
        variants: {
          where: { active: true },
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
        },
        storefrontProduct: true,
      },
      orderBy: { name: 'asc' },
    });

    const allVariantIds = groups.flatMap((g: any) =>
      (g.variants || []).map((v: any) => v.id),
    );
    const reservedMap = await getActiveReservedQuantities(db, allVariantIds);

    const mapped = groups.map((rg: any) => {
      const sp = rg.storefrontProduct;
      const variants = (rg.variants || []).map((v: any) => {
        const physicalStock = Math.max(0, Math.floor(Number(v.stock ?? 0)));
        const reservedStock = reservedMap.get(v.id)?.quantity ?? 0;
        const availableStock = Math.max(0, physicalStock - reservedStock);
        return {
          id: v.id,
          size: v.size || null,
          color: v.color || null,
          shortCode: v.shortCode || null,
          barcode: v.barcode || null,
          physicalStock,
          reservedStock,
          availableStock,
        };
      });

      const physicalStockTotal = variants.reduce(
        (acc: number, v: any) => acc + v.physicalStock,
        0,
      );
      const reservedStockTotal = variants.reduce(
        (acc: number, v: any) => acc + v.reservedStock,
        0,
      );
      const availableStockTotal = variants.reduce(
        (acc: number, v: any) => acc + v.availableStock,
        0,
      );

      const priceVal = Number(rg.priceSell ?? 0);
      const isVis = Boolean(sp?.visible);
      const titleVal = sp?.commercialTitle || rg.name;
      const descVal = sp?.commercialDescription || '';

      return {
        id: rg.id,
        retailGroupId: rg.id,
        storefrontProductId: sp?.id || null,
        name: rg.name,
        commercialTitle: titleVal,
        displayTitle: titleVal,
        commercialDescription: descVal,
        customDescription: descVal,
        badgeLabel: sp?.badgeLabel || '',
        publicSlug: sp?.publicSlug || buildProductPublicSlug(rg.name, rg.id),
        categoryId: rg.categoryId,
        categoryName: rg.category?.name || '',
        priceSell: priceVal,
        priceSale: priceVal,
        imageUrl: rg.imageUrl || null,
        galleryUrls: Array.isArray(sp?.galleryUrlsJson) ? sp.galleryUrlsJson : [],
        visible: isVis,
        isVisible: isVis,
        featured: Boolean(sp?.featured),
        sortOrder: Number(sp?.sortOrder ?? 0),
        physicalStockTotal,
        reservedStockTotal,
        reservedStock: reservedStockTotal,
        availableStockTotal,
        availableStock: availableStockTotal,
        missingPhoto: !rg.imageUrl,
        outOfStock: availableStockTotal <= 0,
        variants,
      };
    });

    const filtered = mapped.filter((item: any) => {
      if (filters?.visibility === 'visible' && !item.visible) return false;
      if (filters?.visibility === 'hidden' && item.visible) return false;
      if (filters?.featured === true && !item.featured) return false;
      return true;
    });

    filtered.sort((a: any, b: any) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }

  async updateProduct(retailGroupId: string, body: any) {
    const { db } = await this.assertModuleAndSchemaReady(true);
    const rg = await db.retailGroup.findUnique({
      where: { id: retailGroupId },
      include: { storefrontProduct: true },
    });
    if (!rg) {
      throw new NotFoundException('Grupo de mercadoria não encontrado.');
    }

    let publicSlug = rg.storefrontProduct?.publicSlug || buildProductPublicSlug(rg.name, rg.id);
    if (body.publicSlug !== undefined && String(body.publicSlug).trim()) {
      publicSlug = normalizeStorefrontSlug(body.publicSlug);
      if (!publicSlug || publicSlug.length < 2) {
        throw new BadRequestException('Slug público do produto inválido.');
      }
      const slugOwner = await db.storefrontProduct.findUnique({
        where: { publicSlug },
      });
      if (slugOwner && slugOwner.retailGroupId !== retailGroupId) {
        throw new ConflictException(
          `O endereço de produto "${publicSlug}" já está sendo usado por outra mercadoria desta loja.`,
        );
      }
    }

    const galleryUrls = Array.isArray(body.galleryUrls)
      ? body.galleryUrls
          .slice(0, 6)
          .map((u: any) => sanitizeSafeImageUrl(u))
          .filter(Boolean)
      : undefined;

    const rawVisible =
      body.visible !== undefined ? body.visible : body.isVisible;
    const rawCommercialTitle =
      body.commercialTitle !== undefined
        ? body.commercialTitle
        : body.displayTitle;
    const rawCommercialDesc =
      body.commercialDescription !== undefined
        ? body.commercialDescription
        : body.customDescription;

    await db.storefrontProduct.upsert({
      where: { retailGroupId },
      update: {
        publicSlug,
        ...(rawVisible !== undefined ? { visible: Boolean(rawVisible) } : {}),
        ...(body.featured !== undefined
          ? { featured: Boolean(body.featured) }
          : {}),
        ...(body.sortOrder !== undefined
          ? { sortOrder: Number(body.sortOrder) }
          : {}),
        ...(rawCommercialTitle !== undefined
          ? {
              commercialTitle:
                sanitizePlainText(
                  rawCommercialTitle,
                  160,
                  'Título comercial',
                ) || rg.name,
            }
          : {}),
        ...(rawCommercialDesc !== undefined
          ? {
              commercialDescription:
                sanitizePlainText(
                  rawCommercialDesc,
                  2000,
                  'Descrição comercial',
                ) || null,
            }
          : {}),
        ...(body.badgeLabel !== undefined
          ? {
              badgeLabel:
                sanitizePlainText(body.badgeLabel, 60, 'Selo') || null,
            }
          : {}),
        ...(galleryUrls !== undefined ? { galleryUrlsJson: galleryUrls } : {}),
      },
      create: {
        retailGroupId,
        publicSlug,
        visible: Boolean(rawVisible),
        featured: Boolean(body.featured),
        sortOrder: Number(body.sortOrder ?? 10),
        commercialTitle:
          sanitizePlainText(rawCommercialTitle || rg.name, 160) || rg.name,
        commercialDescription: rawCommercialDesc
          ? sanitizePlainText(rawCommercialDesc, 2000)
          : null,
        badgeLabel: body.badgeLabel
          ? sanitizePlainText(body.badgeLabel, 60)
          : null,
        galleryUrlsJson: galleryUrls || [],
      },
    });

    const all = await this.getProducts();
    return all.find((p: any) => p.retailGroupId === retailGroupId) || null;
  }

  async batchUpdateProducts(body: {
    retailGroupIds: string[];
    action: 'publish' | 'unpublish' | 'show' | 'hide' | 'feature' | 'unfeature';
  }) {
    const { db } = await this.assertModuleAndSchemaReady(true);
    const ids = Array.from(
      new Set((body?.retailGroupIds || []).filter(Boolean)),
    );
    if (!ids.length) {
      throw new BadRequestException('Selecione ao menos uma mercadoria.');
    }

    await this.ensureProductsSynced(db);

    const data: Record<string, any> = {};
    if (body.action === 'publish' || body.action === 'show') {
      data.visible = true;
    } else if (body.action === 'unpublish' || body.action === 'hide') {
      data.visible = false;
    } else if (body.action === 'feature') {
      data.visible = true;
      data.featured = true;
    } else if (body.action === 'unfeature') {
      data.featured = false;
    } else {
      throw new BadRequestException('Ação em lote inválida.');
    }

    const updated = await db.storefrontProduct.updateMany({
      where: { retailGroupId: { in: ids } },
      data,
    });

    return { updatedCount: updated.count };
  }
}
