import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Link,
  useLocation,
  useMatch,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize2,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  Truck,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { storefrontApi } from '@/lib/storefront-api';
import { getFullUrl } from '@/lib/getFullUrl';
import { CategoryIconIllustration } from '@/components/CategoryIcons';
import {
  addOrUpdateCartItem,
  clearStoreCart,
  getOrCreateOrderAttemptKey,
  getSavedOrderAccessToken,
  loadRecentStorefrontOrders,
  loadStoreCart,
  loadStorefrontCustomerProfile,
  saveOrderAccessToken,
  saveRecentStorefrontOrder,
  saveStorefrontCustomerProfile,
  setCartItemQuantity,
  type RecentStorefrontOrder,
  type StorefrontCartItem,
} from './storefront-cart';
import {
  FlyToBagOverlay,
  resolveBagTargetCoords,
  SF_EASE_OUT,
  SF_SPRING_PILL,
  SF_SPRING_SNAPPY,
  SF_VIEW_TRANSITION,
  useBodyScrollLock,
  type FlyToBagToken,
} from './storefront-motion';
import {
  CategoryTabsRail,
  MobileFilterSheet,
  StorefrontSelectPopover,
  type SelectPopoverOption,
} from './components/StorefrontFilterControls';
import {
  QuickVariantModal,
  StorefrontGridSkeleton,
  StorefrontProductCard,
  type AddSourceRect,
} from './components/StorefrontProductCard';
import {
  MobileFloatingCartBar,
  StorefrontCartDrawer,
} from './components/StorefrontCartDrawer';

const SF_CONTAINER =
  'max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12';

const SORT_OPTIONS: SelectPopoverOption[] = [
  { value: 'featured', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name_asc', label: 'Ordem A–Z' },
];

const formatBrl = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

function normalizeSearchText(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatPhoneInput(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpfInput(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return digits;
}

function formatCepInput(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatReservationCountdown(
  expiresAtIso?: string | null,
  nowMs = Date.now(),
): string | null {
  if (!expiresAtIso) return null;
  const diff = new Date(expiresAtIso).getTime() - nowMs;
  if (!Number.isFinite(diff) || diff <= 0) return 'Prazo encerrado';
  const totalSeconds = Math.floor(diff / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const COMMERCIAL_STATUS_LABELS: Record<
  string,
  { label: string; desc: string }
> = {
  AWAITING_CONFIRMATION: {
    label: 'Aguardando confirmação da loja',
    desc: 'Seu pedido foi registrado e os itens estão reservados temporariamente. Envie a mensagem no WhatsApp para confirmar o atendimento.',
  },
  CONFIRMED: {
    label: 'Pedido confirmado pela loja',
    desc: 'A loja confirmou seu pedido e garantiu a reserva das peças para separação.',
  },
  COMPLETED: {
    label: 'Venda concluída no PDV',
    desc: 'Seu pedido foi faturado e concluído pela loja.',
  },
  REJECTED: {
    label: 'Pedido recusado',
    desc: 'A loja não pôde atender este pedido e a reserva de estoque foi liberada.',
  },
  CANCELLED: {
    label: 'Pedido cancelado',
    desc: 'Este pedido foi cancelado e a reserva foi encerrada.',
  },
  EXPIRED: {
    label: 'Prazo da reserva expirado',
    desc: 'O tempo limite da reserva venceu antes da conclusão do pedido.',
  },
};

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  WAITING_SEPARATION: 'Aguardando separação',
  PREPARING: 'Em preparação / separação',
  READY_FOR_PICKUP: 'Pronto para retirada na loja',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue ao cliente',
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Reserva de estoque ativa',
  CONSUMED: 'Estoque baixado na venda',
  RELEASED: 'Reserva liberada',
  EXPIRED: 'Reserva expirada',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNREGISTERED: 'A combinar no atendimento',
  REGISTERED_IN_SALE: 'Registrado na venda',
  REFUNDED: 'Estornado / Cancelado',
};

export function getStoreThemeStyles(theme: any): React.CSSProperties {
  const template = theme?.template || 'editorial_roxo';
  const primary = theme?.primaryColor || '#7C3AED';
  const accent = theme?.accentColor || '#6D28D9';
  const isDark = template === 'vitrine_escura';
  return {
    '--sf-primary': primary,
    '--sf-accent': accent,
    '--sf-bg': isDark ? '#272321' : theme?.surfaceColor || '#F8F7FC',
    '--sf-card': isDark ? '#272321' : '#FFFFFF',
    '--sf-text': isDark ? '#FFFFFF' : theme?.textColor || '#272321',
    '--sf-muted': isDark ? '#E5E1ED' : '#665F70',
    '--sf-border': isDark ? '#665F70' : '#E5E1ED',
    '--sf-pill': '#F3E8FF',
  } as React.CSSProperties;
}

function StorefrontBagButton({
  cartCount,
  cartTotal,
  pulseKey = 0,
  onClick,
  to,
}: {
  cartCount: number;
  cartTotal: number;
  pulseKey?: number;
  onClick?: () => void;
  to?: string;
}) {
  const inner = (
    <motion.span
      key={pulseKey}
      initial={pulseKey > 0 ? { scale: 1.09 } : false}
      animate={{ scale: 1 }}
      transition={SF_SPRING_SNAPPY}
      className="inline-flex items-center gap-2"
    >
      <motion.span
        animate={
          pulseKey > 0 ? { rotate: [0, -10, 10, -4, 0] } : { rotate: 0 }
        }
        transition={{ duration: 0.36 }}
        className="inline-flex"
      >
        <ShoppingBag size={16} />
      </motion.span>
      <span>Sacola</span>
      <span className="px-1.5 py-0.5 rounded-lg bg-surface/20 text-[11px] font-mono tabular-nums">
        {cartCount}
      </span>
      <AnimatePresence initial={false}>
        {cartCount > 0 && (
          <motion.span
            key="bag-total"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18, ease: SF_EASE_OUT }}
            className="hidden sm:inline-block overflow-hidden whitespace-nowrap font-mono text-xs pl-0.5 tabular-nums"
          >
            • {formatBrl(cartTotal)}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  );

  if (onClick) {
    return (
      <motion.button
        data-sf-bag-target="true"
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
        className="flex items-center px-3.5 sm:px-4 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-xs hover:opacity-95 transition cursor-pointer"
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <Link
      data-sf-bag-target="true"
      to={to || '#'}
      style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
      className="flex items-center px-3.5 sm:px-4 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-xs hover:opacity-95 transition"
    >
      {inner}
    </Link>
  );
}

export function StorefrontHomeView({
  storeData,
  products,
  loadingProducts,
  syncingProducts = false,
  search,
  setSearch,
  selectedCategoryId,
  setSelectedCategoryId,
  selectedSize,
  setSelectedSize,
  selectedColor,
  setSelectedColor,
  sortBy,
  setSortBy,
  inStockOnly,
  setInStockOnly,
  cartCount,
  cartTotal,
  bagPulseKey = 0,
  onSelectProduct,
  onQuickAdd,
  onOpenCart,
  recentOrders = [],
  onSelectOrder,
  isPreview = false,
}: {
  storeData: any;
  products: any[];
  loadingProducts?: boolean;
  syncingProducts?: boolean;
  search: string;
  setSearch: (v: string) => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (v: string) => void;
  selectedSize: string;
  setSelectedSize: (v: string) => void;
  selectedColor: string;
  setSelectedColor: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  inStockOnly: boolean;
  setInStockOnly: (v: boolean) => void;
  cartCount: number;
  cartTotal: number;
  bagPulseKey?: number;
  onSelectProduct: (productSlug: string, seedProduct?: any) => void;
  onQuickAdd?: (
    product: any,
    variant: any,
    qty?: number,
    source?: AddSourceRect,
  ) => void;
  onOpenCart?: () => void;
  recentOrders?: RecentStorefrontOrder[];
  onSelectOrder?: (reference: string, accessToken?: string) => void;
  isPreview?: boolean;
}) {
  const theme = storeData?.theme || {};
  const template = theme.template || 'editorial_roxo';
  const isDark = template === 'vitrine_escura';
  const isMinimal = template === 'minimal_branco';
  const layoutScope = isPreview ? 'sf-preview' : 'sf-public';

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [quickVariantState, setQuickVariantState] = useState<{
    product: any | null;
    initialSize: string | null;
  }>({ product: null, initialSize: null });

  const defaultSections = [
    { id: 'sec-header', type: 'header', enabled: true },
    { id: 'sec-hero', type: 'hero', enabled: true },
    { id: 'sec-categories', type: 'categories', enabled: true },
    { id: 'sec-featured', type: 'featured', enabled: true },
    { id: 'sec-collection', type: 'collection', enabled: true },
    { id: 'sec-fulfillment', type: 'fulfillment_info', enabled: true },
    { id: 'sec-footer', type: 'footer', enabled: true },
  ];
  const rawSections =
    Array.isArray(theme.sections) && theme.sections.length > 0
      ? theme.sections
      : defaultSections;
  const sections: any[] = rawSections.filter((s: any) => s.enabled !== false);

  const pickupEnabled = Boolean(
    storeData?.pickupEnabled ?? storeData?.fulfillment?.pickupEnabled ?? true,
  );
  const deliveryEnabled = Boolean(
    storeData?.deliveryEnabled ?? storeData?.fulfillment?.deliveryEnabled ?? false,
  );
  const pickupInstructions =
    storeData?.pickupInstructions ||
    storeData?.fulfillment?.pickupInstructions ||
    '';
  const deliveryInstructions =
    storeData?.deliveryInstructions ||
    storeData?.fulfillment?.deliveryNotes ||
    '';
  const deliveryFeeNote =
    storeData?.deliveryFeeNote ||
    (Number(storeData?.fulfillment?.deliveryFeeDefault || 0) > 0
      ? `Taxa padrão: ${formatBrl(storeData.fulfillment.deliveryFeeDefault)}`
      : '');

  const categories = storeData?.categories || [];
  const featuredProducts = storeData?.featuredProducts || [];
  const facets = storeData?.facets || { sizes: [], colors: [] };

  const hasActiveFilters = Boolean(
    search || selectedCategoryId || selectedSize || selectedColor || inStockOnly,
  );

  const activeFilterPillsCount = useMemo(
    () =>
      [selectedSize, selectedColor, inStockOnly ? 'stock' : ''].filter(Boolean)
        .length,
    [selectedSize, selectedColor, inStockOnly],
  );

  const sizeOptions = useMemo<SelectPopoverOption[]>(
    () => [
      { value: '', label: 'Tamanho (Todos)' },
      ...(facets.sizes || []).map((sz: string) => ({
        value: sz,
        label: `Tam: ${sz}`,
      })),
    ],
    [facets.sizes],
  );

  const colorOptions = useMemo<SelectPopoverOption[]>(
    () => [
      { value: '', label: 'Cor (Todas)' },
      ...(facets.colors || []).map((cl: string) => ({
        value: cl,
        label: `Cor: ${cl}`,
      })),
    ],
    [facets.colors],
  );

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setSelectedCategoryId('');
    setSelectedSize('');
    setSelectedColor('');
    setInStockOnly(false);
  }, [
    setSearch,
    setSelectedCategoryId,
    setSelectedSize,
    setSelectedColor,
    setInStockOnly,
  ]);

  const scrollToCatalog = () => {
    const el = document.getElementById(
      isPreview ? 'catalogo-loja-preview' : 'catalogo-loja',
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      style={getStoreThemeStyles(theme)}
      className={`min-h-screen flex flex-col selection:bg-brand selection:text-on-brand ${
        !isPreview && cartCount > 0 ? 'pb-22 sm:pb-0' : ''
      } ${
        isDark
          ? 'bg-ink text-on-brand'
          : isMinimal
            ? 'bg-surface text-ink'
            : 'bg-page text-ink'
      }`}
    >
      {/* Faixa superior de comunicado */}
      {theme.announcementText && (
        <div
          style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
          className="text-[11px] sm:text-xs font-bold py-2 px-4 text-center tracking-wide border-b border-surface/15"
        >
          {theme.announcementText}
        </div>
      )}

      {/* Barra discreta de pedidos recentes do cliente */}
      {!isPreview && recentOrders.length > 0 && onSelectOrder && (
        <div className="bg-support border-b border-line py-1.5 text-xs text-ink">
          <div
            className={`${SF_CONTAINER} flex items-center justify-between gap-2 overflow-x-auto`}
          >
            <span className="font-bold text-muted flex items-center gap-1.5 shrink-0">
              <Receipt size={13} className="text-brand" />
              <span>Seus pedidos recentes:</span>
            </span>
            <div className="flex items-center gap-2">
              {recentOrders.slice(0, 3).map((ord) => (
                <motion.button
                  key={ord.reference}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onSelectOrder(ord.reference, ord.accessToken)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-line text-[11px] font-bold text-ink hover:border-brand transition cursor-pointer shrink-0 shadow-2xs"
                >
                  <span className="font-mono text-brand">{ord.reference}</span>
                  <span className="text-muted">•</span>
                  <span>{formatBrl(ord.total)}</span>
                  <ChevronRight size={12} className="text-muted" />
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {sections.map((section) => {
        if (section.type === 'header') {
          return (
            <header
              key={section.id}
              className={`sticky top-0 z-30 border-b backdrop-blur-md transition-colors ${
                isDark
                  ? 'bg-ink/92 border-muted/40'
                  : 'bg-surface/92 border-line'
              }`}
            >
              <div
                className={`${SF_CONTAINER} py-3 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4`}
              >
                {/* Identidade da loja */}
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                    if (!isPreview && typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="flex items-center gap-3 min-w-0 text-left group cursor-pointer"
                >
                  {storeData.logoUrl ? (
                    <img
                      src={getFullUrl(storeData.logoUrl)}
                      alt={storeData.storeName}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-line shrink-0 bg-surface shadow-2xs group-hover:scale-[1.03] transition-transform"
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs group-hover:scale-[1.03] transition-transform"
                    >
                      {String(storeData.storeName || 'L')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="font-extrabold text-sm sm:text-base lg:text-lg tracking-tight truncate group-hover:text-brand transition-colors">
                      {storeData.storeName || 'Loja Virtual'}
                    </h1>
                    {storeData.tagline && (
                      <p
                        className={`text-[11px] sm:text-xs truncate ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {storeData.tagline}
                      </p>
                    )}
                  </div>
                </button>

                {/* Busca rápida integrada no topo (Desktop / Tablet) */}
                <div className="hidden md:flex relative flex-1 max-w-md lg:max-w-lg mx-4">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar peça, modelo, cor ou referência..."
                    className={`w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs sm:text-sm border outline-none transition ${
                      isDark
                        ? 'bg-ink border-muted/60 text-on-brand placeholder:text-line/60 focus:border-brand'
                        : 'bg-page border-line text-ink placeholder:text-muted focus:border-brand focus:bg-surface focus:shadow-2xs'
                    }`}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Limpar busca"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-brand cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Ações do cabeçalho */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isPreview ? (
                    <StorefrontBagButton
                      cartCount={cartCount}
                      cartTotal={cartTotal}
                      pulseKey={bagPulseKey}
                      onClick={onOpenCart}
                      to={
                        onOpenCart
                          ? undefined
                          : `/loja/${storeData.slug}/carrinho`
                      }
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-2xl font-extrabold text-xs shadow-xs"
                    >
                      <ShoppingBag size={15} />
                      <span>Sacola ({cartCount})</span>
                    </div>
                  )}
                </div>
              </div>
            </header>
          );
        }

        if (section.type === 'hero') {
          const banners = Array.isArray(theme.banners)
            ? theme.banners.filter((b: any) => b.enabled !== false)
            : [];
          const hasCover = Boolean(storeData.coverUrl);

          return (
            <section
              key={section.id}
              className={`${SF_CONTAINER} pt-4 sm:pt-6 pb-2`}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: SF_EASE_OUT }}
                style={
                  isMinimal
                    ? {
                        backgroundColor: '#F8F7FC',
                        color: '#272321',
                      }
                    : isDark
                      ? {
                          backgroundColor: '#272321',
                          color: '#FFFFFF',
                        }
                      : {
                          background:
                            'linear-gradient(135deg, var(--sf-primary) 0%, var(--sf-accent) 100%)',
                          color: '#FFFFFF',
                        }
                }
                className={`relative rounded-3xl border overflow-hidden ${
                  isMinimal
                    ? 'border-line shadow-xs'
                    : isDark
                      ? 'border-muted/40 shadow-sm'
                      : 'border-brand/20 shadow-md'
                }`}
              >
                {/* Brilho sutil ambiente dentro da paleta oficial */}
                {!isMinimal && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-surface/10 blur-3xl"
                  />
                )}

                <div
                  className={`relative z-10 grid grid-cols-1 ${
                    hasCover ? 'lg:grid-cols-12' : ''
                  } items-center`}
                >
                  <div
                    className={`p-6 sm:p-8 lg:p-11 xl:p-12 space-y-4 sm:space-y-5 ${
                      hasCover ? 'lg:col-span-7' : 'max-w-3xl'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {pickupEnabled && (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                            isMinimal
                              ? 'bg-support text-brand border border-brand/20'
                              : 'bg-surface/15 text-on-brand backdrop-blur-xs'
                          }`}
                        >
                          <Store size={12} />
                          <span>Retirada na loja</span>
                        </span>
                      )}
                      {deliveryEnabled && (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                            isMinimal
                              ? 'bg-support text-brand border border-brand/20'
                              : 'bg-surface/15 text-on-brand backdrop-blur-xs'
                          }`}
                        >
                          <Truck size={12} />
                          <span>Entrega a combinar</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.6rem] font-extrabold tracking-tight leading-[1.12]">
                      {theme.heroTitle ||
                        `Coleção ${storeData.storeName || 'Oficial'}`}
                    </h2>

                    <p
                      className={`text-sm sm:text-base leading-relaxed max-w-xl ${
                        isMinimal ? 'text-muted' : 'opacity-92'
                      }`}
                    >
                      {theme.heroSubtitle ||
                        storeData.description ||
                        'Confira a disponibilidade real por tamanho e cor, monte sua sacola e finalize seu pedido pelo WhatsApp.'}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={scrollToCatalog}
                        className={`group/cta inline-flex items-center gap-2.5 px-5 sm:px-6 py-3 rounded-2xl font-extrabold text-xs sm:text-sm transition cursor-pointer shadow-xs ${
                          isMinimal
                            ? 'bg-brand text-on-brand hover:bg-brand-hover'
                            : 'bg-surface text-ink hover:bg-support'
                        }`}
                      >
                        <span>{theme.heroCtaLabel || 'Explorar catálogo'}</span>
                        <ArrowRight
                          size={15}
                          className="transition-transform duration-200 group-hover/cta:translate-x-1"
                        />
                      </motion.button>
                    </div>
                  </div>

                  {/* Moldura editorial responsiva para foto de capa ou logo da loja */}
                  {hasCover && (
                    <div className="lg:col-span-5 px-4 pb-5 sm:px-8 sm:pb-8 lg:p-6 lg:pl-2 flex items-center justify-center">
                      <div
                        className={`w-full aspect-[16/10] sm:aspect-[16/9] lg:aspect-[5/4] max-h-[340px] rounded-2xl overflow-hidden border shadow-lg ${
                          isMinimal
                            ? 'border-line bg-surface'
                            : 'border-surface/20 bg-ink/30'
                        }`}
                      >
                        <img
                          src={getFullUrl(storeData.coverUrl)}
                          alt={storeData.storeName}
                          loading="eager"
                          className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Banners secundários */}
              {banners.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mt-4">
                  {banners.map((banner: any) => (
                    <motion.button
                      type="button"
                      key={banner.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        if (
                          banner.targetType === 'category' &&
                          banner.targetValue
                        ) {
                          setSelectedCategoryId(banner.targetValue);
                          scrollToCatalog();
                        } else if (
                          banner.targetType === 'product' &&
                          banner.targetValue
                        ) {
                          onSelectProduct(banner.targetValue);
                        } else if (banner.targetType === 'featured') {
                          setSortBy('featured');
                          scrollToCatalog();
                        } else {
                          scrollToCatalog();
                        }
                      }}
                      className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 flex items-center justify-between gap-4 text-left transition cursor-pointer group ${
                        isDark
                          ? 'border-muted/40 bg-ink hover:border-brand'
                          : 'border-line bg-surface text-ink hover:border-brand shadow-2xs hover:shadow-sm'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-brand">
                          <Sparkles size={11} />
                          <span>Destaque</span>
                        </span>
                        <h3 className="font-extrabold text-sm sm:text-base truncate group-hover:text-brand transition-colors">
                          {banner.title}
                        </h3>
                        {banner.subtitle && (
                          <p className="text-xs text-muted line-clamp-2">
                            {banner.subtitle}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-brand pt-1">
                          <span>{banner.ctaLabel || 'Conferir'}</span>
                          <ChevronRight
                            size={14}
                            className="transition-transform group-hover:translate-x-0.5"
                          />
                        </span>
                      </div>
                      {banner.imageUrl && (
                        <img
                          src={getFullUrl(banner.imageUrl)}
                          alt={banner.title}
                          loading="lazy"
                          className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border border-line shrink-0 bg-page"
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </section>
          );
        }

        if (section.type === 'categories' && categories.length > 0) {
          return (
            <section key={section.id} className={`${SF_CONTAINER} py-3 sm:py-4`}>
              <CategoryTabsRail
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                title={section.title || 'Categorias'}
                isDark={isDark}
                isMinimal={isMinimal}
                layoutScope={layoutScope}
              />
            </section>
          );
        }

        if (section.type === 'featured' && featuredProducts.length > 0) {
          return (
            <AnimatePresence key={section.id} initial={false}>
              {!hasActiveFilters && (
                <motion.section
                  key="featured-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, ease: SF_EASE_OUT }}
                  className="overflow-hidden"
                >
                  <div className={`${SF_CONTAINER} py-3 sm:py-4`}>
                    <div className="flex items-center justify-between mb-3.5 sm:mb-4">
                      <div>
                        <h3 className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight flex items-center gap-2">
                          <Sparkles size={17} className="text-brand" />
                          <span>{section.title || 'Seleção em Destaque'}</span>
                        </h3>
                        {section.subtitle && (
                          <p className="text-xs text-muted mt-0.5">
                            {section.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                      {featuredProducts.slice(0, 4).map((prod: any, idx: number) => (
                        <StorefrontProductCard
                          key={prod.id}
                          product={prod}
                          index={idx}
                          isDark={isDark}
                          onSelect={() => onSelectProduct(prod.slug, prod)}
                          onQuickAdd={
                            onQuickAdd
                              ? (p, v, src) => onQuickAdd(p, v, 1, src)
                              : undefined
                          }
                          onOpenQuickVariant={
                            onQuickAdd
                              ? (p, sz) =>
                                  setQuickVariantState({
                                    product: p,
                                    initialSize: sz || null,
                                  })
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          );
        }

        if (section.type === 'collection') {
          return (
            <section
              id={isPreview ? 'catalogo-loja-preview' : 'catalogo-loja'}
              key={section.id}
              className={`${SF_CONTAINER} py-4 flex-1`}
            >
              {/* Barra de busca mobile + filtros customizados fluidos */}
              <div
                className={`rounded-2xl sm:rounded-3xl border p-3 sm:p-4 mb-5 transition-colors ${
                  isDark
                    ? 'bg-ink border-muted/40 text-on-brand'
                    : 'bg-surface border-line text-ink shadow-2xs'
                }`}
              >
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
                  {/* Busca em telas menores (< md) */}
                  <div className="relative flex-1 md:hidden">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por modelo, categoria ou cor..."
                      className={`w-full pl-9 pr-8 py-2.5 rounded-xl text-xs border outline-none ${
                        isDark
                          ? 'bg-ink border-muted/60 text-on-brand'
                          : 'bg-page border-line text-ink focus:border-brand focus:bg-surface'
                      }`}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        aria-label="Limpar busca"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-brand p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Barra compacta Mobile (< sm): Botão Bottom-Sheet + Contagem */}
                  <div className="flex sm:hidden items-center justify-between gap-2">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setMobileFilterOpen(true)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-extrabold cursor-pointer ${
                        activeFilterPillsCount > 0
                          ? 'border-brand bg-support text-brand'
                          : isDark
                            ? 'border-muted/50 bg-ink text-on-brand'
                            : 'border-line bg-page text-ink'
                      }`}
                    >
                      <SlidersHorizontal size={14} className="text-brand" />
                      <span>Filtros e Ordem</span>
                      {activeFilterPillsCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-brand text-on-brand text-[10px] font-mono">
                          {activeFilterPillsCount}
                        </span>
                      )}
                    </motion.button>

                    <div className="flex items-center gap-2">
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="text-xs font-bold text-brand underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                      <span className="text-[11px] font-bold text-muted tabular-nums">
                        {products.length}{' '}
                        {products.length === 1 ? 'peça' : 'peças'}
                      </span>
                    </div>
                  </div>

                  {/* Controles completos Desktop / Tablet (sm:+) com Popovers animados */}
                  <div className="hidden sm:flex flex-wrap items-center gap-2 flex-1">
                    <span className="text-xs font-extrabold text-muted inline-flex items-center gap-1.5 mr-1">
                      <SlidersHorizontal size={13} className="text-brand" />
                      <span>Filtrar:</span>
                    </span>

                    {facets.sizes?.length > 0 && (
                      <StorefrontSelectPopover
                        value={selectedSize}
                        onChange={setSelectedSize}
                        options={sizeOptions}
                        placeholder="Tamanho (Todos)"
                        isDark={isDark}
                        ariaLabel="Filtrar por tamanho"
                      />
                    )}

                    {facets.colors?.length > 0 && (
                      <StorefrontSelectPopover
                        value={selectedColor}
                        onChange={setSelectedColor}
                        options={colorOptions}
                        placeholder="Cor (Todas)"
                        isDark={isDark}
                        ariaLabel="Filtrar por cor"
                      />
                    )}

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setInStockOnly(!inStockOnly)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        inStockOnly
                          ? 'border-brand bg-support text-brand'
                          : isDark
                            ? 'border-muted/50 bg-ink text-on-brand hover:border-brand'
                            : 'border-line bg-page text-ink hover:border-brand hover:bg-surface'
                      }`}
                    >
                      <Check
                        size={13}
                        className={inStockOnly ? 'text-brand' : 'opacity-40'}
                      />
                      <span>Disponíveis</span>
                    </motion.button>

                    <AnimatePresence initial={false}>
                      {hasActiveFilters && (
                        <motion.button
                          key="clear-filters-btn"
                          type="button"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{ duration: 0.14 }}
                          onClick={clearAllFilters}
                          className="text-xs font-extrabold text-brand hover:underline px-2 py-1 cursor-pointer inline-flex items-center gap-1"
                        >
                          <X size={12} />
                          <span>Limpar filtros</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="hidden sm:flex items-center justify-end gap-2.5 shrink-0">
                    <span className="text-xs font-bold text-muted inline-flex items-center gap-1.5 tabular-nums">
                      {syncingProducts && (
                        <Loader2
                          size={12}
                          className="animate-spin text-brand"
                        />
                      )}
                      <span>
                        {products.length}{' '}
                        {products.length === 1 ? 'peça' : 'peças'}
                      </span>
                    </span>

                    <StorefrontSelectPopover
                      value={sortBy}
                      onChange={setSortBy}
                      options={SORT_OPTIONS}
                      placeholder="Relevância"
                      isDark={isDark}
                      highlightWhenSelected={false}
                      ariaLabel="Ordenar catálogo"
                    />
                  </div>
                </div>
              </div>

              {/* Grade de produtos sem desmontagem destrutiva */}
              {loadingProducts && products.length === 0 ? (
                <StorefrontGridSkeleton count={8} isDark={isDark} />
              ) : products.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: SF_EASE_OUT }}
                  className={`border rounded-3xl p-10 sm:p-14 text-center space-y-3 ${
                    isDark
                      ? 'bg-ink border-muted/40 text-on-brand'
                      : 'bg-surface border-line text-ink'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-support text-brand flex items-center justify-center mx-auto">
                    <Package size={26} />
                  </div>
                  <p className="font-extrabold text-sm sm:text-base">
                    Nenhuma peça encontrada com os filtros selecionados
                  </p>
                  <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                    Experimente limpar os filtros de categoria, tamanho, cor ou
                    termo de busca para visualizar todo o catálogo.
                  </p>
                  {hasActiveFilters && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={clearAllFilters}
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer shadow-xs"
                    >
                      <span>Ver catálogo completo</span>
                    </motion.button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  layout="position"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 xl:gap-6"
                >
                  {products.map((prod: any, idx: number) => (
                    <StorefrontProductCard
                      key={prod.id}
                      product={prod}
                      index={idx}
                      isDark={isDark}
                      onSelect={() => onSelectProduct(prod.slug, prod)}
                      onQuickAdd={
                        onQuickAdd
                          ? (p, v, src) => onQuickAdd(p, v, 1, src)
                          : undefined
                      }
                      onOpenQuickVariant={
                        onQuickAdd
                          ? (p, sz) =>
                              setQuickVariantState({
                                product: p,
                                initialSize: sz || null,
                              })
                          : undefined
                      }
                    />
                  ))}
                </motion.div>
              )}
            </section>
          );
        }

        if (section.type === 'fulfillment_info') {
          if (!pickupEnabled && !deliveryEnabled) {
            return null;
          }
          return (
            <section key={section.id} className={`${SF_CONTAINER} py-5`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {pickupEnabled && (
                  <div
                    className={`border rounded-3xl p-4 sm:p-5 flex items-start gap-3.5 ${
                      isDark
                        ? 'bg-ink border-muted/40 text-on-brand'
                        : 'bg-surface border-line text-ink shadow-2xs'
                    }`}
                  >
                    <div className="p-3 rounded-2xl bg-support text-brand shrink-0">
                      <Store size={19} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-xs sm:text-sm">
                        Retirada na Loja
                      </h4>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {pickupInstructions ||
                          'Reserve suas peças online e retire diretamente no balcão da loja com agilidade.'}
                      </p>
                    </div>
                  </div>
                )}
                {deliveryEnabled && (
                  <div
                    className={`border rounded-3xl p-4 sm:p-5 flex items-start gap-3.5 ${
                      isDark
                        ? 'bg-ink border-muted/40 text-on-brand'
                        : 'bg-surface border-line text-ink shadow-2xs'
                    }`}
                  >
                    <div className="p-3 rounded-2xl bg-support text-brand shrink-0">
                      <Truck size={19} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-xs sm:text-sm">
                          Entrega a Combinar
                        </h4>
                        {deliveryFeeNote && (
                          <span className="px-2 py-0.5 rounded-lg bg-support text-brand text-[10px] font-extrabold">
                            {deliveryFeeNote}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {deliveryInstructions ||
                          'Informe seu endereço ao finalizar o pedido e combine prazo e entrega pelo WhatsApp.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        }

        if (section.type === 'footer') {
          return (
            <footer
              key={section.id}
              className={`border-t mt-auto py-7 text-xs ${
                isDark
                  ? 'border-muted/40 text-line bg-ink'
                  : 'border-line text-muted bg-surface'
              }`}
            >
              <div
                className={`${SF_CONTAINER} flex flex-col sm:flex-row items-center justify-between gap-3`}
              >
                <div className="text-center sm:text-left">
                  <p
                    className={`font-extrabold text-sm ${
                      isDark ? 'text-on-brand' : 'text-ink'
                    }`}
                  >
                    {storeData.storeName}
                  </p>
                  {storeData.description && (
                    <p className="mt-0.5 max-w-md text-xs opacity-80">
                      {storeData.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 opacity-85 font-semibold">
                  <ShieldCheck size={15} className="text-brand shrink-0" />
                  <span>Estoque sincronizado em tempo real • PDV Lojista</span>
                </div>
              </div>
            </footer>
          );
        }

        return null;
      })}

      {/* Bottom-Sheet Mobile de Filtros */}
      {!isPreview && (
        <MobileFilterSheet
          open={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          sizes={facets.sizes || []}
          colors={facets.colors || []}
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          inStockOnly={inStockOnly}
          setInStockOnly={setInStockOnly}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOptions={SORT_OPTIONS}
          resultsCount={products.length}
          onClearAll={clearAllFilters}
          isDark={isDark}
        />
      )}

      {/* Modal / Bottom-Sheet de Escolha Rápida de Tamanho & Cor no Catálogo */}
      {onQuickAdd && (
        <QuickVariantModal
          open={Boolean(quickVariantState.product)}
          product={quickVariantState.product}
          initialSize={quickVariantState.initialSize}
          isDark={isDark}
          onClose={() =>
            setQuickVariantState({ product: null, initialSize: null })
          }
          onConfirmAdd={(prod, variant, qty, src) => {
            onQuickAdd(prod, variant, qty, src);
          }}
          onOpenFullProduct={(prodSlug) =>
            onSelectProduct(prodSlug, quickVariantState.product)
          }
        />
      )}
    </div>
  );
}

function StorefrontSubpageHeader({
  slug,
  storeData,
  backTo,
  backLabel,
  stepLabel,
  cartCount,
  cartTotal,
  bagPulseKey,
  onOpenCart,
  showCartButton = true,
}: {
  slug: string;
  storeData: any;
  backTo: string;
  backLabel: string;
  stepLabel?: string;
  cartCount: number;
  cartTotal: number;
  bagPulseKey: number;
  onOpenCart: () => void;
  showCartButton?: boolean;
}) {
  const isDark = storeData?.theme?.template === 'vitrine_escura';

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur-md ${
        isDark ? 'bg-ink/92 border-muted/40 text-on-brand' : 'bg-surface/92 border-line text-ink'
      }`}
    >
      <div
        className={`${SF_CONTAINER} py-3 sm:py-3.5 flex items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-page/70 hover:border-brand text-xs sm:text-sm font-bold text-ink hover:text-brand transition shrink-0"
          >
            <ArrowLeft size={15} />
            <span>{backLabel}</span>
          </Link>

          {storeData?.storeName && (
            <Link
              to={`/loja/${slug}`}
              className="hidden sm:flex items-center gap-2 min-w-0 pl-1 group"
            >
              {storeData.logoUrl && (
                <img
                  src={getFullUrl(storeData.logoUrl)}
                  alt=""
                  className="w-7 h-7 rounded-lg object-cover border border-line bg-surface shrink-0"
                />
              )}
              <span className="text-xs font-extrabold text-muted group-hover:text-brand truncate transition-colors">
                {storeData.storeName}
              </span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {stepLabel && (
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-muted">
              {stepLabel}
            </span>
          )}
          {showCartButton && (
            <StorefrontBagButton
              cartCount={cartCount}
              cartTotal={cartTotal}
              pulseKey={bagPulseKey}
              onClick={onOpenCart}
            />
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicStorefrontApp() {
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Resolução das sub-rotas dentro do Shell persistente (/loja/:slug/*)
  const productMatch = useMatch('/loja/:slug/produto/:produtoSlug');
  const orderMatch = useMatch('/loja/:slug/pedido/:referencia');
  const cartMatch = useMatch('/loja/:slug/carrinho');
  const checkoutMatch = useMatch('/loja/:slug/finalizar');

  const produtoSlug = productMatch?.params?.produtoSlug;
  const referencia = orderMatch?.params?.referencia;
  const isCartPage = Boolean(cartMatch);
  const isCheckoutPage = Boolean(checkoutMatch);
  const isProductPage = Boolean(produtoSlug);
  const isOrderPage = Boolean(referencia);

  const [storeData, setStoreData] = useState<any>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  // Motor de Catálogo Instantâneo + Revalidação Silenciosa
  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [serverFilteredProducts, setServerFilteredProducts] = useState<
    any[] | null
  >(null);
  const [loadingInitialCatalog, setLoadingInitialCatalog] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Detalhe de produto + Lightbox
  const [productDetail, setProductDetail] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);
  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const [chosenColor, setChosenColor] = useState<string | null>(null);
  const [chosenQuantity, setChosenQuantity] = useState(1);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [justAddedDetail, setJustAddedDetail] = useState(false);

  // Sacola + Animação Fly-to-Bag + Pulso no contador
  const [cartItems, setCartItems] = useState<StorefrontCartItem[]>([]);
  const [cartValidation, setCartValidation] = useState<any>(null);
  const [validatingCart, setValidatingCart] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [bagPulseKey, setBagPulseKey] = useState(0);
  const [flyTokens, setFlyTokens] = useState<FlyToBagToken[]>([]);
  const flySeqRef = useRef(1);
  const [recentOrders, setRecentOrders] = useState<RecentStorefrontOrder[]>([]);

  // Preservação da posição de rolagem ao ir e voltar do catálogo
  const catalogScrollYRef = useRef(0);
  const prevViewTypeRef = useRef<string>('home');

  // Checkout + ViaCEP
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<'PICKUP' | 'DELIVERY'>(
    'PICKUP',
  );
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const lastFetchedCepRef = useRef('');
  const [addressRef, setAddressRef] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [priceDivergenceAlert, setPriceDivergenceAlert] = useState<any[] | null>(
    null,
  );

  // Consulta de pedido + relógio de contagem regressiva
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useBodyScrollLock(lightboxOpen);

  // Restauração inteligente de rolagem entre Catálogo e Sub-rotas
  const currentViewType = isOrderPage
    ? 'order'
    : isProductPage
      ? 'product'
      : isCheckoutPage
        ? 'checkout'
        : isCartPage
          ? 'cart'
          : 'home';

  useEffect(() => {
    const prev = prevViewTypeRef.current;
    if (prev !== currentViewType && typeof window !== 'undefined') {
      if (currentViewType === 'home') {
        const targetY = catalogScrollYRef.current;
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: 'auto' });
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      prevViewTypeRef.current = currentViewType;
    }
  }, [currentViewType, produtoSlug, referencia]);

  // Monitorar conectividade
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Relógio de 1s na página do pedido quando há reserva ativa
  useEffect(() => {
    if (!isOrderPage || orderDetail?.reservationStatus !== 'ACTIVE') return;
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isOrderPage, orderDetail?.reservationStatus]);

  // Carregar loja publicada + catálogo inicial em 1 única requisição
  const fetchStoreHome = useCallback(async () => {
    if (!slug) return;
    setLoadingStore(true);
    setStoreError(null);
    try {
      const { data } = await storefrontApi.get(`/storefront/public/${slug}`);
      setStoreData(data);

      if (Array.isArray(data.initialProducts)) {
        setMasterProducts(data.initialProducts);
        setServerFilteredProducts(null);
      }

      const savedProfile = loadStorefrontCustomerProfile(data.publicId);
      if (savedProfile) {
        if (savedProfile.customerName) setCustomerName(savedProfile.customerName);
        if (savedProfile.customerPhone) {
          setCustomerPhone(formatPhoneInput(savedProfile.customerPhone));
        }
        if (savedProfile.customerDocument) {
          setCustomerCpf(formatCpfInput(savedProfile.customerDocument));
        }
        if (savedProfile.addressLine) setStreet(savedProfile.addressLine);
        if (savedProfile.addressNumber) setNumber(savedProfile.addressNumber);
        if (savedProfile.addressComplement) {
          setComplement(savedProfile.addressComplement);
        }
        if (savedProfile.neighborhood) setNeighborhood(savedProfile.neighborhood);
        if (savedProfile.city) setCity(savedProfile.city);
        if (savedProfile.zipCode) {
          const maskedCep = formatCepInput(savedProfile.zipCode);
          setZipCode(maskedCep);
          lastFetchedCepRef.current = maskedCep.replace(/\D/g, '');
        }
      }

      if (data.pickupEnabled && !data.deliveryEnabled) {
        setFulfillmentMode('PICKUP');
      } else if (!data.pickupEnabled && data.deliveryEnabled) {
        setFulfillmentMode('DELIVERY');
      } else if (savedProfile?.deliveryMode) {
        setFulfillmentMode(savedProfile.deliveryMode);
      }

      const loaded = loadStoreCart(data.publicId, data.slug);
      setCartItems(loaded.items);
      setRecentOrders(loadRecentStorefrontOrders(data.publicId));
    } catch (err: any) {
      setStoreError(
        err.response?.data?.message ||
          'Esta loja virtual não está disponível no momento.',
      );
    } finally {
      setLoadingStore(false);
    }
  }, [slug]);

  useEffect(() => {
    void fetchStoreHome();
  }, [fetchStoreHome]);

  // Sincronizar carrinho quando atualizado
  useEffect(() => {
    if (!storeData?.publicId) return;
    const sync = () => {
      const loaded = loadStoreCart(storeData.publicId, storeData.slug);
      setCartItems(loaded.items);
    };
    window.addEventListener('storefront-cart-updated', sync);
    return () => window.removeEventListener('storefront-cart-updated', sync);
  }, [storeData?.publicId, storeData?.slug]);

  // Preenchimento automático de endereço via CEP (ViaCEP) no checkout
  useEffect(() => {
    if (!isCheckoutPage || fulfillmentMode !== 'DELIVERY' || isOffline) return;
    const cleanCep = zipCode.replace(/\D/g, '');
    if (cleanCep.length !== 8 || cleanCep === lastFetchedCepRef.current) return;

    const controller = new AbortController();
    setLoadingCep(true);
    lastFetchedCepRef.current = cleanCep;

    fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info || info.erro) return;
        if (info.logradouro) setStreet(info.logradouro);
        if (info.bairro) setNeighborhood(info.bairro);
        if (info.localidade) {
          setCity(info.uf ? `${info.localidade} - ${info.uf}` : info.localidade);
        }
      })
      .catch(() => {
        // Ignora falha silenciosamente; o cliente pode preencher manualmente
      })
      .finally(() => {
        setLoadingCep(false);
      });

    return () => controller.abort();
  }, [zipCode, isCheckoutPage, fulfillmentMode, isOffline]);

  // Revalidação silenciosa em background (com Debounce + AbortController) — NUNCA desmonta a grade
  useEffect(() => {
    if (!slug || !storeData || currentViewType !== 'home') return;

    const hasFilters = Boolean(
      search.trim() ||
        selectedCategoryId ||
        selectedSize ||
        selectedColor ||
        inStockOnly ||
        sortBy !== 'featured',
    );
    const totalPublished = Number(
      storeData?.facets?.totalPublishedProducts ?? masterProducts.length,
    );
    const needsInitialLoad = masterProducts.length === 0 && totalPublished > 0;

    // Se não há filtros e já acabamos de receber os produtos no carregamento inicial, evita chamada redundante
    if (!hasFilters && !needsInitialLoad) {
      setServerFilteredProducts(null);
      return;
    }

    const controller = new AbortController();
    const delayMs = search.trim() ? 260 : 120;

    const timer = window.setTimeout(async () => {
      if (needsInitialLoad) {
        setLoadingInitialCatalog(true);
      } else {
        setSyncingCatalog(true);
      }
      try {
        const { data } = await storefrontApi.get(
          `/storefront/public/${slug}/products`,
          {
            signal: controller.signal,
            params: {
              search: search.trim() || undefined,
              categoryId: selectedCategoryId || undefined,
              size: selectedSize || undefined,
              color: selectedColor || undefined,
              sort: sortBy || 'featured',
              inStockOnly: inStockOnly ? 'true' : undefined,
              limit: 48,
            },
          },
        );
        const fetched: any[] = data?.data || [];

        if (!hasFilters) {
          setMasterProducts(fetched);
          setServerFilteredProducts(null);
        } else if (totalPublished > masterProducts.length) {
          setServerFilteredProducts(fetched);
        } else {
          // Atualiza os saldos de estoque locais sem substituir toda a referência abruptamente
          setMasterProducts((prev) => {
            if (!prev.length) return fetched;
            const byId = new Map(fetched.map((f) => [f.id, f]));
            return prev.map((item) => byId.get(item.id) || item);
          });
        }
      } catch {
        // Ignora cancelamentos de AbortController ou falhas transitórias mantendo lista em tela
      } finally {
        setLoadingInitialCatalog(false);
        setSyncingCatalog(false);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    slug,
    storeData,
    currentViewType,
    search,
    selectedCategoryId,
    selectedSize,
    selectedColor,
    sortBy,
    inStockOnly,
  ]);

  // Filtragem local instantânea (0 ms de resposta na troca de aba, filtros e busca)
  const displayedProducts = useMemo(() => {
    if (serverFilteredProducts !== null) {
      return serverFilteredProducts;
    }

    const normSearch = normalizeSearchText(search);
    const filtered = masterProducts.filter((prod) => {
      if (
        selectedCategoryId &&
        prod.categoryId !== selectedCategoryId &&
        prod.category?.id !== selectedCategoryId
      ) {
        return false;
      }

      if (selectedSize) {
        if (!Array.isArray(prod.sizes) || !prod.sizes.includes(selectedSize)) {
          return false;
        }
        if (
          inStockOnly &&
          Array.isArray(prod.variants) &&
          !prod.variants.some(
            (v: any) =>
              v.size === selectedSize &&
              v.inStock &&
              Number(v.availableStock ?? 0) > 0,
          )
        ) {
          return false;
        }
      }

      if (selectedColor) {
        if (!Array.isArray(prod.colors) || !prod.colors.includes(selectedColor)) {
          return false;
        }
        if (
          inStockOnly &&
          Array.isArray(prod.variants) &&
          !prod.variants.some(
            (v: any) =>
              v.color === selectedColor &&
              v.inStock &&
              Number(v.availableStock ?? 0) > 0,
          )
        ) {
          return false;
        }
      }

      if (inStockOnly) {
        const avail = Number(
          prod.totalAvailableStock ?? prod.availableStock ?? 0,
        );
        if (!prod.inStock || avail <= 0) return false;
      }

      if (normSearch) {
        const haystack = normalizeSearchText(
          `${prod.title || ''} ${prod.description || ''} ${prod.categoryName || ''} ${prod.badgeLabel || ''} ${prod.slug || ''} ${(prod.colors || []).join(' ')}`,
        );
        if (!haystack.includes(normSearch)) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => Number(a.priceSell || 0) - Number(b.priceSell || 0));
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => Number(b.priceSell || 0) - Number(a.priceSell || 0));
    } else if (sortBy === 'name_asc') {
      sorted.sort((a, b) =>
        String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'),
      );
    } else {
      sorted.sort(
        (a, b) =>
          Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
          Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0),
      );
    }

    return sorted;
  }, [
    serverFilteredProducts,
    masterProducts,
    selectedCategoryId,
    selectedSize,
    selectedColor,
    inStockOnly,
    search,
    sortBy,
  ]);

  const applySeededProductDetail = useCallback(
    (seed: any) => {
      setProductDetail(seed);
      setActivePhotoUrl(seed?.imageUrl || seed?.galleryUrls?.[0] || null);
      const firstAvail =
        (seed?.variants || []).find(
          (v: any) => v.inStock && Number(v.availableStock ?? 0) > 0,
        ) || seed?.variants?.[0];
      setChosenSize(firstAvail?.size || null);
      setChosenColor(firstAvail?.color || null);
      setChosenQuantity(1);
      setRelatedProducts(
        masterProducts
          .filter(
            (p) => p.id !== seed?.id && p.categoryId === seed?.categoryId,
          )
          .slice(0, 4),
      );
    },
    [masterProducts],
  );

  // Carregar detalhe de produto (com seed instantâneo se já disponível em memória)
  useEffect(() => {
    if (!slug || !produtoSlug) return;
    let active = true;

    const cachedSeed =
      (productDetail?.slug === produtoSlug ? productDetail : null) ||
      masterProducts.find((p) => p.slug === produtoSlug) ||
      storeData?.featuredProducts?.find((p: any) => p.slug === produtoSlug) ||
      null;

    if (cachedSeed && productDetail?.slug !== produtoSlug) {
      applySeededProductDetail(cachedSeed);
    }

    setLoadingProductDetail(!cachedSeed);

    storefrontApi
      .get(`/storefront/public/${slug}/products/${produtoSlug}`)
      .then(({ data }) => {
        if (!active) return;
        const prod = data.product;
        setProductDetail(prod);
        setRelatedProducts(data.relatedProducts || []);
        setActivePhotoUrl((prev) =>
          prev && prod?.galleryUrls?.includes(prev)
            ? prev
            : prod?.imageUrl || prod?.galleryUrls?.[0] || null,
        );
        setChosenSize((prev) => {
          if (prev && (prod?.sizes || []).includes(prev)) return prev;
          const firstAvail =
            (prod?.variants || []).find((v: any) => v.inStock) ||
            prod?.variants?.[0];
          return firstAvail?.size || null;
        });
        setChosenColor((prev) => {
          if (prev && (prod?.colors || []).includes(prev)) return prev;
          const firstAvail =
            (prod?.variants || []).find((v: any) => v.inStock) ||
            prod?.variants?.[0];
          return firstAvail?.color || null;
        });
      })
      .catch((err) => {
        if (!active) return;
        toast.error(
          err.response?.data?.message || 'Mercadoria não encontrada.',
        );
        navigate(`/loja/${slug}`);
      })
      .finally(() => {
        if (active) setLoadingProductDetail(false);
      });

    return () => {
      active = false;
    };
  }, [slug, produtoSlug]);

  // Revalidar carrinho no servidor (ao abrir carrinho/gaveta/checkout)
  const revalidateCartOnServer = useCallback(
    async (silent = false) => {
      if (!storeData?.publicId || cartItems.length === 0 || isOffline) {
        return null;
      }
      setValidatingCart(true);
      try {
        const { data } = await storefrontApi.post(
          `/storefront/public/${slug}/cart/validate`,
          {
            items: cartItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              expectedPriceUnit: i.priceUnit,
            })),
          },
        );
        setCartValidation(data);

        if (Array.isArray(data?.items)) {
          const currentCart = loadStoreCart(storeData.publicId, storeData.slug);
          let changed = false;
          currentCart.items = currentCart.items.map((item) => {
            const serverItem = data.items.find(
              (si: any) => si.productId === item.productId,
            );
            if (!serverItem) return item;
            const nextPrice = Number(serverItem.priceUnit ?? item.priceUnit);
            const nextMax = Number(
              serverItem.availableStock ?? item.maxAvailableStock,
            );
            if (
              nextPrice !== item.priceUnit ||
              nextMax !== item.maxAvailableStock
            ) {
              changed = true;
            }
            return {
              ...item,
              priceUnit: nextPrice,
              maxAvailableStock: nextMax,
            };
          });
          if (changed) {
            setCartItems([...currentCart.items]);
          }
        }

        if (!silent && data.hasPriceDivergence) {
          toast.info(
            'Os preços de alguns itens foram atualizados pelo servidor.',
          );
        }
        return data;
      } catch {
        return null;
      } finally {
        setValidatingCart(false);
      }
    },
    [storeData?.publicId, storeData?.slug, cartItems, isOffline, slug],
  );

  useEffect(() => {
    if (
      (isCartPage || isCheckoutPage || cartDrawerOpen) &&
      !isOffline &&
      cartItems.length > 0
    ) {
      void revalidateCartOnServer(true);
    }
  }, [isCartPage, isCheckoutPage, cartDrawerOpen, isOffline]);

  // Carregar status de pedido (/loja/:slug/pedido/:referencia)
  const fetchOrderStatus = useCallback(async () => {
    if (!slug || !referencia) return;
    const tokenFromUrl =
      searchParams.get('token') || searchParams.get('t') || '';
    const savedToken = storeData?.publicId
      ? getSavedOrderAccessToken(storeData.publicId, referencia)
      : '';
    const token = tokenFromUrl || savedToken || '';

    if (!token) {
      setOrderError(
        'Para consultar o andamento deste pedido, utilize o link seguro gerado na finalização.',
      );
      return;
    }

    setLoadingOrder(true);
    setOrderError(null);
    try {
      const { data } = await storefrontApi.get(
        `/storefront/public/${slug}/orders/${referencia}`,
        {
          params: { token },
          headers: { 'x-order-token': token },
        },
      );
      setOrderDetail(data);
      if (storeData?.publicId && tokenFromUrl) {
        saveOrderAccessToken(storeData.publicId, referencia, tokenFromUrl);
      }
    } catch (err: any) {
      setOrderError(
        err.response?.data?.message ||
          'Não foi possível localizar este pedido ou a credencial de acesso é inválida.',
      );
    } finally {
      setLoadingOrder(false);
    }
  }, [slug, referencia, searchParams, storeData?.publicId]);

  useEffect(() => {
    if (isOrderPage) {
      void fetchOrderStatus();
    }
  }, [isOrderPage, fetchOrderStatus]);

  const cartCount = useMemo(
    () => cartItems.reduce((acc, i) => acc + Number(i.quantity || 0), 0),
    [cartItems],
  );
  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (acc, i) => acc + Number(i.priceUnit || 0) * Number(i.quantity || 0),
        0,
      ),
    [cartItems],
  );

  const launchFlyToBag = useCallback(
    (source?: AddSourceRect, imageUrl?: string | null, title?: string) => {
      const target = resolveBagTargetCoords();
      if (!source || !target) {
        setBagPulseKey((k) => k + 1);
        return;
      }
      const id = flySeqRef.current++;
      setFlyTokens((prev) => [
        ...prev,
        {
          id,
          startX: source.x,
          startY: source.y,
          targetX: target.x,
          targetY: target.y,
          imageUrl,
          title,
        },
      ]);
    },
    [],
  );

  const handleCompleteFlyToken = useCallback((id: number) => {
    setFlyTokens((prev) => prev.filter((tk) => tk.id !== id));
    setBagPulseKey((k) => k + 1);
  }, []);

  const handleAddVariantToCart = (
    product: any,
    variant: any,
    qty = 1,
    options?: { openDrawer?: boolean; source?: AddSourceRect },
  ) => {
    if (!storeData?.publicId) return;
    if (!variant || !variant.inStock || variant.availableStock <= 0) {
      toast.error('Esta variação está sem estoque disponível no momento.');
      return;
    }

    addOrUpdateCartItem(storeData.publicId, storeData.slug, {
      productId: variant.id,
      retailGroupId: product.id,
      productSlug: product.slug,
      productName: product.title,
      size: variant.size || null,
      color: variant.color || null,
      imageUrl: product.imageUrl || null,
      unit: variant.unit || 'UN',
      quantity: qty,
      priceUnit: Number(variant.priceSell ?? product.priceSell ?? 0),
      maxAvailableStock: Number(variant.availableStock),
    });

    if (options?.openDrawer) {
      setBagPulseKey((k) => k + 1);
      setCartDrawerOpen(true);
    } else {
      launchFlyToBag(options?.source, product.imageUrl, product.title);
      toast.success(`"${product.title}" adicionado à sacola!`, {
        action: {
          label: 'Ver sacola',
          onClick: () => setCartDrawerOpen(true),
        },
      });
    }
  };

  const handleNavigateToProduct = useCallback(
    (prodSlug: string, seedProduct?: any) => {
      if (currentViewType === 'home' && typeof window !== 'undefined') {
        catalogScrollYRef.current = window.scrollY;
      }
      if (seedProduct) {
        applySeededProductDetail(seedProduct);
      }
      navigate(`/loja/${slug}/produto/${prodSlug}`);
    },
    [currentViewType, applySeededProductDetail, navigate, slug],
  );

  // Submeter pedido antes de abrir o WhatsApp
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) {
      toast.error(
        'Você está sem conexão. Reconecte à internet para validar estoque e registrar seu pedido.',
      );
      return;
    }
    if (!storeData?.publicId || cartItems.length === 0) {
      toast.error('Sua sacola está vazia.');
      return;
    }

    setSubmittingOrder(true);
    setPriceDivergenceAlert(null);
    try {
      const attemptKey = getOrCreateOrderAttemptKey(
        storeData.publicId,
        storeData.slug,
      );

      saveStorefrontCustomerProfile(storeData.publicId, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerDocument: customerCpf.trim(),
        deliveryMode: fulfillmentMode,
        addressLine: street.trim(),
        addressNumber: number.trim(),
        addressComplement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        zipCode: zipCode.trim(),
      });

      const { data } = await storefrontApi.post(
        `/storefront/public/${slug}/orders`,
        {
          idempotencyKey: attemptKey,
          customer: {
            name: customerName.trim(),
            phone: customerPhone.trim(),
            cpf: customerCpf.trim() || undefined,
          },
          fulfillmentMode,
          deliveryAddress:
            fulfillmentMode === 'DELIVERY'
              ? {
                  street: street.trim(),
                  number: number.trim(),
                  complement: complement.trim() || undefined,
                  neighborhood: neighborhood.trim(),
                  city: city.trim() || undefined,
                  zipCode: zipCode.trim() || undefined,
                  reference: addressRef.trim() || undefined,
                }
              : undefined,
          notes: orderNotes.trim() || undefined,
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            expectedPriceUnit: item.priceUnit,
          })),
        },
      );

      if (data?.accessToken && data?.reference) {
        saveOrderAccessToken(
          storeData.publicId,
          data.reference,
          data.accessToken,
        );
        saveRecentStorefrontOrder(storeData.publicId, {
          reference: data.reference,
          accessToken: data.accessToken,
          createdAt: data.createdAt || new Date().toISOString(),
          total: Number(data.total ?? cartTotal),
          status: data.commercialStatus || 'AWAITING_CONFIRMATION',
          itemsCount: cartCount,
        });
        setRecentOrders(loadRecentStorefrontOrders(storeData.publicId));
      }

      clearStoreCart(storeData.publicId, storeData.slug);
      setCartDrawerOpen(false);
      setOrderDetail(data);
      toast.success(`Pedido ${data.reference} registrado com sucesso!`);
      navigate(
        `/loja/${slug}/pedido/${data.reference}${
          data.accessToken
            ? `?token=${encodeURIComponent(data.accessToken)}`
            : ''
        }`,
      );
    } catch (err: any) {
      const resp = err.response?.data;
      if (resp?.code === 'PRICE_DIVERGENCE' && Array.isArray(resp.divergences)) {
        setPriceDivergenceAlert(resp.divergences);
        const current = loadStoreCart(storeData.publicId, storeData.slug);
        current.items = current.items.map((item) => {
          const diff = resp.divergences.find(
            (d: any) => d.productId === item.productId,
          );
          return diff
            ? { ...item, priceUnit: Number(diff.currentPriceUnit) }
            : item;
        });
        delete current.pendingIdempotencyKey;
        setCartItems([...current.items]);
        toast.error(
          'O preço de um ou mais itens mudou. Confira os novos valores e confirme novamente.',
        );
      } else {
        toast.error(
          resp?.message ||
            'Não foi possível registrar o pedido. Confira a disponibilidade dos itens.',
        );
        void revalidateCartOnServer(true);
      }
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleProceedFromDrawerToCheckout = useCallback(async () => {
    const val = await revalidateCartOnServer(false);
    if (val?.hasStockShortage) {
      toast.error(
        'Ajuste as quantidades dos itens com estoque insuficiente antes de avançar.',
      );
      return;
    }
    if (currentViewType === 'home' && typeof window !== 'undefined') {
      catalogScrollYRef.current = window.scrollY;
    }
    setCartDrawerOpen(false);
    navigate(`/loja/${slug}/finalizar`);
  }, [revalidateCartOnServer, currentViewType, navigate, slug]);

  if (loadingStore && !storeData && !isOrderPage) {
    return (
      <div className="min-h-screen bg-page text-ink flex flex-col items-center justify-center p-6 gap-3">
        <Loader2 className="animate-spin text-brand" size={30} />
        <p className="text-xs font-semibold text-muted">
          Abrindo vitrine...
        </p>
      </div>
    );
  }

  if (storeError && !isOrderPage) {
    return (
      <div className="min-h-screen bg-page text-ink flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-support text-brand flex items-center justify-center mx-auto">
            <Store size={26} />
          </div>
          <h1 className="text-lg font-extrabold text-ink">
            Loja Indisponível
          </h1>
          <p className="text-xs text-muted leading-relaxed">{storeError}</p>
          <button
            type="button"
            onClick={() => void fetchStoreHome()}
            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-extrabold text-xs inline-flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Tentar novamente</span>
          </button>
        </div>
      </div>
    );
  }

  const themeStyles = getStoreThemeStyles(storeData?.theme);
  const isDarkTheme = storeData?.theme?.template === 'vitrine_escura';
  const activeRouteKey = isOrderPage
    ? `order-${referencia}`
    : isProductPage
      ? `product-${produtoSlug}`
      : isCheckoutPage
        ? 'checkout'
        : isCartPage
          ? 'cart'
          : 'home';

  const renderActiveRouteView = () => {
    // ── ROTA: /loja/:slug/pedido/:referencia ──────────────────────────────────
    if (isOrderPage) {
      const commInfo =
        COMMERCIAL_STATUS_LABELS[orderDetail?.commercialStatus] ||
        COMMERCIAL_STATUS_LABELS.AWAITING_CONFIRMATION;
      const isCancelledOrExpired = ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(
        orderDetail?.commercialStatus || '',
      );
      const countdownText =
        orderDetail?.reservationStatus === 'ACTIVE'
          ? formatReservationCountdown(orderDetail?.reservationExpiresAt, clockNow)
          : null;

      const stepIndex =
        orderDetail?.commercialStatus === 'COMPLETED' ||
        orderDetail?.fulfillmentStatus === 'DELIVERED'
          ? 3
          : ['PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(
                orderDetail?.fulfillmentStatus || '',
              )
            ? 2
            : orderDetail?.commercialStatus === 'CONFIRMED'
              ? 1
              : 0;

      return (
        <div
          style={themeStyles}
          className={`min-h-screen pb-16 ${
            isDarkTheme ? 'bg-ink text-on-brand' : 'bg-page text-ink'
          }`}
        >
          <StorefrontSubpageHeader
            slug={slug}
            storeData={storeData}
            backTo={`/loja/${slug}`}
            backLabel="Voltar ao catálogo"
            stepLabel="Acompanhamento do Pedido"
            cartCount={cartCount}
            cartTotal={cartTotal}
            bagPulseKey={bagPulseKey}
            onOpenCart={() => setCartDrawerOpen(true)}
            showCartButton={cartCount > 0}
          />

          <div className={`${SF_CONTAINER} pt-6 sm:pt-8`}>
            <div className="max-w-3xl mx-auto space-y-5">
              {orderDetail && (
                <div className="flex justify-end">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => void fetchOrderStatus()}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-brand px-3.5 py-2 rounded-xl bg-surface border border-line cursor-pointer shadow-2xs"
                  >
                    <RefreshCw size={13} />
                    <span>Atualizar status</span>
                  </motion.button>
                </div>
              )}

              {loadingOrder ? (
                <div className="bg-surface text-ink border border-line rounded-3xl p-12 text-center space-y-2.5">
                  <Loader2 className="animate-spin text-brand mx-auto" size={28} />
                  <p className="text-xs font-semibold text-muted">
                    Consultando pedido...
                  </p>
                </div>
              ) : orderError ? (
                <div className="bg-surface text-ink border border-line rounded-3xl p-8 sm:p-10 text-center space-y-3">
                  <AlertCircle size={30} className="text-brand mx-auto" />
                  <h2 className="text-base font-extrabold">Acesso ao Pedido</h2>
                  <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                    {orderError}
                  </p>
                </div>
              ) : orderDetail ? (
                <div className="bg-surface text-ink border border-line rounded-3xl p-5 sm:p-8 space-y-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1 rounded-full bg-support text-brand">
                          {isCancelledOrExpired ? (
                            <AlertCircle size={13} />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                          <span>{commInfo.label}</span>
                        </span>

                        {countdownText && !isCancelledOrExpired && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-page border border-line text-ink font-mono">
                            <Clock size={12} className="text-brand" />
                            <span>Reserva: {countdownText}</span>
                          </span>
                        )}
                      </div>

                      <h1 className="text-xl sm:text-2xl font-extrabold text-ink mt-2 font-mono">
                        {orderDetail.reference}
                      </h1>
                      <p className="text-xs text-muted mt-0.5">
                        Registrado em{' '}
                        {new Date(orderDetail.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-[11px] text-muted uppercase font-extrabold tracking-wider">
                        Total dos Produtos
                      </p>
                      <p className="text-2xl font-extrabold text-brand tabular-nums">
                        {formatBrl(orderDetail.total)}
                      </p>
                    </div>
                  </div>

                  {/* Linha do tempo visual em 4 etapas */}
                  {!isCancelledOrExpired && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[
                        'Registrado',
                        'Confirmado',
                        orderDetail.fulfillmentMode === 'DELIVERY'
                          ? 'Em rota'
                          : 'Separação',
                        'Concluído',
                      ].map((label, idx) => {
                        const reached = idx <= stepIndex;
                        return (
                          <div key={label} className="space-y-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-colors ${
                                reached ? 'bg-brand' : 'bg-line'
                              }`}
                            />
                            <p
                              className={`text-[10px] sm:text-xs font-bold truncate ${
                                reached ? 'text-brand' : 'text-muted'
                              }`}
                            >
                              {label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Ação Principal conforme o estado atual do pedido */}
                  {['AWAITING_CONFIRMATION', 'CONFIRMED'].includes(
                    orderDetail.commercialStatus,
                  ) && orderDetail.reservationStatus === 'ACTIVE' ? (
                    <div className="bg-support border border-brand rounded-2xl p-4 sm:p-5 space-y-3.5">
                      <div className="flex items-start gap-3">
                        <MessageCircle
                          size={20}
                          className="text-brand shrink-0 mt-0.5"
                        />
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-xs sm:text-sm text-ink">
                            {orderDetail.whatsappUrl
                              ? 'Envie a confirmação pelo WhatsApp para combinar o atendimento'
                              : 'Pedido registrado com reserva de estoque ativa'}
                          </h3>
                          <p className="text-xs text-muted leading-relaxed">
                            Seu pedido já foi registrado e o estoque está
                            reservado até{' '}
                            <strong>
                              {new Date(
                                orderDetail.reservationExpiresAt,
                              ).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </strong>
                            .{' '}
                            {orderDetail.whatsappUrl
                              ? 'Clique no botão abaixo para enviar o resumo à loja.'
                              : 'Copie o resumo abaixo para apresentar ou enviar ao atendimento da loja.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {orderDetail.whatsappUrl && (
                          <a
                            href={orderDetail.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs"
                          >
                            <MessageCircle size={16} />
                            <span>Abrir WhatsApp da Loja</span>
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            navigator.clipboard.writeText(
                              orderDetail.whatsappMessage || '',
                            );
                            toast.success('Resumo do pedido copiado!');
                          }}
                          className="py-3 px-4 rounded-xl bg-surface hover:bg-page text-ink border border-line font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Copy size={14} />
                          <span>Copiar Resumo</span>
                        </motion.button>
                        {orderDetail.compactWhatsappUrl &&
                          orderDetail.compactWhatsappUrl !==
                            orderDetail.whatsappUrl && (
                            <a
                              href={orderDetail.compactWhatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-3 px-3.5 rounded-xl bg-surface hover:bg-page text-brand border border-brand font-bold text-xs flex items-center gap-1.5 transition"
                            >
                              Mensagem Resumida
                            </a>
                          )}
                      </div>
                    </div>
                  ) : isCancelledOrExpired ? (
                    <div className="bg-page border border-line rounded-2xl p-4 sm:p-5 space-y-2">
                      <div className="flex items-start gap-3">
                        <AlertCircle
                          size={20}
                          className="text-brand shrink-0 mt-0.5"
                        />
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-xs sm:text-sm text-ink">
                            {commInfo.label} — Reserva de estoque encerrada
                          </h3>
                          <p className="text-xs text-muted leading-relaxed">
                            {orderDetail.cancelReason
                              ? `Motivo: ${orderDetail.cancelReason}. `
                              : ''}
                            As peças deste pedido não estão mais reservadas. Caso
                            deseje adquirir os produtos, faça um novo pedido no
                            catálogo da loja.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-support border border-brand rounded-2xl p-4 sm:p-5 space-y-2">
                      <div className="flex items-start gap-3">
                        <CheckCircle2
                          size={20}
                          className="text-brand shrink-0 mt-0.5"
                        />
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-xs sm:text-sm text-ink">
                            Pedido concluído na loja
                          </h3>
                          <p className="text-xs text-muted leading-relaxed">
                            Este pedido já foi convertido em venda e finalizado
                            pelo atendimento da loja.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quatro dimensões de status claras */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-page border border-line">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
                        Situação do Pedido
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-ink mt-0.5">
                        {commInfo.label}
                      </p>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {commInfo.desc}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-page border border-line space-y-2">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
                          Andamento / Separação
                        </p>
                        <p className="text-xs sm:text-sm font-extrabold text-brand">
                          {FULFILLMENT_STATUS_LABELS[
                            orderDetail.fulfillmentStatus
                          ] || orderDetail.fulfillmentStatus}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-line">
                        <span className="text-muted">Reserva:</span>
                        <span className="font-bold text-ink">
                          {RESERVATION_STATUS_LABELS[
                            orderDetail.reservationStatus
                          ] || orderDetail.reservationStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Pagamento:</span>
                        <span className="font-bold text-ink">
                          {PAYMENT_STATUS_LABELS[orderDetail.paymentStatus] ||
                            orderDetail.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de itens do pedido */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                      Itens do Pedido ({orderDetail.items?.length || 0})
                    </h3>
                    <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
                      {(orderDetail.items || []).map((item: any) => (
                        <div
                          key={item.id}
                          className="p-3.5 bg-surface flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-xs sm:text-sm text-ink truncate">
                              {item.quantity}x {item.productName}
                            </p>
                            {(item.size || item.color) && (
                              <p className="text-xs text-muted">
                                {[
                                  item.size && `Tam: ${item.size}`,
                                  item.color && `Cor: ${item.color}`,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </p>
                            )}
                          </div>
                          <span className="font-extrabold text-xs sm:text-sm text-ink shrink-0 tabular-nums">
                            {formatBrl(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    // ── ROTA: /loja/:slug/produto/:produtoSlug ───────────────────────────────
    if (isProductPage) {
      const variants: any[] = productDetail?.variants || [];
      const sizes: string[] = productDetail?.sizes || [];
      const colors: string[] = productDetail?.colors || [];
      const galleryUrls: string[] = Array.isArray(productDetail?.galleryUrls)
        ? productDetail.galleryUrls
        : productDetail?.imageUrl
          ? [productDetail.imageUrl]
          : [];

      const selectedVariant =
        variants.find(
          (v) =>
            (sizes.length === 0 || v.size === chosenSize) &&
            (colors.length === 0 || v.color === chosenColor),
        ) ||
        variants.find((v) => v.size === chosenSize) ||
        variants[0];

      const variantAvailableStock = Number(selectedVariant?.availableStock ?? 0);
      const variantInStock = Boolean(
        selectedVariant?.inStock && variantAvailableStock > 0,
      );
      const currentPhoto = activePhotoUrl || productDetail?.imageUrl || null;
      const currentPhotoIdx = currentPhoto
        ? Math.max(0, galleryUrls.indexOf(currentPhoto))
        : 0;
      const unitPrice = Number(
        selectedVariant?.priceSell ?? productDetail?.priceSell ?? 0,
      );

      return (
        <div
          style={themeStyles}
          className={`min-h-screen pb-24 sm:pb-16 ${
            isDarkTheme ? 'bg-ink text-on-brand' : 'bg-page text-ink'
          }`}
        >
          <StorefrontSubpageHeader
            slug={slug}
            storeData={storeData}
            backTo={`/loja/${slug}`}
            backLabel="Voltar ao catálogo"
            cartCount={cartCount}
            cartTotal={cartTotal}
            bagPulseKey={bagPulseKey}
            onOpenCart={() => setCartDrawerOpen(true)}
          />

          <div className={`${SF_CONTAINER} pt-5 sm:pt-7`}>
            {loadingProductDetail && !productDetail ? (
              <div className="bg-surface border border-line rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-6 aspect-[4/5] rounded-2xl bg-support/45 animate-pulse" />
                <div className="lg:col-span-6 space-y-4 py-4">
                  <div className="h-4 w-24 rounded-full bg-page animate-pulse" />
                  <div className="h-8 w-3/4 rounded-xl bg-page animate-pulse" />
                  <div className="h-7 w-32 rounded-xl bg-support/60 animate-pulse" />
                  <div className="h-24 w-full rounded-2xl bg-page animate-pulse" />
                </div>
              </div>
            ) : productDetail ? (
              <>
                <div
                  className={`border rounded-3xl p-4 sm:p-7 lg:p-9 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 shadow-xs ${
                    isDarkTheme
                      ? 'bg-ink border-muted/40 text-on-brand'
                      : 'bg-surface border-line text-ink'
                  }`}
                >
                  {/* Galeria de fotos com Crossfade + Navegação + Zoom */}
                  <div className="lg:col-span-6 space-y-3">
                    <div className="relative aspect-[4/5] rounded-2xl sm:rounded-3xl bg-page border border-line overflow-hidden flex items-center justify-center group/gallery">
                      {currentPhoto ? (
                        <>
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.img
                              key={currentPhoto}
                              src={getFullUrl(currentPhoto)}
                              alt={productDetail.title}
                              initial={{ opacity: 0, scale: 1.015 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, ease: SF_EASE_OUT }}
                              onClick={() => setLightboxOpen(true)}
                              className="w-full h-full object-cover cursor-zoom-in"
                            />
                          </AnimatePresence>

                          <button
                            type="button"
                            onClick={() => setLightboxOpen(true)}
                            aria-label="Ampliar foto"
                            className="absolute top-3 right-3 p-2 rounded-xl bg-surface/90 text-ink border border-line shadow-xs opacity-90 sm:opacity-0 sm:group-hover/gallery:opacity-100 transition cursor-pointer"
                          >
                            <Maximize2 size={15} />
                          </button>

                          {galleryUrls.length > 1 && (
                            <>
                              <button
                                type="button"
                                aria-label="Foto anterior"
                                onClick={() => {
                                  const prevIdx =
                                    (currentPhotoIdx - 1 + galleryUrls.length) %
                                    galleryUrls.length;
                                  setActivePhotoUrl(galleryUrls[prevIdx]);
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface/90 text-ink border border-line flex items-center justify-center shadow-xs hover:border-brand cursor-pointer transition"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <button
                                type="button"
                                aria-label="Próxima foto"
                                onClick={() => {
                                  const nextIdx =
                                    (currentPhotoIdx + 1) % galleryUrls.length;
                                  setActivePhotoUrl(galleryUrls[nextIdx]);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface/90 text-ink border border-line flex items-center justify-center shadow-xs hover:border-brand cursor-pointer transition"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <CategoryIconIllustration
                          categoryId={productDetail.categoryId}
                          categoryName={productDetail.categoryName}
                          productName={productDetail.title}
                        />
                      )}
                    </div>

                    {galleryUrls.length > 1 && (
                      <div className="flex gap-2.5 overflow-x-auto py-1">
                        {galleryUrls.map((url: string) => {
                          const active = currentPhoto === url;
                          return (
                            <motion.button
                              type="button"
                              key={url}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setActivePhotoUrl(url)}
                              className={`w-16 h-20 rounded-2xl overflow-hidden border-2 shrink-0 cursor-pointer transition ${
                                active
                                  ? 'border-brand shadow-xs'
                                  : 'border-line opacity-70 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={getFullUrl(url)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Informações e seletor fluido de tamanho/cor */}
                  <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                    <div className="space-y-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {productDetail.categoryName && (
                            <span className="text-xs font-extrabold uppercase tracking-wider text-brand">
                              {productDetail.categoryName}
                            </span>
                          )}
                          {productDetail.badgeLabel && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-support text-brand text-[10px] font-extrabold inline-flex items-center gap-1">
                              <Sparkles size={10} />
                              <span>{productDetail.badgeLabel}</span>
                            </span>
                          )}
                        </div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold mt-1.5 leading-tight">
                          {productDetail.title}
                        </h1>
                        <p className="text-2xl sm:text-3xl font-extrabold text-brand mt-2.5 tabular-nums">
                          {formatBrl(unitPrice)}
                        </p>
                      </div>

                      {productDetail.description && (
                        <p
                          className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                            isDarkTheme ? 'text-line' : 'text-muted'
                          }`}
                        >
                          {productDetail.description}
                        </p>
                      )}

                      {/* Seleção de Tamanho com pílula deslizante */}
                      {sizes.length > 0 && (
                        <div className="space-y-2.5">
                          <label className="text-xs font-extrabold uppercase tracking-wider text-muted block">
                            Tamanho:{' '}
                            <strong
                              className={
                                isDarkTheme ? 'text-on-brand' : 'text-ink'
                              }
                            >
                              {chosenSize}
                            </strong>
                          </label>
                          <LayoutGroup id="sf-detail-sizes">
                            <div className="flex flex-wrap gap-2">
                              {sizes.map((sz) => {
                                const hasStockForSize = variants.some(
                                  (v) =>
                                    v.size === sz &&
                                    v.inStock &&
                                    Number(v.availableStock ?? 0) > 0,
                                );
                                const isSelected = chosenSize === sz;
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
                                        const firstColor = variants.find(
                                          (v) => v.size === sz && v.inStock,
                                        );
                                        if (firstColor) {
                                          setChosenColor(firstColor.color);
                                        }
                                      }
                                    }}
                                    className={`relative px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'text-on-brand border-transparent'
                                        : hasStockForSize
                                          ? isDarkTheme
                                            ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                                            : 'bg-page text-ink border-line hover:border-brand'
                                          : 'bg-page text-muted border-line opacity-45 line-through'
                                    }`}
                                  >
                                    {isSelected && (
                                      <motion.span
                                        layoutId="sf-detail-size-pill"
                                        transition={SF_SPRING_PILL}
                                        style={{
                                          backgroundColor: 'var(--sf-primary)',
                                        }}
                                        className="absolute inset-0 rounded-xl shadow-xs"
                                      />
                                    )}
                                    <span className="relative z-10">
                                      {sz} {!hasStockForSize && '(Esgotado)'}
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </LayoutGroup>
                        </div>
                      )}

                      {/* Seleção de Cor com pílula deslizante */}
                      {colors.length > 0 && (
                        <div className="space-y-2.5">
                          <label className="text-xs font-extrabold uppercase tracking-wider text-muted block">
                            Cor:{' '}
                            <strong
                              className={
                                isDarkTheme ? 'text-on-brand' : 'text-ink'
                              }
                            >
                              {chosenColor}
                            </strong>
                          </label>
                          <LayoutGroup id="sf-detail-colors">
                            <div className="flex flex-wrap gap-2">
                              {colors.map((cl) => {
                                const matchingVariant = variants.find(
                                  (v) =>
                                    (sizes.length === 0 ||
                                      v.size === chosenSize) &&
                                    v.color === cl,
                                );
                                const available = Boolean(
                                  matchingVariant?.inStock &&
                                    Number(
                                      matchingVariant?.availableStock ?? 0,
                                    ) > 0,
                                );
                                const isSelected = chosenColor === cl;
                                return (
                                  <motion.button
                                    key={cl}
                                    type="button"
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setChosenColor(cl)}
                                    className={`relative px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'text-on-brand border-transparent'
                                        : available
                                          ? isDarkTheme
                                            ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                                            : 'bg-page text-ink border-line hover:border-brand'
                                          : 'bg-page text-muted border-line opacity-45 line-through'
                                    }`}
                                  >
                                    {isSelected && (
                                      <motion.span
                                        layoutId="sf-detail-color-pill"
                                        transition={SF_SPRING_PILL}
                                        style={{
                                          backgroundColor: 'var(--sf-primary)',
                                        }}
                                        className="absolute inset-0 rounded-xl shadow-xs"
                                      />
                                    )}
                                    <span className="relative z-10">
                                      {cl} {!available && '(Indisponível)'}
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </LayoutGroup>
                        </div>
                      )}

                      {/* Quantidade e disponibilidade da variação */}
                      <div
                        className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                          isDarkTheme
                            ? 'bg-ink border-muted/40'
                            : 'bg-page border-line'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-extrabold">
                            Disponibilidade imediata
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {variantInStock
                              ? variantAvailableStock <= 5
                                ? `Últimas ${variantAvailableStock} unidade(s) disponíveis`
                                : 'Em estoque para reserva imediata'
                              : 'Esta combinação está sem estoque no momento'}
                          </p>
                        </div>
                        {variantInStock && (
                          <div className="flex items-center gap-2 shrink-0">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.88 }}
                              onClick={() =>
                                setChosenQuantity((q) => Math.max(1, q - 1))
                              }
                              className="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-ink hover:border-brand cursor-pointer"
                            >
                              <Minus size={14} />
                            </motion.button>
                            <span className="w-8 text-center font-extrabold text-sm tabular-nums">
                              {chosenQuantity}
                            </span>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.88 }}
                              onClick={() =>
                                setChosenQuantity((q) =>
                                  Math.min(variantAvailableStock, q + 1),
                                )
                              }
                              className="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-ink hover:border-brand cursor-pointer"
                            >
                              <Plus size={14} />
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <motion.button
                        type="button"
                        whileTap={variantInStock ? { scale: 0.98 } : undefined}
                        disabled={!variantInStock}
                        onClick={() => {
                          setJustAddedDetail(true);
                          window.setTimeout(
                            () => setJustAddedDetail(false),
                            900,
                          );
                          handleAddVariantToCart(
                            productDetail,
                            selectedVariant,
                            chosenQuantity,
                            { openDrawer: true },
                          );
                        }}
                        style={
                          variantInStock
                            ? {
                                backgroundColor: 'var(--sf-primary)',
                                color: '#FFFFFF',
                              }
                            : undefined
                        }
                        className="w-full py-4 px-6 rounded-2xl disabled:opacity-40 font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer hover:opacity-95"
                      >
                        {justAddedDetail ? (
                          <>
                            <Check size={18} />
                            <span>Adicionado à Sacola!</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={17} />
                            <span>
                              {variantInStock
                                ? `Adicionar à Sacola • ${formatBrl(unitPrice * chosenQuantity)}`
                                : 'Variação Indisponível'}
                            </span>
                          </>
                        )}
                      </motion.button>

                      {cartCount > 0 && (
                        <Link
                          to={`/loja/${slug}/finalizar`}
                          className="w-full py-3 px-6 rounded-2xl bg-support text-brand font-extrabold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition"
                        >
                          <span>
                            Finalizar pedido agora ({cartCount}{' '}
                            {cartCount === 1 ? 'item' : 'itens'})
                          </span>
                          <ArrowRight size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Produtos relacionados */}
                {relatedProducts.length > 0 && (
                  <div className="mt-10 space-y-4">
                    <h3 className="text-base sm:text-lg font-extrabold">
                      Veja também nesta categoria
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-5">
                      {relatedProducts.map((rel: any, idx: number) => (
                        <StorefrontProductCard
                          key={rel.id}
                          product={rel}
                          index={idx}
                          isDark={isDarkTheme}
                          onSelect={() => handleNavigateToProduct(rel.slug, rel)}
                          onQuickAdd={(p, v, src) =>
                            handleAddVariantToCart(p, v, 1, {
                              openDrawer: false,
                              source: src,
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Barra fixa mobile de adição rápida no detalhe */}
                <div className="fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface/95 border-t border-line backdrop-blur-md sm:hidden flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted truncate">
                      {[chosenSize && `Tam ${chosenSize}`, chosenColor]
                        .filter(Boolean)
                        .join(' • ') || productDetail.title}
                    </p>
                    <p className="text-base font-extrabold text-brand tabular-nums">
                      {formatBrl(unitPrice * chosenQuantity)}
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={variantInStock ? { scale: 0.96 } : undefined}
                    disabled={!variantInStock}
                    onClick={() =>
                      handleAddVariantToCart(
                        productDetail,
                        selectedVariant,
                        chosenQuantity,
                        { openDrawer: true },
                      )
                    }
                    style={
                      variantInStock
                        ? {
                            backgroundColor: 'var(--sf-primary)',
                            color: '#FFFFFF',
                          }
                        : undefined
                    }
                    className="px-5 py-3 rounded-2xl font-extrabold text-xs inline-flex items-center gap-2 shrink-0 disabled:opacity-45 shadow-xs"
                  >
                    <ShoppingBag size={15} />
                    <span>{variantInStock ? 'Adicionar' : 'Esgotado'}</span>
                  </motion.button>
                </div>

                {/* Lightbox de foto em tela cheia */}
                <AnimatePresence>
                  {lightboxOpen && currentPhoto && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      onClick={() => setLightboxOpen(false)}
                      className="fixed inset-0 z-[95] bg-ink/90 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                      <button
                        type="button"
                        aria-label="Fechar ampliação"
                        onClick={() => setLightboxOpen(false)}
                        className="absolute top-4 right-4 p-2.5 rounded-2xl bg-surface text-ink shadow-md cursor-pointer"
                      >
                        <X size={20} />
                      </button>
                      <motion.img
                        initial={{ scale: 0.94, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={SF_SPRING_SNAPPY}
                        src={getFullUrl(currentPhoto)}
                        alt={productDetail.title}
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-full max-h-[88dvh] rounded-2xl object-contain shadow-2xl"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : null}
          </div>
        </div>
      );
    }

    // ── ROTA: /loja/:slug/carrinho e /loja/:slug/finalizar ──────────────────
    if (isCartPage || isCheckoutPage) {
      return (
        <div
          style={themeStyles}
          className={`min-h-screen pb-16 ${
            isDarkTheme ? 'bg-ink text-on-brand' : 'bg-page text-ink'
          }`}
        >
          <StorefrontSubpageHeader
            slug={slug}
            storeData={storeData}
            backTo={isCheckoutPage ? `/loja/${slug}/carrinho` : `/loja/${slug}`}
            backLabel={
              isCheckoutPage ? 'Voltar à sacola' : 'Continuar comprando'
            }
            stepLabel={isCheckoutPage ? 'Finalizar Pedido' : 'Sua Sacola'}
            cartCount={cartCount}
            cartTotal={cartTotal}
            bagPulseKey={bagPulseKey}
            onOpenCart={() => setCartDrawerOpen(true)}
            showCartButton={false}
          />

          <div className={`${SF_CONTAINER} pt-6 sm:pt-8`}>
            <div className="max-w-5xl mx-auto space-y-5">
              {isOffline && (
                <div className="bg-support border border-brand rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm text-ink">
                  <WifiOff size={18} className="text-brand shrink-0" />
                  <span>
                    Você está offline. Não é possível confirmar pedidos sem
                    conexão; assim que reconectar, os preços e o estoque serão
                    revalidados.
                  </span>
                </div>
              )}

              {cartItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface text-ink border border-line rounded-3xl p-12 text-center space-y-3.5 shadow-2xs"
                >
                  <div className="w-16 h-16 rounded-3xl bg-support text-brand flex items-center justify-center mx-auto">
                    <ShoppingBag size={28} />
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-ink">
                    Sua sacola está vazia
                  </h2>
                  <p className="text-xs text-muted max-w-xs mx-auto">
                    Explore o catálogo da loja e escolha suas mercadorias.
                  </p>
                  <Link
                    to={`/loja/${slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-on-brand font-extrabold text-xs mt-1"
                  >
                    <span>Ver Catálogo</span>
                    <ArrowRight size={14} />
                  </Link>
                </motion.div>
              ) : isCartPage ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 space-y-3">
                    <AnimatePresence initial={false}>
                      {cartItems.map((item) => {
                        const valItem = cartValidation?.items?.find(
                          (vi: any) => vi.productId === item.productId,
                        );
                        const outOfStock = valItem && !valItem.available;

                        return (
                          <motion.div
                            key={item.productId}
                            layout="position"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 24, height: 0 }}
                            transition={{ duration: 0.2, ease: SF_EASE_OUT }}
                            className={`bg-surface text-ink border rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs ${
                              outOfStock
                                ? 'border-brand bg-support/40'
                                : 'border-line'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <Link
                                to={`/loja/${slug}/produto/${item.productSlug}`}
                                className="w-16 h-20 rounded-2xl overflow-hidden border border-line bg-page shrink-0"
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
                              </Link>
                              <div className="min-w-0">
                                <Link
                                  to={`/loja/${slug}/produto/${item.productSlug}`}
                                  className="font-bold text-sm text-ink hover:text-brand truncate block"
                                >
                                  {item.productName}
                                </Link>
                                {(item.size || item.color) && (
                                  <p className="text-xs text-muted mt-0.5">
                                    {[
                                      item.size && `Tam: ${item.size}`,
                                      item.color && `Cor: ${item.color}`,
                                    ]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </p>
                                )}
                                <p className="text-sm font-extrabold text-brand mt-1 tabular-nums">
                                  {formatBrl(item.priceUnit * item.quantity)}
                                </p>
                                {outOfStock && (
                                  <p className="text-xs font-bold text-brand mt-1 inline-flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    <span>
                                      Disponível no momento:{' '}
                                      {valItem.availableStock} un.
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.88 }}
                                onClick={() =>
                                  setCartItemQuantity(
                                    storeData.publicId,
                                    storeData.slug,
                                    item.productId,
                                    item.quantity - 1,
                                  )
                                }
                                className="w-8 h-8 rounded-xl bg-page border border-line flex items-center justify-center text-ink hover:border-brand cursor-pointer"
                              >
                                <Minus size={13} />
                              </motion.button>
                              <span className="w-7 text-center font-extrabold text-sm tabular-nums">
                                {item.quantity}
                              </span>
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.88 }}
                                onClick={() =>
                                  setCartItemQuantity(
                                    storeData.publicId,
                                    storeData.slug,
                                    item.productId,
                                    item.quantity + 1,
                                  )
                                }
                                className="w-8 h-8 rounded-xl bg-page border border-line flex items-center justify-center text-ink hover:border-brand cursor-pointer"
                              >
                                <Plus size={13} />
                              </motion.button>
                              <button
                                type="button"
                                onClick={() =>
                                  setCartItemQuantity(
                                    storeData.publicId,
                                    storeData.slug,
                                    item.productId,
                                    0,
                                  )
                                }
                                className="p-2 text-muted hover:text-brand ml-1 cursor-pointer"
                                title="Remover item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <div className="lg:col-span-4">
                    <div className="bg-surface text-ink border border-line rounded-3xl p-5 sm:p-6 space-y-4 sticky top-20 shadow-xs">
                      <h3 className="font-extrabold text-base text-ink">
                        Resumo do Pedido
                      </h3>
                      <div className="space-y-2 text-xs sm:text-sm border-b border-line pb-3">
                        <div className="flex justify-between text-muted">
                          <span>Itens ({cartCount})</span>
                          <span className="tabular-nums">
                            {formatBrl(cartTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted text-xs">
                          <span>Entrega / Retirada</span>
                          <span>Escolher na próxima etapa</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-sm">
                          Total dos produtos
                        </span>
                        <span className="text-xl font-extrabold text-brand tabular-nums">
                          {formatBrl(cartTotal)}
                        </span>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        disabled={validatingCart || isOffline}
                        onClick={async () => {
                          const val = await revalidateCartOnServer(false);
                          if (val?.hasStockShortage) {
                            toast.error(
                              'Ajuste as quantidades dos itens com estoque insuficiente antes de avançar.',
                            );
                            return;
                          }
                          navigate(`/loja/${slug}/finalizar`);
                        }}
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="w-full py-3.5 px-5 rounded-2xl disabled:opacity-50 font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                      >
                        {validatingCart ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            <span>Conferindo estoque...</span>
                          </>
                        ) : (
                          <>
                            <span>Continuar para Identificação</span>
                            <ArrowRight size={15} />
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Formulário de Finalização (/loja/:slug/finalizar) */
                <form
                  onSubmit={handleSubmitOrder}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6"
                >
                  <div className="lg:col-span-7 space-y-5">
                    {priceDivergenceAlert && (
                      <div className="bg-support border border-brand rounded-2xl p-4 space-y-2 text-ink">
                        <p className="text-xs font-extrabold text-brand flex items-center gap-1.5">
                          <AlertCircle size={15} />
                          <span>Preços atualizados no servidor</span>
                        </p>
                        <p className="text-xs">
                          Os valores abaixo foram atualizados na sua sacola.
                          Confira e clique em <strong>Registrar Pedido</strong>{' '}
                          novamente para confirmar:
                        </p>
                        <ul className="text-xs text-muted space-y-1">
                          {priceDivergenceAlert.map((d: any) => (
                            <li key={d.productId}>
                              • <strong>{d.productName}</strong>: de{' '}
                              {formatBrl(d.expectedPriceUnit)} para{' '}
                              <strong className="text-brand">
                                {formatBrl(d.currentPriceUnit)}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-surface text-ink border border-line rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-brand" />
                        <h3 className="font-extrabold text-sm sm:text-base text-ink">
                          1. Seus Dados para Atendimento
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-ink block mb-1">
                            Nome Completo *
                          </label>
                          <input
                            type="text"
                            required
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Ex.: Maria Silva"
                            className="w-full p-3 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-ink block mb-1">
                            WhatsApp com DDD *
                          </label>
                          <input
                            type="tel"
                            required
                            value={customerPhone}
                            onChange={(e) =>
                              setCustomerPhone(formatPhoneInput(e.target.value))
                            }
                            placeholder="(11) 99999-9999"
                            className="w-full p-3 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-ink block mb-1">
                            CPF (Opcional)
                          </label>
                          <input
                            type="text"
                            value={customerCpf}
                            onChange={(e) =>
                              setCustomerCpf(formatCpfInput(e.target.value))
                            }
                            placeholder="Opcional para nota fiscal"
                            className="w-full p-3 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-surface text-ink border border-line rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-brand" />
                        <h3 className="font-extrabold text-sm sm:text-base text-ink">
                          2. Modalidade de Recebimento
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {storeData?.pickupEnabled && (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setFulfillmentMode('PICKUP')}
                            className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                              fulfillmentMode === 'PICKUP'
                                ? 'border-brand bg-support shadow-2xs'
                                : 'border-line bg-page hover:border-brand/50'
                            }`}
                          >
                            <Store
                              size={18}
                              className="text-brand shrink-0 mt-0.5"
                            />
                            <div>
                              <p className="font-extrabold text-xs sm:text-sm text-ink">
                                Retirar na Loja
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                Sem taxa de entrega. Combine a retirada pelo
                                WhatsApp.
                              </p>
                            </div>
                          </motion.button>
                        )}
                        {storeData?.deliveryEnabled && (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setFulfillmentMode('DELIVERY')}
                            className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                              fulfillmentMode === 'DELIVERY'
                                ? 'border-brand bg-support shadow-2xs'
                                : 'border-line bg-page hover:border-brand/50'
                            }`}
                          >
                            <Truck
                              size={18}
                              className="text-brand shrink-0 mt-0.5"
                            />
                            <div>
                              <p className="font-extrabold text-xs sm:text-sm text-ink">
                                Entrega a Combinar
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                {storeData?.deliveryFeeNote ||
                                  'Taxa e prazo combinados pelo WhatsApp.'}
                              </p>
                            </div>
                          </motion.button>
                        )}
                      </div>

                      {/* Acordeão suave para campos de endereço quando Entrega é escolhida */}
                      <AnimatePresence initial={false}>
                        {fulfillmentMode === 'DELIVERY' && (
                          <motion.div
                            key="delivery-address-fields"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.24, ease: SF_EASE_OUT }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 pt-3 border-t border-line">
                              <div className="sm:col-span-2">
                                <label className="text-xs font-bold text-ink flex items-center justify-between mb-1">
                                  <span>CEP</span>
                                  {loadingCep && (
                                    <Loader2
                                      size={12}
                                      className="animate-spin text-brand"
                                    />
                                  )}
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={zipCode}
                                  onChange={(e) =>
                                    setZipCode(formatCepInput(e.target.value))
                                  }
                                  placeholder="00000-000"
                                  className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                                />
                              </div>
                              <div className="sm:col-span-4">
                                <label className="text-xs font-bold text-ink block mb-1">
                                  Rua / Logradouro *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={street}
                                  onChange={(e) => setStreet(e.target.value)}
                                  placeholder="Rua, Avenida..."
                                  className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-xs font-bold text-ink block mb-1">
                                  Número *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={number}
                                  onChange={(e) => setNumber(e.target.value)}
                                  placeholder="Nº"
                                  className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-xs font-bold text-ink block mb-1">
                                  Bairro *
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={neighborhood}
                                  onChange={(e) =>
                                    setNeighborhood(e.target.value)
                                  }
                                  placeholder="Bairro"
                                  className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-xs font-bold text-ink block mb-1">
                                  Complemento / Apto
                                </label>
                                <input
                                  type="text"
                                  value={complement}
                                  onChange={(e) => setComplement(e.target.value)}
                                  placeholder="Bloco, apto..."
                                  className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <label className="text-xs font-bold text-ink block mb-1">
                                  Cidade / UF
                                </label>
                                <input
                                  type="text"
                                  value={city}
                                  onChange={(e) => setCity(e.target.value)}
                                  placeholder="Cidade"
                                  className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <label className="text-xs font-bold text-ink block mb-1">
                                  Ponto de Referência
                                </label>
                                <input
                                  type="text"
                                  value={addressRef}
                                  onChange={(e) => setAddressRef(e.target.value)}
                                  placeholder="Próximo a..."
                                  className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div>
                        <label className="text-xs font-bold text-ink block mb-1">
                          Observações do Pedido (Opcional)
                        </label>
                        <textarea
                          rows={2}
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          placeholder="Ex.: preferência de horário, embalagem para presente, forma de pagamento preferida..."
                          className="w-full p-3 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand focus:bg-surface outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="bg-surface text-ink border border-line rounded-3xl p-5 sm:p-6 space-y-4 sticky top-20 shadow-xs">
                      <h3 className="font-extrabold text-sm sm:text-base text-ink">
                        Confirmação dos Itens
                      </h3>
                      <div className="divide-y divide-line max-h-64 overflow-y-auto pr-1">
                        {cartItems.map((item) => (
                          <div
                            key={item.productId}
                            className="py-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-ink truncate">
                                {item.quantity}x {item.productName}
                              </p>
                              {(item.size || item.color) && (
                                <p className="text-muted">
                                  {[item.size, item.color]
                                    .filter(Boolean)
                                    .join(' / ')}
                                </p>
                              )}
                            </div>
                            <span className="font-extrabold text-ink shrink-0 tabular-nums">
                              {formatBrl(item.priceUnit * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-line pt-3 flex items-baseline justify-between">
                        <span className="font-bold text-sm">
                          Total dos produtos
                        </span>
                        <span className="text-2xl font-extrabold text-brand tabular-nums">
                          {formatBrl(cartTotal)}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-page border border-line text-xs text-muted space-y-1">
                        <p className="font-extrabold text-ink flex items-center gap-1.5">
                          <Clock size={13} className="text-brand" />
                          <span>
                            Reserva imediata por{' '}
                            {storeData?.confirmReservationMinutes || 30} minutos
                          </span>
                        </p>
                        <p className="leading-relaxed">
                          Ao clicar abaixo, seu pedido será salvo com código
                          único e você abrirá o WhatsApp da loja com o resumo
                          pronto.
                        </p>
                      </div>

                      <motion.button
                        type="submit"
                        whileTap={{ scale: 0.98 }}
                        disabled={submittingOrder || isOffline}
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="w-full py-4 px-5 rounded-2xl disabled:opacity-50 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer hover:opacity-95"
                      >
                        {submittingOrder ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Registrando pedido...</span>
                          </>
                        ) : (
                          <>
                            <MessageCircle size={16} />
                            <span>
                              Registrar Pedido e Continuar no WhatsApp
                            </span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── ROTA PADRÃO: /loja/:slug (Vitrine Principal) ────────────────────────
    return (
      <StorefrontHomeView
        storeData={storeData}
        products={displayedProducts}
        loadingProducts={loadingInitialCatalog}
        syncingProducts={syncingCatalog}
        search={search}
        setSearch={setSearch}
        selectedCategoryId={selectedCategoryId}
        setSelectedCategoryId={setSelectedCategoryId}
        selectedSize={selectedSize}
        setSelectedSize={setSelectedSize}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        sortBy={sortBy}
        setSortBy={setSortBy}
        inStockOnly={inStockOnly}
        setInStockOnly={setInStockOnly}
        cartCount={cartCount}
        cartTotal={cartTotal}
        bagPulseKey={bagPulseKey}
        onSelectProduct={handleNavigateToProduct}
        onQuickAdd={(prod, variant, qty = 1, source) =>
          handleAddVariantToCart(prod, variant, qty, {
            openDrawer: false,
            source,
          })
        }
        onOpenCart={() => setCartDrawerOpen(true)}
        recentOrders={recentOrders}
        onSelectOrder={(ref, token) => {
          if (typeof window !== 'undefined') {
            catalogScrollYRef.current = window.scrollY;
          }
          navigate(
            `/loja/${slug}/pedido/${ref}${
              token ? `?token=${encodeURIComponent(token)}` : ''
            }`,
          );
        }}
      />
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeRouteKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={SF_VIEW_TRANSITION}
        >
          {renderActiveRouteView()}
        </motion.div>
      </AnimatePresence>

      {/* Barra Flutuante Mobile da Sacola na Vitrine Principal */}
      <MobileFloatingCartBar
        visible={
          currentViewType === 'home' && cartCount > 0 && !cartDrawerOpen
        }
        cartCount={cartCount}
        cartTotal={cartTotal}
        pulseKey={bagPulseKey}
        onOpenCart={() => setCartDrawerOpen(true)}
      />

      {/* Gaveta Lateral / Bottom-Sheet Persistente da Sacola */}
      <StorefrontCartDrawer
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        cartItems={cartItems}
        cartCount={cartCount}
        cartTotal={cartTotal}
        cartValidation={cartValidation}
        validatingCart={validatingCart}
        isOffline={isOffline}
        isDark={isDarkTheme}
        themeStyles={themeStyles}
        onUpdateQuantity={(productId, nextQty) => {
          if (!storeData?.publicId) return;
          setCartItemQuantity(
            storeData.publicId,
            storeData.slug,
            productId,
            nextQty,
          );
        }}
        onClearCart={() => {
          if (!storeData?.publicId) return;
          clearStoreCart(storeData.publicId, storeData.slug);
        }}
        onNavigateProduct={(prodSlug) => handleNavigateToProduct(prodSlug)}
        onProceedCheckout={handleProceedFromDrawerToCheckout}
        onOpenCartPage={() => {
          if (currentViewType === 'home' && typeof window !== 'undefined') {
            catalogScrollYRef.current = window.scrollY;
          }
          setCartDrawerOpen(false);
          navigate(`/loja/${slug}/carrinho`);
        }}
      />

      {/* Camada de animação Fly-to-Bag (GPU Portal) */}
      <FlyToBagOverlay
        tokens={flyTokens}
        onCompleteToken={handleCompleteFlyToken}
      />
    </MotionConfig>
  );
}

export default PublicStorefrontApp;
