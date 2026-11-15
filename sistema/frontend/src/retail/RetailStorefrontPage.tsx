import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageCircle,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '@/lib/api';
import { getFullUrl } from '@/lib/getFullUrl';
import PdvLojistaLoader from '@/components/PdvLojistaLoader';
import { CategoryIconBadge } from '@/components/CategoryIcons';
import { RetailSelect } from '@/components/ui/Select';
import { RetailSwitch } from '@/components/ui/Switch';
import { SF_VIEW_TRANSITION } from '@/storefront/storefront-motion';
import { StorefrontProductFrame } from '@/storefront/components/StorefrontProductFrame';
import { RetailDialog } from './RetailDialog';
import {
  StorefrontExpressDeliveryTab,
  StorefrontOrderExpressDispatchCard,
} from './StorefrontExpressDeliveryTab';
import {
  StorefrontCollectionsManager,
  StorefrontVisualStudio,
  computePrePublishChanges,
  computeThemeWarnings,
  normalizeDraftTheme,
  syncThemeBanners,
} from './StorefrontVisualStudio';
import { apiError, money } from './types';
import { OperatorInlineBadge, StockItemThumb } from '@/components/EntityPhotos';
import { useShift } from '@/contexts/ShiftContext';
import { useAuthStore } from '@/store/auth';

type TabKey =
  | 'overview'
  | 'settings'
  | 'appearance'
  | 'products'
  | 'categories'
  | 'orders'
  | 'delivery';

const COMMERCIAL_STATUS_LABELS: Record<string, string> = {
  AWAITING_CONFIRMATION: 'Aguardando confirmação',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Convertido em venda',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Reserva expirada',
};

const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  WAITING_SEPARATION: 'Aguardando separação',
  PREPARING: 'Em preparação / separação',
  READY_FOR_PICKUP: 'Pronto para retirada',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue ao cliente',
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Reserva ativa',
  CONSUMED: 'Consumida na venda',
  RELEASED: 'Estoque liberado',
  EXPIRED: 'Expirada',
};

const BADGE_PRESETS = [
  'Lançamento',
  'Mais Vendido',
  'Últimas Peças',
  'Promoção',
  'Exclusivo',
  'Coleção Nova',
];

const RESERVATION_TTL_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '4 horas', value: 240 },
  { label: '24 horas', value: 1440 },
];

const CANCEL_REASON_PRESETS = [
  'Cliente desistiu ou solicitou cancelamento',
  'Sem retorno de confirmação no WhatsApp',
  'Peça com divergência física na separação',
  'Pedido duplicado pelo cliente',
];

function normalizeAdminProduct(p: any) {
  const id = p.id || p.retailGroupId;
  const isVisible = p.isVisible !== undefined ? Boolean(p.isVisible) : Boolean(p.visible);
  const displayTitle = p.displayTitle ?? p.commercialTitle ?? '';
  const customDescription = p.customDescription ?? p.commercialDescription ?? '';
  const priceSale = Number(p.priceSale ?? p.priceSell ?? p.price ?? 0);
  const availableStock = Number(p.availableStock ?? p.availableStockTotal ?? 0);
  const reservedStock = Number(p.reservedStock ?? p.reservedStockTotal ?? 0);
  return {
    ...p,
    id,
    retailGroupId: p.retailGroupId || id,
    isVisible,
    visible: isVisible,
    displayTitle,
    commercialTitle: displayTitle,
    customDescription,
    commercialDescription: customDescription,
    priceSale,
    priceSell: priceSale,
    availableStock,
    availableStockTotal: availableStock,
    reservedStock,
    reservedStockTotal: reservedStock,
  };
}

function normalizeAdminCategory(c: any) {
  const id = c.id || c.categoryId;
  const isVisible = c.isVisible !== undefined ? Boolean(c.isVisible) : c.visible !== false;
  const publicSlug = c.publicSlug || c.slug || '';
  const productCount = Number(c.productCount ?? c.groupsCount ?? 0);
  return {
    ...c,
    id,
    categoryId: id,
    isVisible,
    visible: isVisible,
    publicSlug,
    slug: publicSlug,
    productCount,
    groupsCount: productCount,
  };
}

function normalizeAdminOrder(o: any) {
  const deliveryAddr = o.deliveryAddress && typeof o.deliveryAddress === 'object' ? o.deliveryAddress : {};
  const mode = o.deliveryMode || o.fulfillmentMode || 'PICKUP';
  return {
    ...o,
    whatsappUrl: o.whatsappUrl || o.customerWhatsappUrl || null,
    deliveryMode: mode,
    fulfillmentMode: mode,
    customerDocument: o.customerDocument || o.customerCpf || null,
    addressLine: o.addressLine || deliveryAddr.street || null,
    addressNumber: o.addressNumber || deliveryAddr.number || null,
    addressComplement: o.addressComplement || deliveryAddr.complement || null,
    neighborhood: o.neighborhood || deliveryAddr.neighborhood || null,
    city: o.city || deliveryAddr.city || null,
    state: o.state || deliveryAddr.state || null,
    zipCode: o.zipCode || deliveryAddr.zipCode || null,
  };
}

function formatPhoneMask(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 13);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

function formatRemainingReservation(expiresAtIso?: string | null): string | null {
  if (!expiresAtIso) return null;
  const diff = new Date(expiresAtIso).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'Prazo vencido';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${String(remMins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function RetailStorefrontPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { operator: shiftOperator } = useShift();
  const authUser = useAuthStore((s) => s.user);

  const activeTab: TabKey = useMemo(() => {
    const p = location.pathname;
    if (p.includes('/loja-virtual/entregas')) return 'delivery';
    if (p.includes('/loja-virtual/configuracoes')) return 'settings';
    if (p.includes('/loja-virtual/aparencia')) return 'appearance';
    if (p.includes('/loja-virtual/produtos')) return 'products';
    if (p.includes('/loja-virtual/categorias')) return 'categories';
    if (p.includes('/loja-virtual/pedidos')) return 'orders';
    return 'overview';
  }, [location.pathname]);

  const setTab = (tab: TabKey) => {
    const routes: Record<TabKey, string> = {
      overview: '/loja-virtual',
      orders: '/loja-virtual/pedidos',
      delivery: '/loja-virtual/entregas',
      products: '/loja-virtual/produtos',
      categories: '/loja-virtual/categorias',
      appearance: '/loja-virtual/aparencia',
      settings: '/loja-virtual/configuracoes',
    };
    navigate(routes[tab]);
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const actionLockRef = useRef<Record<string, boolean>>({});

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    storeName: '',
    slug: '',
    tagline: '',
    description: '',
    whatsappPhone: '',
    address: '',
    businessHours: '',
    logoUrl: '',
    coverUrl: '',
    pickupEnabled: true,
    deliveryEnabled: false,
    deliveryFeeDefault: '0',
    pickupInstructions: '',
    deliveryNotes: '',
    reservationTtlMinutes: '30',
  });

  // Appearance draft state
  const [draftTheme, setDraftTheme] = useState<any>(() => normalizeDraftTheme(null));
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>(
    'desktop',
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    'sec-hero',
  );

  // Products & Curated Collections state
  const [productsSubView, setProductsSubView] = useState<
    'catalog' | 'collections'
  >('catalog');
  const [products, setProducts] = useState<any[]>([]);
  const [, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productVisibilityFilter, setProductVisibilityFilter] = useState<
    'all' | 'visible' | 'hidden' | 'featured' | 'out_of_stock'
  >('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [uploadingGalleryPhoto, setUploadingGalleryPhoto] = useState(false);

  // Categories state
  const [categories, setCategories] = useState<any[]>([]);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('');
  const [orderFulfillmentFilter, setOrderFulfillmentFilter] =
    useState<string>('');
  const [orderSearch, setOrderSearch] = useState('');
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    const orderId = selectedOrder?.id;
    if (!orderId || Array.isArray(selectedOrder?.events)) return;
    let cancelled = false;
    api
      .get(`/storefront/admin/orders/${orderId}`)
      .then((res) => {
        if (!cancelled && res.data?.id === orderId) {
          setSelectedOrder(normalizeAdminOrder(res.data));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedOrder?.id, selectedOrder?.events]);

  // Dialog de Conversão em Venda no PDV
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState('Pix');
  const [convertCustomerDoc, setConvertCustomerDoc] = useState('');
  const [convertObservation, setConvertObservation] = useState('');

  // Dialog de Cancelamento / Recusa de Pedido
  const [orderActionModal, setOrderActionModal] = useState<{
    order: any;
    action: 'cancel' | 'reject';
  } | null>(null);
  const [orderActionReason, setOrderActionReason] = useState('');

  // Timer para contadores regressivos de reserva
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  // Debounce da busca de pedidos
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedOrderSearch(orderSearch.trim());
    }, 280);
    return () => window.clearTimeout(t);
  }, [orderSearch]);

  const applyOverviewData = useCallback(
    (
      ovData: any,
      opts: { syncSettings?: boolean; syncDraft?: boolean } = {},
    ) => {
      const { syncSettings = true, syncDraft = true } = opts;
      setOverview(ovData);
      const cfg = ovData?.config || ovData?.settings;
      if (cfg) {
        if (syncSettings) {
          setSettingsForm({
            storeName: cfg.storeName || '',
            slug: cfg.slug || '',
            tagline: cfg.tagline || '',
            description: cfg.description || '',
            whatsappPhone: cfg.whatsappPhone || '',
            address: cfg.address || '',
            businessHours: cfg.businessHours || '',
            logoUrl: cfg.logoUrl || '',
            coverUrl: cfg.coverUrl || '',
            pickupEnabled: cfg.pickupEnabled !== false,
            deliveryEnabled: Boolean(cfg.deliveryEnabled),
            deliveryFeeDefault: String(cfg.deliveryFeeDefault ?? '0'),
            pickupInstructions: cfg.pickupInstructions || '',
            deliveryNotes: cfg.deliveryNotes || cfg.deliveryInstructions || '',
            reservationTtlMinutes: String(
              cfg.reservationTtlMinutes ??
                cfg.confirmReservationMinutes ??
                '30',
            ),
          });
        }
        if (syncDraft) {
          const rawTheme =
            cfg.draftTheme || cfg.draftThemeJson || cfg.publishedTheme;
          setDraftTheme(normalizeDraftTheme(rawTheme));
        }
      }
    },
    [],
  );

  // Carregamento inicial completo
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, prodRes, catRes, ordRes, pmRes] = await Promise.all([
        api.get('/storefront/admin/overview'),
        api.get('/storefront/admin/products', {
          params: { visibility: 'all' },
        }),
        api.get('/storefront/admin/categories'),
        api.get('/storefront/admin/orders', { params: { limit: 50 } }),
        api.get('/payment-methods').catch(() => ({ data: [] })),
      ]);

      applyOverviewData(ovRes.data, { syncSettings: true, syncDraft: true });
      const rawProds = Array.isArray(prodRes.data) ? prodRes.data : [];
      setProducts(rawProds.map(normalizeAdminProduct));
      const rawCats = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(rawCats.map(normalizeAdminCategory));
      const rawOrders = ordRes.data?.items || ordRes.data?.data || [];
      setOrders(Array.isArray(rawOrders) ? rawOrders.map(normalizeAdminOrder) : []);

      const pms = Array.isArray(pmRes.data)
        ? pmRes.data.filter((m: any) => m.isActive !== false)
        : [];
      setPaymentMethods(pms);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao carregar dados da Loja Virtual.'));
    } finally {
      setLoading(false);
    }
  }, [applyOverviewData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Recarregamento isolado de pedidos quando filtros mudam
  const loadOrdersOnly = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const [ordRes, ovRes] = await Promise.all([
        api.get('/storefront/admin/orders', {
          params: {
            commercialStatus: orderStatusFilter || undefined,
            fulfillmentStatus: orderFulfillmentFilter || undefined,
            search: debouncedOrderSearch || undefined,
            limit: 60,
          },
        }),
        api.get('/storefront/admin/overview'),
      ]);
      const rawItems = ordRes.data?.items || ordRes.data?.data || [];
      const items = Array.isArray(rawItems) ? rawItems.map(normalizeAdminOrder) : [];
      setOrders(items);
      setOverview(ovRes.data);
      if (selectedOrder) {
        const updated = items.find((o: any) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      toast.error(apiError(err, 'Erro ao filtrar pedidos.'));
    } finally {
      setLoadingOrders(false);
    }
  }, [
    orderStatusFilter,
    orderFulfillmentFilter,
    debouncedOrderSearch,
    selectedOrder,
  ]);

  useEffect(() => {
    if (!loading) {
      loadOrdersOnly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter, orderFulfillmentFilter, debouncedOrderSearch]);

  // Recarregamento leve de produtos e overview
  const refreshProductsAndOverview = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const [prodRes, ovRes] = await Promise.all([
        api.get('/storefront/admin/products', {
          params: { visibility: 'all' },
        }),
        api.get('/storefront/admin/overview'),
      ]);
      const rawProds = Array.isArray(prodRes.data) ? prodRes.data : [];
      setProducts(rawProds.map(normalizeAdminProduct));
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao atualizar lista de produtos.'));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const publicStoreUrl = useMemo(() => {
    const slug =
      overview?.config?.slug ||
      overview?.settings?.slug ||
      settingsForm.slug ||
      'minha-loja';
    return `${window.location.origin}/loja/${slug}`;
  }, [overview?.config?.slug, overview?.settings?.slug, settingsForm.slug]);

  const buildSettingsPayload = () => ({
    ...settingsForm,
    deliveryFeeDefault: Number(settingsForm.deliveryFeeDefault || 0),
    reservationTtlMinutes: Number(settingsForm.reservationTtlMinutes || 30),
  });

  // 1. Salvar apenas Configurações operacionais (separado de rascunho e publicação)
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (actionLockRef.current.settings) return;
    actionLockRef.current.settings = true;
    setSavingSettings(true);
    try {
      await api.put('/storefront/admin/settings', buildSettingsPayload());
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data, { syncSettings: true, syncDraft: false });
      toast.success('Configurações operacionais salvas!');
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar configurações.'));
    } finally {
      actionLockRef.current.settings = false;
      setSavingSettings(false);
    }
  };

  // 2. Salvar apenas Rascunho visual (seções, banners, carrosséis, coleções e looks — sem publicar)
  const handleSaveDraftOnly = async () => {
    if (actionLockRef.current.draft) return;
    actionLockRef.current.draft = true;
    setSavingDraft(true);
    try {
      const payload = syncThemeBanners(draftTheme);
      await api.put('/storefront/admin/appearance/draft', payload);
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data, { syncSettings: false, syncDraft: true });
      toast.success('Rascunho salvo! A vitrine publicada não foi alterada.');
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar rascunho.'));
    } finally {
      actionLockRef.current.draft = false;
      setSavingDraft(false);
    }
  };

  // 3. Confirmar Publicação (após revisão do resumo de mudanças)
  const handleConfirmPublish = async () => {
    if (actionLockRef.current.publish) return;
    const phoneDigits = String(settingsForm.whatsappPhone || '').replace(
      /\D/g,
      '',
    );
    if (phoneDigits.length < 10) {
      toast.error(
        'Informe o WhatsApp de atendimento antes de publicar a loja.',
      );
      setShowPublishDialog(false);
      setTab('settings');
      return;
    }
    if (!settingsForm.pickupEnabled && !settingsForm.deliveryEnabled) {
      toast.error(
        'Habilite pelo menos uma modalidade (Retirada na loja ou Entrega) para publicar.',
      );
      setShowPublishDialog(false);
      setTab('settings');
      return;
    }

    actionLockRef.current.publish = true;
    setPublishing(true);
    try {
      const res = await api.post('/storefront/admin/appearance/publish', {
        settings: buildSettingsPayload(),
        draftTheme: syncThemeBanners(draftTheme),
      });
      toast.success(res.data?.message || 'Loja Virtual publicada no ar!');
      setShowPublishDialog(false);
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data, { syncSettings: true, syncDraft: true });
    } catch (err: any) {
      const msg = apiError(err, 'Não foi possível publicar a loja.');
      toast.error(msg);
      if (msg.toLowerCase().includes('produto')) {
        setShowPublishDialog(false);
        setTab('products');
      } else if (msg.toLowerCase().includes('whatsapp')) {
        setShowPublishDialog(false);
        setTab('settings');
      }
    } finally {
      actionLockRef.current.publish = false;
      setPublishing(false);
    }
  };

  // 4. Pausar e Reativar vitrine exatamente no mesmo slot de botão
  const handleToggleStorePauseOrReactivate = async (currentlyPublished: boolean) => {
    if (actionLockRef.current.visibility) return;
    actionLockRef.current.visibility = true;
    setTogglingVisibility(true);
    try {
      const endpoint = currentlyPublished
        ? '/storefront/admin/appearance/unpublish'
        : '/storefront/admin/appearance/reactivate';
      const res = await api.post(endpoint);
      toast.success(
        res.data?.message ||
          (currentlyPublished
            ? 'Vitrine pausada com sucesso.'
            : 'Vitrine reativada no ar!'),
      );
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data, { syncSettings: false, syncDraft: false });
    } catch (err) {
      toast.error(
        apiError(
          err,
          currentlyPublished
            ? 'Erro ao pausar vitrine.'
            : 'Erro ao reativar vitrine.',
        ),
      );
    } finally {
      actionLockRef.current.visibility = false;
      setTogglingVisibility(false);
    }
  };

  // Upload puro de arquivo (retorna URL sem sobrescrever configurações silenciosamente)
  const handleUploadMediaFile = useCallback(
    async (file: File): Promise<string | null> => {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await api.post('/storefront/admin/media/upload', fd);
        const imageUrl = res.data?.imageUrl || null;
        if (imageUrl) {
          toast.success('Imagem enviada!');
        }
        return imageUrl;
      } catch (err) {
        toast.error(apiError(err, 'Erro ao enviar imagem.'));
        return null;
      }
    },
    [],
  );

  // Upload de mídia na aba Configurações (atualiza formulário local para salvar em seguida)
  const handleUploadMedia = async (
    file: File,
    target: 'logoUrl' | 'coverUrl',
  ) => {
    const imageUrl = await handleUploadMediaFile(file);
    if (imageUrl) {
      setSettingsForm((prev) => ({
        ...prev,
        [target]: imageUrl,
      }));
    }
  };

  const handleUploadProductGalleryImage = async (file: File) => {
    if (!editingProduct) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploadingGalleryPhoto(true);
    try {
      const res = await api.post('/storefront/admin/media/upload', fd);
      const imageUrl = res.data?.imageUrl;
      if (imageUrl) {
        const currentGallery = Array.isArray(editingProduct.galleryUrls)
          ? editingProduct.galleryUrls
          : [];
        setEditingProduct({
          ...editingProduct,
          galleryUrls: [...currentGallery, imageUrl].slice(0, 6),
        });
        toast.success('Foto adicionada à galeria da peça!');
      }
    } catch (err) {
      toast.error(apiError(err, 'Erro ao enviar foto para a galeria.'));
    } finally {
      setUploadingGalleryPhoto(false);
    }
  };

  // Produtos: alternância rápida (efeito imediato na loja publicada) e ações em lote
  const handleQuickToggleProduct = async (
    product: any,
    field: 'isVisible' | 'featured',
  ) => {
    const lockKey = `prod-${product.id}-${field}`;
    if (actionLockRef.current[lockKey]) return;
    actionLockRef.current[lockKey] = true;

    const nextVal = !product[field];
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, [field]: nextVal } : p)),
    );
    try {
      await api.put(`/storefront/admin/products/${product.id}`, {
        isVisible: field === 'isVisible' ? nextVal : product.isVisible,
        featured: field === 'featured' ? nextVal : product.featured,
        publicSlug: product.publicSlug,
        displayTitle: product.displayTitle,
        customDescription: product.customDescription,
        badgeLabel: product.badgeLabel,
        galleryUrls: product.galleryUrls || [],
        sortOrder: product.sortOrder,
      });
      const ovRes = await api.get('/storefront/admin/overview');
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao atualizar produto.'));
      refreshProductsAndOverview();
    } finally {
      actionLockRef.current[lockKey] = false;
    }
  };

  const handleBatchProducts = async (
    action: 'show' | 'hide' | 'feature' | 'unfeature',
    explicitIds?: string[],
  ) => {
    if (actionLockRef.current.batch) return;
    const targetIds = explicitIds || selectedProductIds;
    if (targetIds.length === 0) {
      toast.info('Selecione ao menos um produto na tabela.');
      return;
    }
    actionLockRef.current.batch = true;
    setBatchBusy(true);
    try {
      const res = await api.post('/storefront/admin/products/batch', {
        retailGroupIds: targetIds,
        action,
      });
      const count = Number(res.data?.updatedCount || targetIds.length);
      const actionLabels: Record<typeof action, string> = {
        show: 'marcados como visíveis na loja',
        hide: 'ocultados da vitrine',
        feature: 'marcados como destaque',
        unfeature: 'removidos dos destaques',
      };
      if (!explicitIds) {
        // Preserva a seleção para o lojista conferir o resultado antes de limpá-la
        setBatchFeedback(
          `Resultado aplicado agora: ${count} produto(s) ${actionLabels[action]}. Confira a tabela ou clique em "Limpar seleção".`,
        );
      } else {
        toast.success(`${count} produto(s) ${actionLabels[action]}!`);
      }
      await refreshProductsAndOverview();
    } catch (err) {
      toast.error(apiError(err, 'Erro na atualização em lote.'));
    } finally {
      actionLockRef.current.batch = false;
      setBatchBusy(false);
    }
  };

  const handlePublishAllAvailableProducts = async () => {
    const eligibleIds = products
      .filter((p) => Number(p.availableStock || 0) > 0 && !p.isVisible)
      .map((p) => p.id);
    if (eligibleIds.length === 0) {
      const allWithStock = products
        .filter((p) => Number(p.availableStock || 0) > 0)
        .map((p) => p.id);
      if (allWithStock.length === 0) {
        toast.error(
          'Nenhum grupo de mercadoria possui saldo disponível em estoque no momento.',
        );
        return;
      }
      toast.info(
        'Todos os produtos com estoque já estão visíveis na vitrine!',
      );
      return;
    }
    await handleBatchProducts('show', eligibleIds);
  };

  const handleSaveProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || actionLockRef.current.productModal) return;
    actionLockRef.current.productModal = true;
    setSaving(true);
    try {
      await api.put(`/storefront/admin/products/${editingProduct.id}`, {
        isVisible: editingProduct.isVisible,
        featured: editingProduct.featured,
        publicSlug: editingProduct.publicSlug,
        displayTitle: editingProduct.displayTitle,
        customDescription: editingProduct.customDescription,
        badgeLabel: editingProduct.badgeLabel || null,
        galleryUrls: Array.isArray(editingProduct.galleryUrls)
          ? editingProduct.galleryUrls
          : [],
        sortOrder: Number(editingProduct.sortOrder || 0),
      });
      toast.success('Peça atualizada na vitrine (efeito imediato)!');
      setEditingProduct(null);
      await refreshProductsAndOverview();
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar peça.'));
    } finally {
      actionLockRef.current.productModal = false;
      setSaving(false);
    }
  };

  // Categorias (efeito imediato na loja publicada)
  const handleSaveCategories = async () => {
    if (actionLockRef.current.categories) return;
    actionLockRef.current.categories = true;
    setSavingCategories(true);
    try {
      await api.put('/storefront/admin/categories', {
        categories: categories.map((c, idx) => ({
          categoryId: c.id,
          isVisible: c.isVisible,
          publicSlug: c.publicSlug,
          description: c.description,
          sortOrder: idx * 10,
        })),
      });
      toast.success('Categorias atualizadas na vitrine (efeito imediato)!');
      const [catRes, ovRes] = await Promise.all([
        api.get('/storefront/admin/categories'),
        api.get('/storefront/admin/overview'),
      ]);
      const rawCats = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(rawCats.map(normalizeAdminCategory));
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar categorias.'));
    } finally {
      actionLockRef.current.categories = false;
      setSavingCategories(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || actionLockRef.current.createCategory) return;
    actionLockRef.current.createCategory = true;
    setSaving(true);
    try {
      await api.post('/storefront/admin/categories', {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        isVisible: true,
      });
      setNewCategoryName('');
      setNewCategoryDescription('');
      setShowNewCategoryDialog(false);
      toast.success('Categoria criada e adicionada à vitrine!');
      const [catRes, ovRes] = await Promise.all([
        api.get('/storefront/admin/categories'),
        api.get('/storefront/admin/overview'),
      ]);
      const rawCats = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(rawCats.map(normalizeAdminCategory));
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao criar categoria.'));
    } finally {
      actionLockRef.current.createCategory = false;
      setSaving(false);
    }
  };

  const moveCategoryOrder = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const next = [...categories];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setCategories(next);
  };

  // Pedidos: Ações Operacionais
  const handleConfirmOrder = async (orderId: string) => {
    setSaving(true);
    try {
      const res = await api.post(`/storefront/admin/orders/${orderId}/confirm`);
      toast.success('Pedido confirmado e reserva garantida!');
      setSelectedOrder(normalizeAdminOrder(res.data));
      await loadOrdersOnly();
    } catch (err) {
      toast.error(apiError(err, 'Erro ao confirmar pedido.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitOrderCancelOrReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderActionModal) return;
    const { order, action } = orderActionModal;
    setSaving(true);
    try {
      const res = await api.post(
        `/storefront/admin/orders/${order.id}/${action}`,
        {
          reason:
            orderActionReason.trim() ||
            (action === 'reject'
              ? 'Recusado pelo lojista no painel'
              : 'Cancelado pelo lojista no painel'),
        },
      );
      toast.success(
        action === 'reject'
          ? 'Pedido recusado e reserva de estoque liberada.'
          : 'Pedido cancelado e estoque devolvido.',
      );
      setOrderActionModal(null);
      setOrderActionReason('');
      setSelectedOrder(normalizeAdminOrder(res.data));
      await loadOrdersOnly();
    } catch (err) {
      toast.error(apiError(err, 'Erro ao processar cancelamento do pedido.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFulfillment = async (
    orderId: string,
    fulfillmentStatus: string,
  ) => {
    setSaving(true);
    try {
      const res = await api.put(
        `/storefront/admin/orders/${orderId}/fulfillment`,
        { fulfillmentStatus },
      );
      toast.success('Etapa de separação/entrega atualizada!');
      setSelectedOrder(normalizeAdminOrder(res.data));
      await loadOrdersOnly();
    } catch (err) {
      toast.error(apiError(err, 'Erro ao atualizar etapa de entrega.'));
    } finally {
      setSaving(false);
    }
  };

  const handleConvertOrderToSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const res = await api.post(
        `/storefront/admin/orders/${selectedOrder.id}/convert-to-sale`,
        {
          paymentMethodName: convertPaymentMethod,
          customerDocument: convertCustomerDoc.trim() || undefined,
          observation:
            convertObservation.trim() ||
            `Venda originada da Loja Virtual (${selectedOrder.reference})`,
        },
      );
      toast.success(
        `Venda concluída no PDV! Reserva consumida e financeiro registrado.`,
      );
      setShowConvertDialog(false);
      setSelectedOrder(
        res.data?.order ? normalizeAdminOrder(res.data.order) : null,
      );
      await Promise.all([loadOrdersOnly(), refreshProductsAndOverview()]);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao converter pedido em venda.'));
    } finally {
      setSaving(false);
    }
  };

  // Produtos filtrados localmente na aba Produtos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productCategoryFilter !== 'all' && p.categoryId !== productCategoryFilter) {
        return false;
      }
      if (productVisibilityFilter === 'visible' && !p.isVisible) return false;
      if (productVisibilityFilter === 'hidden' && p.isVisible) return false;
      if (productVisibilityFilter === 'featured' && !p.featured) return false;
      if (
        productVisibilityFilter === 'out_of_stock' &&
        Number(p.availableStock || 0) > 0
      ) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase();
        const matchName = String(p.name || '')
          .toLowerCase()
          .includes(q);
        const matchDisplay = String(p.displayTitle || '')
          .toLowerCase()
          .includes(q);
        const matchCat = String(p.categoryName || '')
          .toLowerCase()
          .includes(q);
        if (!matchName && !matchDisplay && !matchCat) return false;
      }
      return true;
    });
  }, [
    products,
    productCategoryFilter,
    productVisibilityFilter,
    productSearch,
  ]);

  // Dados completos e interativos para a prévia em iframe na aba Aparência
  const livePreviewStoreData = useMemo(() => {
    const visibleCats = categories
      .filter((c) => c.isVisible !== false)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.publicSlug || c.slug || c.id,
        description: c.description,
        productCount: c.productCount,
      }));

    const sourceProducts = products.some((p) => p.isVisible)
      ? products.filter((p) => p.isVisible)
      : products;

    const baseVisibleProducts = sourceProducts.map((p) => {
      const totalAvail = Number(p.availableStock ?? 0);
      const unitPrice = Number(p.priceSale ?? p.priceSell ?? 0);
      return {
        id: p.id,
        retailGroupId: p.retailGroupId || p.id,
        title: p.displayTitle || p.name,
        slug: p.publicSlug || p.id,
        description: p.customDescription || p.description,
        imageUrl: p.imageUrl,
        galleryUrls: Array.isArray(p.galleryUrls) ? p.galleryUrls : [],
        price: unitPrice,
        priceSell: unitPrice,
        badgeLabel: p.badgeLabel,
        featured: Boolean(p.featured),
        availableStock: totalAvail,
        totalAvailableStock: totalAvail,
        inStock: totalAvail > 0,
        sortOrder: Number(p.sortOrder ?? 0),
        categoryId: p.categoryId || null,
        categoryName: p.categoryName || '',
        category: p.categoryId
          ? {
              id: p.categoryId,
              name: p.categoryName,
              slug: p.categorySlug,
            }
          : null,
        variants: Array.isArray(p.variants) ? p.variants : [],
        sizes: Array.from(
          new Set(
            (p.variants || [])
              .map((v: any) => v.size)
              .filter(Boolean),
          ),
        ),
        colors: Array.from(
          new Set(
            (p.variants || [])
              .map((v: any) => v.color)
              .filter(Boolean),
          ),
        ),
      };
    });

    const allSizes = Array.from(
      new Set(baseVisibleProducts.flatMap((p) => p.sizes as string[])),
    );
    const allColors = Array.from(
      new Set(baseVisibleProducts.flatMap((p) => p.colors as string[])),
    );

    const normalizedDraft = normalizeDraftTheme(draftTheme);

    return {
      publicId:
        overview?.config?.publicId || overview?.settings?.publicId || 'preview',
      slug: settingsForm.slug || 'minha-loja',
      storeName: settingsForm.storeName || 'Minha Loja',
      tagline: settingsForm.tagline,
      description: settingsForm.description,
      logoUrl: settingsForm.logoUrl,
      coverUrl: settingsForm.coverUrl,
      whatsappPhone: settingsForm.whatsappPhone,
      address: settingsForm.address,
      businessHours: settingsForm.businessHours,
      pickupEnabled: settingsForm.pickupEnabled,
      deliveryEnabled: settingsForm.deliveryEnabled,
      deliveryFeeDefault: Number(settingsForm.deliveryFeeDefault || 0),
      pickupInstructions: settingsForm.pickupInstructions,
      deliveryInstructions: settingsForm.deliveryNotes,
      fulfillment: {
        pickupEnabled: settingsForm.pickupEnabled,
        deliveryEnabled: settingsForm.deliveryEnabled,
        deliveryFeeDefault: Number(settingsForm.deliveryFeeDefault || 0),
        pickupInstructions: settingsForm.pickupInstructions,
        deliveryNotes: settingsForm.deliveryNotes,
      },
      theme: normalizedDraft,
      collections: normalizedDraft.collections,
      categories: visibleCats,
      facets: {
        sizes: allSizes,
        colors: allColors,
      },
      featuredProducts: baseVisibleProducts
        .filter((p) => p.featured)
        .slice(0, 48),
      initialProducts: baseVisibleProducts,
      previewProducts: baseVisibleProducts,
    };
  }, [
    categories,
    products,
    overview?.config?.publicId,
    overview?.settings?.publicId,
    settingsForm,
    draftTheme,
  ]);

  const savedCfg = overview?.config || overview?.settings || null;
  const publishedThemeRaw =
    savedCfg?.publishedTheme || savedCfg?.publishedThemeJson || null;
  const publishedVersion = Number(savedCfg?.publishedVersion || 0);
  const hasEverPublished = Boolean(publishedVersion > 0 || publishedThemeRaw);

  const pendingPublishChanges = useMemo(
    () =>
      computePrePublishChanges(
        draftTheme,
        publishedThemeRaw,
        settingsForm,
        savedCfg,
      ),
    [draftTheme, publishedThemeRaw, settingsForm, savedCfg],
  );

  const curatorialWarnings = useMemo(
    () => computeThemeWarnings(draftTheme, products, categories),
    [draftTheme, products, categories],
  );

  const handleExposeCollectionInHome = useCallback(
    (col: any) => {
      const targetType = col.kind === 'look' ? 'look' : 'product_selection';
      let targetSecId = '';
      setDraftTheme((prev: any) => {
        const list = [...(prev.sections || [])];
        const existing = list.find(
          (s: any) =>
            s.type === targetType &&
            (s.collectionId === col.id || s.collectionId === col.slug),
        );
        if (existing) {
          targetSecId = existing.id;
          return syncThemeBanners({
            ...prev,
            sections: list.map((s: any) =>
              s.id === existing.id ? { ...s, enabled: true } : s,
            ),
          });
        }
        const stamp = Date.now().toString(36);
        targetSecId =
          targetType === 'look' ? `sec-look-${stamp}` : `sec-sel-${stamp}`;
        const catalogIdx = list.findIndex((s: any) => s.type === 'collection');
        const insertAt = catalogIdx >= 0 ? catalogIdx : list.length;
        const newSection =
          targetType === 'look'
            ? {
                id: targetSecId,
                type: 'look',
                enabled: true,
                title: col.title || 'Monte o look',
                subtitle: col.subtitle || '',
                collectionId: col.id,
                productIds: [],
              }
            : {
                id: targetSecId,
                type: 'product_selection',
                enabled: true,
                title: col.title || 'Seleção da coleção',
                subtitle: col.subtitle || '',
                presentation: 'carousel',
                sourceType: 'collection',
                collectionId: col.id,
                productIds: [],
                visibleCount: 12,
                columnsDesktop: 4,
                autoPlay: false,
              };
        list.splice(insertAt, 0, newSection);
        return syncThemeBanners({ ...prev, sections: list });
      });
      if (targetSecId) {
        setSelectedSectionId(targetSecId);
      }
      setTab('appearance');
      toast.success(`"${col.title}" adicionada à página inicial no editor!`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (loading && !overview) {
    return (
      <div className="py-20 flex justify-center">
        <PdvLojistaLoader label="Carregando módulo de Loja Virtual..." />
      </div>
    );
  }

  const isPublished = Boolean(
    overview?.config?.status === 'PUBLISHED' ||
      overview?.config?.isPublished ||
      overview?.settings?.isPublished,
  );
  const rawMetrics = overview?.metrics || overview?.stats || {};
  const metrics: Record<string, any> = {
    ...rawMetrics,
    awaitingConfirmationCount:
      rawMetrics.awaitingConfirmationCount ?? rawMetrics.awaitingOrdersCount ?? 0,
    activeReservationsCount: rawMetrics.activeReservationsCount ?? 0,
    visibleProductsCount:
      rawMetrics.visibleProductsCount ?? rawMetrics.publishedProductsCount ?? 0,
    publishedProductsCount:
      rawMetrics.publishedProductsCount ?? rawMetrics.visibleProductsCount ?? 0,
    totalProductsCount: rawMetrics.totalProductsCount ?? products.length,
    visibleCategoriesCount:
      rawMetrics.visibleCategoriesCount ??
      categories.filter((c) => c.isVisible !== false).length,
    completedOrdersCount: rawMetrics.completedOrdersCount ?? 0,
    convertedOrdersCount:
      rawMetrics.convertedOrdersCount ?? rawMetrics.completedOrdersCount ?? 0,
    convertedRevenue: rawMetrics.convertedRevenue ?? 0,
  };
  const checklist = overview?.readinessChecklist || [];
  const pendingChecklistCount = checklist.filter((c: any) => !c.done).length;
  const pendingOrders = orders.filter(
    (o) =>
      o.commercialStatus === 'AWAITING_CONFIRMATION' ||
      (o.commercialStatus === 'CONFIRMED' &&
        o.fulfillmentStatus !== 'DELIVERED'),
  );
  const expressDeliveryCfg =
    overview?.settings?.expressDelivery ||
    overview?.config?.expressDelivery ||
    null;
  const originAddressLine = expressDeliveryCfg?.originStreet
    ? [
        `${expressDeliveryCfg.originStreet}${expressDeliveryCfg.originNumber ? `, ${expressDeliveryCfg.originNumber}` : ''}`,
        expressDeliveryCfg.originNeighborhood,
        expressDeliveryCfg.originCity
          ? `${expressDeliveryCfg.originCity}${expressDeliveryCfg.originState ? `/${expressDeliveryCfg.originState}` : ''}`
          : '',
        expressDeliveryCfg.originZipCode
          ? `CEP ${expressDeliveryCfg.originZipCode}`
          : '',
      ]
        .filter(Boolean)
        .join(' - ')
    : settingsForm.address || '';

  return (
    <div className="management-storefront space-y-5 min-w-0">
      {/* Cabeçalho Nativo do Módulo de Gestão */}
      <div className="retail-page-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="retail-kicker">Canal de Vendas Online</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isPublished
                  ? 'bg-support text-brand border-brand'
                  : 'bg-page text-muted border-line'
              }`}
            >
              {isPublished
                ? `● Loja publicada${publishedVersion > 0 ? ` (v${publishedVersion})` : ''}`
                : hasEverPublished
                  ? '◐ Vitrine pausada'
                  : '○ Rascunho inicial'}
            </span>
            {(overview?.config?.publishedByName ||
              overview?.settings?.publishedByName) && (
              <span className="hidden sm:inline-flex">
                <OperatorInlineBadge
                  label="Publicado por:"
                  name={
                    overview?.config?.publishedByName ||
                    overview?.settings?.publishedByName
                  }
                  imageUrl={
                    overview?.config?.publishedByImageUrl ||
                    overview?.settings?.publishedByImageUrl
                  }
                  operatorId={
                    overview?.config?.publishedByUserId ||
                    overview?.settings?.publishedByUserId
                  }
                  size="xs"
                  variant="pill"
                />
              </span>
            )}
            {pendingPublishChanges.length > 0 || overview?.hasUnpublishedChanges ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-page text-brand border border-line">
                {pendingPublishChanges.length > 0
                  ? `${pendingPublishChanges.length} mudança(s) antes de publicar`
                  : 'Rascunho pendente de publicação'}
              </span>
            ) : (
              isPublished && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-page text-muted border border-line">
                  Em dia com a loja publicada
                </span>
              )
            )}
          </div>
          <h1>{settingsForm.storeName || 'Loja Virtual'}</h1>
          <div className="management-storefront-url-row flex flex-wrap items-center gap-2 mt-1 text-xs text-muted min-w-0">
            <span className="management-storefront-url-pill font-mono text-ink bg-page px-2.5 py-1 rounded-lg border border-line break-all max-w-full">
              {publicStoreUrl}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicStoreUrl);
                toast.success('Link da loja copiado!');
              }}
              className="retail-button retail-button-ghost"
            >
              <Copy size={13} />
              <span className="sm:hidden">Copiar</span>
              <span className="hidden sm:inline">Copiar link</span>
            </button>
            {isPublished ? (
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="retail-button retail-button-ghost"
              >
                <ExternalLink size={13} />
                <span className="sm:hidden">Abrir</span>
                <span className="hidden sm:inline">Abrir vitrine</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Publique ou reative a vitrine para abrir o link público"
                className="retail-button retail-button-ghost"
              >
                <ExternalLink size={13} />
                <span className="sm:hidden">Abrir</span>
                <span className="hidden sm:inline">Abrir vitrine</span>
              </button>
            )}
          </div>
        </div>

        <div className="retail-header-actions">
          {/* Slot fixo 1: Pausar e Reativar ocupam exatamente o mesmo lugar */}
          <button
            type="button"
            disabled={
              togglingVisibility ||
              publishing ||
              (!isPublished && !hasEverPublished)
            }
            onClick={() => handleToggleStorePauseOrReactivate(isPublished)}
            title={
              !isPublished && !hasEverPublished
                ? 'Publique a vitrine pela primeira vez para poder pausar ou reativar'
                : undefined
            }
            className="retail-button retail-button-ghost sm:min-w-[148px]"
          >
            {togglingVisibility ? (
              <Loader2 size={15} className="animate-spin" />
            ) : isPublished ? (
              <EyeOff size={15} />
            ) : (
              <Eye size={15} />
            )}
            <span className="sm:hidden">
              {isPublished || !hasEverPublished ? 'Pausar' : 'Reativar'}
            </span>
            <span className="hidden sm:inline">
              {isPublished || !hasEverPublished
                ? 'Pausar vitrine'
                : 'Reativar vitrine'}
            </span>
          </button>

          {/* Slot fixo 2: Salvar configurações (operacional) */}
          <button
            type="button"
            disabled={savingSettings || publishing}
            onClick={() => handleSaveSettings()}
            className="retail-button retail-button-secondary sm:min-w-[168px]"
          >
            {savingSettings ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            <span className="sm:hidden">Configurações</span>
            <span className="hidden sm:inline">Salvar configurações</span>
          </button>

          {/* Slot fixo 3: Salvar rascunho (visual e curadoria, sem publicar) */}
          <button
            type="button"
            disabled={savingDraft || publishing}
            onClick={handleSaveDraftOnly}
            className="retail-button retail-button-secondary sm:min-w-[148px]"
          >
            {savingDraft ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            <span className="sm:hidden">Rascunho</span>
            <span className="hidden sm:inline">Salvar rascunho</span>
          </button>

          {/* Slot fixo 4: Publicar (abre resumo das mudanças antes de ir ao ar) */}
          <button
            type="button"
            disabled={publishing || savingSettings || savingDraft}
            onClick={() => setShowPublishDialog(true)}
            className="retail-button retail-button-primary sm:min-w-[136px]"
          >
            {publishing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
            <span>Publicar</span>
          </button>
        </div>
      </div>

      {(pendingChecklistCount > 0 || metrics.awaitingConfirmationCount > 0 || String(settingsForm.whatsappPhone || '').replace(/\D/g, '').length < 10) && (
        <div className="management-pending-actions" aria-label="Pendências da loja virtual">
          {pendingChecklistCount > 0 && <button type="button" onClick={() => setTab('overview')}>{pendingChecklistCount} pendência(s) na loja</button>}
          {metrics.awaitingConfirmationCount > 0 && <button type="button" onClick={() => setTab('orders')}>{metrics.awaitingConfirmationCount} pedido(s) aguardando confirmação</button>}
          {String(settingsForm.whatsappPhone || '').replace(/\D/g, '').length < 10 && <button type="button" onClick={() => setTab('settings')}>Configurar WhatsApp da loja</button>}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={SF_VIEW_TRANSITION}
        >
      {/* ==================================================================== */}
      {/* ABA 1: VISÃO GERAL OPERACIONAL                                       */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* KPIs Operacionais */}
          <div className="retail-summary-grid">
            <article
              onClick={() => {
                setOrderStatusFilter('AWAITING_CONFIRMATION');
                setTab('orders');
              }}
              className="cursor-pointer hover:border-brand transition"
            >
              <span>Aguardando confirmação</span>
              <strong>{metrics.awaitingConfirmationCount || 0}</strong>
              <small>
                {metrics.awaitingConfirmationCount > 0
                  ? 'Clique para atender no WhatsApp'
                  : 'Nenhum pedido aguardando resposta'}
              </small>
            </article>

            <article
              onClick={() => setTab('orders')}
              className="cursor-pointer hover:border-brand transition"
            >
              <span>Reservas ativas no estoque</span>
              <strong>{metrics.activeReservationsCount || 0}</strong>
              <small>Peças bloqueadas temporariamente</small>
            </article>

            <article
              onClick={() => setTab('products')}
              className="cursor-pointer hover:border-brand transition"
            >
              <span>Peças publicadas na vitrine</span>
              <strong>
                {metrics.publishedProductsCount || 0}{' '}
                <span className="text-sm font-semibold text-muted">
                  / {metrics.totalProductsCount || 0}
                </span>
              </strong>
              <small>Grupos com saldo real do PDV</small>
            </article>

            <article
              onClick={() => {
                setOrderStatusFilter('COMPLETED');
                setTab('orders');
              }}
              className="cursor-pointer hover:border-brand transition"
            >
              <span>Vendas concluídas da vitrine</span>
              <strong>{money(metrics.convertedRevenue || 0)}</strong>
              <small>
                {metrics.convertedOrdersCount || 0} pedido(s) faturado(s) no PDV
              </small>
            </article>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Fila Imediata de Atendimento de Pedidos */}
            <div className="xl:col-span-7 min-w-0 retail-panel space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <span className="retail-kicker">Operação Imediata</span>
                  <h2 className="text-base font-black">
                    Fila de Pedidos e Entregas em Andamento
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('orders')}
                  className="retail-button retail-button-ghost"
                  style={{ minHeight: 34, padding: '6px 12px', fontSize: 12 }}
                >
                  Ver todos ({orders.length})
                </button>
              </div>

              {pendingOrders.length === 0 ? (
                <div className="py-10 text-center text-muted space-y-2">
                  <ShoppingBag size={28} className="mx-auto text-brand" />
                  <p className="text-sm font-bold text-ink">
                    Nenhum pedido pendente de atendimento no momento
                  </p>
                  <p className="text-xs max-w-md mx-auto">
                    Assim que um cliente finalizar um pedido na vitrine pública,
                    ele aparecerá aqui com reserva automática de estoque.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingOrders.slice(0, 6).map((ord) => {
                    const rem =
                      ord.reservationStatus === 'ACTIVE'
                        ? formatRemainingReservation(ord.reservationExpiresAt)
                        : null;
                    return (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xl border border-line bg-page flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-brand transition"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs text-brand">
                              {ord.reference}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-support text-brand">
                              {COMMERCIAL_STATUS_LABELS[ord.commercialStatus] ||
                                ord.commercialStatus}
                            </span>
                            {rem && (
                              <span className="text-[11px] font-bold text-muted flex items-center gap-1">
                                <Clock size={11} className="text-brand" /> {rem}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-sm truncate">
                            {ord.customerName} •{' '}
                            <span className="font-normal text-xs text-muted">
                              {ord.customerPhone}
                            </span>
                          </p>
                          <p className="text-xs text-muted">
                            {ord.deliveryMode === 'DELIVERY'
                              ? 'Entrega'
                              : 'Retirada na loja'}{' '}
                            • {ord.items?.length || 0} item(ns) •{' '}
                            <strong className="text-ink">
                              {money(ord.total)}
                            </strong>
                          </p>
                          {Array.isArray(ord.items) && ord.items.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {ord.items.slice(0, 3).map((it: any, itIdx: number) => (
                                <span
                                  key={it.id || itIdx}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface border border-line text-[11px] text-ink"
                                >
                                  <StockItemThumb
                                    name={it.productName}
                                    imageUrl={it.imageUrl}
                                    size="xs"
                                  />
                                  <span className="truncate max-w-[140px]">
                                    {it.quantity}x {it.productName}
                                  </span>
                                </span>
                              ))}
                              {ord.items.length > 3 && (
                                <span className="text-[11px] font-bold text-muted">
                                  +{ord.items.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          {ord.confirmedByName && (
                            <div className="pt-0.5 text-xs">
                              <OperatorInlineBadge
                                label="Confirmado por:"
                                name={ord.confirmedByName}
                                imageUrl={ord.confirmedByImageUrl}
                                operatorId={ord.confirmedByUserId}
                                size="xs"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {ord.whatsappUrl && (
                            <a
                              href={ord.whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="retail-button retail-button-secondary"
                              style={{
                                minHeight: 34,
                                padding: '6px 10px',
                                fontSize: 12,
                              }}
                              title="Conversar com cliente no WhatsApp"
                            >
                              <MessageCircle size={14} />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          {ord.commercialStatus === 'AWAITING_CONFIRMATION' && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleConfirmOrder(ord.id)}
                              className="retail-button retail-button-primary"
                              style={{
                                minHeight: 34,
                                padding: '6px 12px',
                                fontSize: 12,
                              }}
                            >
                              <Check size={14} />
                              <span>Confirmar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(ord);
                              setTab('orders');
                            }}
                            className="retail-button retail-button-ghost"
                            style={{
                              minHeight: 34,
                              padding: '6px 10px',
                              fontSize: 12,
                            }}
                          >
                            Abrir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Checklist Interativo de Prontidão & Atalhos */}
            <div className="xl:col-span-5 min-w-0 retail-panel space-y-4">
              <div className="border-b border-line pb-3">
                <span className="retail-kicker">Diagnóstico da Vitrine</span>
                <h2 className="text-base font-black">
                  Prontidão para Vendas Online
                </h2>
              </div>

              <div className="space-y-2.5">
                {checklist.map((item: any) => {
                  const getActionForCheck = (key: string) => {
                    if (key === 'identity' || key === 'whatsapp' || key === 'fulfillment') {
                      return {
                        label: 'Configurar',
                        onClick: () => setTab('settings'),
                      };
                    }
                    if (key === 'products') {
                      return {
                        label: 'Publicar disponíveis',
                        onClick: handlePublishAllAvailableProducts,
                      };
                    }
                    return {
                      label: 'Personalizar',
                      onClick: () => setTab('appearance'),
                    };
                  };
                  const action = getActionForCheck(item.key);

                  return (
                    <div
                      key={item.key}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        item.done
                          ? 'border-line bg-surface'
                          : 'border-brand bg-support/35'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.done ? (
                          <CheckCircle2
                            size={17}
                            className="text-brand shrink-0"
                          />
                        ) : (
                          <AlertCircle
                            size={17}
                            className="text-brand shrink-0"
                          />
                        )}
                        <span
                          className={`text-xs font-bold truncate ${
                            item.done ? 'text-ink' : 'text-brand'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>

                      {!item.done && (
                        <button
                          type="button"
                          onClick={action.onClick}
                          className="px-2.5 py-1 rounded-lg bg-brand text-on-brand text-[11px] font-bold shrink-0 hover:bg-brand-hover transition"
                        >
                          {action.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-line grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTab('appearance')}
                  className="retail-button retail-button-secondary w-full"
                  style={{ minHeight: 38, fontSize: 12 }}
                >
                  <Palette size={15} />
                  <span>Editar Aparência</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('products')}
                  className="retail-button retail-button-secondary w-full"
                  style={{ minHeight: 38, fontSize: 12 }}
                >
                  <Package size={15} />
                  <span>Gerenciar Peças</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('delivery')}
                  className="retail-button retail-button-secondary w-full col-span-2"
                  style={{ minHeight: 38, fontSize: 12 }}
                >
                  <Truck size={15} className="text-brand" />
                  <span>Configurar 99 Entregas (Frete por Km & Rastreio)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2: PEDIDOS & RESERVAS DE ESTOQUE                                 */}
      {/* ==================================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Barra de Filtros de Pedidos */}
          <div className="retail-panel space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: '', label: 'Todos' },
                  {
                    id: 'AWAITING_CONFIRMATION',
                    label: 'Aguardando confirmação',
                  },
                  { id: 'CONFIRMED', label: 'Confirmados' },
                  { id: 'COMPLETED', label: 'Convertidos em venda' },
                  { id: 'CANCELLED', label: 'Cancelados' },
                  { id: 'EXPIRED', label: 'Expirados' },
                ].map((st) => {
                  const active = orderStatusFilter === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setOrderStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        active
                          ? 'bg-brand text-on-brand border-brand'
                          : 'bg-page text-ink border-line hover:border-brand'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={loadOrdersOnly}
                className="retail-button retail-button-ghost"
                style={{ minHeight: 34, padding: '6px 12px', fontSize: 12 }}
              >
                <RefreshCw
                  size={14}
                  className={loadingOrders ? 'animate-spin' : ''}
                />
                <span>Atualizar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Buscar por código (PED-...), nome do cliente ou WhatsApp..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-line bg-surface text-xs"
                />
              </div>
              <div>
                <RetailSelect
                  value={orderFulfillmentFilter}
                  onValueChange={setOrderFulfillmentFilter}
                  options={[
                    { value: '', label: 'Todas as etapas de entrega' },
                    {
                      value: 'WAITING_SEPARATION',
                      label: 'Aguardando separação',
                    },
                    { value: 'PREPARING', label: 'Em preparação / separação' },
                    {
                      value: 'READY_FOR_PICKUP',
                      label: 'Pronto para retirada',
                    },
                    { value: 'OUT_FOR_DELIVERY', label: 'Saiu para entrega' },
                    { value: 'DELIVERED', label: 'Entregue ao cliente' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Lista + Painel de Detalhes do Pedido */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 min-w-0 retail-panel p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-page">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted">
                  Pedidos ({orders.length})
                </span>
                {loadingOrders && (
                  <Loader2 size={14} className="animate-spin text-brand" />
                )}
              </div>

              {orders.length === 0 ? (
                <div className="p-10 text-center text-muted">
                  <ShoppingBag size={28} className="mx-auto mb-2 text-brand" />
                  <p className="text-sm font-bold text-ink">
                    Nenhum pedido encontrado
                  </p>
                  <p className="text-xs mt-0.5">
                    Altere os filtros acima ou aguarde novos pedidos da vitrine.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-line max-h-[640px] overflow-y-auto">
                  {orders.map((ord) => {
                    const active = selectedOrder?.id === ord.id;
                    const rem =
                      ord.reservationStatus === 'ACTIVE'
                        ? formatRemainingReservation(ord.reservationExpiresAt)
                        : null;
                    return (
                      <div
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className={`p-4 cursor-pointer transition ${
                          active
                            ? 'bg-support/55 border-l-4 border-l-brand'
                            : 'hover:bg-page'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-black text-xs text-brand">
                            {ord.reference}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-support text-brand">
                            {COMMERCIAL_STATUS_LABELS[ord.commercialStatus] ||
                              ord.commercialStatus}
                          </span>
                        </div>

                        <p className="font-bold text-sm">{ord.customerName}</p>
                        <p className="text-xs text-muted">
                          {ord.customerPhone} •{' '}
                          {ord.deliveryMode === 'DELIVERY'
                            ? 'Entrega'
                            : 'Retirada'}
                        </p>

                        {Array.isArray(ord.items) && ord.items.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {ord.items.slice(0, 3).map((it: any, itIdx: number) => (
                              <span
                                key={it.id || itIdx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface border border-line text-[11px] text-ink"
                              >
                                <StockItemThumb
                                  name={it.productName}
                                  imageUrl={it.imageUrl}
                                  size="xs"
                                />
                                <span className="truncate max-w-[110px]">
                                  {it.quantity}x {it.productName}
                                </span>
                              </span>
                            ))}
                            {ord.items.length > 3 && (
                              <span className="text-[10px] font-bold text-muted">
                                +{ord.items.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-line text-xs">
                          <div className="flex items-center gap-2 text-muted">
                            <span>
                              {new Date(ord.createdAt).toLocaleDateString(
                                'pt-BR',
                                {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )}
                            </span>
                            {rem && (
                              <span className="px-1.5 py-0.5 rounded-md bg-surface border border-line text-[10px] font-extrabold text-brand">
                                ⏱ {rem}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-sm">
                            {money(ord.total)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="xl:col-span-7 min-w-0">
              {!selectedOrder ? (
                <div className="retail-panel py-20 text-center text-muted">
                  <ShoppingBag
                    size={36}
                    className="mx-auto mb-3 text-brand opacity-70"
                  />
                  <h3 className="font-bold text-base text-ink">
                    Selecione um pedido na lista ao lado
                  </h3>
                  <p className="text-xs mt-1">
                    Visualize as peças reservadas, converse no WhatsApp e
                    converta o pedido em venda no PDV.
                  </p>
                </div>
              ) : (
                <div className="retail-panel space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-black font-mono text-brand">
                          {selectedOrder.reference}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-support text-brand">
                          {COMMERCIAL_STATUS_LABELS[
                            selectedOrder.commercialStatus
                          ] || selectedOrder.commercialStatus}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Registrado em{' '}
                        {new Date(selectedOrder.createdAt).toLocaleString(
                          'pt-BR',
                        )}
                      </p>
                      {(selectedOrder.confirmedByName ||
                        selectedOrder.cancelledByName ||
                        selectedOrder.sale?.operatorName) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          {selectedOrder.confirmedByName && (
                            <OperatorInlineBadge
                              label="Confirmado por:"
                              name={selectedOrder.confirmedByName}
                              imageUrl={selectedOrder.confirmedByImageUrl}
                              operatorId={selectedOrder.confirmedByUserId}
                              size="xs"
                              variant="pill"
                            />
                          )}
                          {selectedOrder.cancelledByName && (
                            <OperatorInlineBadge
                              label="Cancelado por:"
                              name={selectedOrder.cancelledByName}
                              imageUrl={selectedOrder.cancelledByImageUrl}
                              operatorId={selectedOrder.cancelledByUserId}
                              size="xs"
                              variant="pill"
                            />
                          )}
                          {selectedOrder.sale?.operatorName && (
                            <OperatorInlineBadge
                              label="Faturado por:"
                              name={selectedOrder.sale.operatorName}
                              imageUrl={selectedOrder.sale.operatorImageUrl}
                              operatorId={selectedOrder.sale.operatorId}
                              size="xs"
                              variant="pill"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.whatsappUrl && (
                        <a
                          href={selectedOrder.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="retail-button retail-button-secondary"
                          style={{
                            minHeight: 36,
                            padding: '6px 12px',
                            fontSize: 12,
                          }}
                        >
                          <MessageCircle size={15} />
                          <span>Chamar Cliente no WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Dados do Cliente e Entrega */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-page border border-line text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted block">
                        Cliente
                      </span>
                      <p className="font-bold text-sm text-ink">
                        {selectedOrder.customerName}
                      </p>
                      <p className="text-muted">
                        WhatsApp: {selectedOrder.customerPhone}
                      </p>
                      {selectedOrder.customerDocument && (
                        <p className="text-muted">
                          CPF/CNPJ: {selectedOrder.customerDocument}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted block">
                        Modalidade & Reserva
                      </span>
                      <p className="font-bold text-sm text-ink">
                        {selectedOrder.deliveryMode === 'DELIVERY'
                          ? 'Entrega no endereço'
                          : 'Retirada na loja'}
                      </p>
                      <p className="text-muted">
                        Reserva:{' '}
                        <strong className="text-brand">
                          {RESERVATION_STATUS_LABELS[
                            selectedOrder.reservationStatus
                          ] || selectedOrder.reservationStatus}
                        </strong>
                      </p>
                      {selectedOrder.paymentMethodPreference && (
                        <p className="text-muted">
                          Preferência pagto:{' '}
                          <strong>
                            {selectedOrder.paymentMethodPreference}
                          </strong>
                        </p>
                      )}
                    </div>

                    {selectedOrder.deliveryMode === 'DELIVERY' &&
                      selectedOrder.addressLine && (
                        <div className="sm:col-span-2 pt-2 border-t border-line flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-muted block">
                              Endereço de Entrega
                            </span>
                            <p className="font-semibold text-ink mt-0.5">
                              {selectedOrder.addressLine},{' '}
                              {selectedOrder.addressNumber}
                              {selectedOrder.addressComplement
                                ? ` (${selectedOrder.addressComplement})`
                                : ''}{' '}
                              — {selectedOrder.neighborhood},{' '}
                              {selectedOrder.city}
                              {selectedOrder.state
                                ? `/${selectedOrder.state}`
                                : ''}
                              {selectedOrder.zipCode
                                ? ` • CEP: ${selectedOrder.zipCode}`
                                : ''}
                            </p>
                            {selectedOrder.addressReference && (
                              <p className="text-muted mt-0.5">
                                Ref: {selectedOrder.addressReference}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const addr = `${selectedOrder.addressLine}, ${selectedOrder.addressNumber} - ${selectedOrder.neighborhood}, ${selectedOrder.city}`;
                              navigator.clipboard.writeText(addr);
                              toast.success('Endereço copiado!');
                            }}
                            className="p-1.5 rounded-lg border border-line bg-surface text-muted hover:text-ink"
                            title="Copiar endereço"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      )}

                    {selectedOrder.notes && (
                      <div className="sm:col-span-2 pt-2 border-t border-line">
                        <span className="text-[10px] font-bold uppercase text-muted block">
                          Observações do Cliente
                        </span>
                        <p className="font-medium text-ink mt-0.5">
                          {selectedOrder.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ações Operacionais do Pedido */}
                  {['AWAITING_CONFIRMATION', 'CONFIRMED'].includes(
                    selectedOrder.commercialStatus,
                  ) && (
                    <div className="p-4 rounded-xl border border-brand bg-support/35 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-brand">
                          Ações Operacionais do Pedido
                        </span>
                        {selectedOrder.reservationStatus === 'ACTIVE' &&
                          selectedOrder.reservationExpiresAt && (
                            <span className="text-xs font-bold text-brand flex items-center gap-1">
                              <Clock size={13} />
                              Expira em:{' '}
                              {formatRemainingReservation(
                                selectedOrder.reservationExpiresAt,
                              )}
                            </span>
                          )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedOrder.commercialStatus ===
                          'AWAITING_CONFIRMATION' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleConfirmOrder(selectedOrder.id)}
                            className="retail-button retail-button-primary"
                            style={{ minHeight: 38, fontSize: 12 }}
                          >
                            <CheckCircle2 size={15} />
                            <span>Confirmar Pedido</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setConvertCustomerDoc(
                              selectedOrder.customerDocument || '',
                            );
                            if (selectedOrder.paymentMethodPreference) {
                              setConvertPaymentMethod(
                                selectedOrder.paymentMethodPreference,
                              );
                            }
                            setConvertObservation(
                              `Venda originada da Loja Virtual (${selectedOrder.reference})`,
                            );
                            setShowConvertDialog(true);
                          }}
                          className="retail-button retail-button-primary"
                          style={{ minHeight: 38, fontSize: 12 }}
                        >
                          <ShoppingBag size={15} />
                          <span>Converter em Venda no PDV</span>
                        </button>

                        {selectedOrder.commercialStatus ===
                          'AWAITING_CONFIRMATION' && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setOrderActionReason('');
                              setOrderActionModal({
                                order: selectedOrder,
                                action: 'reject',
                              });
                            }}
                            className="retail-button retail-button-secondary"
                            style={{ minHeight: 38, fontSize: 12 }}
                          >
                            <XCircle size={15} />
                            <span>Recusar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setOrderActionReason('');
                            setOrderActionModal({
                              order: selectedOrder,
                              action: 'cancel',
                            });
                          }}
                          className="retail-button retail-button-ghost"
                          style={{ minHeight: 38, fontSize: 12 }}
                        >
                          <span>Cancelar Pedido</span>
                        </button>
                      </div>

                      {/* Atualização de Etapa Logística */}
                      <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-ink">
                          Etapa de Separação / Entrega:
                        </span>
                        <div className="w-full sm:w-64">
                          <RetailSelect
                            value={selectedOrder.fulfillmentStatus}
                            onValueChange={(val) =>
                              handleUpdateFulfillment(selectedOrder.id, val)
                            }
                            options={Object.entries(
                              FULFILLMENT_STATUS_LABELS,
                            ).map(([k, v]) => ({
                              value: k,
                              label: v,
                            }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Central de Despacho 99 Entregas (para pedidos DELIVERY) */}
                  {selectedOrder.fulfillmentMode === 'DELIVERY' && (
                    <StorefrontOrderExpressDispatchCard
                      order={selectedOrder}
                      originAddressLine={originAddressLine}
                      onUpdated={async (updatedOrder: any) => {
                        if (updatedOrder) {
                          setSelectedOrder(normalizeAdminOrder(updatedOrder));
                        }
                        await loadOrdersOnly();
                      }}
                    />
                  )}

                  {/* Lista de Itens do Pedido */}
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted mb-2.5">
                      Peças do Pedido ({selectedOrder.items?.length || 0})
                    </h4>
                    <div className="divide-y divide-line border border-line rounded-xl overflow-hidden bg-surface">
                      {(selectedOrder.items || []).map((item: any) => (
                        <div
                          key={item.id}
                          className="p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <StorefrontProductFrame
                              imageUrl={item.imageUrl}
                              alt={item.productName}
                              productName={item.productName}
                              padding="xs"
                              aspectClassName="w-10 h-12 shrink-0"
                              roundedClassName="rounded-lg border border-line"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-ink truncate">
                                {item.productName}
                              </p>
                              <p className="text-muted">
                                {[
                                  item.size && `Tam: ${item.size}`,
                                  item.color && `Cor: ${item.color}`,
                                  `Qtd: ${item.quantity}`,
                                  `Unit: ${money(item.priceUnit ?? item.priceSaleSnapshot ?? 0)}`,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </p>
                            </div>
                          </div>
                          <span className="font-black text-sm shrink-0">
                            {money(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 pb-6 border-t border-line space-y-1.5">
                      {(selectedOrder.fulfillmentMode === 'DELIVERY' ||
                        Number(selectedOrder.deliveryFee || 0) > 0) && (
                        <>
                          <div className="flex justify-between items-center text-xs text-muted">
                            <span>Subtotal das peças</span>
                            <span className="font-bold text-ink">
                              {money(
                                Number(
                                  selectedOrder.subtotal ??
                                    Math.max(
                                      0,
                                      Number(selectedOrder.total || 0) -
                                        Number(selectedOrder.deliveryFee || 0),
                                    ),
                                ),
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted">
                            <span>
                              Entrega 99
                              {selectedOrder.expressQuote?.vehicleType ===
                              'CARRO'
                                ? ' (Carro)'
                                : selectedOrder.expressQuote?.vehicleType ===
                                    'MOTO'
                                  ? ' (Moto)'
                                  : ''}
                            </span>
                            <span className="font-bold text-brand">
                              {Number(selectedOrder.deliveryFee || 0) === 0
                                ? 'Grátis'
                                : money(Number(selectedOrder.deliveryFee || 0))}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-bold text-muted">
                          Total do Pedido
                        </span>
                        <span className="text-lg font-black text-ink">
                          {money(selectedOrder.total)}
                        </span>
                      </div>
                    </div>

                    {Array.isArray(selectedOrder.events) &&
                      selectedOrder.events.length > 0 && (
                        <div className="pt-3 border-t border-line space-y-2">
                          <h5 className="font-bold text-[11px] uppercase tracking-wider text-muted">
                            Histórico de Ações do Pedido
                          </h5>
                          <div className="space-y-1.5">
                            {selectedOrder.events.map((ev: any) => {
                              const isStaff =
                                ev.actorType !== 'CUSTOMER' &&
                                ev.actorType !== 'SYSTEM' &&
                                Boolean(ev.actorName);
                              return (
                                <div
                                  key={ev.id}
                                  className="px-3 py-2 rounded-lg bg-page border border-line flex flex-wrap items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="font-semibold text-ink">
                                      {ev.eventType}
                                    </span>
                                    {ev.reason && (
                                      <span className="text-muted">
                                        — {ev.reason}
                                      </span>
                                    )}
                                    {isStaff ? (
                                      <OperatorInlineBadge
                                        name={ev.actorName}
                                        imageUrl={ev.actorImageUrl}
                                        operatorId={ev.actorId}
                                        size="xs"
                                      />
                                    ) : ev.actorName ? (
                                      <span className="text-muted">
                                        ({ev.actorName})
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="text-[11px] text-muted tabular-nums shrink-0">
                                    {new Date(ev.createdAt).toLocaleString(
                                      'pt-BR',
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3: PRODUTOS NA VITRINE & COLEÇÕES CURADAS / MONTE O LOOK         */}
      {/* ==================================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-4 min-w-0">
          {/* Sub-navegação: Catálogo de Mercadorias vs Coleções e Monte o look */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Subáreas de Produtos e Curadoria"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl border border-line bg-surface max-w-full"
            >
              <button
                type="button"
                role="tab"
                aria-selected={productsSubView === 'catalog'}
                onClick={() => setProductsSubView('catalog')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer ${
                  productsSubView === 'catalog'
                    ? 'bg-brand text-on-brand'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Package size={14} />
                <span>Mercadorias do catálogo ({products.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={productsSubView === 'collections'}
                onClick={() => setProductsSubView('collections')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition cursor-pointer ${
                  productsSubView === 'collections'
                    ? 'bg-brand text-on-brand'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Layers size={14} />
                <span>
                  Coleções e Monte o look ({(draftTheme.collections || []).length})
                </span>
              </button>
            </div>
          </div>

          {productsSubView === 'collections' ? (
            <StorefrontCollectionsManager
              draftTheme={draftTheme}
              setDraftTheme={setDraftTheme}
              products={products}
              storeSlug={settingsForm.slug || 'minha-loja'}
              savingDraft={savingDraft}
              publishing={publishing}
              onSaveDraft={handleSaveDraftOnly}
              onOpenPublishModal={() => setShowPublishDialog(true)}
              onExposeCollectionInHome={handleExposeCollectionInHome}
            />
          ) : (
            <>
              <div className="retail-panel space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="retail-kicker">Curadoria do Catálogo</span>
                    <h2 className="text-base font-black">
                      Grupos de Mercadorias na Vitrine Online
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={batchBusy || saving}
                      onClick={handlePublishAllAvailableProducts}
                      className="retail-button retail-button-secondary sm:min-w-[205px]"
                      style={{ minHeight: 36, fontSize: 12 }}
                    >
                      {batchBusy ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      <span>Publicar todos com estoque</span>
                    </button>
                  </div>
                </div>

                {/* Aviso explícito de efeito imediato no controle */}
                <div className="px-3 py-2 rounded-xl border border-line bg-page flex items-start sm:items-center gap-2 text-xs text-muted">
                  <AlertCircle size={14} className="text-brand shrink-0 mt-0.5 sm:mt-0" />
                  <span>
                    <strong className="text-ink">Efeito imediato:</strong> alterar{' '}
                    <strong className="text-ink">Visível</strong>,{' '}
                    <strong className="text-ink">Destaque</strong>, ações em lote ou{' '}
                    <strong className="text-ink">Personalizar</strong> atualiza na
                    hora a loja publicada.
                  </span>
                </div>

                {/* Filtros de Produtos */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 pt-1">
                  <div className="xl:col-span-5 relative min-w-0">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar por nome da peça, título público ou categoria..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-line bg-surface text-xs"
                    />
                  </div>

                  <div className="xl:col-span-3 min-w-0">
                    <RetailSelect
                      value={productCategoryFilter}
                      onValueChange={setProductCategoryFilter}
                      options={[
                        { value: 'all', label: 'Todas as categorias' },
                        ...categories.map((c) => ({
                          value: c.id,
                          label: `${c.name} (${c.productCount || 0})`,
                        })),
                      ]}
                    />
                  </div>

                  <div className="xl:col-span-4 flex flex-wrap items-center gap-1.5 min-w-0">
                    {[
                      { id: 'all' as const, label: `Todos (${products.length})` },
                      {
                        id: 'visible' as const,
                        label: `Na Vitrine (${products.filter((p) => p.isVisible).length})`,
                      },
                      {
                        id: 'hidden' as const,
                        label: `Ocultos (${products.filter((p) => !p.isVisible).length})`,
                      },
                      {
                        id: 'featured' as const,
                        label: `Destaques (${products.filter((p) => p.featured).length})`,
                      },
                    ].map((f) => {
                      const active = productVisibilityFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setProductVisibilityFilter(f.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition ${
                            active
                              ? 'bg-brand text-on-brand border-brand'
                              : 'bg-page text-ink border-line hover:border-brand'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Barra de Ação em Lote — preserva a seleção e exibe o resultado antes de limpar */}
                {(selectedProductIds.length > 0 || batchFeedback) && (
                  <div className="p-3 rounded-xl bg-support border border-brand space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-brand">
                        {selectedProductIds.length} produto(s) selecionado(s) • efeito imediato
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={batchBusy || selectedProductIds.length === 0}
                          onClick={() => handleBatchProducts('show')}
                          className="px-3 py-1.5 rounded-lg bg-brand text-on-brand text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {batchBusy && <Loader2 size={12} className="animate-spin" />}
                          <span>Exibir na vitrine</span>
                        </button>
                        <button
                          type="button"
                          disabled={batchBusy || selectedProductIds.length === 0}
                          onClick={() => handleBatchProducts('hide')}
                          className="px-3 py-1.5 rounded-lg bg-surface text-ink border border-line text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {batchBusy && <Loader2 size={12} className="animate-spin" />}
                          <span>Ocultar da vitrine</span>
                        </button>
                        <button
                          type="button"
                          disabled={batchBusy || selectedProductIds.length === 0}
                          onClick={() => handleBatchProducts('feature')}
                          className="px-3 py-1.5 rounded-lg bg-surface text-brand border border-brand text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {batchBusy && <Loader2 size={12} className="animate-spin" />}
                          <span>Marcar destaque</span>
                        </button>
                        <button
                          type="button"
                          disabled={batchBusy || selectedProductIds.length === 0}
                          onClick={() => handleBatchProducts('unfeature')}
                          className="px-3 py-1.5 rounded-lg bg-surface text-muted border border-line text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {batchBusy && <Loader2 size={12} className="animate-spin" />}
                          <span>Remover destaque</span>
                        </button>
                        <button
                          type="button"
                          disabled={batchBusy}
                          onClick={() => {
                            setSelectedProductIds([]);
                            setBatchFeedback(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-surface border border-line text-xs font-bold text-ink hover:border-brand"
                        >
                          Limpar seleção
                        </button>
                      </div>
                    </div>

                    {batchFeedback && (
                      <div
                        role="status"
                        className="px-3 py-2 rounded-lg bg-surface border border-brand flex items-center gap-2 text-xs font-semibold text-ink"
                      >
                        <CheckCircle2 size={14} className="text-brand shrink-0" />
                        <span>{batchFeedback}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {filteredProducts.length > 0 && (
                <div className="retail-mobile-only mb-2">
                  <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line bg-page text-xs font-semibold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedProductIds.length === filteredProducts.length
                      }
                      onChange={(e) => {
                        setBatchFeedback(null);
                        setSelectedProductIds(
                          e.target.checked
                            ? filteredProducts.map((p) => p.id)
                            : [],
                        );
                      }}
                      className="rounded accent-brand w-4 h-4"
                    />
                    <span>
                      Selecionar todas listadas ({selectedProductIds.length}/{filteredProducts.length})
                    </span>
                  </label>
                </div>
              )}

              <div className="retail-table-wrap">
                <table className="retail-table retail-table-cards">
                  <thead>
                    <tr>
                      <th style={{ width: 42 }}>
                        <input
                          type="checkbox"
                          checked={
                            filteredProducts.length > 0 &&
                            selectedProductIds.length === filteredProducts.length
                          }
                          onChange={(e) => {
                            setBatchFeedback(null);
                            setSelectedProductIds(
                              e.target.checked
                                ? filteredProducts.map((p) => p.id)
                                : [],
                            );
                          }}
                          className="rounded accent-brand"
                        />
                      </th>
                      <th>Peça / Grupo</th>
                      <th>Categoria</th>
                      <th>Preço</th>
                      <th>Saldo Disponível</th>
                      <th>Visível na Loja (imediato)</th>
                      <th>Destaque (imediato)</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="retail-cell-primary py-12 text-center text-muted">
                          Nenhuma peça encontrada com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const checked = selectedProductIds.includes(p.id);
                        return (
                          <tr key={p.id}>
                            <td className="retail-desktop-only">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setBatchFeedback(null);
                                  setSelectedProductIds((prev) =>
                                    e.target.checked
                                      ? [...prev, p.id]
                                      : prev.filter((id) => id !== p.id),
                                  );
                                }}
                                className="rounded accent-brand"
                              />
                            </td>
                            <td className="retail-cell-primary">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="retail-mobile-only shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    aria-label={`Selecionar ${p.displayTitle || p.name}`}
                                    onChange={(e) => {
                                      setBatchFeedback(null);
                                      setSelectedProductIds((prev) =>
                                        e.target.checked
                                          ? [...prev, p.id]
                                          : prev.filter((id) => id !== p.id),
                                      );
                                    }}
                                    className="rounded accent-brand w-4 h-4"
                                  />
                                </span>
                                <StorefrontProductFrame
                                  imageUrl={p.imageUrl}
                                  alt={p.name}
                                  categoryName={p.categoryName}
                                  productName={p.name}
                                  padding="xs"
                                  aspectClassName="w-11 h-13 shrink-0"
                                  roundedClassName="rounded-xl border border-line"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-ink truncate max-w-full">
                                      {p.displayTitle || p.name}
                                    </p>
                                    {p.badgeLabel && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-support text-brand">
                                        {p.badgeLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted font-mono truncate">
                                    /{p.publicSlug}
                                    {Array.isArray(p.galleryUrls) &&
                                      p.galleryUrls.length > 0 &&
                                      ` • +${p.galleryUrls.length} foto(s)`}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td data-label="Categoria">
                              {p.categoryName ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-page border border-line text-xs font-bold w-fit max-w-full">
                                  <CategoryIconBadge
                                    categoryName={p.categoryName}
                                    size={14}
                                  />
                                  <span className="truncate">{p.categoryName}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-muted">
                                  Sem categoria
                                </span>
                              )}
                            </td>
                            <td data-label="Preço" className="font-bold">{money(p.priceSale)}</td>
                            <td data-label="Saldo">
                              <div className="flex flex-wrap items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    Number(p.availableStock) > 0
                                      ? 'bg-support text-brand'
                                      : 'bg-page text-muted'
                                  }`}
                                >
                                  {p.availableStock} disp.
                                </span>
                                {p.reservedStock > 0 && (
                                  <span className="text-[11px] text-muted">
                                    ({p.reservedStock} reserv.)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td data-label="Na vitrine">
                              <RetailSwitch
                                size="sm"
                                checked={Boolean(p.isVisible)}
                                onCheckedChange={() =>
                                  handleQuickToggleProduct(p, 'isVisible')
                                }
                                label={p.isVisible ? 'Visível' : 'Oculto'}
                              />
                            </td>
                            <td data-label="Destaque">
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickToggleProduct(p, 'featured')
                                }
                                className={`min-w-[96px] justify-center px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 border transition w-fit ${
                                  p.featured
                                    ? 'bg-brand text-on-brand border-brand'
                                    : 'bg-page text-muted border-line hover:text-ink'
                                }`}
                              >
                                <Star size={12} />
                                <span>{p.featured ? 'Destaque' : 'Normal'}</span>
                              </button>
                            </td>
                            <td className="retail-cell-actions text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingProduct({
                                    ...p,
                                    galleryUrls: Array.isArray(p.galleryUrls)
                                      ? p.galleryUrls
                                      : [],
                                  })
                                }
                                className="retail-button retail-button-ghost"
                                style={{
                                  minHeight: 36,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                }}
                              >
                                <Edit3 size={13} />
                                <span>Personalizar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 4: CATEGORIAS DA VITRINE                                         */}
      {/* ==================================================================== */}
      {activeTab === 'categories' && (
        <div className="retail-panel space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="min-w-0">
              <span className="retail-kicker">Navegação da Loja</span>
              <h2 className="text-base font-black">
                Ordem e Visibilidade das Categorias
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Use as setas para definir a ordem em que as categorias aparecem
                na vitrine pública.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-page border border-line text-[11px] text-muted">
                <AlertCircle size={13} className="text-brand shrink-0" />
                <span>
                  <strong className="text-ink">Efeito imediato:</strong> salvar
                  categorias atualiza ordem, endereço e visibilidade imediatamente
                  na loja publicada.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewCategoryDialog(true)}
                className="retail-button retail-button-secondary"
                style={{ minHeight: 38, fontSize: 12 }}
              >
                <Plus size={15} />
                <span>Nova Categoria</span>
              </button>
              <button
                type="button"
                disabled={savingCategories}
                onClick={handleSaveCategories}
                className="retail-button retail-button-primary sm:min-w-[162px]"
                style={{ minHeight: 38, fontSize: 12 }}
              >
                {savingCategories ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                <span>Salvar Categorias</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-xl border border-line bg-page grid grid-cols-1 md:grid-cols-12 items-center gap-3 min-w-0"
              >
                <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveCategoryOrder(idx, -1)}
                      className="p-1 rounded border border-line bg-surface text-muted hover:text-ink disabled:opacity-30"
                      title="Subir categoria"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === categories.length - 1}
                      onClick={() => moveCategoryOrder(idx, 1)}
                      className="p-1 rounded border border-line bg-surface text-muted hover:text-ink disabled:opacity-30"
                      title="Descer categoria"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center shrink-0">
                    <CategoryIconBadge categoryName={cat.name} size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-sm text-ink truncate">
                      {cat.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      {cat.productCount || 0} grupo(s) vinculado(s)
                    </p>
                  </div>
                </div>

                <div className="md:col-span-3 min-w-0">
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                    Slug na URL
                  </label>
                  <input
                    type="text"
                    value={cat.publicSlug || ''}
                    onChange={(e) => {
                      const next = [...categories];
                      next[idx] = { ...cat, publicSlug: e.target.value };
                      setCategories(next);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-mono"
                  />
                </div>

                <div className="md:col-span-3 min-w-0">
                  <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                    Descrição curta na vitrine
                  </label>
                  <input
                    type="text"
                    value={cat.description || ''}
                    onChange={(e) => {
                      const next = [...categories];
                      next[idx] = { ...cat, description: e.target.value };
                      setCategories(next);
                    }}
                    placeholder="Opcional..."
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <RetailSwitch
                    size="sm"
                    checked={cat.isVisible !== false}
                    onCheckedChange={(checked) => {
                      const next = [...categories];
                      next[idx] = { ...cat, isVisible: checked };
                      setCategories(next);
                    }}
                    label={cat.isVisible !== false ? 'Visível' : 'Oculta'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 5: APARÊNCIA — ESTÚDIO VISUAL RESPONSIVO & PRÉVIA EM IFRAME      */}
      {/* ==================================================================== */}
      {activeTab === 'appearance' && (
        <StorefrontVisualStudio
          draftTheme={draftTheme}
          setDraftTheme={setDraftTheme}
          settingsForm={settingsForm}
          setSettingsForm={setSettingsForm}
          products={products}
          categories={categories}
          livePreviewStoreData={livePreviewStoreData}
          previewDevice={previewDevice}
          setPreviewDevice={setPreviewDevice}
          selectedSectionId={selectedSectionId}
          setSelectedSectionId={setSelectedSectionId}
          onUploadFile={handleUploadMediaFile}
          onNavigateTab={(tab, openCols) => {
            if (tab === 'products' && openCols !== undefined) {
              setProductsSubView(openCols ? 'collections' : 'catalog');
            }
            setTab(tab);
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* ABA 6: CONFIGURAÇÕES GERAIS, WHATSAPP & LOGÍSTICA                    */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-5 min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Identidade, URL e Imagens */}
            <div className="xl:col-span-7 min-w-0 retail-panel space-y-4">
              <div className="border-b border-line pb-3">
                <span className="retail-kicker">Identidade Pública</span>
                <h2 className="text-base font-black">
                  Nome, Endereço da Vitrine e Imagens
                </h2>
              </div>

              <div className="retail-form-grid">
                <label className="retail-field">
                  <span>Nome público da loja *</span>
                  <input
                    type="text"
                    required
                    value={settingsForm.storeName}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        storeName: e.target.value,
                      })
                    }
                    placeholder="Ex: Boutique Roxo & Branco"
                  />
                </label>

                <label className="retail-field">
                  <span>Slug (URL exclusiva da vitrine) *</span>
                  <input
                    type="text"
                    required
                    value={settingsForm.slug}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, '-'),
                      })
                    }
                    placeholder="minha-loja"
                  />
                  <small className="text-[11px] text-muted font-mono break-all">
                    {window.location.origin}/loja/
                    {settingsForm.slug || 'minha-loja'}
                  </small>
                </label>

                <label className="retail-field retail-field-wide">
                  <span>Slogan / frase curta abaixo do nome</span>
                  <input
                    type="text"
                    value={settingsForm.tagline}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        tagline: e.target.value,
                      })
                    }
                    placeholder="Ex: Moda feminina e acessórios com pronta entrega"
                  />
                </label>

                <label className="retail-field retail-field-wide">
                  <span>Apresentação da loja (exibida na capa da vitrine)</span>
                  <textarea
                    rows={2}
                    value={settingsForm.description}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Conte brevemente sobre sua loja, diferenciais ou política de trocas..."
                  />
                </label>
              </div>

              {/* Uploads Visuais de Logotipo e Capa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
                <div className="p-3.5 rounded-xl border border-line bg-page space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Logotipo da Loja</span>
                    {settingsForm.logoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsForm({ ...settingsForm, logoUrl: '' })
                        }
                        className="text-[11px] font-bold text-muted hover:text-ink"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  {settingsForm.logoUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={getFullUrl(settingsForm.logoUrl)}
                        alt="Logo"
                        className="w-16 h-16 rounded-xl object-cover border border-line bg-surface"
                      />
                      <label className="retail-button retail-button-secondary cursor-pointer text-xs">
                        <Upload size={14} /> Trocar logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadMedia(f, 'logoUrl');
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="retail-upload cursor-pointer">
                      <Upload size={18} className="text-brand" />
                      <span className="text-xs font-bold">
                        Clique para enviar o logotipo
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadMedia(f, 'logoUrl');
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-line bg-page space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">
                      Foto de Capa (Banner Hero)
                    </span>
                    {settingsForm.coverUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsForm({ ...settingsForm, coverUrl: '' })
                        }
                        className="text-[11px] font-bold text-muted hover:text-ink"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  {settingsForm.coverUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={getFullUrl(settingsForm.coverUrl)}
                        alt="Capa"
                        className="w-24 h-16 rounded-xl object-cover border border-line bg-surface"
                      />
                      <label className="retail-button retail-button-secondary cursor-pointer text-xs">
                        <Upload size={14} /> Trocar capa
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadMedia(f, 'coverUrl');
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="retail-upload cursor-pointer">
                      <ImageIcon size={18} className="text-brand" />
                      <span className="text-xs font-bold">
                        Enviar imagem de capa (opcional)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadMedia(f, 'coverUrl');
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Atendimento via WhatsApp & Localização */}
            <div className="xl:col-span-5 min-w-0 retail-panel space-y-4">
              <div className="border-b border-line pb-3">
                <span className="retail-kicker">Canal de Atendimento</span>
                <h2 className="text-base font-black">
                  WhatsApp, Endereço e Horários
                </h2>
              </div>

              <div className="space-y-3">
                <label className="retail-field">
                  <span>WhatsApp oficial da loja (com DDD) *</span>
                  <input
                    type="tel"
                    required
                    value={settingsForm.whatsappPhone}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        whatsappPhone: formatPhoneMask(e.target.value),
                      })
                    }
                    placeholder="(11) 99999-9999"
                  />
                  <small className="text-[11px] text-muted">
                    Todos os pedidos da vitrine gerarão link automático para
                    este número.
                  </small>
                </label>

                <label className="retail-field">
                  <span>Endereço físico da loja (para retirada e rodapé)</span>
                  <input
                    type="text"
                    value={settingsForm.address}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        address: e.target.value,
                      })
                    }
                    placeholder="Rua Exemplo, 123 - Centro"
                  />
                </label>

                <label className="retail-field">
                  <span>Horário de atendimento</span>
                  <input
                    type="text"
                    value={settingsForm.businessHours}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        businessHours: e.target.value,
                      })
                    }
                    placeholder="Seg a Sex das 9h às 18h • Sáb das 9h às 14h"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Logística: Retirada, Entrega e Reserva Automática */}
          <div className="retail-panel space-y-4">
            <div className="border-b border-line pb-3">
              <span className="retail-kicker">Regras de Operação</span>
              <h2 className="text-base font-black">
                Modalidades de Entrega e Tempo de Reserva de Estoque
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Retirada na Loja */}
              <div className="p-4 rounded-xl border border-line bg-page space-y-3">
                <RetailSwitch
                  checked={settingsForm.pickupEnabled}
                  onCheckedChange={(checked) =>
                    setSettingsForm({
                      ...settingsForm,
                      pickupEnabled: checked,
                    })
                  }
                  label="Permitir Retirada na Loja"
                  description="O cliente reserva online e retira no balcão sem taxa de entrega."
                />
                {settingsForm.pickupEnabled && (
                  <label className="retail-field">
                    <span>Instruções de retirada</span>
                    <input
                      type="text"
                      value={settingsForm.pickupInstructions}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          pickupInstructions: e.target.value,
                        })
                      }
                      placeholder="Ex: Apresente o código do pedido no caixa."
                    />
                  </label>
                )}
              </div>

              {/* Entrega Local */}
              <div className="p-4 rounded-xl border border-line bg-page space-y-3">
                <RetailSwitch
                  checked={settingsForm.deliveryEnabled}
                  onCheckedChange={(checked) =>
                    setSettingsForm({
                      ...settingsForm,
                      deliveryEnabled: checked,
                    })
                  }
                  label="Permitir Entrega Local"
                  description="Solicita CEP e endereço completo no checkout da vitrine."
                />
                {settingsForm.deliveryEnabled && (
                  <div className="space-y-2.5">
                    <label className="retail-field">
                      <span>Taxa de entrega padrão (R$)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settingsForm.deliveryFeeDefault}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            deliveryFeeDefault: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="retail-field">
                      <span>Observações de prazo / região</span>
                      <input
                        type="text"
                        value={settingsForm.deliveryNotes}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            deliveryNotes: e.target.value,
                          })
                        }
                        placeholder="Ex: Entregas por motoboy em até 2 horas."
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab('delivery')}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-support border border-brand px-3 py-2 text-xs font-extrabold text-brand hover:bg-surface transition cursor-pointer"
                    >
                      <Truck size={14} />
                      <span>Configurar 99 Entregas (Km, Moto/Carro & PIN)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Prazo de Reserva de Estoque */}
              <div className="p-4 rounded-xl border border-line bg-page space-y-3">
                <div>
                  <span className="text-xs font-extrabold text-ink block">
                    Prazo da Reserva Automática de Estoque
                  </span>
                  <p className="text-[11px] text-muted mt-0.5">
                    Tempo em que as peças ficam reservadas aguardando a
                    confirmação do cliente antes de voltarem automaticamente ao
                    estoque.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {RESERVATION_TTL_PRESETS.map((preset) => {
                    const active =
                      Number(settingsForm.reservationTtlMinutes) ===
                      preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          setSettingsForm({
                            ...settingsForm,
                            reservationTtlMinutes: String(preset.value),
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          active
                            ? 'bg-brand text-on-brand border-brand'
                            : 'bg-surface text-ink border-line hover:border-brand'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <label className="retail-field">
                  <span>Ou informe em minutos (5 a 1440)</span>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={settingsForm.reservationTtlMinutes}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        reservationTtlMinutes: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <button
                type="submit"
                disabled={savingSettings}
                className="retail-button retail-button-primary sm:min-w-[180px]"
              >
                {savingSettings ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>Salvar Configurações</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* ABA 7: MÓDULO 99 ENTREGAS (FRETE POR KM, MOTO/CARRO & API/PORTAL)    */}
      {/* ==================================================================== */}
      {activeTab === 'delivery' && (
        <StorefrontExpressDeliveryTab
          initialConfig={expressDeliveryCfg}
          deliveryEnabled={Boolean(settingsForm.deliveryEnabled)}
          deliveryFeeNote={settingsForm.deliveryNotes}
          onSaved={async () => {
            const ovRes = await api.get('/storefront/admin/overview');
            applyOverviewData(ovRes.data);
          }}
        />
      )}
        </motion.div>
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* DIALOG 1: PERSONALIZAR PRODUTO NA VITRINE                            */}
      {/* ==================================================================== */}
      {editingProduct && (
        <RetailDialog
          title={`Personalizar na Vitrine: ${editingProduct.name}`}
          onClose={() => setEditingProduct(null)}
          busy={saving}
          wide
        >
          <form onSubmit={handleSaveProductModal} className="space-y-4">
            <div className="p-3 rounded-xl border border-line bg-page flex items-center gap-3">
              <StockItemThumb
                name={editingProduct.displayTitle || editingProduct.name}
                imageUrl={editingProduct.imageUrl}
                size="lg"
              />
              <div className="min-w-0">
                <p className="font-bold text-sm text-ink truncate">
                  {editingProduct.displayTitle || editingProduct.name}
                </p>
                <p className="text-xs text-muted">
                  {money(editingProduct.priceSale)} •{' '}
                  {editingProduct.availableStock ?? 0} un. disponíveis no PDV
                </p>
              </div>
            </div>

            <div className="retail-form-grid">
              <label className="retail-field">
                <span>Título público na vitrine</span>
                <input
                  type="text"
                  value={editingProduct.displayTitle || ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      displayTitle: e.target.value,
                    })
                  }
                  placeholder={editingProduct.name}
                />
              </label>

              <label className="retail-field">
                <span>Slug na URL da peça</span>
                <input
                  type="text"
                  value={editingProduct.publicSlug || ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      publicSlug: e.target.value,
                    })
                  }
                />
              </label>

              <div className="retail-field retail-field-wide">
                <span>Selo promocional no card (opcional)</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    value={editingProduct.badgeLabel || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        badgeLabel: e.target.value,
                      })
                    }
                    placeholder="Ex: Lançamento, Últimas Peças..."
                    className="flex-1"
                  />
                  {editingProduct.badgeLabel && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingProduct({ ...editingProduct, badgeLabel: '' })
                      }
                      className="retail-button retail-button-ghost"
                      style={{ minHeight: 38, padding: '0 12px', fontSize: 12 }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {BADGE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setEditingProduct({
                          ...editingProduct,
                          badgeLabel: preset,
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        editingProduct.badgeLabel === preset
                          ? 'bg-brand text-on-brand border-brand'
                          : 'bg-page text-ink border-line hover:border-brand'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <label className="retail-field retail-field-wide">
                <span>Descrição detalhada para o cliente (tecido, caimento, medidas)</span>
                <textarea
                  rows={3}
                  value={editingProduct.customDescription || ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      customDescription: e.target.value,
                    })
                  }
                  placeholder="Descreva os detalhes da peça para ajudar o cliente na escolha..."
                />
              </label>
            </div>

            {/* Galeria Adicional de Fotos da Peça */}
            <div className="p-3.5 rounded-xl border border-line bg-page space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold block">
                    Galeria de Fotos Adicionais (até 6 imagens extras)
                  </span>
                  <span className="text-[11px] text-muted">
                    A foto principal vem do grupo de mercadoria. Adicione outros
                    ângulos ou detalhes aqui.
                  </span>
                </div>
                <label className="retail-button retail-button-secondary cursor-pointer text-xs">
                  {uploadingGalleryPhoto ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  <span>Adicionar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingGalleryPhoto}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadProductGalleryImage(f);
                    }}
                  />
                </label>
              </div>

              {Array.isArray(editingProduct.galleryUrls) &&
              editingProduct.galleryUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {editingProduct.galleryUrls.map(
                    (url: string, idx: number) => (
                      <div
                        key={`${url}-${idx}`}
                        className="relative w-16 h-20 group"
                      >
                        <StorefrontProductFrame
                          imageUrl={url}
                          alt=""
                          productName={editingProduct.name}
                          padding="xs"
                          aspectClassName="w-16 h-20"
                          roundedClassName="rounded-xl border border-line"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = editingProduct.galleryUrls.filter(
                              (_: string, i: number) => i !== idx,
                            );
                            setEditingProduct({
                              ...editingProduct,
                              galleryUrls: next,
                            });
                          }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/80 text-on-brand flex items-center justify-center"
                          title="Remover foto"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Nenhuma foto extra cadastrada para esta peça.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-line bg-page">
              <RetailSwitch
                checked={Boolean(editingProduct.isVisible)}
                onCheckedChange={(checked) =>
                  setEditingProduct({ ...editingProduct, isVisible: checked })
                }
                label="Visível na Vitrine Online"
                description="Exibe esta peça para clientes no catálogo público."
              />
              <RetailSwitch
                checked={Boolean(editingProduct.featured)}
                onCheckedChange={(checked) =>
                  setEditingProduct({ ...editingProduct, featured: checked })
                }
                label="Destacar na Página Inicial"
                description="Mostra na seção de Seleção Especial da vitrine."
              />
            </div>

            <div className="px-3 py-2 rounded-xl border border-line bg-page flex items-center gap-2 text-xs text-muted">
              <AlertCircle size={14} className="text-brand shrink-0" />
              <span>
                <strong className="text-ink">Efeito imediato:</strong> ao salvar,
                estas informações entram no ar imediatamente na loja publicada.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="retail-button retail-button-ghost"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="retail-button retail-button-primary sm:min-w-[136px]"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                <span>Salvar Peça</span>
              </button>
            </div>
          </form>
        </RetailDialog>
      )}

      {/* ==================================================================== */}
      {/* DIALOG 2: CRIAR NOVA CATEGORIA                                       */}
      {/* ==================================================================== */}
      {showNewCategoryDialog && (
        <RetailDialog
          title="Nova Categoria de Produtos"
          onClose={() => setShowNewCategoryDialog(false)}
          busy={saving}
        >
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <label className="retail-field">
              <span>Nome da categoria *</span>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Vestidos, Camisetas, Calçados..."
              />
            </label>

            <label className="retail-field">
              <span>Descrição curta para a vitrine (opcional)</span>
              <input
                type="text"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Ex: Peças leves para o dia a dia"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCategoryDialog(false)}
                className="retail-button retail-button-ghost"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="retail-button retail-button-primary"
              >
                <Plus size={15} />
                <span>Criar Categoria</span>
              </button>
            </div>
          </form>
        </RetailDialog>
      )}

      {/* ==================================================================== */}
      {/* DIALOG 3: CONVERTER PEDIDO EM VENDA NO PDV                           */}
      {/* ==================================================================== */}
      {showConvertDialog && selectedOrder && (
        <RetailDialog
          title={`Faturar Pedido ${selectedOrder.reference} no PDV`}
          onClose={() => setShowConvertDialog(false)}
          busy={saving}
        >
          <form onSubmit={handleConvertOrderToSale} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-support/50 border border-brand text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-ink">
                  Cliente: {selectedOrder.customerName}
                </p>
                <OperatorInlineBadge
                  label="Operador:"
                  name={shiftOperator?.name || authUser?.name || 'Administrador'}
                  imageUrl={shiftOperator?.imageUrl || authUser?.imageUrl}
                  operatorId={shiftOperator?.id || authUser?.id}
                  size="xs"
                  variant="pill"
                />
              </div>
              <p className="text-muted">
                Esta ação consumirá definitivamente a reserva de estoque e
                registrará a venda no histórico do PDV Lojista.
              </p>
              {Array.isArray(selectedOrder.items) &&
                selectedOrder.items.length > 0 && (
                  <div className="pt-1 space-y-1.5">
                    {selectedOrder.items.map((it: any, itIdx: number) => (
                      <div
                        key={it.id || itIdx}
                        className="flex items-center justify-between gap-2 rounded-lg bg-surface border border-line px-2.5 py-1.5"
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <StockItemThumb
                            name={it.productName}
                            imageUrl={it.imageUrl}
                            size="xs"
                          />
                          <span className="font-semibold text-ink truncate">
                            {it.quantity}x {it.productName}
                          </span>
                        </span>
                        <span className="font-bold text-ink shrink-0">
                          {money(it.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              <p className="font-black text-base text-brand pt-1">
                Total a faturar: {money(selectedOrder.total)}
              </p>
            </div>

            <div className="retail-field">
              <span>Forma de pagamento utilizada *</span>
              <RetailSelect
                value={convertPaymentMethod}
                onValueChange={setConvertPaymentMethod}
                options={
                  paymentMethods.length > 0
                    ? paymentMethods.map((m: any) => ({
                        value: m.name,
                        label: m.name,
                      }))
                    : [
                        { value: 'Pix', label: 'Pix' },
                        {
                          value: 'Cartão de Crédito',
                          label: 'Cartão de Crédito',
                        },
                        {
                          value: 'Cartão de Débito',
                          label: 'Cartão de Débito',
                        },
                        { value: 'Dinheiro', label: 'Dinheiro' },
                      ]
                }
              />
            </div>

            <label className="retail-field">
              <span>CPF / CNPJ do cliente na venda (opcional)</span>
              <input
                type="text"
                value={convertCustomerDoc}
                onChange={(e) => setConvertCustomerDoc(e.target.value)}
                placeholder="000.000.000-00"
              />
            </label>

            <label className="retail-field">
              <span>Observação interna da venda</span>
              <input
                type="text"
                value={convertObservation}
                onChange={(e) => setConvertObservation(e.target.value)}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConvertDialog(false)}
                className="retail-button retail-button-ghost"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="retail-button retail-button-primary"
              >
                <CheckCircle2 size={16} />
                <span>Confirmar e Gerar Venda</span>
              </button>
            </div>
          </form>
        </RetailDialog>
      )}

      {/* ==================================================================== */}
      {/* DIALOG 4: CANCELAR OU RECUSAR PEDIDO COM MOTIVO                      */}
      {/* ==================================================================== */}
      {orderActionModal && (
        <RetailDialog
          title={
            orderActionModal.action === 'reject'
              ? `Recusar Pedido ${orderActionModal.order.reference}`
              : `Cancelar Pedido ${orderActionModal.order.reference}`
          }
          onClose={() => setOrderActionModal(null)}
          busy={saving}
        >
          <form
            onSubmit={handleSubmitOrderCancelOrReject}
            className="space-y-4"
          >
            <p className="text-xs text-muted leading-relaxed">
              Ao confirmar, as peças reservadas neste pedido serão
              imediatamente devolvidas ao saldo disponível da loja.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-bold block">
                Motivo rápido (clique para preencher):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOrderActionReason(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      orderActionReason === preset
                        ? 'bg-brand text-on-brand border-brand'
                        : 'bg-page text-ink border-line hover:border-brand'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <label className="retail-field">
              <span>Descrição do motivo</span>
              <input
                type="text"
                value={orderActionReason}
                onChange={(e) => setOrderActionReason(e.target.value)}
                placeholder="Informe o motivo para registro no histórico do pedido..."
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderActionModal(null)}
                className="retail-button retail-button-ghost"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="retail-button retail-button-primary"
              >
                <span>
                  {orderActionModal.action === 'reject'
                    ? 'Confirmar Recusa e Liberar Estoque'
                    : 'Confirmar Cancelamento'}
                </span>
              </button>
            </div>
          </form>
        </RetailDialog>
      )}

      {/* ==================================================================== */}
      {/* DIALOG 5: RESUMO DE ESTADO E MUDANÇAS ANTES DE PUBLICAR              */}
      {/* ==================================================================== */}
      {showPublishDialog && (
        <RetailDialog
          title="Publicar Loja Virtual — Estado atual e resumo das mudanças"
          onClose={() => setShowPublishDialog(false)}
          busy={publishing}
          wide
        >
          {(() => {
            const phoneDigits = String(settingsForm.whatsappPhone || '').replace(
              /\D/g,
              '',
            );
            const missingWhatsapp = phoneDigits.length < 10;
            const missingFulfillment =
              !settingsForm.pickupEnabled && !settingsForm.deliveryEnabled;
            const hasBlocker = missingWhatsapp || missingFulfillment;

            return (
              <div className="space-y-4">
                {/* Estado atual da vitrine */}
                <div className="p-3.5 rounded-xl border border-line bg-page flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">
                      Estado atual antes desta publicação
                    </span>
                    <p className="text-sm font-semibold text-ink">
                      {isPublished
                        ? `● Loja publicada no ar${publishedVersion > 0 ? ` (versão v${publishedVersion})` : ''}`
                        : hasEverPublished
                          ? `◐ Vitrine pausada (última versão v${publishedVersion})`
                          : '○ Rascunho inicial — primeira publicação da vitrine'}
                    </p>
                    <p className="text-xs text-muted font-mono break-all">
                      {publicStoreUrl}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-support text-brand border border-brand shrink-0">
                    {pendingPublishChanges.length > 0
                      ? `${pendingPublishChanges.length} alteração(ões) detectada(s)`
                      : 'Republicação sincronizada'}
                  </span>
                </div>

                {/* Bloqueios operacionais obrigatórios */}
                {hasBlocker && (
                  <div className="p-3.5 rounded-xl border border-brand bg-support/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>
                        Conclua os requisitos operacionais antes de publicar:
                      </span>
                    </div>
                    <ul className="text-xs text-ink space-y-1 pl-5 list-disc">
                      {missingWhatsapp && (
                        <li>
                          Informe o WhatsApp oficial de atendimento (com DDD) na
                          aba Configurações.
                        </li>
                      )}
                      {missingFulfillment && (
                        <li>
                          Habilite ao menos uma modalidade de recebimento
                          (Retirada na loja ou Entrega local).
                        </li>
                      )}
                    </ul>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPublishDialog(false);
                          setTab('settings');
                        }}
                        className="retail-button retail-button-secondary text-xs"
                      >
                        Ir para Configurações
                      </button>
                    </div>
                  </div>
                )}

                {/* Resumo claro das mudanças */}
                <div className="p-3.5 rounded-xl border border-line bg-surface space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Sparkles size={14} className="text-brand shrink-0" />
                    <span>Resumo das mudanças que entrarão no ar</span>
                  </div>
                  {pendingPublishChanges.length === 0 ? (
                    <p className="text-xs text-muted">
                      Nenhuma diferença estrutural pendente em relação à última
                      versão publicada — confirmar atualizará o selo de
                      publicação mantendo a vitrine ativa.
                    </p>
                  ) : (
                    <ul className="text-xs text-ink space-y-1.5 pl-5 list-disc">
                      {pendingPublishChanges.map((change, idx) => (
                        <li key={idx}>{change}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Avisos de curadoria (destinos ocultos ou peças sem estoque) */}
                {curatorialWarnings.length > 0 && (
                  <div className="p-3.5 rounded-xl border border-brand bg-support/40 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>
                        Atenção de curadoria ({curatorialWarnings.length}) — não
                        impede a publicação, mas vale revisar:
                      </span>
                    </div>
                    <ul className="text-xs text-ink space-y-1 pl-5 list-disc max-h-36 overflow-y-auto">
                      {curatorialWarnings.map((w, idx) => (
                        <li key={idx}>{w.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    disabled={savingDraft || publishing}
                    onClick={handleSaveDraftOnly}
                    className="retail-button retail-button-secondary sm:min-w-[168px]"
                  >
                    {savingDraft ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    <span>Salvar apenas rascunho</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={publishing}
                      onClick={() => setShowPublishDialog(false)}
                      className="retail-button retail-button-ghost"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={publishing || hasBlocker}
                      onClick={handleConfirmPublish}
                      className="retail-button retail-button-primary sm:min-w-[186px]"
                    >
                      {publishing ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Send size={15} />
                      )}
                      <span>Confirmar e publicar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </RetailDialog>
      )}
    </div>
  );
}
