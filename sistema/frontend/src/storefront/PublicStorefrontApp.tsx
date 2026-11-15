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
import { StockItemThumb } from '@/components/EntityPhotos';
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
  useStorefrontWindow,
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
import {
  StorefrontCampaignVisual,
  StorefrontProductFrame,
} from './components/StorefrontProductFrame';
import {
  StorefrontBannerSection,
  StorefrontProductSelectionSection,
  StorefrontShopTheLook,
  type BannerTargetAction,
} from './components/StorefrontSections';
import {
  StorefrontCheckoutRouteCalculator,
  StorefrontOrderDeliveryScene,
  type PublicExpressQuoteResponse,
} from './components/StorefrontDeliveryAnimation';

const SF_CONTAINER =
  'max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12';

export function getTemplateComposition(template?: string) {
  if (template === 'minimal_branco') {
    return {
      container: 'max-w-[1220px] mx-auto w-full px-4 sm:px-8 lg:px-12',
      catalogGrid: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7',
      heroTitleClass:
        'text-2xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-[1.1]',
      headerNameClass:
        'font-semibold text-sm sm:text-base lg:text-lg tracking-tight truncate group-hover:text-brand transition-colors',
      sectionGap: 'py-5 sm:py-7',
      defaultSelectionCols: 3,
    };
  }
  if (template === 'vitrine_escura') {
    return {
      container: 'max-w-[1520px] mx-auto w-full px-4 sm:px-6 lg:px-8',
      catalogGrid:
        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4',
      heroTitleClass:
        'text-2xl sm:text-3xl lg:text-4xl xl:text-[2.7rem] font-extrabold uppercase tracking-tight leading-[1.08]',
      headerNameClass:
        'font-extrabold uppercase text-sm sm:text-base lg:text-lg tracking-wide truncate group-hover:text-brand transition-colors',
      sectionGap: 'py-3.5 sm:py-5',
      defaultSelectionCols: 4,
    };
  }
  return {
    container: 'max-w-[1380px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10',
    catalogGrid:
      'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5',
    heroTitleClass:
      'text-2xl sm:text-3xl lg:text-4xl xl:text-[2.55rem] font-extrabold tracking-tight leading-[1.12]',
    headerNameClass:
      'font-bold text-sm sm:text-base lg:text-lg tracking-tight truncate group-hover:text-brand transition-colors',
    sectionGap: 'py-4 sm:py-5',
    defaultSelectionCols: 4,
  };
}

export function resolveCollectionsWithProducts(
  storeData: any,
  catalogPool: any[],
): any[] {
  const byId = new Map<string, any>();
  for (const p of catalogPool) {
    if (!p) continue;
    if (p.id) byId.set(String(p.id), p);
    if (p.retailGroupId) byId.set(String(p.retailGroupId), p);
    if (p.slug) byId.set(String(p.slug), p);
  }

  const rawList = Array.isArray(storeData?.collections)
    ? storeData.collections
    : Array.isArray(storeData?.theme?.collections)
      ? storeData.theme.collections
      : [];

  return rawList
    .filter((col: any) => col && col.enabled !== false)
    .map((col: any) => {
      if (Array.isArray(col.products) && col.products.length > 0) {
        const refreshed = col.products
          .map(
            (cp: any) =>
              byId.get(String(cp.id || cp.retailGroupId || cp.slug)) || cp,
          )
          .filter(Boolean);
        return { ...col, products: refreshed };
      }
      const ids: string[] = Array.isArray(col.productIds) ? col.productIds : [];
      const resolved = ids
        .map((id) => byId.get(String(id)))
        .filter(Boolean);
      return { ...col, products: resolved };
    });
}

export function resolveSelectionProducts(
  section: any,
  catalogPool: any[],
  featuredProducts: any[],
  resolvedCollections: any[],
): { items: any[]; linkedCollection: any | null } {
  const byId = new Map<string, any>();
  for (const p of [...catalogPool, ...featuredProducts]) {
    if (!p) continue;
    if (p.id) byId.set(String(p.id), p);
    if (p.retailGroupId) byId.set(String(p.retailGroupId), p);
    if (p.slug) byId.set(String(p.slug), p);
  }

  const sourceType =
    section?.sourceType ||
    (section?.collectionId
      ? 'collection'
      : Array.isArray(section?.productIds) && section.productIds.length > 0
        ? 'manual'
        : 'featured');

  if (sourceType === 'collection' && section?.collectionId) {
    const col =
      resolvedCollections.find(
        (c) =>
          c.id === section.collectionId || c.slug === section.collectionId,
      ) || null;
    return {
      items: Array.isArray(col?.products) ? col.products : [],
      linkedCollection: col,
    };
  }

  if (sourceType === 'manual') {
    const ids: string[] = Array.isArray(section?.productIds)
      ? section.productIds
      : [];
    const items = ids.map((id) => byId.get(String(id))).filter(Boolean);
    return { items, linkedCollection: null };
  }

  const feat =
    featuredProducts.length > 0
      ? featuredProducts
      : catalogPool.filter((p) => p?.featured);
  return { items: feat, linkedCollection: null };
}

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
  allCatalogProducts,
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
  onAddLookItems,
  onOpenCart,
  onOpenCollection,
  recentOrders = [],
  onSelectOrder,
  isPreview = false,
  selectedSectionId = null,
  onSelectEditorSection,
  activeSelectionFilterId = null,
  onSelectSelectionFilter,
}: {
  storeData: any;
  products: any[];
  allCatalogProducts?: any[];
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
  onAddLookItems?: (
    entries: Array<{ product: any; variant: any; quantity: number }>,
  ) => void;
  onOpenCart?: () => void;
  onOpenCollection?: (collectionSlug: string) => void;
  recentOrders?: RecentStorefrontOrder[];
  onSelectOrder?: (reference: string, accessToken?: string) => void;
  isPreview?: boolean;
  selectedSectionId?: string | null;
  onSelectEditorSection?: (sectionId: string) => void;
  activeSelectionFilterId?: string | null;
  onSelectSelectionFilter?: (sectionId: string | null) => void;
}) {
  const win = useStorefrontWindow();
  const theme = storeData?.theme || {};
  const template = theme.template || 'editorial_roxo';
  const isDark = template === 'vitrine_escura';
  const isMinimal = template === 'minimal_branco';
  const composition = getTemplateComposition(template);
  const containerClass = composition.container;
  const layoutScope = isPreview ? 'sf-preview' : 'sf-public';

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [quickVariantState, setQuickVariantState] = useState<{
    product: any | null;
    initialSize: string | null;
  }>({ product: null, initialSize: null });
  const [internalSelectionId, setInternalSelectionId] = useState<string | null>(
    null,
  );
  const lastClickedSectionRef = useRef<string | null>(null);

  const effectiveSelectionId =
    onSelectSelectionFilter !== undefined
      ? activeSelectionFilterId
      : internalSelectionId;
  const setEffectiveSelectionId = useCallback(
    (nextId: string | null) => {
      if (onSelectSelectionFilter) {
        onSelectSelectionFilter(nextId);
      } else {
        setInternalSelectionId(nextId);
      }
    },
    [onSelectSelectionFilter],
  );

  // Quando o lojista clica numa seção na lista lateral do editor, rola suavemente até ela na prévia
  useEffect(() => {
    if (!isPreview || !selectedSectionId || !win?.document) return;
    if (lastClickedSectionRef.current === selectedSectionId) {
      lastClickedSectionRef.current = null;
      return;
    }
    const el = win.document.querySelector<HTMLElement>(
      `[data-sf-section-id="${selectedSectionId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isPreview, selectedSectionId, win]);

  const defaultSections = [
    { id: 'sec-header', type: 'header', enabled: true },
    { id: 'sec-hero', type: 'hero', enabled: true },
    { id: 'sec-categories', type: 'categories', enabled: true },
    { id: 'sec-featured', type: 'featured', enabled: true },
    { id: 'sec-collection', type: 'collection', enabled: true },
    { id: 'sec-fulfillment', type: 'fulfillment_info', enabled: true },
    { id: 'sec-footer', type: 'footer', enabled: true },
  ];

  const sections: any[] = useMemo(() => {
    const rawSections =
      Array.isArray(theme.sections) && theme.sections.length > 0
        ? theme.sections
        : defaultSections;
    const hasExplicitBannerSection = rawSections.some(
      (s: any) => s && s.type === 'banner',
    );
    const legacyBanners =
      !hasExplicitBannerSection && Array.isArray(theme.banners)
        ? theme.banners.filter((b: any) => b && b.enabled !== false)
        : [];

    if (legacyBanners.length === 0) {
      return rawSections.filter((s: any) => s && s.enabled !== false);
    }

    // Compatibilidade automática com configurações legadas onde banners ficavam acoplados à capa
    const expanded: any[] = [];
    let inserted = false;
    for (const sec of rawSections) {
      if (!sec || sec.enabled === false) continue;
      expanded.push(sec);
      if (sec.type === 'hero' && !inserted) {
        for (let i = 0; i < legacyBanners.length; i += 1) {
          const b = legacyBanners[i];
          expanded.push({
            id: b.id ? `sec-banner-${b.id}` : `sec-banner-${i + 1}`,
            type: 'banner',
            bannerId: b.id,
            title: b.title || `Banner ${i + 1}`,
            enabled: true,
          });
        }
        inserted = true;
      }
    }
    if (!inserted) {
      const headerIdx = expanded.findIndex((s) => s.type === 'header');
      const insertAt = headerIdx >= 0 ? headerIdx + 1 : 0;
      expanded.splice(
        insertAt,
        0,
        ...legacyBanners.map((b: any, i: number) => ({
          id: b.id ? `sec-banner-${b.id}` : `sec-banner-${i + 1}`,
          type: 'banner',
          bannerId: b.id,
          title: b.title || `Banner ${i + 1}`,
          enabled: true,
        })),
      );
    }
    return expanded;
  }, [theme.sections, theme.banners]);

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

  const catalogPool = useMemo(() => {
    if (Array.isArray(allCatalogProducts) && allCatalogProducts.length > 0) {
      return allCatalogProducts;
    }
    if (
      Array.isArray(storeData?.initialProducts) &&
      storeData.initialProducts.length > 0
    ) {
      return storeData.initialProducts;
    }
    return products;
  }, [allCatalogProducts, storeData?.initialProducts, products]);

  const resolvedCollections = useMemo(
    () => resolveCollectionsWithProducts(storeData, catalogPool),
    [storeData, catalogPool],
  );

  // Se o visitante clicou em "Ver seleção completa" de uma seção manual/destaque, resolve a lista completa
  const activeSelectionContext = useMemo(() => {
    if (!effectiveSelectionId) return null;
    const rawSections = Array.isArray(theme.sections) ? theme.sections : sections;
    const targetSec = rawSections.find(
      (s: any) => s && s.id === effectiveSelectionId,
    );
    if (!targetSec) return null;
    const { items } = resolveSelectionProducts(
      targetSec,
      catalogPool,
      featuredProducts,
      resolvedCollections,
    );
    return {
      id: targetSec.id,
      title:
        targetSec.title ||
        (targetSec.type === 'featured'
          ? 'Seleção em destaque'
          : 'Seleção completa'),
      items,
    };
  }, [
    effectiveSelectionId,
    theme.sections,
    sections,
    catalogPool,
    featuredProducts,
    resolvedCollections,
  ]);

  const catalogGridProducts = useMemo(() => {
    if (!activeSelectionContext) return products;
    const allowedIds = new Set(
      activeSelectionContext.items.map((p: any) =>
        String(p.id || p.retailGroupId || p.slug),
      ),
    );
    const hasNarrowFilter = Boolean(
      search || selectedCategoryId || selectedSize || selectedColor || inStockOnly,
    );
    if (!hasNarrowFilter && sortBy === 'featured') {
      return activeSelectionContext.items;
    }
    return products.filter((p: any) =>
      allowedIds.has(String(p.id || p.retailGroupId || p.slug)),
    );
  }, [
    activeSelectionContext,
    products,
    search,
    selectedCategoryId,
    selectedSize,
    selectedColor,
    inStockOnly,
    sortBy,
  ]);

  const hasActiveFilters = Boolean(
    search ||
      selectedCategoryId ||
      selectedSize ||
      selectedColor ||
      inStockOnly ||
      effectiveSelectionId,
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
    setEffectiveSelectionId(null);
  }, [
    setSearch,
    setSelectedCategoryId,
    setSelectedSize,
    setSelectedColor,
    setInStockOnly,
    setEffectiveSelectionId,
  ]);

  const scrollToCatalog = useCallback(() => {
    const doc = win?.document || (typeof document !== 'undefined' ? document : null);
    const el = doc?.getElementById(
      isPreview ? 'catalogo-loja-preview' : 'catalogo-loja',
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isPreview, win]);

  const handleBannerTargetAction = useCallback(
    (action: BannerTargetAction) => {
      const { targetType, targetValue } = action;
      if (targetType === 'category' && targetValue) {
        const matchedCat = categories.find(
          (c: any) => c.id === targetValue || c.slug === targetValue,
        );
        if (matchedCat) {
          setEffectiveSelectionId(null);
          setSelectedCategoryId(matchedCat.id);
          scrollToCatalog();
        }
        return;
      }
      if (targetType === 'product' && targetValue) {
        const matchedProd = catalogPool.find(
          (p: any) =>
            p.id === targetValue ||
            p.retailGroupId === targetValue ||
            p.slug === targetValue,
        );
        if (matchedProd) {
          onSelectProduct(matchedProd.slug, matchedProd);
        }
        return;
      }
      if (targetType === 'collection' && targetValue) {
        const matchedCol = resolvedCollections.find(
          (col: any) => col.id === targetValue || col.slug === targetValue,
        );
        if (matchedCol && onOpenCollection) {
          onOpenCollection(matchedCol.slug);
        }
        return;
      }
      if (targetType === 'featured') {
        setEffectiveSelectionId(null);
        setSortBy('featured');
        scrollToCatalog();
        return;
      }
      setEffectiveSelectionId(null);
      scrollToCatalog();
    },
    [
      categories,
      catalogPool,
      resolvedCollections,
      setEffectiveSelectionId,
      setSelectedCategoryId,
      scrollToCatalog,
      onSelectProduct,
      onOpenCollection,
      setSortBy,
    ],
  );

  const handleSectionSurfaceClick = useCallback(
    (sectionId: string) => {
      if (!onSelectEditorSection) return;
      lastClickedSectionRef.current = sectionId;
      onSelectEditorSection(sectionId);
    },
    [onSelectEditorSection],
  );

  const editorOutlineClass = (sectionId: string) => {
    if (!onSelectEditorSection) return '';
    const isSelected = selectedSectionId === sectionId;
    return isSelected
      ? 'ring-2 ring-brand ring-inset transition-shadow'
      : 'hover:ring-1 hover:ring-brand/45 hover:ring-inset transition-shadow';
  };

  return (
    <div
      style={getStoreThemeStyles(theme)}
      className={`min-h-screen flex flex-col selection:bg-brand selection:text-on-brand ${
        cartCount > 0 ? 'pb-22 sm:pb-0' : ''
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
          onClick={() => handleSectionSurfaceClick('sec-header')}
          style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
          className={`text-[11px] sm:text-xs font-semibold py-2 px-4 text-center tracking-wide border-b border-surface/15 ${
            onSelectEditorSection ? 'cursor-pointer' : ''
          }`}
        >
          {theme.announcementText}
        </div>
      )}

      {/* Barra discreta de pedidos recentes do cliente */}
      {!isPreview && recentOrders.length > 0 && onSelectOrder && (
        <div className="bg-support border-b border-line py-1.5 text-xs text-ink">
          <div
            className={`${containerClass} flex items-center justify-between gap-2 overflow-x-auto`}
          >
            <span className="font-semibold text-muted flex items-center gap-1.5 shrink-0">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-line text-[11px] font-semibold text-ink hover:border-brand transition cursor-pointer shrink-0"
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
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`sticky top-0 z-30 border-b backdrop-blur-md transition-colors ${
                isDark
                  ? 'bg-ink/94 border-muted/35'
                  : 'bg-surface/94 border-line'
              } ${editorOutlineClass(section.id)}`}
            >
              <div
                className={`${containerClass} py-3 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4`}
              >
                {/* Identidade da loja */}
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                    win?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 min-w-0 text-left group cursor-pointer"
                >
                  {storeData.logoUrl ? (
                    <img
                      src={getFullUrl(storeData.logoUrl)}
                      alt={storeData.storeName}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-contain p-1 border border-line shrink-0 bg-surface group-hover:scale-[1.03] transition-transform"
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 group-hover:scale-[1.03] transition-transform"
                    >
                      {String(storeData.storeName || 'L')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className={composition.headerNameClass}>
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
                        ? 'bg-ink border-muted/55 text-on-brand placeholder:text-line/60 focus:border-brand'
                        : 'bg-page border-line text-ink placeholder:text-muted focus:border-brand focus:bg-surface'
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

                {/* Ações do cabeçalho — Sacola sempre interativa (inclusive na simulação da prévia) */}
                <div className="flex items-center gap-2 shrink-0">
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
                </div>
              </div>
            </header>
          );
        }

        if (section.type === 'hero') {
          const hasCover = Boolean(
            storeData.coverUrl || theme.heroMobileCoverUrl,
          );
          const heroHeight: 'sm' | 'md' | 'lg' =
            theme.heroHeight === 'sm' || theme.heroHeight === 'lg'
              ? theme.heroHeight
              : 'md';

          const coverAspectClass =
            heroHeight === 'sm'
              ? 'aspect-[16/9] sm:aspect-[16/8] max-h-[260px]'
              : heroHeight === 'lg'
                ? 'aspect-[4/3] sm:aspect-[16/10] lg:aspect-[5/4] max-h-[430px]'
                : 'aspect-[16/10] sm:aspect-[16/9] lg:aspect-[5/4] max-h-[340px]';

          const darkHeroHeightClass =
            heroHeight === 'sm'
              ? 'min-h-[240px] sm:min-h-[290px]'
              : heroHeight === 'lg'
                ? 'min-h-[340px] sm:min-h-[460px]'
                : 'min-h-[290px] sm:min-h-[380px]';

          return (
            <section
              key={section.id}
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`${containerClass} pt-4 sm:pt-6 pb-2 ${editorOutlineClass(section.id)}`}
            >
              {/* Composição 3: Vitrine Escura com capa em sangria total e sobreposição de lookbook */}
              {isDark && hasCover ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: SF_EASE_OUT }}
                  className={`relative rounded-3xl border border-muted/40 bg-ink overflow-hidden flex items-end ${darkHeroHeightClass}`}
                >
                  <div className="absolute inset-0">
                    <StorefrontCampaignVisual
                      imageUrl={storeData.coverUrl}
                      mobileImageUrl={theme.heroMobileCoverUrl}
                      alt={storeData.storeName}
                      focalX={theme.heroFocalX}
                      focalY={theme.heroFocalY}
                      eager
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/20 sm:bg-gradient-to-r sm:from-ink/95 sm:via-ink/72 sm:to-ink/20"
                    />
                  </div>

                  <div className="relative z-10 w-full p-6 sm:p-9 lg:p-12 max-w-2xl space-y-4 text-on-brand">
                    {(pickupEnabled || deliveryEnabled) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-line">
                        {pickupEnabled && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/12 border border-surface/15">
                            <Store size={12} />
                            <span>Retirada na loja</span>
                          </span>
                        )}
                        {deliveryEnabled && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/12 border border-surface/15">
                            <Truck size={12} />
                            <span>Entrega</span>
                          </span>
                        )}
                      </div>
                    )}

                    <h2 className={composition.heroTitleClass}>
                      {theme.heroTitle ||
                        `Coleção ${storeData.storeName || 'Oficial'}`}
                    </h2>

                    <p className="text-xs sm:text-sm lg:text-base text-line/95 leading-relaxed max-w-xl">
                      {theme.heroSubtitle ||
                        storeData.description ||
                        'Confira disponibilidade por tamanho e cor, monte sua sacola e finalize seu pedido.'}
                    </p>

                    <div className="pt-1">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={scrollToCatalog}
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer hover:opacity-95 transition"
                      >
                        <span>{theme.heroCtaLabel || 'Explorar catálogo'}</span>
                        <ArrowRight size={15} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ) : isMinimal ? (
                /* Composição 2: Minimalista Branco — Galeria arejada 6/6, sem sombras ou excesso de selos */
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: SF_EASE_OUT }}
                  className="rounded-3xl border border-line bg-page overflow-hidden"
                >
                  <div
                    className={`grid grid-cols-1 ${
                      hasCover ? 'lg:grid-cols-12' : ''
                    } items-center`}
                  >
                    <div
                      className={`p-6 sm:p-10 lg:p-14 space-y-4 sm:space-y-5 ${
                        hasCover
                          ? 'lg:col-span-6'
                          : 'max-w-2xl mx-auto text-center items-center flex flex-col'
                      }`}
                    >
                      {(pickupEnabled || deliveryEnabled) && (
                        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
                          {[
                            pickupEnabled && 'Retirada na loja',
                            deliveryEnabled && 'Entrega disponível',
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      )}

                      <h2 className={composition.heroTitleClass}>
                        {theme.heroTitle ||
                          `Coleção ${storeData.storeName || 'Oficial'}`}
                      </h2>

                      <p className="text-sm sm:text-base text-muted leading-relaxed max-w-lg">
                        {theme.heroSubtitle ||
                          storeData.description ||
                          'Peças selecionadas com disponibilidade sincronizada por tamanho e cor.'}
                      </p>

                      <div className="pt-1">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={scrollToCatalog}
                          style={{
                            backgroundColor: 'var(--sf-primary)',
                            color: '#FFFFFF',
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-xs sm:text-sm cursor-pointer hover:opacity-95 transition"
                        >
                          <span>
                            {theme.heroCtaLabel || 'Explorar catálogo'}
                          </span>
                          <ArrowRight size={15} />
                        </motion.button>
                      </div>
                    </div>

                    {hasCover && (
                      <div className="lg:col-span-6 p-4 pt-0 sm:p-6 lg:p-6 lg:pl-0">
                        <div
                          className={`w-full ${coverAspectClass} rounded-2xl overflow-hidden border border-line bg-surface`}
                        >
                          <StorefrontCampaignVisual
                            imageUrl={storeData.coverUrl}
                            mobileImageUrl={theme.heroMobileCoverUrl}
                            alt={storeData.storeName}
                            focalX={theme.heroFocalX}
                            focalY={theme.heroFocalY}
                            eager
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                /* Composição 1: Editorial Roxo (ou Vitrine Escura sem foto de capa) — Split 7/5 */
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26, ease: SF_EASE_OUT }}
                  style={
                    isDark
                      ? { backgroundColor: '#272321', color: '#FFFFFF' }
                      : {
                          background:
                            'linear-gradient(135deg, var(--sf-primary) 0%, var(--sf-accent) 100%)',
                          color: '#FFFFFF',
                        }
                  }
                  className={`relative rounded-3xl border overflow-hidden ${
                    isDark ? 'border-muted/40' : 'border-brand/20'
                  }`}
                >
                  <div
                    className={`relative z-10 grid grid-cols-1 ${
                      hasCover ? 'lg:grid-cols-12' : ''
                    } items-center`}
                  >
                    <div
                      className={`p-6 sm:p-8 lg:p-11 space-y-4 ${
                        hasCover ? 'lg:col-span-7' : 'max-w-3xl'
                      }`}
                    >
                      {(pickupEnabled || deliveryEnabled) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {pickupEnabled && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface/15 text-on-brand">
                              <Store size={12} />
                              <span>Retirada na loja</span>
                            </span>
                          )}
                          {deliveryEnabled && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface/15 text-on-brand">
                              <Truck size={12} />
                              <span>Entrega</span>
                            </span>
                          )}
                        </div>
                      )}

                      <h2 className={composition.heroTitleClass}>
                        {theme.heroTitle ||
                          `Coleção ${storeData.storeName || 'Oficial'}`}
                      </h2>

                      <p className="text-sm sm:text-base leading-relaxed max-w-xl opacity-92">
                        {theme.heroSubtitle ||
                          storeData.description ||
                          'Confira disponibilidade por tamanho e cor, monte sua sacola e finalize seu pedido pelo WhatsApp.'}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center gap-3">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={scrollToCatalog}
                          className="group/cta inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-surface text-ink hover:bg-support transition cursor-pointer"
                        >
                          <span>
                            {theme.heroCtaLabel || 'Explorar catálogo'}
                          </span>
                          <ArrowRight
                            size={15}
                            className="transition-transform duration-200 group-hover/cta:translate-x-1"
                          />
                        </motion.button>
                      </div>
                    </div>

                    {hasCover && (
                      <div className="lg:col-span-5 px-4 pb-5 sm:px-8 sm:pb-8 lg:p-6 lg:pl-2 flex items-center justify-center">
                        <div
                          className={`w-full ${coverAspectClass} rounded-2xl overflow-hidden border border-surface/20 bg-ink/25`}
                        >
                          <StorefrontCampaignVisual
                            imageUrl={storeData.coverUrl}
                            mobileImageUrl={theme.heroMobileCoverUrl}
                            alt={storeData.storeName}
                            focalX={theme.heroFocalX}
                            focalY={theme.heroFocalY}
                            eager
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </section>
          );
        }

        if (section.type === 'banner') {
          const allBanners: any[] = Array.isArray(theme.banners)
            ? theme.banners
            : [];
          const matchedBanner =
            allBanners.find(
              (b) => b && (b.id === section.bannerId || b.id === section.id),
            ) || null;
          const resolvedBanner = matchedBanner
            ? {
                ...section,
                ...matchedBanner,
                enabled:
                  section.enabled !== false && matchedBanner.enabled !== false,
              }
            : section;

          if (resolvedBanner.enabled === false) return null;

          return (
            <section
              key={section.id}
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`${containerClass} ${composition.sectionGap} ${editorOutlineClass(section.id)}`}
            >
              <StorefrontBannerSection
                banner={resolvedBanner}
                template={template}
                categories={categories}
                products={catalogPool}
                collections={resolvedCollections}
                onActivateTarget={handleBannerTargetAction}
              />
            </section>
          );
        }

        if (section.type === 'categories' && categories.length > 0) {
          return (
            <section
              key={section.id}
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`${containerClass} py-3 sm:py-4 ${editorOutlineClass(section.id)}`}
            >
              <CategoryTabsRail
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={(catId) => {
                  setEffectiveSelectionId(null);
                  setSelectedCategoryId(catId);
                }}
                title={section.title || 'Categorias'}
                isDark={isDark}
                isMinimal={isMinimal}
                layoutScope={layoutScope}
              />
            </section>
          );
        }

        if (
          section.type === 'featured' ||
          section.type === 'product_selection'
        ) {
          const { items: selectionItems, linkedCollection } =
            resolveSelectionProducts(
              section,
              catalogPool,
              featuredProducts,
              resolvedCollections,
            );

          if (selectionItems.length === 0) {
            if (!onSelectEditorSection) return null;
            return (
              <section
                key={section.id}
                data-sf-section-id={section.id}
                onClick={() => handleSectionSurfaceClick(section.id)}
                className={`${containerClass} py-3 ${editorOutlineClass(section.id)}`}
              >
                <div className="rounded-2xl border border-dashed border-line p-5 text-center text-xs text-muted bg-surface/60">
                  <strong className="text-ink block mb-0.5">
                    {section.title || 'Seleção de produtos'}
                  </strong>
                  Escolha mercadorias visíveis no painel da direita para exibir
                  esta seleção na página.
                </div>
              </section>
            );
          }

          return (
            <section
              key={section.id}
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`${containerClass} ${composition.sectionGap} ${editorOutlineClass(section.id)}`}
            >
              <StorefrontProductSelectionSection
                section={{
                  ...section,
                  columnsDesktop:
                    section.columnsDesktop || composition.defaultSelectionCols,
                }}
                resolvedProducts={selectionItems}
                template={template}
                onSelectProduct={onSelectProduct}
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
                onViewFullSelection={() => {
                  if (linkedCollection?.slug && onOpenCollection) {
                    onOpenCollection(linkedCollection.slug);
                    return;
                  }
                  setSearch('');
                  setSelectedCategoryId('');
                  setSelectedSize('');
                  setSelectedColor('');
                  setInStockOnly(false);
                  setEffectiveSelectionId(section.id);
                  scrollToCatalog();
                }}
              />
            </section>
          );
        }

        if (section.type === 'look') {
          const lookCol =
            resolvedCollections.find(
              (c: any) =>
                c.id === section.collectionId ||
                c.slug === section.collectionId,
            ) ||
            resolvedCollections.find((c: any) => c.kind === 'look') ||
            null;
          const lookPieces: any[] = Array.isArray(lookCol?.products)
            ? lookCol.products
            : [];

          if (!lookCol || lookPieces.length === 0) {
            if (!onSelectEditorSection) return null;
            return (
              <section
                key={section.id}
                data-sf-section-id={section.id}
                onClick={() => handleSectionSurfaceClick(section.id)}
                className={`${containerClass} py-3 ${editorOutlineClass(section.id)}`}
              >
                <div className="rounded-2xl border border-dashed border-line p-5 text-center text-xs text-muted bg-surface/60">
                  <strong className="text-ink block mb-0.5">
                    {section.title || 'Monte o look'}
                  </strong>
                  Vincule um conjunto “Monte o look” com peças visíveis para
                  apresentá-lo aqui.
                </div>
              </section>
            );
          }

          return (
            <section
              key={section.id}
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`${containerClass} ${composition.sectionGap} ${editorOutlineClass(section.id)}`}
            >
              <StorefrontShopTheLook
                look={lookCol}
                pieces={lookPieces}
                template={template}
                sectionTitle={section.title}
                sectionSubtitle={section.subtitle}
                onSelectProduct={onSelectProduct}
                onAddLookItems={(entries) => {
                  if (onAddLookItems) {
                    onAddLookItems(entries);
                  } else if (onQuickAdd) {
                    for (const entry of entries) {
                      onQuickAdd(
                        entry.product,
                        entry.variant,
                        entry.quantity,
                      );
                    }
                  }
                }}
                onOpenCollectionPage={
                  lookCol.slug && onOpenCollection
                    ? () => onOpenCollection(lookCol.slug)
                    : undefined
                }
              />
            </section>
          );
        }

        if (section.type === 'collection') {
          return (
            <section
              id={isPreview ? 'catalogo-loja-preview' : 'catalogo-loja'}
              key={section.id}
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`${containerClass} py-4 flex-1 ${editorOutlineClass(section.id)}`}
            >
              {activeSelectionContext && (
                <div className="mb-3.5 rounded-2xl border border-brand/40 bg-support/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles size={14} className="text-brand shrink-0" />
                    <span className="text-ink truncate">
                      Exibindo seleção completa:{' '}
                      <strong>{activeSelectionContext.title}</strong> (
                      {activeSelectionContext.items.length}{' '}
                      {activeSelectionContext.items.length === 1
                        ? 'item'
                        : 'itens'}
                      )
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEffectiveSelectionId(null)}
                    className="inline-flex items-center gap-1 font-semibold text-brand hover:underline cursor-pointer shrink-0"
                  >
                    <X size={13} />
                    <span>Ver todo o catálogo</span>
                  </button>
                </div>
              )}

              {/* Barra de busca mobile + filtros customizados fluidos */}
              <div
                className={`rounded-2xl sm:rounded-3xl border p-3 sm:p-4 mb-5 transition-colors ${
                  isDark
                    ? 'bg-ink border-muted/40 text-on-brand'
                    : isMinimal
                      ? 'bg-page border-line text-ink'
                      : 'bg-surface border-line text-ink'
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
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
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
                          className="text-xs font-semibold text-brand underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                      <span className="text-[11px] font-semibold text-muted tabular-nums">
                        {catalogGridProducts.length}{' '}
                        {catalogGridProducts.length === 1 ? 'peça' : 'peças'}
                      </span>
                    </div>
                  </div>

                  {/* Controles completos Desktop / Tablet (sm:+) com Popovers animados */}
                  <div className="hidden sm:flex flex-wrap items-center gap-2 flex-1">
                    <span className="text-xs font-semibold text-muted inline-flex items-center gap-1.5 mr-1">
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
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
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
                          className="text-xs font-semibold text-brand hover:underline px-2 py-1 cursor-pointer inline-flex items-center gap-1"
                        >
                          <X size={12} />
                          <span>Limpar filtros</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="hidden sm:flex items-center justify-end gap-2.5 shrink-0">
                    <span className="text-xs font-semibold text-muted inline-flex items-center gap-1.5 tabular-nums">
                      {syncingProducts && (
                        <Loader2
                          size={12}
                          className="animate-spin text-brand"
                        />
                      )}
                      <span>
                        {catalogGridProducts.length}{' '}
                        {catalogGridProducts.length === 1 ? 'peça' : 'peças'}
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
              {loadingProducts && catalogGridProducts.length === 0 ? (
                <StorefrontGridSkeleton count={8} isDark={isDark} />
              ) : catalogGridProducts.length === 0 ? (
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
                  <p className="font-bold text-sm sm:text-base">
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
                      className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <span>Ver catálogo completo</span>
                    </motion.button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  layout="position"
                  className={`grid ${composition.catalogGrid}`}
                >
                  {catalogGridProducts.map((prod: any, idx: number) => (
                    <StorefrontProductCard
                      key={prod.id || prod.retailGroupId || idx}
                      product={prod}
                      index={idx}
                      isDark={isDark}
                      template={template}
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
            <section
              key={section.id}
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`${containerClass} py-5 ${editorOutlineClass(section.id)}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {pickupEnabled && (
                  <div
                    className={`border rounded-3xl p-4 sm:p-5 flex items-start gap-3.5 ${
                      isDark
                        ? 'bg-ink border-muted/40 text-on-brand'
                        : 'bg-surface border-line text-ink'
                    }`}
                  >
                    <div className="p-3 rounded-2xl bg-support text-brand shrink-0">
                      <Store size={19} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm">
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
                        : 'bg-surface border-line text-ink'
                    }`}
                  >
                    <div className="p-3 rounded-2xl bg-support text-brand shrink-0">
                      <Truck size={19} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-xs sm:text-sm">
                          Entrega a Combinar
                        </h4>
                        {deliveryFeeNote && (
                          <span className="px-2 py-0.5 rounded-lg bg-support text-brand text-[10px] font-semibold">
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
              data-sf-section-id={section.id}
              onClick={() => handleSectionSurfaceClick(section.id)}
              className={`border-t mt-auto py-7 text-xs ${
                isDark
                  ? 'border-muted/40 text-line bg-ink'
                  : 'border-line text-muted bg-surface'
              } ${editorOutlineClass(section.id)}`}
            >
              <div
                className={`${containerClass} flex flex-col sm:flex-row items-center justify-between gap-3`}
              >
                <div className="text-center sm:text-left">
                  <p
                    className={`font-bold text-sm ${
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
                <div className="flex items-center gap-2 opacity-85 font-medium">
                  <ShieldCheck size={15} className="text-brand shrink-0" />
                  <span>Estoque sincronizado em tempo real • PDV Lojista</span>
                </div>
              </div>
            </footer>
          );
        }

        return null;
      })}

      {/* Bottom-Sheet Mobile de Filtros (funciona tanto na loja pública quanto no iframe da prévia) */}
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
        resultsCount={catalogGridProducts.length}
        onClearAll={clearAllFilters}
        isDark={isDark}
      />

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
  const collectionMatch = useMatch('/loja/:slug/colecao/:colecaoSlug');
  const orderMatch = useMatch('/loja/:slug/pedido/:referencia');
  const cartMatch = useMatch('/loja/:slug/carrinho');
  const checkoutMatch = useMatch('/loja/:slug/finalizar');

  const produtoSlug = productMatch?.params?.produtoSlug;
  const colecaoSlug = collectionMatch?.params?.colecaoSlug;
  const referencia = orderMatch?.params?.referencia;
  const isCartPage = Boolean(cartMatch);
  const isCheckoutPage = Boolean(checkoutMatch);
  const isProductPage = Boolean(produtoSlug);
  const isCollectionPage = Boolean(colecaoSlug);
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
  const [deliveryVehicle, setDeliveryVehicle] = useState<'MOTO' | 'CARRO'>(
    'MOTO',
  );
  const [expressQuote, setExpressQuote] =
    useState<PublicExpressQuoteResponse | null>(null);
  const [loadingExpressQuote, setLoadingExpressQuote] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [priceDivergenceAlert, setPriceDivergenceAlert] = useState<any[] | null>(
    null,
  );

  // Coleção curada / Monte o look (/loja/:slug/colecao/:colecaoSlug) e filtro de seleção
  const [collectionDetail, setCollectionDetail] = useState<any>(null);
  const [loadingCollectionDetail, setLoadingCollectionDetail] = useState(false);
  const [activeSelectionFilterId, setActiveSelectionFilterId] = useState<
    string | null
  >(() => searchParams.get('selecao') || null);

  useEffect(() => {
    const qSel = searchParams.get('selecao');
    if (qSel) setActiveSelectionFilterId(qSel);
  }, [searchParams]);

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
      : isCollectionPage
        ? 'collection'
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
  }, [currentViewType, produtoSlug, colecaoSlug, referencia]);

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

  // Carregar coleção curada ou "Monte o look" (/loja/:slug/colecao/:colecaoSlug)
  useEffect(() => {
    if (!slug || !colecaoSlug) return;
    let active = true;

    const localResolved = resolveCollectionsWithProducts(
      storeData,
      masterProducts,
    );
    const cachedCol =
      localResolved.find(
        (c: any) => c.slug === colecaoSlug || c.id === colecaoSlug,
      ) || null;
    if (cachedCol) {
      setCollectionDetail(cachedCol);
    }
    setLoadingCollectionDetail(!cachedCol);

    storefrontApi
      .get(`/storefront/public/${slug}/collections/${colecaoSlug}`)
      .then(({ data }) => {
        if (!active) return;
        const col = data?.collection || data;
        setCollectionDetail({
          ...col,
          products: Array.isArray(data?.products)
            ? data.products
            : Array.isArray(col?.products)
              ? col.products
              : cachedCol?.products || [],
        });
      })
      .catch((err) => {
        if (!active || cachedCol) return;
        toast.error(
          err.response?.data?.message || 'Coleção não encontrada na vitrine.',
        );
        navigate(`/loja/${slug}`);
      })
      .finally(() => {
        if (active) setLoadingCollectionDetail(false);
      });

    return () => {
      active = false;
    };
  }, [slug, colecaoSlug, storeData, masterProducts, navigate]);

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
  const fetchOrderStatus = useCallback(
    async (silent = false) => {
      if (!slug || !referencia) return;
      const tokenFromUrl =
        searchParams.get('token') || searchParams.get('t') || '';
      const savedToken = storeData?.publicId
        ? getSavedOrderAccessToken(storeData.publicId, referencia)
        : '';
      const token = tokenFromUrl || savedToken || '';

      if (!token) {
        if (!silent) {
          setOrderError(
            'Para consultar o andamento deste pedido, utilize o link seguro gerado na finalização.',
          );
        }
        return;
      }

      if (!silent) {
        setLoadingOrder(true);
        setOrderError(null);
      }
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
        if (!silent) {
          setOrderError(
            err.response?.data?.message ||
              'Não foi possível localizar este pedido ou a credencial de acesso é inválida.',
          );
        }
      } finally {
        if (!silent) {
          setLoadingOrder(false);
        }
      }
    },
    [slug, referencia, searchParams, storeData?.publicId],
  );

  useEffect(() => {
    if (isOrderPage) {
      void fetchOrderStatus(false);
    }
  }, [isOrderPage, fetchOrderStatus]);

  // Atualização silenciosa em tempo real da entrega/pedido na tela de acompanhamento
  useEffect(() => {
    if (!isOrderPage || !orderDetail || isOffline) return;
    const isTerminal =
      ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(
        orderDetail.commercialStatus || '',
      ) || orderDetail.fulfillmentStatus === 'DELIVERED';
    if (isTerminal) return;

    const timer = window.setInterval(() => {
      void fetchOrderStatus(true);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [
    isOrderPage,
    orderDetail?.commercialStatus,
    orderDetail?.fulfillmentStatus,
    isOffline,
    fetchOrderStatus,
  ]);

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

  // Cotação automática 99 Entregas no checkout quando CEP/bairro/sacola mudam
  useEffect(() => {
    if (
      !isCheckoutPage ||
      fulfillmentMode !== 'DELIVERY' ||
      !storeData?.expressDelivery?.enabled ||
      !slug ||
      isOffline ||
      cartItems.length === 0
    ) {
      if (fulfillmentMode !== 'DELIVERY') {
        setExpressQuote(null);
      }
      return;
    }

    const cleanCep = zipCode.replace(/\D/g, '');
    if (cleanCep.length < 8 && !neighborhood.trim()) {
      setExpressQuote(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingExpressQuote(true);
      try {
        const { data } = await storefrontApi.post(
          `/storefront/public/${slug}/delivery/quote`,
          {
            zipCode: cleanCep.length === 8 ? cleanCep : undefined,
            neighborhood: neighborhood.trim() || undefined,
            city: city.trim() || undefined,
            subtotal: cartTotal,
            vehicleType: deliveryVehicle,
          },
        );
        if (cancelled) return;
        setExpressQuote(data);
        if (
          data?.available &&
          data?.selectedVehicle &&
          data.selectedVehicle !== deliveryVehicle
        ) {
          setDeliveryVehicle(data.selectedVehicle);
        }
        if (data?.destination) {
          if (!street && data.destination.street) {
            setStreet(data.destination.street);
          }
          if (!neighborhood && data.destination.neighborhood) {
            setNeighborhood(data.destination.neighborhood);
          }
          if (!city && data.destination.city) {
            setCity(
              data.destination.state
                ? `${data.destination.city} - ${data.destination.state}`
                : data.destination.city,
            );
          }
        }
      } catch {
        if (!cancelled) {
          setExpressQuote(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingExpressQuote(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isCheckoutPage,
    fulfillmentMode,
    storeData?.expressDelivery?.enabled,
    slug,
    isOffline,
    cartItems.length,
    zipCode,
    neighborhood,
    city,
    cartTotal,
    deliveryVehicle,
  ]);

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

  const handleAddLookItemsToCart = (
    entries: Array<{ product: any; variant: any; quantity: number }>,
  ) => {
    if (!storeData?.publicId || entries.length === 0) return;
    let addedCount = 0;
    for (const entry of entries) {
      const { product, variant, quantity } = entry;
      if (!variant || !variant.inStock || Number(variant.availableStock ?? 0) <= 0) {
        continue;
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
        quantity: Math.max(
          1,
          Math.min(Number(variant.availableStock), Number(quantity || 1)),
        ),
        priceUnit: Number(variant.priceSell ?? product.priceSell ?? 0),
        maxAvailableStock: Number(variant.availableStock),
      });
      addedCount += 1;
    }
    if (addedCount > 0) {
      setBagPulseKey((k) => k + 1);
      setCartDrawerOpen(true);
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

    if (
      fulfillmentMode === 'DELIVERY' &&
      storeData?.expressDelivery?.enabled
    ) {
      const cleanCep = zipCode.replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        toast.error(
          'Informe o CEP completo de 8 dígitos para calcular a Entrega 99.',
        );
        return;
      }
      if (expressQuote && !expressQuote.available) {
        toast.error(
          expressQuote.message ||
            'A entrega expressa não está disponível para este endereço.',
        );
        return;
      }
    }

    setSubmittingOrder(true);
    setPriceDivergenceAlert(null);
    try {
      const baseAttemptKey = getOrCreateOrderAttemptKey(
        storeData.publicId,
        storeData.slug,
      );
      const attemptKey =
        fulfillmentMode === 'DELIVERY' && storeData?.expressDelivery?.enabled
          ? `${baseAttemptKey}-${deliveryVehicle.toLowerCase()}`
          : baseAttemptKey;

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
          ...(fulfillmentMode === 'DELIVERY' &&
          storeData?.expressDelivery?.enabled
            ? { deliveryVehicle }
            : {}),
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
      : isCollectionPage
        ? `collection-${colecaoSlug}`
        : isCheckoutPage
          ? 'checkout'
          : isCartPage
            ? 'cart'
            : 'home';

  const renderActiveRouteView = () => {
    // ── ROTA: /loja/:slug/colecao/:colecaoSlug ───────────────────────────────
    if (isCollectionPage) {
      const template = storeData?.theme?.template || 'editorial_roxo';
      const composition = getTemplateComposition(template);
      const colProducts: any[] = Array.isArray(collectionDetail?.products)
        ? collectionDetail.products
        : [];

      return (
        <div
          style={themeStyles}
          className={`min-h-screen pb-20 ${
            isDarkTheme ? 'bg-ink text-on-brand' : 'bg-page text-ink'
          }`}
        >
          <StorefrontSubpageHeader
            slug={slug}
            storeData={storeData}
            backTo={`/loja/${slug}`}
            backLabel="Voltar à vitrine"
            stepLabel={
              collectionDetail?.kind === 'look' ? 'Monte o look' : 'Coleção'
            }
            cartCount={cartCount}
            cartTotal={cartTotal}
            bagPulseKey={bagPulseKey}
            onOpenCart={() => setCartDrawerOpen(true)}
          />

          <div className={`${composition.container} pt-6 sm:pt-8 space-y-6`}>
            {loadingCollectionDetail && !collectionDetail ? (
              <StorefrontGridSkeleton count={4} isDark={isDarkTheme} />
            ) : collectionDetail ? (
              collectionDetail.kind === 'look' ? (
                <StorefrontShopTheLook
                  look={collectionDetail}
                  pieces={colProducts}
                  template={template}
                  onSelectProduct={handleNavigateToProduct}
                  onAddLookItems={handleAddLookItemsToCart}
                />
              ) : (
                <>
                  <div
                    className={`rounded-3xl border overflow-hidden ${
                      isDarkTheme
                        ? 'bg-ink border-muted/40 text-on-brand'
                        : 'bg-surface border-line text-ink'
                    }`}
                  >
                    <div
                      className={`grid grid-cols-1 ${
                        collectionDetail.coverUrl ? 'md:grid-cols-12' : ''
                      } items-center`}
                    >
                      <div
                        className={`p-6 sm:p-8 lg:p-10 space-y-2.5 ${
                          collectionDetail.coverUrl
                            ? 'md:col-span-7'
                            : 'max-w-3xl'
                        }`}
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                          Coleção curada • {colProducts.length}{' '}
                          {colProducts.length === 1 ? 'peça' : 'peças'}
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                          {collectionDetail.title}
                        </h1>
                        {(collectionDetail.subtitle ||
                          collectionDetail.description) && (
                          <p
                            className={`text-xs sm:text-sm leading-relaxed max-w-xl ${
                              isDarkTheme ? 'text-line' : 'text-muted'
                            }`}
                          >
                            {collectionDetail.description ||
                              collectionDetail.subtitle}
                          </p>
                        )}
                      </div>
                      {collectionDetail.coverUrl && (
                        <div className="md:col-span-5 aspect-[16/10] md:min-h-[220px] w-full">
                          <StorefrontCampaignVisual
                            imageUrl={collectionDetail.coverUrl}
                            alt={collectionDetail.title}
                            focalX={collectionDetail.focalX}
                            focalY={collectionDetail.focalY}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {colProducts.length === 0 ? (
                    <div className="rounded-3xl border border-line bg-surface p-10 text-center space-y-2">
                      <p className="font-bold text-sm text-ink">
                        Nenhuma peça disponível nesta coleção no momento
                      </p>
                      <Link
                        to={`/loja/${slug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                      >
                        <span>Explorar catálogo completo</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  ) : (
                    <div className={`grid ${composition.catalogGrid}`}>
                      {colProducts.map((prod: any, idx: number) => (
                        <StorefrontProductCard
                          key={prod.id || prod.retailGroupId || idx}
                          product={prod}
                          index={idx}
                          isDark={isDarkTheme}
                          template={template}
                          onSelect={() =>
                            handleNavigateToProduct(prod.slug, prod)
                          }
                          onQuickAdd={(p, v, src) =>
                            handleAddVariantToCart(p, v, 1, {
                              openDrawer: false,
                              source: src,
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </>
              )
            ) : null}
          </div>
        </div>
      );
    }

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
                        {Number(orderDetail.deliveryFee || 0) > 0 ||
                        orderDetail.expressQuote
                          ? 'Total do Pedido'
                          : 'Total dos Produtos'}
                      </p>
                      <p className="text-2xl font-extrabold text-brand tabular-nums">
                        {formatBrl(orderDetail.total)}
                      </p>
                      {(Number(orderDetail.deliveryFee || 0) > 0 ||
                        orderDetail.expressQuote) && (
                        <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                          Produtos {formatBrl(orderDetail.subtotal)} • Entrega{' '}
                          {Number(orderDetail.deliveryFee || 0) === 0
                            ? 'Grátis'
                            : formatBrl(orderDetail.deliveryFee)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Animação ao vivo de Entrega 99 quando o pedido é na modalidade Entrega */}
                  {orderDetail.fulfillmentMode === 'DELIVERY' &&
                    !isCancelledOrExpired && (
                      <StorefrontOrderDeliveryScene
                        storeName={storeData?.storeName || 'Loja'}
                        commercialStatus={orderDetail.commercialStatus}
                        fulfillmentStatus={orderDetail.fulfillmentStatus}
                        deliveryFee={orderDetail.deliveryFee}
                        deliveryDestination={orderDetail.deliveryDestination}
                        expressQuote={orderDetail.expressQuote}
                        expressDispatch={orderDetail.expressDispatch}
                      />
                    )}

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
                          <div className="flex items-center gap-3 min-w-0">
                            <StockItemThumb
                              imageUrl={item.imageUrl}
                              product={item}
                              alt={item.productName}
                              size="md"
                            />
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
                    <div className="relative aspect-[4/5] rounded-2xl sm:rounded-3xl bg-page border border-line overflow-hidden flex items-center justify-center group/gallery p-4 sm:p-6">
                      {currentPhoto ? (
                        <>
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.img
                              key={currentPhoto}
                              src={getFullUrl(currentPhoto)}
                              alt={productDetail.title}
                              initial={{ opacity: 0, scale: 1.01 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, ease: SF_EASE_OUT }}
                              onClick={() => setLightboxOpen(true)}
                              className="w-full h-full object-contain object-center cursor-zoom-in select-none"
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
                              className={`w-16 h-20 rounded-2xl overflow-hidden border-2 bg-page p-1.5 shrink-0 cursor-pointer transition ${
                                active
                                  ? 'border-brand'
                                  : 'border-line opacity-75 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={getFullUrl(url)}
                                alt=""
                                className="w-full h-full object-contain object-center"
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
                                className="shrink-0"
                              >
                                <StorefrontProductFrame
                                  imageUrl={item.imageUrl || valItem?.imageUrl}
                                  alt={item.productName}
                                  productName={item.productName}
                                  padding="xs"
                                  aspectClassName="w-16 h-20"
                                  roundedClassName="rounded-2xl"
                                />
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
                        <ul className="text-xs text-muted space-y-1.5">
                          {priceDivergenceAlert.map((d: any) => {
                            const divImg =
                              d.imageUrl ||
                              cartItems.find((ci) => ci.productId === d.productId)
                                ?.imageUrl ||
                              null;
                            return (
                              <li
                                key={d.productId}
                                className="flex items-center gap-2"
                              >
                                <StockItemThumb
                                  imageUrl={divImg}
                                  alt={d.productName}
                                  size="xs"
                                />
                                <span>
                                  <strong>{d.productName}</strong>: de{' '}
                                  {formatBrl(d.expectedPriceUnit)} para{' '}
                                  <strong className="text-brand">
                                    {formatBrl(d.currentPriceUnit)}
                                  </strong>
                                </span>
                              </li>
                            );
                          })}
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
                                {storeData?.expressDelivery?.enabled
                                  ? 'Entrega Expressa 99'
                                  : 'Entrega a Combinar'}
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                {storeData?.expressDelivery?.enabled
                                  ? 'Cálculo automático por CEP • 99 Moto ou Carro'
                                  : storeData?.deliveryFeeNote ||
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

                            {storeData?.expressDelivery?.enabled && (
                              <div className="pt-4">
                                <StorefrontCheckoutRouteCalculator
                                  storeName={storeData?.storeName || 'Loja'}
                                  originCity={
                                    storeData.expressDelivery.originCity
                                  }
                                  originNeighborhood={
                                    storeData.expressDelivery.originNeighborhood
                                  }
                                  freeShippingAbove={
                                    storeData.expressDelivery.freeShippingAbove
                                  }
                                  cartSubtotal={cartTotal}
                                  zipCode={zipCode}
                                  loadingQuote={loadingExpressQuote}
                                  quote={expressQuote}
                                  selectedVehicle={deliveryVehicle}
                                  onSelectVehicle={setDeliveryVehicle}
                                />
                              </div>
                            )}
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
                        {cartItems.map((item) => {
                          const valItem = cartValidation?.items?.find(
                            (vi: any) => vi.productId === item.productId,
                          );
                          return (
                            <div
                              key={item.productId}
                              className="py-2.5 flex items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <StockItemThumb
                                  imageUrl={item.imageUrl || valItem?.imageUrl}
                                  alt={item.productName}
                                  size="sm"
                                />
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
                              </div>
                              <span className="font-extrabold text-ink shrink-0 tabular-nums">
                                {formatBrl(item.priceUnit * item.quantity)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {fulfillmentMode === 'DELIVERY' &&
                      storeData?.expressDelivery?.enabled &&
                      expressQuote?.available ? (
                        <div className="border-t border-line pt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted">
                            <span>Subtotal dos produtos</span>
                            <span className="tabular-nums font-semibold text-ink">
                              {formatBrl(cartTotal)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted">
                            <span>
                              Entrega (
                              {deliveryVehicle === 'CARRO'
                                ? '99Entrega Carro'
                                : '99Entrega Moto'}
                              )
                            </span>
                            <span className="tabular-nums font-bold text-brand">
                              {expressQuote.selectedFee === 0
                                ? 'Grátis'
                                : formatBrl(expressQuote.selectedFee)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1.5 border-t border-line">
                            <span className="font-bold text-sm">
                              Total com entrega
                            </span>
                            <span className="text-2xl font-extrabold text-brand tabular-nums">
                              {formatBrl(
                                cartTotal + Number(expressQuote.selectedFee || 0),
                              )}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-line pt-3 flex items-baseline justify-between">
                          <span className="font-bold text-sm">
                            Total dos produtos
                          </span>
                          <span className="text-2xl font-extrabold text-brand tabular-nums">
                            {formatBrl(cartTotal)}
                          </span>
                        </div>
                      )}

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
        allCatalogProducts={masterProducts}
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
        onAddLookItems={handleAddLookItemsToCart}
        onOpenCart={() => setCartDrawerOpen(true)}
        onOpenCollection={(colSlug) => {
          if (typeof window !== 'undefined') {
            catalogScrollYRef.current = window.scrollY;
          }
          navigate(`/loja/${slug}/colecao/${colSlug}`);
        }}
        activeSelectionFilterId={activeSelectionFilterId}
        onSelectSelectionFilter={setActiveSelectionFilterId}
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

/**
 * Simulador interativo isolado para o editor visual de Aparência (dentro de iframe):
 * - Começa sempre com a sacola vazia (0 itens).
 * - Permite abrir qualquer mercadoria, escolher variantes (tamanho, cor, quantidade),
 *   explorar coleções / "Monte o look" e simular a sacola e a finalização.
 * - Nunca grava pedidos reais no servidor, não reserva estoque e não usa localStorage.
 */
export function StorefrontInteractivePreview({
  storeData,
  products,
  selectedSectionId = null,
  onSelectEditorSection,
  resetSignal = 0,
  onSimulationCartChange,
}: {
  storeData: any;
  products: any[];
  selectedSectionId?: string | null;
  onSelectEditorSection?: (sectionId: string) => void;
  resetSignal?: number;
  onSimulationCartChange?: (count: number) => void;
}) {
  const win = useStorefrontWindow();
  const theme = storeData?.theme || {};
  const template = theme.template || 'editorial_roxo';
  const isDark = template === 'vitrine_escura';
  const composition = getTemplateComposition(template);
  const themeStyles = getStoreThemeStyles(theme);

  const [simView, setSimView] = useState<
    'home' | 'product' | 'collection' | 'checkout' | 'checkout_done'
  >('home');
  const [simCartItems, setSimCartItems] = useState<StorefrontCartItem[]>([]);
  const [simDrawerOpen, setSimDrawerOpen] = useState(false);
  const [simBagPulseKey, setSimBagPulseKey] = useState(0);
  const [simFlyTokens, setSimFlyTokens] = useState<FlyToBagToken[]>([]);
  const flySeqRef = useRef(1);
  const homeScrollYRef = useRef(0);

  // Filtros locais na prévia
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [simSelectionFilterId, setSimSelectionFilterId] = useState<
    string | null
  >(null);

  // Produto aberto na simulação
  const [activeProductSlug, setActiveProductSlug] = useState<string | null>(
    null,
  );
  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const [chosenColor, setChosenColor] = useState<string | null>(null);
  const [chosenQuantity, setChosenQuantity] = useState(1);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Coleção aberta na simulação
  const [activeCollectionSlug, setActiveCollectionSlug] = useState<
    string | null
  >(null);

  // Campos de checkout simulado
  const [simCustomerName, setSimCustomerName] = useState('Cliente Exemplo');
  const [simCustomerPhone, setSimCustomerPhone] = useState('(11) 99999-0000');
  const [simFulfillment, setSimFulfillment] = useState<'PICKUP' | 'DELIVERY'>(
    storeData?.pickupEnabled === false && storeData?.deliveryEnabled
      ? 'DELIVERY'
      : 'PICKUP',
  );
  const [simAddress, setSimAddress] = useState('');
  const [simNotes, setSimNotes] = useState('');
  const [simOrderSummary, setSimOrderSummary] = useState<{
    reference: string;
    total: number;
    itemsCount: number;
    messagePreview: string;
  } | null>(null);

  useEffect(() => {
    if (resetSignal === 0) return;
    setSimCartItems([]);
    setSimDrawerOpen(false);
    setSimView('home');
    setActiveProductSlug(null);
    setActiveCollectionSlug(null);
    setSimSelectionFilterId(null);
    setSimOrderSummary(null);
    win?.scrollTo({ top: 0, behavior: 'auto' });
  }, [resetSignal, win]);

  // Se o usuário seleciona uma seção no editor enquanto está em outra sub-tela da prévia, volta à home
  useEffect(() => {
    if (!selectedSectionId) return;
    setSimView((curr) => (curr !== 'home' ? 'home' : curr));
  }, [selectedSectionId]);

  const simCartCount = useMemo(
    () => simCartItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0),
    [simCartItems],
  );
  const simCartTotal = useMemo(
    () =>
      simCartItems.reduce(
        (sum, i) => sum + Number(i.priceUnit || 0) * Number(i.quantity || 0),
        0,
      ),
    [simCartItems],
  );

  useEffect(() => {
    onSimulationCartChange?.(simCartCount);
  }, [simCartCount, onSimulationCartChange]);

  const filteredProducts = useMemo(() => {
    const normSearch = normalizeSearchText(search);
    const list = products.filter((prod) => {
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
      }
      if (selectedColor) {
        if (
          !Array.isArray(prod.colors) ||
          !prod.colors.includes(selectedColor)
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
        const hay = normalizeSearchText(
          `${prod.title || ''} ${prod.categoryName || ''} ${(prod.colors || []).join(' ')}`,
        );
        if (!hay.includes(normSearch)) return false;
      }
      return true;
    });

    const sorted = [...list];
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
    products,
    selectedCategoryId,
    selectedSize,
    selectedColor,
    inStockOnly,
    search,
    sortBy,
  ]);

  const resolvedCollections = useMemo(
    () => resolveCollectionsWithProducts(storeData, products),
    [storeData, products],
  );

  const activeProduct = useMemo(() => {
    if (!activeProductSlug) return null;
    return (
      products.find(
        (p) =>
          p.slug === activeProductSlug ||
          p.id === activeProductSlug ||
          p.retailGroupId === activeProductSlug,
      ) || null
    );
  }, [products, activeProductSlug]);

  const activeCollection = useMemo(() => {
    if (!activeCollectionSlug) return null;
    return (
      resolvedCollections.find(
        (c) => c.slug === activeCollectionSlug || c.id === activeCollectionSlug,
      ) || null
    );
  }, [resolvedCollections, activeCollectionSlug]);

  const goBackHome = useCallback(() => {
    setSimView('home');
    const restoreY = homeScrollYRef.current;
    win?.requestAnimationFrame(() => {
      win.scrollTo({ top: restoreY, behavior: 'auto' });
    });
  }, [win]);

  const openProductInPreview = useCallback(
    (prodSlug: string, seed?: any) => {
      const target =
        seed ||
        products.find(
          (p) =>
            p.slug === prodSlug ||
            p.id === prodSlug ||
            p.retailGroupId === prodSlug,
        );
      if (!target) return;
      if (simView === 'home' && win) {
        homeScrollYRef.current = win.scrollY;
      }
      setActiveProductSlug(target.slug || target.id);
      setActivePhotoUrl(target.imageUrl || target.galleryUrls?.[0] || null);
      const firstAvail =
        (target.variants || []).find(
          (v: any) => v.inStock && Number(v.availableStock ?? 0) > 0,
        ) || target.variants?.[0];
      setChosenSize(firstAvail?.size || target.sizes?.[0] || null);
      setChosenColor(firstAvail?.color || target.colors?.[0] || null);
      setChosenQuantity(1);
      setSimView('product');
      win?.scrollTo({ top: 0, behavior: 'auto' });
    },
    [products, simView, win],
  );

  const openCollectionInPreview = useCallback(
    (colSlug: string) => {
      if (simView === 'home' && win) {
        homeScrollYRef.current = win.scrollY;
      }
      setActiveCollectionSlug(colSlug);
      setSimView('collection');
      win?.scrollTo({ top: 0, behavior: 'auto' });
    },
    [simView, win],
  );

  const addSimulatedItem = useCallback(
    (
      product: any,
      variant: any,
      qty = 1,
      opts?: { openDrawer?: boolean; source?: AddSourceRect },
    ) => {
      if (!variant || !variant.inStock || Number(variant.availableStock ?? 0) <= 0) {
        return;
      }
      const maxStock = Math.max(1, Number(variant.availableStock ?? 1));
      const unitPrice = Number(variant.priceSell ?? product.priceSell ?? 0);

      setSimCartItems((prev) => {
        const idx = prev.findIndex((item) => item.productId === variant.id);
        if (idx >= 0) {
          const next = [...prev];
          const updatedQty = Math.min(maxStock, next[idx].quantity + qty);
          next[idx] = {
            ...next[idx],
            quantity: updatedQty,
            priceUnit: unitPrice,
            maxAvailableStock: maxStock,
          };
          return next;
        }
        return [
          ...prev,
          {
            productId: variant.id,
            retailGroupId: product.id,
            productSlug: product.slug,
            productName: product.title,
            size: variant.size || null,
            color: variant.color || null,
            imageUrl: product.imageUrl || null,
            unit: variant.unit || 'UN',
            quantity: Math.min(maxStock, Math.max(1, qty)),
            priceUnit: unitPrice,
            maxAvailableStock: maxStock,
          },
        ];
      });

      if (opts?.openDrawer) {
        setSimBagPulseKey((k) => k + 1);
        setSimDrawerOpen(true);
      } else {
        const target = resolveBagTargetCoords(win?.document);
        if (opts?.source && target) {
          const id = flySeqRef.current++;
          setSimFlyTokens((prev) => [
            ...prev,
            {
              id,
              startX: opts.source!.x,
              startY: opts.source!.y,
              targetX: target.x,
              targetY: target.y,
              imageUrl: product.imageUrl,
              title: product.title,
            },
          ]);
        } else {
          setSimBagPulseKey((k) => k + 1);
        }
      }
    },
    [win],
  );

  const updateSimulatedQty = useCallback((productId: string, nextQty: number) => {
    setSimCartItems((prev) => {
      if (nextQty <= 0) {
        return prev.filter((item) => item.productId !== productId);
      }
      return prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: Math.min(
                Number(item.maxAvailableStock || 99),
                Math.max(1, nextQty),
              ),
            }
          : item,
      );
    });
  }, []);

  const handleFinishSimulatedCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (simCartItems.length === 0) return;
    const lines = simCartItems.map(
      (i) =>
        `• ${i.quantity}x ${i.productName}${
          i.size || i.color
            ? ` (${[i.size && `Tam ${i.size}`, i.color].filter(Boolean).join(' / ')})`
            : ''
        } — ${formatBrl(i.priceUnit * i.quantity)}`,
    );
    const previewMsg = [
      `Olá, ${storeData?.storeName || 'Loja'}! Pedido simulado na prévia:`,
      ...lines,
      `Modalidade: ${simFulfillment === 'DELIVERY' ? 'Entrega' : 'Retirada na loja'}`,
      `Total: ${formatBrl(simCartTotal)}`,
    ].join('\n');

    setSimOrderSummary({
      reference: `SIM-${String(Math.floor(1000 + Math.random() * 9000))}`,
      total: simCartTotal,
      itemsCount: simCartCount,
      messagePreview: previewMsg,
    });
    setSimCartItems([]);
    setSimView('checkout_done');
    win?.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <>
      {simView === 'product' && activeProduct ? (
        (() => {
          const variants: any[] = activeProduct.variants || [];
          const sizes: string[] = activeProduct.sizes || [];
          const colors: string[] = activeProduct.colors || [];
          const galleryUrls: string[] = Array.isArray(activeProduct.galleryUrls)
            ? activeProduct.galleryUrls
            : activeProduct.imageUrl
              ? [activeProduct.imageUrl]
              : [];
          const selectedVariant =
            variants.find(
              (v) =>
                (sizes.length === 0 || v.size === chosenSize) &&
                (colors.length === 0 || v.color === chosenColor),
            ) ||
            variants.find((v) => v.size === chosenSize) ||
            variants[0];
          const availStock = Number(selectedVariant?.availableStock ?? 0);
          const variantInStock = Boolean(
            selectedVariant?.inStock && availStock > 0,
          );
          const unitPrice = Number(
            selectedVariant?.priceSell ?? activeProduct.priceSell ?? 0,
          );
          const currentPhoto =
            activePhotoUrl || activeProduct.imageUrl || galleryUrls[0] || null;

          return (
            <div
              style={themeStyles}
              className={`min-h-screen pb-16 ${
                isDark ? 'bg-ink text-on-brand' : 'bg-page text-ink'
              }`}
            >
              <header
                className={`sticky top-0 z-30 border-b backdrop-blur-md ${
                  isDark
                    ? 'bg-ink/94 border-muted/40 text-on-brand'
                    : 'bg-surface/94 border-line text-ink'
                }`}
              >
                <div
                  className={`${composition.container} py-3 flex items-center justify-between gap-3`}
                >
                  <button
                    type="button"
                    onClick={goBackHome}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-page/70 hover:border-brand text-xs font-semibold text-ink hover:text-brand transition cursor-pointer"
                  >
                    <ArrowLeft size={15} />
                    <span>Voltar à vitrine</span>
                  </button>
                  <StorefrontBagButton
                    cartCount={simCartCount}
                    cartTotal={simCartTotal}
                    pulseKey={simBagPulseKey}
                    onClick={() => setSimDrawerOpen(true)}
                  />
                </div>
              </header>

              <div className={`${composition.container} pt-5 sm:pt-7`}>
                <div
                  className={`border rounded-3xl p-4 sm:p-7 lg:p-9 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 ${
                    isDark
                      ? 'bg-ink border-muted/40 text-on-brand'
                      : 'bg-surface border-line text-ink'
                  }`}
                >
                  <div className="lg:col-span-6 space-y-3">
                    <StorefrontProductFrame
                      imageUrl={currentPhoto}
                      alt={activeProduct.title}
                      categoryId={activeProduct.categoryId}
                      categoryName={activeProduct.categoryName}
                      productName={activeProduct.title}
                      padding="lg"
                      aspectClassName="aspect-[4/5]"
                      roundedClassName="rounded-2xl sm:rounded-3xl"
                      eager
                    />
                    {galleryUrls.length > 1 && (
                      <div className="flex gap-2.5 overflow-x-auto py-1">
                        {galleryUrls.map((url) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setActivePhotoUrl(url)}
                            className={`w-16 h-20 rounded-2xl overflow-hidden border-2 bg-page p-1.5 shrink-0 cursor-pointer transition ${
                              currentPhoto === url
                                ? 'border-brand'
                                : 'border-line opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={getFullUrl(url)}
                              alt=""
                              className="w-full h-full object-contain object-center"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                      <div>
                        {activeProduct.categoryName && (
                          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                            {activeProduct.categoryName}
                          </span>
                        )}
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 leading-tight">
                          {activeProduct.title}
                        </h1>
                        <p className="text-2xl font-bold text-brand mt-2 tabular-nums">
                          {formatBrl(unitPrice)}
                        </p>
                      </div>

                      {activeProduct.description && (
                        <p
                          className={`text-xs sm:text-sm leading-relaxed ${
                            isDark ? 'text-line' : 'text-muted'
                          }`}
                        >
                          {activeProduct.description}
                        </p>
                      )}

                      {sizes.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted block">
                            Tamanho:{' '}
                            <strong
                              className={isDark ? 'text-on-brand' : 'text-ink'}
                            >
                              {chosenSize}
                            </strong>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {sizes.map((sz) => {
                              const szAvail = variants.some(
                                (v) =>
                                  v.size === sz &&
                                  v.inStock &&
                                  Number(v.availableStock ?? 0) > 0,
                              );
                              const active = chosenSize === sz;
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => {
                                    setChosenSize(sz);
                                    const matchCl = variants.find(
                                      (v) =>
                                        v.size === sz &&
                                        v.color === chosenColor &&
                                        v.inStock,
                                    );
                                    if (!matchCl) {
                                      const firstCl = variants.find(
                                        (v) => v.size === sz && v.inStock,
                                      );
                                      if (firstCl?.color) {
                                        setChosenColor(firstCl.color);
                                      }
                                    }
                                  }}
                                  style={
                                    active
                                      ? {
                                          backgroundColor: 'var(--sf-primary)',
                                          color: '#FFFFFF',
                                        }
                                      : undefined
                                  }
                                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition ${
                                    active
                                      ? 'border-transparent'
                                      : szAvail
                                        ? isDark
                                          ? 'bg-ink border-muted/50 text-on-brand hover:border-brand'
                                          : 'bg-page border-line text-ink hover:border-brand'
                                        : 'bg-page border-line text-muted opacity-45 line-through'
                                  }`}
                                >
                                  {sz}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {colors.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted block">
                            Cor:{' '}
                            <strong
                              className={isDark ? 'text-on-brand' : 'text-ink'}
                            >
                              {chosenColor}
                            </strong>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {colors.map((cl) => {
                              const matchV = variants.find(
                                (v) =>
                                  (sizes.length === 0 ||
                                    v.size === chosenSize) &&
                                  v.color === cl,
                              );
                              const clAvail = Boolean(
                                matchV?.inStock &&
                                  Number(matchV?.availableStock ?? 0) > 0,
                              );
                              const active = chosenColor === cl;
                              return (
                                <button
                                  key={cl}
                                  type="button"
                                  onClick={() => setChosenColor(cl)}
                                  style={
                                    active
                                      ? {
                                          backgroundColor: 'var(--sf-primary)',
                                          color: '#FFFFFF',
                                        }
                                      : undefined
                                  }
                                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition ${
                                    active
                                      ? 'border-transparent'
                                      : clAvail
                                        ? isDark
                                          ? 'bg-ink border-muted/50 text-on-brand hover:border-brand'
                                          : 'bg-page border-line text-ink hover:border-brand'
                                        : 'bg-page border-line text-muted opacity-45 line-through'
                                  }`}
                                >
                                  {cl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          isDark
                            ? 'bg-ink border-muted/40'
                            : 'bg-page border-line'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold">
                            {variantInStock
                              ? 'Disponível no estoque'
                              : 'Opção sem saldo'}
                          </p>
                          <p className="text-[11px] text-muted">
                            {variantInStock
                              ? `${availStock} un. livre(s) nesta variação`
                              : 'Selecione outra combinação'}
                          </p>
                        </div>
                        {variantInStock && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setChosenQuantity((q) => Math.max(1, q - 1))
                              }
                              className="w-8 h-8 rounded-xl bg-surface border border-line text-ink flex items-center justify-center cursor-pointer"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-7 text-center font-bold text-sm tabular-nums">
                              {chosenQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setChosenQuantity((q) =>
                                  Math.min(availStock, q + 1),
                                )
                              }
                              className="w-8 h-8 rounded-xl bg-surface border border-line text-ink flex items-center justify-center cursor-pointer"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <button
                        type="button"
                        disabled={!variantInStock}
                        onClick={() =>
                          addSimulatedItem(
                            activeProduct,
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
                        className="w-full py-3.5 px-6 rounded-2xl disabled:opacity-45 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 transition"
                      >
                        <ShoppingBag size={16} />
                        <span>
                          {variantInStock
                            ? `Adicionar à sacola • ${formatBrl(unitPrice * chosenQuantity)}`
                            : 'Opção indisponível'}
                        </span>
                      </button>

                      {simCartCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSimView('checkout');
                            win?.scrollTo({ top: 0, behavior: 'auto' });
                          }}
                          className="w-full py-2.5 px-5 rounded-2xl bg-support text-brand font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>
                            Simular finalização ({simCartCount}{' '}
                            {simCartCount === 1 ? 'peça' : 'peças'})
                          </span>
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : simView === 'collection' && activeCollection ? (
        <div
          style={themeStyles}
          className={`min-h-screen pb-16 ${
            isDark ? 'bg-ink text-on-brand' : 'bg-page text-ink'
          }`}
        >
          <header
            className={`sticky top-0 z-30 border-b backdrop-blur-md ${
              isDark
                ? 'bg-ink/94 border-muted/40 text-on-brand'
                : 'bg-surface/94 border-line text-ink'
            }`}
          >
            <div
              className={`${composition.container} py-3 flex items-center justify-between gap-3`}
            >
              <button
                type="button"
                onClick={goBackHome}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-page/70 hover:border-brand text-xs font-semibold text-ink hover:text-brand transition cursor-pointer"
              >
                <ArrowLeft size={15} />
                <span>Voltar à vitrine</span>
              </button>
              <StorefrontBagButton
                cartCount={simCartCount}
                cartTotal={simCartTotal}
                pulseKey={simBagPulseKey}
                onClick={() => setSimDrawerOpen(true)}
              />
            </div>
          </header>

          <div className={`${composition.container} pt-6 space-y-6`}>
            {activeCollection.kind === 'look' ? (
              <StorefrontShopTheLook
                look={activeCollection}
                pieces={activeCollection.products || []}
                template={template}
                onSelectProduct={openProductInPreview}
                onAddLookItems={(entries) => {
                  entries.forEach((entry, idx) =>
                    addSimulatedItem(
                      entry.product,
                      entry.variant,
                      entry.quantity,
                      { openDrawer: idx === entries.length - 1 },
                    ),
                  );
                }}
              />
            ) : (
              <>
                <div
                  className={`rounded-3xl border p-6 sm:p-8 space-y-2 ${
                    isDark
                      ? 'bg-ink border-muted/40 text-on-brand'
                      : 'bg-surface border-line text-ink'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                    Coleção curada • {(activeCollection.products || []).length}{' '}
                    peças
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold">
                    {activeCollection.title}
                  </h1>
                  {(activeCollection.subtitle ||
                    activeCollection.description) && (
                    <p className="text-xs sm:text-sm text-muted max-w-2xl">
                      {activeCollection.description ||
                        activeCollection.subtitle}
                    </p>
                  )}
                </div>

                <div className={`grid ${composition.catalogGrid}`}>
                  {(activeCollection.products || []).map(
                    (prod: any, idx: number) => (
                      <StorefrontProductCard
                        key={prod.id || prod.retailGroupId || idx}
                        product={prod}
                        index={idx}
                        isDark={isDark}
                        template={template}
                        onSelect={() => openProductInPreview(prod.slug, prod)}
                        onQuickAdd={(p, v, src) =>
                          addSimulatedItem(p, v, 1, {
                            openDrawer: false,
                            source: src,
                          })
                        }
                      />
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : simView === 'checkout' ? (
        <div
          style={themeStyles}
          className={`min-h-screen pb-16 ${
            isDark ? 'bg-ink text-on-brand' : 'bg-page text-ink'
          }`}
        >
          <header
            className={`sticky top-0 z-30 border-b backdrop-blur-md ${
              isDark
                ? 'bg-ink/94 border-muted/40 text-on-brand'
                : 'bg-surface/94 border-line text-ink'
            }`}
          >
            <div
              className={`${composition.container} py-3 flex items-center justify-between gap-3`}
            >
              <button
                type="button"
                onClick={goBackHome}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-page/70 hover:border-brand text-xs font-semibold text-ink hover:text-brand transition cursor-pointer"
              >
                <ArrowLeft size={15} />
                <span>Continuar na prévia</span>
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                Simulação de finalização
              </span>
            </div>
          </header>

          <div className={`${composition.container} pt-6 max-w-4xl space-y-5`}>
            <div className="rounded-2xl border border-brand/45 bg-support/75 px-4 py-3 text-xs text-ink flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-brand shrink-0 mt-0.5" />
              <div>
                <strong>Modo de simulação da prévia:</strong> esta etapa permite
                testar a jornada do cliente sem gravar pedidos reais e sem
                reservar estoque da loja.
              </div>
            </div>

            <form
              onSubmit={handleFinishSimulatedCheckout}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5"
            >
              <div className="lg:col-span-7 bg-surface text-ink border border-line rounded-3xl p-5 sm:p-6 space-y-4">
                <h2 className="font-bold text-sm sm:text-base">
                  1. Identificação e Recebimento
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-ink block mb-1">
                      Nome completo
                    </label>
                    <input
                      type="text"
                      required
                      value={simCustomerName}
                      onChange={(e) => setSimCustomerName(e.target.value)}
                      className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink outline-none focus:border-brand"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-ink block mb-1">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      required
                      value={simCustomerPhone}
                      onChange={(e) =>
                        setSimCustomerPhone(formatPhoneInput(e.target.value))
                      }
                      className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {storeData?.pickupEnabled !== false && (
                    <button
                      type="button"
                      onClick={() => setSimFulfillment('PICKUP')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        simFulfillment === 'PICKUP'
                          ? 'border-brand bg-support'
                          : 'border-line bg-page'
                      }`}
                    >
                      <p className="font-bold text-xs text-ink">
                        Retirada na loja
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Sem taxa de entrega
                      </p>
                    </button>
                  )}
                  {storeData?.deliveryEnabled && (
                    <button
                      type="button"
                      onClick={() => setSimFulfillment('DELIVERY')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                        simFulfillment === 'DELIVERY'
                          ? 'border-brand bg-support'
                          : 'border-line bg-page'
                      }`}
                    >
                      <p className="font-bold text-xs text-ink">Entrega</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Informar endereço
                      </p>
                    </button>
                  )}
                </div>

                {simFulfillment === 'DELIVERY' && (
                  <div>
                    <label className="text-xs font-semibold text-ink block mb-1">
                      Endereço para simulação
                    </label>
                    <input
                      type="text"
                      value={simAddress}
                      onChange={(e) => setSimAddress(e.target.value)}
                      placeholder="Rua, número e bairro"
                      className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink outline-none focus:border-brand"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-ink block mb-1">
                    Observações (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={simNotes}
                    onChange={(e) => setSimNotes(e.target.value)}
                    placeholder="Preferência de atendimento..."
                    className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink outline-none focus:border-brand resize-none"
                  />
                </div>
              </div>

              <div className="lg:col-span-5 bg-surface text-ink border border-line rounded-3xl p-5 sm:p-6 space-y-4 self-start">
                <h3 className="font-bold text-sm sm:text-base">
                  Resumo da Sacola ({simCartCount})
                </h3>
                <div className="divide-y divide-line max-h-60 overflow-y-auto">
                  {simCartItems.map((item) => (
                    <div
                      key={item.productId}
                      className="py-2.5 flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <StorefrontProductFrame
                          imageUrl={item.imageUrl}
                          alt={item.productName}
                          productName={item.productName}
                          padding="xs"
                          aspectClassName="w-11 h-14 shrink-0"
                          roundedClassName="rounded-lg"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">
                            {item.quantity}x {item.productName}
                          </p>
                          {(item.size || item.color) && (
                            <p className="text-[11px] text-muted">
                              {[item.size, item.color]
                                .filter(Boolean)
                                .join(' / ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-ink shrink-0 tabular-nums">
                        {formatBrl(item.priceUnit * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-line pt-3 flex items-baseline justify-between">
                  <span className="font-semibold text-sm">Subtotal</span>
                  <span className="text-xl font-bold text-brand tabular-nums">
                    {formatBrl(simCartTotal)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={simCartItems.length === 0}
                  style={{
                    backgroundColor: 'var(--sf-primary)',
                    color: '#FFFFFF',
                  }}
                  className="w-full py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-50"
                >
                  <MessageCircle size={16} />
                  <span>Concluir simulação de pedido</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : simView === 'checkout_done' && simOrderSummary ? (
        <div
          style={themeStyles}
          className={`min-h-screen p-6 flex items-center justify-center ${
            isDark ? 'bg-ink text-on-brand' : 'bg-page text-ink'
          }`}
        >
          <div className="max-w-lg w-full bg-surface text-ink border border-line rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-support text-brand text-xs font-semibold">
              <CheckCircle2 size={14} />
              <span>Simulação concluída • Sem gravação no banco</span>
            </div>
            <h2 className="text-xl font-bold">
               Jornada validada ({simOrderSummary.reference})
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              Nenhum pedido real foi criado nem houve reserva de estoque. Veja
              abaixo como o resumo chegaria ao WhatsApp da loja:
            </p>
            <pre className="p-3.5 rounded-2xl bg-page border border-line text-[11px] text-ink whitespace-pre-wrap font-mono leading-relaxed">
              {simOrderSummary.messagePreview}
            </pre>
            <button
              type="button"
              onClick={goBackHome}
              style={{
                backgroundColor: 'var(--sf-primary)',
                color: '#FFFFFF',
              }}
              className="w-full py-3 px-5 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer"
            >
              Voltar à vitrine da prévia
            </button>
          </div>
        </div>
      ) : (
        <StorefrontHomeView
          storeData={storeData}
          products={filteredProducts}
          allCatalogProducts={products}
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
          cartCount={simCartCount}
          cartTotal={simCartTotal}
          bagPulseKey={simBagPulseKey}
          onSelectProduct={openProductInPreview}
          onQuickAdd={(prod, variant, qty = 1, source) =>
            addSimulatedItem(prod, variant, qty, {
              openDrawer: false,
              source,
            })
          }
          onAddLookItems={(entries) => {
            entries.forEach((entry, idx) =>
              addSimulatedItem(entry.product, entry.variant, entry.quantity, {
                openDrawer: idx === entries.length - 1,
              }),
            );
          }}
          onOpenCart={() => setSimDrawerOpen(true)}
          onOpenCollection={openCollectionInPreview}
          isPreview
          selectedSectionId={selectedSectionId}
          onSelectEditorSection={onSelectEditorSection}
          activeSelectionFilterId={simSelectionFilterId}
          onSelectSelectionFilter={setSimSelectionFilterId}
        />
      )}

      <MobileFloatingCartBar
        visible={simView === 'home' && simCartCount > 0 && !simDrawerOpen}
        cartCount={simCartCount}
        cartTotal={simCartTotal}
        pulseKey={simBagPulseKey}
        onOpenCart={() => setSimDrawerOpen(true)}
      />

      <StorefrontCartDrawer
        open={simDrawerOpen}
        onClose={() => setSimDrawerOpen(false)}
        cartItems={simCartItems}
        cartCount={simCartCount}
        cartTotal={simCartTotal}
        cartValidation={null}
        validatingCart={false}
        isOffline={false}
        isDark={isDark}
        isPreviewSimulation
        themeStyles={themeStyles}
        onUpdateQuantity={updateSimulatedQty}
        onClearCart={() => setSimCartItems([])}
        onNavigateProduct={(prodSlug) => openProductInPreview(prodSlug)}
        onProceedCheckout={() => {
          if (simView === 'home' && win) {
            homeScrollYRef.current = win.scrollY;
          }
          setSimDrawerOpen(false);
          setSimView('checkout');
          win?.scrollTo({ top: 0, behavior: 'auto' });
        }}
      />

      <FlyToBagOverlay
        tokens={simFlyTokens}
        onCompleteToken={(id) => {
          setSimFlyTokens((prev) => prev.filter((t) => t.id !== id));
          setSimBagPulseKey((k) => k + 1);
        }}
      />
    </>
  );
}

export default PublicStorefrontApp;
