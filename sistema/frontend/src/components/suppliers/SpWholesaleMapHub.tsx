'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  MessageCircle,
  ShieldCheck,
  Store,
  Search,
  Filter,
  ExternalLink,
  CheckCircle2,
  Package,
  Clock,
  Truck,
  Sparkles,
  Plus,
  Minus,
  X,
  ArrowRight,
  BookmarkPlus,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  WholesaleSupplier,
  WholesaleSupplierItem,
  SP_WHOLESALE_REGIONS,
  SP_WHOLESALE_CATEGORIES,
  getRegionLabel,
  formatWhatsAppHref,
} from '@/lib/sp-wholesale-map';
import { SpCustomMapCanvas } from './SpCustomMapCanvas';

interface SpWholesaleMapHubProps {
  onSupplierImported?: () => void;
}

export function SpWholesaleMapHub({ onSupplierImported }: SpWholesaleMapHubProps) {
  const [suppliers, setSuppliers] = useState<WholesaleSupplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas as Peças');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // Expanded supplier storefront modal state ("Ver Fornecedor")
  const [expandedSupplier, setExpandedSupplier] = useState<WholesaleSupplier | null>(null);
  const [expandedCategoryFilter, setExpandedCategoryFilter] = useState<string>('Todas');
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [deliveryMode, setDeliveryMode] = useState<
    'GUARANTEED_DELIVERY' | 'EXCURSION_BUS' | 'PICKUP_STORE'
  >('GUARANTEED_DELIVERY');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [importingSupplierId, setImportingSupplierId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    title: string;
    subtitle: string;
    whatsappUrl?: string;
    protocolCode?: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSpHub() {
      setLoading(true);
      try {
        const res = await api.get('/suppliers/sp-hub');
        const list: WholesaleSupplier[] = Array.isArray(res.data) ? res.data : [];
        if (mounted) {
          setSuppliers(list);
          if (list.length > 0) {
            setSelectedSupplierId(list[0].id);
          }
        }
      } catch {
        // Fallback silencioso
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSpHub();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      if (selectedRegion !== 'ALL' && sup.region !== selectedRegion) {
        return false;
      }

      if (selectedCategory !== 'Todas as Peças') {
        const hasCatInSupplier = (sup.categories || []).some(
          (c) => c.toLowerCase() === selectedCategory.toLowerCase(),
        );
        const hasCatInItems = (sup.items || []).some(
          (it) => it.category.toLowerCase() === selectedCategory.toLowerCase(),
        );
        if (!hasCatInSupplier && !hasCatInItems) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inName = sup.name.toLowerCase().includes(q);
        const inAddress = sup.address.toLowerCase().includes(q);
        const inGallery = (sup.galleryName || '').toLowerCase().includes(q);
        const inCategories = (sup.categories || []).some((c) => c.toLowerCase().includes(q));
        const inItems = (sup.items || []).some((i) => i.name.toLowerCase().includes(q));
        if (!inName && !inAddress && !inGallery && !inCategories && !inItems) {
          return false;
        }
      }

      return true;
    });
  }, [suppliers, selectedRegion, selectedCategory, searchTerm]);

  // Keep a valid supplier selected on the right panel whenever filters change
  useEffect(() => {
    if (filteredSuppliers.length === 0) {
      setSelectedSupplierId(null);
      return;
    }
    if (!selectedSupplierId || !filteredSuppliers.some((s) => s.id === selectedSupplierId)) {
      setSelectedSupplierId(filteredSuppliers[0].id);
    }
  }, [filteredSuppliers, selectedSupplierId]);

  const activeSupplier = useMemo(() => {
    return (
      filteredSuppliers.find((s) => s.id === selectedSupplierId) ||
      filteredSuppliers[0] ||
      null
    );
  }, [filteredSuppliers, selectedSupplierId]);

  // Extract the 6 preview items (2 rows of 3 = 3x2 grid) for the Right Panel
  const sixPreviewItems = useMemo(() => {
    if (!activeSupplier) return [];
    const items = activeSupplier.items || [];
    const featured = items.filter((i) => i.isPreviewSix);
    const baseList = featured.length >= 6 ? featured : items;
    return baseList.slice(0, 6);
  }, [activeSupplier]);

  const handleOpenExpandedStore = (supplier: WholesaleSupplier) => {
    setExpandedSupplier(supplier);
    setExpandedCategoryFilter('Todas');
    setFeedbackBanner(null);
  };

  const handleImportSupplier = async (supplier: WholesaleSupplier) => {
    setImportingSupplierId(supplier.id);
    try {
      const res = await api.post(`/suppliers/sp-hub/${supplier.id}/import`);
      const already = res.data?.alreadyExisted;
      setFeedbackBanner({
        title: already
          ? `${supplier.name} atualizado na sua lista de fornecedores!`
          : `${supplier.name} importado para Meus Fornecedores!`,
        subtitle:
          'Agora você pode vincular produtos do estoque e lançar notas/pedidos diretamente para este fornecedor.',
      });
      if (onSupplierImported) onSupplierImported();
    } catch (err: any) {
      setFeedbackBanner({
        title: 'Não foi possível importar o fornecedor no momento',
        subtitle: err?.response?.data?.message || 'Verifique sua conexão e tente novamente.',
      });
    } finally {
      setImportingSupplierId(null);
    }
  };

  const handleAdjustItemQty = (item: WholesaleSupplierItem, deltaPacks: number) => {
    setCartQuantities((prev) => {
      const current = prev[item.id] || 0;
      const step = Math.max(1, item.minPackQty || 4);
      const next = Math.max(0, current + deltaPacks * step);
      const updated = { ...prev };
      if (next === 0) {
        delete updated[item.id];
      } else {
        updated[item.id] = next;
      }
      return updated;
    });
  };

  const orderSummary = useMemo(() => {
    if (!expandedSupplier) {
      return { totalPieces: 0, totalWholesale: 0, totalRetail: 0, estimatedProfit: 0, lines: [] };
    }
    const lines = (expandedSupplier.items || [])
      .filter((item) => (cartQuantities[item.id] || 0) > 0)
      .map((item) => {
        const qty = cartQuantities[item.id] || 0;
        const wholesaleSub = Number((qty * item.wholesalePrice).toFixed(2));
        const retailSub = Number(
          (qty * (item.suggestedRetailPrice || item.wholesalePrice * 2.2)).toFixed(2),
        );
        return {
          item,
          qty,
          wholesaleSub,
          retailSub,
        };
      });

    const totalPieces = lines.reduce((acc, l) => acc + l.qty, 0);
    const totalWholesale = Number(lines.reduce((acc, l) => acc + l.wholesaleSub, 0).toFixed(2));
    const totalRetail = Number(lines.reduce((acc, l) => acc + l.retailSub, 0).toFixed(2));
    const estimatedProfit = Number((totalRetail - totalWholesale).toFixed(2));

    return { totalPieces, totalWholesale, totalRetail, estimatedProfit, lines };
  }, [expandedSupplier, cartQuantities]);

  const handleCreateGuaranteedOrder = async () => {
    if (!expandedSupplier || orderSummary.lines.length === 0) return;
    setSubmittingOrder(true);
    try {
      const res = await api.post(`/suppliers/sp-hub/${expandedSupplier.id}/order-request`, {
        items: orderSummary.lines.map((l) => ({
          itemId: l.item.id,
          quantity: l.qty,
        })),
        deliveryMode,
        notes: orderNotes,
      });

      const data = res.data;
      setFeedbackBanner({
        title: `Pedido Atacado ${data.protocolCode} registrado com Entrega Garantida!`,
        subtitle: `O pedido de R$ ${Number(data.totalWholesale).toFixed(2).replace('.', ',')} foi salvo em Pedidos de Compra e o fornecedor ${expandedSupplier.name} foi vinculado à sua loja.`,
        whatsappUrl: data.whatsappUrl,
        protocolCode: data.protocolCode,
      });
      setCartQuantities({});
      setOrderNotes('');
      if (onSupplierImported) onSupplierImported();
    } catch (err: any) {
      setFeedbackBanner({
        title: 'Erro ao registrar solicitação de pedido no atacado',
        subtitle: err?.response?.data?.message || 'Tente novamente em instantes.',
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Header Card */}
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-support px-2.5 py-1 text-xs font-extrabold text-brand">
                <MapPin className="h-3.5 w-3.5" />
                HUB EXCLUSIVO SÃO PAULO
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-page px-2.5 py-1 text-xs font-bold text-ink">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                Fornecedores Homologados & Entrega Garantida
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-extrabold text-ink">
              Mapa de Fornecedores no Atacado • Brás, 25 de Março & Bom Retiro
            </h2>
            <p className="text-xs text-muted">
              Filtre pelas peças que sua loja precisa, clique no marcador com foto no mapa e veja 6 itens (3x2) com preço de fábrica antes de chamar no WhatsApp.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar rua, galeria, loja ou peça..."
              className="w-full rounded-xl border border-line bg-page py-2 pl-9 pr-3 text-xs font-medium text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        {/* Category / Piece Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-line">
          <span className="mr-1 flex items-center gap-1 text-xs font-bold text-muted">
            <Filter className="h-3.5 w-3.5 text-brand" />
            Filtrar por Peça:
          </span>
          {SP_WHOLESALE_CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-brand text-on-brand shadow-sm'
                    : 'border border-line bg-page text-ink hover:border-brand hover:bg-support hover:text-brand'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Region / Polo Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-xs font-bold text-muted">
            <MapPin className="h-3.5 w-3.5 text-brand" />
            Polo Comercial:
          </span>
          {SP_WHOLESALE_REGIONS.map((region) => {
            const active = selectedRegion === region.id;
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => setSelectedRegion(region.id)}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
                  active
                    ? 'border border-brand bg-support text-brand font-bold'
                    : 'border border-line bg-surface text-muted hover:border-brand hover:text-ink'
                }`}
              >
                {region.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Banner if any */}
      {feedbackBanner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 border-brand bg-support p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-brand mt-0.5" />
            <div>
              <p className="text-sm font-extrabold text-ink">{feedbackBanner.title}</p>
              <p className="text-xs text-muted mt-0.5">{feedbackBanner.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {feedbackBanner.whatsappUrl && (
              <a
                href={feedbackBanner.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Enviar Pedido no WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="rounded-lg border border-line bg-surface p-1.5 text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Split Grid: Custom SP Map (Left) + Expanded Store Drawer (Right) */}
      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-2xl border border-line bg-surface">
          <div className="text-center space-y-2">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-xs font-bold text-muted">
              Carregando mapa de fornecedores de São Paulo (Brás & 25 de Março)...
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Left Column: Interactive SP Map + Horizontal Quick Store Selector */}
          <div className="xl:col-span-7 flex flex-col gap-3">
            <SpCustomMapCanvas
              suppliers={filteredSuppliers}
              selectedSupplierId={activeSupplier?.id || null}
              onSelectSupplier={(sup) => setSelectedSupplierId(sup.id)}
              activeRegion={selectedRegion}
              className="flex-1"
            />

            {/* Quick Store Strip below the map */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {filteredSuppliers.map((sup) => {
                const isSelected = sup.id === activeSupplier?.id;
                return (
                  <button
                    key={sup.id}
                    type="button"
                    onClick={() => setSelectedSupplierId(sup.id)}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl border p-2 pr-3 text-left transition-all ${
                      isSelected
                        ? 'border-brand bg-support shadow-sm'
                        : 'border-line bg-surface hover:border-brand'
                    }`}
                  >
                    <img
                      src={sup.coverImageUrl}
                      alt={sup.name}
                      className="h-9 w-9 rounded-lg object-cover border border-line"
                    />
                    <div>
                      <p className="text-xs font-extrabold text-ink line-clamp-1">{sup.name}</p>
                      <p className="text-[11px] font-semibold text-brand">
                        {getRegionLabel(sup.region)} • {(sup.items || []).length} peças
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Expanded Store Preview Drawer (Address + WhatsApp + 6 Items in 3x2 Grid + Ver Fornecedor) */}
          <div className="xl:col-span-5">
            {activeSupplier ? (
              <div className="flex h-full flex-col justify-between rounded-2xl border-2 border-brand bg-surface p-5 shadow-sm">
                <div className="space-y-4">
                  {/* Store Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-brand bg-page">
                        <img
                          src={activeSupplier.coverImageUrl}
                          alt={activeSupplier.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-support px-2 py-0.5 text-[10px] font-extrabold text-brand uppercase">
                            {getRegionLabel(activeSupplier.region)}
                          </span>
                          {activeSupplier.verified && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-brand bg-surface px-2 py-0.5 text-[10px] font-bold text-brand">
                              <ShieldCheck className="h-3 w-3" />
                              Fornecedor Verificado
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 text-base font-extrabold text-ink">
                          {activeSupplier.name}
                        </h3>
                        {activeSupplier.galleryName && (
                          <p className="text-xs font-semibold text-muted">
                            {activeSupplier.galleryName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Store Address & Operational Info Box */}
                  <div className="rounded-xl border border-line bg-page p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-ink">{activeSupplier.address}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {activeSupplier.openingHours} • Pedido mín.: R${' '}
                          {Number(activeSupplier.minOrderValue).toFixed(2).replace('.', ',')} (
                          {activeSupplier.minOrderPieces} pçs)
                        </p>
                      </div>
                    </div>

                    {activeSupplier.guaranteedDelivery && (
                      <div className="flex items-center gap-2 border-t border-line pt-2 text-[11px] font-semibold text-brand">
                        <Truck className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Entrega Garantida: {activeSupplier.shippingMethods}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Primary Action Row: Call on WhatsApp + Save Supplier */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={formatWhatsAppHref(
                        activeSupplier.whatsapp,
                        `Olá ${activeSupplier.name}! Vi sua loja no Mapa Atacado SP do PDV Lojista (${activeSupplier.address}) e gostaria de receber a tabela e grades disponíveis no atacado.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-extrabold text-on-brand shadow-sm hover:bg-brand-hover transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chamar no WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={() => handleImportSupplier(activeSupplier)}
                      disabled={importingSupplierId === activeSupplier.id}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-brand bg-support px-3 py-2.5 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand transition-colors disabled:opacity-50"
                    >
                      <BookmarkPlus className="h-4 w-4" />
                      {importingSupplierId === activeSupplier.id
                        ? 'Salvando...'
                        : 'Salvar Fornecedor'}
                    </button>
                  </div>

                  {/* 6 Items in 2 Rows of 3 (3x2 Grid) Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-ink">
                        Vitrine Rápida • 6 Peças no Atacado (3x2)
                      </span>
                      <span className="text-[11px] font-semibold text-brand">
                        Preços exclusivos lojista
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {sixPreviewItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenExpandedStore(activeSupplier)}
                          className="group flex flex-col overflow-hidden rounded-xl border border-line bg-page text-left transition-all hover:border-brand hover:shadow-sm"
                        >
                          <div className="relative aspect-square w-full overflow-hidden bg-surface">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                            <span className="absolute bottom-1 left-1 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-extrabold text-on-brand shadow-sm">
                              R$ {Number(item.wholesalePrice).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <div className="p-2">
                            <p className="line-clamp-1 text-[11px] font-bold text-ink">
                              {item.name}
                            </p>
                            <p className="mt-0.5 text-[10px] font-medium text-muted line-clamp-1">
                              Mín. {item.minPackQty} un • {item.sizesLabel}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom CTA: Ver Fornecedor (Opens Expanded Supplier Storefront & Catalog) */}
                <div className="mt-4 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => handleOpenExpandedStore(activeSupplier)}
                    className="flex w-full items-center justify-between rounded-xl border-2 border-brand bg-support px-4 py-3 text-xs font-extrabold text-brand hover:bg-brand hover:text-on-brand transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Ver Fornecedor Completo, Peças Expandidas & Fazer Pedido
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center">
                <Store className="h-10 w-10 text-brand mb-2" />
                <p className="text-sm font-bold text-ink">
                  Nenhum fornecedor encontrado para este filtro
                </p>
                <p className="text-xs text-muted mt-1 max-w-xs">
                  Limpe o filtro de peça ou selecione &ldquo;Todos os Polos SP&rdquo; para visualizar todas as lojas do Brás e 25 de Março.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('Todas as Peças');
                    setSelectedRegion('ALL');
                    setSearchTerm('');
                  }}
                  className="mt-4 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover"
                >
                  Mostrar Todas as Lojas
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXPANDED SUPPLIER STOREFRONT MODAL ("Ver Fornecedor") */}
      {expandedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 sm:p-6 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border-2 border-brand bg-surface shadow-2xl">
            {/* Storefront Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line bg-page px-6 py-4">
              <div className="flex items-center gap-4">
                <img
                  src={expandedSupplier.coverImageUrl}
                  alt={expandedSupplier.name}
                  className="h-16 w-16 rounded-2xl border-2 border-brand object-cover"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-brand px-2.5 py-0.5 text-[11px] font-extrabold text-on-brand">
                      {getRegionLabel(expandedSupplier.region)}
                    </span>
                    {expandedSupplier.guaranteedDelivery && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-support px-2.5 py-0.5 text-[11px] font-bold text-brand">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Entrega com Segurança Garantida
                      </span>
                    )}
                    <span className="text-xs font-semibold text-muted">
                      {expandedSupplier.openingHours}
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-extrabold text-ink">
                    {expandedSupplier.name}
                  </h2>
                  <p className="flex items-center gap-1 text-xs font-medium text-muted">
                    <MapPin className="h-3.5 w-3.5 text-brand" />
                    {expandedSupplier.address}{' '}
                    {expandedSupplier.galleryName ? `(${expandedSupplier.galleryName})` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={formatWhatsAppHref(
                    expandedSupplier.whatsapp,
                    `Olá ${expandedSupplier.name}! Estou vendo a loja completa de vocês no PDV Lojista e quero fechar um pedido no atacado.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-extrabold text-on-brand hover:bg-brand-hover transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar no WhatsApp da Loja
                </a>

                <button
                  type="button"
                  onClick={() => handleImportSupplier(expandedSupplier)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand bg-support px-3.5 py-2.5 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand transition-colors"
                >
                  <BookmarkPlus className="h-4 w-4" />
                  Vincular à Minha Loja
                </button>

                <button
                  type="button"
                  onClick={() => setExpandedSupplier(null)}
                  className="rounded-xl border border-line bg-surface p-2.5 text-muted hover:border-brand hover:text-ink"
                  title="Fechar vitrine do fornecedor"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Storefront Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Supplier Highlights Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-line bg-page p-3.5">
                  <p className="text-[11px] font-bold uppercase text-muted">
                    Sobre o Fabricante / Importador
                  </p>
                  <p className="mt-1 text-xs font-medium text-ink">
                    {expandedSupplier.description ||
                      'Fornecedor homologado no polo atacadista de São Paulo com pronta-entrega para lojistas.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-page p-3.5">
                  <p className="text-[11px] font-bold uppercase text-muted">
                    Regras de Atacado & Grade
                  </p>
                  <p className="mt-1 text-xs font-extrabold text-ink">
                    Pedido Mínimo: R${' '}
                    {Number(expandedSupplier.minOrderValue).toFixed(2).replace('.', ',')} ou{' '}
                    {expandedSupplier.minOrderPieces} peças sortidas
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Grades fechadas ou pacotes por modelo com nota e garantia de troca por defeito.
                  </p>
                </div>
                <div className="rounded-2xl border border-brand bg-support p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-brand">
                    <ShieldCheck className="h-4 w-4" />
                    Logística & Entrega Garantida SP
                  </p>
                  <p className="mt-1 text-xs font-bold text-ink">
                    {expandedSupplier.shippingMethods}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Despacho monitorado em ônibus de excursão no Brás, transportadora ou Correios.
                  </p>
                </div>
              </div>

              {/* Category Tabs inside Expanded Store */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {['Todas', ...(expandedSupplier.categories || [])].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExpandedCategoryFilter(cat)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        expandedCategoryFilter === cat
                          ? 'bg-brand text-on-brand'
                          : 'border border-line bg-page text-ink hover:border-brand'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-muted">
                  Selecione as grades abaixo para simular seu lucro de revenda e solicitar entrega
                </span>
              </div>

              {/* Expanded Catalog Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(expandedSupplier.items || [])
                  .filter(
                    (it) =>
                      expandedCategoryFilter === 'Todas' ||
                      it.category.toLowerCase() === expandedCategoryFilter.toLowerCase(),
                  )
                  .map((item) => {
                    const selectedQty = cartQuantities[item.id] || 0;
                    const retailPrice =
                      item.suggestedRetailPrice || Number((item.wholesalePrice * 2.2).toFixed(2));
                    const marginPct =
                      item.wholesalePrice > 0
                        ? Math.round(
                            ((retailPrice - item.wholesalePrice) / item.wholesalePrice) * 100,
                          )
                        : 100;

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                          selectedQty > 0
                            ? 'border-2 border-brand bg-support/40 shadow-sm'
                            : 'border-line bg-page hover:border-brand'
                        }`}
                      >
                        <div>
                          <div className="relative h-52 w-full overflow-hidden bg-surface">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute top-2.5 left-2.5 rounded-lg bg-surface/95 px-2.5 py-1 text-[11px] font-extrabold text-ink shadow-sm">
                              {item.category}
                            </span>
                            <span className="absolute top-2.5 right-2.5 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-extrabold text-on-brand shadow-sm">
                              +{marginPct}% margem sugerida
                            </span>
                          </div>

                          <div className="p-4 space-y-2.5">
                            <h4 className="text-sm font-extrabold text-ink">{item.name}</h4>

                            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted">
                              <span className="rounded-md border border-line bg-surface px-2 py-0.5">
                                Grade: {item.sizesLabel}
                              </span>
                              <span className="rounded-md border border-line bg-surface px-2 py-0.5">
                                Cores: {item.colorsLabel}
                              </span>
                              <span className="rounded-md border border-line bg-surface px-2 py-0.5">
                                Pacote mín.: {item.minPackQty} un
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface p-2.5">
                              <div>
                                <p className="text-[10px] font-bold uppercase text-muted">
                                  Custo Atacado SP
                                </p>
                                <p className="text-base font-extrabold text-brand">
                                  R$ {Number(item.wholesalePrice).toFixed(2).replace('.', ',')}
                                  <span className="text-[10px] font-normal text-muted"> /un</span>
                                </p>
                              </div>
                              <div className="border-l border-line pl-2.5">
                                <p className="text-[10px] font-bold uppercase text-muted">
                                  Venda Sugerida Loja
                                </p>
                                <p className="text-sm font-extrabold text-ink">
                                  R$ {Number(retailPrice).toFixed(2).replace('.', ',')}
                                  <span className="text-[10px] font-normal text-muted"> /un</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pack Quantity Selector */}
                        <div className="border-t border-line bg-surface px-4 py-3 flex items-center justify-between gap-2">
                          {selectedQty > 0 ? (
                            <>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAdjustItemQty(item, -1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-page text-ink hover:border-brand hover:text-brand"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <div className="text-center min-w-[64px]">
                                  <p className="text-xs font-extrabold text-ink">
                                    {selectedQty} pçs
                                  </p>
                                  <p className="text-[10px] font-bold text-brand">
                                    R${' '}
                                    {(selectedQty * item.wholesalePrice)
                                      .toFixed(2)
                                      .replace('.', ',')}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustItemQty(item, 1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-on-brand hover:bg-brand-hover"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <span className="rounded-lg bg-support px-2 py-1 text-[10px] font-extrabold text-brand">
                                Na Sacola Atacado
                              </span>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAdjustItemQty(item, 1)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand bg-support py-2 text-xs font-extrabold text-brand hover:bg-brand hover:text-on-brand transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar Grade ({item.minPackQty} peças)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Sticky Footer: Guaranteed Delivery & Automatic Purchase Order Generator */}
            <div className="border-t-2 border-brand bg-page px-6 py-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-muted">
                      Resumo do Pedido Atacado
                    </p>
                    <p className="text-sm font-extrabold text-ink">
                      {orderSummary.totalPieces} peças selecionadas • Total Atacado:{' '}
                      <span className="text-brand">
                        R$ {orderSummary.totalWholesale.toFixed(2).replace('.', ',')}
                      </span>
                    </p>
                    {orderSummary.totalPieces > 0 && (
                      <p className="text-xs font-semibold text-muted">
                        Faturamento estimado na loja: R${' '}
                        {orderSummary.totalRetail.toFixed(2).replace('.', ',')} •{' '}
                        <span className="font-bold text-brand">
                          Lucro Bruto Estimado: R${' '}
                          {orderSummary.estimatedProfit.toFixed(2).replace('.', ',')}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Delivery Modality Selector */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        {
                          id: 'GUARANTEED_DELIVERY',
                          label: 'Entrega Garantida (Transportadora Segurada)',
                        },
                        { id: 'EXCURSION_BUS', label: 'Ônibus de Excursão (Brás)' },
                        { id: 'PICKUP_STORE', label: 'Retirar na Loja' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setDeliveryMode(mode.id)}
                        className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                          deliveryMode === mode.id
                            ? 'bg-brand text-on-brand'
                            : 'border border-line bg-surface text-muted hover:text-ink'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={orderSummary.totalPieces === 0 || submittingOrder}
                    onClick={handleCreateGuaranteedOrder}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-xs font-extrabold text-on-brand shadow-sm hover:bg-brand-hover transition-all disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {submittingOrder
                      ? 'Gerando Pedido Garantido...'
                      : 'Solicitar Entrega com Segurança Garantida'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
