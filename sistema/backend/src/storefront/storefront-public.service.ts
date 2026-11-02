import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { getActiveReservedQuantities } from '../prisma/stock-reservations.helper';
import { isStorefrontSchemaMissingError } from '../tenants/tenant-schema-upgrade';
import {
  normalizeStorefrontSlug,
  toPublicCategoryDto,
  toPublicProductDto,
  validateAndSanitizeTheme,
} from './storefront.rules';

export interface ResolvedPublicStore {
  tenantId: string;
  databaseUrl: string;
  publicId: string;
  slug: string;
  db: any;
  settings: any;
}

@Injectable()
export class StorefrontPublicService {
  constructor(
    private readonly heartPrisma: HeartPrismaService,
    private readonly tenantManager: TenantConnectionManager,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Resolve um tenant público exclusivamente a partir do slug registrado no Heart.
   * Ignora qualquer sessão administrativa ou cabeçalho de tenant enviado pelo navegador.
   */
  async resolvePublishedStore(
    rawSlug: string,
    options?: { allowUnpublishedForOrderLookup?: boolean },
  ): Promise<ResolvedPublicStore> {
    const slug = normalizeStorefrontSlug(rawSlug);
    if (!slug || slug.length < 2) {
      throw new NotFoundException('Loja virtual não encontrada.');
    }

    if (!this.heartPrisma?.storefrontRegistry?.findUnique) {
      throw new NotFoundException('Loja virtual indisponível no momento.');
    }

    let registry: any = null;
    try {
      registry = await this.heartPrisma.storefrontRegistry.findUnique({
        where: { slug },
        include: { tenant: true },
      });
    } catch (err) {
      if (isStorefrontSchemaMissingError(err)) {
        throw new NotFoundException('Loja virtual indisponível no momento.');
      }
      throw err;
    }

    if (!registry || !registry.tenant) {
      throw new NotFoundException('Loja virtual não encontrada.');
    }

    const tenant = registry.tenant;
    const modulos =
      typeof tenant.modulos === 'string'
        ? JSON.parse(tenant.modulos || '{}')
        : tenant.modulos || {};

    if (
      tenant.status !== 'active' ||
      !modulos.lojaVirtual ||
      !registry.enabled ||
      (!options?.allowUnpublishedForOrderLookup && !registry.published)
    ) {
      throw new NotFoundException(
        'Esta loja virtual não está disponível para novos pedidos no momento.',
      );
    }

    const db = await this.tenantManager.getTenantClient(
      tenant.id,
      tenant.databaseUrl,
    );

    let settings: any = null;
    try {
      settings = await db.storefrontSettings.findUnique({
        where: { id: 'singleton' },
      });
    } catch (err) {
      if (isStorefrontSchemaMissingError(err)) {
        throw new NotFoundException('Loja virtual em manutenção.');
      }
      throw err;
    }

    if (
      !settings ||
      settings.slug !== slug ||
      (!options?.allowUnpublishedForOrderLookup && !settings.isPublished)
    ) {
      throw new NotFoundException(
        'Esta loja virtual não está publicada no momento.',
      );
    }

    return {
      tenantId: tenant.id,
      databaseUrl: tenant.databaseUrl,
      publicId: settings.publicId || registry.publicId,
      slug: settings.slug,
      db,
      settings,
    };
  }

  /**
   * Executa uma função isolada no contexto do tenant resolvido pelo slug público,
   * sem criar usuário administrativo fictício nem herdar JWT de outra loja.
   */
  async runInPublicStoreContext<T>(
    rawSlug: string,
    fn: (store: ResolvedPublicStore) => Promise<T>,
    options?: { allowUnpublishedForOrderLookup?: boolean },
  ): Promise<T> {
    const store = await this.resolvePublishedStore(rawSlug, options);
    return this.tenantContext.run(
      {
        tenantId: store.tenantId,
        databaseUrl: store.databaseUrl,
        userId: 'public-storefront',
      },
      () => fn(store),
    );
  }

  async getStorefrontHome(rawSlug: string) {
    return this.runInPublicStoreContext(rawSlug, async ({ db, settings }) => {
      const publishedTheme = validateAndSanitizeTheme(
        settings.publishedThemeJson,
        settings.storeName,
      );

      const [categoriesRaw, storefrontProducts] = await Promise.all([
        db.storefrontCategory.findMany({
          where: { visible: true },
          include: { category: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        db.storefrontProduct.findMany({
          where: {
            visible: true,
            retailGroup: { active: true },
          },
          include: {
            retailGroup: {
              include: {
                category: true,
                variants: {
                  where: { active: true },
                  orderBy: [{ size: 'asc' }, { color: 'asc' }],
                },
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        }),
      ]);

      const allVariantIds = storefrontProducts.flatMap((sp: any) =>
        (sp.retailGroup?.variants || []).map((v: any) => v.id),
      );
      const reservedMap = await getActiveReservedQuantities(db, allVariantIds);

      const allPublicProducts = storefrontProducts.map((sp: any) =>
        toPublicProductDto(sp, reservedMap),
      );

      const featuredProducts = allPublicProducts
        .filter((p: any) => p.featured)
        .slice(0, 12);

      const availableSizes = Array.from(
        new Set(allPublicProducts.flatMap((p: any) => p.sizes)),
      ).sort();
      const availableColors = Array.from(
        new Set(allPublicProducts.flatMap((p: any) => p.colors)),
      ).sort();

      const prices = allPublicProducts
        .map((p: any) => Number(p.priceSell))
        .filter((n: number) => n > 0);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;

      return {
        publicId: settings.publicId,
        slug: settings.slug,
        storeName: settings.storeName,
        tagline: settings.tagline || null,
        description: settings.description || null,
        logoUrl: settings.logoUrl || null,
        coverUrl: settings.coverUrl || null,
        publishedVersion: Number(settings.publishedVersion ?? 1),
        pickupEnabled: Boolean(settings.pickupEnabled),
        pickupInstructions: settings.pickupInstructions || null,
        deliveryEnabled: Boolean(settings.deliveryEnabled),
        deliveryInstructions: settings.deliveryInstructions || null,
        deliveryFeeNote: settings.deliveryFeeNote || null,
        confirmReservationMinutes: Number(
          settings.confirmReservationMinutes ?? 15,
        ),
        whatsappConfigured: Boolean(settings.whatsappPhone),
        theme: publishedTheme,
        categories: categoriesRaw.map(toPublicCategoryDto),
        featuredProducts,
        facets: {
          sizes: availableSizes,
          colors: availableColors,
          minPrice,
          maxPrice,
          totalPublishedProducts: allPublicProducts.length,
        },
      };
    });
  }

  async listProducts(
    rawSlug: string,
    query: {
      search?: string;
      categoryId?: string;
      categorySlug?: string;
      size?: string;
      color?: string;
      minPrice?: number;
      maxPrice?: number;
      featured?: boolean;
      inStockOnly?: boolean;
      sort?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.runInPublicStoreContext(rawSlug, async ({ db }) => {
      let targetCategoryId = query.categoryId?.trim() || undefined;
      if (!targetCategoryId && query.categorySlug?.trim()) {
        const sc = await db.storefrontCategory.findUnique({
          where: { slug: normalizeStorefrontSlug(query.categorySlug) },
        });
        if (sc) targetCategoryId = sc.categoryId;
      }

      const storefrontProducts = await db.storefrontProduct.findMany({
        where: {
          visible: true,
          ...(query.featured ? { featured: true } : {}),
          retailGroup: {
            active: true,
            ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
          },
        },
        include: {
          retailGroup: {
            include: {
              category: true,
              variants: {
                where: { active: true },
                orderBy: [{ size: 'asc' }, { color: 'asc' }],
              },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });

      const allVariantIds = storefrontProducts.flatMap((sp: any) =>
        (sp.retailGroup?.variants || []).map((v: any) => v.id),
      );
      const reservedMap = await getActiveReservedQuantities(db, allVariantIds);

      let items = storefrontProducts.map((sp: any) =>
        toPublicProductDto(sp, reservedMap),
      );

      if (query.search?.trim()) {
        const term = query.search.trim().toLowerCase();
        items = items.filter(
          (p: any) =>
            String(p.title || '')
              .toLowerCase()
              .includes(term) ||
            String(p.description || '')
              .toLowerCase()
              .includes(term) ||
            String(p.categoryName || '')
              .toLowerCase()
              .includes(term),
        );
      }

      if (query.size?.trim()) {
        const targetSize = query.size.trim().toLowerCase();
        items = items.filter((p: any) =>
          p.variants.some(
            (v: any) =>
              String(v.size || '').toLowerCase() === targetSize && v.inStock,
          ),
        );
      }

      if (query.color?.trim()) {
        const targetColor = query.color.trim().toLowerCase();
        items = items.filter((p: any) =>
          p.variants.some(
            (v: any) =>
              String(v.color || '').toLowerCase() === targetColor && v.inStock,
          ),
        );
      }

      if (
        query.minPrice !== undefined &&
        Number.isFinite(Number(query.minPrice))
      ) {
        items = items.filter(
          (p: any) => p.priceSell >= Number(query.minPrice),
        );
      }

      if (
        query.maxPrice !== undefined &&
        Number.isFinite(Number(query.maxPrice)) &&
        Number(query.maxPrice) > 0
      ) {
        items = items.filter(
          (p: any) => p.priceSell <= Number(query.maxPrice),
        );
      }

      if (query.inStockOnly) {
        items = items.filter((p: any) => p.inStock);
      }

      const sort = String(query.sort || 'featured').toLowerCase();
      items.sort((a: any, b: any) => {
        // Produtos com estoque disponível têm prioridade visual quando empate
        if (sort === 'price_asc') return a.priceSell - b.priceSell;
        if (sort === 'price_desc') return b.priceSell - a.priceSell;
        if (sort === 'name_asc') return a.title.localeCompare(b.title);
        if (sort === 'newest') return 0;
        // default: featured -> sortOrder -> title
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.title.localeCompare(b.title);
      });

      const page = Math.max(1, Number(query.page || 1));
      const limit = Math.min(48, Math.max(1, Number(query.limit || 24)));
      const total = items.length;
      const start = (page - 1) * limit;
      const paginated = items.slice(start, start + limit);

      return {
        data: paginated,
        meta: {
          total,
          page,
          limit,
          lastPage: Math.max(1, Math.ceil(total / limit)),
        },
      };
    });
  }

  async getProductBySlug(rawSlug: string, rawProductSlug: string) {
    return this.runInPublicStoreContext(rawSlug, async ({ db }) => {
      const productSlug = normalizeStorefrontSlug(rawProductSlug);
      const sp = await db.storefrontProduct.findUnique({
        where: { publicSlug: productSlug },
        include: {
          retailGroup: {
            include: {
              category: true,
              variants: {
                where: { active: true },
                orderBy: [{ size: 'asc' }, { color: 'asc' }],
              },
            },
          },
        },
      });

      if (!sp || !sp.visible || !sp.retailGroup || !sp.retailGroup.active) {
        throw new NotFoundException(
          'Mercadoria não encontrada ou indisponível nesta loja.',
        );
      }

      const variantIds = (sp.retailGroup.variants || []).map((v: any) => v.id);
      const reservedMap = await getActiveReservedQuantities(db, variantIds);
      const productDto = toPublicProductDto(sp, reservedMap);

      // Produtos relacionados da mesma categoria
      const relatedRaw = await db.storefrontProduct.findMany({
        where: {
          visible: true,
          id: { not: sp.id },
          retailGroup: {
            active: true,
            categoryId: sp.retailGroup.categoryId,
          },
        },
        include: {
          retailGroup: {
            include: {
              category: true,
              variants: { where: { active: true } },
            },
          },
        },
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
        take: 4,
      });

      const relatedVariantIds = relatedRaw.flatMap((r: any) =>
        (r.retailGroup?.variants || []).map((v: any) => v.id),
      );
      const relatedReserved = await getActiveReservedQuantities(
        db,
        relatedVariantIds,
      );
      const relatedProducts = relatedRaw.map((r: any) =>
        toPublicProductDto(r, relatedReserved),
      );

      return {
        product: productDto,
        relatedProducts,
      };
    });
  }

  async validateCart(
    rawSlug: string,
    body: {
      items: {
        productId: string;
        quantity: number;
        expectedPriceUnit?: number;
      }[];
    },
  ) {
    return this.runInPublicStoreContext(rawSlug, async ({ db }) => {
      if (!Array.isArray(body?.items) || body.items.length === 0) {
        throw new BadRequestException('O carrinho está vazio.');
      }
      if (body.items.length > 50) {
        throw new BadRequestException(
          'O carrinho excede o limite máximo de 50 itens diferentes.',
        );
      }

      // Consolidar itens repetidos por productId
      const consolidated = new Map<
        string,
        { productId: string; quantity: number; expectedPriceUnit?: number }
      >();
      for (const rawItem of body.items) {
        const productId = String(rawItem?.productId || '').trim();
        const qty = Number(rawItem?.quantity ?? 0);
        if (!productId || !Number.isInteger(qty) || qty <= 0 || qty > 500) {
          throw new BadRequestException(
            'Quantidade inválida no carrinho. Informe valores inteiros positivos.',
          );
        }
        const prev = consolidated.get(productId);
        if (prev) {
          prev.quantity += qty;
        } else {
          consolidated.set(productId, {
            productId,
            quantity: qty,
            expectedPriceUnit:
              rawItem.expectedPriceUnit !== undefined
                ? Number(rawItem.expectedPriceUnit)
                : undefined,
          });
        }
      }

      const productIds = Array.from(consolidated.keys());
      const [products, reservedMap] = await Promise.all([
        db.product.findMany({
          where: { id: { in: productIds } },
          include: {
            retailGroup: {
              include: {
                storefrontProduct: true,
              },
            },
          },
        }),
        getActiveReservedQuantities(db, productIds),
      ]);

      const productMap = new Map(products.map((p: any) => [p.id, p]));
      const validatedItems: any[] = [];
      let hasPriceDivergence = false;
      let hasStockShortage = false;
      let subtotalCents = 0;

      for (const [productId, reqItem] of consolidated.entries()) {
        const product = productMap.get(productId) as any;
        const rg = product?.retailGroup;
        const sp = rg?.storefrontProduct;

        if (
          !product ||
          product.active === false ||
          !rg ||
          rg.active === false ||
          !sp ||
          sp.visible !== true
        ) {
          hasStockShortage = true;
          validatedItems.push({
            productId,
            available: false,
            reason: 'Mercadoria indisponível ou removida do catálogo.',
            requestedQuantity: reqItem.quantity,
            availableStock: 0,
          });
          continue;
        }

        const physicalStock = Math.max(0, Math.floor(Number(product.stock ?? 0)));
        const reservedQty = reservedMap.get(productId)?.quantity ?? 0;
        const availableStock = Math.max(0, physicalStock - reservedQty);
        const currentPrice = Number(rg.priceSell ?? product.priceSell ?? 0);
        const priceCents = Math.round(currentPrice * 100);

        const priceChanged =
          reqItem.expectedPriceUnit !== undefined &&
          Math.abs(Number(reqItem.expectedPriceUnit) - currentPrice) >= 0.01;
        if (priceChanged) {
          hasPriceDivergence = true;
        }

        const stockOk = availableStock >= reqItem.quantity;
        if (!stockOk) {
          hasStockShortage = true;
        }

        const lineSubtotalCents = priceCents * reqItem.quantity;
        subtotalCents += lineSubtotalCents;

        validatedItems.push({
          productId: product.id,
          retailGroupId: rg.id,
          productSlug: sp.publicSlug,
          productName: sp.commercialTitle || rg.name || product.name,
          size: product.size || null,
          color: product.color || null,
          imageUrl: rg.imageUrl || product.imageUrl || null,
          unit: product.unit || 'UN',
          requestedQuantity: reqItem.quantity,
          availableStock,
          available: stockOk,
          priceUnit: currentPrice,
          expectedPriceUnit: reqItem.expectedPriceUnit ?? currentPrice,
          priceChanged,
          subtotal: Number((lineSubtotalCents / 100).toFixed(2)),
        });
      }

      const subtotal = Number((subtotalCents / 100).toFixed(2));
      return {
        valid: !hasPriceDivergence && !hasStockShortage,
        hasPriceDivergence,
        hasStockShortage,
        subtotal,
        total: subtotal,
        items: validatedItems,
      };
    });
  }

  async getShareMetadata(rawSlug: string, rawProductSlug?: string) {
    try {
      const store = await this.resolvePublishedStore(rawSlug);
      if (rawProductSlug) {
        const detail = await this.getProductBySlug(rawSlug, rawProductSlug);
        const prod = detail.product;
        return {
          title: `${prod.title} — ${store.settings.storeName}`,
          description:
            prod.description ||
            `Confira ${prod.title} por R$ ${Number(prod.priceSell).toFixed(2).replace('.', ',')} na ${store.settings.storeName}.`,
          imageUrl: prod.imageUrl || store.settings.coverUrl || store.settings.logoUrl || null,
          canonicalPath: `/loja/${store.slug}/produto/${prod.slug}`,
          storeName: store.settings.storeName,
        };
      }
      return {
        title: `${store.settings.storeName} — Catálogo Online`,
        description:
          store.settings.tagline ||
          store.settings.description ||
          `Confira os produtos de ${store.settings.storeName} e faça seu pedido pelo WhatsApp.`,
        imageUrl: store.settings.coverUrl || store.settings.logoUrl || null,
        canonicalPath: `/loja/${store.slug}`,
        storeName: store.settings.storeName,
      };
    } catch {
      return {
        title: 'Loja Virtual — PDV Lojista',
        description: 'Catálogo online e pedidos pelo WhatsApp.',
        imageUrl: null,
        canonicalPath: `/loja/${normalizeStorefrontSlug(rawSlug)}`,
        storeName: 'Loja Virtual',
      };
    }
  }
}
