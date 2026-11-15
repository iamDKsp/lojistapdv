import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Loader2,
  Monitor,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getFullUrl } from '@/lib/getFullUrl';
import { RetailSelect } from '@/components/ui/Select';
import { RetailSwitch } from '@/components/ui/Switch';
import {
  StorefrontCampaignVisual,
  StorefrontProductFrame,
} from '@/storefront/components/StorefrontProductFrame';
import { StorefrontIframePreview } from './StorefrontIframePreview';

export const TEMPLATE_OPTIONS = [
  {
    id: 'editorial_roxo',
    name: 'Editorial Roxo',
    compositionTag: 'Capa 7/5 • Grade 4 col.',
    desc: 'Composição de marca com capa dividida, tipografia expressiva e vitrine equilibrada.',
    bgPreview: '#F8F7FC',
    cardPreview: '#FFFFFF',
    textPreview: '#272321',
  },
  {
    id: 'minimal_branco',
    name: 'Minimalista Branco',
    compositionTag: 'Capa 6/6 • Grade 3 col. ampla',
    desc: 'Galeria arejada em fundo branco puro, margens generosas e protagonismo total das peças.',
    bgPreview: '#FFFFFF',
    cardPreview: '#F8F7FC',
    textPreview: '#272321',
  },
  {
    id: 'vitrine_escura',
    name: 'Vitrine Escura',
    compositionTag: 'Capa panorâmica • Grade 5 col.',
    desc: 'Contraste urbano em fundo escuro, grade densa de alta capacidade e destaque em roxo.',
    bgPreview: '#272321',
    cardPreview: '#272321',
    textPreview: '#FFFFFF',
  },
] as const;

const SINGLETON_SECTION_TYPES = new Set([
  'header',
  'hero',
  'categories',
  'collection',
  'fulfillment_info',
  'footer',
]);

const VALID_SECTION_TYPES = new Set([
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
]);

export const DEFAULT_STOREFRONT_SECTIONS = [
  { id: 'sec-header', type: 'header', enabled: true, title: 'Cabeçalho da Loja' },
  { id: 'sec-hero', type: 'hero', enabled: true, title: 'Capa Principal (Hero)' },
  {
    id: 'sec-categories',
    type: 'categories',
    enabled: true,
    title: 'Navegação por Categorias',
  },
  {
    id: 'sec-featured',
    type: 'featured',
    enabled: true,
    title: 'Destaques da Loja',
    subtitle: '',
    presentation: 'grid',
    sourceType: 'featured',
    productIds: [] as string[],
    collectionId: null as string | null,
    visibleCount: 12,
    columnsDesktop: 4,
    autoPlay: false,
  },
  {
    id: 'sec-collection',
    type: 'collection',
    enabled: true,
    title: 'Catálogo Completo',
  },
  {
    id: 'sec-fulfillment',
    type: 'fulfillment_info',
    enabled: true,
    title: 'Retirada & Entrega',
  },
  {
    id: 'sec-footer',
    type: 'footer',
    enabled: true,
    title: 'Rodapé Institucional',
  },
];

export function slugifyStorefrontTerm(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normalizeBannerObject(b: any, fallbackId: string) {
  const imageUrl = b?.imageUrl ? String(b.imageUrl) : null;
  const mobileImageUrl = b?.mobileImageUrl ? String(b.mobileImageUrl) : null;
  const format = ['strip', 'side_by_side', 'campaign'].includes(String(b?.format))
    ? b.format
    : imageUrl
      ? 'side_by_side'
      : 'strip';
  const height = ['sm', 'md', 'lg'].includes(String(b?.height)) ? b.height : 'md';
  const targetType = [
    'none',
    'all',
    'featured',
    'category',
    'product',
    'collection',
  ].includes(String(b?.targetType || b?.linkType))
    ? String(b?.targetType || b?.linkType)
    : 'all';

  const focalX = Number.isFinite(Number(b?.focalX))
    ? Math.max(0, Math.min(100, Math.round(Number(b.focalX))))
    : 50;
  const focalY = Number.isFinite(Number(b?.focalY))
    ? Math.max(0, Math.min(100, Math.round(Number(b.focalY))))
    : 50;

  return {
    id: String(b?.id || fallbackId),
    title: String(b?.title ?? 'Destaque promocional'),
    subtitle: String(b?.subtitle ?? ''),
    imageUrl,
    mobileImageUrl,
    format,
    height,
    focalX,
    focalY,
    ctaLabel: b?.ctaLabel !== undefined ? String(b.ctaLabel) : 'Conferir',
    targetType,
    targetValue: String(b?.targetValue ?? b?.linkTarget ?? ''),
    enabled: b?.enabled !== false && b?.active !== false,
  };
}

export function syncThemeBanners(theme: any) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const syncedBanners = sections
    .filter((s: any) => s?.type === 'banner')
    .map((s: any, idx: number) => {
      const base = normalizeBannerObject(
        s.banner || s,
        s.bannerId || `bn-${idx + 1}`,
      );
      return {
        ...base,
        enabled: s.enabled !== false,
      };
    });

  const normalizedSections = sections.map((s: any, idx: number) => {
    if (s?.type !== 'banner') return s;
    const base = normalizeBannerObject(
      s.banner || s,
      s.bannerId || `bn-${idx + 1}`,
    );
    const synced = { ...base, enabled: s.enabled !== false };
    return {
      ...s,
      bannerId: synced.id,
      title: synced.title || 'Banner promocional',
      subtitle: synced.subtitle || '',
      banner: synced,
    };
  });

  return {
    ...theme,
    schemaVersion: 2,
    sections: normalizedSections,
    banners: syncedBanners,
  };
}

export function normalizeDraftTheme(raw: any) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const incomingSchemaVersion = Number(src.schemaVersion || 1);

  // 1. Coleções curadas & "Monte o look"
  const rawCollections = Array.isArray(src.collections) ? src.collections : [];
  const seenColIds = new Set<string>();
  const seenColSlugs = new Set<string>();
  const collections = rawCollections
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any, idx: number) => {
      const rawId = String(c.id || `col-${idx + 1}`);
      const id = seenColIds.has(rawId) ? `${rawId}-${idx + 1}` : rawId;
      seenColIds.add(id);

      const title = String(c.title || `Coleção ${idx + 1}`);
      const baseSlug =
        slugifyStorefrontTerm(c.slug || title) || `colecao-${idx + 1}`;
      let slug = baseSlug;
      let n = 2;
      while (seenColSlugs.has(slug)) {
        slug = `${baseSlug}-${n}`;
        n += 1;
      }
      seenColSlugs.add(slug);

      return {
        id,
        slug,
        kind: c.kind === 'look' ? 'look' : 'collection',
        enabled: c.enabled !== false,
        title,
        subtitle: String(c.subtitle || ''),
        description: String(c.description || ''),
        coverUrl: c.coverUrl ? String(c.coverUrl) : null,
        focalX: Number.isFinite(Number(c.focalX))
          ? Math.max(0, Math.min(100, Math.round(Number(c.focalX))))
          : 50,
        focalY: Number.isFinite(Number(c.focalY))
          ? Math.max(0, Math.min(100, Math.round(Number(c.focalY))))
          : 50,
        productIds: Array.isArray(c.productIds)
          ? Array.from(new Set(c.productIds.map((p: any) => String(p)).filter(Boolean)))
          : [],
      };
    });

  // 2. Banners existentes (para vínculo ou migração v1 -> v2)
  const rawBanners = Array.isArray(src.banners) ? src.banners : [];
  const legacyBannerMap = new Map<string, any>();
  const parsedRawBanners = rawBanners.map((b: any, idx: number) => {
    const clean = normalizeBannerObject(b, `banner-${idx + 1}`);
    legacyBannerMap.set(clean.id, clean);
    return clean;
  });

  // 3. Seções da página (preserva seções repetíveis por ID estável; deduplica apenas singletons)
  const rawSections =
    Array.isArray(src.sections) && src.sections.length > 0
      ? src.sections
      : DEFAULT_STOREFRONT_SECTIONS;

  const seenSingletonTypes = new Set<string>();
  const seenSectionIds = new Set<string>();
  const referencedBannerIds = new Set<string>();
  const mergedSections: any[] = [];

  for (let i = 0; i < rawSections.length; i += 1) {
    const s = rawSections[i];
    const fallbackDef = DEFAULT_STOREFRONT_SECTIONS.find(
      (d) => d.type === s?.type || d.id === s?.id,
    );
    const type = String(s?.type || fallbackDef?.type || '');
    if (!VALID_SECTION_TYPES.has(type)) continue;

    if (SINGLETON_SECTION_TYPES.has(type)) {
      if (seenSingletonTypes.has(type)) continue;
      seenSingletonTypes.add(type);
    }

    let secId = String(s?.id || fallbackDef?.id || `sec-${type}-${i + 1}`);
    if (seenSectionIds.has(secId)) {
      secId = `${secId}-${i + 1}`;
    }
    seenSectionIds.add(secId);

    const enabled = s?.enabled !== false;

    if (type === 'banner') {
      const lookupId = String(s?.bannerId || s?.banner?.id || '');
      const sourceBanner =
        (s?.banner && typeof s.banner === 'object' ? s.banner : null) ||
        (lookupId ? legacyBannerMap.get(lookupId) : null) ||
        s;
      const cleanBanner = normalizeBannerObject(
        { ...sourceBanner, enabled },
        lookupId || `bn-${secId}`,
      );
      referencedBannerIds.add(cleanBanner.id);
      mergedSections.push({
        id: secId,
        type: 'banner',
        enabled,
        title: cleanBanner.title || 'Banner promocional',
        subtitle: cleanBanner.subtitle || '',
        bannerId: cleanBanner.id,
        banner: cleanBanner,
      });
      continue;
    }

    if (type === 'featured' || type === 'product_selection') {
      const presentation = s?.presentation === 'carousel' ? 'carousel' : 'grid';
      const defaultSource = type === 'featured' ? 'featured' : 'manual';
      const sourceType = [
        'manual',
        'featured',
        'collection',
        'category',
      ].includes(String(s?.sourceType))
        ? String(s.sourceType)
        : defaultSource;
      const defaultVisible = type === 'featured' ? 12 : 8;
      const visibleCount = Number.isFinite(Number(s?.visibleCount))
        ? Math.max(1, Math.min(48, Math.round(Number(s.visibleCount))))
        : defaultVisible;
      const columnsDesktop = Number.isFinite(Number(s?.columnsDesktop))
        ? Math.max(2, Math.min(5, Math.round(Number(s.columnsDesktop))))
        : 4;

      mergedSections.push({
        id: secId,
        type,
        enabled,
        title:
          s?.title ||
          (type === 'featured' ? 'Destaques da Loja' : 'Seleção de Produtos'),
        subtitle: String(s?.subtitle || ''),
        presentation,
        sourceType,
        productIds: Array.isArray(s?.productIds)
          ? Array.from(
              new Set(s.productIds.map((id: any) => String(id)).filter(Boolean)),
            )
          : [],
        collectionId: s?.collectionId ? String(s.collectionId) : null,
        categoryId: s?.categoryId ? String(s.categoryId) : null,
        visibleCount,
        columnsDesktop,
        autoPlay: s?.autoPlay === true,
      });
      continue;
    }

    if (type === 'look') {
      mergedSections.push({
        id: secId,
        type: 'look',
        enabled,
        title: String(s?.title || 'Monte o look'),
        subtitle: String(s?.subtitle || ''),
        collectionId: s?.collectionId ? String(s.collectionId) : null,
        productIds: Array.isArray(s?.productIds)
          ? Array.from(
              new Set(s.productIds.map((id: any) => String(id)).filter(Boolean)),
            )
          : [],
      });
      continue;
    }

    mergedSections.push({
      id: secId,
      type,
      enabled,
      title: String(s?.title || fallbackDef?.title || type),
      subtitle: String(s?.subtitle || ''),
    });
  }

  // Garante as seções estruturais únicas (e `featured` caso seja v1 sem seleção)
  const hasAnySelection = mergedSections.some(
    (s) => s.type === 'featured' || s.type === 'product_selection',
  );
  for (const def of DEFAULT_STOREFRONT_SECTIONS) {
    if (def.type === 'featured') {
      if (!hasAnySelection && incomingSchemaVersion < 2) {
        mergedSections.push({ ...def });
      }
      continue;
    }
    if (!seenSingletonTypes.has(def.type)) {
      mergedSections.push({ ...def });
      seenSingletonTypes.add(def.type);
    }
  }

  // Migra banners legados de lojas existentes (`banners` sem seção `banner` explícita)
  const unmigrated = parsedRawBanners.filter(
    (b: any) => !referencedBannerIds.has(b.id),
  );
  if (
    unmigrated.length > 0 &&
    !mergedSections.some((s) => s.type === 'banner') &&
    incomingSchemaVersion < 2
  ) {
    const heroIdx = mergedSections.findIndex((s) => s.type === 'hero');
    const insertAt = heroIdx >= 0 ? heroIdx + 1 : 1;
    const migrated = unmigrated.map((b: any, idx: number) => {
      const candidateId = `sec-banner-${b.id}`;
      const secId = seenSectionIds.has(candidateId)
        ? `${candidateId}-${idx + 1}`
        : candidateId;
      seenSectionIds.add(secId);
      return {
        id: secId,
        type: 'banner',
        enabled: b.enabled !== false,
        title: b.title || 'Banner promocional',
        subtitle: b.subtitle || '',
        bannerId: b.id,
        banner: b,
      };
    });
    mergedSections.splice(insertAt, 0, ...migrated);
  }

  const baseTheme = {
    schemaVersion: 2,
    template: src.template || 'editorial_roxo',
    primaryColor: src.primaryColor || '#7C3AED',
    accentColor: src.accentColor || '#6D28D9',
    surfaceColor: src.surfaceColor || '#F8F7FC',
    textColor: src.textColor || '#272321',
    announcementText: src.announcementText ?? '',
    heroTitle: src.heroTitle ?? '',
    heroSubtitle: src.heroSubtitle ?? '',
    heroCtaLabel: src.heroCtaLabel || 'Ver coleção',
    heroHeight: ['sm', 'md', 'lg'].includes(String(src.heroHeight))
      ? src.heroHeight
      : 'md',
    heroFocalX: Number.isFinite(Number(src.heroFocalX))
      ? Math.max(0, Math.min(100, Math.round(Number(src.heroFocalX))))
      : 50,
    heroFocalY: Number.isFinite(Number(src.heroFocalY))
      ? Math.max(0, Math.min(100, Math.round(Number(src.heroFocalY))))
      : 50,
    heroMobileCoverUrl: src.heroMobileCoverUrl
      ? String(src.heroMobileCoverUrl)
      : null,
    collections,
    sections: mergedSections,
    banners: parsedRawBanners,
  };

  return syncThemeBanners(baseTheme);
}

export interface ThemeCuratorialWarning {
  sectionId?: string;
  collectionId?: string;
  message: string;
}

export function computeThemeWarnings(
  draftTheme: any,
  products: any[],
  categories: any[],
): ThemeCuratorialWarning[] {
  const warnings: ThemeCuratorialWarning[] = [];
  const prodMap = new Map<string, any>();
  for (const p of products) {
    if (!p) continue;
    if (p.id) prodMap.set(String(p.id), p);
    if (p.retailGroupId) prodMap.set(String(p.retailGroupId), p);
    if (p.publicSlug) prodMap.set(String(p.publicSlug), p);
  }
  const catMap = new Map<string, any>();
  for (const c of categories) {
    if (!c) continue;
    if (c.id) catMap.set(String(c.id), c);
    if (c.publicSlug) catMap.set(String(c.publicSlug), c);
  }
  const collections: any[] = Array.isArray(draftTheme?.collections)
    ? draftTheme.collections
    : [];
  const colMap = new Map<string, any>();
  for (const col of collections) {
    if (!col) continue;
    if (col.id) colMap.set(String(col.id), col);
    if (col.slug) colMap.set(String(col.slug), col);
  }

  for (const col of collections) {
    if (col.enabled === false) continue;
    const ids: string[] = Array.isArray(col.productIds) ? col.productIds : [];
    const unavailableNames: string[] = [];
    const hiddenNames: string[] = [];
    for (const pid of ids) {
      const prod = prodMap.get(String(pid));
      if (!prod) continue;
      const label = prod.displayTitle || prod.name;
      if (!prod.isVisible) hiddenNames.push(label);
      if (Number(prod.availableStock ?? 0) <= 0) unavailableNames.push(label);
    }
    if (col.kind === 'look' && unavailableNames.length > 0) {
      warnings.push({
        collectionId: col.id,
        message: `Monte o look "${col.title}": peça(s) sem estoque disponível (${unavailableNames.slice(0, 3).join(', ')}).`,
      });
    }
    if (hiddenNames.length > 0) {
      warnings.push({
        collectionId: col.id,
        message: `${col.kind === 'look' ? 'Look' : 'Coleção'} "${col.title}": contém peça(s) oculta(s) na vitrine (${hiddenNames.slice(0, 3).join(', ')}).`,
      });
    }
  }

  const sections: any[] = Array.isArray(draftTheme?.sections)
    ? draftTheme.sections
    : [];
  for (const sec of sections) {
    if (sec.enabled === false) continue;
    if (sec.type === 'banner') {
      const b = sec.banner || sec;
      if (b.targetType === 'product' && b.targetValue) {
        const targetProd = prodMap.get(String(b.targetValue));
        if (!targetProd) {
          warnings.push({
            sectionId: sec.id,
            message: `Banner "${b.title || 'Sem título'}": o produto de destino não foi encontrado.`,
          });
        } else if (!targetProd.isVisible) {
          warnings.push({
            sectionId: sec.id,
            message: `Banner "${b.title || 'Sem título'}": aponta para "${targetProd.displayTitle || targetProd.name}", que está oculto na vitrine.`,
          });
        } else if (Number(targetProd.availableStock ?? 0) <= 0) {
          warnings.push({
            sectionId: sec.id,
            message: `Banner "${b.title || 'Sem título'}": aponta para "${targetProd.displayTitle || targetProd.name}", que está sem estoque.`,
          });
        }
      } else if (b.targetType === 'category' && b.targetValue) {
        const targetCat = catMap.get(String(b.targetValue));
        if (!targetCat || targetCat.isVisible === false) {
          warnings.push({
            sectionId: sec.id,
            message: `Banner "${b.title || 'Sem título'}": a categoria de destino está oculta na vitrine.`,
          });
        }
      } else if (b.targetType === 'collection' && b.targetValue) {
        const targetCol = colMap.get(String(b.targetValue));
        if (!targetCol || targetCol.enabled === false) {
          warnings.push({
            sectionId: sec.id,
            message: `Banner "${b.title || 'Sem título'}": a coleção de destino está desativada ou foi removida.`,
          });
        }
      }
    }

    if (
      (sec.type === 'product_selection' || sec.type === 'featured') &&
      sec.sourceType === 'manual'
    ) {
      const ids: string[] = Array.isArray(sec.productIds) ? sec.productIds : [];
      if (ids.length === 0) {
        warnings.push({
          sectionId: sec.id,
          message: `Seleção "${sec.title}": nenhum produto foi escolhido ainda.`,
        });
      } else {
        const hiddenCount = ids.filter((id) => {
          const p = prodMap.get(String(id));
          return p && !p.isVisible;
        }).length;
        const outStockCount = ids.filter((id) => {
          const p = prodMap.get(String(id));
          return p && Number(p.availableStock ?? 0) <= 0;
        }).length;
        if (hiddenCount > 0) {
          warnings.push({
            sectionId: sec.id,
            message: `Seleção "${sec.title}": ${hiddenCount} item(ns) selecionado(s) está(ão) oculto(s) na vitrine pública.`,
          });
        }
        if (outStockCount > 0) {
          warnings.push({
            sectionId: sec.id,
            message: `Seleção "${sec.title}": ${outStockCount} item(ns) está(ão) sem saldo disponível.`,
          });
        }
      }
    }

    if (sec.type === 'look') {
      const lookCol = sec.collectionId
        ? colMap.get(String(sec.collectionId))
        : collections.find((c) => c.kind === 'look');
      if (!lookCol) {
        warnings.push({
          sectionId: sec.id,
          message: `Seção "${sec.title || 'Monte o look'}": nenhum conjunto foi vinculado.`,
        });
      } else {
        const ids: string[] = Array.isArray(lookCol.productIds)
          ? lookCol.productIds
          : [];
        const lostStock = ids.filter((id) => {
          const p = prodMap.get(String(id));
          return !p || Number(p.availableStock ?? 0) <= 0;
        });
        const lostVisibility = ids.filter((id) => {
          const p = prodMap.get(String(id));
          return p && !p.isVisible;
        });
        if (lostStock.length > 0) {
          warnings.push({
            sectionId: sec.id,
            collectionId: lookCol.id,
            message: `Monte o look "${lookCol.title}": ${lostStock.length} peça(s) perdeu(ram) disponibilidade de estoque.`,
          });
        }
        if (lostVisibility.length > 0) {
          warnings.push({
            sectionId: sec.id,
            collectionId: lookCol.id,
            message: `Monte o look "${lookCol.title}": ${lostVisibility.length} peça(s) está(ão) oculta(s) no catálogo.`,
          });
        }
      }
    }
  }

  return warnings;
}

export function computePrePublishChanges(
  draftTheme: any,
  publishedThemeRaw: any,
  settingsForm: any,
  savedConfig: any,
): string[] {
  const changes: string[] = [];
  const cfg = savedConfig || {};

  if (cfg.storeName !== undefined && settingsForm.storeName !== (cfg.storeName || '')) {
    changes.push(`Nome da loja: "${settingsForm.storeName}"`);
  }
  if (cfg.slug !== undefined && settingsForm.slug !== (cfg.slug || '')) {
    changes.push(`Endereço público (URL): /loja/${settingsForm.slug}`);
  }
  if ((settingsForm.logoUrl || '') !== (cfg.logoUrl || '')) {
    changes.push(
      settingsForm.logoUrl ? 'Logotipo da loja atualizado' : 'Logotipo removido',
    );
  }
  if ((settingsForm.coverUrl || '') !== (cfg.coverUrl || '')) {
    changes.push(
      settingsForm.coverUrl
        ? 'Foto de capa principal atualizada'
        : 'Foto de capa principal removida',
    );
  }
  if (
    Boolean(settingsForm.pickupEnabled) !== Boolean(cfg.pickupEnabled !== false) ||
    Boolean(settingsForm.deliveryEnabled) !== Boolean(cfg.deliveryEnabled)
  ) {
    changes.push('Modalidades de recebimento (retirada/entrega) ajustadas');
  }

  if (!publishedThemeRaw) {
    changes.push('Primeira publicação da vitrine com o modelo e as seções atuais');
    return changes;
  }

  const pub = normalizeDraftTheme(publishedThemeRaw);
  const cur = normalizeDraftTheme(draftTheme);

  if (cur.template !== pub.template) {
    const tplName =
      TEMPLATE_OPTIONS.find((t) => t.id === cur.template)?.name || cur.template;
    changes.push(`Modelo visual alterado para "${tplName}"`);
  }
  if (cur.primaryColor !== pub.primaryColor || cur.accentColor !== pub.accentColor) {
    changes.push('Paleta de destaque da marca atualizada');
  }
  if (
    cur.heroTitle !== pub.heroTitle ||
    cur.heroSubtitle !== pub.heroSubtitle ||
    cur.heroCtaLabel !== pub.heroCtaLabel ||
    cur.heroHeight !== pub.heroHeight ||
    cur.heroFocalX !== pub.heroFocalX ||
    cur.heroFocalY !== pub.heroFocalY ||
    (cur.heroMobileCoverUrl || '') !== (pub.heroMobileCoverUrl || '')
  ) {
    changes.push('Capa principal (textos, altura, ponto focal ou imagem mobile) alterada');
  }
  if ((cur.announcementText || '') !== (pub.announcementText || '')) {
    changes.push('Faixa superior de aviso atualizada');
  }

  const curOrder = cur.sections
    .filter((s: any) => s.enabled !== false)
    .map((s: any) => `${s.id}:${s.type}`)
    .join('|');
  const pubOrder = pub.sections
    .filter((s: any) => s.enabled !== false)
    .map((s: any) => `${s.id}:${s.type}`)
    .join('|');
  if (curOrder !== pubOrder) {
    changes.push('Estrutura, ordem ou visibilidade das seções da página atualizada');
  }

  if (JSON.stringify(cur.banners) !== JSON.stringify(pub.banners)) {
    const activeBanners = cur.banners.filter((b: any) => b.enabled !== false).length;
    changes.push(`Banners independentes atualizados (${activeBanners} ativo(s))`);
  }

  const curSelections = cur.sections.filter(
    (s: any) => s.type === 'product_selection' || s.type === 'featured',
  );
  const pubSelections = pub.sections.filter(
    (s: any) => s.type === 'product_selection' || s.type === 'featured',
  );
  if (JSON.stringify(curSelections) !== JSON.stringify(pubSelections)) {
    changes.push(
      `Destaques, seleções de produtos ou carrosséis atualizados (${curSelections.filter((s: any) => s.enabled !== false).length} seção(ões) ativa(s))`,
    );
  }

  if (JSON.stringify(cur.collections) !== JSON.stringify(pub.collections)) {
    const looksCount = cur.collections.filter((c: any) => c.kind === 'look').length;
    const colsCount = cur.collections.filter((c: any) => c.kind !== 'look').length;
    changes.push(
      `Curadoria atualizada (${colsCount} coleção(ões) e ${looksCount} "Monte o look")`,
    );
  }

  return changes;
}

function getSectionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    header: 'Cabeçalho',
    hero: 'Capa principal',
    banner: 'Banner independente',
    categories: 'Categorias',
    featured: 'Destaques',
    product_selection: 'Seleção / Carrossel',
    look: 'Monte o look',
    collection: 'Catálogo completo',
    fulfillment_info: 'Retirada e entrega',
    footer: 'Rodapé',
  };
  return labels[type] || type;
}

function FocalPointPad({
  imageUrl,
  mobileImageUrl,
  focalX = 50,
  focalY = 50,
  onChange,
}: {
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  focalX?: number;
  focalY?: number;
  onChange: (nextX: number, nextY: number) => void;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const x = Number.isFinite(Number(focalX)) ? Math.round(Number(focalX)) : 50;
  const y = Number.isFinite(Number(focalY)) ? Math.round(Number(focalY)) : 50;

  const handlePadClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nextX = Math.max(
      0,
      Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)),
    );
    const nextY = Math.max(
      0,
      Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)),
    );
    onChange(nextX, nextY);
  };

  return (
    <div className="p-3 rounded-xl border border-line bg-page space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">
          Ponto focal do recorte ({x}% × {y}%)
        </span>
        <button
          type="button"
          disabled={x === 50 && y === 50}
          onClick={() => onChange(50, 50)}
          className="text-[11px] font-semibold text-brand hover:underline disabled:opacity-40"
        >
          Centralizar
        </button>
      </div>

      {imageUrl ? (
        <div
          ref={padRef}
          onClick={handlePadClick}
          title="Clique sobre a imagem para definir o ponto focal"
          className="relative w-full h-28 rounded-xl overflow-hidden border border-line bg-surface cursor-crosshair select-none"
        >
          <StorefrontCampaignVisual
            imageUrl={imageUrl}
            mobileImageUrl={mobileImageUrl}
            alt="Ajuste de ponto focal"
            focalX={x}
            focalY={y}
          />
          <span
            style={{ left: `${x}%`, top: `${y}%` }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-on-brand bg-brand/85 flex items-center justify-center"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-on-brand" />
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          Envie uma imagem para clicar e posicionar o ponto focal do enquadramento.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block space-y-1">
          <span className="text-[11px] text-muted block">Horizontal ({x}%)</span>
          <input
            type="range"
            min={0}
            max={100}
            value={x}
            onChange={(e) => onChange(Number(e.target.value), y)}
            className="w-full accent-brand"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-muted block">Vertical ({y}%)</span>
          <input
            type="range"
            min={0}
            max={100}
            value={y}
            onChange={(e) => onChange(x, Number(e.target.value))}
            className="w-full accent-brand"
          />
        </label>
      </div>
    </div>
  );
}

export function ManualProductCurator({
  selectedIds,
  onChangeIds,
  products,
  maxItems = 48,
  contextLabel = 'seleção',
}: {
  selectedIds: string[];
  onChangeIds: (nextIds: string[]) => void;
  products: any[];
  maxItems?: number;
  contextLabel?: string;
}) {
  const [query, setQuery] = useState('');

  const productById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of products) {
      if (!p) continue;
      if (p.id) map.set(String(p.id), p);
      if (p.retailGroupId) map.set(String(p.retailGroupId), p);
      if (p.publicSlug) map.set(String(p.publicSlug), p);
    }
    return map;
  }, [products]);

  const selectedRecords = useMemo(
    () =>
      selectedIds.map((id) => ({
        rawId: id,
        product: productById.get(String(id)) || null,
      })),
    [selectedIds, productById],
  );

  const selectedCanonicalSet = useMemo(() => {
    const s = new Set<string>();
    for (const rec of selectedRecords) {
      s.add(String(rec.rawId));
      if (rec.product?.id) s.add(String(rec.product.id));
      if (rec.product?.retailGroupId) s.add(String(rec.product.retailGroupId));
    }
    return s;
  }, [selectedRecords]);

  const availablePool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !selectedCanonicalSet.has(String(p.id)))
      .filter((p) => {
        if (!q) return true;
        const hay = `${p.displayTitle || ''} ${p.name || ''} ${p.categoryName || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const aOk = Number(Boolean(a.isVisible)) * 2 + Number(Number(a.availableStock || 0) > 0);
        const bOk = Number(Boolean(b.isVisible)) * 2 + Number(Number(b.availableStock || 0) > 0);
        return bOk - aOk;
      });
  }, [products, selectedCanonicalSet, query]);

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed);
    onChangeIds(next);
  };

  const removeItem = (idx: number) => {
    onChangeIds(selectedIds.filter((_, i) => i !== idx));
  };

  const addItem = (id: string) => {
    if (selectedIds.length >= maxItems) {
      toast.info(`Limite máximo de ${maxItems} itens atingido.`);
      return;
    }
    onChangeIds([...selectedIds, id]);
  };

  const fillFirstEightVisible = () => {
    const candidates = products
      .filter((p) => p.isVisible && Number(p.availableStock ?? 0) > 0)
      .map((p) => String(p.id));
    const merged = Array.from(new Set([...selectedIds, ...candidates])).slice(
      0,
      Math.min(8, maxItems),
    );
    onChangeIds(merged);
  };

  return (
    <div className="space-y-3">
      {/* Lista ordenada atual */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink">
            Ordem manual na {contextLabel} ({selectedIds.length})
          </span>
          {selectedIds.length < 8 && products.length > 0 && (
            <button
              type="button"
              onClick={fillFirstEightVisible}
              className="text-[11px] font-semibold text-brand hover:underline"
            >
              + Preencher até 8 disponíveis
            </button>
          )}
        </div>

        {selectedRecords.length === 0 ? (
          <div className="p-3.5 rounded-xl border border-dashed border-line bg-page text-center text-xs text-muted">
            Nenhuma peça selecionada ainda. Escolha abaixo para montar a ordem manual.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
            {selectedRecords.map(({ rawId, product }, idx) => {
              const outOfStock = !product || Number(product.availableStock ?? 0) <= 0;
              const isHidden = product ? !product.isVisible : true;
              const missingPhoto = product ? !product.imageUrl : true;

              return (
                <div
                  key={`${rawId}-${idx}`}
                  className="p-2 rounded-xl border border-line bg-page flex items-center justify-between gap-2 min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveItem(idx, -1)}
                        className="p-0.5 rounded border border-line bg-surface text-muted hover:text-ink disabled:opacity-30"
                        title="Subir posição"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === selectedRecords.length - 1}
                        onClick={() => moveItem(idx, 1)}
                        className="p-0.5 rounded border border-line bg-surface text-muted hover:text-ink disabled:opacity-30"
                        title="Descer posição"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>

                    <StorefrontProductFrame
                      imageUrl={product?.imageUrl}
                      alt={product?.displayTitle || product?.name || rawId}
                      categoryName={product?.categoryName}
                      productName={product?.name || rawId}
                      padding="xs"
                      aspectClassName="w-10 h-12 shrink-0"
                      roundedClassName="rounded-lg border border-line"
                    />

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">
                        <span className="text-muted font-mono mr-1">
                          #{idx + 1}
                        </span>
                        {product
                          ? product.displayTitle || product.name
                          : `Item removido (${rawId})`}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {product && (
                          <span className="text-[10px] text-muted tabular-nums">
                            {Number(product.availableStock ?? 0)} disp.
                          </span>
                        )}
                        {outOfStock && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-support text-brand text-[10px] font-semibold">
                            <AlertCircle size={10} /> Sem estoque
                          </span>
                        )}
                        {isHidden && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface border border-line text-muted text-[10px] font-semibold">
                            <EyeOff size={10} /> Oculto
                          </span>
                        )}
                        {missingPhoto && product && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface border border-line text-muted text-[10px] font-semibold">
                            <ImageIcon size={10} /> Sem foto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1.5 rounded-lg text-muted hover:text-ink shrink-0"
                    title="Remover desta seleção"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catálogo para adicionar */}
      <div className="pt-2 border-t border-line space-y-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar mercadoria para adicionar..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-line bg-surface text-xs"
          />
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
          {availablePool.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted">
              {query
                ? 'Nenhuma mercadoria encontrada para esta busca.'
                : 'Todas as mercadorias disponíveis já foram adicionadas.'}
            </p>
          ) : (
            availablePool.slice(0, 30).map((prod) => {
              const outOfStock = Number(prod.availableStock ?? 0) <= 0;
              const isHidden = !prod.isVisible;
              const noPhoto = !prod.imageUrl;

              return (
                <div
                  key={prod.id}
                  className="p-1.5 rounded-xl border border-line bg-surface flex items-center justify-between gap-2 min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StorefrontProductFrame
                      imageUrl={prod.imageUrl}
                      alt={prod.displayTitle || prod.name}
                      categoryName={prod.categoryName}
                      productName={prod.name}
                      padding="xs"
                      aspectClassName="w-9 h-11 shrink-0"
                      roundedClassName="rounded-lg border border-line"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink truncate">
                        {prod.displayTitle || prod.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted">
                        <span>{Number(prod.availableStock ?? 0)} disp.</span>
                        {outOfStock && (
                          <span className="text-brand font-semibold">
                            • Sem estoque
                          </span>
                        )}
                        {isHidden && <span>• Oculto</span>}
                        {noPhoto && <span>• Sem foto</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addItem(String(prod.id))}
                    className="px-2.5 py-1 rounded-lg bg-support text-brand hover:bg-brand hover:text-on-brand text-[11px] font-semibold shrink-0 transition"
                  >
                    + Incluir
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function StorefrontCollectionsManager({
  draftTheme,
  setDraftTheme,
  products,
  storeSlug,
  savingDraft,
  publishing,
  onSaveDraft,
  onOpenPublishModal,
  onExposeCollectionInHome,
}: {
  draftTheme: any;
  setDraftTheme: React.Dispatch<React.SetStateAction<any>>;
  products: any[];
  storeSlug: string;
  savingDraft: boolean;
  publishing: boolean;
  onSaveDraft: () => void;
  onOpenPublishModal: () => void;
  onExposeCollectionInHome: (col: any) => void;
}) {
  const collections: any[] = Array.isArray(draftTheme?.collections)
    ? draftTheme.collections
    : [];
  const [selectedColId, setSelectedColId] = useState<string | null>(
    collections[0]?.id || null,
  );

  useEffect(() => {
    if (
      selectedColId &&
      collections.some((c: any) => c.id === selectedColId)
    ) {
      return;
    }
    setSelectedColId(collections[0]?.id || null);
  }, [collections, selectedColId]);

  const selectedCol =
    collections.find((c: any) => c.id === selectedColId) || null;

  const prodMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of products) {
      if (!p) continue;
      m.set(String(p.id), p);
      if (p.retailGroupId) m.set(String(p.retailGroupId), p);
    }
    return m;
  }, [products]);

  const createCollection = (kind: 'collection' | 'look') => {
    const stamp = Date.now().toString(36);
    const id = `${kind === 'look' ? 'look' : 'col'}-${stamp}`;
    const defaultTitle =
      kind === 'look' ? 'Monte o look completo' : 'Nova coleção curada';
    const baseSlug = slugifyStorefrontTerm(defaultTitle) || id;
    const existingSlugs = new Set(collections.map((c: any) => c.slug));
    let slug = baseSlug;
    let n = 2;
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${n}`;
      n += 1;
    }

    const initialProductIds =
      kind === 'look'
        ? products
            .filter((p) => p.isVisible && Number(p.availableStock ?? 0) > 0)
            .slice(0, 3)
            .map((p) => String(p.id))
        : [];

    const nextCol = {
      id,
      slug,
      kind,
      enabled: true,
      title: defaultTitle,
      subtitle:
        kind === 'look'
          ? 'Escolha tamanho, cor e quantidade de cada peça ou leve o conjunto.'
          : 'Seleção especial da loja com curadoria própria.',
      description: '',
      coverUrl: null,
      focalX: 50,
      focalY: 50,
      productIds: initialProductIds,
    };

    setDraftTheme((prev: any) => ({
      ...prev,
      collections: [...(prev.collections || []), nextCol],
    }));
    setSelectedColId(id);
  };

  const updateSelectedCol = (patch: Record<string, any>) => {
    if (!selectedCol) return;
    setDraftTheme((prev: any) => ({
      ...prev,
      collections: (prev.collections || []).map((c: any) =>
        c.id === selectedCol.id ? { ...c, ...patch } : c,
      ),
    }));
  };

  const removeCollection = (colId: string) => {
    setDraftTheme((prev: any) => ({
      ...prev,
      collections: (prev.collections || []).filter((c: any) => c.id !== colId),
    }));
  };

  const selectedLookIssues = useMemo(() => {
    if (!selectedCol) return [];
    const ids: string[] = Array.isArray(selectedCol.productIds)
      ? selectedCol.productIds
      : [];
    const out: string[] = [];
    for (const id of ids) {
      const p = prodMap.get(String(id));
      if (!p) {
        out.push(`Peça ${id} não encontrada no estoque.`);
      } else {
        if (Number(p.availableStock ?? 0) <= 0) {
          out.push(
            `"${p.displayTitle || p.name}" perdeu disponibilidade de estoque (0 un. livres).`,
          );
        }
        if (!p.isVisible) {
          out.push(
            `"${p.displayTitle || p.name}" está marcada como oculta na vitrine.`,
          );
        }
      }
    }
    return out;
  }, [selectedCol, prodMap]);

  return (
    <div className="space-y-4">
      <div className="retail-panel flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="retail-kicker">Curadoria Independente do Estoque</span>
          <h2 className="text-base font-semibold text-ink">
            Coleções e Conjuntos “Monte o look”
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Um mesmo produto pode participar de várias coleções e looks, cada um
            com link próprio e ordem manual. Salve o rascunho e publique para
            atualizar a vitrine no ar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => createCollection('collection')}
            className="retail-button retail-button-secondary"
          >
            <Plus size={15} />
            <span>Nova coleção</span>
          </button>
          <button
            type="button"
            onClick={() => createCollection('look')}
            className="retail-button retail-button-secondary"
          >
            <Sparkles size={15} className="text-brand" />
            <span>Novo “Monte o look”</span>
          </button>
          <button
            type="button"
            disabled={savingDraft || publishing}
            onClick={onSaveDraft}
            className="retail-button retail-button-secondary"
          >
            {savingDraft ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            <span>Salvar rascunho</span>
          </button>
          <button
            type="button"
            disabled={publishing || savingDraft}
            onClick={onOpenPublishModal}
            className="retail-button retail-button-primary"
          >
            {publishing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
            <span>Publicar</span>
          </button>
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="retail-panel py-12 text-center space-y-3">
          <Layers size={28} className="mx-auto text-brand" />
          <p className="text-sm font-semibold text-ink">
            Nenhuma coleção ou “Monte o look” cadastrado ainda
          </p>
          <p className="text-xs text-muted max-w-md mx-auto">
            Crie coleções sazonais independentes das categorias do PDV ou monte
            conjuntos completos permitindo que o cliente escolha tamanho e cor de
            cada peça.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => createCollection('collection')}
              className="retail-button retail-button-secondary"
            >
              <Plus size={15} /> Criar primeira coleção
            </button>
            <button
              type="button"
              onClick={() => createCollection('look')}
              className="retail-button retail-button-primary"
            >
              <Sparkles size={15} /> Criar primeiro “Monte o look”
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-4 retail-panel space-y-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Coleções & Looks ({collections.length})
            </span>
            <div className="space-y-2">
              {collections.map((col) => {
                const active = col.id === selectedCol?.id;
                const ids: string[] = Array.isArray(col.productIds)
                  ? col.productIds
                  : [];
                const hasUnavailable = ids.some((id) => {
                  const p = prodMap.get(String(id));
                  return !p || Number(p.availableStock ?? 0) <= 0 || !p.isVisible;
                });

                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedColId(col.id)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                      active
                        ? 'border-brand bg-support/55'
                        : 'border-line bg-page hover:border-brand'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface border border-line text-brand">
                          {col.kind === 'look' ? 'Monte o look' : 'Coleção'}
                        </span>
                        {col.enabled === false && (
                          <span className="text-[10px] text-muted font-semibold">
                            (Pausada)
                          </span>
                        )}
                        {hasUnavailable && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-brand"
                            title="Há peça sem estoque ou oculta"
                          >
                            <AlertCircle size={11} /> Atenção
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-sm text-ink truncate mt-1">
                        {col.title}
                      </p>
                      <p className="text-[11px] text-muted font-mono truncate">
                        /loja/{storeSlug}/colecao/{col.slug} • {ids.length}{' '}
                        peça(s)
                      </p>
                    </div>
                    <ChevronRight size={15} className="text-muted shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {selectedCol && (
            <div className="xl:col-span-8 retail-panel space-y-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="min-w-0">
                  <span className="retail-kicker">
                    {selectedCol.kind === 'look'
                      ? 'Conjunto “Monte o look”'
                      : 'Coleção Curada'}
                  </span>
                  <h3 className="text-base font-semibold text-ink truncate">
                    {selectedCol.title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <RetailSwitch
                    size="sm"
                    checked={selectedCol.enabled !== false}
                    onCheckedChange={(checked) =>
                      updateSelectedCol({ enabled: checked })
                    }
                    label={selectedCol.enabled !== false ? 'Ativa' : 'Pausada'}
                  />
                  <button
                    type="button"
                    onClick={() => onExposeCollectionInHome(selectedCol)}
                    className="retail-button retail-button-secondary"
                  >
                    <LayoutGrid size={14} />
                    <span>Exibir na página inicial</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCollection(selectedCol.id)}
                    className="retail-button retail-button-ghost"
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>

              {selectedLookIssues.length > 0 && (
                <div className="p-3.5 rounded-xl border border-brand bg-support/55 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                    <AlertCircle size={14} />
                    <span>
                      Atenção na disponibilidade das peças deste{' '}
                      {selectedCol.kind === 'look' ? 'look' : 'conjunto'}
                    </span>
                  </div>
                  <ul className="text-xs text-ink space-y-0.5 pl-5 list-disc">
                    {selectedLookIssues.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="retail-field">
                  <span>Título público *</span>
                  <input
                    type="text"
                    value={selectedCol.title}
                    onChange={(e) =>
                      updateSelectedCol({ title: e.target.value })
                    }
                    placeholder="Ex: Essenciais de Inverno"
                  />
                </label>

                <label className="retail-field">
                  <span>Slug (link próprio da coleção)</span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={selectedCol.slug}
                      onChange={(e) =>
                        updateSelectedCol({
                          slug: slugifyStorefrontTerm(e.target.value),
                        })
                      }
                      className="font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/loja/${storeSlug}/colecao/${selectedCol.slug}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Link da coleção copiado!');
                      }}
                      className="retail-button retail-button-secondary shrink-0"
                      title="Copiar link público da coleção"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <small className="text-[11px] text-muted font-mono break-all">
                    {window.location.origin}/loja/{storeSlug}/colecao/
                    {selectedCol.slug}
                  </small>
                </label>

                <label className="retail-field sm:col-span-2">
                  <span>Subtítulo / chamada curta</span>
                  <input
                    type="text"
                    value={selectedCol.subtitle || ''}
                    onChange={(e) =>
                      updateSelectedCol({ subtitle: e.target.value })
                    }
                  />
                </label>
              </div>

              <ManualProductCurator
                selectedIds={selectedCol.productIds || []}
                onChangeIds={(nextIds) =>
                  updateSelectedCol({ productIds: nextIds })
                }
                products={products}
                maxItems={selectedCol.kind === 'look' ? 24 : 60}
                contextLabel={
                  selectedCol.kind === 'look' ? 'composição do look' : 'coleção'
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface StorefrontVisualStudioProps {
  draftTheme: any;
  setDraftTheme: React.Dispatch<React.SetStateAction<any>>;
  settingsForm: any;
  setSettingsForm: React.Dispatch<React.SetStateAction<any>>;
  products: any[];
  categories: any[];
  livePreviewStoreData: any;
  previewDevice: 'desktop' | 'mobile';
  setPreviewDevice: (dev: 'desktop' | 'mobile') => void;
  selectedSectionId: string | null;
  setSelectedSectionId: (id: string | null) => void;
  onUploadFile: (file: File) => Promise<string | null>;
  onNavigateTab: (
    tab: 'categories' | 'settings' | 'products',
    openCollections?: boolean,
  ) => void;
}

export function StorefrontVisualStudio({
  draftTheme,
  setDraftTheme,
  settingsForm,
  setSettingsForm,
  products,
  categories,
  livePreviewStoreData,
  previewDevice,
  setPreviewDevice,
  selectedSectionId,
  setSelectedSectionId,
  onUploadFile,
  onNavigateTab,
}: StorefrontVisualStudioProps) {
  const studioRootRef = useRef<HTMLDivElement | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mobileMode, setMobileMode] = useState<'edit' | 'preview'>('edit');
  const [isXlViewport, setIsXlViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true,
  );
  const [simCartCount, setSimCartCount] = useState(0);
  const [simResetSignal, setSimResetSignal] = useState(0);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const editScrollPosRef = useRef<{ winY: number; contentTop: number }>({
    winY: 0,
    contentTop: 0,
  });
  const previewOuterScrollPosRef = useRef<{ winY: number; contentTop: number }>({
    winY: 0,
    contentTop: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsXlViewport(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const sections: any[] = Array.isArray(draftTheme?.sections)
    ? draftTheme.sections
    : [];
  const collections: any[] = Array.isArray(draftTheme?.collections)
    ? draftTheme.collections
    : [];

  useEffect(() => {
    if (
      selectedSectionId &&
      sections.some((s: any) => s.id === selectedSectionId)
    ) {
      return;
    }
    setSelectedSectionId(sections[0]?.id || 'sec-hero');
  }, [sections, selectedSectionId, setSelectedSectionId]);

  const selectedSectionIndex = sections.findIndex(
    (s: any) => s.id === selectedSectionId,
  );
  const selectedSection =
    selectedSectionIndex >= 0 ? sections[selectedSectionIndex] : sections[0];

  const warnings = useMemo(
    () => computeThemeWarnings(draftTheme, products, categories),
    [draftTheme, products, categories],
  );

  const warningsBySection = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const w of warnings) {
      if (!w.sectionId) continue;
      const arr = map.get(w.sectionId) || [];
      arr.push(w.message);
      map.set(w.sectionId, arr);
    }
    return map;
  }, [warnings]);

  const switchMobileMode = useCallback((target: 'edit' | 'preview') => {
    setMobileMode((curr) => {
      if (curr === target) return curr;
      const contentEl = studioRootRef.current?.closest(
        '.retail-content',
      ) as HTMLElement | null;
      const snapshot = {
        winY: typeof window !== 'undefined' ? window.scrollY : 0,
        contentTop: contentEl ? contentEl.scrollTop : 0,
      };
      if (curr === 'edit') {
        editScrollPosRef.current = snapshot;
      } else {
        previewOuterScrollPosRef.current = snapshot;
      }

      const restore =
        target === 'edit'
          ? editScrollPosRef.current
          : previewOuterScrollPosRef.current;

      requestAnimationFrame(() => {
        if (contentEl) {
          contentEl.scrollTop = restore.contentTop;
        }
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: restore.winY, behavior: 'auto' });
        }
      });

      return target;
    });
  }, []);

  const updateSectionAt = (idx: number, patch: Record<string, any>) => {
    setDraftTheme((prev: any) => {
      const list = [...(prev.sections || [])];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], ...patch };
      return syncThemeBanners({ ...prev, sections: list });
    });
  };

  const updateBannerInSection = (idx: number, bannerPatch: Record<string, any>) => {
    setDraftTheme((prev: any) => {
      const list = [...(prev.sections || [])];
      const target = list[idx];
      if (!target || target.type !== 'banner') return prev;
      const nextBanner = {
        ...(target.banner || {}),
        ...bannerPatch,
      };
      list[idx] = {
        ...target,
        title: nextBanner.title || 'Banner promocional',
        subtitle: nextBanner.subtitle || '',
        bannerId: nextBanner.id || target.bannerId,
        banner: nextBanner,
      };
      return syncThemeBanners({ ...prev, sections: list });
    });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    setDraftTheme((prev: any) => {
      const list = [...(prev.sections || [])];
      const [moved] = list.splice(idx, 1);
      list.splice(target, 0, moved);
      return syncThemeBanners({ ...prev, sections: list });
    });
  };

  const removeRepeatableSection = (idx: number) => {
    const sec = sections[idx];
    if (!sec || SINGLETON_SECTION_TYPES.has(sec.type) || sec.type === 'featured') {
      return;
    }
    const nextFallback =
      sections[idx - 1]?.id || sections[idx + 1]?.id || sections[0]?.id || null;
    setDraftTheme((prev: any) => {
      const list = (prev.sections || []).filter((_: any, i: number) => i !== idx);
      return syncThemeBanners({ ...prev, sections: list });
    });
    setSelectedSectionId(nextFallback);
  };

  const addBannerSection = () => {
    const stamp = Date.now().toString(36);
    const bnId = `bn-${stamp}`;
    const secId = `sec-banner-${stamp}`;
    const newBanner = {
      id: bnId,
      title: 'Campanha da Semana',
      subtitle: 'Peças selecionadas com retirada rápida ou entrega combinada',
      ctaLabel: 'Explorar seleção',
      imageUrl: null,
      mobileImageUrl: null,
      format: 'side_by_side',
      height: 'md',
      focalX: 50,
      focalY: 50,
      targetType: 'all',
      targetValue: '',
      enabled: true,
    };
    const newSec = {
      id: secId,
      type: 'banner',
      enabled: true,
      title: newBanner.title,
      subtitle: newBanner.subtitle,
      bannerId: bnId,
      banner: newBanner,
    };

    setDraftTheme((prev: any) => {
      const list = [...(prev.sections || [])];
      const heroIdx = list.findIndex((s: any) => s.type === 'hero');
      const insertAt =
        selectedSectionIndex >= 0
          ? selectedSectionIndex + 1
          : heroIdx >= 0
            ? heroIdx + 1
            : 1;
      list.splice(insertAt, 0, newSec);
      return syncThemeBanners({ ...prev, sections: list });
    });
    setSelectedSectionId(secId);
    if (rightCollapsed) setRightCollapsed(false);
  };

  const addProductSelectionSection = () => {
    const stamp = Date.now().toString(36);
    const secId = `sec-sel-${stamp}`;
    const initialEight = products
      .filter((p) => p.isVisible && Number(p.availableStock ?? 0) > 0)
      .slice(0, 8)
      .map((p) => String(p.id));

    const newSec = {
      id: secId,
      type: 'product_selection',
      enabled: true,
      title: 'Seleção Curada',
      subtitle: '',
      presentation: 'carousel',
      sourceType: 'manual',
      productIds: initialEight,
      collectionId: null,
      categoryId: null,
      visibleCount: 12,
      columnsDesktop: 4,
      autoPlay: false,
    };

    setDraftTheme((prev: any) => {
      const list = [...(prev.sections || [])];
      const colIdx = list.findIndex((s: any) => s.type === 'collection');
      const insertAt =
        selectedSectionIndex >= 0
          ? selectedSectionIndex + 1
          : colIdx >= 0
            ? colIdx
            : list.length;
      list.splice(insertAt, 0, newSec);
      return syncThemeBanners({ ...prev, sections: list });
    });
    setSelectedSectionId(secId);
    if (rightCollapsed) setRightCollapsed(false);
  };

  const addLookSection = () => {
    const stamp = Date.now().toString(36);
    const existingLook = collections.find((c: any) => c.kind === 'look');
    const lookId = existingLook ? existingLook.id : `look-${stamp}`;
    const secId = `sec-look-${stamp}`;

    const initialPieces = products
      .filter((p) => p.isVisible && Number(p.availableStock ?? 0) > 0)
      .slice(0, 3)
      .map((p) => String(p.id));

    setDraftTheme((prev: any) => {
      const nextCols = existingLook
        ? prev.collections || []
        : [
            ...(prev.collections || []),
            {
              id: lookId,
              slug: `monte-o-look-${stamp}`,
              kind: 'look',
              enabled: true,
              title: 'Monte o look da vitrine',
              subtitle:
                'Escolha cor, tamanho e quantidade de cada peça disponível.',
              description: '',
              coverUrl: null,
              focalX: 50,
              focalY: 50,
              productIds: initialPieces,
            },
          ];

      const list = [...(prev.sections || [])];
      const colIdx = list.findIndex((s: any) => s.type === 'collection');
      const insertAt = colIdx >= 0 ? colIdx : list.length;
      list.splice(insertAt, 0, {
        id: secId,
        type: 'look',
        enabled: true,
        title: 'Monte o look',
        subtitle: 'Leve o conjunto ou apenas as peças selecionadas',
        collectionId: lookId,
        productIds: [],
      });

      return syncThemeBanners({
        ...prev,
        collections: nextCols,
        sections: list,
      });
    });
    setSelectedSectionId(secId);
    if (rightCollapsed) setRightCollapsed(false);
  };

  const handleFieldUpload = async (
    fieldKey: string,
    file: File,
    applyUrl: (url: string) => void,
  ) => {
    setUploadingField(fieldKey);
    try {
      const url = await onUploadFile(file);
      if (url) {
        applyUrl(url);
      }
    } finally {
      setUploadingField(null);
    }
  };

  const sampleStorePhotos = useMemo(
    () =>
      products
        .filter((p) => p.imageUrl)
        .slice(0, 3)
        .map((p) => ({
          id: p.id,
          name: p.displayTitle || p.name,
          imageUrl: p.imageUrl,
        })),
    [products],
  );

  const isPreviewActive = isXlViewport || mobileMode === 'preview';

  return (
    <div ref={studioRootRef} className="space-y-3 min-w-0">
      {/* Barra superior em telas menores (< 1280px): alternância em largura cheia Editar <-> Prévia */}
      <div className="xl:hidden sticky top-0 z-20 rounded-xl border border-line bg-surface p-2 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-1.5 bg-page p-1 rounded-xl border border-line">
          <button
            type="button"
            onClick={() => switchMobileMode('edit')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              mobileMode === 'edit'
                ? 'bg-brand text-on-brand'
                : 'text-ink hover:text-brand'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Editar</span>
          </button>
          <button
            type="button"
            onClick={() => switchMobileMode('preview')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              mobileMode === 'preview'
                ? 'bg-brand text-on-brand'
                : 'text-ink hover:text-brand'
            }`}
          >
            <Eye size={14} />
            <span>
              Prévia{simCartCount > 0 ? ` (${simCartCount})` : ''}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted">
          <span className="truncate">
            Seção ativa:{' '}
            <strong className="text-ink">
              {selectedSection?.title ||
                getSectionTypeLabel(selectedSection?.type || '')}
            </strong>
          </span>

          {mobileMode === 'preview' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${
                  previewDevice === 'desktop'
                    ? 'bg-brand text-on-brand border-brand'
                    : 'bg-page text-ink border-line'
                }`}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${
                  previewDevice === 'mobile'
                    ? 'bg-brand text-on-brand border-brand'
                    : 'bg-page text-ink border-line'
                }`}
              >
                Celular
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barra de estúdio em telas largas (>= 1280px): recolhimento dos painéis laterais + seletor de viewport + sacola simulada */}
      <div className="hidden xl:flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setLeftCollapsed((v) => !v)}
            className="retail-button retail-button-secondary"
            style={{ minHeight: 34, padding: '6px 10px', fontSize: 12 }}
          >
            {leftCollapsed ? (
              <PanelLeftOpen size={14} />
            ) : (
              <PanelLeftClose size={14} />
            )}
            <span>{leftCollapsed ? 'Mostrar seções' : 'Recolher seções'}</span>
          </button>

          <span className="text-xs text-muted truncate">
            Editando:{' '}
            <strong className="text-ink">
              {selectedSection?.title ||
                getSectionTypeLabel(selectedSection?.type || '')}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Largura da prévia"
            className="flex items-center gap-1 bg-page p-1 rounded-xl border border-line"
          >
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                previewDevice === 'desktop'
                  ? 'bg-brand text-on-brand'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Monitor size={13} />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                previewDevice === 'mobile'
                  ? 'bg-brand text-on-brand'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Smartphone size={13} />
              <span>Celular (375 px)</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-page border border-line text-xs">
            <ShoppingBag size={13} className="text-brand" />
            <span className="text-muted">Sacola simulada:</span>
            <strong className="text-ink tabular-nums">{simCartCount}</strong>
            <button
              type="button"
              onClick={() => setSimResetSignal((s) => s + 1)}
              className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
              title="Voltar ao início da prévia e esvaziar sacola simulada"
            >
              <RefreshCw size={11} /> Reiniciar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRightCollapsed((v) => !v)}
            className="retail-button retail-button-secondary"
            style={{ minHeight: 34, padding: '6px 10px', fontSize: 12 }}
          >
            {rightCollapsed ? (
              <PanelRightOpen size={14} />
            ) : (
              <PanelRightClose size={14} />
            )}
            <span>
              {rightCollapsed ? 'Mostrar controles' : 'Recolher controles'}
            </span>
          </button>
        </div>
      </div>

      {/* Área tripla em telas largas (Seções | Prévia central | Controles) e largura cheia em telas menores */}
      <div className="flex flex-col xl:flex-row gap-4 items-start min-w-0">
        {/* ÁREA 1 (Esquerda): Lista de seções da página + Modelo da vitrine com fotos reais */}
        <aside
          className={`${
            mobileMode === 'edit' ? 'block' : 'hidden'
          } ${
            leftCollapsed ? 'xl:hidden' : 'xl:block'
          } w-full xl:w-[280px] 2xl:w-[304px] shrink-0 space-y-3 min-w-0`}
        >
          {/* Lista das seções */}
          <div className="retail-panel space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="retail-kicker">Estrutura da Página</span>
                <h2 className="text-sm font-semibold text-ink">
                  Seções da Vitrine ({sections.length})
                </h2>
              </div>
            </div>

            <div className="space-y-1.5">
              {sections.map((sec: any, idx: number) => {
                const isSelected = sec.id === selectedSection?.id;
                const secWarnings = warningsBySection.get(sec.id) || [];
                const canDelete =
                  !SINGLETON_SECTION_TYPES.has(sec.type) &&
                  sec.type !== 'featured';

                return (
                  <div
                    key={sec.id}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'border-brand bg-support/55'
                        : 'border-line bg-page hover:border-brand'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="flex flex-col gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveSection(idx, -1)}
                            className="p-0.5 rounded border border-line bg-surface text-muted hover:text-ink disabled:opacity-30"
                            title="Mover seção para cima"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sections.length - 1}
                            onClick={() => moveSection(idx, 1)}
                            className="p-0.5 rounded border border-line bg-surface text-muted hover:text-ink disabled:opacity-30"
                            title="Mover seção para baixo"
                          >
                            <ArrowDown size={11} />
                          </button>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                              {getSectionTypeLabel(sec.type)}
                            </span>
                            {secWarnings.length > 0 && (
                              <AlertCircle
                                size={12}
                                className="text-brand shrink-0"
                              />
                            )}
                          </div>
                          <p
                            className={`text-xs font-semibold truncate ${
                              sec.enabled === false ? 'text-muted line-through' : 'text-ink'
                            }`}
                          >
                            {sec.title || getSectionTypeLabel(sec.type)}
                          </p>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateSectionAt(idx, {
                              enabled: sec.enabled === false,
                            })
                          }
                          className={`p-1.5 rounded-lg border transition ${
                            sec.enabled !== false
                              ? 'border-line bg-surface text-ink hover:border-brand'
                              : 'border-line bg-page text-muted'
                          }`}
                          title={
                            sec.enabled !== false
                              ? 'Ocultar seção'
                              : 'Ativar seção'
                          }
                        >
                          {sec.enabled !== false ? (
                            <Eye size={13} />
                          ) : (
                            <EyeOff size={13} />
                          )}
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => removeRepeatableSection(idx)}
                            className="p-1.5 rounded-lg border border-line bg-surface text-muted hover:text-ink"
                            title="Remover seção"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Adicionar novas seções repetíveis */}
            <div className="pt-2 border-t border-line space-y-1.5">
              <span className="text-[11px] font-semibold text-muted block">
                Adicionar nova seção à página
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={addBannerSection}
                  className="retail-button retail-button-secondary w-full justify-start"
                  style={{ minHeight: 34, fontSize: 12 }}
                >
                  <Plus size={14} className="text-brand" />
                  <span>Adicionar Banner Independente</span>
                </button>
                <button
                  type="button"
                  onClick={addProductSelectionSection}
                  className="retail-button retail-button-secondary w-full justify-start"
                  style={{ minHeight: 34, fontSize: 12 }}
                >
                  <Plus size={14} className="text-brand" />
                  <span>Adicionar Seleção / Carrossel</span>
                </button>
                <button
                  type="button"
                  onClick={addLookSection}
                  className="retail-button retail-button-secondary w-full justify-start"
                  style={{ minHeight: 34, fontSize: 12 }}
                >
                  <Sparkles size={14} className="text-brand" />
                  <span>Adicionar “Monte o look”</span>
                </button>
              </div>
            </div>
          </div>

          {/* Seleção de Modelo com fotos reais da loja */}
          <div className="retail-panel space-y-3 min-w-0">
            <div>
              <span className="retail-kicker">Identidade & Composição</span>
              <h2 className="text-sm font-semibold text-ink">
                Modelo da Vitrine
              </h2>
            </div>

            <div className="space-y-2">
              {TEMPLATE_OPTIONS.map((tpl) => {
                const selected = draftTheme.template === tpl.id;
                const isDarkCard = tpl.id === 'vitrine_escura';
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() =>
                      setDraftTheme((prev: any) => ({
                        ...prev,
                        template: tpl.id,
                      }))
                    }
                    className={`w-full p-3 rounded-xl border text-left transition space-y-2.5 ${
                      selected
                        ? 'border-brand bg-support/50'
                        : 'border-line bg-page hover:border-brand'
                    }`}
                  >
                    {/* Miniatura real da loja na composição do modelo */}
                    <div
                      style={{
                        backgroundColor: tpl.bgPreview,
                        borderColor: '#E5E1ED',
                      }}
                      className="rounded-xl border p-2 space-y-1.5 overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5">
                        {settingsForm.coverUrl ? (
                          <img
                            src={getFullUrl(settingsForm.coverUrl)}
                            alt=""
                            className={`rounded-md object-cover border border-line shrink-0 ${
                              tpl.id === 'vitrine_escura'
                                ? 'w-full h-9'
                                : tpl.id === 'minimal_branco'
                                  ? 'w-1/2 h-9 ml-auto'
                                  : 'w-2/5 h-9 ml-auto'
                            }`}
                          />
                        ) : (
                          <div
                            style={{ backgroundColor: '#7C3AED' }}
                            className="h-2.5 w-12 rounded-full"
                          />
                        )}
                      </div>

                      {sampleStorePhotos.length > 0 && (
                        <div
                          className={`grid gap-1 ${
                            tpl.id === 'minimal_branco'
                              ? 'grid-cols-2'
                              : 'grid-cols-3'
                          }`}
                        >
                          {sampleStorePhotos
                            .slice(0, tpl.id === 'minimal_branco' ? 2 : 3)
                            .map((sp) => (
                              <StorefrontProductFrame
                                key={sp.id}
                                imageUrl={sp.imageUrl}
                                alt={sp.name}
                                productName={sp.name}
                                padding="xs"
                                aspectClassName="h-10 w-full"
                                roundedClassName="rounded-md border border-line"
                              />
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-ink">
                            {tpl.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line text-muted">
                            {tpl.compositionTag}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5 leading-snug">
                          {tpl.desc}
                        </p>
                      </div>
                      {selected && (
                        <Check
                          size={15}
                          className={`shrink-0 ${isDarkCard ? 'text-brand' : 'text-brand'}`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-line">
              <div>
                <span className="block text-[11px] font-semibold text-muted mb-1">
                  Cor principal
                </span>
                <div className="flex gap-1.5">
                  {['#7C3AED', '#6D28D9'].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          primaryColor: hex,
                        }))
                      }
                      style={{ backgroundColor: hex }}
                      className={`h-7 flex-1 rounded-lg border-2 flex items-center justify-center text-on-brand text-[10px] font-mono font-semibold ${
                        draftTheme.primaryColor === hex
                          ? 'border-ink'
                          : 'border-transparent opacity-75'
                      }`}
                    >
                      {hex}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-muted mb-1">
                  Cor de acento
                </span>
                <div className="flex gap-1.5">
                  {['#6D28D9', '#7C3AED'].map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          accentColor: hex,
                        }))
                      }
                      style={{ backgroundColor: hex }}
                      className={`h-7 flex-1 rounded-lg border-2 flex items-center justify-center text-on-brand text-[10px] font-mono font-semibold ${
                        draftTheme.accentColor === hex
                          ? 'border-ink'
                          : 'border-transparent opacity-75'
                      }`}
                    >
                      {hex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ÁREA 2 (Centro): Prévia interativa com largura de viewport independente via iframe */}
        <div
          className={`${
            mobileMode === 'preview' ? 'block' : 'hidden'
          } xl:block flex-1 w-full min-w-0 xl:sticky xl:top-2`}
        >
          <div className="retail-panel p-0 overflow-hidden min-w-0">
            <div className="px-3.5 py-2.5 border-b border-line bg-surface flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Eye size={14} className="text-brand shrink-0" />
                <span className="font-semibold text-ink truncate">
                  Prévia Interativa ({previewDevice === 'mobile' ? 'Celular 375 px' : 'Desktop'})
                </span>
                <span className="text-[11px] text-muted hidden sm:inline">
                  • Clique numa seção para editá-la ou simule a sacola
                </span>
              </div>

              <div className="flex items-center gap-2 xl:hidden">
                <span className="text-[11px] text-muted">
                  Sacola: <strong className="text-ink">{simCartCount}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSimResetSignal((s) => s + 1)}
                  className="text-[11px] font-semibold text-brand hover:underline"
                >
                  Reiniciar
                </button>
              </div>
            </div>

            <StorefrontIframePreview
              storeData={livePreviewStoreData}
              products={livePreviewStoreData.previewProducts}
              previewDevice={previewDevice}
              selectedSectionId={selectedSection?.id || null}
              onSelectEditorSection={(secId) => {
                setSelectedSectionId(secId);
                if (rightCollapsed) setRightCollapsed(false);
              }}
              resetSignal={simResetSignal}
              onSimulationCartChange={setSimCartCount}
              isActive={isPreviewActive}
            />
          </div>
        </div>

        {/* ÁREA 3 (Direita): Controles da seção selecionada */}
        <aside
          className={`${
            mobileMode === 'edit' ? 'block' : 'hidden'
          } ${
            rightCollapsed ? 'xl:hidden' : 'xl:block'
          } w-full xl:w-[340px] 2xl:w-[376px] shrink-0 min-w-0`}
        >
          {selectedSection && (
            <div className="retail-panel space-y-4 min-w-0">
              <div className="border-b border-line pb-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="retail-kicker">
                    {getSectionTypeLabel(selectedSection.type)}
                  </span>
                  <span className="font-mono text-[10px] text-muted bg-page px-2 py-0.5 rounded border border-line truncate max-w-[160px]">
                    ID: {selectedSection.id}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink truncate">
                    {selectedSection.title ||
                      getSectionTypeLabel(selectedSection.type)}
                  </h2>

                  <div className="flex items-center gap-1 shrink-0 xl:hidden">
                    <button
                      type="button"
                      disabled={selectedSectionIndex <= 0}
                      onClick={() =>
                        setSelectedSectionId(
                          sections[selectedSectionIndex - 1]?.id || null,
                        )
                      }
                      className="p-1 rounded border border-line bg-page text-muted hover:text-ink disabled:opacity-30"
                      title="Seção anterior"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={selectedSectionIndex >= sections.length - 1}
                      onClick={() =>
                        setSelectedSectionId(
                          sections[selectedSectionIndex + 1]?.id || null,
                        )
                      }
                      className="p-1 rounded border border-line bg-page text-muted hover:text-ink disabled:opacity-30"
                      title="Próxima seção"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <RetailSwitch
                  size="sm"
                  checked={selectedSection.enabled !== false}
                  onCheckedChange={(checked) =>
                    updateSectionAt(selectedSectionIndex, { enabled: checked })
                  }
                  label={
                    selectedSection.enabled !== false
                      ? 'Seção ativa na página'
                      : 'Seção desativada (oculta)'
                  }
                />
              </div>

              {/* Avisos específicos da seção selecionada */}
              {(warningsBySection.get(selectedSection.id) || []).length > 0 && (
                <div className="p-3 rounded-xl border border-brand bg-support/55 space-y-1">
                  {(warningsBySection.get(selectedSection.id) || []).map(
                    (msg, i) => (
                      <p
                        key={i}
                        className="text-xs text-ink flex items-start gap-1.5"
                      >
                        <AlertCircle
                          size={13}
                          className="text-brand shrink-0 mt-0.5"
                        />
                        <span>{msg}</span>
                      </p>
                    ),
                  )}
                </div>
              )}

              {/* CONTROLES POR TIPO DE SEÇÃO */}
              {selectedSection.type === 'header' && (
                <div className="space-y-3">
                  <label className="retail-field">
                    <span>Faixa superior de aviso (opcional)</span>
                    <input
                      type="text"
                      value={draftTheme.announcementText || ''}
                      onChange={(e) =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          announcementText: e.target.value,
                        }))
                      }
                      placeholder="Ex: Retirada rápida ou entrega no mesmo dia"
                    />
                  </label>

                  <div className="p-3 rounded-xl border border-line bg-page space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink">
                        Logotipo no cabeçalho
                      </span>
                      {settingsForm.logoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsForm((prev: any) => ({
                              ...prev,
                              logoUrl: '',
                            }))
                          }
                          className="text-[11px] font-semibold text-muted hover:text-ink"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    {settingsForm.logoUrl && (
                      <img
                        src={getFullUrl(settingsForm.logoUrl)}
                        alt="Logo"
                        className="w-12 h-12 rounded-xl object-contain p-1 border border-line bg-surface"
                      />
                    )}
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand cursor-pointer">
                      {uploadingField === 'logo' ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      <span>
                        {settingsForm.logoUrl ? 'Trocar logotipo' : 'Enviar logotipo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            void handleFieldUpload('logo', f, (url) =>
                              setSettingsForm((prev: any) => ({
                                ...prev,
                                logoUrl: url,
                              })),
                            );
                          }
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-muted">
                      Para alterar nome da loja ou slogan, acesse{' '}
                      <button
                        type="button"
                        onClick={() => onNavigateTab('settings')}
                        className="text-brand font-semibold hover:underline"
                      >
                        Configurações
                      </button>
                      .
                    </p>
                  </div>
                </div>
              )}

              {selectedSection.type === 'hero' && (
                <div className="space-y-3">
                  <label className="retail-field">
                    <span>Título principal da capa</span>
                    <input
                      type="text"
                      value={draftTheme.heroTitle || ''}
                      onChange={(e) =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          heroTitle: e.target.value,
                        }))
                      }
                      placeholder={
                        settingsForm.storeName || 'Nova Coleção Disponível'
                      }
                    />
                  </label>

                  <label className="retail-field">
                    <span>Subtítulo da capa</span>
                    <textarea
                      rows={2}
                      value={draftTheme.heroSubtitle || ''}
                      onChange={(e) =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          heroSubtitle: e.target.value,
                        }))
                      }
                      placeholder="Escolha suas peças, tamanho e cor e finalize pelo WhatsApp."
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                    <label className="retail-field">
                      <span>Texto do botão (CTA)</span>
                      <input
                        type="text"
                        value={draftTheme.heroCtaLabel || ''}
                        onChange={(e) =>
                          setDraftTheme((prev: any) => ({
                            ...prev,
                            heroCtaLabel: e.target.value,
                          }))
                        }
                        placeholder="Ver coleção"
                      />
                    </label>

                    <div className="retail-field">
                      <span>Proporção / altura da capa</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'sm', label: 'Compacta' },
                          { id: 'md', label: 'Média' },
                          { id: 'lg', label: 'Ampla' },
                        ].map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() =>
                              setDraftTheme((prev: any) => ({
                                ...prev,
                                heroHeight: h.id,
                              }))
                            }
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                              (draftTheme.heroHeight || 'md') === h.id
                                ? 'bg-brand text-on-brand border-brand'
                                : 'bg-page text-ink border-line hover:border-brand'
                            }`}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Imagem de capa Desktop e opcional para Celular */}
                  <div className="p-3 rounded-xl border border-line bg-page space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink">
                        Imagem de capa (Desktop)
                      </span>
                      {settingsForm.coverUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsForm((prev: any) => ({
                              ...prev,
                              coverUrl: '',
                            }))
                          }
                          className="text-[11px] font-semibold text-muted hover:text-ink"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand cursor-pointer">
                      {uploadingField === 'hero-desktop' ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      <span>
                        {settingsForm.coverUrl
                          ? 'Trocar imagem desktop'
                          : 'Enviar imagem de capa'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            void handleFieldUpload('hero-desktop', f, (url) =>
                              setSettingsForm((prev: any) => ({
                                ...prev,
                                coverUrl: url,
                              })),
                            );
                          }
                        }}
                      />
                    </label>

                    <div className="pt-2 border-t border-line space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink">
                          Imagem opcional para Celular
                        </span>
                        {draftTheme.heroMobileCoverUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftTheme((prev: any) => ({
                                ...prev,
                                heroMobileCoverUrl: null,
                              }))
                            }
                            className="text-[11px] font-semibold text-muted hover:text-ink"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand cursor-pointer">
                        {uploadingField === 'hero-mobile' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Smartphone size={13} />
                        )}
                        <span>
                          {draftTheme.heroMobileCoverUrl
                            ? 'Trocar arte mobile'
                            : 'Enviar arte vertical/mobile'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              void handleFieldUpload('hero-mobile', f, (url) =>
                                setDraftTheme((prev: any) => ({
                                  ...prev,
                                  heroMobileCoverUrl: url,
                                })),
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <FocalPointPad
                    imageUrl={settingsForm.coverUrl}
                    mobileImageUrl={draftTheme.heroMobileCoverUrl}
                    focalX={draftTheme.heroFocalX}
                    focalY={draftTheme.heroFocalY}
                    onChange={(nx, ny) =>
                      setDraftTheme((prev: any) => ({
                        ...prev,
                        heroFocalX: nx,
                        heroFocalY: ny,
                      }))
                    }
                  />
                </div>
              )}

              {selectedSection.type === 'banner' && (() => {
                const b = selectedSection.banner || selectedSection;
                return (
                  <div className="space-y-3">
                    <div className="retail-field">
                      <span>Formato do banner</span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          {
                            id: 'strip',
                            label: 'Faixa',
                            desc: 'Aviso ou campanha horizontal enxuta',
                          },
                          {
                            id: 'side_by_side',
                            label: 'Imagem com texto ao lado',
                            desc: 'Quadro dividido equilibrando texto e foto',
                          },
                          {
                            id: 'campaign',
                            label: 'Campanha',
                            desc: 'Imagem ampla com ponto focal e chamada sobreposta',
                          },
                        ].map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() =>
                              updateBannerInSection(selectedSectionIndex, {
                                format: fmt.id,
                              })
                            }
                            className={`p-2.5 rounded-xl border text-left transition ${
                              (b.format || 'strip') === fmt.id
                                ? 'border-brand bg-support/55'
                                : 'border-line bg-page hover:border-brand'
                            }`}
                          >
                            <span className="text-xs font-semibold text-ink block">
                              {fmt.label}
                            </span>
                            <span className="text-[11px] text-muted block">
                              {fmt.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="retail-field">
                      <span>Altura do banner</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'sm', label: 'Compacta' },
                          { id: 'md', label: 'Média' },
                          { id: 'lg', label: 'Ampla' },
                        ].map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() =>
                              updateBannerInSection(selectedSectionIndex, {
                                height: h.id,
                              })
                            }
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                              (b.height || 'md') === h.id
                                ? 'bg-brand text-on-brand border-brand'
                                : 'bg-page text-ink border-line hover:border-brand'
                            }`}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="retail-field">
                      <span>Título do banner</span>
                      <input
                        type="text"
                        value={b.title || ''}
                        onChange={(e) =>
                          updateBannerInSection(selectedSectionIndex, {
                            title: e.target.value,
                          })
                        }
                        placeholder="Ex: Lançamento de Inverno"
                      />
                    </label>

                    <label className="retail-field">
                      <span>Subtítulo / mensagem complementar</span>
                      <textarea
                        rows={2}
                        value={b.subtitle || ''}
                        onChange={(e) =>
                          updateBannerInSection(selectedSectionIndex, {
                            subtitle: e.target.value,
                          })
                        }
                        placeholder="Ex: Peças exclusivas com pronta entrega"
                      />
                    </label>

                    <div className="retail-field">
                      <span>Destino ao clicar</span>
                      <RetailSelect
                        value={b.targetType || 'all'}
                        onValueChange={(val) =>
                          updateBannerInSection(selectedSectionIndex, {
                            targetType: val,
                            targetValue: '',
                          })
                        }
                        options={[
                          { value: 'none', label: 'Apenas visual (sem clique)' },
                          { value: 'all', label: 'Rolar até o catálogo completo' },
                          { value: 'featured', label: 'Mostrar peças em destaque' },
                          { value: 'category', label: 'Filtrar uma categoria...' },
                          { value: 'product', label: 'Abrir um produto...' },
                          {
                            value: 'collection',
                            label: 'Abrir uma coleção / look...',
                          },
                        ]}
                      />
                    </div>

                    {b.targetType === 'category' && (
                      <div className="retail-field">
                        <span>Categoria de destino</span>
                        <RetailSelect
                          value={b.targetValue || ''}
                          onValueChange={(val) =>
                            updateBannerInSection(selectedSectionIndex, {
                              targetValue: val,
                            })
                          }
                          placeholder="Escolha a categoria..."
                          options={categories.map((c) => ({
                            value: String(c.id),
                            label: `${c.name}${c.isVisible === false ? ' (Oculta na loja)' : ''}`,
                          }))}
                        />
                      </div>
                    )}

                    {b.targetType === 'product' && (
                      <div className="retail-field">
                        <span>Produto de destino</span>
                        <RetailSelect
                          value={b.targetValue || ''}
                          onValueChange={(val) =>
                            updateBannerInSection(selectedSectionIndex, {
                              targetValue: val,
                            })
                          }
                          placeholder="Escolha o produto..."
                          options={products.map((p) => ({
                            value: String(p.publicSlug || p.id),
                            label: `${p.displayTitle || p.name}${
                              !p.isVisible
                                ? ' (Oculto)'
                                : Number(p.availableStock ?? 0) <= 0
                                  ? ' (Sem estoque)'
                                  : ''
                            }`,
                          }))}
                        />
                      </div>
                    )}

                    {b.targetType === 'collection' && (
                      <div className="retail-field">
                        <span>Coleção ou “Monte o look” de destino</span>
                        <RetailSelect
                          value={b.targetValue || ''}
                          onValueChange={(val) =>
                            updateBannerInSection(selectedSectionIndex, {
                              targetValue: val,
                            })
                          }
                          placeholder="Escolha a coleção..."
                          options={collections.map((c: any) => ({
                            value: String(c.slug || c.id),
                            label: `${c.title} (${c.kind === 'look' ? 'Look' : 'Coleção'})${
                              c.enabled === false ? ' - Pausada' : ''
                            }`,
                          }))}
                        />
                      </div>
                    )}

                    {b.targetType !== 'none' && (
                      <label className="retail-field">
                        <span>Texto do botão (CTA)</span>
                        <input
                          type="text"
                          value={b.ctaLabel ?? ''}
                          onChange={(e) =>
                            updateBannerInSection(selectedSectionIndex, {
                              ctaLabel: e.target.value,
                            })
                          }
                          placeholder="Conferir"
                        />
                      </label>
                    )}

                    {/* Imagens Desktop + Celular do Banner */}
                    <div className="p-3 rounded-xl border border-line bg-page space-y-2.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink">
                            Imagem principal (Desktop)
                          </span>
                          {b.imageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                updateBannerInSection(selectedSectionIndex, {
                                  imageUrl: null,
                                })
                              }
                              className="text-[11px] font-semibold text-muted hover:text-ink"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={b.imageUrl || ''}
                          onChange={(e) =>
                            updateBannerInSection(selectedSectionIndex, {
                              imageUrl: e.target.value.trim() || null,
                            })
                          }
                          placeholder="URL da imagem ou envie abaixo..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs"
                        />
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand cursor-pointer">
                          {uploadingField === `bn-desk-${selectedSection.id}` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Upload size={13} />
                          )}
                          <span>Enviar imagem desktop</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                void handleFieldUpload(
                                  `bn-desk-${selectedSection.id}`,
                                  f,
                                  (url) =>
                                    updateBannerInSection(selectedSectionIndex, {
                                      imageUrl: url,
                                      format:
                                        b.format === 'strip' && !b.imageUrl
                                          ? 'side_by_side'
                                          : b.format,
                                    }),
                                );
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="pt-2 border-t border-line space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink">
                            Imagem opcional para Celular
                          </span>
                          {b.mobileImageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                updateBannerInSection(selectedSectionIndex, {
                                  mobileImageUrl: null,
                                })
                              }
                              className="text-[11px] font-semibold text-muted hover:text-ink"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={b.mobileImageUrl || ''}
                          onChange={(e) =>
                            updateBannerInSection(selectedSectionIndex, {
                              mobileImageUrl: e.target.value.trim() || null,
                            })
                          }
                          placeholder="Opcional: URL da imagem mobile..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs"
                        />
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand cursor-pointer">
                          {uploadingField === `bn-mob-${selectedSection.id}` ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Smartphone size={13} />
                          )}
                          <span>Enviar imagem para celular</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                void handleFieldUpload(
                                  `bn-mob-${selectedSection.id}`,
                                  f,
                                  (url) =>
                                    updateBannerInSection(selectedSectionIndex, {
                                      mobileImageUrl: url,
                                    }),
                                );
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <FocalPointPad
                      imageUrl={b.imageUrl}
                      mobileImageUrl={b.mobileImageUrl}
                      focalX={b.focalX}
                      focalY={b.focalY}
                      onChange={(nx, ny) =>
                        updateBannerInSection(selectedSectionIndex, {
                          focalX: nx,
                          focalY: ny,
                        })
                      }
                    />
                  </div>
                );
              })()}

              {(selectedSection.type === 'featured' ||
                selectedSection.type === 'product_selection') && (() => {
                const presentation =
                  selectedSection.presentation === 'carousel'
                    ? 'carousel'
                    : 'grid';
                const sourceType =
                  selectedSection.sourceType ||
                  (selectedSection.type === 'featured' ? 'featured' : 'manual');
                const cols = Number(selectedSection.columnsDesktop || 4);
                const visibleLimit = Number(
                  selectedSection.visibleCount ||
                    (presentation === 'carousel' ? 12 : 8),
                );

                let totalSelectedCount = 0;
                if (sourceType === 'manual') {
                  totalSelectedCount = (selectedSection.productIds || []).length;
                } else if (sourceType === 'collection') {
                  const col = collections.find(
                    (c: any) =>
                      c.id === selectedSection.collectionId ||
                      c.slug === selectedSection.collectionId,
                  );
                  totalSelectedCount = (col?.productIds || []).length;
                } else {
                  totalSelectedCount = products.filter(
                    (p) => p.featured && p.isVisible,
                  ).length;
                }

                const presentedCount = Math.min(totalSelectedCount, visibleLimit);
                const visibleAtOnceDesktop =
                  presentation === 'carousel'
                    ? Math.min(presentedCount, cols)
                    : presentedCount;
                const visibleAtOnceMobile =
                  presentation === 'carousel'
                    ? Math.min(presentedCount, 2)
                    : presentedCount;

                return (
                  <div className="space-y-3">
                    {/* Indicador claro de itens selecionados vs. visíveis por vez */}
                    <div className="p-3 rounded-xl border border-brand/50 bg-support/55 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted font-medium">
                          Itens selecionados:
                        </span>
                        <strong className="text-brand tabular-nums">
                          {totalSelectedCount} produto(s)
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted font-medium">
                          Visíveis por vez:
                        </span>
                        <strong className="text-ink tabular-nums">
                          {visibleAtOnceDesktop} no desktop • {visibleAtOnceMobile}{' '}
                          no celular
                        </strong>
                      </div>
                      <p className="text-[11px] text-muted pt-0.5">
                        {presentation === 'carousel'
                          ? `Até ${visibleLimit} itens no trilho. Quando há mais de ${cols} itens, o botão "Ver seleção completa" aparece automaticamente.`
                          : `Exibe até ${visibleLimit} itens na grade (${cols} por linha no desktop).`}
                      </p>
                    </div>

                    <label className="retail-field">
                      <span>Título da seção</span>
                      <input
                        type="text"
                        value={selectedSection.title || ''}
                        onChange={(e) =>
                          updateSectionAt(selectedSectionIndex, {
                            title: e.target.value,
                          })
                        }
                        placeholder="Ex: Mais pedidos da semana"
                      />
                    </label>

                    <label className="retail-field">
                      <span>Subtítulo opcional</span>
                      <input
                        type="text"
                        value={selectedSection.subtitle || ''}
                        onChange={(e) =>
                          updateSectionAt(selectedSectionIndex, {
                            subtitle: e.target.value,
                          })
                        }
                        placeholder="Ex: Peças com pronta entrega"
                      />
                    </label>

                    <div className="retail-field">
                      <span>Apresentação</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateSectionAt(selectedSectionIndex, {
                              presentation: 'grid',
                            })
                          }
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                            presentation === 'grid'
                              ? 'bg-brand text-on-brand border-brand'
                              : 'bg-page text-ink border-line hover:border-brand'
                          }`}
                        >
                          Grade
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSectionAt(selectedSectionIndex, {
                              presentation: 'carousel',
                            })
                          }
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                            presentation === 'carousel'
                              ? 'bg-brand text-on-brand border-brand'
                              : 'bg-page text-ink border-line hover:border-brand'
                          }`}
                        >
                          Carrossel
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="retail-field">
                        <span>Colunas (Desktop)</span>
                        <RetailSelect
                          value={String(cols)}
                          onValueChange={(v) =>
                            updateSectionAt(selectedSectionIndex, {
                              columnsDesktop: Number(v),
                            })
                          }
                          options={[
                            { value: '2', label: '2 por vez' },
                            { value: '3', label: '3 por vez' },
                            { value: '4', label: '4 por vez' },
                          ]}
                        />
                      </div>

                      <div className="retail-field">
                        <span>Limite na seção</span>
                        <RetailSelect
                          value={String(visibleLimit)}
                          onValueChange={(v) =>
                            updateSectionAt(selectedSectionIndex, {
                              visibleCount: Number(v),
                            })
                          }
                          options={[
                            { value: '4', label: 'Até 4 itens' },
                            { value: '8', label: 'Até 8 itens' },
                            { value: '12', label: 'Até 12 itens' },
                            { value: '16', label: 'Até 16 itens' },
                            { value: '24', label: 'Até 24 itens' },
                          ]}
                        />
                      </div>
                    </div>

                    {presentation === 'carousel' && (
                      <div className="p-2.5 rounded-xl border border-line bg-page">
                        <RetailSwitch
                          size="sm"
                          checked={selectedSection.autoPlay === true}
                          onCheckedChange={(checked) =>
                            updateSectionAt(selectedSectionIndex, {
                              autoPlay: checked,
                            })
                          }
                          label="Avanço automático do carrossel"
                          description="Desativado por padrão. Setas estáveis, teclado e toque continuam ativos."
                        />
                      </div>
                    )}

                    <div className="retail-field">
                      <span>Origem das mercadorias</span>
                      <RetailSelect
                        value={sourceType}
                        onValueChange={(val) =>
                          updateSectionAt(selectedSectionIndex, {
                            sourceType: val,
                          })
                        }
                        options={[
                          {
                            value: 'manual',
                            label: 'Lista manual de produtos',
                          },
                          {
                            value: 'featured',
                            label: 'Produtos marcados como Destaque',
                          },
                          {
                            value: 'collection',
                            label: 'Vincular uma Coleção curada',
                          },
                        ]}
                      />
                    </div>

                    {sourceType === 'manual' && (
                      <ManualProductCurator
                        selectedIds={selectedSection.productIds || []}
                        onChangeIds={(nextIds) =>
                          updateSectionAt(selectedSectionIndex, {
                            productIds: nextIds,
                          })
                        }
                        products={products}
                        maxItems={48}
                        contextLabel="seção"
                      />
                    )}

                    {sourceType === 'collection' && (
                      <div className="space-y-2">
                        <RetailSelect
                          value={selectedSection.collectionId || ''}
                          onValueChange={(val) =>
                            updateSectionAt(selectedSectionIndex, {
                              collectionId: val,
                            })
                          }
                          placeholder="Escolha uma coleção curada..."
                          options={collections.map((c: any) => ({
                            value: String(c.id),
                            label: `${c.title} (${(c.productIds || []).length} peças)`,
                          }))}
                        />
                        <button
                          type="button"
                          onClick={() => onNavigateTab('products', true)}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Gerenciar coleções e ordem das peças →
                        </button>
                      </div>
                    )}

                    {sourceType === 'featured' && (
                      <div className="p-3 rounded-xl border border-line bg-page text-xs text-muted space-y-1.5">
                        <p>
                          Exibe automaticamente até{' '}
                          <strong className="text-ink">{visibleLimit}</strong>{' '}
                          peças marcadas com estrela de Destaque (atualmente{' '}
                          <strong className="text-ink">
                            {totalSelectedCount}
                          </strong>{' '}
                          visíveis).
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('products', false)}
                          className="text-brand font-semibold hover:underline"
                        >
                          Escolher destaques na aba Produtos →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedSection.type === 'look' && (() => {
                const looks = collections.filter((c: any) => c.kind === 'look');
                const activeLook =
                  looks.find(
                    (c: any) =>
                      c.id === selectedSection.collectionId ||
                      c.slug === selectedSection.collectionId,
                  ) ||
                  looks[0] ||
                  null;

                return (
                  <div className="space-y-3">
                    <label className="retail-field">
                      <span>Título exibido na seção</span>
                      <input
                        type="text"
                        value={selectedSection.title || ''}
                        onChange={(e) =>
                          updateSectionAt(selectedSectionIndex, {
                            title: e.target.value,
                          })
                        }
                        placeholder="Monte o look"
                      />
                    </label>

                    <label className="retail-field">
                      <span>Subtítulo da seção</span>
                      <input
                        type="text"
                        value={selectedSection.subtitle || ''}
                        onChange={(e) =>
                          updateSectionAt(selectedSectionIndex, {
                            subtitle: e.target.value,
                          })
                        }
                        placeholder="Compre todas as peças ou apenas as que preferir"
                      />
                    </label>

                    <div className="retail-field">
                      <span>Conjunto “Monte o look” vinculado</span>
                      <RetailSelect
                        value={activeLook?.id || ''}
                        onValueChange={(val) =>
                          updateSectionAt(selectedSectionIndex, {
                            collectionId: val,
                          })
                        }
                        placeholder="Selecione um conjunto..."
                        options={looks.map((lk: any) => ({
                          value: String(lk.id),
                          label: `${lk.title} (${(lk.productIds || []).length} peças)`,
                        }))}
                      />
                    </div>

                    {activeLook ? (
                      <div className="pt-2 border-t border-line space-y-2.5">
                        <ManualProductCurator
                          selectedIds={activeLook.productIds || []}
                          onChangeIds={(nextIds) =>
                            setDraftTheme((prev: any) => ({
                              ...prev,
                              collections: (prev.collections || []).map(
                                (c: any) =>
                                  c.id === activeLook.id
                                    ? { ...c, productIds: nextIds }
                                    : c,
                              ),
                            }))
                          }
                          products={products}
                          maxItems={24}
                          contextLabel="composição do look"
                        />
                        <button
                          type="button"
                          onClick={() => onNavigateTab('products', true)}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Abrir página completa de Coleções e Looks →
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('products', true)}
                        className="retail-button retail-button-secondary w-full"
                      >
                        <Sparkles size={14} className="text-brand" />
                        <span>Criar conjunto “Monte o look”</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {(selectedSection.type === 'categories' ||
                selectedSection.type === 'collection' ||
                selectedSection.type === 'fulfillment_info' ||
                selectedSection.type === 'footer') && (
                <div className="space-y-3">
                  {(selectedSection.type === 'categories' ||
                    selectedSection.type === 'collection') && (
                    <label className="retail-field">
                      <span>Título da seção</span>
                      <input
                        type="text"
                        value={selectedSection.title || ''}
                        onChange={(e) =>
                          updateSectionAt(selectedSectionIndex, {
                            title: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <div className="p-3 rounded-xl border border-line bg-page text-xs text-muted space-y-2">
                    {selectedSection.type === 'categories' && (
                      <>
                        <p>
                          Exibe o trilho de categorias com setas estáveis e opção
                          “Ver todas”.
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('categories')}
                          className="text-brand font-semibold hover:underline"
                        >
                          Ordenar ou ocultar categorias →
                        </button>
                      </>
                    )}
                    {selectedSection.type === 'collection' && (
                      <>
                        <p>
                          Grade principal com busca, filtros por tamanho e cor e
                          enquadramento unificado sem cortar peças.
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('products', false)}
                          className="text-brand font-semibold hover:underline"
                        >
                          Gerenciar produtos visíveis →
                        </button>
                      </>
                    )}
                    {selectedSection.type === 'fulfillment_info' && (
                      <>
                        <p>
                          Apresenta claramente as regras de Retirada na Loja e
                          Entrega configuradas pelo lojista.
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('settings')}
                          className="text-brand font-semibold hover:underline"
                        >
                          Editar regras em Configurações →
                        </button>
                      </>
                    )}
                    {selectedSection.type === 'footer' && (
                      <>
                        <p>
                          Exibe endereço físico, horários de atendimento e link
                          direto para o WhatsApp oficial da loja.
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('settings')}
                          className="text-brand font-semibold hover:underline"
                        >
                          Editar WhatsApp e endereço →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
