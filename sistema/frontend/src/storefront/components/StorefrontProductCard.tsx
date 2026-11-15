import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { getFullUrl } from '@/lib/getFullUrl';
import { CategoryIconIllustration } from '@/components/CategoryIcons';
import {
  SF_EASE_OUT,
  SF_SPRING_PILL,
  SF_SPRING_SHEET,
  SF_SPRING_SNAPPY,
  useBodyScrollLock,
  useIsMobileViewport,
} from '../storefront-motion';

const formatBrl = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export interface AddSourceRect {
  x: number;
  y: number;
}

export function StorefrontProductCard({
  product,
  index = 0,
  isDark = false,
  onSelect,
  onQuickAdd,
  onOpenQuickVariant,
}: {
  product: any;
  index?: number;
  isDark?: boolean;
  onSelect: () => void;
  onQuickAdd?: (product: any, variant: any, source?: AddSourceRect) => void;
  onOpenQuickVariant?: (product: any, initialSize?: string | null) => void;
}) {
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const [primaryLoaded, setPrimaryLoaded] = useState(false);
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    setPrimaryLoaded(false);
    setPrimaryFailed(false);
  }, [product.imageUrl]);

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 1150);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const totalAvailable = Number(
    product.totalAvailableStock ?? product.availableStock ?? 0,
  );
  const inStock =
    product.inStock !== undefined
      ? Boolean(product.inStock && totalAvailable > 0)
      : totalAvailable > 0;
  const unitPrice = Number(
    product.priceSell ?? product.price ?? product.priceSale ?? 0,
  );
  const categoryLabel = product.categoryName || product.category?.name || '';

  const availableVariants = useMemo(
    () =>
      Array.isArray(product.variants)
        ? product.variants.filter(
            (v: any) => v && v.inStock !== false && Number(v.availableStock ?? 0) > 0,
          )
        : [],
    [product.variants],
  );

  const singleVariant =
    Array.isArray(product.variants) && product.variants.length === 1
      ? product.variants[0]
      : null;

  const secondaryImageUrl = useMemo(() => {
    const gallery = Array.isArray(product.galleryUrls) ? product.galleryUrls : [];
    const alt = gallery.find((u: string) => u && u !== product.imageUrl);
    return alt || null;
  }, [product.galleryUrls, product.imageUrl]);

  const captureSourceCoords = (fallbackEl?: HTMLElement | null): AddSourceRect => {
    const target = mediaRef.current || fallbackEl;
    if (target) {
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
    }
    return {
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 200,
    };
  };

  const hasPhoto = Boolean(product.imageUrl && !primaryFailed);

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        delay: Math.min(index * 0.022, 0.16),
        ease: SF_EASE_OUT,
      }}
      className={`group/card rounded-2xl sm:rounded-3xl border overflow-hidden flex flex-col transition-all duration-300 sm:hover:-translate-y-0.5 ${
        isDark
          ? 'bg-ink border-muted/40 text-on-brand hover:border-brand'
          : 'bg-surface border-line text-ink hover:border-brand/70 shadow-2xs hover:shadow-md'
      }`}
    >
      {/* Área visual 4:5 editorial */}
      <div
        ref={mediaRef}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`relative aspect-[4/5] cursor-pointer overflow-hidden flex items-center justify-center ${
          isDark ? 'bg-ink' : 'bg-page'
        }`}
      >
        {hasPhoto ? (
          <>
            {!primaryLoaded && (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-support/45 animate-pulse"
              />
            )}
            <img
              src={getFullUrl(product.imageUrl)}
              alt={product.title}
              loading="lazy"
              onLoad={() => setPrimaryLoaded(true)}
              onError={() => setPrimaryFailed(true)}
              className={`w-full h-full object-cover transition-all duration-500 ease-out group-hover/card:scale-[1.04] ${
                primaryLoaded ? 'opacity-100' : 'opacity-0'
              } ${secondaryImageUrl ? 'sm:group-hover/card:opacity-0' : ''}`}
            />
            {secondaryImageUrl && (
              <img
                src={getFullUrl(secondaryImageUrl)}
                alt=""
                loading="lazy"
                aria-hidden="true"
                className="hidden sm:block absolute inset-0 w-full h-full object-cover opacity-0 group-hover/card:opacity-100 group-hover/card:scale-[1.04] transition-all duration-500 ease-out"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full transition-transform duration-300 group-hover/card:scale-[1.03]">
            <CategoryIconIllustration
              categoryId={product.categoryId}
              categoryName={categoryLabel}
              productName={product.title}
            />
          </div>
        )}

        {/* Selo promocional */}
        {product.badgeLabel && (
          <span
            style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
            className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold tracking-wide shadow-xs inline-flex items-center gap-1"
          >
            <Sparkles size={10} />
            <span>{product.badgeLabel}</span>
          </span>
        )}

        {/* Indicador discreto de múltiplas fotos */}
        {Array.isArray(product.galleryUrls) && product.galleryUrls.length > 1 && (
          <span className="hidden sm:inline-flex absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface/90 text-ink border border-line/70 backdrop-blur-xs opacity-0 group-hover/card:opacity-100 transition-opacity">
            +{product.galleryUrls.length - 1} foto
            {product.galleryUrls.length > 2 ? 's' : ''}
          </span>
        )}

        {/* Estado esgotado claro com ícone + texto */}
        {!inStock && (
          <span className="absolute inset-x-2.5 bottom-2.5 py-1.5 px-3 rounded-xl text-[11px] font-bold bg-surface/95 text-muted border border-line text-center inline-flex items-center justify-center gap-1.5 backdrop-blur-xs shadow-xs">
            <AlertCircle size={12} className="text-brand shrink-0" />
            <span>Esgotado</span>
          </span>
        )}
      </div>

      {/* Corpo do card */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
        <div className="space-y-1.5">
          <div onClick={onSelect} className="cursor-pointer space-y-0.5">
            {categoryLabel && (
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted truncate">
                {categoryLabel}
              </p>
            )}
            <h4 className="font-bold text-xs sm:text-sm leading-snug line-clamp-2 group-hover/card:text-brand transition-colors">
              {product.title}
            </h4>
          </div>

          {/* Pílulas interativas de tamanho */}
          {product.sizes?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {product.sizes.slice(0, 5).map((sz: string) => {
                const sizeAvailable =
                  availableVariants.length === 0 ||
                  availableVariants.some((v: any) => v.size === sz);
                const canQuickPick = Boolean(inStock && onOpenQuickVariant && !singleVariant);

                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canQuickPick && sizeAvailable) {
                        onOpenQuickVariant?.(product, sz);
                      } else {
                        onSelect();
                      }
                    }}
                    title={
                      canQuickPick && sizeAvailable
                        ? `Escolher tamanho ${sz}`
                        : `Ver tamanho ${sz}`
                    }
                    className={`text-[10px] px-1.5 py-0.5 rounded-lg border font-bold transition cursor-pointer ${
                      !sizeAvailable
                        ? 'opacity-40 line-through border-line text-muted bg-page'
                        : isDark
                          ? 'bg-ink border-muted/50 text-line hover:border-brand hover:text-on-brand'
                          : 'bg-page border-line text-muted hover:border-brand hover:text-brand hover:bg-support/50'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
              {product.sizes.length > 5 && (
                <span className="text-[10px] px-1 py-0.5 text-muted font-bold">
                  +{product.sizes.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de preço e ação rápida */}
        <div
          className={`pt-2.5 border-t flex items-center justify-between gap-2 ${
            isDark ? 'border-muted/30' : 'border-line'
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-extrabold text-brand truncate">
              {formatBrl(unitPrice)}
            </p>
            <p className="text-[10px] text-muted font-semibold truncate">
              {!inStock
                ? 'Sem saldo livre'
                : totalAvailable <= 3
                  ? `Últimas ${totalAvailable} un.`
                  : 'Pronta entrega'}
            </p>
          </div>

          {inStock && singleVariant && onQuickAdd ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={(e) => {
                e.stopPropagation();
                const coords = captureSourceCoords(e.currentTarget);
                onQuickAdd(product, singleVariant, coords);
                setJustAdded(true);
              }}
              style={
                justAdded
                  ? undefined
                  : { backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }
              }
              className={`px-3 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition shadow-2xs ${
                justAdded
                  ? 'bg-support text-brand border border-brand'
                  : 'hover:opacity-95'
              }`}
            >
              {justAdded ? (
                <>
                  <Check size={13} />
                  <span>Na sacola</span>
                </>
              ) : (
                <>
                  <Plus size={13} />
                  <span>Sacola</span>
                </>
              )}
            </motion.button>
          ) : inStock && onOpenQuickVariant ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenQuickVariant(product, null);
              }}
              className="px-3 py-2 rounded-xl bg-support text-brand hover:bg-brand hover:text-on-brand text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <ShoppingBag size={13} />
              <span>Escolher</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={onSelect}
              className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0 ${
                inStock
                  ? 'bg-support text-brand hover:bg-brand hover:text-on-brand'
                  : 'bg-page text-muted border border-line hover:border-brand hover:text-ink'
              }`}
            >
              <span>{inStock ? 'Opções' : 'Ver'}</span>
              <ArrowUpRight size={12} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function QuickVariantModal({
  product,
  initialSize,
  open,
  isDark = false,
  onClose,
  onConfirmAdd,
  onOpenFullProduct,
}: {
  product: any | null;
  initialSize?: string | null;
  open: boolean;
  isDark?: boolean;
  onClose: () => void;
  onConfirmAdd: (
    product: any,
    variant: any,
    quantity: number,
    source?: AddSourceRect,
  ) => void;
  onOpenFullProduct: (slug: string) => void;
}) {
  const isMobile = useIsMobileViewport(640);
  useBodyScrollLock(open && Boolean(product));

  const variants: any[] = product?.variants || [];
  const sizes: string[] = product?.sizes || [];
  const colors: string[] = product?.colors || [];

  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const [chosenColor, setChosenColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product || !open) return;
    const preferredVariant =
      (initialSize
        ? variants.find((v) => v.size === initialSize && v.inStock)
        : null) ||
      variants.find((v) => v.inStock) ||
      variants[0] ||
      null;

    setChosenSize(initialSize || preferredVariant?.size || sizes[0] || null);
    setChosenColor(preferredVariant?.color || colors[0] || null);
    setQuantity(1);
  }, [product, open, initialSize]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;
    return (
      variants.find(
        (v) =>
          (sizes.length === 0 || v.size === chosenSize) &&
          (colors.length === 0 || v.color === chosenColor),
      ) ||
      variants.find((v) => v.size === chosenSize && v.inStock) ||
      variants.find((v) => v.size === chosenSize) ||
      variants[0]
    );
  }, [variants, sizes.length, colors.length, chosenSize, chosenColor]);

  const availableStock = Number(selectedVariant?.availableStock ?? 0);
  const variantInStock = Boolean(selectedVariant?.inStock && availableStock > 0);
  const unitPrice = Number(
    selectedVariant?.priceSell ?? product?.priceSell ?? product?.price ?? 0,
  );

  useEffect(() => {
    if (availableStock > 0 && quantity > availableStock) {
      setQuantity(availableStock);
    }
  }, [availableStock, quantity]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && product && (
        <div
          className={`fixed inset-0 z-[85] flex ${
            isMobile ? 'items-end' : 'items-center'
          } justify-center p-0 sm:p-4`}
          role="dialog"
          aria-modal="true"
          aria-label={`Escolher opções de ${product.title}`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/50 backdrop-blur-xs"
          />

          <motion.div
            initial={
              isMobile
                ? { y: '100%' }
                : { opacity: 0, scale: 0.95, y: 14 }
            }
            animate={
              isMobile
                ? { y: 0 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              isMobile
                ? { y: '100%' }
                : { opacity: 0, scale: 0.96, y: 10 }
            }
            transition={isMobile ? SF_SPRING_SHEET : SF_SPRING_SNAPPY}
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.45 }}
            onDragEnd={(_, info) => {
              if (isMobile && (info.offset.y > 90 || info.velocity.y > 420)) {
                onClose();
              }
            }}
            className={`relative z-10 w-full sm:max-w-lg max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl border ${
              isMobile ? 'rounded-t-3xl border-b-0' : 'rounded-3xl'
            } ${
              isDark
                ? 'bg-ink border-muted/50 text-on-brand'
                : 'bg-surface border-line text-ink'
            }`}
          >
            {isMobile && (
              <div className="pt-3 pb-1 flex justify-center shrink-0">
                <span className="w-10 h-1.5 rounded-full bg-line" />
              </div>
            )}

            {/* Cabeçalho com resumo da peça */}
            <div className="p-4 sm:p-5 border-b border-line/70 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-16 h-20 rounded-2xl overflow-hidden border border-line bg-page shrink-0">
                  {product.imageUrl ? (
                    <img
                      src={getFullUrl(product.imageUrl)}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <CategoryIconIllustration
                      categoryId={product.categoryId}
                      categoryName={product.categoryName}
                      productName={product.title}
                      compact
                    />
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  {product.categoryName && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand block truncate">
                      {product.categoryName}
                    </span>
                  )}
                  <h3 className="font-extrabold text-sm sm:text-base line-clamp-2 leading-snug">
                    {product.title}
                  </h3>
                  <p className="text-base sm:text-lg font-extrabold text-brand">
                    {formatBrl(unitPrice)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFullProduct(product.slug);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-muted hover:text-brand cursor-pointer pt-0.5"
                  >
                    <span>Ver detalhes completos</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar seleção rápida"
                className="p-2 rounded-xl bg-page text-muted hover:text-ink cursor-pointer shrink-0"
              >
                <X size={17} />
              </button>
            </div>

            {/* Seletores de Tamanho, Cor e Quantidade */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {sizes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold uppercase tracking-wider text-muted text-[11px]">
                      Tamanho
                    </span>
                    {chosenSize && (
                      <span className="font-bold text-brand">
                        Selecionado: {chosenSize}
                      </span>
                    )}
                  </div>
                  <LayoutGroup id="sf-quick-modal-sizes">
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((sz) => {
                        const hasStockForSize = variants.some(
                          (v) => v.size === sz && v.inStock && v.availableStock > 0,
                        );
                        const active = chosenSize === sz;
                        return (
                          <motion.button
                            key={sz}
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setChosenSize(sz);
                              const matchingColor = variants.find(
                                (v) =>
                                  v.size === sz &&
                                  v.color === chosenColor &&
                                  v.inStock,
                              );
                              if (!matchingColor) {
                                const firstAvail = variants.find(
                                  (v) => v.size === sz && v.inStock,
                                );
                                if (firstAvail?.color) {
                                  setChosenColor(firstAvail.color);
                                }
                              }
                            }}
                            className={`relative px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                              active
                                ? 'text-on-brand border-transparent'
                                : hasStockForSize
                                  ? isDark
                                    ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                                    : 'bg-page text-ink border-line hover:border-brand'
                                  : 'bg-page text-muted border-line opacity-45 line-through'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="sf-quick-size-pill"
                                transition={SF_SPRING_PILL}
                                style={{ backgroundColor: 'var(--sf-primary)' }}
                                className="absolute inset-0 rounded-xl shadow-2xs"
                              />
                            )}
                            <span className="relative z-10">{sz}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </LayoutGroup>
                </div>
              )}

              {colors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold uppercase tracking-wider text-muted text-[11px]">
                      Cor
                    </span>
                    {chosenColor && (
                      <span className="font-bold text-brand">
                        Selecionada: {chosenColor}
                      </span>
                    )}
                  </div>
                  <LayoutGroup id="sf-quick-modal-colors">
                    <div className="flex flex-wrap gap-2">
                      {colors.map((cl) => {
                        const matching = variants.find(
                          (v) =>
                            (sizes.length === 0 || v.size === chosenSize) &&
                            v.color === cl,
                        );
                        const available = Boolean(
                          matching?.inStock && Number(matching?.availableStock ?? 0) > 0,
                        );
                        const active = chosenColor === cl;
                        return (
                          <motion.button
                            key={cl}
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setChosenColor(cl)}
                            className={`relative px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                              active
                                ? 'text-on-brand border-transparent'
                                : available
                                  ? isDark
                                    ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                                    : 'bg-page text-ink border-line hover:border-brand'
                                  : 'bg-page text-muted border-line opacity-45 line-through'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="sf-quick-color-pill"
                                transition={SF_SPRING_PILL}
                                style={{ backgroundColor: 'var(--sf-primary)' }}
                                className="absolute inset-0 rounded-xl shadow-2xs"
                              />
                            )}
                            <span className="relative z-10">{cl}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </LayoutGroup>
                </div>
              )}

              {/* Quantidade + Estoque */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-ink border-muted/40'
                    : 'bg-page border-line'
                }`}
              >
                <div>
                  <p className="text-xs font-bold">
                    {variantInStock ? 'Pronta entrega' : 'Combinação sem saldo'}
                  </p>
                  <p className="text-[11px] text-muted">
                    {variantInStock
                      ? availableStock <= 5
                        ? `Restam ${availableStock} unidade(s) nesta opção`
                        : 'Disponível para reserva imediata'
                      : 'Escolha outro tamanho ou cor disponível'}
                  </p>
                </div>

                {variantInStock && (
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-xl bg-surface border border-line text-ink flex items-center justify-center hover:border-brand cursor-pointer"
                    >
                      <Minus size={14} />
                    </motion.button>
                    <span className="w-7 text-center font-extrabold text-sm">
                      {quantity}
                    </span>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() =>
                        setQuantity((q) => Math.min(availableStock, q + 1))
                      }
                      className="w-8 h-8 rounded-xl bg-surface border border-line text-ink flex items-center justify-center hover:border-brand cursor-pointer"
                    >
                      <Plus size={14} />
                    </motion.button>
                  </div>
                )}
              </div>
            </div>

            {/* Ação principal */}
            <div className="p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line/70">
              <motion.button
                type="button"
                whileTap={variantInStock ? { scale: 0.97 } : undefined}
                disabled={!variantInStock}
                onClick={(e) => {
                  if (!selectedVariant || !variantInStock) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  onConfirmAdd(product, selectedVariant, quantity, {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  });
                  onClose();
                }}
                style={
                  variantInStock
                    ? { backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }
                    : undefined
                }
                className={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-sm ${
                  variantInStock
                    ? 'cursor-pointer hover:opacity-95'
                    : 'bg-page text-muted border border-line opacity-60 cursor-not-allowed'
                }`}
              >
                <ShoppingBag size={16} />
                <span>
                  {variantInStock
                    ? `Adicionar à Sacola • ${formatBrl(unitPrice * quantity)}`
                    : 'Opção Indisponível'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function StorefrontGridSkeleton({
  count = 8,
  isDark = false,
}: {
  count?: number;
  isDark?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`rounded-2xl sm:rounded-3xl border overflow-hidden flex flex-col ${
            isDark ? 'bg-ink border-muted/40' : 'bg-surface border-line'
          }`}
        >
          <div className="aspect-[4/5] bg-support/45 animate-pulse" />
          <div className="p-3.5 space-y-2.5">
            <div className="h-2.5 w-16 rounded-full bg-page animate-pulse" />
            <div className="h-3.5 w-4/5 rounded-full bg-page animate-pulse" />
            <div className="pt-2 border-t border-line flex items-center justify-between">
              <div className="h-4 w-20 rounded-full bg-support/60 animate-pulse" />
              <div className="h-7 w-16 rounded-xl bg-page animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
