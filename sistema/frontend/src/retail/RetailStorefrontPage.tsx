import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Store,
  Palette,
  Package,
  FolderKanban,
  ShoppingBag,
  Settings,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Eye,
  Smartphone,
  Monitor,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  HandCoins,
  RefreshCw,
  Truck,
  MapPin,
  Upload,
  Star,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { ROUTES } from "@/lib/routes";
import { StorefrontHomeView } from "@/storefront/PublicStorefrontApp";

function formatBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(val) ? val : 0);
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const COMMERCIAL_STATUS_LABELS: Record<string, string> = {
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmado pela loja",
  COMPLETED: "Convertido em venda",
  CANCELLED: "Cancelado",
  REJECTED: "Recusado",
  EXPIRED: "Reserva expirada",
};

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  WAITING_SEPARATION: "Aguardando separação",
  SEPARATING: "Em separação",
  READY_FOR_PICKUP: "Pronto para retirada",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue / Retirado",
};

const PAYMENT_METHOD_OPTIONS = [
  { id: "pix", label: "PIX" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao_credito", label: "Cartão de Crédito" },
  { id: "cartao_debito", label: "Cartão de Débito" },
];

export function RetailStorefrontPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith(ROUTES.lojaVirtual.aparencia)) return "aparencia";
    if (p.startsWith(ROUTES.lojaVirtual.produtos)) return "produtos";
    if (p.startsWith(ROUTES.lojaVirtual.categorias)) return "categorias";
    if (p.startsWith(ROUTES.lojaVirtual.pedidos)) return "pedidos";
    if (p.startsWith(ROUTES.lojaVirtual.configuracoes)) return "configuracoes";
    return "visao-geral";
  }, [location.pathname]);

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);

  // Draft appearance state
  const [draftTheme, setDraftTheme] = useState<any>(null);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">(
    "desktop",
  );
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<any>({
    slug: "",
    storeName: "",
    tagline: "",
    description: "",
    logoUrl: "",
    coverUrl: "",
    whatsappPhone: "",
    whatsappMessageIntro: "",
    pickupEnabled: true,
    pickupInstructions: "",
    deliveryEnabled: true,
    deliveryInstructions: "",
    deliveryFeeNote: "",
    confirmReservationMinutes: 15,
    confirmedHoldHours: 24,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Products tab state
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState<
    "all" | "published" | "hidden" | "featured" | "missing_photo" | "no_stock"
  >("all");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Categories tab state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Orders tab state
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("");
  const [orderSearch, setOrderSearch] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState("pix");
  const [convertDiscount, setConvertDiscount] = useState("0");
  const [convertEmitNfce, setConvertEmitNfce] = useState(false);
  const [convertingSale, setConvertingSale] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, prodRes, catRes, ordRes] = await Promise.all([
        api.get("/storefront/admin/overview"),
        api.get("/storefront/admin/products"),
        api.get("/storefront/admin/categories"),
        api.get("/storefront/admin/orders", {
          params: {
            commercialStatus: orderStatusFilter || undefined,
            search: orderSearch || undefined,
          },
        }),
      ]);

      const ov = ovRes.data;
      setOverview(ov);
      setCatalogProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      setCatalogCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setOrders(Array.isArray(ordRes.data?.data) ? ordRes.data.data : []);
      setOrdersTotal(Number(ordRes.data?.meta?.total ?? 0));

      if (ov?.settings?.draftTheme) {
        setDraftTheme(ov.settings.draftTheme);
      }

      if (ov?.settings) {
        const s = ov.settings;
        setSettingsForm({
          slug: s.slug || "",
          storeName: s.storeName || "",
          tagline: s.tagline || "",
          description: s.description || "",
          logoUrl: s.logoUrl || "",
          coverUrl: s.coverUrl || "",
          whatsappPhone: s.whatsappPhone || "",
          whatsappMessageIntro: s.whatsappMessageIntro || "",
          pickupEnabled: s.pickupEnabled !== false,
          pickupInstructions: s.pickupInstructions || "",
          deliveryEnabled: s.deliveryEnabled !== false,
          deliveryInstructions: s.deliveryInstructions || "",
          deliveryFeeNote: s.deliveryFeeNote || "",
          confirmReservationMinutes: Number(s.confirmReservationMinutes ?? 15),
          confirmedHoldHours: Number(s.confirmedHoldHours ?? 24),
        });
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Não foi possível carregar os dados da Loja Virtual.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderStatusFilter, orderSearch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const publicStoreUrl = useMemo(() => {
    const slug = overview?.settings?.slug || settingsForm.slug;
    if (!slug) return "";
    return `${window.location.origin}/loja/${slug}`;
  }, [overview?.settings?.slug, settingsForm.slug]);

  const handleCopyLink = () => {
    if (!publicStoreUrl) {
      toast.error("Defina um endereço (slug) nas Configurações primeiro.");
      return;
    }
    navigator.clipboard.writeText(publicStoreUrl);
    setCopiedLink(true);
    toast.success("Link público copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ── Settings & Publishing Handlers ────────────────────────────────────────
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put("/storefront/admin/settings", {
        ...settingsForm,
        confirmReservationMinutes:
          Number(settingsForm.confirmReservationMinutes) || 15,
        confirmedHoldHours: Number(settingsForm.confirmedHoldHours) || 24,
      });
      toast.success("Configurações da loja virtual salvas!");
      await loadAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao salvar configurações.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftTheme) return;
    setSavingDraft(true);
    try {
      const res = await api.put("/storefront/admin/appearance/draft", {
        theme: draftTheme,
        storeName: settingsForm.storeName,
        tagline: settingsForm.tagline,
        description: settingsForm.description,
        logoUrl: settingsForm.logoUrl,
        coverUrl: settingsForm.coverUrl,
      });
      if (res.data?.draftTheme) {
        setDraftTheme(res.data.draftTheme);
      }
      toast.success("Rascunho de aparência salvo!");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao salvar rascunho.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      if (draftTheme) {
        await api.put("/storefront/admin/appearance/draft", {
          theme: draftTheme,
          storeName: settingsForm.storeName,
          tagline: settingsForm.tagline,
          description: settingsForm.description,
          logoUrl: settingsForm.logoUrl,
          coverUrl: settingsForm.coverUrl,
        });
      }
      const res = await api.post("/storefront/admin/appearance/publish");
      toast.success(
        `Loja Virtual publicada com sucesso (/loja/${res.data?.slug})!`,
      );
      await loadAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Não foi possível publicar. Confira o WhatsApp de atendimento e o endereço na aba Configurações.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      await api.post("/storefront/admin/appearance/unpublish");
      toast.success("Loja Virtual despublicada.");
      await loadAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao despublicar a loja.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleImageUpload = async (
    file: File,
    field: "logoUrl" | "coverUrl",
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/storefront/admin/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.imageUrl || res.data?.url;
      if (url) {
        setSettingsForm((prev: any) => ({ ...prev, [field]: url }));
        toast.success("Imagem enviada! Salve as configurações para aplicar.");
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Falha ao enviar a imagem.",
      );
    }
  };

  // ── Products Handlers ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return catalogProducts.filter((item) => {
      if (
        q &&
        !String(item.name || "")
          .toLowerCase()
          .includes(q) &&
        !String(item.categoryName || "")
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (productFilter === "published") return Boolean(item.visible);
      if (productFilter === "hidden") return !item.visible;
      if (productFilter === "featured") return Boolean(item.featured);
      if (productFilter === "missing_photo") return Boolean(item.missingPhoto);
      if (productFilter === "no_stock") return Boolean(item.outOfStock);
      return true;
    });
  }, [catalogProducts, productSearch, productFilter]);

  const handleQuickToggleProduct = async (
    item: any,
    patch: { visible?: boolean; featured?: boolean; sortOrder?: number },
  ) => {
    try {
      await api.put(`/storefront/admin/products/${item.retailGroupId}`, {
        visible: patch.visible ?? item.visible,
        featured: patch.featured ?? item.featured,
        sortOrder: patch.sortOrder ?? item.sortOrder,
        publicSlug: item.publicSlug,
        commercialTitle: item.commercialTitle,
        commercialDescription: item.commercialDescription,
      });
      setCatalogProducts((prev) =>
        prev.map((p) =>
          p.retailGroupId === item.retailGroupId ? { ...p, ...patch } : p,
        ),
      );
      toast.success("Mercadoria atualizada na vitrine!");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao atualizar mercadoria.",
      );
    }
  };

  const handleBatchUpdateProducts = async (
    action: "publish" | "unpublish" | "feature" | "unfeature",
  ) => {
    if (selectedGroupIds.length === 0) {
      toast.error("Selecione ao menos uma mercadoria.");
      return;
    }
    try {
      await api.post("/storefront/admin/products/batch", {
        retailGroupIds: selectedGroupIds,
        action,
      });
      toast.success(
        `${selectedGroupIds.length} mercadoria(s) atualizada(s) em lote!`,
      );
      setSelectedGroupIds([]);
      await loadAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro na atualização em lote.",
      );
    }
  };

  const handleSaveProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      await api.put(
        `/storefront/admin/products/${editingProduct.retailGroupId}`,
        {
          visible: editingProduct.visible,
          featured: editingProduct.featured,
          sortOrder: Number(editingProduct.sortOrder ?? 0),
          publicSlug: editingProduct.publicSlug,
          commercialTitle: editingProduct.commercialTitle,
          commercialDescription: editingProduct.commercialDescription,
        },
      );
      toast.success("Detalhes comerciais do produto salvos!");
      setEditingProduct(null);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao salvar produto.");
    } finally {
      setSavingProduct(false);
    }
  };

  // ── Categories Handlers ────────────────────────────────────────────────────
  const handleUpdateCategory = async (cat: any, patch: any) => {
    try {
      const updatedList = catalogCategories.map((c) =>
        c.categoryId === cat.categoryId ? { ...c, ...patch } : c,
      );
      setCatalogCategories(updatedList);
      await api.put("/storefront/admin/categories", {
        categories: updatedList,
      });
      toast.success("Categoria da vitrine atualizada!");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao atualizar categoria.",
      );
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      await api.post("/storefront/admin/categories", { name });
      setNewCategoryName("");
      toast.success("Nova categoria criada no catálogo!");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao criar categoria.");
    } finally {
      setCreatingCategory(false);
    }
  };

  // ── Orders Handlers ────────────────────────────────────────────────────────
  const handleOpenOrderDetail = async (orderId: string) => {
    setLoadingOrderDetail(true);
    try {
      const res = await api.get(`/storefront/admin/orders/${orderId}`);
      setSelectedOrder(res.data);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao carregar detalhes do pedido.",
      );
    } finally {
      setLoadingOrderDetail(false);
    }
  };

  const handleOrderAction = async (
    orderId: string,
    action: "confirm" | "cancel" | "reject",
    reason?: string,
  ) => {
    try {
      const res = await api.post(
        `/storefront/admin/orders/${orderId}/${action}`,
        { reason },
      );
      setSelectedOrder(res.data);
      toast.success("Situação do pedido atualizada!");
      await loadAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Não foi possível atualizar o pedido.",
      );
    }
  };

  const handleFulfillmentStatusChange = async (
    orderId: string,
    fulfillmentStatus: string,
  ) => {
    try {
      const res = await api.put(
        `/storefront/admin/orders/${orderId}/fulfillment`,
        { fulfillmentStatus },
      );
      setSelectedOrder(res.data);
      toast.success("Andamento da entrega/retirada atualizado!");
      await loadAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao atualizar entrega/retirada.",
      );
    }
  };

  const handleConvertToSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setConvertingSale(true);
    try {
      const discountNum = Math.max(0, Number(convertDiscount) || 0);
      const netAmount = Math.max(
        0,
        Number(selectedOrder.total || 0) - discountNum,
      );
      const res = await api.post(
        `/storefront/admin/orders/${selectedOrder.id}/convert-to-sale`,
        {
          idempotencyKey: `conv-${selectedOrder.id}`,
          payments: [{ method: convertPaymentMethod, value: netAmount }],
          discount: discountNum,
          emitirNfce: convertEmitNfce,
        },
      );
      toast.success(
        "Pedido convertido em venda no PDV com baixa única de estoque!",
      );
      setConvertModalOpen(false);
      if (res.data?.order) {
        setSelectedOrder(res.data.order);
      }
      await loadAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Erro ao converter pedido em venda. Verifique se o caixa está aberto.",
      );
    } finally {
      setConvertingSale(false);
    }
  };

  // Avisos de produtos publicados sem foto ou sem estoque
  const publishedWarnings = useMemo(() => {
    const pub = catalogProducts.filter((p) => p.visible);
    return {
      withoutPhoto: pub.filter((p) => p.missingPhoto).length,
      outOfStock: pub.filter((p) => p.outOfStock).length,
    };
  }, [catalogProducts]);

  // Live preview data for Appearance tab
  const livePreviewStoreData = useMemo(() => {
    const publishedProds = catalogProducts
      .filter((p) => p.visible)
      .map((p) => ({
        id: p.retailGroupId,
        publicSlug: p.publicSlug,
        name: p.commercialTitle || p.name,
        description: p.commercialDescription || "",
        imageUrl: p.imageUrl,
        galleryUrls: p.galleryUrls || [],
        priceSell: p.priceSell,
        featured: p.featured,
        sortOrder: p.sortOrder,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        availableStock: p.availableStockTotal,
        inStock: p.availableStockTotal > 0,
        variants: (p.variants || []).map((v: any) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          availableStock: Math.max(0, v.availableStock),
          inStock: v.availableStock > 0,
        })),
      }));

    const publishedCats = catalogCategories
      .filter((c) => c.visible)
      .map((c) => ({
        id: c.categoryId,
        name: c.displayName || c.name,
        slug: c.slug || c.categoryId,
        featured: c.featured,
        sortOrder: c.sortOrder,
      }));

    return {
      storeData: {
        publicId: overview?.settings?.publicId || "preview",
        slug: settingsForm.slug || "minha-loja",
        storeName:
          settingsForm.storeName ||
          overview?.settings?.storeName ||
          "Minha Loja",
        tagline: settingsForm.tagline || "",
        description: settingsForm.description || "",
        logoUrl: settingsForm.logoUrl || null,
        coverUrl: settingsForm.coverUrl || null,
        whatsappPhone: settingsForm.whatsappPhone || "",
        pickupEnabled: settingsForm.pickupEnabled,
        pickupInstructions: settingsForm.pickupInstructions,
        deliveryEnabled: settingsForm.deliveryEnabled,
        deliveryInstructions: settingsForm.deliveryInstructions,
        deliveryFeeNote: settingsForm.deliveryFeeNote,
        theme: draftTheme || {},
        categories: publishedCats,
        featuredProducts: publishedProds.filter((p) => p.featured),
        facets: { sizes: [], colors: [] },
      },
      products: publishedProds,
    };
  }, [
    settingsForm,
    overview?.settings,
    draftTheme,
    catalogProducts,
    catalogCategories,
  ]);

  if (loading && !overview) {
    return (
      <div className="p-6 text-sm text-muted">
        Carregando painel da Loja Virtual...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-support text-brand">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-ink">
                {settingsForm.storeName || "Loja Virtual"}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold ${
                  overview?.settings?.isPublished
                    ? "bg-brand text-on-brand"
                    : "border border-line bg-page text-muted"
                }`}
              >
                {overview?.settings?.isPublished ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Publicada (v{overview?.settings?.publishedVersion || 1})
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    Rascunho privado
                  </>
                )}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {publicStoreUrl ? (
                <>
                  Endereço público:{" "}
                  <strong className="text-ink">{publicStoreUrl}</strong>
                </>
              ) : (
                "Defina o endereço público (slug) na aba Configurações para publicar sua loja."
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {publicStoreUrl && (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-bold text-ink hover:border-brand"
              >
                {copiedLink ? (
                  <Check className="h-4 w-4 text-brand" />
                ) : (
                  <Copy className="h-4 w-4 text-muted" />
                )}
                {copiedLink ? "Copiado!" : "Copiar link"}
              </button>
              {overview?.settings?.isPublished && (
                <a
                  href={publicStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand bg-support px-3.5 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir loja pública
                </a>
              )}
            </>
          )}

          {overview?.settings?.isPublished ? (
            <button
              type="button"
              disabled={publishing}
              onClick={handleUnpublish}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-muted hover:text-ink disabled:opacity-50"
            >
              Despublicar
            </button>
          ) : null}

          <button
            type="button"
            disabled={publishing}
            onClick={handlePublish}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {publishing
              ? "Publicando..."
              : overview?.settings?.isPublished
                ? "Publicar atualizações"
                : "Publicar loja"}
          </button>
        </div>
      </div>

      {/* 1. ABA VISÃO GERAL */}
      {activeTab === "visao-geral" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
                <span>Mercadorias publicadas</span>
                <Package className="h-4 w-4 text-brand" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-ink">
                {overview?.stats?.publishedProductsCount ?? 0}{" "}
                <span className="text-sm font-normal text-muted">
                  / {overview?.stats?.totalRetailGroups ?? 0}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.lojaVirtual.produtos)}
                className="mt-3 text-xs font-bold text-brand hover:underline"
              >
                Escolher mercadorias →
              </button>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
                <span>Aguardando confirmação</span>
                <ShoppingBag className="h-4 w-4 text-brand" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-ink">
                {overview?.stats?.awaitingOrdersCount ?? 0}
              </div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.lojaVirtual.pedidos)}
                className="mt-3 text-xs font-bold text-brand hover:underline"
              >
                Atender pedidos →
              </button>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
                <span>Reservas de estoque ativas</span>
                <Clock className="h-4 w-4 text-brand" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-ink">
                {overview?.stats?.activeReservationsCount ?? 0}
              </div>
              <p className="mt-3 text-xs text-muted">
                Prazo inicial: {settingsForm.confirmReservationMinutes} min
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
                <span>Convertidos em venda</span>
                <HandCoins className="h-4 w-4 text-brand" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-ink">
                {overview?.stats?.completedOrdersCount ?? 0}
              </div>
              <p className="mt-3 text-xs text-muted">
                Integrados ao caixa e estoque
              </p>
            </div>
          </div>

          {/* Avisos operacionais */}
          {(publishedWarnings.withoutPhoto > 0 ||
            publishedWarnings.outOfStock > 0) && (
            <div className="rounded-2xl border border-brand bg-support p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div className="space-y-1 text-xs text-ink">
                  <p className="font-bold text-brand">
                    Atenção aos itens publicados na vitrine:
                  </p>
                  {publishedWarnings.withoutPhoto > 0 && (
                    <p>
                      • <strong>{publishedWarnings.withoutPhoto}</strong>{" "}
                      mercadoria(s) publicada(s) estão sem foto cadastrada.
                    </p>
                  )}
                  {publishedWarnings.outOfStock > 0 && (
                    <p>
                      • <strong>{publishedWarnings.outOfStock}</strong>{" "}
                      mercadoria(s) publicada(s) estão com estoque disponível
                      esgotado.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Guia rápido de ativação */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-support text-brand">
                <Settings className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">
                1. Endereço e WhatsApp
              </h3>
              <p className="mt-1 text-xs text-muted">
                Configure o link público (/loja/sua-loja), o WhatsApp de
                atendimento e as opções de retirada e entrega.
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.lojaVirtual.configuracoes)}
                className="mt-4 rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-bold text-ink hover:border-brand"
              >
                Abrir Configurações
              </button>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-support text-brand">
                <Package className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">
                2. Mercadorias e Destaques
              </h3>
              <p className="mt-1 text-xs text-muted">
                Escolha quais produtos do seu estoque aparecem na loja virtual,
                destaque ofertas e personalize descrições.
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.lojaVirtual.produtos)}
                className="mt-4 rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-bold text-ink hover:border-brand"
              >
                Selecionar Mercadorias
              </button>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-support text-brand">
                <Palette className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ink">
                3. Aparência e Publicação
              </h3>
              <p className="mt-1 text-xs text-muted">
                Personalize capa, modelo visual, banners e ordem das seções com
                prévia em tempo real antes de publicar.
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.lojaVirtual.aparencia)}
                className="mt-4 rounded-xl border border-line bg-page px-3.5 py-2 text-xs font-bold text-ink hover:border-brand"
              >
                Personalizar Aparência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA APARÊNCIA */}
      {activeTab === "aparencia" && draftTheme && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Coluna Esquerda: Editor Estruturado */}
          <div className="space-y-5 xl:col-span-5">
            <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Palette className="h-4 w-4 text-brand" />
                  Modelo Visual e Tema
                </h3>
                <button
                  type="button"
                  disabled={savingDraft}
                  onClick={handleSaveDraft}
                  className="rounded-xl border border-brand bg-support px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand disabled:opacity-50"
                >
                  {savingDraft ? "Salvando..." : "Salvar rascunho"}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Modelo de página
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "editorial_roxo", label: "Editorial Roxo" },
                    { id: "minimal_branco", label: "Minimal Branco" },
                    { id: "vitrine_escura", label: "Vitrine Escura" },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          template: tpl.id,
                        }))
                      }
                      className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                        draftTheme.template === tpl.id
                          ? "border-brand bg-brand text-on-brand"
                          : "border-line bg-page text-ink hover:border-brand"
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Cor principal da vitrine
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraftTheme((prev: any) => ({
                        ...prev,
                        primaryColor: "#7C3AED",
                        accentColor: "#6D28D9",
                      }))
                    }
                    className="flex items-center gap-2 rounded-xl border border-line bg-page p-2.5 text-xs font-bold text-ink hover:border-brand"
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-line"
                      style={{ backgroundColor: "#7C3AED" }}
                    />
                    Roxo Vibrante (#7C3AED)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftTheme((prev: any) => ({
                        ...prev,
                        primaryColor: "#6D28D9",
                        accentColor: "#7C3AED",
                      }))
                    }
                    className="flex items-center gap-2 rounded-xl border border-line bg-page p-2.5 text-xs font-bold text-ink hover:border-brand"
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-line"
                      style={{ backgroundColor: "#6D28D9" }}
                    />
                    Roxo Profundo (#6D28D9)
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-line">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Capa e Apresentação
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Título principal da capa
                  </label>
                  <input
                    type="text"
                    value={draftTheme.heroTitle || ""}
                    onChange={(e) =>
                      setDraftTheme((prev: any) => ({
                        ...prev,
                        heroTitle: e.target.value,
                      }))
                    }
                    placeholder="Ex.: Nova Coleção Disponível"
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Subtítulo / texto de apresentação
                  </label>
                  <textarea
                    rows={2}
                    value={draftTheme.heroSubtitle || ""}
                    onChange={(e) =>
                      setDraftTheme((prev: any) => ({
                        ...prev,
                        heroSubtitle: e.target.value,
                      }))
                    }
                    placeholder="Escolha seus produtos favoritos e finalize seu pedido pelo WhatsApp."
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Texto do botão da capa
                    </label>
                    <input
                      type="text"
                      value={draftTheme.heroCtaLabel || ""}
                      onChange={(e) =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          heroCtaLabel: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Faixa de aviso no topo
                    </label>
                    <input
                      type="text"
                      value={draftTheme.announcementText || ""}
                      onChange={(e) =>
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          announcementText: e.target.value,
                        }))
                      }
                      placeholder="Ex.: Retirada rápida na loja"
                      className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                    />
                  </div>
                </div>
              </div>

              {/* Seções ativáveis e reordenáveis */}
              <div className="space-y-2 pt-2 border-t border-line">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Seções da Página (Ativar e Ordenar)
                </h4>
                <div className="space-y-1.5">
                  {(draftTheme.sections || []).map((sec: any, idx: number) => (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between rounded-xl border border-line bg-page px-3 py-2 text-xs"
                    >
                      <label className="flex items-center gap-2 font-semibold text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sec.enabled !== false}
                          onChange={(e) => {
                            const next = [...(draftTheme.sections || [])];
                            next[idx] = {
                              ...sec,
                              enabled: e.target.checked,
                            };
                            setDraftTheme((prev: any) => ({
                              ...prev,
                              sections: next,
                            }));
                          }}
                        />
                        <span>{sec.title || sec.type}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            const next = [...(draftTheme.sections || [])];
                            const temp = next[idx - 1];
                            next[idx - 1] = next[idx];
                            next[idx] = temp;
                            setDraftTheme((prev: any) => ({
                              ...prev,
                              sections: next,
                            }));
                          }}
                          className="rounded-lg p-1 text-muted hover:text-ink disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            idx === (draftTheme.sections || []).length - 1
                          }
                          onClick={() => {
                            const next = [...(draftTheme.sections || [])];
                            const temp = next[idx + 1];
                            next[idx + 1] = next[idx];
                            next[idx] = temp;
                            setDraftTheme((prev: any) => ({
                              ...prev,
                              sections: next,
                            }));
                          }}
                          className="rounded-lg p-1 text-muted hover:text-ink disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Banners estruturados */}
              <div className="space-y-2 pt-2 border-t border-line">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Banners Promocionais
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [
                        ...(draftTheme.banners || []),
                        {
                          id: `ban-${Date.now()}`,
                          title: "Destaque da Semana",
                          subtitle: "Confira as novidades disponíveis na loja",
                          imageUrl: "",
                          targetType: "none",
                          targetValue: "",
                          ctaLabel: "Conferir",
                        },
                      ];
                      setDraftTheme((prev: any) => ({
                        ...prev,
                        banners: next,
                      }));
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar banner
                  </button>
                </div>

                {(draftTheme.banners || []).map((ban: any, idx: number) => (
                  <div
                    key={ban.id}
                    className="rounded-xl border border-line bg-page p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">
                        Banner #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (draftTheme.banners || []).filter(
                            (_: any, i: number) => i !== idx,
                          );
                          setDraftTheme((prev: any) => ({
                            ...prev,
                            banners: next,
                          }));
                        }}
                        className="text-muted hover:text-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={ban.title || ""}
                      onChange={(e) => {
                        const next = [...(draftTheme.banners || [])];
                        next[idx] = { ...ban, title: e.target.value };
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          banners: next,
                        }));
                      }}
                      placeholder="Título do banner"
                      className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
                    />
                    <input
                      type="text"
                      value={ban.subtitle || ""}
                      onChange={(e) => {
                        const next = [...(draftTheme.banners || [])];
                        next[idx] = { ...ban, subtitle: e.target.value };
                        setDraftTheme((prev: any) => ({
                          ...prev,
                          banners: next,
                        }));
                      }}
                      placeholder="Subtítulo opcional"
                      className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Prévia ao Vivo (Mobile e Computador) */}
          <div className="xl:col-span-7 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Eye className="h-4 w-4 text-brand" />
                <span>Prévia em Tempo Real (Rascunho)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                    previewDevice === "mobile"
                      ? "bg-brand text-on-brand"
                      : "border border-line bg-page text-ink"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Celular
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                    previewDevice === "desktop"
                      ? "bg-brand text-on-brand"
                      : "border border-line bg-page text-ink"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Computador
                </button>
              </div>
            </div>

            <div className="flex justify-center rounded-2xl border border-line bg-page p-4 overflow-hidden">
              <div
                className={`overflow-y-auto rounded-2xl border border-line bg-surface shadow-sm transition-all ${
                  previewDevice === "mobile"
                    ? "w-[375px] max-h-[680px]"
                    : "w-full max-h-[680px]"
                }`}
              >
                <StorefrontHomeView
                  storeData={livePreviewStoreData.storeData}
                  products={livePreviewStoreData.products}
                  loadingProducts={false}
                  search=""
                  setSearch={() => {}}
                  selectedCategoryId=""
                  setSelectedCategoryId={() => {}}
                  selectedSize=""
                  setSelectedSize={() => {}}
                  selectedColor=""
                  setSelectedColor={() => {}}
                  sortBy="featured"
                  setSortBy={() => {}}
                  inStockOnly={false}
                  setInStockOnly={() => {}}
                  cartCount={0}
                  cartTotal={0}
                  onSelectProduct={() => {}}
                  isPreview
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA PRODUTOS */}
      {activeTab === "produtos" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar mercadoria por nome ou categoria..."
                className="w-full rounded-xl border border-line bg-page py-2 pl-9 pr-3 text-xs text-ink"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: "Todos" },
                { id: "published", label: "Publicados" },
                { id: "hidden", label: "Ocultos" },
                { id: "featured", label: "Destaques" },
                { id: "missing_photo", label: "Sem foto" },
                { id: "no_stock", label: "Sem estoque" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setProductFilter(f.id as any)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    productFilter === f.id
                      ? "bg-brand text-on-brand"
                      : "border border-line bg-page text-ink hover:border-brand"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {selectedGroupIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand bg-support px-4 py-3 text-xs">
              <span className="font-bold text-brand">
                {selectedGroupIds.length} mercadoria(s) selecionada(s)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBatchUpdateProducts("publish")}
                  className="rounded-xl bg-brand px-3 py-1.5 font-bold text-on-brand"
                >
                  Publicar selecionadas
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchUpdateProducts("unpublish")}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 font-bold text-ink"
                >
                  Ocultar selecionadas
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchUpdateProducts("feature")}
                  className="rounded-xl border border-brand bg-surface px-3 py-1.5 font-bold text-brand"
                >
                  Marcar destaque
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGroupIds([])}
                  className="px-2 py-1.5 font-semibold text-muted hover:text-ink"
                >
                  Limpar seleção
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-page text-muted uppercase">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredProducts.length > 0 &&
                          selectedGroupIds.length === filteredProducts.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroupIds(
                              filteredProducts.map((p) => p.retailGroupId),
                            );
                          } else {
                            setSelectedGroupIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="p-3">Mercadoria</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Preço</th>
                    <th className="p-3">Disponível / Físico</th>
                    <th className="p-3">Publicada</th>
                    <th className="p-3">Destaque</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredProducts.map((item) => {
                    const checked = selectedGroupIds.includes(
                      item.retailGroupId,
                    );
                    return (
                      <tr key={item.retailGroupId} className="hover:bg-page/60">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroupIds((prev) => [
                                  ...prev,
                                  item.retailGroupId,
                                ]);
                              } else {
                                setSelectedGroupIds((prev) =>
                                  prev.filter(
                                    (id) => id !== item.retailGroupId,
                                  ),
                                );
                              }
                            }}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <img
                                src={getFullUrl(item.imageUrl)}
                                alt={item.name}
                                className="h-10 w-10 rounded-xl object-cover border border-line"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-page text-muted">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-ink">
                                {item.commercialTitle || item.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-muted">
                                  /{item.publicSlug}
                                </span>
                                {item.missingPhoto && (
                                  <span className="rounded-md bg-support px-1.5 py-0.5 text-[10px] font-bold text-brand">
                                    Sem foto
                                  </span>
                                )}
                                {item.outOfStock && (
                                  <span className="rounded-md border border-line bg-page px-1.5 py-0.5 text-[10px] font-bold text-muted">
                                    Sem estoque
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-muted">{item.categoryName}</td>
                        <td className="p-3 font-bold text-ink">
                          {formatBRL(item.priceSell)}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-ink">
                            {item.availableStockTotal} un.
                          </span>{" "}
                          <span className="text-muted">
                            (físico: {item.physicalStockTotal}
                            {item.reservedStockTotal > 0
                              ? `, reservado: ${item.reservedStockTotal}`
                              : ""}
                            )
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickToggleProduct(item, {
                                visible: !item.visible,
                              })
                            }
                            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                              item.visible
                                ? "bg-brand text-on-brand"
                                : "border border-line bg-page text-muted"
                            }`}
                          >
                            {item.visible ? "Publicada" : "Oculta"}
                          </button>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickToggleProduct(item, {
                                featured: !item.featured,
                              })
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                              item.featured
                                ? "bg-support text-brand border border-brand"
                                : "border border-line bg-page text-muted"
                            }`}
                          >
                            <Star className="h-3.5 w-3.5" />
                            {item.featured ? "Destaque" : "Normal"}
                          </button>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => setEditingProduct({ ...item })}
                            className="inline-flex items-center gap-1 rounded-xl border border-line bg-page px-3 py-1.5 text-xs font-bold text-ink hover:border-brand"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Editar vitrine
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-sm text-muted"
                      >
                        Nenhuma mercadoria encontrada para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal de edição comercial do produto */}
          {editingProduct && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-4 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
            >
              <form
                onSubmit={handleSaveProductModal}
                className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-ink">
                    Apresentação na Vitrine: {editingProduct.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="text-xs font-bold text-muted hover:text-ink"
                  >
                    Fechar
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Nome comercial na loja virtual (opcional)
                  </label>
                  <input
                    type="text"
                    value={editingProduct.commercialTitle || ""}
                    onChange={(e) =>
                      setEditingProduct((prev: any) => ({
                        ...prev,
                        commercialTitle: e.target.value,
                      }))
                    }
                    placeholder={editingProduct.name}
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Slug público do produto
                  </label>
                  <input
                    type="text"
                    value={editingProduct.publicSlug || ""}
                    onChange={(e) =>
                      setEditingProduct((prev: any) => ({
                        ...prev,
                        publicSlug: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Descrição comercial para o consumidor
                  </label>
                  <textarea
                    rows={4}
                    value={editingProduct.commercialDescription || ""}
                    onChange={(e) =>
                      setEditingProduct((prev: any) => ({
                        ...prev,
                        commercialDescription: e.target.value,
                      }))
                    }
                    placeholder="Descreva tecido, caimento, diferenciais ou instruções de uso..."
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 rounded-xl border border-line bg-page p-3 text-xs font-bold text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.visible)}
                      onChange={(e) =>
                        setEditingProduct((prev: any) => ({
                          ...prev,
                          visible: e.target.checked,
                        }))
                      }
                    />
                    Publicar
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-line bg-page p-3 text-xs font-bold text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.featured)}
                      onChange={(e) =>
                        setEditingProduct((prev: any) => ({
                          ...prev,
                          featured: e.target.checked,
                        }))
                      }
                    />
                    Destaque
                  </label>
                  <div>
                    <label className="block text-[11px] font-bold text-muted mb-1">
                      Ordem
                    </label>
                    <input
                      type="number"
                      value={editingProduct.sortOrder ?? 0}
                      onChange={(e) =>
                        setEditingProduct((prev: any) => ({
                          ...prev,
                          sortOrder: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-page px-3 py-1.5 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="rounded-xl border border-line bg-page px-4 py-2 text-xs font-bold text-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand"
                  >
                    {savingProduct ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 4. ABA CATEGORIAS */}
      {activeTab === "categorias" && (
        <div className="space-y-4">
          <form
            onSubmit={handleCreateCategory}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4"
          >
            <FolderKanban className="h-5 w-5 text-brand" />
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Criar nova categoria de mercadorias..."
              className="flex-1 min-w-[220px] rounded-xl border border-line bg-page px-3.5 py-2 text-xs text-ink"
            />
            <button
              type="submit"
              disabled={creatingCategory || !newCategoryName.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creatingCategory ? "Criando..." : "Nova Categoria"}
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-page text-muted uppercase">
                <tr>
                  <th className="p-3">Categoria no PDV</th>
                  <th className="p-3">Nome de Exibição na Loja</th>
                  <th className="p-3">Ordem</th>
                  <th className="p-3">Visibilidade</th>
                  <th className="p-3">Destaque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {catalogCategories.map((cat) => (
                  <tr key={cat.categoryId} className="hover:bg-page/60">
                    <td className="p-3 font-bold text-ink">{cat.name}</td>
                    <td className="p-3">
                      <input
                        type="text"
                        defaultValue={cat.displayName || cat.name}
                        onBlur={(e) => {
                          if (e.target.value !== (cat.displayName || cat.name)) {
                            handleUpdateCategory(cat, {
                              displayName: e.target.value,
                            });
                          }
                        }}
                        className="w-full max-w-xs rounded-xl border border-line bg-page px-3 py-1.5 text-xs text-ink"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        defaultValue={cat.sortOrder ?? 0}
                        onBlur={(e) => {
                          const val = Number(e.target.value) || 0;
                          if (val !== cat.sortOrder) {
                            handleUpdateCategory(cat, { sortOrder: val });
                          }
                        }}
                        className="w-20 rounded-xl border border-line bg-page px-2.5 py-1.5 text-xs text-ink"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateCategory(cat, {
                            visible: !cat.visible,
                          })
                        }
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          cat.visible
                            ? "bg-brand text-on-brand"
                            : "border border-line bg-page text-muted"
                        }`}
                      >
                        {cat.visible ? "Visível" : "Oculta"}
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateCategory(cat, { featured: !cat.featured })
                        }
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          cat.featured
                            ? "border border-brand bg-support text-brand"
                            : "border border-line bg-page text-muted"
                        }`}
                      >
                        {cat.featured ? "Em destaque" : "Padrão"}
                      </button>
                    </td>
                  </tr>
                ))}
                {catalogCategories.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-sm text-muted"
                    >
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. ABA PEDIDOS */}
      {activeTab === "pedidos" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Código do pedido, cliente ou telefone..."
                  className="w-full rounded-xl border border-line bg-page py-2 pl-9 pr-3 text-xs text-ink"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="rounded-xl border border-line bg-page px-3 py-2 text-xs font-bold text-ink"
              >
                <option value="">Todos os status ({ordersTotal})</option>
                <option value="AWAITING_CONFIRMATION">
                  Aguardando confirmação
                </option>
                <option value="CONFIRMED">Confirmados</option>
                <option value="COMPLETED">Convertidos em venda</option>
                <option value="EXPIRED">Expirados</option>
                <option value="CANCELLED">Cancelados</option>
                <option value="REJECTED">Recusados</option>
              </select>
              <button
                type="button"
                onClick={loadAll}
                className="inline-flex items-center gap-1 rounded-xl border border-line bg-page px-3 py-2 text-xs font-bold text-ink hover:border-brand"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>
            </div>

            <div className="space-y-2.5">
              {orders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => handleOpenOrderDetail(ord.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      isSelected
                        ? "border-brand bg-support/50"
                        : "border-line bg-surface hover:border-brand"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-ink">
                          {ord.reference}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            ord.commercialStatus === "COMPLETED"
                              ? "bg-brand text-on-brand"
                              : ord.commercialStatus ===
                                    "AWAITING_CONFIRMATION" ||
                                  ord.commercialStatus === "CONFIRMED"
                                ? "border border-brand bg-support text-brand"
                                : "border border-line bg-page text-muted"
                          }`}
                        >
                          {COMMERCIAL_STATUS_LABELS[ord.commercialStatus] ||
                            ord.commercialStatus}
                        </span>
                        {ord.offlineConflictDetected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-on-brand">
                            <AlertTriangle className="h-3 w-3" />
                            Conflito de estoque
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-extrabold text-brand">
                        {formatBRL(Number(ord.total || 0))}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <div>
                        <strong className="text-ink">{ord.customerName}</strong>{" "}
                        · {ord.customerPhone}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>
                          {ord.fulfillmentMode === "DELIVERY"
                            ? "Entrega a combinar"
                            : "Retirada na loja"}
                        </span>
                        <span>·</span>
                        <span>{formatDateTime(ord.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {orders.length === 0 && (
                <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
                  Nenhum pedido encontrado.
                </div>
              )}
            </div>
          </div>

          {/* Detalhe do Pedido Selecionado */}
          <div className="lg:col-span-5">
            {loadingOrderDetail ? (
              <div className="rounded-2xl border border-line bg-surface p-6 text-xs text-muted">
                Carregando detalhes do pedido...
              </div>
            ) : selectedOrder ? (
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4 sticky top-4">
                <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-ink">
                        Pedido {selectedOrder.reference}
                      </h3>
                      <span className="rounded-full border border-brand bg-support px-2.5 py-0.5 text-[11px] font-bold text-brand">
                        {COMMERCIAL_STATUS_LABELS[
                          selectedOrder.commercialStatus
                        ] || selectedOrder.commercialStatus}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Registrado em {formatDateTime(selectedOrder.createdAt)}
                    </p>
                  </div>
                  {selectedOrder.customerWhatsappUrl && (
                    <a
                      href={selectedOrder.customerWhatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-on-brand"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Chamar no WhatsApp
                    </a>
                  )}
                </div>

                {selectedOrder.offlineConflictDetected && (
                  <div className="rounded-xl border border-brand bg-support p-3 text-xs text-ink">
                    <div className="font-bold text-brand flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Atenção: Conflito de Estoque Detectado
                    </div>
                    <p className="mt-1">
                      {selectedOrder.offlineConflictNote ||
                        "Uma venda de contingência/estoque negativo no PDV utilizou parte do estoque reservado. Confira a disponibilidade física antes de converter em venda."}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-page p-3 text-xs">
                  <div>
                    <span className="text-muted block">Consumidor</span>
                    <strong className="text-ink">
                      {selectedOrder.customerName}
                    </strong>
                    <div className="text-muted">
                      {selectedOrder.customerPhone}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted block">Modalidade</span>
                    <strong className="text-ink flex items-center gap-1">
                      {selectedOrder.fulfillmentMode === "DELIVERY" ? (
                        <>
                          <Truck className="h-3.5 w-3.5 text-brand" />
                          Entrega a combinar
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3.5 w-3.5 text-brand" />
                          Retirada na loja
                        </>
                      )}
                    </strong>
                    {selectedOrder.deliveryAddress && (
                      <div className="text-muted mt-0.5">
                        {[
                          selectedOrder.deliveryAddress.street,
                          selectedOrder.deliveryAddress.number,
                          selectedOrder.deliveryAddress.neighborhood,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Andamento de separação/entrega */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Andamento da Retirada / Entrega
                  </label>
                  <select
                    value={
                      selectedOrder.fulfillmentStatus || "WAITING_SEPARATION"
                    }
                    onChange={(e) =>
                      handleFulfillmentStatusChange(
                        selectedOrder.id,
                        e.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs font-bold text-ink"
                  >
                    {Object.entries(FULFILLMENT_STATUS_LABELS).map(
                      ([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {/* Itens do pedido */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Itens do Pedido (Snapshot)
                  </h4>
                  <div className="divide-y divide-line rounded-xl border border-line bg-page">
                    {(selectedOrder.items || []).map((it: any) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between p-2.5 text-xs"
                      >
                        <div>
                          <div className="font-bold text-ink">
                            {it.quantity}x {it.productName}
                          </div>
                          <div className="text-muted">
                            {[
                              it.size ? `Tam: ${it.size}` : null,
                              it.color ? `Cor: ${it.color}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}{" "}
                            · {formatBRL(Number(it.priceUnit || 0))} un.
                          </div>
                        </div>
                        <div className="font-bold text-ink">
                          {formatBRL(Number(it.subtotal || 0))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 text-sm font-extrabold text-ink">
                    <span>Total do Pedido</span>
                    <span className="text-brand">
                      {formatBRL(Number(selectedOrder.total || 0))}
                    </span>
                  </div>
                </div>

                {/* Ações Comerciais */}
                {(selectedOrder.commercialStatus === "AWAITING_CONFIRMATION" ||
                  selectedOrder.commercialStatus === "CONFIRMED") && (
                  <div className="space-y-2 pt-2 border-t border-line">
                    <div className="grid grid-cols-2 gap-2">
                      {selectedOrder.commercialStatus ===
                        "AWAITING_CONFIRMATION" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOrderAction(selectedOrder.id, "confirm")
                          }
                          className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand bg-support px-3 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Confirmar pedido (estender reserva)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConvertModalOpen(true)}
                        className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-on-brand shadow-sm"
                      >
                        <HandCoins className="h-4 w-4" />
                        Converter em Venda no PDV
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleOrderAction(
                            selectedOrder.id,
                            "cancel",
                            "Cancelado pelo painel da loja",
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-line bg-page px-3 py-2 text-xs font-bold text-muted hover:text-ink"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancelar pedido
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleOrderAction(
                            selectedOrder.id,
                            "reject",
                            "Recusado pela loja",
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-line bg-page px-3 py-2 text-xs font-bold text-muted hover:text-ink"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                )}

                {selectedOrder.saleId && (
                  <div className="rounded-xl border border-brand bg-support p-3 text-xs text-ink">
                    <div className="font-bold text-brand flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Venda Vinculada no PDV
                    </div>
                    <p className="mt-1">
                      ID da Venda: <strong>{selectedOrder.saleId}</strong>
                    </p>
                  </div>
                )}

                {/* Histórico de Eventos */}
                {(selectedOrder.events || []).length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-line">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                      Histórico auditável
                    </h4>
                    <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-muted">
                      {selectedOrder.events.map((ev: any) => (
                        <div
                          key={ev.id}
                          className="flex items-start justify-between gap-2"
                        >
                          <span className="text-ink">
                            {ev.reason || ev.eventType}
                          </span>
                          <span className="shrink-0">
                            {formatDateTime(ev.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-muted">
                Selecione um pedido na lista ao lado para visualizar os itens,
                reservas de estoque e converter em venda.
              </div>
            )}
          </div>

          {/* Modal Converter Pedido em Venda */}
          {convertModalOpen && selectedOrder && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-4 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
            >
              <form
                onSubmit={handleConvertToSale}
                className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4"
              >
                <h3 className="text-base font-extrabold text-ink">
                  Converter Pedido {selectedOrder.reference} em Venda
                </h3>
                <p className="text-xs text-muted">
                  A reserva de estoque será consumida na mesma transação da
                  venda, sem duplicar a baixa física. É necessário estar com o
                  caixa aberto.
                </p>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Forma de Pagamento Recebida
                  </label>
                  <select
                    value={convertPaymentMethod}
                    onChange={(e) => setConvertPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs font-bold text-ink"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Desconto concedido (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={convertDiscount}
                    onChange={(e) => setConvertDiscount(e.target.value)}
                    className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                  />
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-line bg-page p-3 text-xs font-bold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={convertEmitNfce}
                    onChange={(e) => setConvertEmitNfce(e.target.checked)}
                  />
                  Emitir NFC-e automaticamente após registrar a venda
                </label>

                <div className="flex items-center justify-between rounded-xl bg-support p-3 text-xs font-bold text-ink">
                  <span>Valor líquido da venda</span>
                  <span className="text-sm text-brand">
                    {formatBRL(
                      Math.max(
                        0,
                        Number(selectedOrder.total || 0) -
                          (Number(convertDiscount) || 0),
                      ),
                    )}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConvertModalOpen(false)}
                    className="rounded-xl border border-line bg-page px-4 py-2 text-xs font-bold text-ink"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={convertingSale}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand"
                  >
                    {convertingSale
                      ? "Registrando venda..."
                      : "Confirmar Venda no PDV"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 6. ABA CONFIGURAÇÕES */}
      {activeTab === "configuracoes" && (
        <form
          onSubmit={handleSaveSettings}
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Store className="h-4 w-4 text-brand" />
              Identidade e Endereço Público
            </h3>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Endereço público da loja (slug)
              </label>
              <div className="flex items-center rounded-xl border border-line bg-page px-3 py-2 text-xs">
                <span className="text-muted select-none">/loja/</span>
                <input
                  type="text"
                  value={settingsForm.slug}
                  onChange={(e) =>
                    setSettingsForm((prev: any) => ({
                      ...prev,
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    }))
                  }
                  placeholder="nome-da-sua-loja"
                  className="flex-1 bg-transparent font-bold text-ink focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Único no sistema. Use apenas letras minúsculas, números e hífen.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Nome público da loja
              </label>
              <input
                type="text"
                value={settingsForm.storeName}
                onChange={(e) =>
                  setSettingsForm((prev: any) => ({
                    ...prev,
                    storeName: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Slogan / Frase curta
              </label>
              <input
                type="text"
                value={settingsForm.tagline}
                onChange={(e) =>
                  setSettingsForm((prev: any) => ({
                    ...prev,
                    tagline: e.target.value,
                  }))
                }
                placeholder="Moda, estilo e atendimento direto pelo WhatsApp"
                className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  WhatsApp de Pedidos (com DDD)
                </label>
                <input
                  type="text"
                  value={settingsForm.whatsappPhone}
                  onChange={(e) =>
                    setSettingsForm((prev: any) => ({
                      ...prev,
                      whatsappPhone: e.target.value,
                    }))
                  }
                  placeholder="5511999999999"
                  className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Saudação inicial do WhatsApp
                </label>
                <input
                  type="text"
                  value={settingsForm.whatsappMessageIntro}
                  onChange={(e) =>
                    setSettingsForm((prev: any) => ({
                      ...prev,
                      whatsappMessageIntro: e.target.value,
                    }))
                  }
                  placeholder="Olá! Gostaria de confirmar meu pedido:"
                  className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-line">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Logo da Loja (URL ou Upload)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settingsForm.logoUrl}
                    onChange={(e) =>
                      setSettingsForm((prev: any) => ({
                        ...prev,
                        logoUrl: e.target.value,
                      }))
                    }
                    placeholder="/api/products/uploads/images/..."
                    className="flex-1 rounded-xl border border-line bg-page px-3 py-1.5 text-xs text-ink"
                  />
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-line bg-page px-2.5 py-1.5 text-xs font-bold text-ink hover:border-brand">
                    <Upload className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, "logoUrl");
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Imagem de Capa (URL ou Upload)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settingsForm.coverUrl}
                    onChange={(e) =>
                      setSettingsForm((prev: any) => ({
                        ...prev,
                        coverUrl: e.target.value,
                      }))
                    }
                    placeholder="/api/products/uploads/images/..."
                    className="flex-1 rounded-xl border border-line bg-page px-3 py-1.5 text-xs text-ink"
                  />
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-line bg-page px-2.5 py-1.5 text-xs font-bold text-ink hover:border-brand">
                    <Upload className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f, "coverUrl");
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Truck className="h-4 w-4 text-brand" />
              Retirada, Entrega a Combinar e Reservas
            </h3>

            <div className="space-y-3 rounded-xl border border-line bg-page p-3.5">
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.pickupEnabled}
                  onChange={(e) =>
                    setSettingsForm((prev: any) => ({
                      ...prev,
                      pickupEnabled: e.target.checked,
                    }))
                  }
                />
                Permitir Retirada na Loja
              </label>
              <input
                type="text"
                value={settingsForm.pickupInstructions}
                onChange={(e) =>
                  setSettingsForm((prev: any) => ({
                    ...prev,
                    pickupInstructions: e.target.value,
                  }))
                }
                placeholder="Endereço, horário e orientações para retirada na loja"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink"
              />
            </div>

            <div className="space-y-3 rounded-xl border border-line bg-page p-3.5">
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.deliveryEnabled}
                  onChange={(e) =>
                    setSettingsForm((prev: any) => ({
                      ...prev,
                      deliveryEnabled: e.target.checked,
                    }))
                  }
                />
                Permitir Entrega a Combinar
              </label>
              <input
                type="text"
                value={settingsForm.deliveryFeeNote}
                onChange={(e) =>
                  setSettingsForm((prev: any) => ({
                    ...prev,
                    deliveryFeeNote: e.target.value,
                  }))
                }
                placeholder="Nota sobre taxa e regiões atendidas (Ex.: Frete a combinar pelo WhatsApp)"
                className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink"
              />
              <input
                type="text"
                value={settingsForm.deliveryInstructions}
                onChange={(e) =>
                  setSettingsForm((prev: any) => ({
                    ...prev,
                    deliveryInstructions: e.target.value,
                  }))
                }
                placeholder="Orientação de entrega para o consumidor"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Prazo da reserva inicial (5 a 120 min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={settingsForm.confirmReservationMinutes}
                  onChange={(e) =>
                    setSettingsForm((prev: any) => ({
                      ...prev,
                      confirmReservationMinutes: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Prazo após confirmar (1 a 168 horas)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={settingsForm.confirmedHoldHours}
                  onChange={(e) =>
                    setSettingsForm((prev: any) => ({
                      ...prev,
                      confirmedHoldHours: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-line bg-page px-3 py-2 text-xs text-ink"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-on-brand shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                {savingSettings
                  ? "Salvando configurações..."
                  : "Salvar Configurações"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
export default RetailStorefrontPage;
