import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useDragControls,
} from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { getFullUrl } from '@/lib/getFullUrl';
import { CategoryIconIllustration } from '@/components/CategoryIcons';
import type { StorefrontCartItem } from '../storefront-cart';
import {
  SF_EASE_OUT,
  SF_SPRING_DRAWER,
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

export function StorefrontCartDrawer({
  open,
  onClose,
  cartItems,
  cartCount,
  cartTotal,
  cartValidation,
  validatingCart,
  isOffline,
  isDark = false,
  themeStyles,
  onUpdateQuantity,
  onClearCart,
  onNavigateProduct,
  onProceedCheckout,
  onOpenCartPage,
}: {
  open: boolean;
  onClose: () => void;
  cartItems: StorefrontCartItem[];
  cartCount: number;
  cartTotal: number;
  cartValidation: any;
  validatingCart: boolean;
  isOffline: boolean;
  isDark?: boolean;
  themeStyles?: React.CSSProperties;
  onUpdateQuantity: (productId: string, nextQty: number) => void;
  onClearCart?: () => void;
  onNavigateProduct: (productSlug: string) => void;
  onProceedCheckout: () => void;
  onOpenCartPage: () => void;
}) {
  const isMobile = useIsMobileViewport(640);
  const dragControls = useDragControls();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          style={themeStyles}
          className={`fixed inset-0 z-[90] flex ${
            isMobile ? 'items-end justify-center' : 'justify-end'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Sua Sacola"
        >
          {/* Backdrop com blur progressivo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: SF_EASE_OUT }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/50 backdrop-blur-xs"
          />

          {/* Painel da Sacola: Bottom-Sheet no celular, Slide-Over lateral no desktop */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={isMobile ? SF_SPRING_SHEET : SF_SPRING_DRAWER}
            drag={isMobile ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.03, bottom: 0.45 }}
            onDragEnd={(_, info) => {
              if (isMobile && (info.offset.y > 95 || info.velocity.y > 420)) {
                onClose();
              }
            }}
            className={`relative z-10 flex flex-col shadow-2xl ${
              isMobile
                ? 'w-full max-h-[90dvh] rounded-t-3xl border-t'
                : 'w-full max-w-md h-full border-l'
            } ${
              isDark
                ? 'bg-ink text-on-brand border-muted/50'
                : 'bg-surface text-ink border-line'
            }`}
          >
            {/* Cabeçalho arrastável no mobile */}
            <div
              onPointerDown={(e) => {
                if (isMobile) dragControls.start(e);
              }}
              className={`shrink-0 border-b ${
                isDark ? 'border-muted/40' : 'border-line'
              } ${isMobile ? 'touch-none cursor-grab active:cursor-grabbing' : ''}`}
            >
              {isMobile && (
                <div className="pt-3 pb-0.5 flex justify-center">
                  <span className="w-10 h-1.5 rounded-full bg-line" />
                </div>
              )}

              <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-support text-brand flex items-center justify-center shrink-0">
                    <ShoppingBag size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-extrabold text-sm sm:text-base truncate">
                      Sua Sacola
                    </h2>
                    <p className="text-[11px] text-muted">
                      {cartCount}{' '}
                      {cartCount === 1
                        ? 'peça selecionada'
                        : 'peças selecionadas'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {cartItems.length > 1 && onClearCart && (
                    <button
                      type="button"
                      onClick={onClearCart}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-muted hover:text-brand hover:bg-support/50 transition cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    aria-label="Fechar sacola"
                    className={`p-2 rounded-xl transition cursor-pointer ${
                      isDark
                        ? 'text-line hover:bg-surface/10'
                        : 'text-muted hover:text-ink hover:bg-page'
                    }`}
                  >
                    <X size={18} />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Conteúdo da Sacola */}
            <AnimatePresence mode="wait" initial={false}>
              {cartItems.length === 0 ? (
                <motion.div
                  key="empty-bag"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: SF_EASE_OUT }}
                  className="flex-1 p-8 sm:p-10 flex flex-col items-center justify-center text-center space-y-3.5"
                >
                  <div className="w-16 h-16 rounded-3xl bg-support text-brand flex items-center justify-center shadow-2xs">
                    <ShoppingBag size={26} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-sm sm:text-base">
                      Sua sacola está vazia
                    </p>
                    <p className="text-xs text-muted max-w-xs leading-relaxed">
                      Explore as categorias da loja, escolha tamanho e cor das
                      suas peças favoritas e monte seu pedido.
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={onClose}
                    style={{
                      backgroundColor: 'var(--sf-primary)',
                      color: '#FFFFFF',
                    }}
                    className="mt-1 px-5 py-2.5 rounded-xl font-extrabold text-xs cursor-pointer shadow-xs"
                  >
                    Explorar catálogo
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  key="filled-bag"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  {/* Lista de itens com inserção/remoção animada */}
                  <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
                    <AnimatePresence initial={false}>
                      {cartItems.map((item) => {
                        const valItem = cartValidation?.items?.find(
                          (vi: any) => vi.productId === item.productId,
                        );
                        const outOfStock = Boolean(valItem && !valItem.available);
                        const maxStock = Number(
                          valItem?.availableStock ?? item.maxAvailableStock ?? 99,
                        );

                        return (
                          <motion.div
                            key={item.productId}
                            layout="position"
                            initial={{ opacity: 0, height: 0, y: -8 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, x: 28 }}
                            transition={{ duration: 0.22, ease: SF_EASE_OUT }}
                            className="overflow-hidden"
                          >
                            <div
                              className={`py-3.5 border-b flex items-start justify-between gap-3 ${
                                isDark ? 'border-muted/30' : 'border-line'
                              } ${
                                outOfStock
                                  ? 'bg-support/45 px-3 rounded-2xl my-1 border border-brand/40'
                                  : ''
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onNavigateProduct(item.productSlug);
                                  }}
                                  className="w-14 h-18 rounded-xl overflow-hidden border border-line bg-page shrink-0 cursor-pointer"
                                >
                                  {item.imageUrl ? (
                                    <img
                                      src={getFullUrl(item.imageUrl)}
                                      alt={item.productName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <CategoryIconIllustration
                                      productName={item.productName}
                                      compact
                                    />
                                  )}
                                </button>

                                <div className="min-w-0 space-y-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onNavigateProduct(item.productSlug);
                                    }}
                                    className="font-bold text-xs sm:text-sm hover:text-brand truncate block text-left cursor-pointer transition-colors"
                                  >
                                    {item.productName}
                                  </button>

                                  {(item.size || item.color) && (
                                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                      {item.size && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-page border border-line text-[10px] font-bold text-muted">
                                          Tam: {item.size}
                                        </span>
                                      )}
                                      {item.color && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-page border border-line text-[10px] font-bold text-muted">
                                          {item.color}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  <p className="text-xs sm:text-sm font-extrabold text-brand pt-1">
                                    {formatBrl(item.priceUnit * item.quantity)}
                                    {item.quantity > 1 && (
                                      <span className="text-[10px] font-semibold text-muted ml-1.5">
                                        ({formatBrl(item.priceUnit)} cada)
                                      </span>
                                    )}
                                  </p>

                                  {outOfStock && (
                                    <div className="pt-1 flex flex-wrap items-center gap-2">
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand">
                                        <AlertCircle size={12} />
                                        Disponível: {maxStock} un.
                                      </span>
                                      {maxStock > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onUpdateQuantity(
                                              item.productId,
                                              maxStock,
                                            )
                                          }
                                          className="text-[11px] font-extrabold underline text-brand cursor-pointer"
                                        >
                                          Ajustar
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Controles táteis de quantidade */}
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <div
                                  className={`inline-flex items-center gap-1 p-0.5 rounded-xl border ${
                                    isDark
                                      ? 'bg-ink border-muted/50'
                                      : 'bg-page border-line'
                                  }`}
                                >
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.85 }}
                                    onClick={() =>
                                      onUpdateQuantity(
                                        item.productId,
                                        item.quantity - 1,
                                      )
                                    }
                                    aria-label="Diminuir quantidade"
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition ${
                                      isDark
                                        ? 'hover:bg-surface/10 text-on-brand'
                                        : 'bg-surface text-ink hover:text-brand shadow-2xs'
                                    }`}
                                  >
                                    <Minus size={12} />
                                  </motion.button>

                                  <AnimatePresence
                                    mode="popLayout"
                                    initial={false}
                                  >
                                    <motion.span
                                      key={item.quantity}
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 5 }}
                                      transition={{ duration: 0.12 }}
                                      className="w-6 text-center font-extrabold text-xs tabular-nums"
                                    >
                                      {item.quantity}
                                    </motion.span>
                                  </AnimatePresence>

                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.85 }}
                                    disabled={item.quantity >= maxStock}
                                    onClick={() =>
                                      onUpdateQuantity(
                                        item.productId,
                                        item.quantity + 1,
                                      )
                                    }
                                    aria-label="Aumentar quantidade"
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition disabled:opacity-35 ${
                                      isDark
                                        ? 'hover:bg-surface/10 text-on-brand'
                                        : 'bg-surface text-ink hover:text-brand shadow-2xs'
                                    }`}
                                  >
                                    <Plus size={12} />
                                  </motion.button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateQuantity(item.productId, 0)
                                  }
                                  className="text-[11px] font-semibold text-muted hover:text-brand inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Trash2 size={11} />
                                  <span>Remover</span>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Rodapé da Sacola */}
                  <div
                    className={`p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t space-y-3.5 shrink-0 ${
                      isDark
                        ? 'border-muted/40 bg-ink'
                        : 'border-line bg-page/70'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-extrabold text-muted uppercase tracking-wider">
                        Subtotal ({cartCount}{' '}
                        {cartCount === 1 ? 'peça' : 'peças'})
                      </span>
                      <motion.span
                        key={cartTotal}
                        initial={{ scale: 1.06 }}
                        animate={{ scale: 1 }}
                        transition={SF_SPRING_SNAPPY}
                        className="text-xl font-extrabold text-brand tabular-nums"
                      >
                        {formatBrl(cartTotal)}
                      </motion.span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        disabled={validatingCart || isOffline}
                        onClick={onProceedCheckout}
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="w-full py-3.5 px-5 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm hover:opacity-95 disabled:opacity-50"
                      >
                        {validatingCart ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Conferindo disponibilidade...</span>
                          </>
                        ) : (
                          <>
                            <span>Finalizar Pedido</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </motion.button>

                      <button
                        type="button"
                        onClick={onOpenCartPage}
                        className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs transition cursor-pointer ${
                          isDark
                            ? 'bg-ink border-muted/50 text-on-brand hover:border-brand'
                            : 'bg-surface border-line text-ink hover:border-brand'
                        }`}
                      >
                        Ver sacola detalhada
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function MobileFloatingCartBar({
  visible,
  cartCount,
  cartTotal,
  pulseKey = 0,
  onOpenCart,
}: {
  visible: boolean;
  cartCount: number;
  cartTotal: number;
  pulseKey?: number;
  onOpenCart: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mobile-cart-bar"
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={SF_SPRING_SNAPPY}
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 sm:hidden"
        >
          <motion.button
            key={pulseKey}
            data-sf-mobile-bag-target="true"
            type="button"
            initial={pulseKey > 0 ? { scale: 1.04 } : false}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.97 }}
            transition={SF_SPRING_SNAPPY}
            onClick={onOpenCart}
            style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
            className="w-full py-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between font-extrabold text-xs cursor-pointer border border-surface/15"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-surface/20 flex items-center justify-center font-mono text-[11px]">
                {cartCount}
              </span>
              <span>Ver sacola</span>
            </span>
            <span className="font-mono text-sm inline-flex items-center gap-1.5 tabular-nums">
              <span>{formatBrl(cartTotal)}</span>
              <ArrowRight size={14} />
            </span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
