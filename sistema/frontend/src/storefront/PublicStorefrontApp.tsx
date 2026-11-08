import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Tag,
  Trash2,
  Truck,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { storefrontApi } from '@/lib/storefront-api';
import { getFullUrl } from '@/lib/getFullUrl';
import {
  CategoryIconBadge,
  CategoryIconIllustration,
} from '@/components/CategoryIcons';
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

const formatBrl = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

function formatPhoneMask(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCepMask(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCpfCnpjMask(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatRemainingTime(expiresAtIso: string | null | undefined): string | null {
  if (!expiresAtIso) return null;
  const diffMs = new Date(expiresAtIso).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Prazo encerrado';
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m restantes`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} restantes`;
}

const COMMERCIAL_STATUS_LABELS: Record<
  string,
  { label: string; desc: string }
> = {
  AWAITING_CONFIRMATION: {
    label: 'Aguardando confirmação da loja',
    desc: 'Seu pedido foi registrado e as peças estão reservadas temporariamente. Envie a mensagem no WhatsApp para agilizar o atendimento.',
  },
  CONFIRMED: {
    label: 'Pedido confirmado pela loja',
    desc: 'A loja confirmou seu pedido e garantiu a separação das peças.',
  },
  COMPLETED: {
    label: 'Venda concluída',
    desc: 'Seu pedido foi faturado e concluído pela loja.',
  },
  REJECTED: {
    label: 'Pedido não atendido',
    desc: 'A loja não pôde atender este pedido e a reserva de estoque foi encerrada.',
  },
  CANCELLED: {
    label: 'Pedido cancelado',
    desc: 'Este pedido foi cancelado e a reserva foi liberada.',
  },
  EXPIRED: {
    label: 'Reserva expirada',
    desc: 'O tempo limite da reserva venceu antes da confirmação do pedido.',
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

const PAYMENT_PREFERENCE_OPTIONS = [
  'Pix',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
  'Link de Pagamento',
  'A combinar no WhatsApp',
];

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

/**
 * Normaliza um produto vindo da API pública ou do preview administrativo
 * para garantir que campos como title/name, slug/publicSlug e totalAvailableStock/availableStock
 * funcionem de forma consistente em ambos os contextos.
 */
function normalizeStorefrontProduct(raw: any) {
  if (!raw) return raw;
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  const computedStock =
    raw.totalAvailableStock !== undefined
      ? Number(raw.totalAvailableStock)
      : raw.availableStock !== undefined
        ? Number(raw.availableStock)
        : variants.reduce(
            (acc: number, v: any) => acc + Math.max(0, Number(v.availableStock ?? v.stock ?? 0)),
            0,
          );

  const sizes = Array.isArray(raw.sizes)
    ? raw.sizes
    : Array.from(
        new Set(
          variants
            .map((v: any) => v.size)
            .filter((s: any): s is string => Boolean(s && String(s).trim())),
        ),
      );

  const colors = Array.isArray(raw.colors)
    ? raw.colors
    : Array.from(
        new Set(
          variants
            .map((v: any) => v.color)
            .filter((c: any): c is string => Boolean(c && String(c).trim())),
        ),
      );

  return {
    ...raw,
    title: raw.title || raw.displayTitle || raw.name || 'Peça da coleção',
    slug: raw.slug || raw.publicSlug || raw.id || '',
    totalAvailableStock: computedStock,
    sizes,
    colors,
    variants,
    galleryUrls: Array.isArray(raw.galleryUrls) ? raw.galleryUrls : [],
  };
}

export function StorefrontHomeView({
  storeData,
  products,
  loadingProducts,
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
  onSelectProduct,
  onQuickAdd,
  isPreview = false,
}: {
  storeData: any;
  products: any[];
  loadingProducts?: boolean;
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
  onSelectProduct: (productSlug: string) => void;
  onQuickAdd?: (product: any, variant: any) => void;
  isPreview?: boolean;
}) {
  const navigate = useNavigate();
  const theme = storeData?.theme || {};
  const template = theme.template || 'editorial_roxo';
  const isDark = template === 'vitrine_escura';
  const isMinimal = template === 'minimal_branco';

  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [orderCodeInput, setOrderCodeInput] = useState('');
  const [recentOrders, setRecentOrders] = useState<RecentStorefrontOrder[]>([]);

  useEffect(() => {
    if (isPreview || !storeData?.publicId) return;
    setRecentOrders(loadRecentStorefrontOrders(storeData.publicId));
  }, [isPreview, storeData?.publicId, showOrdersModal]);

  const sections: any[] = useMemo(() => {
    const raw = Array.isArray(theme.sections) ? theme.sections : null;
    if (raw && raw.length > 0) {
      return raw.filter((s: any) => s.enabled !== false);
    }
    return [
      { id: 'sec-header', type: 'header', enabled: true },
      { id: 'sec-hero', type: 'hero', enabled: true },
      { id: 'sec-categories', type: 'categories', enabled: true },
      { id: 'sec-featured', type: 'featured', enabled: true },
      { id: 'sec-collection', type: 'collection', enabled: true },
      { id: 'sec-fulfillment', type: 'fulfillment_info', enabled: true },
      { id: 'sec-footer', type: 'footer', enabled: true },
    ];
  }, [theme.sections]);

  const categories = storeData?.categories || [];
  const normalizedProducts = useMemo(
    () => (products || []).map(normalizeStorefrontProduct),
    [products],
  );
  const featuredProducts = useMemo(() => {
    const rawFeatured = Array.isArray(storeData?.featuredProducts)
      ? storeData.featuredProducts.map(normalizeStorefrontProduct)
      : [];
    if (rawFeatured.length > 0) return rawFeatured;
    return normalizedProducts.filter((p) => p.featured);
  }, [storeData?.featuredProducts, normalizedProducts]);

  const facets = useMemo(() => {
    if (
      storeData?.facets &&
      (storeData.facets.sizes?.length > 0 || storeData.facets.colors?.length > 0)
    ) {
      return storeData.facets;
    }
    const sizesSet = new Set<string>();
    const colorsSet = new Set<string>();
    normalizedProducts.forEach((p) => {
      (p.sizes || []).forEach((s: string) => sizesSet.add(s));
      (p.colors || []).forEach((c: string) => colorsSet.add(c));
    });
    return {
      sizes: Array.from(sizesSet),
      colors: Array.from(colorsSet),
    };
  }, [storeData?.facets, normalizedProducts]);

  const hasActiveFilters = Boolean(
    search ||
      selectedCategoryId ||
      selectedSize ||
      selectedColor ||
      !inStockOnly ||
      sortBy !== 'featured',
  );

  const handleBannerAction = (banner: any) => {
    if (!banner) return;
    if (banner.targetType === 'category' && banner.targetValue) {
      setSelectedCategoryId(banner.targetValue);
      const el = document.getElementById('sf-collection-anchor');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (banner.targetType === 'product' && banner.targetValue) {
      onSelectProduct(banner.targetValue);
      return;
    }
    if (banner.targetType === 'featured') {
      setSortBy('featured');
      const el = document.getElementById('sf-collection-anchor');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const el = document.getElementById('sf-collection-anchor');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      style={getStoreThemeStyles(theme)}
      className={`min-h-screen flex flex-col selection:bg-support selection:text-brand ${
        isDark
          ? 'bg-ink text-on-brand'
          : isMinimal
            ? 'bg-surface text-ink'
            : 'bg-page text-ink'
      }`}
    >
      {/* Barra de aviso superior */}
      {theme.announcementText && (
        <div
          style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
          className="text-xs font-semibold py-2 px-4 text-center tracking-wide"
        >
          {theme.announcementText}
        </div>
      )}

      {sections.map((section) => {
        if (section.type === 'header') {
          return (
            <header
              key={section.id}
              className={`sticky top-0 z-30 border-b backdrop-blur-md transition-colors ${
                isDark
                  ? 'bg-ink/95 border-muted'
                  : 'bg-surface/95 border-line'
              }`}
            >
              <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                {/* Identidade da Loja */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId('');
                    setSearch('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 min-w-0 text-left group"
                >
                  {storeData?.logoUrl ? (
                    <img
                      src={getFullUrl(storeData.logoUrl)}
                      alt={storeData.storeName}
                      className={`w-10 h-10 sm:w-11 sm:h-11 object-cover border border-line shrink-0 bg-surface ${
                        isMinimal ? 'rounded-lg' : 'rounded-xl'
                      }`}
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center font-black text-base sm:text-lg shrink-0 ${
                        isMinimal ? 'rounded-lg' : 'rounded-xl'
                      }`}
                    >
                      {String(storeData?.storeName || 'L')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="font-black text-base sm:text-lg tracking-tight truncate group-hover:opacity-85 transition">
                      {storeData?.storeName || 'Loja Virtual'}
                    </h1>
                    {storeData?.tagline && (
                      <p
                        className={`text-xs truncate ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {storeData.tagline}
                      </p>
                    )}
                  </div>
                </button>

                {/* Busca rápida integrada no cabeçalho (Desktop) */}
                <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
                  <div className="relative w-full">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar peça, cor ou referência..."
                      className={`w-full pl-9 pr-8 py-2 text-xs font-medium border outline-none transition ${
                        isMinimal ? 'rounded-lg' : 'rounded-full'
                      } ${
                        isDark
                          ? 'bg-ink border-muted text-on-brand placeholder:text-line focus:border-brand'
                          : 'bg-page border-line text-ink placeholder:text-muted focus:border-brand focus:bg-surface'
                      }`}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                        title="Limpar busca"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Ações do cliente: Meus Pedidos + Sacola */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isPreview && (
                    <button
                      type="button"
                      onClick={() => setShowOrdersModal(true)}
                      className={`px-3 py-2 text-xs font-bold border transition flex items-center gap-1.5 ${
                        isMinimal ? 'rounded-lg' : 'rounded-xl'
                      } ${
                        isDark
                          ? 'border-muted text-on-brand hover:bg-muted/30'
                          : 'border-line text-ink hover:bg-page'
                      }`}
                      title="Acompanhar pedidos realizados nesta loja"
                    >
                      <Package size={15} className="text-brand" />
                      <span className="hidden sm:inline">Meus Pedidos</span>
                      {recentOrders.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-support text-brand font-extrabold">
                          {recentOrders.length}
                        </span>
                      )}
                    </button>
                  )}

                  {!isPreview ? (
                    <Link
                      to={`/loja/${storeData?.slug}/carrinho`}
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className={`flex items-center gap-2 px-3.5 py-2 font-bold text-xs sm:text-sm shadow-sm hover:opacity-95 transition shrink-0 ${
                        isMinimal ? 'rounded-lg' : 'rounded-xl'
                      }`}
                    >
                      <ShoppingBag size={16} />
                      <span>Sacola ({cartCount})</span>
                      {cartCount > 0 && (
                        <span className="hidden sm:inline font-mono text-xs opacity-95">
                          • {formatBrl(cartTotal)}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className={`flex items-center gap-2 px-3.5 py-2 font-bold text-xs shadow-sm ${
                        isMinimal ? 'rounded-lg' : 'rounded-xl'
                      }`}
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
          const heroTitle =
            theme.heroTitle ||
            storeData?.tagline ||
            storeData?.storeName ||
            'Nova Coleção';
          const heroSubtitle =
            theme.heroSubtitle ||
            storeData?.description ||
            'Escolha suas peças e tamanhos disponíveis em tempo real e conclua seu pedido com atendimento direto.';
          const hasCover = Boolean(storeData?.coverUrl);

          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 pt-5 pb-2"
            >
              {hasCover ? (
                <div
                  className={`relative overflow-hidden border border-line ${
                    isMinimal ? 'rounded-xl' : 'rounded-2xl'
                  }`}
                >
                  <div className="relative min-h-[220px] sm:min-h-[300px] flex items-end p-6 sm:p-10">
                    <img
                      src={getFullUrl(storeData.coverUrl)}
                      alt={storeData.storeName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-ink/60" />
                    <div className="relative z-10 max-w-2xl text-on-brand space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {storeData?.fulfillment?.pickupEnabled && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface/90 text-ink">
                            <Store size={12} className="text-brand" />
                            Retirada na loja
                          </span>
                        )}
                        {storeData?.fulfillment?.deliveryEnabled && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface/90 text-ink">
                            <Truck size={12} className="text-brand" />
                            Entrega disponível
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                        {heroTitle}
                      </h2>
                      {heroSubtitle && (
                        <p className="text-sm sm:text-base text-line leading-relaxed max-w-xl">
                          {heroSubtitle}
                        </p>
                      )}
                      {theme.heroCtaLabel && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(
                                'sf-collection-anchor',
                              );
                              el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            style={{
                              backgroundColor: 'var(--sf-primary)',
                              color: '#FFFFFF',
                            }}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm hover:opacity-95 transition ${
                              isMinimal ? 'rounded-lg' : 'rounded-xl'
                            }`}
                          >
                            <span>{theme.heroCtaLabel}</span>
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Cabeçalho editorial limpo quando a loja não usa foto de capa */
                <div
                  className={`border p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isMinimal ? 'rounded-xl' : 'rounded-2xl'
                  } ${
                    isDark
                      ? 'bg-ink border-muted text-on-brand'
                      : isMinimal
                        ? 'bg-page border-line text-ink'
                        : 'bg-surface border-line text-ink shadow-sm'
                  }`}
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isDark
                            ? 'bg-brand text-on-brand'
                            : 'bg-support text-brand'
                        }`}
                      >
                        Estoque sincronizado em tempo real
                      </span>
                      {storeData?.fulfillment?.pickupEnabled && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            isDark ? 'text-line' : 'text-muted'
                          }`}
                        >
                          <Store size={12} className="text-brand" />
                          Retirada na loja
                        </span>
                      )}
                      {storeData?.fulfillment?.deliveryEnabled && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            isDark ? 'text-line' : 'text-muted'
                          }`}
                        >
                          <Truck size={12} className="text-brand" />
                          Entrega local
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                      {heroTitle}
                    </h2>
                    {heroSubtitle && (
                      <p
                        className={`text-xs sm:text-sm leading-relaxed ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {heroSubtitle}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {storeData?.whatsappPhone && !isPreview && (
                      <a
                        href={`https://wa.me/${String(storeData.whatsappPhone).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border transition ${
                          isMinimal ? 'rounded-lg' : 'rounded-xl'
                        } ${
                          isDark
                            ? 'border-muted text-on-brand hover:bg-muted/20'
                            : 'border-line bg-page text-ink hover:border-brand'
                        }`}
                      >
                        <MessageCircle size={15} className="text-brand" />
                        <span>Atendimento WhatsApp</span>
                      </a>
                    )}
                    {theme.heroCtaLabel && (
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(
                            'sf-collection-anchor',
                          );
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold hover:opacity-95 transition ${
                          isMinimal ? 'rounded-lg' : 'rounded-xl'
                        }`}
                      >
                        <span>{theme.heroCtaLabel}</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        }

        if (section.type === 'banner') {
          const banners = Array.isArray(theme.banners)
            ? theme.banners.filter((b: any) => b.enabled !== false)
            : [];
          if (banners.length === 0) return null;
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {banners.map((b: any) => (
                <div
                  key={b.id}
                  onClick={() => handleBannerAction(b)}
                  className={`group relative overflow-hidden border p-5 flex items-center justify-between gap-4 cursor-pointer transition ${
                    isMinimal ? 'rounded-xl' : 'rounded-2xl'
                  } ${
                    isDark
                      ? 'bg-ink border-muted hover:border-brand'
                      : 'bg-surface border-line hover:border-brand shadow-sm'
                  }`}
                >
                  {b.imageUrl && (
                    <img
                      src={getFullUrl(b.imageUrl)}
                      alt={b.title}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border border-line shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-brand mb-1">
                      Destaque da Loja
                    </span>
                    <h3 className="font-black text-base sm:text-lg truncate">
                      {b.title}
                    </h3>
                    {b.subtitle && (
                      <p
                        className={`text-xs sm:text-sm mt-0.5 line-clamp-2 ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {b.subtitle}
                      </p>
                    )}
                  </div>
                  {b.ctaLabel && (
                    <span
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 group-hover:opacity-90 transition flex items-center gap-1"
                    >
                      <span>{b.ctaLabel}</span>
                      <ChevronRight size={14} />
                    </span>
                  )}
                </div>
              ))}
            </section>
          );
        }

        if (section.type === 'categories') {
          if (categories.length === 0) return null;
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-3"
            >
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('')}
                  style={
                    !selectedCategoryId
                      ? {
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }
                      : undefined
                  }
                  className={`px-4 py-2 text-xs font-bold whitespace-nowrap transition border flex items-center gap-2 ${
                    isMinimal ? 'rounded-lg' : 'rounded-full'
                  } ${
                    !selectedCategoryId
                      ? 'border-transparent shadow-sm'
                      : isDark
                        ? 'bg-ink border-muted text-line hover:border-on-brand'
                        : 'bg-surface border-line text-ink hover:border-brand'
                  }`}
                >
                  <span>Todas as peças</span>
                </button>
                {categories.map((cat: any) => {
                  const active =
                    selectedCategoryId === cat.id ||
                    selectedCategoryId === cat.slug;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setSelectedCategoryId(active ? '' : cat.id)
                      }
                      style={
                        active
                          ? {
                              backgroundColor: 'var(--sf-primary)',
                              color: '#FFFFFF',
                            }
                          : undefined
                      }
                      className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap transition border flex items-center gap-2 ${
                        isMinimal ? 'rounded-lg' : 'rounded-full'
                      } ${
                        active
                          ? 'border-transparent shadow-sm'
                          : isDark
                            ? 'bg-ink border-muted text-line hover:border-on-brand'
                            : 'bg-surface border-line text-ink hover:border-brand'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-surface flex items-center justify-center shrink-0">
                        <CategoryIconBadge
                          categoryName={cat.name}
                          size={14}
                        />
                      </span>
                      <span>{cat.name}</span>
                      {typeof cat.productCount === 'number' &&
                        cat.productCount > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                              active
                                ? 'bg-surface/20 text-on-brand'
                                : 'bg-support text-brand'
                            }`}
                          >
                            {cat.productCount}
                          </span>
                        )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        }

        if (section.type === 'featured') {
          if (
            featuredProducts.length === 0 ||
            search ||
            selectedCategoryId ||
            selectedSize ||
            selectedColor
          ) {
            return null;
          }
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-5"
            >
              <div className="flex items-end justify-between mb-4">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand">
                    Seleção Especial
                  </span>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">
                    {section.title || 'Destaques da Vitrine'}
                  </h2>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isDark ? 'text-line' : 'text-muted'
                  }`}
                >
                  {featuredProducts.length}{' '}
                  {featuredProducts.length === 1 ? 'peça' : 'peças'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                {featuredProducts.slice(0, 4).map((prod: any) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    isDark={isDark}
                    isMinimal={isMinimal}
                    onSelect={() => onSelectProduct(prod.slug)}
                    onQuickAdd={onQuickAdd}
                  />
                ))}
              </div>
            </section>
          );
        }

        if (section.type === 'collection') {
          const activeCategoryObj = categories.find(
            (c: any) =>
              c.id === selectedCategoryId || c.slug === selectedCategoryId,
          );

          return (
            <section
              id="sf-collection-anchor"
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-5 flex-1"
            >
              {/* Barra de busca Mobile + Controles de Filtro e Ordenação */}
              <div className="flex flex-col gap-3 mb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                      <span>
                        {activeCategoryObj
                          ? activeCategoryObj.name
                          : section.title || 'Catálogo da Loja'}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          isDark
                            ? 'bg-muted/30 text-line'
                            : 'bg-support text-brand'
                        }`}
                      >
                        {normalizedProducts.length}
                      </span>
                    </h2>
                    {activeCategoryObj?.description && (
                      <p
                        className={`text-xs mt-0.5 ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {activeCategoryObj.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(facets.sizes?.length > 0 ||
                      facets.colors?.length > 0) && (
                      <button
                        type="button"
                        onClick={() => setShowFiltersDrawer((prev) => !prev)}
                        className={`px-3 py-2 text-xs font-bold border transition flex items-center gap-1.5 ${
                          isMinimal ? 'rounded-lg' : 'rounded-xl'
                        } ${
                          selectedSize || selectedColor || showFiltersDrawer
                            ? 'border-brand bg-support text-brand'
                            : isDark
                              ? 'bg-ink border-muted text-on-brand'
                              : 'bg-surface border-line text-ink hover:border-brand'
                        }`}
                      >
                        <SlidersHorizontal size={14} />
                        <span>Tamanhos & Cores</span>
                        {(selectedSize || selectedColor) && (
                          <span className="w-2 h-2 rounded-full bg-brand" />
                        )}
                      </button>
                    )}

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`px-3 py-2 border text-xs font-bold outline-none cursor-pointer ${
                        isMinimal ? 'rounded-lg' : 'rounded-xl'
                      } ${
                        isDark
                          ? 'bg-ink border-muted text-on-brand'
                          : 'bg-surface border-line text-ink'
                      }`}
                    >
                      <option value="featured">Destaques primeiro</option>
                      <option value="newest">Mais recentes</option>
                      <option value="price_asc">Menor preço</option>
                      <option value="price_desc">Maior preço</option>
                      <option value="name_asc">Ordem A–Z</option>
                    </select>
                  </div>
                </div>

                {/* Busca visível no Mobile */}
                <div className="md:hidden relative">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar peça, cor ou código..."
                    className={`w-full pl-9 pr-8 py-2.5 text-sm border outline-none ${
                      isMinimal ? 'rounded-lg' : 'rounded-xl'
                    } ${
                      isDark
                        ? 'bg-ink border-muted text-on-brand placeholder:text-line'
                        : 'bg-surface border-line text-ink placeholder:text-muted focus:border-brand'
                    }`}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Painel expansível de Tamanhos, Cores e Disponibilidade */}
                {(showFiltersDrawer || selectedSize || selectedColor) && (
                  <div
                    className={`p-4 border flex flex-wrap items-center justify-between gap-4 ${
                      isMinimal ? 'rounded-xl' : 'rounded-2xl'
                    } ${
                      isDark
                        ? 'bg-ink border-muted'
                        : 'bg-surface border-line shadow-sm'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      {facets.sizes?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-1">
                            Tamanho:
                          </span>
                          {facets.sizes.map((size: string) => {
                            const active = selectedSize === size;
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() =>
                                  setSelectedSize(active ? '' : size)
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                  active
                                    ? 'bg-brand text-on-brand border-brand'
                                    : isDark
                                      ? 'border-muted text-line hover:border-on-brand'
                                      : 'border-line bg-page text-ink hover:border-brand'
                                }`}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {facets.colors?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-1">
                            Cor:
                          </span>
                          {facets.colors.map((color: string) => {
                            const active = selectedColor === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() =>
                                  setSelectedColor(active ? '' : color)
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                                  active
                                    ? 'bg-brand text-on-brand border-brand'
                                    : isDark
                                      ? 'border-muted text-line hover:border-on-brand'
                                      : 'border-line bg-page text-ink hover:border-brand'
                                }`}
                              >
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(e) => setInStockOnly(e.target.checked)}
                          className="rounded accent-brand w-4 h-4"
                        />
                        <span>Somente disponíveis</span>
                      </label>

                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setSelectedCategoryId('');
                            setSelectedSize('');
                            setSelectedColor('');
                            setSortBy('featured');
                            setInStockOnly(true);
                          }}
                          className="text-xs font-bold text-brand hover:underline"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {loadingProducts ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted">
                  <Loader2 className="animate-spin text-brand" size={28} />
                  <p className="text-sm font-medium">
                    Atualizando vitrine da loja...
                  </p>
                </div>
              ) : normalizedProducts.length === 0 ? (
                <div
                  className={`p-10 text-center border ${
                    isMinimal ? 'rounded-xl' : 'rounded-2xl'
                  } ${
                    isDark ? 'border-muted bg-ink' : 'border-line bg-surface'
                  }`}
                >
                  <Package size={36} className="mx-auto mb-3 text-brand" />
                  <h3 className="font-bold text-base">
                    Nenhuma peça encontrada com esses filtros
                  </h3>
                  <p
                    className={`text-xs mt-1 max-w-md mx-auto ${
                      isDark ? 'text-line' : 'text-muted'
                    }`}
                  >
                    Tente buscar por outro termo ou limpar os filtros de tamanho
                    e categoria para ver toda a coleção disponível.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setSelectedCategoryId('');
                        setSelectedSize('');
                        setSelectedColor('');
                        setInStockOnly(false);
                      }}
                      className="mt-4 px-4 py-2 rounded-xl bg-brand text-on-brand text-xs font-bold"
                    >
                      Ver todas as peças
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {normalizedProducts.map((prod: any) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      isDark={isDark}
                      isMinimal={isMinimal}
                      onSelect={() => onSelectProduct(prod.slug)}
                      onQuickAdd={onQuickAdd}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        }

        if (section.type === 'fulfillment_info') {
          const fulfillment = storeData?.fulfillment || {};
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-6"
            >
              <div
                className={`p-5 sm:p-6 border grid grid-cols-1 md:grid-cols-3 gap-4 ${
                  isMinimal ? 'rounded-xl' : 'rounded-2xl'
                } ${
                  isDark
                    ? 'bg-ink border-muted'
                    : 'bg-surface border-line shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-support text-brand flex items-center justify-center shrink-0">
                    <Store size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Retirada na Loja</h3>
                    <p
                      className={`text-xs mt-0.5 leading-relaxed ${
                        isDark ? 'text-line' : 'text-muted'
                      }`}
                    >
                      {fulfillment.pickupEnabled
                        ? fulfillment.pickupInstructions ||
                          'Reserve online e retire diretamente no balcão da loja com agilidade.'
                        : 'Opção de retirada presencial indisponível no momento.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-support text-brand flex items-center justify-center shrink-0">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Entrega Local</h3>
                    <p
                      className={`text-xs mt-0.5 leading-relaxed ${
                        isDark ? 'text-line' : 'text-muted'
                      }`}
                    >
                      {fulfillment.deliveryEnabled
                        ? `${fulfillment.deliveryNotes || 'Receba no seu endereço.'} ${
                            Number(fulfillment.deliveryFeeDefault || 0) > 0
                              ? `Taxa base: ${formatBrl(fulfillment.deliveryFeeDefault)}`
                              : 'Taxa combinada no atendimento.'
                          }`
                        : 'Entrega externa não habilitada para esta vitrine.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-support text-brand flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">
                      Reserva Garantida & WhatsApp
                    </h3>
                    <p
                      className={`text-xs mt-0.5 leading-relaxed ${
                        isDark ? 'text-line' : 'text-muted'
                      }`}
                    >
                      Ao finalizar o pedido, suas peças ficam reservadas no
                      estoque da loja enquanto você confirma o pagamento pelo
                      WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        if (section.type === 'footer') {
          return (
            <footer
              key={section.id}
              className={`mt-auto border-t py-8 px-4 ${
                isDark
                  ? 'border-muted bg-ink text-line'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="text-center sm:text-left">
                  <p className="font-bold text-sm text-ink dark:text-on-brand">
                    {storeData?.storeName || 'Loja Virtual'}
                  </p>
                  {storeData?.address && (
                    <p className="mt-1 flex items-center justify-center sm:justify-start gap-1">
                      <MapPin size={12} /> {storeData.address}
                    </p>
                  )}
                  {storeData?.businessHours && (
                    <p className="mt-0.5 flex items-center justify-center sm:justify-start gap-1">
                      <Clock size={12} /> {storeData.businessHours}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:items-end gap-1.5">
                  {storeData?.whatsappPhone && (
                    <span className="inline-flex items-center gap-1.5 font-bold text-brand">
                      <Phone size={13} />
                      {formatPhoneMask(storeData.whatsappPhone)}
                    </span>
                  )}
                  <span className="text-[11px] opacity-80">
                    Catálogo online sincronizado ao PDV Lojista
                  </span>
                </div>
              </div>
            </footer>
          );
        }

        return null;
      })}

      {/* Barra Flutuante Mobile da Sacola */}
      {!isPreview && cartCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 sm:hidden">
          <Link
            to={`/loja/${storeData?.slug}/carrinho`}
            style={{
              backgroundColor: 'var(--sf-primary)',
              color: '#FFFFFF',
            }}
            className="w-full py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-between font-bold text-sm"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} />
              <span>
                Ver sacola ({cartCount}{' '}
                {cartCount === 1 ? 'item' : 'itens'})
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span>{formatBrl(cartTotal)}</span>
              <ArrowRight size={16} />
            </div>
          </Link>
        </div>
      )}

      {/* Modal "Meus Pedidos" para consulta rápida pelo cliente */}
      {!isPreview && showOrdersModal && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface text-ink border border-line rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-brand" />
                <h3 className="font-black text-base">Acompanhar Pedido</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOrdersModal(false)}
                className="p-1 rounded-lg text-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cleanRef = orderCodeInput.trim().toUpperCase();
                if (!cleanRef) return;
                setShowOrdersModal(false);
                navigate(`/loja/${storeData?.slug}/pedido/${cleanRef}`);
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-bold text-muted">
                Consultar por código do pedido
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderCodeInput}
                  onChange={(e) =>
                    setOrderCodeInput(e.target.value.toUpperCase())
                  }
                  placeholder="Ex: PED-20261108-ABCD"
                  className="flex-1 px-3 py-2 rounded-xl border border-line bg-page text-xs font-mono uppercase outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand text-on-brand text-xs font-bold hover:bg-brand-strong transition"
                >
                  Buscar
                </button>
              </div>
            </form>

            {recentOrders.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-line">
                <p className="text-xs font-bold text-muted">
                  Pedidos recentes neste aparelho
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {recentOrders.map((ord) => (
                    <Link
                      key={ord.reference}
                      to={`/loja/${storeData?.slug}/pedido/${ord.reference}${
                        ord.accessToken
                          ? `?token=${encodeURIComponent(ord.accessToken)}`
                          : ''
                      }`}
                      onClick={() => setShowOrdersModal(false)}
                      className="flex items-center justify-between p-3 rounded-xl border border-line bg-page hover:border-brand transition"
                    >
                      <div>
                        <p className="font-mono font-bold text-xs text-brand">
                          {ord.reference}
                        </p>
                        <p className="text-[11px] text-muted">
                          {new Date(ord.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {ord.itemsCount}{' '}
                          {ord.itemsCount === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xs">
                          {formatBrl(ord.total)}
                        </p>
                        <span className="text-[10px] font-bold text-brand flex items-center gap-0.5 justify-end">
                          Ver status <ChevronRight size={12} />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted text-center py-3">
                Seus pedidos realizados nesta loja aparecerão listados aqui
                para consulta rápida.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  isDark,
  isMinimal,
  onSelect,
  onQuickAdd,
}: {
  product: any;
  isDark: boolean;
  isMinimal?: boolean;
  onSelect: () => void;
  onQuickAdd?: (product: any, variant: any) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );

  const inStock = Number(product.totalAvailableStock || 0) > 0;
  const lowStock =
    inStock && Number(product.totalAvailableStock || 0) <= 3;

  const availableVariants = useMemo(
    () =>
      (product.variants || []).filter(
        (v: any) => Number(v.availableStock ?? v.stock ?? 0) > 0,
      ),
    [product.variants],
  );

  const secondaryImage =
    Array.isArray(product.galleryUrls) && product.galleryUrls.length > 0
      ? product.galleryUrls[0]
      : null;

  const displayImage =
    hovered && secondaryImage ? secondaryImage : product.imageUrl;

  const handleQuickAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onQuickAdd || !inStock) return;

    if (availableVariants.length === 1) {
      onQuickAdd(product, availableVariants[0]);
      return;
    }

    if (selectedVariantId) {
      const chosen = availableVariants.find(
        (v: any) => v.id === selectedVariantId,
      );
      if (chosen) {
        onQuickAdd(product, chosen);
        return;
      }
    }

    // Se tem múltiplas variações e nenhuma foi selecionada no card, abre a página da peça
    onSelect();
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group border overflow-hidden flex flex-col transition-all duration-200 ${
        isMinimal ? 'rounded-xl' : 'rounded-2xl'
      } ${
        isDark
          ? 'bg-ink border-muted hover:border-brand'
          : 'bg-surface border-line hover:border-brand hover:shadow-md'
      }`}
    >
      {/* Imagem proporção 4:5 (Editorial Moda/Varejo) */}
      <div
        onClick={onSelect}
        className="aspect-[4/5] bg-page relative overflow-hidden cursor-pointer"
      >
        {displayImage ? (
          <img
            src={getFullUrl(displayImage)}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full">
            <CategoryIconIllustration
              categoryName={product.category?.name}
              productName={product.title}
            />
          </div>
        )}

        {/* Selos discretos no topo */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {product.badgeLabel ? (
            <span
              style={{
                backgroundColor: 'var(--sf-primary)',
                color: '#FFFFFF',
              }}
              className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-xs"
            >
              {product.badgeLabel}
            </span>
          ) : product.featured ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-surface/95 text-brand border border-line shadow-xs">
              Destaque
            </span>
          ) : null}

          {lowStock && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ink/85 text-on-brand">
              Últimas {product.totalAvailableStock} un.
            </span>
          )}
        </div>

        {!inStock && (
          <div className="absolute inset-0 bg-ink/65 flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-full bg-surface text-ink text-xs font-black uppercase tracking-wider">
              Esgotado
            </span>
          </div>
        )}
      </div>

      {/* Corpo do Card */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
        <div onClick={onSelect} className="cursor-pointer">
          {product.category?.name && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block truncate ${
                isDark ? 'text-line' : 'text-muted'
              }`}
            >
              {product.category.name}
            </span>
          )}
          <h3 className="font-bold text-sm leading-snug line-clamp-2 mt-0.5 group-hover:text-brand transition-colors">
            {product.title}
          </h3>
        </div>

        <div className="space-y-2.5 pt-1">
          {/* Seleção rápida de tamanhos/variações direto no card */}
          {availableVariants.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {availableVariants.slice(0, 5).map((v: any) => {
                const label =
                  [v.size, v.color].filter(Boolean).join(' • ') || 'Único';
                const isSelected = selectedVariantId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVariantId(isSelected ? null : v.id);
                    }}
                    title={`Selecionar ${label}`}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                      isSelected
                        ? 'bg-brand text-on-brand border-brand'
                        : isDark
                          ? 'border-muted text-line hover:border-on-brand'
                          : 'border-line bg-page text-ink hover:border-brand'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {availableVariants.length > 5 && (
                <button
                  type="button"
                  onClick={onSelect}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-brand"
                >
                  +{availableVariants.length - 5}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div>
              <p className="text-base sm:text-lg font-black tracking-tight">
                {formatBrl(product.price)}
              </p>
            </div>

            {inStock ? (
              <button
                type="button"
                onClick={handleQuickAddClick}
                style={{
                  backgroundColor:
                    availableVariants.length === 1 || selectedVariantId
                      ? 'var(--sf-primary)'
                      : undefined,
                  color:
                    availableVariants.length === 1 || selectedVariantId
                      ? '#FFFFFF'
                      : undefined,
                }}
                className={`px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
                  isMinimal ? 'rounded-lg' : 'rounded-xl'
                } ${
                  availableVariants.length === 1 || selectedVariantId
                    ? 'shadow-xs hover:opacity-95'
                    : isDark
                      ? 'border border-muted text-on-brand hover:bg-muted/30'
                      : 'bg-support text-brand hover:bg-brand hover:text-on-brand'
                }`}
              >
                {availableVariants.length === 1 || selectedVariantId ? (
                  <>
                    <Plus size={14} />
                    <span>Adicionar</span>
                  </>
                ) : (
                  <span>Opções</span>
                )}
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-muted">
                Indisponível
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicStorefrontApp() {
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [storeData, setStoreData] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState<{
    status: number;
    message: string;
  } | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Filtros de vitrine
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(true);

  // Sacola
  const [cartItems, setCartItems] = useState<StorefrontCartItem[]>([]);

  // Detalhe de produto
  const productMatch = location.pathname.match(/\/loja\/[^/]+\/produto\/([^/]+)/);
  const activeProductSlug = productMatch ? decodeURIComponent(productMatch[1]) : null;
  const isCartView = /\/loja\/[^/]+\/carrinho\/?$/.test(location.pathname);
  const orderMatch = location.pathname.match(/\/loja\/[^/]+\/pedido\/([^/]+)/);
  const activeOrderReference = orderMatch ? decodeURIComponent(orderMatch[1]) : null;

  const [productDetail, setProductDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedDetailColor, setSelectedDetailColor] = useState<string | null>(null);
  const [selectedDetailSize, setSelectedDetailSize] = useState<string | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [activeGalleryImage, setActiveGalleryImage] = useState<string | null>(null);

  // Checkout state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [zipCode, setZipCode] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [addressLine, setAddressLine] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [paymentMethodPreference, setPaymentMethodPreference] = useState('Pix');
  const [notes, setNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutLoadedProfile, setCheckoutLoadedProfile] = useState(false);

  // Order status view
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [, setClockTick] = useState(0);

  // Atualiza contador regressivo de reserva a cada segundo quando há pedido ativo
  useEffect(() => {
    if (!activeOrderReference || !orderSummary?.reservationExpiresAt) return;
    const timer = window.setInterval(() => {
      setClockTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeOrderReference, orderSummary?.reservationExpiresAt]);

  const syncCart = useCallback(
    (publicId: string, storeSlug: string) => {
      const loaded = loadStoreCart(publicId, storeSlug);
      setCartItems(loaded.items);
    },
    [],
  );

  // Carrega dados iniciais da loja e perfil salvo do cliente
  const fetchStoreHome = useCallback(async () => {
    if (!slug) return;
    setLoadingStore(true);
    setStoreError(null);
    try {
      const res = await storefrontApi.get(
        `/storefront/public/stores/${encodeURIComponent(slug)}`,
      );
      const data = res.data;
      setStoreData(data);
      syncCart(data.publicId, data.slug);

      const savedProfile = loadStorefrontCustomerProfile(data.publicId);
      if (savedProfile && !checkoutLoadedProfile) {
        if (savedProfile.customerName) setCustomerName(savedProfile.customerName);
        if (savedProfile.customerPhone) setCustomerPhone(savedProfile.customerPhone);
        if (savedProfile.customerDocument) setCustomerDocument(savedProfile.customerDocument);
        if (savedProfile.zipCode) setZipCode(savedProfile.zipCode);
        if (savedProfile.addressLine) setAddressLine(savedProfile.addressLine);
        if (savedProfile.addressNumber) setAddressNumber(savedProfile.addressNumber);
        if (savedProfile.addressComplement) setAddressComplement(savedProfile.addressComplement);
        if (savedProfile.neighborhood) setNeighborhood(savedProfile.neighborhood);
        if (savedProfile.city) setCity(savedProfile.city);
        if (savedProfile.state) setStateUf(savedProfile.state);
        if (savedProfile.paymentMethodPreference) {
          setPaymentMethodPreference(savedProfile.paymentMethodPreference);
        }
        setCheckoutLoadedProfile(true);
      }

      if (data.fulfillment) {
        if (
          savedProfile?.deliveryMode === 'DELIVERY' &&
          data.fulfillment.deliveryEnabled
        ) {
          setDeliveryMode('DELIVERY');
        } else if (data.fulfillment.pickupEnabled) {
          setDeliveryMode('PICKUP');
        } else if (data.fulfillment.deliveryEnabled) {
          setDeliveryMode('DELIVERY');
        }
      }
    } catch (err: any) {
      const status = err?.response?.status || 500;
      const message =
        err?.response?.data?.message ||
        'Não foi possível carregar esta loja no momento.';
      setStoreError({ status, message });
    } finally {
      setLoadingStore(false);
    }
  }, [slug, syncCart, checkoutLoadedProfile]);

  useEffect(() => {
    fetchStoreHome();
  }, [fetchStoreHome]);

  // Persiste dados do cliente localmente ao preencher o checkout
  useEffect(() => {
    if (!storeData?.publicId || !checkoutLoadedProfile) return;
    saveStorefrontCustomerProfile(storeData.publicId, {
      customerName,
      customerPhone,
      customerDocument,
      deliveryMode,
      zipCode,
      addressLine,
      addressNumber,
      addressComplement,
      neighborhood,
      city,
      state: stateUf,
      paymentMethodPreference,
    });
  }, [
    storeData?.publicId,
    checkoutLoadedProfile,
    customerName,
    customerPhone,
    customerDocument,
    deliveryMode,
    zipCode,
    addressLine,
    addressNumber,
    addressComplement,
    neighborhood,
    city,
    stateUf,
    paymentMethodPreference,
  ]);

  // Busca automática de CEP via ViaCEP
  const handleCepChange = async (rawValue: string) => {
    const masked = formatCepMask(rawValue);
    setZipCode(masked);
    const digits = masked.replace(/\D/g, '');
    if (digits.length === 8) {
      setLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        if (response.ok) {
          const data = await response.json();
          if (!data.erro) {
            if (data.logradouro) setAddressLine(data.logradouro);
            if (data.bairro) setNeighborhood(data.bairro);
            if (data.localidade) setCity(data.localidade);
            if (data.uf) setStateUf(data.uf);
          }
        }
      } catch {
        // Falha silenciosa caso sem internet externa; usuário preenche manualmente
      } finally {
        setLoadingCep(false);
      }
    }
  };

  // Escuta alterações de carrinho
  useEffect(() => {
    if (!storeData?.publicId) return;
    const handler = () => syncCart(storeData.publicId, storeData.slug);
    window.addEventListener('storefront-cart-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('storefront-cart-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [storeData, syncCart]);

  // Carrega listagem filtrada de produtos
  const fetchProducts = useCallback(async () => {
    if (!slug || !storeData) return;
    setLoadingProducts(true);
    try {
      const res = await storefrontApi.get(
        `/storefront/public/stores/${encodeURIComponent(slug)}/products`,
        {
          params: {
            search: search || undefined,
            category: selectedCategoryId || undefined,
            size: selectedSize || undefined,
            color: selectedColor || undefined,
            sort: sortBy,
            inStockOnly: inStockOnly ? 'true' : 'false',
            limit: 60,
          },
        },
      );
      setProducts(res.data?.items || []);
    } catch {
      // Mantém lista anterior
    } finally {
      setLoadingProducts(false);
    }
  }, [
    slug,
    storeData,
    search,
    selectedCategoryId,
    selectedSize,
    selectedColor,
    sortBy,
    inStockOnly,
  ]);

  useEffect(() => {
    if (storeData && !activeProductSlug && !isCartView && !activeOrderReference) {
      fetchProducts();
    }
  }, [
    storeData,
    activeProductSlug,
    isCartView,
    activeOrderReference,
    fetchProducts,
  ]);

  // Carrega detalhe de um produto
  useEffect(() => {
    if (!slug || !activeProductSlug) {
      setProductDetail(null);
      return;
    }
    let mounted = true;
    setLoadingDetail(true);
    storefrontApi
      .get(
        `/storefront/public/stores/${encodeURIComponent(slug)}/products/${encodeURIComponent(activeProductSlug)}`,
      )
      .then((res) => {
        if (!mounted) return;
        const p = normalizeStorefrontProduct(res.data);
        setProductDetail(p);
        setActiveGalleryImage(p.imageUrl || null);
        const firstAvailable = (p.variants || []).find(
          (v: any) => Number(v.availableStock) > 0,
        );
        if (firstAvailable) {
          setSelectedDetailColor(firstAvailable.color || null);
          setSelectedDetailSize(firstAvailable.size || null);
        } else if (p.variants?.length > 0) {
          setSelectedDetailColor(p.variants[0].color || null);
          setSelectedDetailSize(p.variants[0].size || null);
        }
        setDetailQty(1);
      })
      .catch((err) => {
        if (!mounted) return;
        toast.error(
          err?.response?.data?.message || 'Produto não encontrado nesta vitrine.',
        );
        navigate(`/loja/${slug}`);
      })
      .finally(() => {
        if (mounted) setLoadingDetail(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug, activeProductSlug, navigate]);

  // Carrega resumo do pedido
  const fetchOrderSummary = useCallback(async () => {
    if (!slug || !activeOrderReference || !storeData?.publicId) return;
    const urlToken = searchParams.get('token');
    const savedToken = getSavedOrderAccessToken(
      storeData.publicId,
      activeOrderReference,
    );
    const token = urlToken || savedToken || '';

    if (urlToken) {
      saveOrderAccessToken(storeData.publicId, activeOrderReference, urlToken);
    }

    setLoadingOrder(true);
    setOrderError(null);
    try {
      const res = await storefrontApi.get(
        `/storefront/public/stores/${encodeURIComponent(slug)}/orders/${encodeURIComponent(activeOrderReference)}`,
        { params: { token } },
      );
      setOrderSummary(res.data);
    } catch (err: any) {
      setOrderError(
        err?.response?.data?.message ||
          'Não foi possível localizar os detalhes deste pedido.',
      );
    } finally {
      setLoadingOrder(false);
    }
  }, [slug, activeOrderReference, storeData?.publicId, searchParams]);

  useEffect(() => {
    if (activeOrderReference && storeData?.publicId) {
      fetchOrderSummary();
    }
  }, [activeOrderReference, storeData?.publicId, fetchOrderSummary]);

  const cartCount = useMemo(
    () => cartItems.reduce((acc, i) => acc + i.quantity, 0),
    [cartItems],
  );
  const cartSubtotal = useMemo(
    () => cartItems.reduce((acc, i) => acc + i.priceUnit * i.quantity, 0),
    [cartItems],
  );
  const deliveryFee = useMemo(() => {
    if (deliveryMode !== 'DELIVERY') return 0;
    return Number(storeData?.fulfillment?.deliveryFeeDefault || 0);
  }, [deliveryMode, storeData]);
  const cartTotal = cartSubtotal + deliveryFee;

  // Variantes disponíveis no detalhe do produto
  const selectedVariant = useMemo(() => {
    if (!productDetail?.variants) return null;
    return (
      productDetail.variants.find(
        (v: any) =>
          (v.color || null) === selectedDetailColor &&
          (v.size || null) === selectedDetailSize,
      ) ||
      productDetail.variants.find(
        (v: any) =>
          (!selectedDetailColor || v.color === selectedDetailColor) &&
          (!selectedDetailSize || v.size === selectedDetailSize),
      ) ||
      productDetail.variants[0] ||
      null
    );
  }, [productDetail, selectedDetailColor, selectedDetailSize]);

  const handleAddVariantToCart = (
    product: any,
    variant: any,
    qty: number,
    goToCart = false,
  ) => {
    if (!storeData?.publicId || !variant) return;
    if (Number(variant.availableStock) <= 0) {
      toast.error('Esta opção está esgotada no momento.');
      return;
    }
    const updated = addOrUpdateCartItem(storeData.publicId, storeData.slug, {
      productId: variant.id,
      retailGroupId: product.id,
      productSlug: product.slug,
      productName: product.title,
      size: variant.size || null,
      color: variant.color || null,
      imageUrl: product.imageUrl || null,
      unit: variant.unit || 'UN',
      quantity: qty,
      priceUnit: Number(variant.price || product.price || 0),
      maxAvailableStock: Number(variant.availableStock || 1),
    });
    setCartItems(updated.items);
    if (goToCart) {
      navigate(`/loja/${storeData.slug}/carrinho`);
    } else {
      toast.success('Adicionado à sacola!', {
        description: `${product.title}${variant.size ? ` • Tam: ${variant.size}` : ''}${variant.color ? ` • ${variant.color}` : ''}`,
      });
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeData?.publicId || cartItems.length === 0) return;

    if (!customerName.trim() || customerName.trim().length < 2) {
      toast.error('Informe seu nome completo.');
      return;
    }
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Informe um WhatsApp/telefone válido com DDD.');
      return;
    }
    if (deliveryMode === 'DELIVERY') {
      if (!addressLine.trim() || !addressNumber.trim() || !neighborhood.trim() || !city.trim()) {
        toast.error(
          'Preencha Rua, Número, Bairro e Cidade para entrega.',
        );
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      const idempotencyKey = getOrCreateOrderAttemptKey(
        storeData.publicId,
        storeData.slug,
      );
      const res = await storefrontApi.post(
        `/storefront/public/stores/${encodeURIComponent(storeData.slug)}/orders`,
        {
          idempotencyKey,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerDocument: customerDocument.trim() || undefined,
          deliveryMode,
          zipCode: zipCode.trim() || undefined,
          addressLine: addressLine.trim() || undefined,
          addressNumber: addressNumber.trim() || undefined,
          addressComplement: addressComplement.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim() || undefined,
          state: stateUf.trim() || undefined,
          addressReference: addressReference.trim() || undefined,
          paymentMethodPreference: paymentMethodPreference.trim() || undefined,
          notes: notes.trim() || undefined,
          items: cartItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      );

      const created = res.data;
      saveOrderAccessToken(
        storeData.publicId,
        created.reference,
        created.accessToken,
      );
      saveRecentStorefrontOrder(storeData.publicId, {
        reference: created.reference,
        accessToken: created.accessToken,
        createdAt: created.createdAt || new Date().toISOString(),
        total: Number(created.total || cartTotal),
        status: created.commercialStatus || 'AWAITING_CONFIRMATION',
        itemsCount: cartCount,
      });
      clearStoreCart(storeData.publicId, storeData.slug);
      setCartItems([]);
      toast.success(`Pedido ${created.reference} registrado com sucesso!`);
      navigate(
        `/loja/${storeData.slug}/pedido/${created.reference}?token=${encodeURIComponent(created.accessToken)}`,
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Não foi possível concluir o pedido. Verifique a disponibilidade dos itens.';
      toast.error(msg);
      fetchStoreHome();
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Estados de carregamento ou loja indisponível
  if (loadingStore) {
    return (
      <div className="min-h-screen bg-page flex flex-col items-center justify-center p-6 text-ink">
        <Loader2 className="animate-spin text-brand mb-3" size={34} />
        <p className="text-sm font-semibold text-muted">
          Carregando loja virtual...
        </p>
      </div>
    );
  }

  if (storeError || !storeData) {
    const isOffline = storeError?.status === 503;
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6 text-ink">
        <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-support text-brand flex items-center justify-center mx-auto mb-4">
            {isOffline ? <WifiOff size={26} /> : <Store size={26} />}
          </div>
          <h1 className="text-xl font-black mb-2">
            {isOffline
              ? 'Loja Temporariamente Indisponível'
              : 'Vitrine Não Encontrada'}
          </h1>
          <p className="text-sm text-muted leading-relaxed mb-6">
            {storeError?.message ||
              'Verifique se o endereço da loja está correto ou tente novamente em instantes.'}
          </p>
          <button
            type="button"
            onClick={fetchStoreHome}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-on-brand text-xs font-bold hover:bg-brand-strong transition"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const theme = storeData.theme || {};
  const isDark = theme.template === 'vitrine_escura';

  // ============================================================================
  // VISÃO 1: PÁGINA DE ACOMPANHAMENTO DO PEDIDO (/loja/:slug/pedido/:referencia)
  // ============================================================================
  if (activeOrderReference) {
    const commStatus =
      COMMERCIAL_STATUS_LABELS[orderSummary?.commercialStatus] || {
        label: orderSummary?.commercialStatus || 'Em processamento',
        desc: '',
      };

    const isCancelledOrExpired = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(
      orderSummary?.commercialStatus,
    );
    const stepIndex =
      orderSummary?.commercialStatus === 'COMPLETED' ||
      orderSummary?.fulfillmentStatus === 'DELIVERED'
        ? 3
        : ['PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(
              orderSummary?.fulfillmentStatus,
            )
          ? 2
          : orderSummary?.commercialStatus === 'CONFIRMED'
            ? 1
            : 0;

    const remainingTimeLabel =
      orderSummary?.reservationStatus === 'ACTIVE'
        ? formatRemainingTime(orderSummary?.reservationExpiresAt)
        : null;

    return (
      <div
        style={getStoreThemeStyles(theme)}
        className={`min-h-screen flex flex-col ${
          isDark ? 'bg-ink text-on-brand' : 'bg-page text-ink'
        }`}
      >
        <header
          className={`border-b ${
            isDark ? 'bg-ink border-muted' : 'bg-surface border-line'
          }`}
        >
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              to={`/loja/${storeData.slug}`}
              className="inline-flex items-center gap-2 text-xs font-bold hover:opacity-80"
            >
              <ArrowLeft size={16} />
              <span>Voltar para {storeData.storeName}</span>
            </Link>
            <span className="text-xs font-mono font-bold text-brand">
              {activeOrderReference}
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
          {loadingOrder ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-brand" size={28} />
              <p className="text-sm text-muted">
                Consultando situação do pedido...
              </p>
            </div>
          ) : orderError || !orderSummary ? (
            <div className="bg-surface text-ink border border-line rounded-2xl p-8 text-center">
              <AlertCircle size={32} className="mx-auto mb-3 text-brand" />
              <h2 className="font-black text-lg mb-1">
                Pedido não localizado
              </h2>
              <p className="text-xs text-muted mb-5">{orderError}</p>
              <Link
                to={`/loja/${storeData.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-on-brand text-xs font-bold"
              >
                Ir para a vitrine da loja
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Card Principal do Status + Linha do Tempo */}
              <div
                className={`p-6 rounded-2xl border ${
                  isDark
                    ? 'bg-ink border-muted'
                    : 'bg-surface border-line shadow-sm'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-support text-brand">
                      Pedido {orderSummary.reference}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(orderSummary.reference);
                        toast.success('Código do pedido copiado!');
                      }}
                      className="p-1.5 rounded-lg border border-line text-muted hover:text-ink text-xs flex items-center gap-1"
                      title="Copiar código"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={fetchOrderSummary}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                  >
                    <RefreshCw size={13} /> Atualizar status
                  </button>
                </div>

                <h1 className="text-xl sm:text-2xl font-black mb-1">
                  {commStatus.label}
                </h1>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mb-5 ${
                    isDark ? 'text-line' : 'text-muted'
                  }`}
                >
                  {commStatus.desc}
                </p>

                {/* Linha do tempo visual de acompanhamento */}
                {!isCancelledOrExpired && (
                  <div className="grid grid-cols-4 gap-2 pt-2 pb-5 border-b border-line mb-5">
                    {[
                      { label: 'Recebido' },
                      { label: 'Confirmado' },
                      {
                        label:
                          orderSummary.deliveryMode === 'DELIVERY'
                            ? 'Em Entrega'
                            : 'Para Retirada',
                      },
                      { label: 'Concluído' },
                    ].map((st, idx) => {
                      const done = idx <= stepIndex;
                      return (
                        <div key={st.label} className="space-y-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-colors ${
                              done ? 'bg-brand' : 'bg-line'
                            }`}
                          />
                          <p
                            className={`text-[11px] font-bold ${
                              done ? 'text-brand' : 'text-muted'
                            }`}
                          >
                            {st.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {orderSummary.whatsappConfirmationUrl &&
                  ['AWAITING_CONFIRMATION', 'CONFIRMED'].includes(
                    orderSummary.commercialStatus,
                  ) && (
                    <a
                      href={orderSummary.whatsappConfirmationUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className="w-full py-3.5 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition mb-4"
                    >
                      <MessageCircle size={18} />
                      <span>Enviar Pedido no WhatsApp da Loja</span>
                      <ExternalLink size={14} />
                    </a>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-page text-ink border border-line">
                    <span className="text-[10px] font-bold uppercase text-muted block">
                      Atendimento / Entrega
                    </span>
                    <span className="text-xs font-bold mt-0.5 block">
                      {FULFILLMENT_STATUS_LABELS[
                        orderSummary.fulfillmentStatus
                      ] || orderSummary.fulfillmentStatus}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-page text-ink border border-line">
                    <span className="text-[10px] font-bold uppercase text-muted block">
                      Reserva de Estoque
                    </span>
                    <span className="text-xs font-bold mt-0.5 block">
                      {RESERVATION_STATUS_LABELS[
                        orderSummary.reservationStatus
                      ] || orderSummary.reservationStatus}
                    </span>
                    {remainingTimeLabel && (
                      <span className="text-[11px] font-extrabold text-brand mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> {remainingTimeLabel}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-page text-ink border border-line">
                    <span className="text-[10px] font-bold uppercase text-muted block">
                      Pagamento
                    </span>
                    <span className="text-xs font-bold mt-0.5 block">
                      {PAYMENT_STATUS_LABELS[orderSummary.paymentStatus] ||
                        orderSummary.paymentStatus}
                    </span>
                    {orderSummary.paymentMethodPreference && (
                      <span className="text-[10px] text-muted block mt-0.5">
                        Preferência: {orderSummary.paymentMethodPreference}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumo de Itens */}
              <div
                className={`p-6 rounded-2xl border ${
                  isDark
                    ? 'bg-ink border-muted'
                    : 'bg-surface border-line shadow-sm'
                }`}
              >
                <h3 className="font-bold text-sm mb-4">
                  Itens do Pedido ({orderSummary.items?.length || 0})
                </h3>
                <div className="divide-y divide-line">
                  {(orderSummary.items || []).map((item: any) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-14 rounded-lg overflow-hidden border border-line bg-page shrink-0">
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
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm truncate">
                            {item.productName}
                          </p>
                          <p
                            className={`text-[11px] ${
                              isDark ? 'text-line' : 'text-muted'
                            }`}
                          >
                            {[
                              item.size && `Tam: ${item.size}`,
                              item.color && `Cor: ${item.color}`,
                              `Qtd: ${item.quantity}`,
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-xs sm:text-sm shrink-0">
                        {formatBrl(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-line mt-4 pt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-line' : 'text-muted'}>
                      Subtotal
                    </span>
                    <span className="font-semibold">
                      {formatBrl(orderSummary.subtotal)}
                    </span>
                  </div>
                  {Number(orderSummary.deliveryFee || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-line' : 'text-muted'}>
                        Taxa de entrega
                      </span>
                      <span className="font-semibold">
                        {formatBrl(orderSummary.deliveryFee)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black pt-2 border-t border-line">
                    <span>Total do Pedido</span>
                    <span>{formatBrl(orderSummary.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============================================================================
  // VISÃO 2: SACOLA E CHECKOUT (/loja/:slug/carrinho)
  // ============================================================================
  if (isCartView) {
    return (
      <div
        style={getStoreThemeStyles(theme)}
        className={`min-h-screen flex flex-col ${
          isDark ? 'bg-ink text-on-brand' : 'bg-page text-ink'
        }`}
      >
        <header
          className={`border-b ${
            isDark ? 'bg-ink border-muted' : 'bg-surface border-line'
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              to={`/loja/${storeData.slug}`}
              className="inline-flex items-center gap-2 text-xs font-bold hover:opacity-80"
            >
              <ArrowLeft size={16} />
              <span>Continuar comprando</span>
            </Link>
            <h1 className="font-black text-sm sm:text-base flex items-center gap-2">
              <ShoppingBag size={16} className="text-brand" />
              <span>Sua Sacola ({cartCount})</span>
            </h1>
          </div>
        </header>

        <main className="max-w-5xl mx-auto w-full px-4 py-6 flex-1">
          {cartItems.length === 0 ? (
            <div className="bg-surface text-ink border border-line rounded-2xl p-10 text-center max-w-md mx-auto my-8">
              <div className="w-14 h-14 rounded-2xl bg-support text-brand flex items-center justify-center mx-auto mb-3">
                <ShoppingBag size={26} />
              </div>
              <h2 className="font-black text-lg mb-1">Sua sacola está vazia</h2>
              <p className="text-xs text-muted mb-5">
                Explore a coleção da loja, escolha o tamanho e adicione suas
                peças favoritas.
              </p>
              <Link
                to={`/loja/${storeData.slug}`}
                style={{
                  backgroundColor: 'var(--sf-primary)',
                  color: '#FFFFFF',
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold"
              >
                Explorar produtos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Lista de itens na sacola */}
              <div className="lg:col-span-6 space-y-3">
                <div
                  className={`p-5 rounded-2xl border ${
                    isDark
                      ? 'bg-ink border-muted'
                      : 'bg-surface border-line shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-black text-sm">Peças Selecionadas</h2>
                    <button
                      type="button"
                      onClick={() => {
                        clearStoreCart(storeData.publicId, storeData.slug);
                        setCartItems([]);
                      }}
                      className="text-[11px] font-bold text-muted hover:text-ink"
                    >
                      Esvaziar sacola
                    </button>
                  </div>
                  <div className="divide-y divide-line">
                    {cartItems.map((item) => (
                      <div
                        key={item.productId}
                        className="py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-16 rounded-xl overflow-hidden border border-line bg-page shrink-0">
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
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs sm:text-sm truncate">
                              {item.productName}
                            </p>
                            <p
                              className={`text-[11px] ${
                                isDark ? 'text-line' : 'text-muted'
                              }`}
                            >
                              {[
                                item.size && `Tam: ${item.size}`,
                                item.color && `Cor: ${item.color}`,
                              ]
                                .filter(Boolean)
                                .join(' • ') || 'Tamanho único'}
                            </p>
                            <p className="text-xs font-black mt-1">
                              {formatBrl(item.priceUnit * item.quantity)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const next = setCartItemQuantity(
                                storeData.publicId,
                                storeData.slug,
                                item.productId,
                                item.quantity - 1,
                              );
                              setCartItems(next.items);
                            }}
                            className="w-7 h-7 rounded-lg border border-line flex items-center justify-center hover:bg-page text-ink bg-surface"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.quantity >= item.maxAvailableStock) {
                                toast.info(
                                  `Limite disponível em estoque (${item.maxAvailableStock} un.) atingido.`,
                                );
                                return;
                              }
                              const next = setCartItemQuantity(
                                storeData.publicId,
                                storeData.slug,
                                item.productId,
                                item.quantity + 1,
                              );
                              setCartItems(next.items);
                            }}
                            className="w-7 h-7 rounded-lg border border-line flex items-center justify-center hover:bg-page text-ink bg-surface"
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = setCartItemQuantity(
                                storeData.publicId,
                                storeData.slug,
                                item.productId,
                                0,
                              );
                              setCartItems(next.items);
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink ml-1"
                            title="Remover item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Formulário de Checkout */}
              <form
                onSubmit={handleCheckoutSubmit}
                className={`lg:col-span-6 p-5 sm:p-6 rounded-2xl border space-y-4 ${
                  isDark
                    ? 'bg-ink border-muted'
                    : 'bg-surface border-line shadow-sm'
                }`}
              >
                <div>
                  <h2 className="font-black text-base">
                    Dados para Reserva e Atendimento
                  </h2>
                  <p
                    className={`text-xs mt-0.5 ${
                      isDark ? 'text-line' : 'text-muted'
                    }`}
                  >
                    Seus dados ficam salvos neste aparelho para facilitar suas
                    próximas compras.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold mb-1">
                      Seu nome completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Maria Oliveira"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      WhatsApp com DDD *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) =>
                        setCustomerPhone(formatPhoneMask(e.target.value))
                      }
                      placeholder="(11) 99999-9999"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      CPF / CNPJ (opcional)
                    </label>
                    <input
                      type="text"
                      value={customerDocument}
                      onChange={(e) =>
                        setCustomerDocument(formatCpfCnpjMask(e.target.value))
                      }
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Escolha de Retirada ou Entrega */}
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    Como prefere receber? *
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {storeData.fulfillment?.pickupEnabled && (
                      <button
                        type="button"
                        onClick={() => setDeliveryMode('PICKUP')}
                        className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                          deliveryMode === 'PICKUP'
                            ? 'border-brand bg-support text-ink'
                            : 'border-line bg-surface text-ink hover:border-brand'
                        }`}
                      >
                        <Store size={18} className="text-brand shrink-0" />
                        <div>
                          <span className="block text-xs font-black">
                            Retirar na Loja
                          </span>
                          <span className="block text-[10px] text-muted">
                            Grátis
                          </span>
                        </div>
                      </button>
                    )}
                    {storeData.fulfillment?.deliveryEnabled && (
                      <button
                        type="button"
                        onClick={() => setDeliveryMode('DELIVERY')}
                        className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                          deliveryMode === 'DELIVERY'
                            ? 'border-brand bg-support text-ink'
                            : 'border-line bg-surface text-ink hover:border-brand'
                        }`}
                      >
                        <Truck size={18} className="text-brand shrink-0" />
                        <div>
                          <span className="block text-xs font-black">
                            Entrega
                          </span>
                          <span className="block text-[10px] text-muted">
                            {Number(
                              storeData.fulfillment?.deliveryFeeDefault || 0,
                            ) > 0
                              ? formatBrl(
                                  storeData.fulfillment.deliveryFeeDefault,
                                )
                              : 'A combinar'}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {deliveryMode === 'DELIVERY' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-page text-ink border border-line">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        CEP
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={zipCode}
                          onChange={(e) => handleCepChange(e.target.value)}
                          placeholder="00000-000"
                          className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs"
                        />
                        {loadingCep && (
                          <Loader2
                            size={13}
                            className="animate-spin text-brand absolute right-2.5 top-1/2 -translate-y-1/2"
                          />
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold mb-1">
                        Endereço / Rua *
                      </label>
                      <input
                        type="text"
                        required
                        value={addressLine}
                        onChange={(e) => setAddressLine(e.target.value)}
                        placeholder="Rua / Avenida"
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        Número *
                      </label>
                      <input
                        type="text"
                        required
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        placeholder="Nº"
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={addressComplement}
                        onChange={(e) => setAddressComplement(e.target.value)}
                        placeholder="Apto, Bloco..."
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        required
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Bairro"
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold mb-1">
                        Cidade *
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Cidade"
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        UF
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={stateUf}
                        onChange={(e) =>
                          setStateUf(e.target.value.toUpperCase())
                        }
                        placeholder="SP"
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs uppercase"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold mb-1">
                        Ponto de referência (opcional)
                      </label>
                      <input
                        type="text"
                        value={addressReference}
                        onChange={(e) => setAddressReference(e.target.value)}
                        placeholder="Ex: Próximo à praça central"
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Preferência de pagamento em botões rápidos */}
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    Como prefere pagar no atendimento?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_PREFERENCE_OPTIONS.map((opt) => {
                      const active = paymentMethodPreference === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setPaymentMethodPreference(opt)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            active
                              ? 'bg-brand text-on-brand border-brand'
                              : 'bg-page text-ink border-line hover:border-brand'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Observações do pedido (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Alguma observação sobre embrulho para presente, horário ou entrega?"
                    className="w-full px-3.5 py-2 rounded-xl border border-line bg-surface text-ink text-xs outline-none focus:border-brand"
                  />
                </div>

                <div className="border-t border-line pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-line' : 'text-muted'}>
                      Subtotal ({cartCount} itens)
                    </span>
                    <span className="font-bold">{formatBrl(cartSubtotal)}</span>
                  </div>
                  {deliveryMode === 'DELIVERY' && (
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-line' : 'text-muted'}>
                        Taxa de entrega
                      </span>
                      <span className="font-bold">
                        {deliveryFee > 0
                          ? formatBrl(deliveryFee)
                          : 'A combinar'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black pt-2 border-t border-line">
                    <span>Total estimado</span>
                    <span>{formatBrl(cartTotal)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingOrder}
                  style={{
                    backgroundColor: 'var(--sf-primary)',
                    color: '#FFFFFF',
                  }}
                  className="w-full py-3.5 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition disabled:opacity-60"
                >
                  {submittingOrder ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Reservando peças...</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle size={18} />
                      <span>Confirmar Reserva e Abrir WhatsApp</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============================================================================
  // VISÃO 3: DETALHE DO PRODUTO (/loja/:slug/produto/:produtoSlug)
  // ============================================================================
  if (activeProductSlug) {
    const allImages = productDetail
      ? Array.from(
          new Set(
            [
              productDetail.imageUrl,
              ...(productDetail.galleryUrls || []),
            ].filter(Boolean),
          ),
        )
      : [];

    const whatsappQuestionUrl =
      storeData.whatsappPhone && productDetail
        ? `https://wa.me/${String(storeData.whatsappPhone).replace(/\D/g, '')}?text=${encodeURIComponent(
            `Olá! Estou vendo a peça "${productDetail.title}" na loja virtual e gostaria de tirar uma dúvida.`,
          )}`
        : null;

    return (
      <div
        style={getStoreThemeStyles(theme)}
        className={`min-h-screen flex flex-col ${
          isDark ? 'bg-ink text-on-brand' : 'bg-page text-ink'
        }`}
      >
        <header
          className={`sticky top-0 z-30 border-b backdrop-blur-md ${
            isDark ? 'bg-ink/95 border-muted' : 'bg-surface/95 border-line'
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
            <Link
              to={`/loja/${storeData.slug}`}
              className="inline-flex items-center gap-2 text-xs font-bold hover:opacity-80"
            >
              <ArrowLeft size={16} />
              <span>Voltar para a vitrine</span>
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = window.location.href;
                  if (navigator.share) {
                    navigator
                      .share({
                        title: productDetail?.title || storeData.storeName,
                        url,
                      })
                      .catch(() => {});
                  } else {
                    navigator.clipboard.writeText(url);
                    toast.success('Link da peça copiado!');
                  }
                }}
                className="p-2 rounded-xl border border-line text-muted hover:text-ink transition"
                title="Compartilhar peça"
              >
                <Share2 size={15} />
              </button>
              <Link
                to={`/loja/${storeData.slug}/carrinho`}
                style={{
                  backgroundColor: 'var(--sf-primary)',
                  color: '#FFFFFF',
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm"
              >
                <ShoppingBag size={15} />
                <span>Sacola ({cartCount})</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto w-full px-4 py-6 sm:py-8 flex-1">
          {loadingDetail || !productDetail ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-brand" size={28} />
              <p className="text-sm text-muted">
                Carregando detalhes da peça...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-xs text-muted overflow-x-auto whitespace-nowrap">
                <Link
                  to={`/loja/${storeData.slug}`}
                  className="hover:text-brand font-medium"
                >
                  Início
                </Link>
                <ChevronRight size={12} />
                {productDetail.category?.name && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(productDetail.category.id);
                        navigate(`/loja/${storeData.slug}`);
                      }}
                      className="hover:text-brand font-medium"
                    >
                      {productDetail.category.name}
                    </button>
                    <ChevronRight size={12} />
                  </>
                )}
                <span className="font-bold text-ink truncate">
                  {productDetail.title}
                </span>
              </nav>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
                {/* Galeria de imagens (Proporção 4:5) */}
                <div className="md:col-span-6 space-y-3">
                  <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-line bg-surface relative">
                    {activeGalleryImage || productDetail.imageUrl ? (
                      <img
                        src={getFullUrl(
                          activeGalleryImage || productDetail.imageUrl,
                        )}
                        alt={productDetail.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full">
                        <CategoryIconIllustration
                          categoryName={productDetail.category?.name}
                          productName={productDetail.title}
                        />
                      </div>
                    )}
                    {productDetail.badgeLabel && (
                      <span
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-xs"
                      >
                        {productDetail.badgeLabel}
                      </span>
                    )}
                  </div>

                  {allImages.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-1">
                      {allImages.map((imgUrl: string, idx: number) => {
                        const active =
                          (activeGalleryImage || productDetail.imageUrl) ===
                          imgUrl;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveGalleryImage(imgUrl)}
                            className={`w-16 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                              active
                                ? 'border-brand scale-102'
                                : 'border-line opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={getFullUrl(imgUrl)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Informações e Seletor de Variações */}
                <div className="md:col-span-6 flex flex-col justify-between">
                  <div className="space-y-5">
                    <div>
                      {productDetail.category?.name && (
                        <span className="text-xs font-extrabold uppercase tracking-wider text-brand">
                          {productDetail.category.name}
                        </span>
                      )}
                      <h1 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                        {productDetail.title}
                      </h1>
                      <p className="text-2xl sm:text-3xl font-black mt-3">
                        {formatBrl(
                          selectedVariant?.price || productDetail.price,
                        )}
                      </p>
                    </div>

                    {productDetail.description && (
                      <p
                        className={`text-sm leading-relaxed ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {productDetail.description}
                      </p>
                    )}

                    {/* Seleção de Cor */}
                    {productDetail.colors?.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                          Cor:{' '}
                          <span className="text-brand">
                            {selectedDetailColor || 'Selecione'}
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {productDetail.colors.map((color: string) => {
                            const active = selectedDetailColor === color;
                            const hasStockForColor = (
                              productDetail.variants || []
                            ).some(
                              (v: any) =>
                                v.color === color &&
                                Number(v.availableStock) > 0,
                            );
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setSelectedDetailColor(color)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                                  active
                                    ? 'border-brand bg-brand text-on-brand'
                                    : hasStockForColor
                                      ? 'border-line bg-surface text-ink hover:border-brand'
                                      : 'border-line bg-page text-muted opacity-55 line-through'
                                }`}
                              >
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Seleção de Tamanho */}
                    {productDetail.sizes?.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                          Tamanho:{' '}
                          <span className="text-brand">
                            {selectedDetailSize || 'Selecione'}
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {productDetail.sizes.map((size: string) => {
                            const active = selectedDetailSize === size;
                            const matchingVariant = (
                              productDetail.variants || []
                            ).find(
                              (v: any) =>
                                v.size === size &&
                                (!selectedDetailColor ||
                                  v.color === selectedDetailColor),
                            );
                            const available =
                              Number(matchingVariant?.availableStock || 0) > 0;
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setSelectedDetailSize(size)}
                                className={`min-w-[46px] px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                                  active
                                    ? 'border-brand bg-brand text-on-brand'
                                    : available
                                      ? 'border-line bg-surface text-ink hover:border-brand'
                                      : 'border-line bg-page text-muted opacity-55 line-through'
                                }`}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Estoque e Quantidade */}
                    {selectedVariant && (
                      <div className="p-4 rounded-xl border border-line bg-surface text-ink flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold block">
                            {Number(selectedVariant.availableStock) > 0
                              ? 'Disponível para reserva imediata'
                              : 'Opção esgotada no momento'}
                          </span>
                          <span className="text-[11px] text-muted">
                            {Number(selectedVariant.availableStock) > 0
                              ? Number(selectedVariant.availableStock) <= 5
                                ? `Restam apenas ${selectedVariant.availableStock} un. em estoque`
                                : 'Pronta entrega na loja'
                              : 'Selecione outro tamanho ou cor'}
                          </span>
                        </div>

                        {Number(selectedVariant.availableStock) > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setDetailQty((q) => Math.max(1, q - 1))
                              }
                              className="w-8 h-8 rounded-lg border border-line flex items-center justify-center hover:bg-page"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-7 text-center font-bold text-sm">
                              {detailQty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setDetailQty((q) =>
                                  Math.min(
                                    Number(selectedVariant.availableStock),
                                    q + 1,
                                  ),
                                )
                              }
                              className="w-8 h-8 rounded-lg border border-line flex items-center justify-center hover:bg-page"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botões de Ação: Adicionar à Sacola + Comprar Agora */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={
                          !selectedVariant ||
                          Number(selectedVariant.availableStock) <= 0
                        }
                        onClick={() =>
                          handleAddVariantToCart(
                            productDetail,
                            selectedVariant,
                            detailQty,
                            false,
                          )
                        }
                        className="py-3.5 px-5 rounded-xl font-black text-sm border-2 border-brand text-brand bg-surface hover:bg-support transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <ShoppingBag size={17} />
                        <span>Adicionar à Sacola</span>
                      </button>

                      <button
                        type="button"
                        disabled={
                          !selectedVariant ||
                          Number(selectedVariant.availableStock) <= 0
                        }
                        onClick={() =>
                          handleAddVariantToCart(
                            productDetail,
                            selectedVariant,
                            detailQty,
                            true,
                          )
                        }
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="py-3.5 px-5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition disabled:opacity-50"
                      >
                        <span>Comprar Agora</span>
                        <ArrowRight size={17} />
                      </button>
                    </div>

                    {whatsappQuestionUrl && (
                      <a
                        href={whatsappQuestionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                          isDark
                            ? 'border-muted text-line hover:border-on-brand'
                            : 'border-line bg-surface text-muted hover:text-ink hover:border-brand'
                        }`}
                      >
                        <MessageCircle size={15} className="text-brand" />
                        <span>Tirar dúvida sobre esta peça no WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============================================================================
  // VISÃO 4: HOME DA LOJA VIRTUAL (/loja/:slug)
  // ============================================================================
  return (
    <StorefrontHomeView
      storeData={storeData}
      products={products}
      loadingProducts={loadingProducts}
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
      cartTotal={cartSubtotal}
      onSelectProduct={(productSlug) =>
        navigate(`/loja/${storeData.slug}/produto/${productSlug}`)
      }
      onQuickAdd={(prod, variant) =>
        handleAddVariantToCart(prod, variant, 1, false)
      }
    />
  );
}
