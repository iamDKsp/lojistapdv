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
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(maxScroll - el.scrollLeft > 6);
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
    window.addEventListener('resize', updateScrollEdges);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateScrollEdges);
    };
  }, [categories.length, updateScrollEdges]);

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

  const edgeFadeFromClass = isDark
    ? 'from-ink'
    : isMinimal
      ? 'from-surface'
      : 'from-page';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Layers size={13} className="text-brand" />
          <span>{title || 'Categorias'}</span>
        </h3>
        <AnimatePresence initial={false}>
          {selectedCategoryId && (
            <motion.button
              key="clear-cat"
              type="button"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.16, ease: SF_EASE_OUT }}
              onClick={() => onSelectCategory('')}
              className="text-xs font-bold text-brand hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>Ver todas</span>
              <X size={12} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="relative group/rail">
        {/* Máscara lateral esquerda + botão desktop */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.div
              key="edge-left"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r ${edgeFadeFromClass} to-transparent flex items-center justify-start`}
            >
              <button
                type="button"
                aria-label="Rolar categorias para a esquerda"
                onClick={() => scrollByStep(-1)}
                className={`pointer-events-auto hidden md:inline-flex w-8 h-8 rounded-full border items-center justify-center shadow-sm cursor-pointer transition ${
                  isDark
                    ? 'bg-ink border-muted/60 text-on-brand hover:border-brand'
                    : 'bg-surface border-line text-ink hover:border-brand hover:text-brand'
                }`}
              >
                <ChevronLeft size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trilho horizontal com pílula deslizante por mola */}
        <LayoutGroup id={`${layoutScope}-categories`}>
          <motion.div
            ref={railRef}
            layoutScroll
            onScroll={updateScrollEdges}
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
            className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 select-none"
          >
            {/* Aba: Todas as peças */}
            <motion.button
              ref={(el) => {
                pillRefs.current['__all__'] = el;
              }}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (dragState.current.moved) {
                  dragState.current.moved = false;
                  return;
                }
                onSelectCategory('');
              }}
              className={`relative px-4 py-2.5 rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                !selectedCategoryId
                  ? 'text-on-brand border-transparent'
                  : isDark
                    ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                    : 'bg-surface text-ink border-line hover:border-brand'
              }`}
            >
              {!selectedCategoryId && (
                <motion.span
                  layoutId={`${layoutScope}-active-cat-pill`}
                  transition={SF_SPRING_PILL}
                  style={{ backgroundColor: 'var(--sf-primary)' }}
                  className="absolute inset-0 rounded-xl shadow-xs"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <Sparkles size={13} />
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
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    if (dragState.current.moved) {
                      dragState.current.moved = false;
                      return;
                    }
                    onSelectCategory(active ? '' : cat.id);
                  }}
                  className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                    active
                      ? 'text-on-brand border-transparent'
                      : isDark
                        ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                        : 'bg-surface text-ink border-line hover:border-brand'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={`${layoutScope}-active-cat-pill`}
                      transition={SF_SPRING_PILL}
                      style={{ backgroundColor: 'var(--sf-primary)' }}
                      className="absolute inset-0 rounded-xl shadow-xs"
                    />
                  )}
                  <span
                    className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? 'bg-surface shadow-2xs'
                        : isDark
                          ? 'bg-surface/90'
                          : 'bg-page'
                    }`}
                  >
                    <CategoryIconBadge
                      iconId={cat.icon}
                      categoryId={cat.id}
                      categoryName={cat.name}
                      size={14}
                    />
                  </span>
                  <span className="relative z-10">{cat.name}</span>
                </motion.button>
              );
            })}
          </motion.div>
        </LayoutGroup>

        {/* Máscara lateral direita + botão desktop */}
        <AnimatePresence>
          {canScrollRight && (
            <motion.div
              key="edge-right"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l ${edgeFadeFromClass} to-transparent flex items-center justify-end`}
            >
              <button
                type="button"
                aria-label="Rolar categorias para a direita"
                onClick={() => scrollByStep(1)}
                className={`pointer-events-auto hidden md:inline-flex w-8 h-8 rounded-full border items-center justify-center shadow-sm cursor-pointer transition ${
                  isDark
                    ? 'bg-ink border-muted/60 text-on-brand hover:border-brand'
                    : 'bg-surface border-line text-ink hover:border-brand hover:text-brand'
                }`}
              >
                <ChevronRight size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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
    if (!btn || typeof window === 'undefined') return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
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
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
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

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [open, updateCoords]);

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
        className={`inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition shrink-0 ${
          isHighlighted
            ? 'border-brand bg-support text-brand'
            : open
              ? isDark
                ? 'border-brand bg-ink text-on-brand'
                : 'border-brand bg-surface text-ink shadow-2xs'
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

      {typeof document !== 'undefined' &&
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
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 text-left cursor-pointer transition ${
                        selected
                          ? 'bg-support text-brand font-bold'
                          : isDark
                            ? 'text-on-brand hover:bg-surface/10'
                            : 'text-ink hover:bg-page'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selected && <Check size={14} className="text-brand shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
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
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

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
            {/* Alça de arraste */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-line" />
            </div>

            <div className="px-5 py-3 border-b border-line/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-brand" />
                <h3 className="font-extrabold text-sm">Filtrar e Ordenar</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-bold text-brand px-2 py-1 cursor-pointer"
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
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
                  Disponibilidade
                </p>
                <button
                  type="button"
                  onClick={() => setInStockOnly(!inStockOnly)}
                  className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold cursor-pointer transition ${
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
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
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
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold text-left flex items-center justify-between gap-1.5 cursor-pointer transition ${
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
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
                    Tamanho
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSize('')}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
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
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
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
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
                    Cor
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedColor('')}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
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
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
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
                className="w-full py-3.5 px-5 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
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
    document.body,
  );
}
