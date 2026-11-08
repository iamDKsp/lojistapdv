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
  Loader2,
  MapPin,
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
  Store,
  Tag,
  Trash2,
  Truck,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { storefrontApi } from '@/lib/storefront-api';
import { getFullUrl } from '@/lib/getFullUrl';
import { getCategoryIcon } from '@/components/CategoryIcons';
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
  onOpenCart,
  recentOrders = [],
  onSelectOrder,
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
  onOpenCart?: () => void;
  recentOrders?: RecentStorefrontOrder[];
  onSelectOrder?: (reference: string, accessToken?: string) => void;
  isPreview?: boolean;
}) {
  const theme = storeData?.theme || {};
  const template = theme.template || 'editorial_roxo';
  const isDark = template === 'vitrine_escura';
  const isMinimal = template === 'minimal_branco';
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

  const scrollToCatalog = () => {
    const el = document.getElementById('catalogo-loja');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      style={getStoreThemeStyles(theme)}
      className={`min-h-screen flex flex-col selection:bg-brand selection:text-on-brand ${
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
          className="text-[11px] sm:text-xs font-semibold py-2 px-4 text-center tracking-wide border-b border-line/20"
        >
          {theme.announcementText}
        </div>
      )}

      {/* Barra discreta de pedidos recentes do cliente */}
      {!isPreview && recentOrders.length > 0 && onSelectOrder && (
        <div className="bg-support border-b border-line px-4 py-1.5 text-xs text-ink">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
            <span className="font-semibold text-muted flex items-center gap-1.5 shrink-0">
              <Receipt size={13} className="text-brand" />
              Seus pedidos recentes:
            </span>
            <div className="flex items-center gap-2">
              {recentOrders.slice(0, 3).map((ord) => (
                <button
                  key={ord.reference}
                  type="button"
                  onClick={() => onSelectOrder(ord.reference, ord.accessToken)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface border border-line text-[11px] font-bold text-ink hover:border-brand transition shrink-0"
                >
                  <span className="font-mono text-brand">{ord.reference}</span>
                  <span className="text-muted">•</span>
                  <span>{formatBrl(ord.total)}</span>
                  <ChevronRight size={12} className="text-muted" />
                </button>
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
                  ? 'bg-ink/95 border-muted/40'
                  : 'bg-surface/95 border-line'
              }`}
            >
              <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                {/* Identidade da loja */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId('');
                    setSearch('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3 min-w-0 text-left group"
                >
                  {storeData.logoUrl ? (
                    <img
                      src={getFullUrl(storeData.logoUrl)}
                      alt={storeData.storeName}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-line shrink-0 bg-surface"
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'var(--sf-primary)',
                        color: '#FFFFFF',
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs"
                    >
                      {String(storeData.storeName || 'L')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="font-extrabold text-sm sm:text-base tracking-tight truncate group-hover:text-brand transition-colors">
                      {storeData.storeName || 'Loja Virtual'}
                    </h1>
                    {storeData.tagline && (
                      <p
                        className={`text-[11px] truncate ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {storeData.tagline}
                      </p>
                    )}
                  </div>
                </button>

                {/* Busca rápida integrada no topo (Desktop) */}
                <div className="hidden md:flex relative flex-1 max-w-sm mx-4">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar peça, modelo ou referência..."
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition ${
                      isDark
                        ? 'bg-ink border-muted text-on-brand placeholder:text-line/60 focus:border-brand'
                        : 'bg-page border-line text-ink placeholder:text-muted focus:border-brand focus:bg-surface'
                    }`}
                  />
                </div>

                {/* Ações do cabeçalho */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isPreview &&
                    (onOpenCart ? (
                      <button
                        type="button"
                        onClick={onOpenCart}
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 transition cursor-pointer"
                      >
                        <ShoppingBag size={16} />
                        <span>Sacola</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-surface/20 text-[11px] font-mono">
                          {cartCount}
                        </span>
                        {cartCount > 0 && (
                          <span className="hidden sm:inline font-mono text-xs pl-0.5">
                            • {formatBrl(cartTotal)}
                          </span>
                        )}
                      </button>
                    ) : (
                      <Link
                        to={`/loja/${storeData.slug}/carrinho`}
                        style={{
                          backgroundColor: 'var(--sf-primary)',
                          color: '#FFFFFF',
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-xs hover:opacity-95 transition"
                      >
                        <ShoppingBag size={16} />
                        <span>Sacola ({cartCount})</span>
                        {cartCount > 0 && (
                          <span className="hidden sm:inline font-mono text-xs">
                            • {formatBrl(cartTotal)}
                          </span>
                        )}
                      </Link>
                    ))}
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
              className="max-w-6xl mx-auto w-full px-4 pt-5 pb-2"
            >
              <div
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
                className={`rounded-2xl border overflow-hidden ${
                  isMinimal
                    ? 'border-line shadow-xs'
                    : isDark
                      ? 'border-muted/40'
                      : 'border-brand/20 shadow-sm'
                }`}
              >
                <div
                  className={`grid grid-cols-1 ${
                    hasCover ? 'lg:grid-cols-12' : ''
                  } items-center`}
                >
                  <div
                    className={`p-6 sm:p-8 lg:p-10 space-y-4 ${
                      hasCover ? 'lg:col-span-7' : 'max-w-3xl'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {pickupEnabled && (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                            isMinimal
                              ? 'bg-support text-brand border border-brand/20'
                              : 'bg-surface/15 text-on-brand'
                          }`}
                        >
                          <Store size={12} /> Retirada na loja
                        </span>
                      )}
                      {deliveryEnabled && (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                            isMinimal
                              ? 'bg-support text-brand border border-brand/20'
                              : 'bg-surface/15 text-on-brand'
                          }`}
                        >
                          <Truck size={12} /> Entrega a combinar
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
                      {theme.heroTitle ||
                        `Coleção ${storeData.storeName || 'Oficial'}`}
                    </h2>

                    <p
                      className={`text-sm sm:text-base leading-relaxed max-w-xl ${
                        isMinimal ? 'text-muted' : 'opacity-90'
                      }`}
                    >
                      {theme.heroSubtitle ||
                        storeData.description ||
                        'Confira a disponibilidade real por tamanho e cor, monte sua sacola e finalize seu pedido pelo WhatsApp.'}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={scrollToCatalog}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
                          isMinimal
                            ? 'bg-brand text-on-brand hover:bg-brand-hover'
                            : 'bg-surface text-ink hover:bg-support'
                        }`}
                      >
                        <span>{theme.heroCtaLabel || 'Explorar catálogo'}</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>

                  {hasCover && (
                    <div className="lg:col-span-5 h-52 sm:h-64 lg:h-full min-h-[240px] bg-page/20">
                      <img
                        src={getFullUrl(storeData.coverUrl)}
                        alt={storeData.storeName}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Banners secundários */}
              {banners.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
                  {banners.map((banner: any) => (
                    <button
                      type="button"
                      key={banner.id}
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
                      className={`rounded-2xl border p-4 flex items-center justify-between gap-4 text-left transition cursor-pointer group ${
                        isDark
                          ? 'border-muted/40 bg-ink hover:border-brand'
                          : 'border-line bg-surface text-ink hover:border-brand shadow-2xs'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-brand">
                          Destaque
                        </span>
                        <h3 className="font-extrabold text-sm sm:text-base truncate group-hover:text-brand transition-colors">
                          {banner.title}
                        </h3>
                        {banner.subtitle && (
                          <p className="text-xs text-muted line-clamp-2">
                            {banner.subtitle}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-brand pt-1">
                          {banner.ctaLabel || 'Conferir'}{' '}
                          <ChevronRight size={13} />
                        </span>
                      </div>
                      {banner.imageUrl && (
                        <img
                          src={getFullUrl(banner.imageUrl)}
                          alt={banner.title}
                          loading="lazy"
                          className="w-20 h-20 rounded-xl object-cover border border-line shrink-0 bg-page"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        }

        if (section.type === 'categories' && categories.length > 0) {
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  {section.title || 'Categorias'}
                </h3>
                {selectedCategoryId && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('')}
                    className="text-xs font-bold text-brand hover:underline cursor-pointer"
                  >
                    Ver todas
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition cursor-pointer ${
                    !selectedCategoryId
                      ? 'bg-brand text-on-brand border-brand shadow-2xs'
                      : isDark
                        ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                        : 'bg-surface text-ink border-line hover:border-brand'
                  }`}
                >
                  Todas as peças
                </button>
                {categories.map((cat: any) => {
                  const active = selectedCategoryId === cat.id;
                  const CatIcon = getCategoryIcon(cat.icon || cat.name);
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() =>
                        setSelectedCategoryId(active ? '' : cat.id)
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition cursor-pointer ${
                        active
                          ? 'bg-brand text-on-brand border-brand shadow-2xs'
                          : isDark
                            ? 'bg-ink text-on-brand border-muted/50 hover:border-brand'
                            : 'bg-surface text-ink border-line hover:border-brand'
                      }`}
                    >
                      <CatIcon size={14} />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        }

        if (
          section.type === 'featured' &&
          featuredProducts.length > 0 &&
          !hasActiveFilters
        ) {
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-4"
            >
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                    {section.title || 'Seleção em Destaque'}
                  </h3>
                  {section.subtitle && (
                    <p className="text-xs text-muted mt-0.5">
                      {section.subtitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {featuredProducts.slice(0, 4).map((prod: any) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    isDark={isDark}
                    onSelect={() => onSelectProduct(prod.slug)}
                    onQuickAdd={onQuickAdd}
                  />
                ))}
              </div>
            </section>
          );
        }

        if (section.type === 'collection') {
          return (
            <section
              id="catalogo-loja"
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-4 flex-1"
            >
              {/* Barra de busca mobile + filtros refinados */}
              <div
                className={`rounded-2xl border p-3.5 mb-5 space-y-3 ${
                  isDark
                    ? 'bg-ink border-muted/40 text-on-brand'
                    : 'bg-surface border-line text-ink shadow-2xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1 md:hidden">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por modelo, categoria ou cor..."
                      className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none ${
                        isDark
                          ? 'bg-ink border-muted text-on-brand'
                          : 'bg-page border-line text-ink focus:border-brand'
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-muted inline-flex items-center gap-1.5 mr-1">
                      <SlidersHorizontal size={13} className="text-brand" />
                      <span>Filtrar:</span>
                    </span>

                    {facets.sizes?.length > 0 && (
                      <select
                        value={selectedSize}
                        onChange={(e) => setSelectedSize(e.target.value)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold outline-none cursor-pointer ${
                          selectedSize
                            ? 'border-brand bg-support text-brand'
                            : isDark
                              ? 'border-muted/50 bg-ink text-on-brand'
                              : 'border-line bg-page text-ink focus:border-brand'
                        }`}
                      >
                        <option value="">Tamanho (Todos)</option>
                        {facets.sizes.map((sz: string) => (
                          <option key={sz} value={sz}>
                            Tam: {sz}
                          </option>
                        ))}
                      </select>
                    )}

                    {facets.colors?.length > 0 && (
                      <select
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold outline-none cursor-pointer ${
                          selectedColor
                            ? 'border-brand bg-support text-brand'
                            : isDark
                              ? 'border-muted/50 bg-ink text-on-brand'
                              : 'border-line bg-page text-ink focus:border-brand'
                        }`}
                      >
                        <option value="">Cor (Todas)</option>
                        {facets.colors.map((cl: string) => (
                          <option key={cl} value={cl}>
                            Cor: {cl}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => setInStockOnly(!inStockOnly)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        inStockOnly
                          ? 'border-brand bg-support text-brand'
                          : isDark
                            ? 'border-muted/50 bg-ink text-on-brand'
                            : 'border-line bg-page text-ink hover:border-brand'
                      }`}
                    >
                      <Check
                        size={12}
                        className={inStockOnly ? 'text-brand' : 'opacity-40'}
                      />
                      <span>Disponíveis</span>
                    </button>

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
                        className="text-xs font-bold text-brand hover:underline px-2 py-1 cursor-pointer"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
                    <span className="text-[11px] font-semibold text-muted">
                      {products.length}{' '}
                      {products.length === 1 ? 'peça' : 'peças'}
                    </span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                        isDark
                          ? 'border-muted/50 bg-ink text-on-brand'
                          : 'border-line bg-page text-ink focus:border-brand'
                      }`}
                    >
                      <option value="featured">Relevância</option>
                      <option value="price_asc">Menor preço</option>
                      <option value="price_desc">Maior preço</option>
                      <option value="name_asc">Ordem A–Z</option>
                    </select>
                  </div>
                </div>
              </div>

              {loadingProducts ? (
                <div className="py-16 text-center text-muted flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-brand" size={26} />
                  <p className="text-xs font-semibold">
                    Atualizando catálogo...
                  </p>
                </div>
              ) : products.length === 0 ? (
                <div
                  className={`border rounded-2xl p-10 text-center space-y-2.5 ${
                    isDark
                      ? 'bg-ink border-muted/40 text-on-brand'
                      : 'bg-surface border-line text-ink'
                  }`}
                >
                  <Package size={28} className="mx-auto text-muted" />
                  <p className="font-bold text-sm">
                    Nenhuma peça encontrada com os filtros selecionados
                  </p>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Experimente limpar os filtros de tamanho, cor ou termo de
                    busca para visualizar todo o catálogo.
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
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-on-brand text-xs font-bold cursor-pointer"
                    >
                      Ver catálogo completo
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  {products.map((prod: any) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      isDark={isDark}
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
          if (!pickupEnabled && !deliveryEnabled) {
            return null;
          }
          return (
            <section
              key={section.id}
              className="max-w-6xl mx-auto w-full px-4 py-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {pickupEnabled && (
                  <div
                    className={`border rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 ${
                      isDark
                        ? 'bg-ink border-muted/40 text-on-brand'
                        : 'bg-surface border-line text-ink'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-support text-brand shrink-0">
                      <Store size={18} />
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
                    className={`border rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 ${
                      isDark
                        ? 'bg-ink border-muted/40 text-on-brand'
                        : 'bg-surface border-line text-ink'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-support text-brand shrink-0">
                      <Truck size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-xs sm:text-sm">
                          Entrega a Combinar
                        </h4>
                        {deliveryFeeNote && (
                          <span className="px-2 py-0.5 rounded-md bg-support text-brand text-[10px] font-bold">
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
              className={`border-t mt-auto py-6 px-4 text-xs ${
                isDark
                  ? 'border-muted/40 text-line bg-ink'
                  : 'border-line text-muted bg-surface'
              }`}
            >
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
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
                <div className="flex items-center gap-2 opacity-80">
                  <ShieldCheck size={14} className="text-brand shrink-0" />
                  <span>Estoque sincronizado em tempo real • PDV Lojista</span>
                </div>
              </div>
            </footer>
          );
        }

        return null;
      })}

      {/* Barra flutuante mobile da sacola */}
      {!isPreview && cartCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 sm:hidden">
          {onOpenCart ? (
            <button
              type="button"
              onClick={onOpenCart}
              style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
              className="w-full py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-between font-bold text-xs cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag size={16} />
                Ver sacola ({cartCount} {cartCount === 1 ? 'item' : 'itens'})
              </span>
              <span className="font-mono text-sm">
                {formatBrl(cartTotal)} →
              </span>
            </button>
          ) : (
            <Link
              to={`/loja/${storeData.slug}/carrinho`}
              style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
              className="w-full py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-between font-bold text-xs"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag size={16} />
                Ver sacola ({cartCount} {cartCount === 1 ? 'item' : 'itens'})
              </span>
              <span className="font-mono text-sm">
                {formatBrl(cartTotal)} →
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  isDark = false,
  onSelect,
  onQuickAdd,
}: {
  product: any;
  isDark?: boolean;
  onSelect: () => void;
  onQuickAdd?: (product: any, variant: any) => void;
}) {
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
  const singleVariant =
    Array.isArray(product.variants) && product.variants.length === 1
      ? product.variants[0]
      : null;

  return (
    <div
      className={`group rounded-2xl border overflow-hidden flex flex-col transition duration-200 ${
        isDark
          ? 'bg-ink border-muted/40 text-on-brand hover:border-brand'
          : 'bg-surface border-line text-ink hover:border-brand shadow-2xs'
      }`}
    >
      <div
        onClick={onSelect}
        className="relative aspect-[4/5] bg-page cursor-pointer overflow-hidden flex items-center justify-center"
      >
        {product.imageUrl ? (
          <img
            src={getFullUrl(product.imageUrl)}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
          />
        ) : (
          <div className="text-muted flex flex-col items-center gap-1.5 p-4 text-center">
            <Package size={26} />
            <span className="text-[11px] font-medium">Sem imagem</span>
          </div>
        )}

        {product.badgeLabel && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-brand text-on-brand shadow-2xs">
            {product.badgeLabel}
          </span>
        )}

        {!inStock && (
          <span className="absolute inset-x-2.5 bottom-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-surface/95 text-muted border border-line text-center">
            Esgotado
          </span>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
        <div onClick={onSelect} className="cursor-pointer space-y-1">
          {categoryLabel && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">
              {categoryLabel}
            </p>
          )}
          <h4 className="font-bold text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-brand transition-colors">
            {product.title}
          </h4>

          {product.sizes?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {product.sizes.slice(0, 5).map((sz: string) => (
                <span
                  key={sz}
                  className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${
                    isDark
                      ? 'bg-ink border-muted/50 text-line'
                      : 'bg-page border-line text-muted'
                  }`}
                >
                  {sz}
                </span>
              ))}
              {product.sizes.length > 5 && (
                <span className="text-[10px] px-1 py-0.5 text-muted font-semibold">
                  +{product.sizes.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        <div
          className={`pt-2.5 border-t flex items-center justify-between gap-2 ${
            isDark ? 'border-muted/30' : 'border-line'
          }`}
        >
          <div>
            <p className="text-sm sm:text-base font-extrabold text-brand">
              {formatBrl(unitPrice)}
            </p>
            <p className="text-[10px] text-muted font-medium">
              {!inStock
                ? 'Indisponível'
                : totalAvailable <= 3
                  ? `Últimas ${totalAvailable} un.`
                  : 'Pronta entrega'}
            </p>
          </div>

          {inStock && singleVariant && onQuickAdd ? (
            <button
              type="button"
              onClick={() => onQuickAdd(product, singleVariant)}
              className="px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold transition cursor-pointer shrink-0"
            >
              + Sacola
            </button>
          ) : (
            <button
              type="button"
              onClick={onSelect}
              className="px-3 py-1.5 rounded-xl bg-support text-brand hover:bg-brand hover:text-on-brand text-xs font-bold transition cursor-pointer shrink-0"
            >
              {inStock ? 'Opções' : 'Ver'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicStorefrontApp() {
  const { slug = '', produtoSlug, referencia } = useParams<{
    slug: string;
    produtoSlug?: string;
    referencia?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [storeData, setStoreData] = useState<any>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  // Catálogo / filtros
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Detalhe de produto
  const [productDetail, setProductDetail] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);
  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const [chosenColor, setChosenColor] = useState<string | null>(null);
  const [chosenQuantity, setChosenQuantity] = useState(1);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Carrinho isolado por storePublicId + Gaveta Lateral (Drawer)
  const [cartItems, setCartItems] = useState<StorefrontCartItem[]>([]);
  const [cartValidation, setCartValidation] = useState<any>(null);
  const [validatingCart, setValidatingCart] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [recentOrders, setRecentOrders] = useState<RecentStorefrontOrder[]>([]);

  // Checkout
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
  const [addressRef, setAddressRef] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [priceDivergenceAlert, setPriceDivergenceAlert] = useState<any[] | null>(
    null,
  );

  // Consulta de pedido
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const isCartPage = location.pathname.endsWith('/carrinho');
  const isCheckoutPage = location.pathname.endsWith('/finalizar');
  const isProductPage = Boolean(produtoSlug);
  const isOrderPage = Boolean(referencia);

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

  // Carregar loja publicada e perfil salvo do consumidor
  const fetchStoreHome = useCallback(async () => {
    if (!slug) return;
    setLoadingStore(true);
    setStoreError(null);
    try {
      const { data } = await storefrontApi.get(`/storefront/public/${slug}`);
      setStoreData(data);

      // Carregar perfil salvo do consumidor para preencher checkout
      const savedProfile = loadStorefrontCustomerProfile(data.publicId);
      if (savedProfile) {
        if (savedProfile.customerName) setCustomerName(savedProfile.customerName);
        if (savedProfile.customerPhone) setCustomerPhone(savedProfile.customerPhone);
        if (savedProfile.customerDocument) setCustomerCpf(savedProfile.customerDocument);
        if (savedProfile.addressLine) setStreet(savedProfile.addressLine);
        if (savedProfile.addressNumber) setNumber(savedProfile.addressNumber);
        if (savedProfile.addressComplement) setComplement(savedProfile.addressComplement);
        if (savedProfile.neighborhood) setNeighborhood(savedProfile.neighborhood);
        if (savedProfile.city) setCity(savedProfile.city);
        if (savedProfile.zipCode) setZipCode(savedProfile.zipCode);
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

  // Carregar produtos filtrados
  const fetchCatalogProducts = useCallback(async () => {
    if (!slug || !storeData) return;
    setLoadingProducts(true);
    try {
      const { data } = await storefrontApi.get(
        `/storefront/public/${slug}/products`,
        {
          params: {
            search: search || undefined,
            categoryId: selectedCategoryId || undefined,
            size: selectedSize || undefined,
            color: selectedColor || undefined,
            sort: sortBy || 'featured',
            inStockOnly: inStockOnly ? 'true' : undefined,
            limit: 48,
          },
        },
      );
      setProducts(data?.data || []);
    } catch {
      // Mantém lista atual em caso de falha transitória
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
    if (!isProductPage && !isCartPage && !isCheckoutPage && !isOrderPage) {
      void fetchCatalogProducts();
    }
  }, [
    fetchCatalogProducts,
    isProductPage,
    isCartPage,
    isCheckoutPage,
    isOrderPage,
  ]);

  // Carregar detalhe de produto
  useEffect(() => {
    if (!slug || !produtoSlug) return;
    let active = true;
    setLoadingProductDetail(true);
    storefrontApi
      .get(`/storefront/public/${slug}/products/${produtoSlug}`)
      .then(({ data }) => {
        if (!active) return;
        const prod = data.product;
        setProductDetail(prod);
        setRelatedProducts(data.relatedProducts || []);
        setActivePhotoUrl(prod?.imageUrl || null);
        const firstAvailable =
          (prod?.variants || []).find((v: any) => v.inStock) ||
          prod?.variants?.[0];
        setChosenSize(firstAvailable?.size || null);
        setChosenColor(firstAvailable?.color || null);
        setChosenQuantity(1);
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
  }, [slug, produtoSlug, navigate]);

  // Revalidar carrinho no servidor (ao abrir carrinho/gaveta/checkout ou ao reconectar)
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

        // Atualizar preços e limites de estoque local com a verdade do servidor
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

  const handleAddVariantToCart = (
    product: any,
    variant: any,
    qty = 1,
    openDrawer = true,
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
    toast.success(`"${product.title}" adicionado à sacola!`);
    if (openDrawer) {
      setCartDrawerOpen(true);
    }
  };

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

      // Salvar dados do consumidor no dispositivo para próximas compras
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

  // Gaveta Lateral da Sacola (Slide-over Drawer)
  const renderCartDrawer = () => {
    if (!cartDrawerOpen) return null;
    return (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="fixed inset-0"
          onClick={() => setCartDrawerOpen(false)}
        />
        <div className="relative z-10 w-full max-w-md bg-surface text-ink h-full flex flex-col shadow-2xl border-l border-line">
          <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-support text-brand">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="font-extrabold text-sm sm:text-base text-ink">
                  Sua Sacola
                </h2>
                <p className="text-[11px] text-muted">
                  {cartCount} {cartCount === 1 ? 'item selecionado' : 'itens selecionados'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCartDrawerOpen(false)}
              className="p-2 rounded-xl text-muted hover:text-ink hover:bg-page transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {cartItems.length === 0 ? (
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-page border border-line flex items-center justify-center text-muted">
                <ShoppingBag size={24} />
              </div>
              <p className="font-bold text-sm text-ink">
                Sua sacola ainda está vazia
              </p>
              <p className="text-xs text-muted max-w-xs">
                Escolha tamanho e cor das suas peças favoritas no catálogo para
                adicioná-las aqui.
              </p>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="mt-2 px-5 py-2.5 rounded-xl bg-brand text-on-brand font-bold text-xs cursor-pointer"
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-line">
                {cartItems.map((item) => {
                  const valItem = cartValidation?.items?.find(
                    (vi: any) => vi.productId === item.productId,
                  );
                  const outOfStock = valItem && !valItem.available;

                  return (
                    <div
                      key={item.productId}
                      className={`pt-3 first:pt-0 flex items-start justify-between gap-3 ${
                        outOfStock ? 'bg-support/40 p-2.5 rounded-xl' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={getFullUrl(item.imageUrl)}
                            alt={item.productName}
                            className="w-14 h-16 rounded-xl object-cover border border-line shrink-0 bg-page"
                          />
                        ) : (
                          <div className="w-14 h-16 rounded-xl bg-page border border-line flex items-center justify-center text-muted shrink-0">
                            <Package size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setCartDrawerOpen(false);
                              navigate(`/loja/${slug}/produto/${item.productSlug}`);
                            }}
                            className="font-bold text-xs sm:text-sm text-ink hover:text-brand truncate block text-left cursor-pointer"
                          >
                            {item.productName}
                          </button>
                          {(item.size || item.color) && (
                            <p className="text-[11px] text-muted mt-0.5">
                              {[
                                item.size && `Tam: ${item.size}`,
                                item.color && `Cor: ${item.color}`,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          )}
                          <p className="text-xs font-extrabold text-brand mt-1">
                            {formatBrl(item.priceUnit)}
                          </p>
                          {outOfStock && (
                            <p className="text-[11px] font-bold text-brand mt-1">
                              Disponível: {valItem.availableStock} un.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCartItemQuantity(
                                storeData.publicId,
                                storeData.slug,
                                item.productId,
                                item.quantity - 1,
                              )
                            }
                            className="w-7 h-7 rounded-lg bg-page border border-line flex items-center justify-center text-ink hover:border-brand cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center font-bold text-xs">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCartItemQuantity(
                                storeData.publicId,
                                storeData.slug,
                                item.productId,
                                item.quantity + 1,
                              )
                            }
                            className="w-7 h-7 rounded-lg bg-page border border-line flex items-center justify-center text-ink hover:border-brand cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
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
                          className="text-[11px] text-muted hover:text-brand inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={11} /> Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 sm:p-5 border-t border-line bg-page/60 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-muted uppercase">
                    Subtotal ({cartCount} {cartCount === 1 ? 'peça' : 'peças'})
                  </span>
                  <span className="text-lg font-extrabold text-brand">
                    {formatBrl(cartTotal)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled={validatingCart || isOffline}
                    onClick={async () => {
                      const val = await revalidateCartOnServer(false);
                      if (val?.hasStockShortage) {
                        toast.error(
                          'Ajuste as quantidades dos itens com estoque insuficiente antes de avançar.',
                        );
                        return;
                      }
                      setCartDrawerOpen(false);
                      navigate(`/loja/${slug}/finalizar`);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-brand font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    {validatingCart ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Conferindo disponibilidade...
                      </>
                    ) : (
                      <>
                        <span>Finalizar Pedido</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      navigate(`/loja/${slug}/carrinho`);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-surface border border-line text-ink hover:border-brand font-bold text-xs transition cursor-pointer"
                  >
                    Ver sacola detalhada
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loadingStore && !isOrderPage) {
    return (
      <div className="min-h-screen bg-page text-ink flex flex-col items-center justify-center p-6 gap-3">
        <Loader2 className="animate-spin text-brand" size={30} />
        <p className="text-xs font-semibold text-muted">
          Carregando loja virtual...
        </p>
      </div>
    );
  }

  if (storeError && !isOrderPage) {
    return (
      <div className="min-h-screen bg-page text-ink flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-line rounded-2xl p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-support text-brand flex items-center justify-center mx-auto">
            <Store size={24} />
          </div>
          <h1 className="text-lg font-extrabold text-ink">
            Loja Indisponível
          </h1>
          <p className="text-xs text-muted leading-relaxed">{storeError}</p>
          <button
            type="button"
            onClick={() => void fetchStoreHome()}
            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ── ROTA: /loja/:slug/pedido/:referencia ────────────────────────────────────
  if (isOrderPage) {
    const commInfo =
      COMMERCIAL_STATUS_LABELS[orderDetail?.commercialStatus] ||
      COMMERCIAL_STATUS_LABELS.AWAITING_CONFIRMATION;

    return (
      <div
        style={getStoreThemeStyles(storeData?.theme)}
        className="min-h-screen bg-page text-ink py-6 sm:py-8 px-4"
      >
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <Link
              to={`/loja/${slug}`}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-brand hover:underline"
            >
              <ArrowLeft size={16} /> Voltar ao catálogo
            </Link>
            {orderDetail && (
              <button
                type="button"
                onClick={() => void fetchOrderStatus()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-brand px-3 py-1.5 rounded-xl bg-surface border border-line cursor-pointer"
              >
                <RefreshCw size={13} /> Atualizar status
              </button>
            )}
          </div>

          {loadingOrder ? (
            <div className="bg-surface border border-line rounded-2xl p-12 text-center space-y-2">
              <Loader2 className="animate-spin text-brand mx-auto" size={26} />
              <p className="text-xs text-muted">Consultando pedido...</p>
            </div>
          ) : orderError ? (
            <div className="bg-surface border border-line rounded-2xl p-8 text-center space-y-3">
              <AlertCircle size={28} className="text-brand mx-auto" />
              <h2 className="text-base font-extrabold">Acesso ao Pedido</h2>
              <p className="text-xs text-muted max-w-md mx-auto">
                {orderError}
              </p>
            </div>
          ) : orderDetail ? (
            <div className="bg-surface border border-line rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-support text-brand">
                    <CheckCircle2 size={13} /> Pedido Registrado
                  </span>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-ink mt-1.5 font-mono">
                    {orderDetail.reference}
                  </h1>
                  <p className="text-xs text-muted mt-0.5">
                    Registrado em{' '}
                    {new Date(orderDetail.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] text-muted uppercase font-bold">
                    Total dos Produtos
                  </p>
                  <p className="text-xl sm:text-2xl font-extrabold text-brand">
                    {formatBrl(orderDetail.total)}
                  </p>
                </div>
              </div>

              {/* Ação Principal: Abrir WhatsApp com a mensagem pronta */}
              <div className="bg-support border border-brand rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <MessageCircle
                    size={20}
                    className="text-brand shrink-0 mt-0.5"
                  />
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs sm:text-sm text-ink">
                      Envie a confirmação pelo WhatsApp para combinar o
                      atendimento
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Seu pedido já foi registrado e o estoque está reservado
                      até{' '}
                      <strong>
                        {new Date(
                          orderDetail.reservationExpiresAt,
                        ).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                      . Clique no botão abaixo para enviar o resumo à loja.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  {orderDetail.whatsappUrl && (
                    <a
                      href={orderDetail.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs"
                    >
                      <MessageCircle size={16} />
                      Abrir WhatsApp da Loja
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        orderDetail.whatsappMessage || '',
                      );
                      toast.success('Resumo do pedido copiado!');
                    }}
                    className="py-3 px-4 rounded-xl bg-surface hover:bg-page text-ink border border-line font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy size={14} /> Copiar Resumo
                  </button>
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

              {/* Quatro dimensões de status claras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-page border border-line">
                  <p className="text-[10px] font-bold uppercase text-muted">
                    Situação do Pedido
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-ink mt-0.5">
                    {commInfo.label}
                  </p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    {commInfo.desc}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-page border border-line space-y-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted">
                      Andamento / Separação
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-brand">
                      {FULFILLMENT_STATUS_LABELS[
                        orderDetail.fulfillmentStatus
                      ] || orderDetail.fulfillmentStatus}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-line">
                    <span className="text-muted">Reserva:</span>
                    <span className="font-semibold text-ink">
                      {RESERVATION_STATUS_LABELS[
                        orderDetail.reservationStatus
                      ] || orderDetail.reservationStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Pagamento:</span>
                    <span className="font-semibold text-ink">
                      {PAYMENT_STATUS_LABELS[orderDetail.paymentStatus] ||
                        orderDetail.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de itens do pedido */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Itens do Pedido ({orderDetail.items?.length || 0})
                </h3>
                <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">
                  {(orderDetail.items || []).map((item: any) => (
                    <div
                      key={item.id}
                      className="p-3 bg-surface flex items-center justify-between gap-3"
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
                      <span className="font-bold text-xs sm:text-sm text-ink shrink-0">
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
    );
  }

  // ── ROTA: /loja/:slug/produto/:produtoSlug ─────────────────────────────────
  if (isProductPage) {
    const variants: any[] = productDetail?.variants || [];
    const sizes: string[] = productDetail?.sizes || [];
    const colors: string[] = productDetail?.colors || [];

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

    return (
      <div
        style={getStoreThemeStyles(storeData?.theme)}
        className="min-h-screen bg-page text-ink pb-16"
      >
        <header className="bg-surface border-b border-line sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              to={`/loja/${slug}`}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-ink hover:text-brand"
            >
              <ArrowLeft size={16} /> {storeData?.storeName || 'Voltar'}
            </Link>
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand text-on-brand text-xs font-bold cursor-pointer"
            >
              <ShoppingBag size={15} /> Sacola ({cartCount})
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 pt-6">
          {loadingProductDetail || !productDetail ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-brand mx-auto" size={26} />
            </div>
          ) : (
            <>
              <div className="bg-surface border border-line rounded-2xl p-5 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 shadow-xs">
                {/* Galeria de fotos */}
                <div className="md:col-span-6 space-y-3">
                  <div className="aspect-[4/5] rounded-2xl bg-page border border-line overflow-hidden flex items-center justify-center">
                    {activePhotoUrl || productDetail.imageUrl ? (
                      <img
                        src={getFullUrl(
                          activePhotoUrl || productDetail.imageUrl,
                        )}
                        alt={productDetail.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-muted flex flex-col items-center gap-2">
                        <Package size={36} />
                        <span className="text-xs">Sem imagem cadastrada</span>
                      </div>
                    )}
                  </div>
                  {productDetail.galleryUrls?.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {productDetail.galleryUrls.map((url: string) => (
                        <button
                          type="button"
                          key={url}
                          onClick={() => setActivePhotoUrl(url)}
                          className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                            activePhotoUrl === url
                              ? 'border-brand'
                              : 'border-line'
                          }`}
                        >
                          <img
                            src={getFullUrl(url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Informações e seletor de tamanho/cor */}
                <div className="md:col-span-6 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {productDetail.categoryName && (
                          <span className="text-xs font-bold uppercase tracking-wider text-brand">
                            {productDetail.categoryName}
                          </span>
                        )}
                        {productDetail.badgeLabel && (
                          <span className="px-2 py-0.5 rounded-md bg-support text-brand text-[10px] font-bold">
                            {productDetail.badgeLabel}
                          </span>
                        )}
                      </div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-ink mt-1">
                        {productDetail.title}
                      </h1>
                      <p className="text-2xl font-extrabold text-brand mt-2">
                        {formatBrl(
                          selectedVariant?.priceSell ?? productDetail.priceSell,
                        )}
                      </p>
                    </div>

                    {productDetail.description && (
                      <p className="text-xs sm:text-sm text-muted leading-relaxed whitespace-pre-line">
                        {productDetail.description}
                      </p>
                    )}

                    {/* Seleção de Tamanho */}
                    {sizes.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                          Tamanho:{' '}
                          <strong className="text-ink">{chosenSize}</strong>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {sizes.map((sz) => {
                            const hasStockForSize = variants.some(
                              (v) => v.size === sz && v.inStock,
                            );
                            const isSelected = chosenSize === sz;
                            return (
                              <button
                                key={sz}
                                type="button"
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
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-brand text-on-brand border-brand'
                                    : hasStockForSize
                                      ? 'bg-page text-ink border-line hover:border-brand'
                                      : 'bg-page text-muted border-line opacity-50 line-through'
                                }`}
                              >
                                {sz} {!hasStockForSize && '(Esgotado)'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Seleção de Cor */}
                    {colors.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                          Cor:{' '}
                          <strong className="text-ink">{chosenColor}</strong>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {colors.map((cl) => {
                            const matchingVariant = variants.find(
                              (v) =>
                                (sizes.length === 0 || v.size === chosenSize) &&
                                v.color === cl,
                            );
                            const available = Boolean(matchingVariant?.inStock);
                            const isSelected = chosenColor === cl;
                            return (
                              <button
                                key={cl}
                                type="button"
                                onClick={() => setChosenColor(cl)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-brand text-on-brand border-brand'
                                    : available
                                      ? 'bg-page text-ink border-line hover:border-brand'
                                      : 'bg-page text-muted border-line opacity-50 line-through'
                                }`}
                              >
                                {cl} {!available && '(Indisponível)'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quantidade e disponibilidade da variação */}
                    <div className="p-3.5 rounded-xl bg-page border border-line flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-ink">
                          Disponibilidade imediata
                        </p>
                        <p className="text-xs text-muted">
                          {variantInStock
                            ? variantAvailableStock <= 5
                              ? `Últimas ${variantAvailableStock} unidade(s) disponíveis`
                              : 'Em estoque para reserva imediata'
                            : 'Esta combinação está sem estoque no momento'}
                        </p>
                      </div>
                      {variantInStock && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setChosenQuantity((q) => Math.max(1, q - 1))
                            }
                            className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-ink cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">
                            {chosenQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setChosenQuantity((q) =>
                                Math.min(variantAvailableStock, q + 1),
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-ink cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <button
                      type="button"
                      disabled={!variantInStock}
                      onClick={() => {
                        handleAddVariantToCart(
                          productDetail,
                          selectedVariant,
                          chosenQuantity,
                          true,
                        );
                      }}
                      className="w-full py-3.5 px-6 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-on-brand font-bold text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                    >
                      <ShoppingBag size={17} />
                      {variantInStock
                        ? 'Adicionar à Sacola'
                        : 'Variação Indisponível'}
                    </button>
                    {cartCount > 0 && (
                      <Link
                        to={`/loja/${slug}/finalizar`}
                        className="w-full py-2.5 px-6 rounded-xl bg-support text-brand font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition"
                      >
                        Finalizar pedido agora ({cartCount}{' '}
                        {cartCount === 1 ? 'item' : 'itens'}) →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Produtos relacionados */}
              {relatedProducts.length > 0 && (
                <div className="mt-8 space-y-3.5">
                  <h3 className="text-base font-extrabold text-ink">
                    Veja também nesta categoria
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    {relatedProducts.map((rel: any) => (
                      <ProductCard
                        key={rel.id}
                        product={rel}
                        onSelect={() =>
                          navigate(`/loja/${slug}/produto/${rel.slug}`)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {renderCartDrawer()}
      </div>
    );
  }

  // ── ROTA: /loja/:slug/carrinho e /loja/:slug/finalizar ────────────────────
  if (isCartPage || isCheckoutPage) {
    return (
      <div
        style={getStoreThemeStyles(storeData?.theme)}
        className="min-h-screen bg-page text-ink pb-16"
      >
        <header className="bg-surface border-b border-line sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              to={isCheckoutPage ? `/loja/${slug}/carrinho` : `/loja/${slug}`}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-ink hover:text-brand"
            >
              <ArrowLeft size={16} />
              {isCheckoutPage ? 'Voltar à sacola' : 'Continuar comprando'}
            </Link>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {isCheckoutPage ? 'Finalizar Pedido' : 'Sua Sacola'}
            </span>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-5">
          {isOffline && (
            <div className="bg-support border border-brand rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm text-ink">
              <WifiOff size={18} className="text-brand shrink-0" />
              <span>
                Você está offline. Não é possível confirmar pedidos sem conexão;
                assim que reconectar, os preços e o estoque serão revalidados.
              </span>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="bg-surface border border-line rounded-2xl p-10 text-center space-y-3">
              <ShoppingBag size={32} className="mx-auto text-muted" />
              <h2 className="text-base font-extrabold text-ink">
                Sua sacola está vazia
              </h2>
              <p className="text-xs text-muted">
                Explore o catálogo da loja e escolha suas mercadorias.
              </p>
              <Link
                to={`/loja/${slug}`}
                className="inline-block px-5 py-2.5 rounded-xl bg-brand text-on-brand font-bold text-xs mt-2"
              >
                Ver Catálogo
              </Link>
            </div>
          ) : isCartPage ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-3">
                {cartItems.map((item) => {
                  const valItem = cartValidation?.items?.find(
                    (vi: any) => vi.productId === item.productId,
                  );
                  const outOfStock = valItem && !valItem.available;

                  return (
                    <div
                      key={item.productId}
                      className={`bg-surface border rounded-2xl p-4 flex items-center justify-between gap-4 ${
                        outOfStock
                          ? 'border-brand bg-support/40'
                          : 'border-line'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={getFullUrl(item.imageUrl)}
                            alt={item.productName}
                            className="w-16 h-16 rounded-xl object-cover border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-page border border-line flex items-center justify-center text-muted shrink-0">
                            <Package size={20} />
                          </div>
                        )}
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
                          <p className="text-sm font-extrabold text-brand mt-1">
                            {formatBrl(item.priceUnit)}
                          </p>
                          {outOfStock && (
                            <p className="text-xs font-bold text-brand mt-1">
                              Disponível no momento: {valItem.availableStock}{' '}
                              un.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setCartItemQuantity(
                              storeData.publicId,
                              storeData.slug,
                              item.productId,
                              item.quantity - 1,
                            )
                          }
                          className="w-8 h-8 rounded-lg bg-page border border-line flex items-center justify-center text-ink cursor-pointer"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center font-bold text-sm">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCartItemQuantity(
                              storeData.publicId,
                              storeData.slug,
                              item.productId,
                              item.quantity + 1,
                            )
                          }
                          className="w-8 h-8 rounded-lg bg-page border border-line flex items-center justify-center text-ink cursor-pointer"
                        >
                          <Plus size={13} />
                        </button>
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
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-4">
                <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 sticky top-20">
                  <h3 className="font-extrabold text-base text-ink">
                    Resumo do Pedido
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm border-b border-line pb-3">
                    <div className="flex justify-between text-muted">
                      <span>Itens ({cartCount})</span>
                      <span>{formatBrl(cartTotal)}</span>
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
                    <span className="text-xl font-extrabold text-brand">
                      {formatBrl(cartTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
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
                    className="w-full py-3.5 px-5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-brand font-bold text-xs sm:text-sm transition cursor-pointer"
                  >
                    {validatingCart
                      ? 'Conferindo estoque...'
                      : 'Continuar para Identificação →'}
                  </button>
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
                  <div className="bg-support border border-brand rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-bold text-brand flex items-center gap-1.5">
                      <AlertCircle size={15} /> Preços atualizados no servidor
                    </p>
                    <p className="text-xs text-ink">
                      Os valores abaixo foram atualizados na sua sacola. Confira
                      e clique em <strong>Registrar Pedido</strong> novamente
                      para confirmar:
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

                <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
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
                        className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
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
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-ink block mb-1">
                        CPF (Opcional)
                      </label>
                      <input
                        type="text"
                        value={customerCpf}
                        onChange={(e) => setCustomerCpf(e.target.value)}
                        placeholder="Opcional para nota fiscal"
                        className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-brand" />
                    <h3 className="font-extrabold text-sm sm:text-base text-ink">
                      2. Modalidade de Recebimento
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {storeData?.pickupEnabled && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentMode('PICKUP')}
                        className={`p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                          fulfillmentMode === 'PICKUP'
                            ? 'border-brand bg-support'
                            : 'border-line bg-page'
                        }`}
                      >
                        <Store
                          size={18}
                          className="text-brand shrink-0 mt-0.5"
                        />
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-ink">
                            Retirar na Loja
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            Sem taxa de entrega. Combine a retirada pelo
                            WhatsApp.
                          </p>
                        </div>
                      </button>
                    )}
                    {storeData?.deliveryEnabled && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentMode('DELIVERY')}
                        className={`p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                          fulfillmentMode === 'DELIVERY'
                            ? 'border-brand bg-support'
                            : 'border-line bg-page'
                        }`}
                      >
                        <Truck
                          size={18}
                          className="text-brand shrink-0 mt-0.5"
                        />
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-ink">
                            Entrega a Combinar
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {storeData?.deliveryFeeNote ||
                              'Taxa e prazo combinados pelo WhatsApp.'}
                          </p>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Solicita endereço SOMENTE quando Entrega é escolhida */}
                  {fulfillmentMode === 'DELIVERY' && (
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 pt-2 border-t border-line">
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
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
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
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-ink block mb-1">
                          Bairro *
                        </label>
                        <input
                          type="text"
                          required
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          placeholder="Bairro"
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-ink block mb-1">
                          Complemento / Apto
                        </label>
                        <input
                          type="text"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          placeholder="Bloco, apto, casa..."
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-ink block mb-1">
                          Cidade
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Cidade"
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
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
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">
                      Observações do Pedido (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ex.: preferência de horário, embalagem para presente, forma de pagamento preferida..."
                      className="w-full p-2.5 bg-page border border-line rounded-xl text-xs sm:text-sm text-ink focus:border-brand outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 sticky top-20">
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
                        <span className="font-bold text-ink shrink-0">
                          {formatBrl(item.priceUnit * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-line pt-3 flex items-baseline justify-between">
                    <span className="font-bold text-sm">
                      Total dos produtos
                    </span>
                    <span className="text-2xl font-extrabold text-brand">
                      {formatBrl(cartTotal)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-page border border-line text-xs text-muted space-y-1">
                    <p className="font-bold text-ink flex items-center gap-1.5">
                      <Clock size={13} className="text-brand" /> Reserva
                      imediata por {storeData?.confirmReservationMinutes || 30}{' '}
                      minutos
                    </p>
                    <p>
                      Ao clicar abaixo, seu pedido será salvo com código único e
                      você abrirá o WhatsApp da loja com o resumo pronto.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingOrder || isOffline}
                    className="w-full py-3.5 px-5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-brand font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                  >
                    {submittingOrder ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Registrando pedido...
                      </>
                    ) : (
                      <>
                        <MessageCircle size={16} />
                        Registrar Pedido e Continuar no WhatsApp
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── ROTA PADRÃO: /loja/:slug (Vitrine Principal) ──────────────────────────
  return (
    <>
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
        cartTotal={cartTotal}
        onSelectProduct={(prodSlug) =>
          navigate(`/loja/${slug}/produto/${prodSlug}`)
        }
        onQuickAdd={(prod, variant) =>
          handleAddVariantToCart(prod, variant, 1, true)
        }
        onOpenCart={() => setCartDrawerOpen(true)}
        recentOrders={recentOrders}
        onSelectOrder={(ref, token) =>
          navigate(
            `/loja/${slug}/pedido/${ref}${
              token ? `?token=${encodeURIComponent(token)}` : ''
            }`,
          )
        }
      />
      {renderCartDrawer()}
    </>
  );
}

export default PublicStorefrontApp;
