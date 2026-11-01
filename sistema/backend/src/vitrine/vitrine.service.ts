import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';

export interface VitrineSlide {
  slideType?: 'single';
  productId: string;
  retailGroupId?: string | null;
  productName: string;
  categoryName?: string | null;
  imageUrl: string | null;
  priceSell: number;
  promoPrice: number | null;
  badge: string | null;
  duration?: number;
  showSizes?: boolean;
  sizesAvailable?: string[];
  colorsAvailable?: string[];
  order: number;
}

export interface VitrineGridProduct {
  productId: string;
  retailGroupId?: string | null;
  productName: string;
  categoryName?: string | null;
  imageUrl: string | null;
  priceSell: number;
  promoPrice: number | null;
  sizesAvailable?: string[];
  colorsAvailable?: string[];
}

export interface VitrineGridSlide {
  slideType: 'grid';
  gridId: string;
  order: number;
  gridTitle: string;
  gridSubtitle?: string;
  gridBadge?: string | null;
  duration?: number;
  gridProducts: VitrineGridProduct[];
}

export type AnyVitrineSlide = VitrineSlide | VitrineGridSlide;

export interface DraftDto {
  theme?: string;
  customBgUrl?: string | null;
  showLogo?: boolean;
  logoPosition?: string;
  instagramHandle?: string | null;
  storeTagline?: string | null;
  slideDuration?: number;
  gridSlideDuration?: number;
  draftSlides?: AnyVitrineSlide[];
}

export interface PublishDto {
  userId: string;
  userName: string;
}

export interface VitrineCatalogItem {
  id: string;
  kind: 'group' | 'product';
  retailGroupId: string | null;
  name: string;
  shortCode: string | null;
  barcode: string | null;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
  priceSell: number;
  stock: number;
  sizesAvailable: string[];
  colorsAvailable: string[];
}

const SIZE_ORDER: Record<string, number> = {
  RN: 1,
  PP: 2,
  P: 3,
  M: 4,
  G: 5,
  GG: 6,
  XG: 7,
  XGG: 8,
  EG: 9,
  EGG: 10,
  G1: 11,
  G2: 12,
  G3: 13,
  UNICO: 99,
  ÚNICO: 99,
};

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const upA = a.trim().toUpperCase();
    const upB = b.trim().toUpperCase();
    const numA = Number(upA.replace(',', '.'));
    const numB = Number(upB.replace(',', '.'));
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB;
    }
    const rankA = SIZE_ORDER[upA] ?? 50;
    const rankB = SIZE_ORDER[upB] ?? 50;
    if (rankA !== rankB) return rankA - rankB;
    return upA.localeCompare(upB, 'pt-BR');
  });
}

function generateTvPublicId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class VitrineService {
  private readonly logger = new Logger(VitrineService.name);

  constructor(
    private readonly heartPrisma: HeartPrismaService,
    private readonly tenantManager: TenantConnectionManager,
    private readonly tenantContext: TenantContextService,
  ) {}

  private async getTenantPrisma() {
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.tenantManager.getTenantClient(tenantId, databaseUrl);
  }

  private parseModulos(raw: any): Record<string, boolean> {
    try {
      if (!raw) return {};
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  }

  private isSchemaError(error: any): boolean {
    if (['P2021', 'P2022', 'P2010'].includes(error?.code)) return true;
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('does not exist') ||
      msg.includes('unknown field') ||
      msg.includes('unknown column') ||
      ['42P01', '42703'].includes(String(error?.meta?.code || ''))
    );
  }

  private handleSchemaError(error: any): never {
    if (this.isSchemaError(error)) {
      throw new BadRequestException(
        'O banco de dados desta loja ainda não possui a tabela do Módulo de Vitrine Digital (vitrine_config). Acesse /sys-init, selecione a loja e clique em "Atualizar Bancos".',
      );
    }
    throw error;
  }

  async isModuleEnabledForTenant(tenantId: string): Promise<{
    enabled: boolean;
    storeName: string;
    tvPublicId: string;
    logoUrl: string | null;
    tenant: any;
  }> {
    const tenant = await this.heartPrisma.tenant
      .findUnique({ where: { id: tenantId } })
      .catch(() => null);

    if (!tenant && tenantId === 'demo-tenant-001') {
      return {
        enabled: true,
        storeName: 'Boutique & Calçados Modelo',
        tvPublicId: 'DEMOLOJA',
        logoUrl: null,
        tenant: {
          id: 'demo-tenant-001',
          name: 'Boutique & Calçados Modelo',
          nomeFantasia: 'Boutique & Calçados Modelo',
          tvPublicId: 'DEMOLOJA',
          status: 'active',
          modulos: { vitrineDigital: true },
        },
      };
    }

    if (!tenant) {
      throw new NotFoundException('Loja não encontrada.');
    }

    const modulos = this.parseModulos(tenant.modulos);
    const enabled = Boolean(
      modulos.vitrineDigital || modulos.digitalSignage,
    );

    if (enabled && !tenant.tvPublicId) {
      const generated = generateTvPublicId();
      try {
        await this.heartPrisma.tenant.update({
          where: { id: tenant.id },
          data: { tvPublicId: generated },
        });
      } catch (err: any) {
        this.logger.warn(
          `Não foi possível gravar tvPublicId para ${tenant.id}: ${err?.message}`,
        );
      }
      (tenant as any).tvPublicId = generated;
    }

    const storeName =
      tenant.nomeFantasia || tenant.razaoSocial || tenant.name || 'PDV Lojista';

    return {
      enabled,
      storeName,
      tvPublicId: tenant.tvPublicId || 'DEMOLOJA',
      logoUrl: tenant.logoUrl ?? null,
      tenant,
    };
  }

  async requireModuleEnabled() {
    const { tenantId } = this.tenantContext.get();
    const info = await this.isModuleEnabledForTenant(tenantId);
    if (!info.enabled) {
      throw new ForbiddenException(
        'O módulo de Vitrine Digital e TV Promocional não está habilitado para esta loja. Ative-o no painel /sys-init.',
      );
    }
    return info;
  }

  parseLogoPosition(raw: any): {
    position: string;
    instagram: string | null;
    gridSlideDuration: number;
    storeTagline: string | null;
  } {
    let pos = 'top-left';
    let insta: string | null = null;
    let gridSlideDuration = 15;
    let storeTagline: string | null = null;

    if (raw) {
      try {
        let curr = raw;
        let depth = 0;
        while (
          typeof curr === 'string' &&
          curr.trim().startsWith('{') &&
          depth < 5
        ) {
          depth++;
          const parsed = JSON.parse(curr);
          if (parsed && typeof parsed === 'object') {
            if (parsed.instagram !== undefined && parsed.instagram !== null) {
              const cleanInsta = String(parsed.instagram).trim();
              insta = cleanInsta || null;
            }
            if (
              parsed.gridSlideDuration !== undefined &&
              Number.isFinite(Number(parsed.gridSlideDuration))
            ) {
              gridSlideDuration = Math.min(
                60,
                Math.max(5, Math.round(Number(parsed.gridSlideDuration))),
              );
            }
            if (
              parsed.storeTagline !== undefined &&
              parsed.storeTagline !== null
            ) {
              const cleanTag = String(parsed.storeTagline).trim();
              storeTagline = cleanTag || null;
            }
            if (parsed.position !== undefined) {
              curr = parsed.position;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        if (typeof curr === 'string') {
          if (curr.includes('|')) {
            const [p, i] = curr.split('|');
            pos = p || 'top-left';
            if (i) insta = i;
          } else if (!curr.startsWith('{')) {
            pos = curr;
          }
        }
      } catch {
        // fallback to defaults
      }
    }

    const validPositions = [
      'top-left',
      'top-right',
      'bottom',
      'bottom-left',
      'bottom-right',
      'center',
    ];
    if (!validPositions.includes(pos)) {
      pos = 'top-left';
    }

    return { position: pos, instagram: insta, gridSlideDuration, storeTagline };
  }

  private formatConfigResponse(config: any, tenantMeta?: { tvPublicId?: string; storeName?: string; logoUrl?: string | null }) {
    if (!config) return null;
    const { position, instagram, gridSlideDuration, storeTagline } =
      this.parseLogoPosition(config.logoPosition);
    return {
      ...config,
      logoPosition: position,
      instagramHandle: instagram,
      gridSlideDuration,
      storeTagline,
      draftSlides: Array.isArray(config.draftSlides) ? config.draftSlides : [],
      publishedSlides: Array.isArray(config.publishedSlides)
        ? config.publishedSlides
        : [],
      ...(tenantMeta
        ? {
            tvPublicId: tenantMeta.tvPublicId,
            storeName: tenantMeta.storeName,
            logoUrl: tenantMeta.logoUrl ?? null,
          }
        : {}),
    };
  }

  private async getOrCreateSingleton(prisma: any, initialData?: Record<string, any>) {
    try {
      const existing = await prisma.vitrineConfig.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (existing) return existing;

      const defaultPayload = {
        id: 'singleton',
        active: false,
        theme: 'dark_premium',
        showLogo: true,
        logoPosition: JSON.stringify({
          position: 'top-left',
          instagram: null,
          gridSlideDuration: 15,
          storeTagline: null,
        }),
        slideDuration: 8,
        draftSlides: [],
        publishedSlides: [],
        ...(initialData || {}),
      };

      try {
        return await prisma.vitrineConfig.upsert({
          where: { id: 'singleton' },
          update: initialData || {},
          create: defaultPayload,
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const retry = await prisma.vitrineConfig.findFirst({
            orderBy: { createdAt: 'asc' },
          });
          if (retry) return retry;
        }
        throw err;
      }
    } catch (error) {
      this.handleSchemaError(error);
    }
  }

  async getConfig() {
    const meta = await this.requireModuleEnabled();
    try {
      const prisma = await this.getTenantPrisma();
      const config = await prisma.vitrineConfig.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (!config) {
        return {
          active: false,
          version: 0,
          publishedAt: null,
          publishedByUserId: null,
          publishedByName: null,
          draftUpdatedAt: null,
          theme: 'dark_premium',
          customBgUrl: null,
          showLogo: true,
          logoPosition: 'top-left',
          instagramHandle: null,
          storeTagline: null,
          slideDuration: 8,
          gridSlideDuration: 15,
          draftSlides: [],
          publishedSlides: [],
          tvPublicId: meta.tvPublicId,
          storeName: meta.storeName,
          logoUrl: meta.logoUrl,
        };
      }

      return this.formatConfigResponse(config, {
        tvPublicId: meta.tvPublicId,
        storeName: meta.storeName,
        logoUrl: meta.logoUrl,
      });
    } catch (error) {
      this.handleSchemaError(error);
    }
  }

  async getCatalog(search?: string): Promise<{
    items: VitrineCatalogItem[];
    categories: { id: string; name: string; count: number }[];
  }> {
    await this.requireModuleEnabled();
    const prisma = await this.getTenantPrisma();
    const cleanSearch = (search || '').trim();

    const [groups, ungroupedProducts, categories] = await Promise.all([
      prisma.retailGroup.findMany({
        where: {
          active: true,
          ...(cleanSearch
            ? {
                OR: [
                  { name: { contains: cleanSearch, mode: 'insensitive' } },
                  {
                    category: {
                      name: { contains: cleanSearch, mode: 'insensitive' },
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          category: true,
          variants: {
            where: { active: true },
            orderBy: [{ size: 'asc' }, { color: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
        take: 250,
      }),
      prisma.product.findMany({
        where: {
          retailGroupId: null,
          active: true,
          ...(cleanSearch
            ? {
                OR: [
                  { name: { contains: cleanSearch, mode: 'insensitive' } },
                  { shortCode: { contains: cleanSearch, mode: 'insensitive' } },
                  { barcode: { contains: cleanSearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: { category: true },
        orderBy: { name: 'asc' },
        take: 250,
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    const items: VitrineCatalogItem[] = [];

    for (const group of groups) {
      const activeVariants = group.variants || [];
      const inStockVariants = activeVariants.filter(
        (v: any) => Number(v.stock) > 0,
      );
      const sourceForSizes =
        inStockVariants.length > 0 ? inStockVariants : activeVariants;

      const rawSizes = Array.from(
        new Set(
          sourceForSizes
            .map((v: any) => String(v.size || '').trim())
            .filter((s: string) => Boolean(s) && s.toLowerCase() !== 'único' && s.toLowerCase() !== 'unico'),
        ),
      );

      const rawColors = Array.from(
        new Set(
          sourceForSizes
            .map((v: any) => String(v.color || '').trim())
            .filter(
              (c: string) =>
                Boolean(c) &&
                !['sortida', 'padrão', 'padrao', 'única', 'unica'].includes(
                  c.toLowerCase(),
                ),
            ),
        ),
      );

      const firstVariantWithImage = activeVariants.find((v: any) =>
        Boolean(v.imageUrl),
      );
      const totalStock = activeVariants.reduce(
        (acc: number, v: any) => acc + Number(v.stock || 0),
        0,
      );

      items.push({
        id: `group:${group.id}`,
        kind: 'group',
        retailGroupId: group.id,
        name: group.name,
        shortCode: activeVariants[0]?.shortCode || null,
        barcode: activeVariants[0]?.barcode || null,
        categoryId: group.categoryId,
        categoryName: group.category?.name || 'Geral',
        imageUrl: group.imageUrl || firstVariantWithImage?.imageUrl || null,
        priceSell: Number(group.priceSell),
        stock: totalStock,
        sizesAvailable: sortSizes(rawSizes),
        colorsAvailable: rawColors,
      });
    }

    for (const prod of ungroupedProducts) {
      items.push({
        id: prod.id,
        kind: 'product',
        retailGroupId: null,
        name: prod.name,
        shortCode: prod.shortCode || null,
        barcode: prod.barcode || null,
        categoryId: prod.categoryId,
        categoryName: prod.category?.name || 'Geral',
        imageUrl: prod.imageUrl || null,
        priceSell: Number(prod.priceSell),
        stock: Number(prod.stock || 0),
        sizesAvailable: prod.size ? [String(prod.size).trim()] : [],
        colorsAvailable: prod.color ? [String(prod.color).trim()] : [],
      });
    }

    items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const categoryCountMap = new Map<string, number>();
    for (const item of items) {
      categoryCountMap.set(
        item.categoryId,
        (categoryCountMap.get(item.categoryId) || 0) + 1,
      );
    }

    const categoriesWithCount = categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      count: categoryCountMap.get(cat.id) || 0,
    }));

    return {
      items,
      categories: categoriesWithCount,
    };
  }

  async saveDraft(data: DraftDto) {
    const meta = await this.requireModuleEnabled();
    try {
      const prisma = await this.getTenantPrisma();
      const existing = await this.getOrCreateSingleton(prisma);

      const currentMeta = this.parseLogoPosition(existing?.logoPosition || null);
      const parsedInput = this.parseLogoPosition(data.logoPosition);

      const finalPos =
        data.logoPosition !== undefined
          ? parsedInput.position
          : currentMeta.position;

      const finalInsta =
        data.instagramHandle !== undefined
          ? data.instagramHandle
            ? String(data.instagramHandle).trim()
            : null
          : parsedInput.instagram || currentMeta.instagram;

      const finalGridDuration =
        data.gridSlideDuration !== undefined &&
        Number.isFinite(Number(data.gridSlideDuration))
          ? Math.min(60, Math.max(5, Math.round(Number(data.gridSlideDuration))))
          : currentMeta.gridSlideDuration;

      const finalTagline =
        data.storeTagline !== undefined
          ? data.storeTagline
            ? String(data.storeTagline).trim().slice(0, 80)
            : null
          : currentMeta.storeTagline;

      const payload: Record<string, any> = {
        draftUpdatedAt: new Date(),
        logoPosition: JSON.stringify({
          position: finalPos,
          instagram: finalInsta,
          gridSlideDuration: finalGridDuration,
          storeTagline: finalTagline,
        }),
      };

      if (data.theme !== undefined) {
        const validThemes = new Set(this.getThemes().map((t) => t.slug));
        payload.theme = validThemes.has(String(data.theme))
          ? String(data.theme)
          : 'dark_premium';
      }
      if (data.customBgUrl !== undefined) {
        payload.customBgUrl = data.customBgUrl
          ? String(data.customBgUrl).trim()
          : null;
      }
      if (data.showLogo !== undefined) {
        payload.showLogo = Boolean(data.showLogo);
      }
      if (data.slideDuration !== undefined) {
        payload.slideDuration = Math.min(
          60,
          Math.max(3, Math.round(Number(data.slideDuration) || 8)),
        );
      }
      if (data.draftSlides !== undefined) {
        payload.draftSlides = JSON.parse(JSON.stringify(data.draftSlides));
      }

      const updated = await prisma.vitrineConfig.update({
        where: { id: existing.id },
        data: payload,
      });

      return this.formatConfigResponse(updated, {
        tvPublicId: meta.tvPublicId,
        storeName: meta.storeName,
        logoUrl: meta.logoUrl,
      });
    } catch (error) {
      this.handleSchemaError(error);
    }
  }

  async publish(dto: PublishDto) {
    const meta = await this.requireModuleEnabled();
    try {
      const prisma = await this.getTenantPrisma();
      const existing = await this.getOrCreateSingleton(prisma, {
        active: true,
      });

      const newVersion = (existing.version || 0) + 1;
      const slidesSnapshot = Array.isArray(existing.draftSlides)
        ? JSON.parse(JSON.stringify(existing.draftSlides))
        : [];

      const updated = await prisma.vitrineConfig.update({
        where: { id: existing.id },
        data: {
          active: true,
          version: newVersion,
          publishedAt: new Date(),
          publishedByUserId: dto.userId || 'system',
          publishedByName: dto.userName || 'Administrador',
          publishedSlides: slidesSnapshot,
        },
      });

      return this.formatConfigResponse(updated, {
        tvPublicId: meta.tvPublicId,
        storeName: meta.storeName,
        logoUrl: meta.logoUrl,
      });
    } catch (error) {
      this.handleSchemaError(error);
    }
  }

  async setActive(active: boolean) {
    const meta = await this.requireModuleEnabled();
    try {
      const prisma = await this.getTenantPrisma();
      const existing = await this.getOrCreateSingleton(prisma, {
        active: Boolean(active),
      });

      const updated = await prisma.vitrineConfig.update({
        where: { id: existing.id },
        data: { active: Boolean(active) },
      });

      return this.formatConfigResponse(updated, {
        tvPublicId: meta.tvPublicId,
        storeName: meta.storeName,
        logoUrl: meta.logoUrl,
      });
    } catch (error) {
      this.handleSchemaError(error);
    }
  }

  /**
   * Endpoint PÚBLICO consumido pela Smart TV / Monitor.
   * Resolve o tenant via tvPublicId (sem exigir JWT), valida status e retorna os slides publicados.
   */
  async getPublicPlaylist(rawTvPublicId: string) {
    const cleanId = String(rawTvPublicId || '')
      .trim()
      .toUpperCase();
    if (!cleanId) {
      throw new NotFoundException('Vitrine não encontrada.');
    }

    try {
      let tenant = await this.heartPrisma.tenant
        .findFirst({
          where: {
            tvPublicId: {
              equals: cleanId,
              mode: 'insensitive',
            },
          },
        })
        .catch(() => null);

      if (
        !tenant &&
        cleanId === 'DEMOLOJA' &&
        process.env.DATABASE_URL_TENANT
      ) {
        tenant = {
          id: 'demo-tenant-001',
          name: 'Boutique & Calçados Modelo',
          nomeFantasia: 'Boutique & Calçados Modelo',
          razaoSocial: 'Comércio Varejista Modelo Demonstração LTDA',
          databaseName: 'lojista_demonstracao',
          databaseUrl: process.env.DATABASE_URL_TENANT,
          status: 'active',
          tvPublicId: 'DEMOLOJA',
          logoUrl: null,
          modulos: { vitrineDigital: true },
        } as any;
      }

      if (!tenant) {
        throw new NotFoundException('Vitrine não encontrada.');
      }

      if (tenant.status === 'suspended' || tenant.status === 'inactive') {
        return { active: false, reason: 'store_suspended' };
      }

      const modulos = this.parseModulos(tenant.modulos);
      if (!modulos.vitrineDigital && !modulos.digitalSignage) {
        return { active: false, reason: 'module_disabled' };
      }

      const tenantPrisma = await this.tenantManager.getTenantClient(
        tenant.id,
        tenant.databaseUrl,
      );

      const config = await tenantPrisma.vitrineConfig
        .findFirst({ orderBy: { createdAt: 'asc' } })
        .catch(() => null);

      const storeName =
        tenant.nomeFantasia ||
        tenant.razaoSocial ||
        tenant.name ||
        'PDV Lojista';

      if (!config || !config.active) {
        return {
          active: false,
          storeName,
          logoUrl: tenant.logoUrl ?? null,
        };
      }

      const { position, instagram, gridSlideDuration, storeTagline } =
        this.parseLogoPosition(config.logoPosition);

      const rawSlides: AnyVitrineSlide[] = Array.isArray(config.publishedSlides)
        ? (config.publishedSlides as unknown as AnyVitrineSlide[])
        : [];

      return {
        active: true,
        version: config.version,
        storeName,
        storeTagline,
        theme: config.theme || 'dark_premium',
        customBgUrl: config.customBgUrl || null,
        showLogo: config.showLogo !== false,
        logoPosition: position,
        instagramHandle: instagram,
        logoUrl: tenant.logoUrl ?? null,
        slideDuration: config.slideDuration || 8,
        gridSlideDuration: gridSlideDuration || 15,
        slides: rawSlides,
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(
        `Erro ao carregar playlist pública da TV (${cleanId}): ${err.message}`,
        err.stack,
      );
      return { active: false };
    }
  }

  /**
   * Lista os temas visuais homologados para o PDV Lojista (100% dentro da paleta roxo/branco/neutros).
   */
  getThemes() {
    return [
      {
        slug: 'dark_premium',
        name: 'Noite Imperial',
        description: 'Fundo grafite profundo com iluminação radial em roxo vibrante',
      },
      {
        slug: 'purple_luxury',
        name: 'Editorial Roxo',
        description: 'Degradê diagonal de grafite para roxo profundo de boutique',
      },
      {
        slug: 'light_clean',
        name: 'Vitrine Clara',
        description: 'Estúdio branco e lavanda suave com alto contraste tipográfico',
      },
      {
        slug: 'neon_night',
        name: 'Palco Urbano',
        description: 'Contraste intenso para vitrines de streetwear e calçados',
      },
      {
        slug: 'dark_glass',
        name: 'Vidro Fumê',
        description: 'Superfície escura minimalista com molduras translúcidas',
      },
      {
        slug: 'carbon_fiber',
        name: 'Grafite Puro',
        description: 'Textura geométrica discreta para destacar fotos de peças claras',
      },
    ];
  }
}
