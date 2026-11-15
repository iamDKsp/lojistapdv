import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { CategoryIconBadge } from '@/components/CategoryIcons';
import {
  SF_EASE_OUT,
  SF_SPRING_PILL,
  SF_SPRING_SHEET,
  useBodyScrollLock,
  useStorefrontWindow,
} from '../storefront-motion';

export interface SelectPopoverOption {
  value: string;
  label: string;
}

export function CategoryTabsRail({
  categories,
  selectedCategoryId,
  onSelectCategory,
  title = 'Categorias',
  isDark = false,
  isMinimal = false,
  layoutScope = 'sf-public',
}: {
  categories: any[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  title?: string;
  isDark?: boolean;
  isMinimal?: boolean;
  layoutScope?: string;
}) {
  const win = useStorefrontWindow();
  const railRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dragState = useRef<{
    isDown: boolean;
    startX: number;
    scrollLeft: number;
    moved: boolean;
  }>({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    updateScrollEdges();
    const el = railRef.current;
    if (!el) return;

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateScrollEdges())
        : null;
    ro?.observe(el);
    win?.addEventListener('resize', updateScrollEdges);

    return () => {
      ro?.disconnect();
      win?.removeEventListener('resize', updateScrollEdges);
    };
  }, [categories.length, updateScrollEdges, win]);

  const centerPillInRail = useCallback((key: string) => {
    const rail = railRef.current;
    const btn = pillRefs.current[key];
    if (!rail || !btn) return;
    const targetLeft =
      btn.offsetLeft - rail.clientWidth / 2 + btn.offsetWidth / 2;
    rail.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    const key = selectedCategoryId || '__all__';
    const id = window.requestAnimationFrame(() => centerPillInRail(key));
    return () => window.cancelAnimationFrame(id);
  }, [selectedCategoryId, centerPillInRail]);

  const scrollByStep = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const distance = Math.max(220, Math.round(rail.clientWidth * 0.55));
    rail.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 min-h-[30px]">
        <h3
          className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
            isMinimal ? 'text-muted' : 'text-muted'
          }`}
        >
          <Layers size={13} className="text-brand shrink-0" />
          <span>{title || 'Categorias'}</span>
        </h3>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={!selectedCategoryId}
            onClick={() => onSelectCategory('')}
            className={`text-xs font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1 transition ${
              selectedCategoryId
                ? 'text-brand hover:bg-support/60 cursor-pointer'
                : 'text-muted opacity-45 cursor-default'
            }`}
          >
            <span>Ver todas</span>
            <X size={12} />
          </button>

          {/* Setas estáveis de trilho no desktop: sempre montadas no mesmo lugar, desabilitam no limite */}
          <div className="hidden sm:inline-flex items-center gap-1">
            <button
              type="button"
              aria-label="Rolar categorias para a esquerda"
              disabled={!canScrollLeft}
              onClick={() => scrollByStep(-1)}
              className={`w-7 h-7 rounded-lg border inline-flex items-center justify-center transition ${
                isDark
                  ? 'bg-ink border-muted/50 text-on-brand hover:border-brand disabled:opacity-35 disabled:hover:border-muted/50'
                  : 'bg-surface border-line text-ink hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-line disabled:hover:text-ink'
              }`}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Rolar categorias para a direita"
              disabled={!canScrollRight}
              onClick={() => scrollByStep(1)}
              className={`w-7 h-7 rounded-lg border inline-flex items-center justify-center transition ${
                isDark
                  ? 'bg-ink border-muted/50 text-on-brand hover:border-brand disabled:opacity-35 disabled:hover:border-muted/50'
                  : 'bg-surface border-line text-ink hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-line disabled:hover:text-ink'
              }`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <LayoutGroup id={`${layoutScope}-categories`}>
          <motion.div
            ref={railRef}
            layoutScroll
            onScroll={updateScrollEdges}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                scrollByStep(-1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                scrollByStep(1);
              }
            }}
            onMouseDown={(e) => {
              const rail = railRef.current;
              if (!rail) return;
              dragState.current = {
                isDown: true,
                startX: e.pageX - rail.offsetLeft,
                scrollLeft: rail.scrollLeft,
                moved: false,
              };
            }}
            onMouseLeave={() => {
              dragState.current.isDown = false;
            }}
            onMouseUp={() => {
              dragState.current.isDown = false;
            }}
            onMouseMove={(e) => {
              const rail = railRef.current;
              if (!rail || !dragState.current.isDown) return;
              const x = e.pageX - rail.offsetLeft;
              const walk = x - dragState.current.startX;
              if (Math.abs(walk) > 5) {
                dragState.current.moved = true;
                rail.scrollLeft = dragState.current.scrollLeft - walk;
              }
            }}
            className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 select-none snap-x snap-mandatory"
          >
            {/* Aba: Todas as peças */}
            <motion.button
              ref={(el) => {
                pillRefs.current['__all__'] = el;
              }}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (dragState.current.moved) {
                  dragState.current.moved = false;
                  return;
                }
                onSelectCategory('');
              }}
              className={`relative snap-start px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                !selectedCategoryId
                  ? 'text-on-brand border-transparent'
                  : isDark
                    ? 'bg-ink text-on-brand border-muted/45 hover:border-brand'
                    : 'bg-surface text-ink border-line hover:border-brand'
              }`}
            >
              {!selectedCategoryId && (
                <motion.span
                  layoutId={`${layoutScope}-active-cat-pill`}
                  transition={SF_SPRING_PILL}
                  style={{ backgroundColor: 'var(--sf-primary)' }}
                  className="absolute inset-0 rounded-xl"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <Sparkles size={12} />
                <span>Todas as peças</span>
              </span>
            </motion.button>

            {categories.map((cat: any) => {
              const active = selectedCategoryId === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  ref={(el) => {
                    pillRefs.current[cat.id] = el;
                  }}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (dragState.current.moved) {
                      dragState.current.moved = false;
                      return;
                    }
                    onSelectCategory(active ? '' : cat.id);
                  }}
                  className={`relative snap-start inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                    active
                      ? 'text-on-brand border-transparent'
                      : isDark
                        ? 'bg-ink text-on-brand border-muted/45 hover:border-brand'
                        : 'bg-surface text-ink border-line hover:border-brand'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={`${layoutScope}-active-cat-pill`}
                      transition={SF_SPRING_PILL}
                      style={{ backgroundColor: 'var(--sf-primary)' }}
                      className="absolute inset-0 rounded-xl"
                    />
                  )}
                  <span
                    className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? 'bg-surface'
                        : isDark
                          ? 'bg-surface/90'
                          : 'bg-page'
                    }`}
                  >
                    <CategoryIconBadge
                      iconId={cat.icon}
                      categoryId={cat.id}
                      categoryName={cat.name}
                      size={13}
                    />
                  </span>
                  <span className="relative z-10">{cat.name}</span>
                </motion.button>
              );
            })}
          </motion.div>
        </LayoutGroup>
      </div>
    </div>
  );
}

export function StorefrontSelectPopover({
  value,
  onChange,
  options,
  placeholder,
  isDark = false,
  highlightWhenSelected = true,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  options: SelectPopoverOption[];
  placeholder: string;
  isDark?: boolean;
  highlightWhenSelected?: boolean;
  ariaLabel?: string;
}) {
  const win = useStorefrontWindow();
  const doc = win?.document || (typeof document !== 'undefined' ? document : null);
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({ top: 0, left: 0, width: 180, maxHeight: 280 });

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  const updateCoords = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn || !win) return;
    const rect = btn.getBoundingClientRect();
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    const pad = 12;
    const gap = 6;
    const width = Math.min(Math.max(rect.width, 190), vw - pad * 2);
    let left = rect.left;
    if (left + width > vw - pad) {
      left = Math.max(pad, vw - width - pad);
    }
    const estHeight = Math.min(300, options.length * 38 + 16);
    const spaceBelow = vh - rect.bottom - pad;
    const openUp = spaceBelow < estHeight && rect.top > spaceBelow;
    const maxHeight = Math.max(
      140,
      Math.min(300, (openUp ? rect.top - pad : spaceBelow) - gap),
    );
    const top = openUp
      ? Math.max(pad, rect.top - Math.min(estHeight, maxHeight) - gap)
      : rect.bottom + gap;

    setCoords({ top, left, width, maxHeight });
  }, [options.length, win]);

  useEffect(() => {
    if (!open || !doc || !win) return;
    updateCoords();

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    doc.addEventListener('mousedown', handlePointerDown, true);
    doc.addEventListener('touchstart', handlePointerDown, true);
    doc.addEventListener('keydown', handleKeyDown);
    win.addEventListener('scroll', updateCoords, true);
    win.addEventListener('resize', updateCoords);

    return () => {
      doc.removeEventListener('mousedown', handlePointerDown, true);
      doc.removeEventListener('touchstart', handlePointerDown, true);
      doc.removeEventListener('keydown', handleKeyDown);
      win.removeEventListener('scroll', updateCoords, true);
      win.removeEventListener('resize', updateCoords);
    };
  }, [open, updateCoords, doc, win]);

  const isHighlighted = highlightWhenSelected && Boolean(value);

  return (
    <>
      <motion.button
        ref={triggerRef}
        type="button"
        whileTap={{ scale: 0.97 }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel || placeholder}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition shrink-0 ${
          isHighlighted
            ? 'border-brand bg-support text-brand'
            : open
              ? isDark
                ? 'border-brand bg-ink text-on-brand'
                : 'border-brand bg-surface text-ink'
              : isDark
                ? 'border-muted/50 bg-ink text-on-brand hover:border-brand'
                : 'border-line bg-page text-ink hover:border-brand hover:bg-surface'
        }`}
      >
        <span className="truncate max-w-[160px]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-brand' : 'text-muted'
          }`}
        />
      </motion.button>

      {doc?.body &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={popoverRef}
                id={listboxId}
                role="listbox"
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: SF_EASE_OUT }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                  zIndex: 10040,
                }}
                className={`rounded-2xl border p-1.5 shadow-xl overflow-y-auto ${
                  isDark
                    ? 'bg-ink border-muted/60 text-on-brand'
                    : 'bg-surface border-line text-ink'
                }`}
              >
                {options.map((opt) => {
                  const selected = opt.value === value;
                  return (
                    <button
                      key={opt.value || '__empty__'}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-2 text-left cursor-pointer transition ${
                        selected
                          ? 'bg-support text-brand font-semibold'
                          : isDark
                            ? 'text-on-brand hover:bg-surface/10'
                            : 'text-ink hover:bg-page'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selected && (
                        <Check size={14} className="text-brand shrink-0" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          doc.body,
        )}
    </>
  );
}

export function MobileFilterSheet({
  open,
  onClose,
  sizes,
  colors,
  selectedSize,
  setSelectedSize,
  selectedColor,
  setSelectedColor,
  inStockOnly,
  setInStockOnly,
  sortBy,
  setSortBy,
  sortOptions,
  resultsCount,
  onClearAll,
  isDark = false,
}: {
  open: boolean;
  onClose: () => void;
  sizes: string[];
  colors: string[];
  selectedSize: string;
  setSelectedSize: (v: string) => void;
  selectedColor: string;
  setSelectedColor: (v: string) => void;
  inStockOnly: boolean;
  setInStockOnly: (v: boolean) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  sortOptions: SelectPopoverOption[];
  resultsCount: number;
  onClearAll: () => void;
  isDark?: boolean;
}) {
  const win = useStorefrontWindow();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !win) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    win.addEventListener('keydown', onKey);
    return () => win.removeEventListener('keydown', onKey);
  }, [open, onClose, win]);

  const portalBody =
    win?.document?.body ||
    (typeof document !== 'undefined' ? document.body : null);
  if (!portalBody) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros e ordenação"
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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SF_SPRING_SHEET}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.45 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 420) {
                onClose();
              }
            }}
            className={`relative z-10 w-full max-h-[86dvh] rounded-t-3xl border-t flex flex-col shadow-2xl ${
              isDark
                ? 'bg-ink border-muted/50 text-on-brand'
                : 'bg-surface border-line text-ink'
            }`}
          >
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-line" />
            </div>

            <div className="px-5 py-3 border-b border-line/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-brand" />
                <h3 className="font-bold text-sm">Filtrar e ordenar</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-semibold text-brand px-2 py-1 cursor-pointer"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar filtros"
                  className="p-1.5 rounded-xl bg-page text-muted hover:text-ink cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Disponibilidade */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Disponibilidade
                </p>
                <button
                  type="button"
                  onClick={() => setInStockOnly(!inStockOnly)}
                  className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold cursor-pointer transition ${
                    inStockOnly
                      ? 'border-brand bg-support text-brand'
                      : isDark
                        ? 'border-muted/50 bg-ink text-on-brand'
                        : 'border-line bg-page text-ink'
                  }`}
                >
                  <span>Mostrar apenas peças em estoque</span>
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      inStockOnly
                        ? 'bg-brand border-brand text-on-brand'
                        : 'border-line bg-surface'
                    }`}
                  >
                    {inStockOnly && <Check size={13} />}
                  </span>
                </button>
              </div>

              {/* Ordenação */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Ordenar por
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {sortOptions.map((opt) => {
                    const active = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSortBy(opt.value)}
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold text-left flex items-center justify-between gap-1.5 cursor-pointer transition ${
                          active
                            ? 'border-brand bg-support text-brand'
                            : isDark
                              ? 'border-muted/50 bg-ink text-on-brand'
                              : 'border-line bg-page text-ink'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {active && <Check size={13} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tamanhos */}
              {sizes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Tamanho
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSize('')}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                        !selectedSize
                          ? 'bg-brand text-on-brand border-brand'
                          : isDark
                            ? 'border-muted/50 bg-ink text-on-brand'
                            : 'border-line bg-page text-ink'
                      }`}
                    >
                      Todos
                    </button>
                    {sizes.map((sz) => {
                      const active = selectedSize === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedSize(active ? '' : sz)}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                            active
                              ? 'bg-brand text-on-brand border-brand'
                              : isDark
                                ? 'border-muted/50 bg-ink text-on-brand'
                                : 'border-line bg-page text-ink'
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cores */}
              {colors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Cor
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedColor('')}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                        !selectedColor
                          ? 'bg-brand text-on-brand border-brand'
                          : isDark
                            ? 'border-muted/50 bg-ink text-on-brand'
                            : 'border-line bg-page text-ink'
                      }`}
                    >
                      Todas
                    </button>
                    {colors.map((cl) => {
                      const active = selectedColor === cl;
                      return (
                        <button
                          key={cl}
                          type="button"
                          onClick={() => setSelectedColor(active ? '' : cl)}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                            active
                              ? 'bg-brand text-on-brand border-brand'
                              : isDark
                                ? 'border-muted/50 bg-ink text-on-brand'
                                : 'border-line bg-page text-ink'
                          }`}
                        >
                          {cl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line/60">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
                className="w-full py-3.5 px-5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  Ver {resultsCount} {resultsCount === 1 ? 'peça' : 'peças'}
                </span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    portalBody,
  );
}
