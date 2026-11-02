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
  Check,
  CheckCircle2,
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
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Truck,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { storefrontApi } from '@/lib/storefront-api';
import { getFullUrl } from '@/lib/getFullUrl';
import {
  addOrUpdateCartItem,
  clearStoreCart,
  getOrCreateOrderAttemptKey,
  getSavedOrderAccessToken,
  loadStoreCart,
  saveOrderAccessToken,
  setCartItemQuantity,
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
    desc: 'Seu pedido foi registrado e os itens estão reservados temporariamente. Envie a mensagem no WhatsApp para confirmar com o lojista.',
  },
  CONFIRMED: {
    label: 'Pedido confirmado pela loja',
    desc: 'O lojista confirmou seu pedido e garantiu a reserva das peças para separação.',
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
  UNREGISTERED: 'A combinar / Pagar no atendimento',
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
  const theme = storeData?.theme || {};
  const template = theme.template || 'editorial_roxo';
  const isDark = template === 'vitrine_escura';
  const isMinimal = template === 'minimal_branco';
  const sections: any[] = Array.isArray(theme.sections)
    ? theme.sections.filter((s: any) => s.enabled !== false)
    : [
        { id: 'sec-header', type: 'header', enabled: true },
        { id: 'sec-hero', type: 'hero', enabled: true },
        { id: 'sec-categories', type: 'categories', enabled: true },
        { id: 'sec-featured', type: 'featured', enabled: true },
        { id: 'sec-collection', type: 'collection', enabled: true },
        { id: 'sec-fulfillment', type: 'fulfillment_info', enabled: true },
        { id: 'sec-footer', type: 'footer', enabled: true },
      ];

  const categories = storeData?.categories || [];
  const featuredProducts = storeData?.featuredProducts || [];
  const facets = storeData?.facets || { sizes: [], colors: [] };

  return (
    <div
      style={getStoreThemeStyles(theme)}
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-ink text-on-brand' : isMinimal ? 'bg-surface text-ink' : 'bg-page text-ink'
      }`}
    >
      {/* Faixa superior de aviso */}
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
              className={`sticky top-0 z-30 border-b backdrop-blur-md ${
                isDark
                  ? 'bg-ink/95 border-muted'
                  : 'bg-surface/95 border-line'
              }`}
            >
              <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {storeData.logoUrl ? (
                    <img
                      src={getFullUrl(storeData.logoUrl)}
                      alt={storeData.storeName}
                      className="w-11 h-11 rounded-xl object-cover border border-line shrink-0 bg-surface"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
                    >
                      {String(storeData.storeName || 'L')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="font-black text-base sm:text-lg truncate">
                      {storeData.storeName || 'Loja Virtual'}
                    </h1>
                    {storeData.tagline && (
                      <p
                        className={`text-xs truncate ${
                          isDark ? 'text-line' : 'text-muted'
                        }`}
                      >
                        {storeData.tagline}
                      </p>
                    )}
                  </div>
                </div>

                {!isPreview && (
                  <Link
                    to={`/loja/${storeData.slug}/carrinho`}
                    style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:opacity-95 transition shrink-0"
                  >
                    <ShoppingBag size={16} />
                    <span>Sacola ({cartCount})</span>
                    {cartCount > 0 && (
                      <span className="hidden sm:inline font-mono">
                        • {formatBrl(cartTotal)}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            </header>
          );
        }

        if (section.type === 'hero') {
          const banners = Array.isArray(theme.banners)
            ? theme.banners.filter((b: any) => b.enabled !== false)
            : [];
          return (
            <section key={section.id} className="max-w-6xl mx-auto w-full px-4 pt-5 pb-2">
              <div
                style={{
                  background: isMinimal
                    ? '#F3E8FF'
                    : 'linear-gradient(135deg, var(--sf-primary), var(--sf-accent))',
                  color: isMinimal ? '#272321' : '#FFFFFF',
                }}
                className="rounded-3xl p-6 sm:p-10 relative overflow-hidden border border-line shadow-sm"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-7 space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface/20 border border-line/30">
                      <Sparkles size={13} />
                      <span>Catálogo Oficial • Pedido via WhatsApp</span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black leading-tight">
                      {theme.heroTitle || `Bem-vindo à ${storeData.storeName}`}
                    </h2>
                    <p className="text-sm sm:text-base opacity-90 max-w-xl leading-relaxed">
                      {theme.heroSubtitle ||
                        storeData.description ||
                        'Escolha tamanho e cor em tempo real e feche seu pedido diretamente pelo WhatsApp.'}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <a
                        href="#catalogo-loja"
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${
                          isMinimal
                            ? 'bg-brand text-on-brand'
                            : 'bg-surface text-ink hover:bg-support'
                        }`}
                      >
                        {theme.heroCtaLabel || 'Ver produtos'}
                      </a>
                      {storeData.pickupEnabled && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-90">
                          <Store size={14} /> Retirada na loja
                        </span>
                      )}
                      {storeData.deliveryEnabled && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-90">
                          <Truck size={14} /> Entrega a combinar
                        </span>
                      )}
                    </div>
                  </div>
                  {storeData.coverUrl && (
                    <div className="md:col-span-5">
                      <img
                        src={getFullUrl(storeData.coverUrl)}
                        alt={storeData.storeName}
                        loading="lazy"
                        className="w-full h-48 sm:h-60 object-cover rounded-2xl border border-line/30 bg-surface"
                      />
                    </div>
                  )}
                </div>
              </div>

              {banners.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {banners.map((banner: any) => (
                    <div
                      key={banner.id}
                      onClick={() => {
                        if (banner.targetType === 'category' && banner.targetValue) {
                          setSelectedCategoryId(banner.targetValue);
                        } else if (banner.targetType === 'product' && banner.targetValue) {
                          onSelectProduct(banner.targetValue);
                        }
                      }}
                      className="rounded-2xl border border-line bg-surface text-ink p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-brand transition"
                    >
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                          Destaque
                        </span>
                        <h3 className="font-bold text-base text-ink">{banner.title}</h3>
                        {banner.subtitle && (
                          <p className="text-xs text-muted">{banner.subtitle}</p>
                        )}
                        <span className="inline-block text-xs font-bold text-brand pt-1">
                          {banner.ctaLabel || 'Conferir'} →
                        </span>
                      </div>
                      {banner.imageUrl && (
                        <img
                          src={getFullUrl(banner.imageUrl)}
                          alt={banner.title}
                          loading="lazy"
                          className="w-20 h-20 rounded-xl object-cover border border-line shrink-0"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        }

        if (section.type === 'categories' && categories.length > 0) {
          return (
            <section key={section.id} className="max-w-6xl mx-auto w-full px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-80">
                  {section.title || 'Categorias'}
                </h3>
                {selectedCategoryId && (
                  <button
                    onClick={() => setSelectedCategoryId('')}
                    className="text-xs font-bold text-brand hover:underline"
                  >
                    Mostrar todas
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategoryId('')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition ${
                    !selectedCategoryId
                      ? 'bg-brand text-on-brand border-brand'
                      : 'bg-surface text-ink border-line hover:border-brand'
                  }`}
                >
                  Todas as peças
                </button>
                {categories.map((cat: any) => {
                  const active = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() =>
                        setSelectedCategoryId(active ? '' : cat.id)
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition ${
                        active
                          ? 'bg-brand text-on-brand border-brand'
                          : 'bg-surface text-ink border-line hover:border-brand'
                      }`}
                    >
                      {cat.name}
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
          !search &&
          !selectedCategoryId
        ) {
          return (
            <section key={section.id} className="max-w-6xl mx-auto w-full px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-brand" />
                <h3 className="text-lg font-black">
                  {section.title || 'Destaques da Loja'}
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {featuredProducts.slice(0, 4).map((prod: any) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
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
              className="max-w-6xl mx-auto w-full px-4 py-5 flex-1"
            >
              <div className="bg-surface text-ink border border-line rounded-2xl p-4 mb-5 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-3 text-muted"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por modelo, categoria ou descrição..."
                      className="w-full pl-10 pr-4 py-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3.5 py-2.5 bg-page border border-line rounded-xl text-sm text-ink font-semibold focus:border-brand outline-none"
                  >
                    <option value="featured">Destaques primeiro</option>
                    <option value="price_asc">Menor preço</option>
                    <option value="price_desc">Maior preço</option>
                    <option value="name_asc">Ordem A-Z</option>
                  </select>
                </div>

                {/* Filtros de tamanho, cor e estoque */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-muted flex items-center gap-1">
                    <Filter size={13} /> Filtros:
                  </span>
                  {facets.sizes?.length > 0 && (
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="px-3 py-1.5 bg-page border border-line rounded-lg text-xs text-ink font-medium outline-none focus:border-brand"
                    >
                      <option value="">Todos os tamanhos</option>
                      {facets.sizes.map((sz: string) => (
                        <option key={sz} value={sz}>
                          Tamanho: {sz}
                        </option>
                      ))}
                    </select>
                  )}
                  {facets.colors?.length > 0 && (
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="px-3 py-1.5 bg-page border border-line rounded-lg text-xs text-ink font-medium outline-none focus:border-brand"
                    >
                      <option value="">Todas as cores</option>
                      {facets.colors.map((cl: string) => (
                        <option key={cl} value={cl}>
                          Cor: {cl}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink cursor-pointer px-2.5 py-1.5 rounded-lg bg-page border border-line">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="accent-brand"
                    />
                    Somente disponíveis
                  </label>
                  {(search ||
                    selectedCategoryId ||
                    selectedSize ||
                    selectedColor ||
                    inStockOnly) && (
                    <button
                      onClick={() => {
                        setSearch('');
                        setSelectedCategoryId('');
                        setSelectedSize('');
                        setSelectedColor('');
                        setInStockOnly(false);
                      }}
                      className="text-xs font-bold text-brand hover:underline ml-auto"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>

              {loadingProducts ? (
                <div className="py-16 text-center text-muted flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-brand" size={28} />
                  <p className="text-sm font-medium">Carregando mercadorias...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="bg-surface text-ink border border-line rounded-2xl p-10 text-center space-y-2">
                  <Package size={32} className="mx-auto text-muted" />
                  <p className="font-bold text-base">
                    Nenhuma mercadoria encontrada com estes filtros
                  </p>
                  <p className="text-xs text-muted">
                    Tente buscar por outro termo ou limpar os filtros selecionados.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map((prod: any) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
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
          return (
            <section key={section.id} className="max-w-6xl mx-auto w-full px-4 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {storeData.pickupEnabled && (
                  <div className="bg-surface text-ink border border-line rounded-2xl p-5 flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-support text-brand shrink-0">
                      <Store size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Retirada na Loja</h4>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {storeData.pickupInstructions ||
                          'Faça o pedido online para reservar suas peças e retire rapidamente no balcão da loja.'}
                      </p>
                    </div>
                  </div>
                )}
                {storeData.deliveryEnabled && (
                  <div className="bg-surface text-ink border border-line rounded-2xl p-5 flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-support text-brand shrink-0">
                      <Truck size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">
                        Entrega a Combinar{' '}
                        {storeData.deliveryFeeNote && (
                          <span className="text-brand font-semibold">
                            • {storeData.deliveryFeeNote}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        {storeData.deliveryInstructions ||
                          'Informe seu endereço ao finalizar e combine prazo e taxa de entrega diretamente pelo WhatsApp.'}
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
              className={`border-t mt-auto py-8 px-4 text-xs ${
                isDark
                  ? 'border-muted text-line'
                  : 'border-line text-muted bg-surface'
              }`}
            >
              <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-ink">
                    {storeData.storeName}
                  </p>
                  {storeData.description && (
                    <p className="mt-0.5 max-w-md">{storeData.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <ShieldCheck size={15} className="text-brand" />
                  <span>Catálogo conectado ao estoque em tempo real • PDV Lojista</span>
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
          <Link
            to={`/loja/${storeData.slug}/carrinho`}
            style={{ backgroundColor: 'var(--sf-primary)', color: '#FFFFFF' }}
            className="w-full py-3.5 px-5 rounded-2xl shadow-lg flex items-center justify-between font-bold text-sm"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag size={18} />
              Ver sacola ({cartCount} {cartCount === 1 ? 'item' : 'itens'})
            </span>
            <span className="font-mono">{formatBrl(cartTotal)} →</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  onSelect,
  onQuickAdd,
}: {
  product: any;
  onSelect: () => void;
  onQuickAdd?: (product: any, variant: any) => void;
}) {
  const inStock = Boolean(product.inStock && product.totalAvailableStock > 0);
  const singleVariant =
    Array.isArray(product.variants) && product.variants.length === 1
      ? product.variants[0]
      : null;

  return (
    <div className="bg-surface text-ink border border-line rounded-2xl overflow-hidden flex flex-col hover:border-brand transition shadow-sm">
      <div
        onClick={onSelect}
        className="relative aspect-square bg-page cursor-pointer overflow-hidden flex items-center justify-center"
      >
        {product.imageUrl ? (
          <img
            src={getFullUrl(product.imageUrl)}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="text-muted flex flex-col items-center gap-1 p-4 text-center">
            <Package size={28} />
            <span className="text-[11px]">Sem foto</span>
          </div>
        )}
        {product.badgeLabel && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand text-on-brand">
            {product.badgeLabel}
          </span>
        )}
        {!inStock && (
          <span className="absolute inset-x-2 bottom-2 py-1 rounded-lg text-[11px] font-bold bg-surface/95 text-muted border border-line text-center">
            Esgotado no momento
          </span>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
        <div onClick={onSelect} className="cursor-pointer">
          {product.categoryName && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
              {product.categoryName}
            </p>
          )}
          <h4 className="font-bold text-sm text-ink line-clamp-2 mt-0.5">
            {product.title}
          </h4>
          {product.sizes?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {product.sizes.slice(0, 5).map((sz: string) => (
                <span
                  key={sz}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-page border border-line text-muted font-medium"
                >
                  {sz}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-line flex items-center justify-between gap-2">
          <div>
            <p className="text-base font-black text-brand">
              {formatBrl(product.priceSell)}
            </p>
            <p className="text-[10px] text-muted">
              {inStock
                ? `${product.totalAvailableStock} un. disponíveis`
                : 'Indisponível'}
            </p>
          </div>
          {inStock && singleVariant && onQuickAdd ? (
            <button
              onClick={() => onQuickAdd(product, singleVariant)}
              className="px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold transition"
            >
              + Sacola
            </button>
          ) : (
            <button
              onClick={onSelect}
              className="px-3 py-1.5 rounded-xl bg-support text-brand hover:bg-brand hover:text-on-brand text-xs font-bold transition"
            >
              {inStock ? 'Escolher' : 'Ver'}
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

  // Carrinho isolado por storePublicId
  const [cartItems, setCartItems] = useState<StorefrontCartItem[]>([]);
  const [cartValidation, setCartValidation] = useState<any>(null);
  const [validatingCart, setValidatingCart] = useState(false);

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

  // Carregar loja publicada
  const fetchStoreHome = useCallback(async () => {
    if (!slug) return;
    setLoadingStore(true);
    setStoreError(null);
    try {
      const { data } = await storefrontApi.get(`/storefront/public/${slug}`);
      setStoreData(data);
      if (data.pickupEnabled && !data.deliveryEnabled) {
        setFulfillmentMode('PICKUP');
      } else if (!data.pickupEnabled && data.deliveryEnabled) {
        setFulfillmentMode('DELIVERY');
      }
      const loaded = loadStoreCart(data.publicId, data.slug);
      setCartItems(loaded.items);
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

  // Revalidar carrinho no servidor (ao abrir carrinho/checkout ou ao reconectar)
  const revalidateCartOnServer = useCallback(
    async (silent = false) => {
      if (!storeData?.publicId || cartItems.length === 0 || isOffline) return null;
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
    if ((isCartPage || isCheckoutPage) && !isOffline && cartItems.length > 0) {
      void revalidateCartOnServer(true);
    }
  }, [isCartPage, isCheckoutPage, isOffline]);

  // Carregar status de pedido (/loja/:slug/pedido/:referencia)
  const fetchOrderStatus = useCallback(async () => {
    if (!slug || !referencia) return;
    const tokenFromUrl = searchParams.get('token') || searchParams.get('t') || '';
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
      }

      clearStoreCart(storeData.publicId, storeData.slug);
      setOrderDetail(data);
      toast.success(`Pedido ${data.reference} registrado com sucesso!`);
      navigate(
        `/loja/${slug}/pedido/${data.reference}${
          data.accessToken ? `?token=${encodeURIComponent(data.accessToken)}` : ''
        }`,
      );
    } catch (err: any) {
      const resp = err.response?.data;
      if (resp?.code === 'PRICE_DIVERGENCE' && Array.isArray(resp.divergences)) {
        setPriceDivergenceAlert(resp.divergences);
        // Atualizar os preços no carrinho local para que a próxima confirmação envie os preços aceitos
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

  if (loadingStore && !isOrderPage) {
    return (
      <div className="min-h-screen bg-page text-ink flex flex-col items-center justify-center p-6 gap-3">
        <Loader2 className="animate-spin text-brand" size={32} />
        <p className="text-sm font-semibold text-muted">
          Carregando loja virtual...
        </p>
      </div>
    );
  }

  if (storeError && !isOrderPage) {
    return (
      <div className="min-h-screen bg-page text-ink flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-support text-brand flex items-center justify-center mx-auto">
            <Store size={28} />
          </div>
          <h1 className="text-xl font-black text-ink">Loja Indisponível</h1>
          <p className="text-sm text-muted leading-relaxed">{storeError}</p>
          <button
            onClick={() => void fetchStoreHome()}
            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-bold text-sm inline-flex items-center gap-2 transition"
          >
            <RefreshCw size={15} /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ── ROTA: /loja/:slug/pedido/:referencia ──────────────────────────────────
  if (isOrderPage) {
    const commInfo =
      COMMERCIAL_STATUS_LABELS[orderDetail?.commercialStatus] ||
      COMMERCIAL_STATUS_LABELS.AWAITING_CONFIRMATION;

    return (
      <div
        style={getStoreThemeStyles(storeData?.theme)}
        className="min-h-screen bg-page text-ink py-8 px-4"
      >
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <Link
              to={`/loja/${slug}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline"
            >
              <ArrowLeft size={16} /> Voltar à loja
            </Link>
            {orderDetail && (
              <button
                onClick={() => void fetchOrderStatus()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-brand px-3 py-1.5 rounded-lg bg-surface border border-line"
              >
                <RefreshCw size={13} /> Atualizar status
              </button>
            )}
          </div>

          {loadingOrder ? (
            <div className="bg-surface border border-line rounded-3xl p-12 text-center space-y-2">
              <Loader2 className="animate-spin text-brand mx-auto" size={28} />
              <p className="text-sm text-muted">Consultando pedido...</p>
            </div>
          ) : orderError ? (
            <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-3">
              <AlertCircle size={32} className="text-brand mx-auto" />
              <h2 className="text-lg font-black">Acesso ao Pedido</h2>
              <p className="text-sm text-muted">{orderError}</p>
            </div>
          ) : orderDetail ? (
            <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-support text-brand">
                    <CheckCircle2 size={13} /> Pedido Registrado
                  </span>
                  <h1 className="text-2xl font-black text-ink mt-2 font-mono">
                    {orderDetail.reference}
                  </h1>
                  <p className="text-xs text-muted mt-0.5">
                    Registrado em{' '}
                    {new Date(orderDetail.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-muted uppercase font-bold">
                    Total dos Produtos
                  </p>
                  <p className="text-2xl font-black text-brand">
                    {formatBrl(orderDetail.total)}
                  </p>
                </div>
              </div>

              {/* Ação Principal: Abrir WhatsApp com a mensagem pronta */}
              <div className="bg-support border border-brand rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <MessageCircle size={22} className="text-brand shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-ink">
                      Envie a confirmação pelo WhatsApp para combinar o atendimento
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Seu pedido já foi salvo e o estoque está reservado até{' '}
                      <strong>
                        {new Date(
                          orderDetail.reservationExpiresAt,
                        ).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                      . Clique abaixo para enviar o resumo à loja no WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  {orderDetail.whatsappUrl && (
                    <a
                      href={orderDetail.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[200px] py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-on-brand font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm"
                    >
                      <MessageCircle size={17} />
                      Abrir WhatsApp da Loja
                      <ExternalLink size={14} />
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
                    className="py-3 px-4 rounded-xl bg-surface hover:bg-page text-ink border border-line font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Copy size={15} /> Copiar Resumo
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
                <div className="p-3.5 rounded-2xl bg-page border border-line">
                  <p className="text-[10px] font-bold uppercase text-muted">
                    Situação do Pedido
                  </p>
                  <p className="text-sm font-bold text-ink mt-0.5">
                    {commInfo.label}
                  </p>
                  <p className="text-xs text-muted mt-1">{commInfo.desc}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-page border border-line space-y-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted">
                      Andamento / Separação
                    </p>
                    <p className="text-sm font-bold text-brand">
                      {FULFILLMENT_STATUS_LABELS[
                        orderDetail.fulfillmentStatus
                      ] || orderDetail.fulfillmentStatus}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-line">
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
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Itens do Pedido ({orderDetail.items?.length || 0})
                </h3>
                <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
                  {(orderDetail.items || []).map((item: any) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-surface flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-ink truncate">
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
                      <span className="font-bold text-sm text-ink shrink-0">
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

  // ── ROTA: /loja/:slug/produto/:produtoSlug ────────────────────────────────
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
          <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <Link
              to={`/loja/${slug}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-ink hover:text-brand"
            >
              <ArrowLeft size={17} /> {storeData?.storeName || 'Voltar'}
            </Link>
            <Link
              to={`/loja/${slug}/carrinho`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand text-on-brand text-xs font-bold"
            >
              <ShoppingBag size={15} /> Sacola ({cartCount})
            </Link>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 pt-6">
          {loadingProductDetail || !productDetail ? (
            <div className="py-20 text-center">
              <Loader2 className="animate-spin text-brand mx-auto" size={28} />
            </div>
          ) : (
            <>
              <div className="bg-surface border border-line rounded-3xl p-5 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 shadow-sm">
                {/* Galeria de fotos */}
                <div className="md:col-span-6 space-y-3">
                  <div className="aspect-square rounded-2xl bg-page border border-line overflow-hidden flex items-center justify-center">
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
                        <Package size={40} />
                        <span className="text-xs">Sem imagem cadastrada</span>
                      </div>
                    )}
                  </div>
                  {productDetail.galleryUrls?.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {productDetail.galleryUrls.map((url: string) => (
                        <button
                          key={url}
                          onClick={() => setActivePhotoUrl(url)}
                          className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
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
                      {productDetail.categoryName && (
                        <span className="text-xs font-bold uppercase tracking-wider text-brand">
                          {productDetail.categoryName}
                        </span>
                      )}
                      <h1 className="text-2xl sm:text-3xl font-black text-ink mt-1">
                        {productDetail.title}
                      </h1>
                      <p className="text-2xl font-black text-brand mt-2">
                        {formatBrl(
                          selectedVariant?.priceSell ?? productDetail.priceSell,
                        )}
                      </p>
                    </div>

                    {productDetail.description && (
                      <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
                        {productDetail.description}
                      </p>
                    )}

                    {/* Seleção de Tamanho */}
                    {sizes.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                          Tamanho: <strong className="text-ink">{chosenSize}</strong>
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
                                className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
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
                          Cor: <strong className="text-ink">{chosenColor}</strong>
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
                                className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
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
                    <div className="p-3.5 rounded-2xl bg-page border border-line flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-ink">
                          Disponibilidade imediata
                        </p>
                        <p className="text-xs text-muted">
                          {variantInStock
                            ? `${variantAvailableStock} unidade(s) em estoque`
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
                            className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-ink"
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
                            className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-ink"
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
                        );
                      }}
                      className="w-full py-3.5 px-6 rounded-2xl bg-brand hover:bg-brand-hover disabled:opacity-40 text-on-brand font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm"
                    >
                      <ShoppingBag size={18} />
                      {variantInStock
                        ? 'Adicionar à Sacola'
                        : 'Variação Indisponível'}
                    </button>
                    {cartCount > 0 && (
                      <Link
                        to={`/loja/${slug}/carrinho`}
                        className="w-full py-3 px-6 rounded-2xl bg-support text-brand font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition"
                      >
                        Ir para a sacola ({cartCount} itens) →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Produtos relacionados */}
              {relatedProducts.length > 0 && (
                <div className="mt-10 space-y-4">
                  <h3 className="text-lg font-black text-ink">
                    Veja também nesta categoria
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
          <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <Link
              to={isCheckoutPage ? `/loja/${slug}/carrinho` : `/loja/${slug}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-ink hover:text-brand"
            >
              <ArrowLeft size={17} />
              {isCheckoutPage ? 'Voltar à sacola' : 'Continuar comprando'}
            </Link>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {isCheckoutPage ? 'Finalizar Pedido' : 'Sua Sacola'}
            </span>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-5">
          {isOffline && (
            <div className="bg-support border border-brand rounded-2xl p-4 flex items-center gap-3 text-sm text-ink">
              <WifiOff size={18} className="text-brand shrink-0" />
              <span>
                Você está offline. Não é possível confirmar pedidos sem conexão;
                assim que reconectar, os preços e o estoque serão revalidados.
              </span>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="bg-surface border border-line rounded-3xl p-10 text-center space-y-3">
              <ShoppingBag size={36} className="mx-auto text-muted" />
              <h2 className="text-lg font-black text-ink">
                Sua sacola está vazia
              </h2>
              <p className="text-xs text-muted">
                Explore o catálogo da loja e escolha suas mercadorias.
              </p>
              <Link
                to={`/loja/${slug}`}
                className="inline-block px-5 py-2.5 rounded-xl bg-brand text-on-brand font-bold text-sm mt-2"
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
                        outOfStock ? 'border-brand bg-support/40' : 'border-line'
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
                          <p className="text-sm font-black text-brand mt-1">
                            {formatBrl(item.priceUnit)}
                          </p>
                          {outOfStock && (
                            <p className="text-xs font-bold text-brand mt-1">
                              Disponível no momento: {valItem.availableStock} un.
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
                          className="w-8 h-8 rounded-lg bg-page border border-line flex items-center justify-center text-ink"
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
                          className="w-8 h-8 rounded-lg bg-page border border-line flex items-center justify-center text-ink"
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
                          className="p-2 text-muted hover:text-brand ml-1"
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
                  <h3 className="font-black text-base text-ink">
                    Resumo do Pedido
                  </h3>
                  <div className="space-y-2 text-sm border-b border-line pb-3">
                    <div className="flex justify-between text-muted">
                      <span>Itens ({cartCount})</span>
                      <span>{formatBrl(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted text-xs">
                      <span>Entrega / Retirada</span>
                      <span>A combinar na próxima etapa</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-sm">Total dos produtos</span>
                    <span className="text-xl font-black text-brand">
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
                    className="w-full py-3.5 px-5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-brand font-bold text-sm transition"
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
                  <h3 className="font-black text-base text-ink">
                    1. Seus Dados para Atendimento
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold uppercase text-muted block mb-1">
                        Seu Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ex.: Maria Silva"
                        className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted block mb-1">
                        Seu WhatsApp com DDD *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-muted block mb-1">
                        CPF (Opcional)
                      </label>
                      <input
                        type="text"
                        value={customerCpf}
                        onChange={(e) => setCustomerCpf(e.target.value)}
                        placeholder="Opcional para nota fiscal"
                        className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
                  <h3 className="font-black text-base text-ink">
                    2. Modalidade de Atendimento
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {storeData?.pickupEnabled && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentMode('PICKUP')}
                        className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 ${
                          fulfillmentMode === 'PICKUP'
                            ? 'border-brand bg-support'
                            : 'border-line bg-page'
                        }`}
                      >
                        <Store size={20} className="text-brand shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-ink">
                            Retirar na Loja
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            Sem taxa de entrega. Combine o horário pelo WhatsApp.
                          </p>
                        </div>
                      </button>
                    )}
                    {storeData?.deliveryEnabled && (
                      <button
                        type="button"
                        onClick={() => setFulfillmentMode('DELIVERY')}
                        className={`p-4 rounded-2xl border text-left transition flex items-start gap-3 ${
                          fulfillmentMode === 'DELIVERY'
                            ? 'border-brand bg-support'
                            : 'border-line bg-page'
                        }`}
                      >
                        <Truck size={20} className="text-brand shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-ink">
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
                        <label className="text-xs font-bold uppercase text-muted block mb-1">
                          Rua / Logradouro *
                        </label>
                        <input
                          type="text"
                          required
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="Rua, Avenida..."
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold uppercase text-muted block mb-1">
                          Número *
                        </label>
                        <input
                          type="text"
                          required
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          placeholder="Nº"
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold uppercase text-muted block mb-1">
                          Bairro *
                        </label>
                        <input
                          type="text"
                          required
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          placeholder="Bairro"
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold uppercase text-muted block mb-1">
                          Complemento / Apto
                        </label>
                        <input
                          type="text"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          placeholder="Bloco, apto, casa..."
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold uppercase text-muted block mb-1">
                          Cidade
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Cidade"
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold uppercase text-muted block mb-1">
                          Ponto de Referência
                        </label>
                        <input
                          type="text"
                          value={addressRef}
                          onChange={(e) => setAddressRef(e.target.value)}
                          placeholder="Próximo a..."
                          className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold uppercase text-muted block mb-1">
                      Observações do Pedido (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ex.: preferência de horário, embalagem para presente, forma de pagamento preferida..."
                      className="w-full p-2.5 bg-page border border-line rounded-xl text-sm text-ink focus:border-brand outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 sticky top-20">
                  <h3 className="font-black text-base text-ink">
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
                    <span className="font-bold text-sm">Total dos produtos</span>
                    <span className="text-2xl font-black text-brand">
                      {formatBrl(cartTotal)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-page border border-line text-xs text-muted space-y-1">
                    <p className="font-semibold text-ink flex items-center gap-1.5">
                      <Clock size={13} className="text-brand" /> Reserva imediata
                      por {storeData?.confirmReservationMinutes || 15} minutos
                    </p>
                    <p>
                      Ao clicar abaixo, seu pedido será salvo com código único e
                      você abrirá o WhatsApp da loja com o resumo pronto.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingOrder || isOffline}
                    className="w-full py-3.5 px-5 rounded-xl bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-brand font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    {submittingOrder ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        Registrando pedido...
                      </>
                    ) : (
                      <>
                        <MessageCircle size={17} />
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
      onQuickAdd={(prod, variant) => handleAddVariantToCart(prod, variant, 1)}
    />
  );
}

export default PublicStorefrontApp;
