import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const APPROVED_STOREFRONT_PALETTE = [
  '#7C3AED',
  '#6D28D9',
  '#FFFFFF',
  '#F8F7FC',
  '#F3E8FF',
  '#272321',
  '#665F70',
  '#E5E1ED',
] as const;

export const STOREFRONT_TEMPLATES = [
  'editorial_roxo',
  'minimal_branco',
  'vitrine_escura',
] as const;

export type StorefrontTemplateId = (typeof STOREFRONT_TEMPLATES)[number];

export const STOREFRONT_SECTION_TYPES = [
  'header',
  'hero',
  'banner',
  'categories',
  'featured',
  'product_selection',
  'look',
  'collection',
  'fulfillment_info',
  'footer',
] as const;

export type StorefrontSectionType = (typeof STOREFRONT_SECTION_TYPES)[number];

export const SINGLETON_STOREFRONT_SECTION_TYPES: ReadonlySet<StorefrontSectionType> =
  new Set<StorefrontSectionType>([
    'header',
    'hero',
    'categories',
    'collection',
    'fulfillment_info',
    'footer',
  ]);

export type StorefrontBannerFormat = 'strip' | 'side_by_side' | 'campaign';
export type StorefrontBannerHeight = 'sm' | 'md' | 'lg';
export type StorefrontBannerTargetType =
  | 'none'
  | 'all'
  | 'featured'
  | 'category'
  | 'product'
  | 'collection';

export type StorefrontSectionPresentation = 'grid' | 'carousel';
export type StorefrontSelectionSource =
  | 'manual'
  | 'featured'
  | 'collection'
  | 'category';

export type StorefrontCollectionKind = 'collection' | 'look';

export interface StorefrontBannerConfig {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  format: StorefrontBannerFormat;
  height: StorefrontBannerHeight;
  focalX: number;
  focalY: number;
  ctaLabel?: string;
  targetType: StorefrontBannerTargetType;
  targetValue?: string;
  enabled: boolean;
}

export interface StorefrontCollectionConfig {
  id: string;
  slug: string;
  kind: StorefrontCollectionKind;
  enabled: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  coverUrl?: string | null;
  focalX: number;
  focalY: number;
  productIds: string[];
}

export interface StorefrontSectionConfig {
  id: string;
  type: StorefrontSectionType;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  categoryId?: string | null;
  bannerId?: string | null;
  banner?: StorefrontBannerConfig | null;
  presentation?: StorefrontSectionPresentation;
  sourceType?: StorefrontSelectionSource;
  productIds?: string[];
  collectionId?: string | null;
  visibleCount?: number;
  columnsDesktop?: number;
  autoPlay?: boolean;
}

export interface StorefrontThemeConfig {
  schemaVersion?: number;
  template: StorefrontTemplateId;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroHeight?: StorefrontBannerHeight;
  heroFocalX?: number;
  heroFocalY?: number;
  heroMobileCoverUrl?: string | null;
  announcementText: string;
  banners: StorefrontBannerConfig[];
  collections: StorefrontCollectionConfig[];
  sections: StorefrontSectionConfig[];
  expressDelivery?: Record<string, any>;
}

export interface StorefrontThemeWarning {
  scope: 'banner' | 'selection' | 'collection' | 'look';
  targetId: string;
  sectionId?: string;
  code:
    | 'TARGET_PRODUCT_HIDDEN'
    | 'TARGET_PRODUCT_MISSING'
    | 'TARGET_CATEGORY_HIDDEN'
    | 'TARGET_COLLECTION_INACTIVE'
    | 'SELECTION_EMPTY'
    | 'PRODUCT_HIDDEN'
    | 'PRODUCT_OUT_OF_STOCK'
    | 'PRODUCT_NO_PHOTO'
    | 'LOOK_ITEM_UNAVAILABLE'
    | 'LOOK_ITEM_HIDDEN';
  message: string;
}

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'login',
  'pos',
  'caixa',
  'catalogo',
  'clientes',
  'trocas',
  'crediario',
  'vitrine',
  'loja-virtual',
  'sys-init',
  'dashboard',
  'health',
  'tv',
  'static',
  'assets',
]);

export function normalizeStorefrontSlug(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return cleaned;
}

export function assertValidStorefrontSlug(raw: unknown): string {
  const slug = normalizeStorefrontSlug(raw);
  if (!slug || slug.length < 3 || slug.length > 64) {
    throw new BadRequestException(
      'O endereço público (slug) deve ter entre 3 e 64 caracteres (letras, números e hífens).',
    );
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new BadRequestException('Endereço público (slug) em formato inválido.');
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new BadRequestException(
      `O endereço "${slug}" é reservado pelo sistema. Escolha outro nome para sua loja.`,
    );
  }
  return slug;
}

export function buildProductPublicSlug(name: string, retailGroupId: string): string {
  const base = normalizeStorefrontSlug(name) || 'produto';
  const suffix = String(retailGroupId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 6);
  return suffix ? `${base}-${suffix}` : base;
}

export function sanitizePlainText(
  value: unknown,
  maxLength: number,
  fieldName?: string,
): string {
  const raw = String(value ?? '').trim();
  if (/<script|javascript:|onerror=|onload=|<iframe|<object/i.test(raw)) {
    throw new BadRequestException(
      `Conteúdo não permitido em ${fieldName || 'campo de texto'}.`,
    );
  }
  const stripped = raw.replace(/[<>]/g, '').trim();
  if (stripped.length > maxLength) {
    return stripped.slice(0, maxLength);
  }
  return stripped;
}

export function sanitizeSafeImageUrl(url: unknown): string | null {
  if (url === null || url === undefined || url === '') return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (raw.length > 1024) {
    throw new BadRequestException('URL de imagem excede o limite permitido.');
  }
  if (/^(javascript|vbscript|data:text)/i.test(raw)) {
    throw new BadRequestException('URL de imagem inválida ou insegura.');
  }
  if (
    raw.startsWith('/api/products/uploads/images/') ||
    raw.startsWith('/api/tenants/uploads/logos/') ||
    raw.startsWith('/uploads/') ||
    /^https:\/\//i.test(raw) ||
    /^http:\/\/(localhost|127\.0\.0\.1)/i.test(raw)
  ) {
    return raw;
  }
  throw new BadRequestException(
    'A imagem deve pertencer à galeria oficial da loja ou usar endereço HTTPS válido.',
  );
}

export function getDefaultStorefrontTheme(storeName = 'Minha Loja'): StorefrontThemeConfig {
  return {
    schemaVersion: 2,
    template: 'editorial_roxo',
    primaryColor: '#7C3AED',
    accentColor: '#6D28D9',
    surfaceColor: '#F8F7FC',
    textColor: '#272321',
    heroTitle: storeName ? `Bem-vindo à ${storeName}` : 'Confira nossa coleção',
    heroSubtitle:
      'Escolha suas peças favoritas, selecione tamanho e cor e finalize seu pedido pelo WhatsApp.',
    heroCtaLabel: 'Ver catálogo',
    heroHeight: 'md',
    heroFocalX: 50,
    heroFocalY: 50,
    heroMobileCoverUrl: null,
    announcementText: 'Retirada na loja ou entrega a combinar pelo WhatsApp',
    banners: [],
    collections: [],
    sections: [
      { id: 'sec-header', type: 'header', enabled: true, title: 'Cabeçalho' },
      { id: 'sec-hero', type: 'hero', enabled: true, title: 'Capa de destaque' },
      { id: 'sec-categories', type: 'categories', enabled: true, title: 'Categorias' },
      {
        id: 'sec-featured',
        type: 'featured',
        enabled: true,
        title: 'Destaques da loja',
        presentation: 'grid',
        sourceType: 'featured',
        productIds: [],
        visibleCount: 12,
        columnsDesktop: 4,
        autoPlay: false,
      },
      { id: 'sec-collection', type: 'collection', enabled: true, title: 'Catálogo completo' },
      {
        id: 'sec-fulfillment',
        type: 'fulfillment_info',
        enabled: true,
        title: 'Retirada e Entrega',
      },
      { id: 'sec-footer', type: 'footer', enabled: true, title: 'Rodapé e Contato' },
    ],
  };
}

function validatePaletteColor(raw: unknown, fallback: string): string {
  const upper = String(raw || fallback).trim().toUpperCase();
  if ((APPROVED_STOREFRONT_PALETTE as readonly string[]).includes(upper)) {
    return upper;
  }
  throw new BadRequestException(
    `Cor "${String(raw)}" fora da paleta aprovada (${APPROVED_STOREFRONT_PALETTE.join(', ')}).`,
  );
}

function clampFocalCoord(raw: unknown, fallback = 50): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampIntRange(
  raw: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeOrderedIds(raw: unknown, maxItems = 48): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const clean = sanitizePlainText(entry, 80);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeBannerConfig(
  b: any,
  idx: number,
  fallbackId?: string,
): StorefrontBannerConfig {
  const imageUrl = sanitizeSafeImageUrl(b?.imageUrl);
  const mobileImageUrl = sanitizeSafeImageUrl(b?.mobileImageUrl);
  const rawFormat = String(b?.format || '');
  const format: StorefrontBannerFormat = (
    ['strip', 'side_by_side', 'campaign'] as const
  ).includes(rawFormat as StorefrontBannerFormat)
    ? (rawFormat as StorefrontBannerFormat)
    : imageUrl
      ? 'side_by_side'
      : 'strip';

  const rawHeight = String(b?.height || '');
  const height: StorefrontBannerHeight = (['sm', 'md', 'lg'] as const).includes(
    rawHeight as StorefrontBannerHeight,
  )
    ? (rawHeight as StorefrontBannerHeight)
    : 'md';

  const rawTarget = String(b?.targetType || b?.linkType || '');
  const targetType: StorefrontBannerTargetType = (
    ['none', 'all', 'featured', 'category', 'product', 'collection'] as const
  ).includes(rawTarget as StorefrontBannerTargetType)
    ? (rawTarget as StorefrontBannerTargetType)
    : 'all';

  const rawEnabled =
    b?.enabled !== undefined
      ? b.enabled !== false
      : b?.active !== undefined
        ? b.active !== false
        : true;

  return {
    id: sanitizePlainText(b?.id || fallbackId || `banner-${idx + 1}`, 48),
    title: sanitizePlainText(b?.title || 'Destaque', 100, 'Título do banner'),
    subtitle: sanitizePlainText(b?.subtitle || '', 200, 'Subtítulo do banner'),
    imageUrl,
    mobileImageUrl,
    format,
    height,
    focalX: clampFocalCoord(b?.focalX, 50),
    focalY: clampFocalCoord(b?.focalY, 50),
    ctaLabel: sanitizePlainText(
      b?.ctaLabel !== undefined ? b.ctaLabel : 'Conferir',
      40,
    ),
    targetType,
    targetValue: sanitizePlainText(b?.targetValue ?? b?.linkTarget ?? '', 120),
    enabled: rawEnabled,
  };
}

export function validateAndSanitizeTheme(
  rawTheme: any,
  storeName = 'Minha Loja',
): StorefrontThemeConfig {
  const defaults = getDefaultStorefrontTheme(storeName);
  if (!rawTheme || typeof rawTheme !== 'object') {
    return defaults;
  }

  const incomingSchemaVersion = Number(rawTheme.schemaVersion || 1);

  const template: StorefrontTemplateId = (
    STOREFRONT_TEMPLATES as readonly string[]
  ).includes(String(rawTheme.template || ''))
    ? (rawTheme.template as StorefrontTemplateId)
    : defaults.template;

  const primaryColor = validatePaletteColor(
    rawTheme.primaryColor,
    defaults.primaryColor,
  );
  const accentColor = validatePaletteColor(
    rawTheme.accentColor,
    defaults.accentColor,
  );
  const surfaceColor = validatePaletteColor(
    rawTheme.surfaceColor,
    defaults.surfaceColor,
  );
  const textColor = validatePaletteColor(rawTheme.textColor, defaults.textColor);

  const heroTitle =
    sanitizePlainText(rawTheme.heroTitle, 120, 'Título de capa') ||
    defaults.heroTitle;
  const heroSubtitle =
    sanitizePlainText(rawTheme.heroSubtitle, 280, 'Subtítulo de capa') ||
    defaults.heroSubtitle;
  const heroCtaLabel =
    sanitizePlainText(rawTheme.heroCtaLabel, 40, 'Botão da capa') ||
    defaults.heroCtaLabel;
  const heroHeight: StorefrontBannerHeight = (
    ['sm', 'md', 'lg'] as const
  ).includes(String(rawTheme.heroHeight || '') as StorefrontBannerHeight)
    ? (rawTheme.heroHeight as StorefrontBannerHeight)
    : 'md';
  const heroFocalX = clampFocalCoord(rawTheme.heroFocalX, 50);
  const heroFocalY = clampFocalCoord(rawTheme.heroFocalY, 50);
  const heroMobileCoverUrl = sanitizeSafeImageUrl(rawTheme.heroMobileCoverUrl);

  const announcementText = sanitizePlainText(
    rawTheme.announcementText ?? defaults.announcementText,
    140,
    'Faixa de aviso',
  );

  // 1. Coleções curadas e "Monte o look"
  const rawCollections = Array.isArray(rawTheme.collections)
    ? rawTheme.collections.slice(0, 40)
    : [];
  const collections: StorefrontCollectionConfig[] = [];
  const seenColIds = new Set<string>();
  const seenColSlugs = new Set<string>();

  for (let i = 0; i < rawCollections.length; i++) {
    const c = rawCollections[i];
    if (!c || typeof c !== 'object') continue;
    const rawId = sanitizePlainText(c.id || `col-${i + 1}`, 48);
    const colId = seenColIds.has(rawId) ? `${rawId}-${i + 1}` : rawId;
    seenColIds.add(colId);

    const title =
      sanitizePlainText(c.title || 'Coleção', 100, 'Título da coleção') ||
      `Coleção ${i + 1}`;
    const baseSlug =
      normalizeStorefrontSlug(c.slug || title) || `colecao-${i + 1}`;
    let uniqueSlug = baseSlug;
    let suffix = 2;
    while (seenColSlugs.has(uniqueSlug)) {
      uniqueSlug = `${baseSlug.slice(0, 58)}-${suffix}`;
      suffix++;
    }
    seenColSlugs.add(uniqueSlug);

    const kind: StorefrontCollectionKind =
      c.kind === 'look' ? 'look' : 'collection';

    collections.push({
      id: colId,
      slug: uniqueSlug,
      kind,
      enabled: c.enabled !== false,
      title,
      subtitle: sanitizePlainText(c.subtitle || '', 180, 'Subtítulo da coleção'),
      description: sanitizePlainText(
        c.description || '',
        600,
        'Descrição da coleção',
      ),
      coverUrl: sanitizeSafeImageUrl(c.coverUrl),
      focalX: clampFocalCoord(c.focalX, 50),
      focalY: clampFocalCoord(c.focalY, 50),
      productIds: sanitizeOrderedIds(c.productIds, 60),
    });
  }

  // 2. Banners (array legado ou sincronizado)
  const rawBanners = Array.isArray(rawTheme.banners)
    ? rawTheme.banners.slice(0, 16)
    : [];
  const legacyBannersMap = new Map<string, StorefrontBannerConfig>();
  const parsedRawBanners: StorefrontBannerConfig[] = rawBanners.map(
    (b: any, idx: number) => {
      const parsed = sanitizeBannerConfig(b, idx);
      legacyBannersMap.set(parsed.id, parsed);
      return parsed;
    },
  );

  // 3. Seções da página (estruturais únicas + seções repetíveis por ID estável)
  const rawSections = Array.isArray(rawTheme.sections)
    ? rawTheme.sections.slice(0, 32)
    : defaults.sections;
  const sections: StorefrontSectionConfig[] = [];
  const seenSingletonTypes = new Set<StorefrontSectionType>();
  const seenSectionIds = new Set<string>();
  const referencedBannerIds = new Set<string>();

  for (let i = 0; i < rawSections.length; i++) {
    const s = rawSections[i];
    const type = String(s?.type || '') as StorefrontSectionType;
    if (!(STOREFRONT_SECTION_TYPES as readonly string[]).includes(type)) {
      continue;
    }
    if (
      SINGLETON_STOREFRONT_SECTION_TYPES.has(type) &&
      seenSingletonTypes.has(type)
    ) {
      continue;
    }

    let id = sanitizePlainText(s?.id || `sec-${type}-${i + 1}`, 48);
    if (!id) id = `sec-${type}-${i + 1}`;
    if (seenSectionIds.has(id)) {
      id = `${id}-${i + 1}`;
    }
    seenSectionIds.add(id);
    if (SINGLETON_STOREFRONT_SECTION_TYPES.has(type)) {
      seenSingletonTypes.add(type);
    }

    const enabled = s?.enabled !== false;

    if (type === 'banner') {
      const lookupId = sanitizePlainText(s?.bannerId || s?.banner?.id || '', 48);
      const sourceBanner =
        (s?.banner && typeof s.banner === 'object' ? s.banner : null) ||
        (lookupId ? legacyBannersMap.get(lookupId) : null) ||
        {
          id: lookupId || `bnr-${id}`,
          title: s?.title || 'Destaque da loja',
          subtitle: s?.subtitle || '',
          enabled,
        };
      const cleanBanner = sanitizeBannerConfig(
        { ...sourceBanner, enabled },
        i,
        lookupId || `bnr-${id}`,
      );
      referencedBannerIds.add(cleanBanner.id);
      sections.push({
        id,
        type: 'banner',
        enabled,
        title: cleanBanner.title,
        subtitle: cleanBanner.subtitle || '',
        bannerId: cleanBanner.id,
        banner: cleanBanner,
      });
      continue;
    }

    if (type === 'featured' || type === 'product_selection') {
      const presentation: StorefrontSectionPresentation =
        s?.presentation === 'carousel' ? 'carousel' : 'grid';
      const defaultSource: StorefrontSelectionSource =
        type === 'featured' ? 'featured' : 'manual';
      const sourceType: StorefrontSelectionSource = (
        ['manual', 'featured', 'collection', 'category'] as const
      ).includes(String(s?.sourceType || '') as StorefrontSelectionSource)
        ? (s.sourceType as StorefrontSelectionSource)
        : defaultSource;
      const defaultVisible = type === 'featured' ? 12 : 8;

      sections.push({
        id,
        type,
        enabled,
        title: sanitizePlainText(
          s?.title ||
            (type === 'featured' ? 'Destaques da loja' : 'Seleção de peças'),
          80,
        ),
        subtitle: sanitizePlainText(s?.subtitle || '', 160),
        categoryId: s?.categoryId ? sanitizePlainText(s.categoryId, 64) : null,
        collectionId: s?.collectionId
          ? sanitizePlainText(s.collectionId, 64)
          : null,
        presentation,
        sourceType,
        productIds: sanitizeOrderedIds(s?.productIds, 48),
        visibleCount: clampIntRange(s?.visibleCount, 1, 48, defaultVisible),
        columnsDesktop: clampIntRange(s?.columnsDesktop, 2, 5, 4),
        autoPlay: s?.autoPlay === true,
      });
      continue;
    }

    if (type === 'look') {
      sections.push({
        id,
        type: 'look',
        enabled,
        title: sanitizePlainText(s?.title || 'Monte o look', 80),
        subtitle: sanitizePlainText(s?.subtitle || '', 160),
        collectionId: s?.collectionId
          ? sanitizePlainText(s.collectionId, 64)
          : null,
        productIds: sanitizeOrderedIds(s?.productIds, 24),
      });
      continue;
    }

    sections.push({
      id,
      type,
      enabled,
      title: sanitizePlainText(s?.title || '', 80),
      subtitle: sanitizePlainText(s?.subtitle || '', 160),
      categoryId: s?.categoryId ? sanitizePlainText(s.categoryId, 64) : null,
    });
  }

  // Preserva seções estruturais obrigatórias caso ausentes
  const hasAnyFeaturedSection = sections.some(
    (s) => s.type === 'featured' || s.type === 'product_selection',
  );
  for (const defSec of defaults.sections) {
    if (defSec.type === 'featured') {
      if (!hasAnyFeaturedSection && incomingSchemaVersion < 2) {
        sections.push({ ...defSec });
      }
      continue;
    }
    if (!seenSingletonTypes.has(defSec.type)) {
      sections.push({ ...defSec });
      seenSingletonTypes.add(defSec.type);
    }
  }

  // Migração retrocompatível: lojas antigas com `theme.banners` sem seção `banner` explícita
  const unmigratedBanners = parsedRawBanners.filter(
    (b) => !referencedBannerIds.has(b.id),
  );
  if (
    unmigratedBanners.length > 0 &&
    !sections.some((s) => s.type === 'banner') &&
    incomingSchemaVersion < 2
  ) {
    const heroIdx = sections.findIndex((s) => s.type === 'hero');
    const insertAt = heroIdx >= 0 ? heroIdx + 1 : 1;
    const migratedSections: StorefrontSectionConfig[] = unmigratedBanners.map(
      (b, idx) => {
        const baseSecId = sanitizePlainText(`sec-banner-${b.id}`, 48) || `sec-banner-${idx + 1}`;
        const secId = seenSectionIds.has(baseSecId)
          ? `${baseSecId}-${idx + 1}`
          : baseSecId;
        seenSectionIds.add(secId);
        return {
          id: secId,
          type: 'banner',
          enabled: b.enabled !== false,
          title: b.title,
          subtitle: b.subtitle || '',
          bannerId: b.id,
          banner: b,
        };
      },
    );
    sections.splice(insertAt, 0, ...migratedSections);
  }

  // Mantém `banners` sincronizado com as seções de banner para compatibilidade com leitores anteriores
  const syncedBanners: StorefrontBannerConfig[] = sections
    .filter((s) => s.type === 'banner' && s.banner)
    .map((s) => ({
      ...(s.banner as StorefrontBannerConfig),
      enabled: s.enabled !== false,
    }));

  const result: StorefrontThemeConfig = {
    schemaVersion: 2,
    template,
    primaryColor,
    accentColor,
    surfaceColor,
    textColor,
    heroTitle,
    heroSubtitle,
    heroCtaLabel,
    heroHeight,
    heroFocalX,
    heroFocalY,
    heroMobileCoverUrl,
    announcementText,
    banners: syncedBanners,
    collections,
    sections,
  };

  if (rawTheme.expressDelivery && typeof rawTheme.expressDelivery === 'object') {
    result.expressDelivery = rawTheme.expressDelivery;
  }

  return result;
}

const TEMPLATE_HUMAN_NAMES: Record<StorefrontTemplateId, string> = {
  editorial_roxo: 'Editorial Roxo',
  minimal_branco: 'Minimalista Branco',
  vitrine_escura: 'Vitrine Escura',
};

export function summarizeThemeChanges(
  draftTheme: StorefrontThemeConfig,
  publishedTheme: StorefrontThemeConfig | null | undefined,
  isPublished: boolean,
): { hasChanges: boolean; items: string[] } {
  if (!publishedTheme) {
    return {
      hasChanges: true,
      items: ['Primeira publicação da vitrine com o rascunho atual.'],
    };
  }

  const items: string[] = [];

  if (draftTheme.template !== publishedTheme.template) {
    items.push(
      `Modelo visual alterado de "${TEMPLATE_HUMAN_NAMES[publishedTheme.template] || publishedTheme.template}" para "${TEMPLATE_HUMAN_NAMES[draftTheme.template] || draftTheme.template}".`,
    );
  }

  if (
    draftTheme.primaryColor !== publishedTheme.primaryColor ||
    draftTheme.accentColor !== publishedTheme.accentColor ||
    draftTheme.surfaceColor !== publishedTheme.surfaceColor ||
    draftTheme.textColor !== publishedTheme.textColor
  ) {
    items.push('Paleta de tokens visuais atualizada.');
  }

  if (
    draftTheme.heroTitle !== publishedTheme.heroTitle ||
    draftTheme.heroSubtitle !== publishedTheme.heroSubtitle ||
    draftTheme.heroCtaLabel !== publishedTheme.heroCtaLabel ||
    draftTheme.heroHeight !== (publishedTheme.heroHeight || 'md') ||
    draftTheme.heroFocalX !== (publishedTheme.heroFocalX ?? 50) ||
    draftTheme.heroFocalY !== (publishedTheme.heroFocalY ?? 50) ||
    (draftTheme.heroMobileCoverUrl || null) !==
      (publishedTheme.heroMobileCoverUrl || null)
  ) {
    items.push('Capa principal (textos, proporção ou enquadramento) alterada.');
  }

  if (draftTheme.announcementText !== publishedTheme.announcementText) {
    items.push('Faixa superior de aviso atualizada.');
  }

  const draftSecOrder = draftTheme.sections
    .map((s) => `${s.id}:${s.enabled ? '1' : '0'}`)
    .join('|');
  const pubSecOrder = (publishedTheme.sections || [])
    .map((s) => `${s.id}:${s.enabled ? '1' : '0'}`)
    .join('|');
  if (draftSecOrder !== pubSecOrder) {
    items.push('Ordem ou visibilidade das seções da página alterada.');
  }

  const draftBannersJson = JSON.stringify(
    draftTheme.sections.filter((s) => s.type === 'banner'),
  );
  const pubBannersJson = JSON.stringify(
    (publishedTheme.sections || []).filter((s) => s.type === 'banner'),
  );
  if (draftBannersJson !== pubBannersJson) {
    const activeCount = draftTheme.sections.filter(
      (s) => s.type === 'banner' && s.enabled,
    ).length;
    items.push(
      `Banners independentes atualizados (${activeCount} ativo${activeCount === 1 ? '' : 's'}).`,
    );
  }

  const draftSelectionsJson = JSON.stringify(
    draftTheme.sections.filter(
      (s) =>
        s.type === 'featured' ||
        s.type === 'product_selection' ||
        s.type === 'look',
    ),
  );
  const pubSelectionsJson = JSON.stringify(
    (publishedTheme.sections || []).filter(
      (s) =>
        s.type === 'featured' ||
        s.type === 'product_selection' ||
        s.type === 'look',
    ),
  );
  if (draftSelectionsJson !== pubSelectionsJson) {
    items.push('Seleções de produtos, destaques ou carrosséis atualizados.');
  }

  const draftColsJson = JSON.stringify(draftTheme.collections || []);
  const pubColsJson = JSON.stringify(publishedTheme.collections || []);
  if (draftColsJson !== pubColsJson) {
    const colsCount = (draftTheme.collections || []).length;
    items.push(
      `Coleções curadas e looks atualizados (${colsCount} cadastrado${colsCount === 1 ? '' : 's'}).`,
    );
  }

  const hasChanges = items.length > 0 || !isPublished;
  if (!isPublished && items.length === 0) {
    items.push('A vitrine está pausada e voltará ao ar com esta publicação.');
  }

  return { hasChanges, items };
}

export function validateThemeReferences(
  theme: StorefrontThemeConfig,
  catalog: {
    categories: Array<{
      categoryId: string;
      slug: string;
      name: string;
      visible: boolean;
    }>;
    products: Array<{
      retailGroupId: string;
      publicSlug: string;
      title: string;
      visible: boolean;
      active?: boolean;
      imageUrl?: string | null;
      availableStock: number;
    }>;
  },
): StorefrontThemeWarning[] {
  const warnings: StorefrontThemeWarning[] = [];
  const catBySlug = new Map(
    catalog.categories.map((c) => [c.slug.toLowerCase(), c]),
  );
  const catById = new Map(catalog.categories.map((c) => [c.categoryId, c]));
  const prodById = new Map(
    catalog.products.map((p) => [p.retailGroupId, p]),
  );
  const prodBySlug = new Map(
    catalog.products.map((p) => [p.publicSlug.toLowerCase(), p]),
  );
  const colById = new Map(
    (theme.collections || []).map((c) => [c.id, c]),
  );
  const colBySlug = new Map(
    (theme.collections || []).map((c) => [c.slug.toLowerCase(), c]),
  );

  // 1. Validar destinos de banners ativos
  for (const sec of theme.sections) {
    if (sec.type === 'banner' && sec.enabled && sec.banner) {
      const b = sec.banner;
      const val = String(b.targetValue || '').trim();
      if (b.targetType === 'product') {
        const prod = prodBySlug.get(val.toLowerCase()) || prodById.get(val);
        if (!prod) {
          warnings.push({
            scope: 'banner',
            targetId: b.id,
            sectionId: sec.id,
            code: 'TARGET_PRODUCT_MISSING',
            message: `O banner "${b.title}" aponta para um produto não encontrado.`,
          });
        } else if (!prod.visible || prod.active === false) {
          warnings.push({
            scope: 'banner',
            targetId: b.id,
            sectionId: sec.id,
            code: 'TARGET_PRODUCT_HIDDEN',
            message: `O banner "${b.title}" aponta para "${prod.title}", que está oculto na vitrine.`,
          });
        }
      } else if (b.targetType === 'category') {
        const cat = catBySlug.get(val.toLowerCase()) || catById.get(val);
        if (!cat || !cat.visible) {
          warnings.push({
            scope: 'banner',
            targetId: b.id,
            sectionId: sec.id,
            code: 'TARGET_CATEGORY_HIDDEN',
            message: `O banner "${b.title}" aponta para uma categoria oculta ou inexistente.`,
          });
        }
      } else if (b.targetType === 'collection') {
        const col = colBySlug.get(val.toLowerCase()) || colById.get(val);
        if (!col || !col.enabled) {
          warnings.push({
            scope: 'banner',
            targetId: b.id,
            sectionId: sec.id,
            code: 'TARGET_COLLECTION_INACTIVE',
            message: `O banner "${b.title}" aponta para uma coleção desativada ou inexistente.`,
          });
        }
      }
    }

    // 2. Validar seleções manuais de produtos
    if (
      (sec.type === 'product_selection' || sec.type === 'featured') &&
      sec.enabled &&
      sec.sourceType === 'manual'
    ) {
      const ids = sec.productIds || [];
      if (ids.length === 0) {
        warnings.push({
          scope: 'selection',
          targetId: sec.id,
          sectionId: sec.id,
          code: 'SELECTION_EMPTY',
          message: `A seção "${sec.title || 'Seleção'}" não possui produtos selecionados.`,
        });
      }
      for (const pid of ids) {
        const prod = prodById.get(pid);
        if (!prod || !prod.visible || prod.active === false) {
          warnings.push({
            scope: 'selection',
            targetId: pid,
            sectionId: sec.id,
            code: 'PRODUCT_HIDDEN',
            message: `Item "${prod?.title || pid}" na seção "${sec.title}" está oculto na vitrine.`,
          });
        } else {
          if (prod.availableStock <= 0) {
            warnings.push({
              scope: 'selection',
              targetId: pid,
              sectionId: sec.id,
              code: 'PRODUCT_OUT_OF_STOCK',
              message: `Item "${prod.title}" na seção "${sec.title}" está sem estoque disponível.`,
            });
          }
          if (!prod.imageUrl) {
            warnings.push({
              scope: 'selection',
              targetId: pid,
              sectionId: sec.id,
              code: 'PRODUCT_NO_PHOTO',
              message: `Item "${prod.title}" na seção "${sec.title}" está sem foto cadastrada.`,
            });
          }
        }
      }
    }
  }

  // 3. Validar coleções e especialmente peças de "Monte o look"
  for (const col of theme.collections || []) {
    if (!col.enabled) continue;
    for (const pid of col.productIds) {
      const prod = prodById.get(pid);
      if (col.kind === 'look') {
        if (!prod || !prod.visible || prod.active === false) {
          warnings.push({
            scope: 'look',
            targetId: col.id,
            code: 'LOOK_ITEM_HIDDEN',
            message: `Peça "${prod?.title || pid}" do look "${col.title}" está oculta ou inativa.`,
          });
        } else if (prod.availableStock <= 0) {
          warnings.push({
            scope: 'look',
            targetId: col.id,
            code: 'LOOK_ITEM_UNAVAILABLE',
            message: `Peça "${prod.title}" do look "${col.title}" perdeu disponibilidade de estoque.`,
          });
        }
      }
    }
  }

  return warnings;
}

function assertNonTrivialPhoneDigits(digits: string, label: string): void {
  if (/^(\d)\1+$/.test(digits)) {
    throw new BadRequestException(`Informe um ${label} válido (dígitos repetidos não são permitidos).`);
  }
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (national.length === 10 || national.length === 11) {
    const ddd = Number(national.slice(0, 2));
    const subscriber = national.slice(2);
    if (ddd < 11 || /^0+$/.test(subscriber) || /^(\d)\1+$/.test(subscriber)) {
      throw new BadRequestException(`Informe um ${label} válido com DDD real.`);
    }
  }
}

export function normalizeWhatsappPhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  assertNonTrivialPhoneDigits(digits, 'número de WhatsApp');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    return digits;
  }
  throw new BadRequestException(
    'Informe um número de WhatsApp válido com DDD (ex.: 11999999999 ou 5511999999999).',
  );
}

export function normalizeCustomerPhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new BadRequestException(
      'Informe um telefone/WhatsApp válido com DDD para contato.',
    );
  }
  assertNonTrivialPhoneDigits(digits, 'telefone/WhatsApp');
  return digits;
}

export function generateOrderAccessToken(): string {
  return randomBytes(24).toString('hex');
}

export function hashOrderAccessToken(token: string): string {
  return createHash('sha256')
    .update(String(token || '').trim())
    .digest('hex');
}

export function verifyOrderAccessToken(
  providedToken: unknown,
  storedHash: unknown,
): boolean {
  const cleanToken = String(providedToken ?? '').trim();
  const cleanHash = String(storedHash ?? '').trim();
  if (!cleanToken || !cleanHash || cleanToken.length < 16) return false;
  const computed = hashOrderAccessToken(cleanToken);
  if (computed.length !== cleanHash.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(computed, 'utf8'),
      Buffer.from(cleanHash, 'utf8'),
    );
  } catch {
    return false;
  }
}

export function normalizeOrderIdempotencyKey(
  rawKey: unknown,
  tenantId: string,
): string {
  const trimmed = String(rawKey ?? '').trim();
  if (!trimmed || trimmed.length < 8 || trimmed.length > 120) {
    throw new BadRequestException(
      'Chave de idempotência do pedido inválida ou ausente.',
    );
  }
  return createHash('sha256')
    .update(`${tenantId}::storefront-order::${trimmed}`)
    .digest('hex')
    .slice(0, 64);
}

export function computeStorefrontOrderFingerprint(payload: {
  customerPhone: string;
  fulfillmentMode: string;
  deliveryVehicle?: string | null;
  items: { productId: string; quantity: number }[];
}): string {
  const canonicalItems = [...(payload.items || [])]
    .map((item) => ({
      productId: String(item.productId || '').trim(),
      quantity: Number(item.quantity || 0),
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  const canonicalObj: Record<string, any> = {
    phone: String(payload.customerPhone || '').replace(/\D/g, ''),
    mode: String(payload.fulfillmentMode || 'PICKUP').toUpperCase(),
    items: canonicalItems,
  };
  if (payload.deliveryVehicle) {
    canonicalObj.vehicle = String(payload.deliveryVehicle).toUpperCase();
  }

  return createHash('sha256')
    .update(JSON.stringify(canonicalObj))
    .digest('hex')
    .slice(0, 64);
}

export function formatCurrencyBrl(value: number | string): string {
  const num = Number(value || 0);
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

export function buildStorefrontWhatsappMessage(params: {
  storeName: string;
  introText?: string | null;
  reference: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMode: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: any;
  notes?: string | null;
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  items: {
    productName: string;
    size?: string | null;
    color?: string | null;
    quantity: number;
    priceUnit: number;
    subtotal: number;
  }[];
  orderStatusUrl?: string;
  compact?: boolean;
}): string {
  const lines: string[] = [];
  const intro =
    params.introText?.trim() ||
    `Olá! Acabei de registrar um pedido na *${params.storeName || 'Loja Virtual'}*.`;
  lines.push(intro);
  lines.push('');
  lines.push(`*Pedido:* ${params.reference}`);
  lines.push(`*Cliente:* ${params.customerName} (${params.customerPhone})`);

  const addr =
    params.fulfillmentMode === 'DELIVERY' &&
    params.deliveryAddress &&
    typeof params.deliveryAddress === 'object'
      ? params.deliveryAddress
      : null;
  const expressQuote =
    addr?.quote && typeof addr.quote === 'object' ? addr.quote : null;
  const expressDispatch =
    addr?.dispatch && typeof addr.dispatch === 'object' ? addr.dispatch : null;
  const deliveryFee = Math.max(
    0,
    Number(params.deliveryFee ?? addr?.deliveryFee ?? 0),
  );

  const fulfillmentLabel =
    params.fulfillmentMode === 'DELIVERY'
      ? expressQuote?.provider === '99_ENTREGAS'
        ? expressQuote.vehicleType === 'CARRO'
          ? '99Entrega Carro'
          : '99Entrega Moto'
        : 'Entrega a combinar'
      : 'Retirada na loja';

  lines.push(`*Atendimento:* ${fulfillmentLabel}`);

  if (addr) {
    const parts = [
      addr.street,
      addr.number ? `nº ${addr.number}` : '',
      addr.complement,
      addr.neighborhood,
      addr.city,
      addr.zipCode ? `CEP ${addr.zipCode}` : '',
      addr.reference ? `(Ref.: ${addr.reference})` : '',
    ].filter(Boolean);
    if (parts.length > 0) {
      lines.push(`*Endereço:* ${parts.join(', ')}`);
    }
    if (expressQuote?.distanceKm) {
      lines.push(
        `*Rota 99:* ~${Number(expressQuote.distanceKm)
          .toFixed(1)
          .replace('.', ',')} km (${expressQuote.estimatedMinutes || 25} min est.)`,
      );
    }
  }

  lines.push('');
  lines.push('*Itens do pedido:*');

  const maxDetailedItems = params.compact ? 5 : 20;
  const shownItems = params.items.slice(0, maxDetailedItems);

  for (const item of shownItems) {
    const variantParts = [item.size, item.color].filter(Boolean);
    const variantSuffix = variantParts.length
      ? ` [${variantParts.join(' / ')}]`
      : '';
    lines.push(
      `- ${item.quantity}x ${item.productName}${variantSuffix} — ${formatCurrencyBrl(item.subtotal)}`,
    );
  }

  if (params.items.length > shownItems.length) {
    const remainingCount = params.items.length - shownItems.length;
    lines.push(`...e mais ${remainingCount} item(ns) no pedido.`);
  }

  lines.push('');
  if (expressQuote?.provider === '99_ENTREGAS' || deliveryFee > 0) {
    const subtotalVal =
      params.subtotal !== undefined
        ? Number(params.subtotal)
        : Math.max(0, Number(params.total || 0) - deliveryFee);
    lines.push(`*Subtotal dos produtos:* ${formatCurrencyBrl(subtotalVal)}`);
    lines.push(
      `*Frete (${fulfillmentLabel}):* ${
        deliveryFee === 0 && expressQuote?.freeShippingApplied
          ? 'Grátis'
          : formatCurrencyBrl(deliveryFee)
      }`,
    );
    lines.push(`*Total do pedido:* ${formatCurrencyBrl(params.total)}`);
    if (expressDispatch?.confirmationPin) {
      lines.push(
        `*PIN de segurança na entrega:* ${expressDispatch.confirmationPin}`,
      );
    }
  } else {
    lines.push(`*Total dos produtos:* ${formatCurrencyBrl(params.total)}`);
  }

  if (params.notes?.trim()) {
    lines.push(`*Observações:* ${params.notes.trim()}`);
  }

  if (params.orderStatusUrl) {
    lines.push('');
    lines.push(`Acompanhar pedido: ${params.orderStatusUrl}`);
  }

  return lines.join('\n');
}

export function buildStorefrontWhatsappUrl(
  whatsappPhone: string | null | undefined,
  message: string,
): string | null {
  if (!whatsappPhone) return null;
  const digits = String(whatsappPhone).replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ── RBAC e Matriz de Transições de Estado ────────────────────────────────────

export function assertStorefrontAdminRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (!['admin', 'superadmin', 'manager', 'group_owner'].includes(role)) {
    throw new ForbiddenException(
      'Apenas administradores podem alterar configurações ou publicação da Loja Virtual.',
    );
  }
}

export function assertStorefrontCatalogRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    !['admin', 'superadmin', 'manager', 'group_owner', 'stockist'].includes(role)
  ) {
    throw new ForbiddenException(
      'Sem permissão para gerenciar produtos e categorias da Loja Virtual.',
    );
  }
}

export function assertStorefrontOrderViewRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    ![
      'admin',
      'superadmin',
      'manager',
      'group_owner',
      'operator',
      'stockist',
    ].includes(role)
  ) {
    throw new ForbiddenException(
      'Sem permissão para visualizar pedidos da Loja Virtual.',
    );
  }
}

export function assertStorefrontOrderManageRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    !['admin', 'superadmin', 'manager', 'group_owner', 'operator'].includes(role)
  ) {
    throw new ForbiddenException(
      'Apenas administradores ou operadores de caixa podem confirmar, recusar, cancelar ou converter pedidos.',
    );
  }
}

export function assertStorefrontFulfillmentRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    ![
      'admin',
      'superadmin',
      'manager',
      'group_owner',
      'operator',
      'stockist',
    ].includes(role)
  ) {
    throw new ForbiddenException(
      'Sem permissão para atualizar o andamento da separação/entrega.',
    );
  }
}

const ALLOWED_COMMERCIAL_TRANSITIONS: Record<string, string[]> = {
  AWAITING_CONFIRMATION: [
    'CONFIRMED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
    'COMPLETED',
  ],
  CONFIRMED: ['CANCELLED', 'EXPIRED', 'COMPLETED'],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
  COMPLETED: ['CANCELLED'], // Somente via cancelamento da Sale vinculada
};

export function assertValidCommercialTransition(
  currentStatus: string,
  nextStatus: string,
): void {
  const allowed = ALLOWED_COMMERCIAL_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new BadRequestException(
      `Transição de estado comercial inválida: de "${currentStatus}" para "${nextStatus}".`,
    );
  }
}

const VALID_FULFILLMENT_STATUSES = new Set([
  'WAITING_SEPARATION',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

export function assertValidFulfillmentStatus(status: unknown): string {
  const normalized = String(status || '').trim().toUpperCase();
  if (!VALID_FULFILLMENT_STATUSES.has(normalized)) {
    throw new BadRequestException(
      `Status de atendimento inválido: "${String(status)}".`,
    );
  }
  return normalized;
}

// ── DTO Mappers Públicos (Allowlist Estrita — Nunca expor custos/dados internos) ──

export function toPublicCategoryDto(sc: any) {
  return {
    id: sc.categoryId,
    storefrontCategoryId: sc.id,
    slug: sc.slug,
    name: sc.displayName || sc.category?.name || 'Categoria',
    description: sc.description || null,
    icon: sc.category?.icon || null,
    featured: Boolean(sc.featured),
    sortOrder: Number(sc.sortOrder ?? 0),
  };
}

export function toPublicVariantDto(
  variant: any,
  reservedQty: number,
  groupPriceSell: number,
  fallbackImageUrl: string | null = null,
) {
  const physical = Math.max(0, Math.floor(Number(variant.stock ?? 0)));
  const availableStock = Math.max(0, physical - Math.max(0, reservedQty));
  const priceSell = Number(groupPriceSell || variant.priceSell || 0);
  return {
    id: variant.id,
    size: variant.size || null,
    color: variant.color || null,
    unit: variant.unit || 'UN',
    imageUrl: variant.imageUrl || fallbackImageUrl || null,
    priceSell,
    availableStock,
    inStock: Boolean(variant.active !== false && availableStock > 0),
  };
}

export function toPublicProductDto(
  sp: any,
  reservedByProductId: Map<string, { quantity: number }>,
) {
  const rg = sp.retailGroup;
  const priceSell = Number(rg?.priceSell ?? 0);
  const rawGallery = Array.isArray(sp.galleryUrlsJson) ? sp.galleryUrlsJson : [];
  const activeVariants = (rg?.variants || []).filter(
    (v: any) => v.active !== false,
  );
  const firstVariantImg =
    activeVariants.find((v: any) => v.imageUrl)?.imageUrl || null;
  const mainImage = rg?.imageUrl || rawGallery[0] || firstVariantImg || null;
  const gallery = Array.from(
    new Set([mainImage, ...rawGallery].filter(Boolean)),
  ) as string[];

  const variants = activeVariants.map((v: any) =>
    toPublicVariantDto(
      v,
      reservedByProductId.get(v.id)?.quantity ?? 0,
      priceSell,
      mainImage,
    ),
  );

  const totalAvailableStock = variants.reduce(
    (acc: number, v: any) => acc + v.availableStock,
    0,
  );
  const sizes = Array.from(
    new Set(variants.map((v: any) => v.size).filter(Boolean)),
  ) as string[];
  const colors = Array.from(
    new Set(variants.map((v: any) => v.color).filter(Boolean)),
  ) as string[];

  return {
    id: rg.id,
    retailGroupId: rg.id,
    storefrontProductId: sp.id,
    slug: sp.publicSlug,
    title: sp.commercialTitle || rg.name,
    description: sp.commercialDescription || null,
    badgeLabel: sp.badgeLabel || null,
    categoryId: rg.categoryId,
    categoryName: rg.category?.name || null,
    imageUrl: mainImage,
    galleryUrls: gallery,
    priceSell,
    featured: Boolean(sp.featured),
    sortOrder: Number(sp.sortOrder ?? 0),
    totalAvailableStock,
    availableStock: totalAvailableStock,
    inStock: totalAvailableStock > 0,
    sizes,
    colors,
    variants,
  };
}

export function toPublicOrderDto(
  order: any,
  whatsappUrl: string | null,
  whatsappMessage: string,
  compactWhatsappUrl?: string | null,
) {
  const addr =
    order.deliveryAddressJson && typeof order.deliveryAddressJson === 'object'
      ? order.deliveryAddressJson
      : null;
  const subtotalNum = Number(order.subtotal ?? 0);
  const discountNum = Number(order.discount ?? 0);
  const totalNum = Number(order.total ?? 0);
  const inferredFee = Math.max(
    0,
    Math.round((totalNum - subtotalNum + discountNum + Number.EPSILON) * 100) /
      100,
  );
  const deliveryFee =
    addr?.deliveryFee !== undefined
      ? Math.max(0, Number(addr.deliveryFee || 0))
      : inferredFee;

  const rawQuote =
    addr?.quote && typeof addr.quote === 'object' ? addr.quote : null;
  const expressQuote = rawQuote
    ? {
        provider: '99_ENTREGAS' as const,
        vehicleType: rawQuote.vehicleType === 'CARRO' ? 'CARRO' : 'MOTO',
        label:
          rawQuote.label ||
          (rawQuote.vehicleType === 'CARRO'
            ? '99Entrega Carro'
            : '99Entrega Moto'),
        fee: Number(rawQuote.fee ?? deliveryFee),
        distanceKm:
          rawQuote.distanceKm !== undefined && rawQuote.distanceKm !== null
            ? Number(rawQuote.distanceKm)
            : null,
        estimatedMinutes: Number(rawQuote.estimatedMinutes || 25),
        freeShippingApplied: Boolean(rawQuote.freeShippingApplied),
        originLabel: rawQuote.originLabel || null,
      }
    : null;

  const rawDispatch =
    addr?.dispatch && typeof addr.dispatch === 'object' ? addr.dispatch : null;
  const expressDispatch = rawDispatch
    ? {
        provider: '99_ENTREGAS' as const,
        status: rawDispatch.status || 'WAITING',
        vehicleType: rawDispatch.vehicleType === 'CARRO' ? 'CARRO' : 'MOTO',
        courierName: rawDispatch.courierName || null,
        vehiclePlate: rawDispatch.vehiclePlate || null,
        trackingUrl: rawDispatch.trackingUrl || null,
        confirmationPin: rawDispatch.confirmationPin || null,
        requestedAt: rawDispatch.requestedAt || null,
        dispatchedAt: rawDispatch.dispatchedAt || null,
        deliveredAt: rawDispatch.deliveredAt || null,
        updatedAt: rawDispatch.updatedAt || null,
      }
    : null;

  return {
    reference: order.reference,
    code: order.code,
    customerFirstName: String(order.customerName || '').split(/\s+/)[0] || 'Cliente',
    fulfillmentMode: order.fulfillmentMode,
    commercialStatus: order.commercialStatus,
    reservationStatus: order.reservationStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    reservationExpiresAt: order.reservationExpiresAt,
    subtotal: subtotalNum,
    discount: discountNum,
    deliveryFee,
    total: totalNum,
    deliveryDestination: addr
      ? {
          neighborhood: addr.neighborhood || null,
          city: addr.city || null,
          zipCode: addr.zipCode || null,
        }
      : null,
    expressQuote,
    expressDispatch,
    notes: order.notes || null,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt || null,
    completedAt: order.completedAt || null,
    cancelledAt: order.cancelledAt || null,
    cancelReason: order.cancelReason || null,
    items: (order.items || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      size: item.size || null,
      color: item.color || null,
      variantLabel: item.variantLabel || null,
      imageUrl: item.imageUrl || null,
      unit: item.unit || 'UN',
      quantity: Number(item.quantity),
      priceUnit: Number(item.priceUnit),
      priceSaleSnapshot: Number(item.priceUnit),
      subtotal: Number(item.subtotal),
    })),
    whatsappUrl,
    compactWhatsappUrl: compactWhatsappUrl || whatsappUrl,
    whatsappMessage,
  };
}
