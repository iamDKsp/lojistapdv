import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useStorefrontWindow } from '../storefront-motion';
import {
  StorefrontProductCard,
  type AddSourceRect,
} from './StorefrontProductCard';
import {
  StorefrontCampaignVisual,
  StorefrontProductFrame,
} from './StorefrontProductFrame';

const formatBrl = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export interface BannerTargetAction {
  targetType: string;
  targetValue: string;
}

/**
 * Seção independente de Banner:
 * Suporta os formatos `strip` (Faixa), `side_by_side` (Imagem com texto ao lado) e `campaign` (Campanha),
 * altura configurável (`sm` | `md` | `lg`), ponto focal (`focalX`, `focalY`) e imagem opcional para celular.
 */
export function StorefrontBannerSection({
  banner,
  template = 'editorial_roxo',
  categories = [],
  products = [],
  collections = [],
  onActivateTarget,
}: {
  banner: any;
  template?: string;
  categories?: any[];
  products?: any[];
  collections?: any[];
  onActivateTarget?: (target: BannerTargetAction) => void;
}) {
  if (!banner || banner.enabled === false) return null;

  const isDark = template === 'vitrine_escura';
  const isMinimal = template === 'minimal_branco';
  const format: 'strip' | 'side_by_side' | 'campaign' =
    banner.format === 'strip' ||
    banner.format === 'side_by_side' ||
    banner.format === 'campaign'
      ? banner.format
      : banner.imageUrl
        ? 'side_by_side'
        : 'strip';
  const height: 'sm' | 'md' | 'lg' =
    banner.height === 'sm' || banner.height === 'lg' ? banner.height : 'md';

  const targetType = String(banner.targetType || banner.linkType || 'none');
  const targetValue = String(banner.targetValue || banner.linkTarget || '').trim();

  // Valida se o destino aponta para item/categoria/coleção existente e visível na loja pública
  const isTargetValid = useMemo(() => {
    if (!onActivateTarget || targetType === 'none') return false;
    if (targetType === 'all' || targetType === 'featured') return true;
    if (!targetValue) return false;
    if (targetType === 'category') {
      return categories.some(
        (c) => c.id === targetValue || c.slug === targetValue,
      );
    }
    if (targetType === 'product') {
      return products.some(
        (p) =>
          p.id === targetValue ||
          p.retailGroupId === targetValue ||
          p.slug === targetValue,
      );
    }
    if (targetType === 'collection') {
      return collections.some(
        (col) =>
          col.enabled !== false &&
          (col.id === targetValue || col.slug === targetValue),
      );
    }
    return false;
  }, [onActivateTarget, targetType, targetValue, categories, products, collections]);

  const handleClick = () => {
    if (!isTargetValid || !onActivateTarget) return;
    onActivateTarget({ targetType, targetValue });
  };

  const ctaLabel = String(banner.ctaLabel || '').trim();
  const hasImage = Boolean(banner.imageUrl || banner.mobileImageUrl);

  // 1. Formato Faixa (`strip`)
  if (format === 'strip') {
    const padY =
      height === 'sm'
        ? 'py-3 px-4 sm:px-6'
        : height === 'lg'
          ? 'py-6 sm:py-7 px-5 sm:px-8'
          : 'py-4 sm:py-5 px-4 sm:px-6';

    return (
      <div
        onClick={isTargetValid ? handleClick : undefined}
        role={isTargetValid ? 'button' : undefined}
        tabIndex={isTargetValid ? 0 : undefined}
        onKeyDown={
          isTargetValid
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
        className={`rounded-2xl border ${padY} flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition ${
          isDark
            ? 'bg-ink border-muted/40 text-on-brand'
            : isMinimal
              ? 'bg-page border-line text-ink'
              : 'bg-support/55 border-line text-ink'
        } ${isTargetValid ? 'cursor-pointer hover:border-brand' : ''}`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {hasImage && (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-line shrink-0 bg-surface">
              <StorefrontCampaignVisual
                imageUrl={banner.imageUrl}
                mobileImageUrl={banner.mobileImageUrl}
                alt={banner.title || ''}
                focalX={banner.focalX}
                focalY={banner.focalY}
              />
            </div>
          )}
          <div className="min-w-0 space-y-0.5">
            {banner.title && (
              <h3 className="font-bold text-sm sm:text-base leading-snug">
                {banner.title}
              </h3>
            )}
            {banner.subtitle && (
              <p
                className={`text-xs sm:text-sm line-clamp-2 ${
                  isDark ? 'text-line' : 'text-muted'
                }`}
              >
                {banner.subtitle}
              </p>
            )}
          </div>
        </div>

        {isTargetValid && (ctaLabel || targetType !== 'none') && (
          <span
            style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shrink-0"
          >
            <span>{ctaLabel || 'Conferir'}</span>
            <ArrowRight size={14} />
          </span>
        )}
      </div>
    );
  }

  // 2. Formato Imagem com texto ao lado (`side_by_side`)
  if (format === 'side_by_side') {
    const mediaHeightClass =
      height === 'sm'
        ? 'aspect-[16/9] sm:aspect-[16/8] max-h-[220px]'
        : height === 'lg'
          ? 'aspect-[4/3] sm:aspect-[16/10] max-h-[380px]'
          : 'aspect-[16/10] max-h-[300px]';

    return (
      <div
        className={`rounded-2xl sm:rounded-3xl border overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch ${
          isDark
            ? 'bg-ink border-muted/40 text-on-brand'
            : 'bg-surface border-line text-ink'
        }`}
      >
        <div className="md:col-span-6 p-5 sm:p-7 lg:p-9 flex flex-col justify-center gap-3 order-2 md:order-1">
          {banner.badgeLabel && (
            <span className="self-start px-2.5 py-0.5 rounded-lg bg-support text-brand text-[11px] font-semibold">
              {banner.badgeLabel}
            </span>
          )}
          {banner.title && (
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight leading-snug">
              {banner.title}
            </h3>
          )}
          {banner.subtitle && (
            <p
              className={`text-xs sm:text-sm leading-relaxed ${
                isDark ? 'text-line' : 'text-muted'
              }`}
            >
              {banner.subtitle}
            </p>
          )}
          {isTargetValid && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleClick}
                style={{
                  backgroundColor: 'var(--sf-primary)',
                  color: '#FFFFFF',
                }}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer hover:opacity-95 transition"
              >
                <span>{ctaLabel || 'Conferir seleção'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        <div
          onClick={isTargetValid ? handleClick : undefined}
          className={`md:col-span-6 w-full ${mediaHeightClass} md:max-h-none md:min-h-[240px] order-1 md:order-2 ${
            isTargetValid ? 'cursor-pointer' : ''
          }`}
        >
          <StorefrontCampaignVisual
            imageUrl={banner.imageUrl}
            mobileImageUrl={banner.mobileImageUrl}
            alt={banner.title || ''}
            focalX={banner.focalX}
            focalY={banner.focalY}
            emptyLabel="Adicione uma imagem para o banner"
          />
        </div>
      </div>
    );
  }

  // 3. Formato Campanha (`campaign`) com recorte intencional e ponto focal
  const campaignHeightClass =
    height === 'sm'
      ? 'min-h-[210px] sm:min-h-[260px]'
      : height === 'lg'
        ? 'min-h-[300px] sm:min-h-[420px]'
        : 'min-h-[250px] sm:min-h-[330px]';

  return (
    <div
      onClick={isTargetValid ? handleClick : undefined}
      role={isTargetValid ? 'button' : undefined}
      tabIndex={isTargetValid ? 0 : undefined}
      onKeyDown={
        isTargetValid
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      className={`relative rounded-2xl sm:rounded-3xl border overflow-hidden ${campaignHeightClass} flex items-end ${
        isDark ? 'border-muted/40 bg-ink' : 'border-line bg-page'
      } ${isTargetValid ? 'cursor-pointer group/campaign' : ''}`}
    >
      <div className="absolute inset-0">
        <StorefrontCampaignVisual
          imageUrl={banner.imageUrl}
          mobileImageUrl={banner.mobileImageUrl}
          alt={banner.title || ''}
          focalX={banner.focalX}
          focalY={banner.focalY}
          imgClassName={
            isTargetValid ? 'group-hover/campaign:scale-[1.02]' : ''
          }
          emptyLabel="Imagem de campanha"
        />
        {hasImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent"
          />
        )}
      </div>

      {(banner.title || banner.subtitle || (isTargetValid && ctaLabel)) && (
        <div
          className={`relative z-10 w-full p-5 sm:p-7 lg:p-9 flex flex-col sm:flex-row sm:items-end justify-between gap-4 ${
            hasImage ? 'text-on-brand' : 'text-ink'
          }`}
        >
          <div className="max-w-xl space-y-1.5">
            {banner.title && (
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
                {banner.title}
              </h3>
            )}
            {banner.subtitle && (
              <p
                className={`text-xs sm:text-sm leading-relaxed ${
                  hasImage ? 'text-on-brand/90' : 'text-muted'
                }`}
              >
                {banner.subtitle}
              </p>
            )}
          </div>

          {isTargetValid && (
            <span className="self-start sm:self-end inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-surface text-ink text-xs sm:text-sm font-semibold shrink-0">
              <span>{ctaLabel || 'Explorar'}</span>
              <ArrowRight size={14} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Seção curada de Seleção de Produtos (`product_selection` ou `featured`):
 * - Pode repetir várias vezes na mesma página com ID estável, título e lista manual ou coleção.
 * - Apresentação em Grade (`grid`) ou Carrossel (`carousel`).
 * - Carrossel com setas estáveis no desktop (desabilitam nos limites), navegação por teclado,
 *   rolagem por toque com `scroll-snap` no celular e avanço automático desativado por padrão.
 * - Botão "Ver seleção completa" quando há mais itens do que os apresentados de imediato.
 */
export function StorefrontProductSelectionSection({
  section,
  resolvedProducts,
  template = 'editorial_roxo',
  onSelectProduct,
  onQuickAdd,
  onOpenQuickVariant,
  onViewFullSelection,
}: {
  section: any;
  resolvedProducts: any[];
  template?: string;
  onSelectProduct: (slug: string, seed?: any) => void;
  onQuickAdd?: (product: any, variant: any, source?: AddSourceRect) => void;
  onOpenQuickVariant?: (product: any, initialSize?: string | null) => void;
  onViewFullSelection?: () => void;
}) {
  const win = useStorefrontWindow();
  const prefersReducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const isDark = template === 'vitrine_escura';
  const isMinimal = template === 'minimal_branco';
  const presentation: 'grid' | 'carousel' =
    section?.presentation === 'carousel' ? 'carousel' : 'grid';

  const defaultCols = isMinimal ? 3 : 4;
  const columnsDesktop = Math.max(
    2,
    Math.min(4, Number(section?.columnsDesktop || defaultCols)),
  );
  const configuredLimit = Number(section?.visibleCount || section?.limit || 0);
  const visibleLimit =
    configuredLimit > 0
      ? configuredLimit
      : presentation === 'carousel'
        ? 12
        : 8;

  const presentedProducts = useMemo(
    () => resolvedProducts.slice(0, visibleLimit),
    [resolvedProducts, visibleLimit],
  );

  const visibleAtOnce =
    presentation === 'carousel'
      ? Math.min(presentedProducts.length, columnsDesktop)
      : presentedProducts.length;

  const hasMoreThanPresented =
    Boolean(onViewFullSelection) &&
    (resolvedProducts.length > presentedProducts.length ||
      (presentation === 'carousel' &&
        presentedProducts.length > columnsDesktop));

  const updateScrollBounds = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    if (presentation !== 'carousel') return;
    updateScrollBounds();
    const el = trackRef.current;
    if (!el) return;

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateScrollBounds())
        : null;
    ro?.observe(el);
    win?.addEventListener('resize', updateScrollBounds);

    return () => {
      ro?.disconnect();
      win?.removeEventListener('resize', updateScrollBounds);
    };
  }, [presentation, presentedProducts.length, columnsDesktop, updateScrollBounds, win]);

  const scrollCarousel = useCallback((direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(240, Math.round(el.clientWidth * 0.82));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  // Avanço automático desativado por padrão (`autoPlay === true` explícito apenas)
  const autoPlayEnabled = Boolean(section?.autoPlay === true);
  useEffect(() => {
    if (
      presentation !== 'carousel' ||
      !autoPlayEnabled ||
      prefersReducedMotion ||
      isPaused ||
      presentedProducts.length <= columnsDesktop
    ) {
      return;
    }
    const id = window.setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll - el.scrollLeft <= 8) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        scrollCarousel(1);
      }
    }, 5200);
    return () => window.clearInterval(id);
  }, [
    presentation,
    autoPlayEnabled,
    prefersReducedMotion,
    isPaused,
    presentedProducts.length,
    columnsDesktop,
    scrollCarousel,
  ]);

  if (presentedProducts.length === 0) return null;

  const gridColsClass =
    columnsDesktop === 2
      ? 'grid-cols-2 sm:grid-cols-2'
      : columnsDesktop === 3
        ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  const slideWidthClass =
    columnsDesktop === 2
      ? 'w-[78%] sm:w-[calc(50%-8px)] lg:w-[calc(50%-10px)]'
      : columnsDesktop === 3
        ? 'w-[76%] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-13.34px)]'
        : 'w-[74%] sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-15px)]';

  const sectionTitle =
    section?.title ||
    (section?.type === 'featured'
      ? 'Seleção em destaque'
      : 'Seleção da loja');

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={`font-bold tracking-tight flex items-center gap-2 ${
              isMinimal
                ? 'text-lg sm:text-xl lg:text-2xl font-semibold'
                : 'text-base sm:text-lg lg:text-xl'
            }`}
          >
            {!isMinimal && (
              <Sparkles size={16} className="text-brand shrink-0" />
            )}
            <span className="truncate">{sectionTitle}</span>
          </h3>
          {section?.subtitle && (
            <p
              className={`text-xs sm:text-sm mt-0.5 ${
                isDark ? 'text-line' : 'text-muted'
              }`}
            >
              {section.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasMoreThanPresented && onViewFullSelection && (
            <button
              type="button"
              onClick={onViewFullSelection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand hover:bg-support/60 border border-line transition cursor-pointer"
            >
              <span>Ver seleção completa ({resolvedProducts.length})</span>
              <ArrowRight size={13} />
            </button>
          )}

          {/* Setas estáveis do carrossel no desktop: mantêm lugar fixo e desabilitam no limite */}
          {presentation === 'carousel' && (
            <div className="hidden sm:inline-flex items-center gap-1.5">
              <button
                type="button"
                aria-label={`Anterior em ${sectionTitle}`}
                disabled={!canScrollLeft}
                onClick={() => scrollCarousel(-1)}
                className={`w-9 h-9 rounded-xl border inline-flex items-center justify-center transition ${
                  isDark
                    ? 'bg-ink border-muted/50 text-on-brand hover:border-brand disabled:opacity-35 disabled:hover:border-muted/50'
                    : 'bg-surface border-line text-ink hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-line disabled:hover:text-ink'
                }`}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label={`Próximo em ${sectionTitle}`}
                disabled={!canScrollRight}
                onClick={() => scrollCarousel(1)}
                className={`w-9 h-9 rounded-xl border inline-flex items-center justify-center transition ${
                  isDark
                    ? 'bg-ink border-muted/50 text-on-brand hover:border-brand disabled:opacity-35 disabled:hover:border-muted/50'
                    : 'bg-surface border-line text-ink hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-line disabled:hover:text-ink'
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {presentation === 'carousel' ? (
        <div
          ref={trackRef}
          role="region"
          aria-roledescription="carousel"
          aria-label={`${sectionTitle} (${presentedProducts.length} itens, ${visibleAtOnce} visíveis por vez)`}
          tabIndex={0}
          onScroll={updateScrollBounds}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              scrollCarousel(-1);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              scrollCarousel(1);
            } else if (e.key === 'Home') {
              e.preventDefault();
              trackRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
            } else if (e.key === 'End') {
              e.preventDefault();
              if (trackRef.current) {
                trackRef.current.scrollTo({
                  left: trackRef.current.scrollWidth,
                  behavior: 'smooth',
                });
              }
            }
          }}
          className="flex gap-3 sm:gap-4 lg:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pt-0.5 focus-visible:outline-2 focus-visible:outline-brand rounded-2xl"
        >
          {presentedProducts.map((prod: any, idx: number) => (
            <div
              key={prod.id || prod.retailGroupId || idx}
              className={`snap-start shrink-0 ${slideWidthClass}`}
            >
              <StorefrontProductCard
                product={prod}
                index={idx}
                isDark={isDark}
                template={template}
                onSelect={() => onSelectProduct(prod.slug, prod)}
                onQuickAdd={onQuickAdd}
                onOpenQuickVariant={onOpenQuickVariant}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`grid ${gridColsClass} ${
            isMinimal ? 'gap-5 sm:gap-7' : 'gap-3 sm:gap-4 lg:gap-5'
          }`}
        >
          {presentedProducts.map((prod: any, idx: number) => (
            <StorefrontProductCard
              key={prod.id || prod.retailGroupId || idx}
              product={prod}
              index={idx}
              isDark={isDark}
              template={template}
              onSelect={() => onSelectProduct(prod.slug, prod)}
              onQuickAdd={onQuickAdd}
              onOpenQuickVariant={onOpenQuickVariant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LookPieceSelection {
  selected: boolean;
  size: string | null;
  color: string | null;
  quantity: number;
}

/**
 * Componente "Monte o look":
 * Permite escolher cor, tamanho e quantidade por peça respeitando o saldo disponível
 * de cada variante, e adicionar algumas peças ou todas as disponíveis à sacola.
 */
export function StorefrontShopTheLook({
  look,
  pieces,
  template = 'editorial_roxo',
  sectionTitle,
  sectionSubtitle,
  onSelectProduct,
  onAddLookItems,
  onOpenCollectionPage,
}: {
  look: any;
  pieces: any[];
  template?: string;
  sectionTitle?: string;
  sectionSubtitle?: string;
  onSelectProduct: (slug: string, seed?: any) => void;
  onAddLookItems: (
    entries: Array<{ product: any; variant: any; quantity: number }>,
  ) => void;
  onOpenCollectionPage?: () => void;
}) {
  const isDark = template === 'vitrine_escura';
  const [justAddedBundle, setJustAddedBundle] = useState(false);

  const buildInitialMap = useCallback((list: any[]) => {
    const next: Record<string, LookPieceSelection> = {};
    for (const prod of list) {
      const pid = String(prod.id || prod.retailGroupId);
      const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
      const firstAvail =
        variants.find(
          (v) => v && v.inStock && Number(v.availableStock ?? 0) > 0,
        ) ||
        variants[0] ||
        null;
      const hasAvail = Boolean(
        firstAvail &&
          firstAvail.inStock &&
          Number(firstAvail.availableStock ?? 0) > 0,
      );
      next[pid] = {
        selected: hasAvail,
        size: firstAvail?.size || prod.sizes?.[0] || null,
        color: firstAvail?.color || prod.colors?.[0] || null,
        quantity: 1,
      };
    }
    return next;
  }, []);

  const [pieceSelections, setPieceSelections] = useState<
    Record<string, LookPieceSelection>
  >(() => buildInitialMap(pieces));

  useEffect(() => {
    setPieceSelections((prev) => {
      const defaults = buildInitialMap(pieces);
      const merged: Record<string, LookPieceSelection> = {};
      for (const prod of pieces) {
        const pid = String(prod.id || prod.retailGroupId);
        merged[pid] = prev[pid] || defaults[pid];
      }
      return merged;
    });
  }, [pieces, buildInitialMap]);

  const resolvePieceVariant = useCallback(
    (prod: any, sel?: LookPieceSelection) => {
      const variants: any[] = Array.isArray(prod.variants) ? prod.variants : [];
      if (!variants.length) return null;
      const sizes: string[] = prod.sizes || [];
      const colors: string[] = prod.colors || [];
      const size = sel?.size ?? null;
      const color = sel?.color ?? null;
      return (
        variants.find(
          (v) =>
            (sizes.length === 0 || v.size === size) &&
            (colors.length === 0 || v.color === color),
        ) ||
        variants.find((v) => v.size === size && v.inStock) ||
        variants.find((v) => v.inStock) ||
        variants[0]
      );
    },
    [],
  );

  const resolvedRows = useMemo(() => {
    return pieces.map((prod) => {
      const pid = String(prod.id || prod.retailGroupId);
      const sel = pieceSelections[pid] || {
        selected: false,
        size: null,
        color: null,
        quantity: 1,
      };
      const variant = resolvePieceVariant(prod, sel);
      const availStock = Number(variant?.availableStock ?? 0);
      const variantAvailable = Boolean(variant?.inStock && availStock > 0);
      const safeQty = variantAvailable
        ? Math.max(1, Math.min(availStock, Number(sel.quantity || 1)))
        : 1;
      const unitPrice = Number(
        variant?.priceSell ?? prod.priceSell ?? prod.price ?? 0,
      );
      return {
        pid,
        prod,
        sel,
        variant,
        availStock,
        variantAvailable,
        safeQty,
        unitPrice,
      };
    });
  }, [pieces, pieceSelections, resolvePieceVariant]);

  const availableRowsCount = resolvedRows.filter((r) => r.variantAvailable).length;
  const selectedValidRows = resolvedRows.filter(
    (r) => r.sel.selected && r.variantAvailable && r.variant,
  );
  const selectedTotal = selectedValidRows.reduce(
    (sum, r) => sum + r.unitPrice * r.safeQty,
    0,
  );

  if (pieces.length === 0) return null;

  const title = sectionTitle || look?.title || 'Monte o look';
  const subtitle =
    sectionSubtitle ||
    look?.subtitle ||
    look?.description ||
    'Escolha tamanho, cor e quantidade de cada peça e leve o conjunto completo ou apenas seus itens preferidos.';

  const handleSelectAllAvailable = () => {
    const allSelected = selectedValidRows.length === availableRowsCount && availableRowsCount > 0;
    setPieceSelections((prev) => {
      const next = { ...prev };
      for (const r of resolvedRows) {
        next[r.pid] = {
          ...r.sel,
          selected: allSelected ? false : r.variantAvailable,
        };
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (selectedValidRows.length === 0) return;
    onAddLookItems(
      selectedValidRows.map((r) => ({
        product: r.prod,
        variant: r.variant,
        quantity: r.safeQty,
      })),
    );
    setJustAddedBundle(true);
    window.setTimeout(() => setJustAddedBundle(false), 1400);
  };

  return (
    <div
      className={`rounded-3xl border p-4 sm:p-6 lg:p-8 space-y-5 ${
        isDark
          ? 'bg-ink border-muted/40 text-on-brand'
          : 'bg-surface border-line text-ink'
      }`}
    >
      {/* Cabeçalho do Look */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 pb-4">
        <div className="space-y-1 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
            <Layers size={13} />
            <span>Monte o look</span>
          </span>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p
              className={`text-xs sm:text-sm leading-relaxed ${
                isDark ? 'text-line' : 'text-muted'
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {availableRowsCount > 0 && (
            <button
              type="button"
              onClick={handleSelectAllAvailable}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                isDark
                  ? 'border-muted/50 bg-ink text-on-brand hover:border-brand'
                  : 'border-line bg-page text-ink hover:border-brand'
              }`}
            >
              {selectedValidRows.length === availableRowsCount
                ? 'Desmarcar todas'
                : 'Selecionar todas disponíveis'}
            </button>
          )}
          {onOpenCollectionPage && (
            <button
              type="button"
              onClick={onOpenCollectionPage}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand hover:bg-support/60 border border-line cursor-pointer"
            >
              <span>Página do look</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Composição: Visual editorial do Look + Lista interativa de peças */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-start">
        <div className="lg:col-span-5 space-y-3">
          {look?.coverUrl ? (
            <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-line bg-page">
              <StorefrontCampaignVisual
                imageUrl={look.coverUrl}
                alt={title}
                focalX={look.focalX}
                focalY={look.focalY}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl border border-line bg-page">
              {resolvedRows.slice(0, 4).map((r) => (
                <StorefrontProductFrame
                  key={r.pid}
                  imageUrl={r.prod.imageUrl}
                  alt={r.prod.title}
                  productName={r.prod.title}
                  padding="sm"
                  aspectClassName="aspect-[4/5]"
                  roundedClassName="rounded-xl"
                  className="bg-surface"
                  onClick={() => onSelectProduct(r.prod.slug, r.prod)}
                />
              ))}
            </div>
          )}

          {/* Resumo da compra combinada */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-ink border-muted/45' : 'bg-page border-line'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-muted">
                {selectedValidRows.length} de {pieces.length}{' '}
                {pieces.length === 1 ? 'peça selecionada' : 'peças selecionadas'}
              </span>
              <span className="text-lg sm:text-xl font-bold text-brand tabular-nums">
                {formatBrl(selectedTotal)}
              </span>
            </div>

            <button
              type="button"
              disabled={selectedValidRows.length === 0}
              onClick={handleAddSelected}
              style={
                selectedValidRows.length > 0 && !justAddedBundle
                  ? { backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }
                  : undefined
              }
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
                justAddedBundle
                  ? 'bg-support text-brand border border-brand'
                  : selectedValidRows.length > 0
                    ? 'cursor-pointer hover:opacity-95'
                    : 'bg-surface text-muted border border-line opacity-60 cursor-not-allowed'
              }`}
            >
              {justAddedBundle ? (
                <>
                  <Check size={16} />
                  <span>Peças adicionadas à sacola!</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  <span>
                    {selectedValidRows.length > 0
                      ? `Adicionar ${selectedValidRows.length} ${
                          selectedValidRows.length === 1 ? 'peça' : 'peças'
                        } à sacola`
                      : 'Selecione ao menos uma peça disponível'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Lista de peças com escolha individual de tamanho, cor e quantidade */}
        <div className="lg:col-span-7 space-y-3 min-w-0">
          {resolvedRows.map((row) => {
            const {
              pid,
              prod,
              sel,
              variant,
              availStock,
              variantAvailable,
              safeQty,
              unitPrice,
            } = row;
            const sizes: string[] = prod.sizes || [];
            const colors: string[] = prod.colors || [];
            const variants: any[] = prod.variants || [];
            const prodHasAnyStock = Number(
              prod.totalAvailableStock ?? prod.availableStock ?? 0,
            ) > 0;

            return (
              <div
                key={pid}
                className={`p-3.5 sm:p-4 rounded-2xl border transition ${
                  sel.selected && variantAvailable
                    ? isDark
                      ? 'border-brand bg-ink'
                      : 'border-brand/70 bg-surface'
                    : isDark
                      ? 'border-muted/35 bg-ink/80'
                      : 'border-line bg-page/65'
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-3.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={Boolean(sel.selected && variantAvailable)}
                    aria-label={`Incluir ${prod.title} no look`}
                    disabled={!prodHasAnyStock}
                    onClick={() =>
                      setPieceSelections((prev) => ({
                        ...prev,
                        [pid]: { ...sel, selected: !sel.selected },
                      }))
                    }
                    className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      sel.selected && variantAvailable
                        ? 'bg-brand border-brand text-on-brand'
                        : 'bg-surface border-line text-transparent'
                    }`}
                  >
                    <Check size={13} />
                  </button>

                  <StorefrontProductFrame
                    imageUrl={prod.imageUrl}
                    alt={prod.title}
                    productName={prod.title}
                    padding="xs"
                    aspectClassName="w-16 h-20 sm:w-20 sm:h-24 shrink-0"
                    roundedClassName="rounded-xl"
                    onClick={() => onSelectProduct(prod.slug, prod)}
                  />

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(prod.slug, prod)}
                          className="font-semibold text-xs sm:text-sm hover:text-brand text-left line-clamp-2 cursor-pointer"
                        >
                          {prod.title}
                        </button>
                        <p className="text-sm font-bold text-brand tabular-nums mt-0.5">
                          {formatBrl(unitPrice)}
                        </p>
                      </div>

                      {!prodHasAnyStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-page border border-line text-[11px] font-semibold text-muted">
                          <AlertCircle size={12} className="text-brand" />
                          <span>Esgotada</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!variantAvailable || !variant}
                          onClick={() => {
                            if (!variant || !variantAvailable) return;
                            onAddLookItems([
                              { product: prod, variant, quantity: safeQty },
                            ]);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-support text-brand hover:bg-brand hover:text-on-brand text-[11px] font-semibold transition cursor-pointer disabled:opacity-40"
                        >
                          + Só esta
                        </button>
                      )}
                    </div>

                    {/* Seletores compactos de Tamanho e Cor */}
                    {prodHasAnyStock && (sizes.length > 0 || colors.length > 0) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
                        {sizes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-semibold uppercase text-muted mr-0.5">
                              Tam:
                            </span>
                            {sizes.map((sz) => {
                              const szAvail = variants.some(
                                (v) =>
                                  v.size === sz &&
                                  v.inStock &&
                                  Number(v.availableStock ?? 0) > 0,
                              );
                              const active = sel.size === sz;
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => {
                                    const matchCurrentColor = variants.find(
                                      (v) =>
                                        v.size === sz &&
                                        v.color === sel.color &&
                                        v.inStock,
                                    );
                                    const fallbackColor = !matchCurrentColor
                                      ? variants.find(
                                          (v) => v.size === sz && v.inStock,
                                        )?.color ?? sel.color
                                      : sel.color;
                                    setPieceSelections((prev) => ({
                                      ...prev,
                                      [pid]: {
                                        ...sel,
                                        selected: true,
                                        size: sz,
                                        color: fallbackColor,
                                      },
                                    }));
                                  }}
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer transition ${
                                    active
                                      ? 'bg-brand text-on-brand border-brand'
                                      : szAvail
                                        ? isDark
                                          ? 'bg-ink border-muted/50 text-on-brand hover:border-brand'
                                          : 'bg-surface border-line text-ink hover:border-brand'
                                        : 'bg-page border-line text-muted opacity-40 line-through'
                                  }`}
                                >
                                  {sz}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {colors.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-semibold uppercase text-muted mr-0.5">
                              Cor:
                            </span>
                            {colors.map((cl) => {
                              const clAvail = variants.some(
                                (v) =>
                                  (sizes.length === 0 || v.size === sel.size) &&
                                  v.color === cl &&
                                  v.inStock &&
                                  Number(v.availableStock ?? 0) > 0,
                              );
                              const active = sel.color === cl;
                              return (
                                <button
                                  key={cl}
                                  type="button"
                                  onClick={() =>
                                    setPieceSelections((prev) => ({
                                      ...prev,
                                      [pid]: {
                                        ...sel,
                                        selected: true,
                                        color: cl,
                                      },
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer transition ${
                                    active
                                      ? 'bg-brand text-on-brand border-brand'
                                      : clAvail
                                        ? isDark
                                          ? 'bg-ink border-muted/50 text-on-brand hover:border-brand'
                                          : 'bg-surface border-line text-ink hover:border-brand'
                                        : 'bg-page border-line text-muted opacity-40 line-through'
                                  }`}
                                >
                                  {cl}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quantidade por peça e aviso de disponibilidade */}
                    {prodHasAnyStock && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-muted">
                          {variantAvailable
                            ? availStock <= 4
                              ? `Disponível (${availStock} un. nesta opção)`
                              : 'Em estoque'
                            : 'Combinação sem saldo — troque tamanho ou cor'}
                        </span>

                        {variantAvailable && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label="Diminuir quantidade da peça"
                              disabled={safeQty <= 1}
                              onClick={() =>
                                setPieceSelections((prev) => ({
                                  ...prev,
                                  [pid]: {
                                    ...sel,
                                    quantity: Math.max(1, safeQty - 1),
                                  },
                                }))
                              }
                              className="w-6 h-6 rounded-md border border-line bg-surface text-ink flex items-center justify-center disabled:opacity-35 cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-5 text-center text-xs font-bold tabular-nums">
                              {safeQty}
                            </span>
                            <button
                              type="button"
                              aria-label="Aumentar quantidade da peça"
                              disabled={safeQty >= availStock}
                              onClick={() =>
                                setPieceSelections((prev) => ({
                                  ...prev,
                                  [pid]: {
                                    ...sel,
                                    quantity: Math.min(availStock, safeQty + 1),
                                  },
                                }))
                              }
                              className="w-6 h-6 rounded-md border border-line bg-surface text-ink flex items-center justify-center disabled:opacity-35 cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
