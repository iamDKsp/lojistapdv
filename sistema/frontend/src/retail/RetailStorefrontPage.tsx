import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  FolderKanban,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Loader2,
  MapPin,
  MessageCircle,
  Monitor,
  Package,
  Palette,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Smartphone,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getFullUrl } from '@/lib/getFullUrl';
import PdvLojistaLoader from '@/components/PdvLojistaLoader';
import {
  CategoryIconBadge,
  CategoryIconIllustration,
} from '@/components/CategoryIcons';
import { RetailSelect } from '@/components/ui/Select';
import { RetailSwitch } from '@/components/ui/Switch';
import { StorefrontHomeView } from '@/storefront/PublicStorefrontApp';
import { RetailDialog } from './RetailDialog';
import { apiError, money } from './types';

type TabKey =
  | 'overview'
  | 'settings'
  | 'appearance'
  | 'products'
  | 'categories'
  | 'orders';

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

const TEMPLATE_OPTIONS = [
  {
    id: 'editorial_roxo',
    name: 'Editorial Roxo',
    desc: 'Vitrine boutique com destaque de marca, cartões suaves e leitura acolhedora.',
    bgPreview: '#F8F7FC',
    cardPreview: '#FFFFFF',
    textPreview: '#272321',
  },
  {
    id: 'minimal_branco',
    name: 'Minimalista Branco',
    desc: 'Foco absoluto nas fotos das peças com fundo branco puro e linhas retas.',
    bgPreview: '#FFFFFF',
    cardPreview: '#F8F7FC',
    textPreview: '#272321',
  },
  {
    id: 'vitrine_escura',
    name: 'Vitrine Escura',
    desc: 'Contraste intenso com fundo grafite escuro e detalhes em roxo e lavanda.',
    bgPreview: '#272321',
    cardPreview: '#272321',
    textPreview: '#FFFFFF',
  },
];

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

  const activeTab: TabKey = useMemo(() => {
    const p = location.pathname;
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
      products: '/loja-virtual/produtos',
      categories: '/loja-virtual/categorias',
      appearance: '/loja-virtual/aparencia',
      settings: '/loja-virtual/configuracoes',
    };
    navigate(routes[tab]);
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [overview, setOverview] = useState<any>(null);

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
  const [draftTheme, setDraftTheme] = useState<any>({
    template: 'editorial_roxo',
    primaryColor: '#7C3AED',
    accentColor: '#6D28D9',
    surfaceColor: '#F8F7FC',
    textColor: '#272321',
    announcementText: '',
    heroTitle: '',
    heroSubtitle: '',
    heroCtaLabel: 'Ver coleção',
    banners: [],
    sections: [],
  });
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>(
    'desktop',
  );
  // Estados interativos dentro do Live Preview
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewCategoryId, setPreviewCategoryId] = useState('');
  const [previewSize, setPreviewSize] = useState('');
  const [previewColor, setPreviewColor] = useState('');
  const [previewSortBy, setPreviewSortBy] = useState('featured');
  const [previewInStockOnly, setPreviewInStockOnly] = useState(false);

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productVisibilityFilter, setProductVisibilityFilter] = useState<
    'all' | 'visible' | 'hidden' | 'featured' | 'out_of_stock'
  >('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
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

  const applyOverviewData = useCallback((ovData: any) => {
    setOverview(ovData);
    const cfg = ovData?.config;
    if (cfg) {
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
        deliveryNotes: cfg.deliveryNotes || '',
        reservationTtlMinutes: String(cfg.reservationTtlMinutes ?? '30'),
      });
      if (cfg.draftTheme) {
        setDraftTheme(cfg.draftTheme);
      }
    }
  }, []);

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

      applyOverviewData(ovRes.data);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setOrders(ordRes.data?.items || []);

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
      const items = ordRes.data?.items || [];
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
      setProducts(prodRes.data || []);
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao atualizar lista de produtos.'));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const publicStoreUrl = useMemo(() => {
    const slug = overview?.config?.slug || settingsForm.slug || 'minha-loja';
    return `${window.location.origin}/loja/${slug}`;
  }, [overview?.config?.slug, settingsForm.slug]);

  const buildSettingsPayload = () => ({
    ...settingsForm,
    deliveryFeeDefault: Number(settingsForm.deliveryFeeDefault || 0),
    reservationTtlMinutes: Number(settingsForm.reservationTtlMinutes || 30),
  });

  // Salvar configurações
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.put('/storefront/admin/settings', buildSettingsPayload());
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data);
      toast.success('Configurações da loja salvas com sucesso!');
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar configurações.'));
    } finally {
      setSaving(false);
    }
  };

  // Salvar rascunho de aparência + configurações
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.put('/storefront/admin/settings', buildSettingsPayload()),
        api.put('/storefront/admin/appearance/draft', draftTheme),
      ]);
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data);
      toast.success('Rascunho salvo com sucesso!');
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar rascunho.'));
    } finally {
      setSaving(false);
    }
  };

  // Publicar loja (salva automaticamente settings + draftTheme antes de publicar)
  const handlePublish = async () => {
    const phoneDigits = String(settingsForm.whatsappPhone || '').replace(
      /\D/g,
      '',
    );
    if (phoneDigits.length < 10) {
      toast.error(
        'Informe o WhatsApp de atendimento antes de publicar a loja.',
      );
      setTab('settings');
      return;
    }
    if (!settingsForm.pickupEnabled && !settingsForm.deliveryEnabled) {
      toast.error(
        'Habilite pelo menos uma modalidade (Retirada na loja ou Entrega) para publicar.',
      );
      setTab('settings');
      return;
    }

    setPublishing(true);
    try {
      const res = await api.post('/storefront/admin/appearance/publish', {
        settings: buildSettingsPayload(),
        draftTheme,
      });
      toast.success(res.data?.message || 'Loja Virtual publicada no ar!');
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data);
    } catch (err: any) {
      const msg = apiError(err, 'Não foi possível publicar a loja.');
      toast.error(msg);
      if (msg.toLowerCase().includes('produto')) {
        setTab('products');
      } else if (msg.toLowerCase().includes('whatsapp')) {
        setTab('settings');
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      const res = await api.post('/storefront/admin/appearance/unpublish');
      toast.success(res.data?.message || 'Loja Virtual pausada.');
      const ovRes = await api.get('/storefront/admin/overview');
      applyOverviewData(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao pausar loja.'));
    } finally {
      setPublishing(false);
    }
  };

  // Upload de mídia (logo, capa, banner, galeria)
  const handleUploadMedia = async (
    file: File,
    target: 'logoUrl' | 'coverUrl',
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    setSaving(true);
    try {
      const res = await api.post('/storefront/admin/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = res.data?.imageUrl;
      if (imageUrl) {
        const updatedSettings = {
          ...settingsForm,
          [target]: imageUrl,
        };
        setSettingsForm(updatedSettings);
        await api.put('/storefront/admin/settings', {
          ...updatedSettings,
          deliveryFeeDefault: Number(updatedSettings.deliveryFeeDefault || 0),
          reservationTtlMinutes: Number(
            updatedSettings.reservationTtlMinutes || 30,
          ),
        });
        toast.success(
          target === 'logoUrl'
            ? 'Logotipo atualizado!'
            : 'Imagem de capa atualizada!',
        );
      }
    } catch (err) {
      toast.error(apiError(err, 'Erro ao enviar imagem.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadBannerImage = async (file: File, bannerIndex: number) => {
    const fd = new FormData();
    fd.append('file', file);
    setSaving(true);
    try {
      const res = await api.post('/storefront/admin/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = res.data?.imageUrl;
      if (imageUrl) {
        const nextBanners = [...(draftTheme.banners || [])];
        if (nextBanners[bannerIndex]) {
          nextBanners[bannerIndex] = {
            ...nextBanners[bannerIndex],
            imageUrl,
          };
          setDraftTheme({ ...draftTheme, banners: nextBanners });
          toast.success('Imagem do banner enviada!');
        }
      }
    } catch (err) {
      toast.error(apiError(err, 'Erro ao enviar imagem do banner.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadProductGalleryImage = async (file: File) => {
    if (!editingProduct) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploadingGalleryPhoto(true);
    try {
      const res = await api.post('/storefront/admin/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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

  // Produtos: alternância rápida e ações em lote
  const handleQuickToggleProduct = async (
    product: any,
    field: 'isVisible' | 'featured',
  ) => {
    const nextVal = !product[field];
    // Atualização otimista local
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
    }
  };

  const handleBatchProducts = async (
    action: 'show' | 'hide' | 'feature' | 'unfeature',
    explicitIds?: string[],
  ) => {
    const targetIds = explicitIds || selectedProductIds;
    if (targetIds.length === 0) {
      toast.info('Selecione ao menos um produto na tabela.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/storefront/admin/products/batch', {
        retailGroupIds: targetIds,
        action,
      });
      toast.success(
        `${res.data?.updatedCount || targetIds.length} produto(s) atualizado(s) na vitrine!`,
      );
      setSelectedProductIds([]);
      await refreshProductsAndOverview();
    } catch (err) {
      toast.error(apiError(err, 'Erro na atualização em lote.'));
    } finally {
      setSaving(false);
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
    if (!editingProduct) return;
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
      toast.success('Configurações da peça salvas!');
      setEditingProduct(null);
      await refreshProductsAndOverview();
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar peça.'));
    } finally {
      setSaving(false);
    }
  };

  // Categorias
  const handleSaveCategories = async () => {
    setSaving(true);
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
      toast.success('Categorias da vitrine salvas!');
      const [catRes, ovRes] = await Promise.all([
        api.get('/storefront/admin/categories'),
        api.get('/storefront/admin/overview'),
      ]);
      setCategories(catRes.data || []);
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao salvar categorias.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
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
      setCategories(catRes.data || []);
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Erro ao criar categoria.'));
    } finally {
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
      setSelectedOrder(res.data);
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
      setSelectedOrder(res.data);
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
      setSelectedOrder(res.data);
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
      setSelectedOrder(res.data?.order || null);
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

  // Dados normalizados e interativos para o Live Preview na aba Aparência
  const livePreviewStoreData = useMemo(() => {
    const visibleCats = categories
      .filter((c) => c.isVisible !== false)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.publicSlug,
        description: c.description,
        productCount: c.productCount,
      }));

    const baseVisibleProducts = products
      .filter((p) => p.isVisible)
      .map((p) => ({
        id: p.id,
        title: p.displayTitle || p.name,
        slug: p.publicSlug || p.id,
        description: p.customDescription || p.description,
        imageUrl: p.imageUrl,
        galleryUrls: Array.isArray(p.galleryUrls) ? p.galleryUrls : [],
        price: p.priceSale,
        badgeLabel: p.badgeLabel,
        featured: Boolean(p.featured),
        totalAvailableStock: Number(p.availableStock ?? 0),
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
      }));

    // Aplica filtros interativos do preview
    const previewFiltered = baseVisibleProducts.filter((prod) => {
      if (
        previewCategoryId &&
        prod.category?.id !== previewCategoryId &&
        prod.category?.slug !== previewCategoryId
      ) {
        return false;
      }
      if (previewSize && !(prod.sizes || []).includes(previewSize)) {
        return false;
      }
      if (previewColor && !(prod.colors || []).includes(previewColor)) {
        return false;
      }
      if (previewInStockOnly && Number(prod.totalAvailableStock || 0) <= 0) {
        return false;
      }
      if (previewSearch.trim()) {
        const q = previewSearch.trim().toLowerCase();
        if (!String(prod.title || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    return {
      publicId: overview?.config?.publicId || 'preview',
      slug: settingsForm.slug || 'minha-loja',
      storeName: settingsForm.storeName || 'Minha Loja',
      tagline: settingsForm.tagline,
      description: settingsForm.description,
      logoUrl: settingsForm.logoUrl,
      coverUrl: settingsForm.coverUrl,
      whatsappPhone: settingsForm.whatsappPhone,
      address: settingsForm.address,
      businessHours: settingsForm.businessHours,
      fulfillment: {
        pickupEnabled: settingsForm.pickupEnabled,
        deliveryEnabled: settingsForm.deliveryEnabled,
        deliveryFeeDefault: Number(settingsForm.deliveryFeeDefault || 0),
        pickupInstructions: settingsForm.pickupInstructions,
        deliveryNotes: settingsForm.deliveryNotes,
      },
      theme: draftTheme,
      categories: visibleCats,
      featuredProducts: baseVisibleProducts
        .filter((p) => p.featured)
        .slice(0, 4),
      previewProducts: previewFiltered,
    };
  }, [
    categories,
    products,
    overview?.config?.publicId,
    settingsForm,
    draftTheme,
    previewCategoryId,
    previewSize,
    previewColor,
    previewInStockOnly,
    previewSearch,
  ]);

  if (loading && !overview) {
    return (
      <div className="py-20 flex justify-center">
        <PdvLojistaLoader label="Carregando módulo de Loja Virtual..." />
      </div>
    );
  }

  const isPublished = overview?.config?.status === 'PUBLISHED';
  const metrics = overview?.metrics || {};
  const checklist = overview?.readinessChecklist || [];
  const pendingChecklistCount = checklist.filter((c: any) => !c.done).length;
  const pendingOrders = orders.filter(
    (o) =>
      o.commercialStatus === 'AWAITING_CONFIRMATION' ||
      (o.commercialStatus === 'CONFIRMED' &&
        o.fulfillmentStatus !== 'DELIVERED'),
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho Nativo do Módulo de Gestão */}
      <div className="retail-page-header">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <span className="retail-kicker">Canal de Vendas Online</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                isPublished
                  ? 'bg-support text-brand border-brand'
                  : 'bg-page text-muted border-line'
              }`}
            >
              {isPublished ? '● Loja Publicada' : '○ Rascunho Offline'}
            </span>
            {overview?.hasUnpublishedChanges && isPublished && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-page text-brand border border-line">
                Alterações de aparência pendentes de publicação
              </span>
            )}
          </div>
          <h1>{settingsForm.storeName || 'Loja Virtual'}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted">
            <span className="font-mono text-ink bg-page px-2.5 py-1 rounded-lg border border-line">
              {publicStoreUrl}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicStoreUrl);
                toast.success('Link da loja copiado!');
              }}
              className="retail-button retail-button-ghost"
              style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
            >
              <Copy size={13} /> Copiar link
            </button>
            {isPublished && (
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="retail-button retail-button-ghost"
                style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
              >
                <ExternalLink size={13} /> Abrir vitrine
              </a>
            )}
          </div>
        </div>

        <div className="retail-header-actions">
          <button
            type="button"
            disabled={saving || publishing}
            onClick={handleSaveDraft}
            className="retail-button retail-button-secondary"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>Salvar Alterações</span>
          </button>

          {isPublished && (
            <button
              type="button"
              disabled={publishing}
              onClick={handleUnpublish}
              className="retail-button retail-button-ghost"
            >
              <EyeOff size={16} />
              <span>Pausar Vitrine</span>
            </button>
          )}

          <button
            type="button"
            disabled={publishing || saving}
            onClick={handlePublish}
            className="retail-button retail-button-primary"
          >
            {publishing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            <span>
              {isPublished ? 'Publicar Atualizações' : 'Publicar Loja'}
            </span>
          </button>
        </div>
      </div>

      {/* Barra de Sub-navegação Interna */}
      <div className="retail-panel" style={{ padding: '8px 10px' }}>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            {
              key: 'overview' as const,
              label: 'Visão Geral',
              icon: Store,
              badge:
                pendingChecklistCount > 0 && !isPublished
                  ? `${pendingChecklistCount} pend.`
                  : null,
            },
            {
              key: 'orders' as const,
              label: 'Pedidos & Reservas',
              icon: ShoppingBag,
              badge:
                metrics.awaitingConfirmationCount > 0
                  ? String(metrics.awaitingConfirmationCount)
                  : null,
            },
            {
              key: 'products' as const,
              label: 'Produtos na Vitrine',
              icon: Package,
              badge: `${metrics.publishedProductsCount || 0}/${metrics.totalProductsCount || 0}`,
            },
            {
              key: 'categories' as const,
              label: 'Categorias',
              icon: FolderKanban,
              badge: String(metrics.visibleCategoriesCount || 0),
            },
            {
              key: 'appearance' as const,
              label: 'Aparência & Preview',
              icon: Palette,
              badge: null,
            },
            {
              key: 'settings' as const,
              label: 'Configurações',
              icon: Settings,
              badge: null,
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 whitespace-nowrap ${
                  active
                    ? 'bg-brand text-on-brand shadow-xs'
                    : 'text-muted hover:text-ink hover:bg-page'
                }`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      active
                        ? 'bg-surface text-brand'
                        : 'bg-support text-brand'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Fila Imediata de Atendimento de Pedidos */}
            <div className="lg:col-span-7 retail-panel space-y-4">
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
            <div className="lg:col-span-5 retail-panel space-y-4">
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
                          className="px-2.5 py-1 rounded-lg bg-brand text-on-brand text-[11px] font-bold shrink-0 hover:bg-brand-strong transition"
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 retail-panel p-0 overflow-hidden">
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

            <div className="lg:col-span-7">
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
                            <div className="w-10 h-12 rounded-lg overflow-hidden border border-line bg-page shrink-0">
                              {item.imageUrl ? (
                                <img
                                  src={getFullUrl(item.imageUrl)}
                                  alt=""
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
                              <p className="font-bold text-ink truncate">
                                {item.productName}
                              </p>
                              <p className="text-muted">
                                {[
                                  item.size && `Tam: ${item.size}`,
                                  item.color && `Cor: ${item.color}`,
                                  `Qtd: ${item.quantity}`,
                                  `Unit: ${money(item.priceSaleSnapshot)}`,
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

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
                      <span className="text-xs font-bold text-muted">
                        Total do Pedido (c/ entrega de{' '}
                        {money(selectedOrder.deliveryFee || 0)})
                      </span>
                      <span className="text-lg font-black text-ink">
                        {money(selectedOrder.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3: PRODUTOS NA VITRINE                                           */}
      {/* ==================================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="retail-panel space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="retail-kicker">Curadoria do Catálogo</span>
                <h2 className="text-base font-black">
                  Grupos de Mercadorias na Vitrine Online
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handlePublishAllAvailableProducts}
                  className="retail-button retail-button-secondary"
                  style={{ minHeight: 36, fontSize: 12 }}
                >
                  <CheckCircle2 size={15} />
                  <span>Publicar todos com estoque</span>
                </button>
              </div>
            </div>

            {/* Filtros de Produtos */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
              <div className="md:col-span-5 relative">
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

              <div className="md:col-span-3">
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

              <div className="md:col-span-4 flex items-center gap-1.5 overflow-x-auto">
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

            {/* Barra de Ação em Lote quando há itens selecionados */}
            {selectedProductIds.length > 0 && (
              <div className="p-3 rounded-xl bg-support border border-brand flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-brand">
                  {selectedProductIds.length} produto(s) selecionado(s)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBatchProducts('show')}
                    className="px-3 py-1.5 rounded-lg bg-brand text-on-brand text-xs font-bold"
                  >
                    Exibir na vitrine
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchProducts('hide')}
                    className="px-3 py-1.5 rounded-lg bg-surface text-ink border border-line text-xs font-bold"
                  >
                    Ocultar da vitrine
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchProducts('feature')}
                    className="px-3 py-1.5 rounded-lg bg-surface text-brand border border-brand text-xs font-bold"
                  >
                    Marcar destaque
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchProducts('unfeature')}
                    className="px-3 py-1.5 rounded-lg bg-surface text-muted border border-line text-xs font-bold"
                  >
                    Remover destaque
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-xs font-bold text-muted hover:text-ink px-2"
                  >
                    Limpar seleção
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="retail-table-wrap">
            <table className="retail-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedProductIds.length === filteredProducts.length
                      }
                      onChange={(e) =>
                        setSelectedProductIds(
                          e.target.checked
                            ? filteredProducts.map((p) => p.id)
                            : [],
                        )
                      }
                      className="rounded accent-brand"
                    />
                  </th>
                  <th>Peça / Grupo</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Saldo Disponível</th>
                  <th>Visível na Loja</th>
                  <th>Destaque</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      Nenhuma peça encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const checked = selectedProductIds.includes(p.id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedProductIds((prev) =>
                                e.target.checked
                                  ? [...prev, p.id]
                                  : prev.filter((id) => id !== p.id),
                              );
                            }}
                            className="rounded accent-brand"
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-13 rounded-xl overflow-hidden border border-line bg-page shrink-0">
                              {p.imageUrl ? (
                                <img
                                  src={getFullUrl(p.imageUrl)}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <CategoryIconIllustration
                                  categoryName={p.categoryName}
                                  productName={p.name}
                                  compact
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-ink truncate">
                                  {p.displayTitle || p.name}
                                </p>
                                {p.badgeLabel && (
                                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-support text-brand">
                                    {p.badgeLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted font-mono">
                                /{p.publicSlug}
                                {Array.isArray(p.galleryUrls) &&
                                  p.galleryUrls.length > 0 &&
                                  ` • +${p.galleryUrls.length} foto(s)`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {p.categoryName ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-page border border-line text-xs font-bold">
                              <CategoryIconBadge
                                categoryName={p.categoryName}
                                size={14}
                              />
                              <span>{p.categoryName}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted">
                              Sem categoria
                            </span>
                          )}
                        </td>
                        <td className="font-bold">{money(p.priceSale)}</td>
                        <td>
                          <div>
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
                              <span className="text-[11px] text-muted ml-1.5">
                                ({p.reservedStock} reserv.)
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <RetailSwitch
                            size="sm"
                            checked={Boolean(p.isVisible)}
                            onCheckedChange={() =>
                              handleQuickToggleProduct(p, 'isVisible')
                            }
                            label={p.isVisible ? 'Visível' : 'Oculto'}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickToggleProduct(p, 'featured')
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 border transition ${
                              p.featured
                                ? 'bg-brand text-on-brand border-brand'
                                : 'bg-page text-muted border-line hover:text-ink'
                            }`}
                          >
                            <Star size={12} />
                            <span>{p.featured ? 'Destaque' : 'Normal'}</span>
                          </button>
                        </td>
                        <td className="text-right">
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
                              minHeight: 32,
                              padding: '4px 10px',
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 4: CATEGORIAS DA VITRINE                                         */}
      {/* ==================================================================== */}
      {activeTab === 'categories' && (
        <div className="retail-panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <span className="retail-kicker">Navegação da Loja</span>
              <h2 className="text-base font-black">
                Ordem e Visibilidade das Categorias
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Use as setas para definir a ordem em que as categorias aparecem
                na vitrine pública.
              </p>
            </div>

            <div className="flex items-center gap-2">
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
                disabled={saving}
                onClick={handleSaveCategories}
                className="retail-button retail-button-primary"
                style={{ minHeight: 38, fontSize: 12 }}
              >
                <Save size={15} />
                <span>Salvar Categorias</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-xl border border-line bg-page grid grid-cols-1 md:grid-cols-12 items-center gap-3"
              >
                <div className="md:col-span-4 flex items-center gap-3">
                  <div className="flex flex-col gap-1">
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

                <div className="md:col-span-3">
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

                <div className="md:col-span-3">
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
      {/* ABA 5: APARÊNCIA & PREVIEW INTERATIVO                                */}
      {/* ==================================================================== */}
      {activeTab === 'appearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Coluna Esquerda: Editor Visual Completo */}
          <div className="lg:col-span-5 space-y-4">
            {/* Seleção de Template */}
            <div className="retail-panel space-y-3">
              <div>
                <span className="retail-kicker">Estilo Visual</span>
                <h2 className="text-base font-black">Modelo da Vitrine</h2>
              </div>

              <div className="space-y-2">
                {TEMPLATE_OPTIONS.map((tpl) => {
                  const selected = draftTheme.template === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        setDraftTheme({ ...draftTheme, template: tpl.id })
                      }
                      className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                        selected
                          ? 'border-brand bg-support/50'
                          : 'border-line bg-page hover:border-brand'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          style={{
                            backgroundColor: tpl.bgPreview,
                            borderColor: '#E5E1ED',
                          }}
                          className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs"
                        >
                          <div
                            style={{ backgroundColor: '#7C3AED' }}
                            className="w-5 h-5 rounded-md"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-ink block">
                            {tpl.name}
                          </span>
                          <p className="text-xs text-muted mt-0.5 line-clamp-2">
                            {tpl.desc}
                          </p>
                        </div>
                      </div>
                      {selected && (
                        <Check size={16} className="text-brand shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
                <div>
                  <label className="block text-[11px] font-bold text-muted mb-1.5">
                    Cor Principal
                  </label>
                  <div className="flex gap-2">
                    {['#7C3AED', '#6D28D9'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() =>
                          setDraftTheme({ ...draftTheme, primaryColor: hex })
                        }
                        style={{ backgroundColor: hex }}
                        className={`h-8 flex-1 rounded-lg border-2 flex items-center justify-center text-on-brand text-[10px] font-mono font-bold ${
                          draftTheme.primaryColor === hex
                            ? 'border-ink'
                            : 'border-transparent opacity-75'
                        }`}
                      >
                        {hex}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted mb-1.5">
                    Cor de Acento
                  </label>
                  <div className="flex gap-2">
                    {['#6D28D9', '#7C3AED'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() =>
                          setDraftTheme({ ...draftTheme, accentColor: hex })
                        }
                        style={{ backgroundColor: hex }}
                        className={`h-8 flex-1 rounded-lg border-2 flex items-center justify-center text-on-brand text-[10px] font-mono font-bold ${
                          draftTheme.accentColor === hex
                            ? 'border-ink'
                            : 'border-transparent opacity-75'
                        }`}
                      >
                        {hex}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Textos de Destaque e Imagens de Marca */}
            <div className="retail-panel space-y-3">
              <div>
                <span className="retail-kicker">Cabeçalho & Capa</span>
                <h2 className="text-base font-black">
                  Mensagem Principal e Imagens
                </h2>
              </div>

              <div className="space-y-3">
                <label className="retail-field">
                  <span>Faixa de aviso no topo (opcional)</span>
                  <input
                    type="text"
                    value={draftTheme.announcementText || ''}
                    onChange={(e) =>
                      setDraftTheme({
                        ...draftTheme,
                        announcementText: e.target.value,
                      })
                    }
                    placeholder="Ex: Retirada rápida na loja ou entrega no mesmo dia!"
                  />
                </label>

                <label className="retail-field">
                  <span>Título de boas-vindas (Hero)</span>
                  <input
                    type="text"
                    value={draftTheme.heroTitle || ''}
                    onChange={(e) =>
                      setDraftTheme({
                        ...draftTheme,
                        heroTitle: e.target.value,
                      })
                    }
                    placeholder={
                      settingsForm.storeName || 'Nova Coleção Disponível'
                    }
                  />
                </label>

                <label className="retail-field">
                  <span>Subtítulo da vitrine</span>
                  <textarea
                    rows={2}
                    value={draftTheme.heroSubtitle || ''}
                    onChange={(e) =>
                      setDraftTheme({
                        ...draftTheme,
                        heroSubtitle: e.target.value,
                      })
                    }
                    placeholder="Reserve suas peças online e confirme pelo WhatsApp."
                  />
                </label>

                <label className="retail-field">
                  <span>Texto do botão de chamada (CTA)</span>
                  <input
                    type="text"
                    value={draftTheme.heroCtaLabel || ''}
                    onChange={(e) =>
                      setDraftTheme({
                        ...draftTheme,
                        heroCtaLabel: e.target.value,
                      })
                    }
                    placeholder="Ver coleção"
                  />
                </label>

                {/* Atalho rápido de Logo e Capa direto na Aparência */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-line">
                  <div className="p-2.5 rounded-xl border border-line bg-page space-y-2">
                    <span className="text-[11px] font-bold block">
                      Logotipo da Loja
                    </span>
                    {settingsForm.logoUrl ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={getFullUrl(settingsForm.logoUrl)}
                          alt="Logo"
                          className="w-10 h-10 rounded-lg object-cover border border-line bg-surface"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsForm({ ...settingsForm, logoUrl: '' })
                          }
                          className="text-[11px] font-bold text-muted hover:text-ink"
                        >
                          Remover
                        </button>
                      </div>
                    ) : null}
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-brand cursor-pointer">
                      <Upload size={13} />
                      <span>Enviar logo</span>
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

                  <div className="p-2.5 rounded-xl border border-line bg-page space-y-2">
                    <span className="text-[11px] font-bold block">
                      Foto de Capa (Hero)
                    </span>
                    {settingsForm.coverUrl ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={getFullUrl(settingsForm.coverUrl)}
                          alt="Capa"
                          className="w-14 h-10 rounded-lg object-cover border border-line bg-surface"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsForm({ ...settingsForm, coverUrl: '' })
                          }
                          className="text-[11px] font-bold text-muted hover:text-ink"
                        >
                          Remover
                        </button>
                      </div>
                    ) : null}
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-brand cursor-pointer">
                      <Upload size={13} />
                      <span>Enviar capa</span>
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
                </div>
              </div>
            </div>

            {/* Ordem e Títulos das Seções */}
            <div className="retail-panel space-y-3">
              <div>
                <span className="retail-kicker">Estrutura da Página</span>
                <h2 className="text-base font-black">Seções da Vitrine</h2>
              </div>

              <div className="space-y-2">
                {(draftTheme.sections || []).map((sec: any, idx: number) => {
                  const defaultNames: Record<string, string> = {
                    header: 'Cabeçalho da Loja',
                    hero: 'Destaque Principal (Hero)',
                    banner: 'Banners Promocionais',
                    categories: 'Faixa de Categorias',
                    featured: 'Seleção em Destaque',
                    collection: 'Catálogo Completo',
                    fulfillment_info: 'Bloco de Entrega & Retirada',
                    footer: 'Rodapé Institucional',
                  };
                  const supportsCustomTitle =
                    sec.type === 'featured' || sec.type === 'collection';

                  return (
                    <div
                      key={sec.id}
                      className="p-2.5 rounded-xl border border-line bg-page space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const list = [...draftTheme.sections];
                                const [removed] = list.splice(idx, 1);
                                list.splice(idx - 1, 0, removed);
                                setDraftTheme({
                                  ...draftTheme,
                                  sections: list,
                                });
                              }}
                              className="p-0.5 text-muted hover:text-ink disabled:opacity-30"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={
                                idx === (draftTheme.sections || []).length - 1
                              }
                              onClick={() => {
                                const list = [...draftTheme.sections];
                                const [removed] = list.splice(idx, 1);
                                list.splice(idx + 1, 0, removed);
                                setDraftTheme({
                                  ...draftTheme,
                                  sections: list,
                                });
                              }}
                              className="p-0.5 text-muted hover:text-ink disabled:opacity-30"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                          <span className="text-xs font-bold text-ink truncate">
                            {defaultNames[sec.type] || sec.type}
                          </span>
                        </div>

                        <RetailSwitch
                          size="sm"
                          checked={sec.enabled !== false}
                          onCheckedChange={(checked) => {
                            const list = [...draftTheme.sections];
                            list[idx] = { ...sec, enabled: checked };
                            setDraftTheme({ ...draftTheme, sections: list });
                          }}
                        />
                      </div>

                      {supportsCustomTitle && sec.enabled !== false && (
                        <input
                          type="text"
                          value={sec.title || ''}
                          onChange={(e) => {
                            const list = [...draftTheme.sections];
                            list[idx] = { ...sec, title: e.target.value };
                            setDraftTheme({ ...draftTheme, sections: list });
                          }}
                          placeholder={`Título personalizado para ${defaultNames[sec.type]}...`}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-surface text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editor Completo de Banners Promocionais */}
            <div className="retail-panel space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="retail-kicker">Campanhas</span>
                  <h2 className="text-base font-black">
                    Banners Promocionais
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextBanners = [
                      ...(draftTheme.banners || []),
                      {
                        id: `bn-${Date.now()}`,
                        title: 'Semana de Novidades',
                        subtitle: 'Confira as peças recém-chegadas na loja',
                        ctaLabel: 'Ver novidades',
                        imageUrl: null,
                        targetType: 'all',
                        targetValue: '',
                        enabled: true,
                      },
                    ];
                    const nextSections = (draftTheme.sections || []).map(
                      (s: any) =>
                        s.type === 'banner' ? { ...s, enabled: true } : s,
                    );
                    setDraftTheme({
                      ...draftTheme,
                      banners: nextBanners,
                      sections: nextSections,
                    });
                  }}
                  className="retail-button retail-button-secondary"
                  style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                >
                  <Plus size={14} /> Adicionar Banner
                </button>
              </div>

              {(draftTheme.banners || []).length === 0 ? (
                <p className="text-xs text-muted">
                  Nenhum banner ativo. Clique em &ldquo;Adicionar Banner&rdquo;
                  para divulgar uma categoria ou promoção.
                </p>
              ) : (
                <div className="space-y-3">
                  {(draftTheme.banners || []).map((b: any, idx: number) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl border border-line bg-page space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <RetailSwitch
                          size="sm"
                          checked={b.enabled !== false}
                          onCheckedChange={(checked) => {
                            const list = [...draftTheme.banners];
                            list[idx] = { ...b, enabled: checked };
                            setDraftTheme({ ...draftTheme, banners: list });
                          }}
                          label={`Banner #${idx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const list = draftTheme.banners.filter(
                              (_: any, i: number) => i !== idx,
                            );
                            setDraftTheme({ ...draftTheme, banners: list });
                          }}
                          className="text-muted hover:text-ink p-1"
                          title="Excluir banner"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={b.title || ''}
                        onChange={(e) => {
                          const list = [...draftTheme.banners];
                          list[idx] = { ...b, title: e.target.value };
                          setDraftTheme({ ...draftTheme, banners: list });
                        }}
                        placeholder="Título do banner"
                        className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold"
                      />

                      <input
                        type="text"
                        value={b.subtitle || ''}
                        onChange={(e) => {
                          const list = [...draftTheme.banners];
                          list[idx] = { ...b, subtitle: e.target.value };
                          setDraftTheme({ ...draftTheme, banners: list });
                        }}
                        placeholder="Subtítulo explicativo"
                        className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={b.ctaLabel || ''}
                          onChange={(e) => {
                            const list = [...draftTheme.banners];
                            list[idx] = { ...b, ctaLabel: e.target.value };
                            setDraftTheme({ ...draftTheme, banners: list });
                          }}
                          placeholder="Texto do botão (ex: Conferir)"
                          className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs"
                        />

                        <RetailSelect
                          value={b.targetType || 'all'}
                          onValueChange={(val) => {
                            const list = [...draftTheme.banners];
                            list[idx] = {
                              ...b,
                              targetType: val,
                              targetValue: '',
                            };
                            setDraftTheme({ ...draftTheme, banners: list });
                          }}
                          options={[
                            { value: 'all', label: 'Levar ao catálogo' },
                            { value: 'featured', label: 'Levar aos destaques' },
                            {
                              value: 'category',
                              label: 'Filtrar categoria...',
                            },
                            { value: 'product', label: 'Abrir produto...' },
                          ]}
                        />
                      </div>

                      {b.targetType === 'category' && (
                        <RetailSelect
                          value={b.targetValue || ''}
                          onValueChange={(val) => {
                            const list = [...draftTheme.banners];
                            list[idx] = { ...b, targetValue: val };
                            setDraftTheme({ ...draftTheme, banners: list });
                          }}
                          placeholder="Escolha a categoria de destino..."
                          options={categories.map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                        />
                      )}

                      {b.targetType === 'product' && (
                        <RetailSelect
                          value={b.targetValue || ''}
                          onValueChange={(val) => {
                            const list = [...draftTheme.banners];
                            list[idx] = { ...b, targetValue: val };
                            setDraftTheme({ ...draftTheme, banners: list });
                          }}
                          placeholder="Escolha a peça de destino..."
                          options={products
                            .filter((p) => p.isVisible)
                            .map((p) => ({
                              value: p.publicSlug || p.id,
                              label: p.displayTitle || p.name,
                            }))}
                        />
                      )}

                      <div className="flex items-center justify-between pt-1">
                        {b.imageUrl ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={getFullUrl(b.imageUrl)}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover border border-line"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...draftTheme.banners];
                                list[idx] = { ...b, imageUrl: null };
                                setDraftTheme({ ...draftTheme, banners: list });
                              }}
                              className="text-[11px] font-bold text-muted hover:text-ink"
                            >
                              Remover imagem
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">
                            Sem miniatura
                          </span>
                        )}

                        <label className="inline-flex items-center gap-1 text-xs font-bold text-brand cursor-pointer">
                          <Upload size={13} />
                          <span>Imagem do banner</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadBannerImage(f, idx);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Live Preview Interativo */}
          <div className="lg:col-span-7 sticky top-4">
            <div className="retail-panel p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-line bg-page flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye size={15} className="text-brand" />
                  <span className="text-xs font-extrabold">
                    Simulação Interativa em Tempo Real
                  </span>
                  <span className="text-[11px] text-muted hidden sm:inline">
                    (Teste a busca e os filtros abaixo)
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      previewDevice === 'desktop'
                        ? 'bg-brand text-on-brand'
                        : 'text-muted'
                    }`}
                  >
                    <Monitor size={13} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      previewDevice === 'mobile'
                        ? 'bg-brand text-on-brand'
                        : 'text-muted'
                    }`}
                  >
                    <Smartphone size={13} /> Celular
                  </button>
                </div>
              </div>

              <div className="p-4 bg-page flex justify-center max-h-[760px] overflow-y-auto">
                <div
                  className={`border border-line rounded-2xl overflow-hidden shadow-md transition-all bg-surface ${
                    previewDevice === 'mobile'
                      ? 'w-[375px] shrink-0'
                      : 'w-full'
                  }`}
                >
                  <StorefrontHomeView
                    storeData={livePreviewStoreData}
                    products={livePreviewStoreData.previewProducts}
                    search={previewSearch}
                    setSearch={setPreviewSearch}
                    selectedCategoryId={previewCategoryId}
                    setSelectedCategoryId={setPreviewCategoryId}
                    selectedSize={previewSize}
                    setSelectedSize={setPreviewSize}
                    selectedColor={previewColor}
                    setSelectedColor={setPreviewColor}
                    sortBy={previewSortBy}
                    setSortBy={setPreviewSortBy}
                    inStockOnly={previewInStockOnly}
                    setInStockOnly={setPreviewInStockOnly}
                    cartCount={2}
                    cartTotal={189.9}
                    onSelectProduct={() => {}}
                    isPreview={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 6: CONFIGURAÇÕES GERAIS, WHATSAPP & LOGÍSTICA                    */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Identidade, URL e Imagens */}
            <div className="lg:col-span-7 retail-panel space-y-4">
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
                  <small className="text-[11px] text-muted font-mono">
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
            <div className="lg:col-span-5 retail-panel space-y-4">
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
                disabled={saving}
                className="retail-button retail-button-primary"
              >
                {saving ? (
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
                        className="relative w-16 h-20 rounded-xl overflow-hidden border border-line bg-surface group"
                      >
                        <img
                          src={getFullUrl(url)}
                          alt=""
                          className="w-full h-full object-cover"
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
                className="retail-button retail-button-primary"
              >
                <Save size={15} />
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
            <div className="p-3.5 rounded-xl bg-support/50 border border-brand text-xs space-y-1">
              <p className="font-bold text-ink">
                Cliente: {selectedOrder.customerName}
              </p>
              <p className="text-muted">
                Esta ação consumirá definitivamente a reserva de estoque e
                registrará a venda no histórico do PDV Lojista.
              </p>
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
    </div>
  );
}
