import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Tv2,
  Plus,
  Trash2,
  Eye,
  Send,
  Copy,
  Check,
  Sparkles,
  Image as ImageIcon,
  Clock,
  Tag,
  Power,
  ExternalLink,
  Layers,
  ChevronUp,
  ChevronDown,
  Search,
  Edit2,
  Play,
  Pause,
  Palette,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiGet } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import {
  VitrineStageCanvas,
  VITRINE_THEME_LIST,
  formatPriceBr,
  type AnyVitrineSlide,
  type VitrineSlide,
  type VitrineGridSlide,
  type GridProduct,
  type VitrinePublicData,
} from "./RetailVitrineTvPage";

interface CatalogEntry {
  id: string;
  productId: string;
  retailGroupId: string | null;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  priceSell: number;
  imageUrl: string | null;
  sizesAvailable: string[];
  colorsAvailable: string[];
  stockTotal: number;
}

interface VitrineConfigResponse {
  id: string;
  active: boolean;
  theme: string;
  customBgUrl: string | null;
  showLogo: boolean;
  logoPosition: string;
  logoUrl: string | null;
  instagramHandle: string | null;
  storeTagline: string | null;
  slideDuration: number;
  gridSlideDuration: number;
  draftSlides: AnyVitrineSlide[];
  publishedSlides: AnyVitrineSlide[];
  publishedVersion: number;
  publishedAt: string | null;
  tvPublicId: string | null;
  storeName: string;
  tenantLogoUrl: string | null;
}

const BADGE_PRESETS = [
  "OFERTA",
  "NOVA COLEÇÃO",
  "LANÇAMENTO",
  "QUEIMA DE ESTOQUE",
  "DESTAQUE",
  "ÚLTIMAS PEÇAS",
];

const LOGO_POSITIONS = [
  { value: "top-left", label: "Superior Esquerdo" },
  { value: "top-right", label: "Superior Direito" },
  { value: "bottom-left", label: "Inferior Esquerdo" },
  { value: "bottom-right", label: "Inferior Direito" },
];

export function RetailVitrinePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAppearanceTab = location.pathname.startsWith("/vitrine/aparencia");

  const [config, setConfig] = useState<VitrineConfigResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Estado local do rascunho
  const [slides, setSlides] = useState<AnyVitrineSlide[]>([]);
  const [theme, setTheme] = useState("dark_premium");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [showLogo, setShowLogo] = useState(true);
  const [logoPosition, setLogoPosition] = useState("top-right");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [storeTagline, setStoreTagline] = useState("");
  const [slideDuration, setSlideDuration] = useState(8);
  const [gridSlideDuration, setGridSlideDuration] = useState(15);

  // Busca de catálogo
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Preview na Mini-TV
  const [previewIndex, setPreviewIndex] = useState(0);
  const [autoCyclePreview, setAutoCyclePreview] = useState(false);

  // Modal de Grade (2 a 6 peças)
  const [gridModalOpen, setGridModalOpen] = useState(false);
  const [editingGridId, setEditingGridId] = useState<string | null>(null);
  const [gridTitle, setGridTitle] = useState("Destaques da Coleção");
  const [gridSubtitle, setGridSubtitle] = useState("Confira na loja");
  const [gridBadge, setGridBadge] = useState("COLEÇÃO");
  const [gridSelectedItems, setGridSelectedItems] = useState<GridProduct[]>([]);
  const [gridSearchTerm, setGridSearchTerm] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, catRes] = await Promise.all([
        apiGet<VitrineConfigResponse>("/vitrine/config"),
        apiGet<{ items: CatalogEntry[] }>("/vitrine/catalog"),
      ]);
      const cfg = cfgRes.data;
      setConfig(cfg);
      setSlides(
        Array.isArray(cfg.draftSlides)
          ? [...cfg.draftSlides].sort((a, b) => (a.order || 0) - (b.order || 0))
          : [],
      );
      setTheme(cfg.theme || "dark_premium");
      setCustomBgUrl(cfg.customBgUrl || "");
      setShowLogo(cfg.showLogo !== false);
      setLogoPosition(cfg.logoPosition || "top-right");
      setInstagramHandle(cfg.instagramHandle || "");
      setStoreTagline(cfg.storeTagline || "");
      setSlideDuration(cfg.slideDuration || 8);
      setGridSlideDuration(cfg.gridSlideDuration || 15);
      setCatalog(Array.isArray(catRes.data?.items) ? catRes.data.items : []);
      setIsDirty(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Não foi possível carregar os dados da Vitrine Digital.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Ciclo automático opcional na Mini-TV de preview
  useEffect(() => {
    if (!autoCyclePreview || slides.length <= 1) return;
    const timer = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [autoCyclePreview, slides.length]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const item of catalog) {
      if (item.categoryName) names.add(item.categoryName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return catalog.filter((item) => {
      if (categoryFilter !== "ALL" && item.categoryName !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.categoryName || "").toLowerCase().includes(q)
      );
    });
  }, [catalog, searchTerm, categoryFilter]);

  const tvUrl = useMemo(() => {
    if (!config?.tvPublicId) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/tv/${config.tvPublicId}`;
  }, [config?.tvPublicId]);

  const handleCopyTvLink = async () => {
    if (!tvUrl) return;
    try {
      await navigator.clipboard.writeText(tvUrl);
      setCopiedLink(true);
      toast.success("Link da TV copiado para a área de transferência.");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Não foi possível copiar o link automaticamente.");
    }
  };

  const handleToggleActive = async () => {
    if (!config || togglingActive) return;
    const nextActive = !config.active;
    setTogglingActive(true);
    try {
      await api.patch("/vitrine/active", { active: nextActive });
      setConfig((prev) => (prev ? { ...prev, active: nextActive } : prev));
      toast.success(
        nextActive
          ? "Vitrine Digital colocada NO AR!"
          : "Vitrine Digital colocada em modo de espera.",
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Falha ao alterar status da vitrine.",
      );
    } finally {
      setTogglingActive(false);
    }
  };

  const buildDraftPayload = (customSlides?: AnyVitrineSlide[]) => {
    const ordered = (customSlides ?? slides).map((s, idx) => ({
      ...s,
      order: idx,
    }));
    return {
      slides: ordered,
      theme,
      customBgUrl: customBgUrl.trim() || null,
      showLogo,
      logoPosition,
      instagramHandle: instagramHandle.trim() || null,
      storeTagline: storeTagline.trim() || null,
      slideDuration,
      gridSlideDuration,
    };
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const payload = buildDraftPayload();
      await api.put("/vitrine/draft", payload);
      setIsDirty(false);
      toast.success("Rascunho salvo com sucesso.");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao salvar rascunho da vitrine.",
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (slides.length === 0) {
      toast.error("Adicione pelo menos 1 slide antes de publicar na TV.");
      return;
    }
    setPublishing(true);
    try {
      const payload = buildDraftPayload();
      await api.put("/vitrine/draft", payload);
      const res = await api.post("/vitrine/publish");
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              active: true,
              publishedVersion: res.data?.version ?? prev.publishedVersion + 1,
              publishedAt: res.data?.publishedAt ?? new Date().toISOString(),
              publishedSlides: payload.slides,
            }
          : prev,
      );
      setIsDirty(false);
      toast.success(
        `Programação publicada na TV (Versão v${res.data?.version || 1})!`,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Não foi possível publicar a programação na TV.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleAddSingleProduct = (entry: CatalogEntry) => {
    const newSlide: VitrineSlide = {
      slideType: "single",
      productId: entry.productId,
      retailGroupId: entry.retailGroupId,
      productName: entry.name,
      categoryName: entry.categoryName,
      imageUrl: entry.imageUrl,
      priceSell: entry.priceSell,
      promoPrice: null,
      badge: "DESTAQUE",
      showSizes: true,
      sizesAvailable: entry.sizesAvailable,
      colorsAvailable: entry.colorsAvailable,
      order: slides.length,
    };
    const next = [...slides, newSlide];
    setSlides(next);
    setPreviewIndex(next.length - 1);
    setIsDirty(true);
    toast.success(`"${entry.name}" adicionado à programação.`);
  };

  const handleRemoveSlide = (index: number) => {
    const next = slides
      .filter((_, i) => i !== index)
      .map((s, idx) => ({ ...s, order: idx }));
    setSlides(next);
    setPreviewIndex((prev) => Math.max(0, Math.min(prev, next.length - 1)));
    setIsDirty(true);
  };

  const handleMoveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const copy = [...slides];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    const reordered = copy.map((s, idx) => ({ ...s, order: idx }));
    setSlides(reordered);
    setPreviewIndex(target);
    setIsDirty(true);
  };

  const handleUpdateSingleSlide = (
    index: number,
    patch: Partial<VitrineSlide>,
  ) => {
    setSlides((prev) =>
      prev.map((item, idx) =>
        idx === index && item.slideType !== "grid"
          ? ({ ...item, ...patch } as VitrineSlide)
          : item,
      ),
    );
    setIsDirty(true);
  };

  const openNewGridModal = () => {
    setEditingGridId(null);
    setGridTitle("Destaques da Coleção");
    setGridSubtitle("Peças selecionadas em oferta");
    setGridBadge("COLEÇÃO");
    setGridSelectedItems([]);
    setGridSearchTerm("");
    setGridModalOpen(true);
  };

  const openEditGridModal = (slide: VitrineGridSlide) => {
    setEditingGridId(slide.gridId);
    setGridTitle(slide.gridTitle || "Destaques da Coleção");
    setGridSubtitle(slide.gridSubtitle || "");
    setGridBadge(slide.gridBadge || "COLEÇÃO");
    setGridSelectedItems([...(slide.gridProducts || [])]);
    setGridSearchTerm("");
    setGridModalOpen(true);
  };

  const handleToggleGridProduct = (entry: CatalogEntry) => {
    const exists = gridSelectedItems.some(
      (p) =>
        (entry.retailGroupId && p.retailGroupId === entry.retailGroupId) ||
        p.productId === entry.productId,
    );
    if (exists) {
      setGridSelectedItems((prev) =>
        prev.filter(
          (p) =>
            !(
              (entry.retailGroupId && p.retailGroupId === entry.retailGroupId) ||
              p.productId === entry.productId
            ),
        ),
      );
      return;
    }
    if (gridSelectedItems.length >= 6) {
      toast.error("Uma grade comporta no máximo 6 peças por tela.");
      return;
    }
    setGridSelectedItems((prev) => [
      ...prev,
      {
        productId: entry.productId,
        retailGroupId: entry.retailGroupId,
        productName: entry.name,
        categoryName: entry.categoryName,
        imageUrl: entry.imageUrl,
        priceSell: entry.priceSell,
        promoPrice: null,
        sizesAvailable: entry.sizesAvailable,
        colorsAvailable: entry.colorsAvailable,
      },
    ]);
  };

  const handleFillGridByCategory = (catName: string) => {
    const matches = catalog
      .filter((c) => c.categoryName === catName)
      .slice(0, 6)
      .map((entry) => ({
        productId: entry.productId,
        retailGroupId: entry.retailGroupId,
        productName: entry.name,
        categoryName: entry.categoryName,
        imageUrl: entry.imageUrl,
        priceSell: entry.priceSell,
        promoPrice: null,
        sizesAvailable: entry.sizesAvailable,
        colorsAvailable: entry.colorsAvailable,
      }));
    if (matches.length < 2) {
      toast.error("Essa categoria possui menos de 2 peças ativas.");
      return;
    }
    setGridSelectedItems(matches);
    setGridTitle(`Coleção ${catName}`);
    setGridSubtitle("Disponível em diversos tamanhos na loja");
  };

  const handleSaveGridModal = () => {
    if (gridSelectedItems.length < 2) {
      toast.error("Selecione pelo menos 2 peças para montar a grade.");
      return;
    }
    if (!gridTitle.trim()) {
      toast.error("Informe um título para a grade.");
      return;
    }
    if (editingGridId) {
      setSlides((prev) =>
        prev.map((s) =>
          s.slideType === "grid" && s.gridId === editingGridId
            ? {
                ...s,
                gridTitle: gridTitle.trim(),
                gridSubtitle: gridSubtitle.trim(),
                gridBadge: gridBadge.trim() || null,
                gridProducts: gridSelectedItems,
              }
            : s,
        ),
      );
      toast.success("Grade de coleção atualizada.");
    } else {
      const newGrid: VitrineGridSlide = {
        slideType: "grid",
        gridId: `grid-${Date.now()}`,
        order: slides.length,
        gridTitle: gridTitle.trim(),
        gridSubtitle: gridSubtitle.trim(),
        gridBadge: gridBadge.trim() || "COLEÇÃO",
        gridProducts: gridSelectedItems,
      };
      const next = [...slides, newGrid];
      setSlides(next);
      setPreviewIndex(next.length - 1);
      toast.success("Grade de coleção adicionada à programação.");
    }
    setIsDirty(true);
    setGridModalOpen(false);
  };

  const previewData: VitrinePublicData = useMemo(
    () => ({
      active: true,
      version: config?.publishedVersion || 1,
      storeName: config?.storeName || "PDV Lojista",
      storeTagline: storeTagline || null,
      theme,
      customBgUrl: customBgUrl.trim() || null,
      showLogo,
      logoPosition,
      logoUrl: config?.logoUrl || config?.tenantLogoUrl || null,
      instagramHandle: instagramHandle.trim() || null,
      slideDuration,
      gridSlideDuration,
      slides,
    }),
    [
      config?.publishedVersion,
      config?.storeName,
      config?.logoUrl,
      config?.tenantLogoUrl,
      storeTagline,
      theme,
      customBgUrl,
      showLogo,
      logoPosition,
      instagramHandle,
      slideDuration,
      gridSlideDuration,
      slides,
    ],
  );

  const activePreviewSlide =
    slides.length > 0 ? slides[previewIndex % slides.length] : undefined;
  const nextPreviewSlides = useMemo(
    () =>
      slides
        .filter((_, idx) => idx !== previewIndex % Math.max(1, slides.length))
        .slice(0, 4),
    [slides, previewIndex],
  );

  if (loading) {
    return (
      <div className="retail-loader-region" style={{ minHeight: 360 }}>
        <PdvLojistaLoader
          mode="loader"
          size={72}
          label="Carregando estúdio da Vitrine Digital…"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho Operacional + KPIs da TV */}
      <div className="retail-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand bg-support text-brand">
              <Tv2 size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-extrabold text-ink">
                  Vitrine Digital &amp; TV da Loja
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-bold ${
                    config?.active
                      ? "border-brand bg-support text-brand"
                      : "border-line bg-page text-muted"
                  }`}
                >
                  <Power size={12} />
                  {config?.active ? "TV NO AR" : "EM ESPERA"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-page px-2.5 py-0.5 text-xs font-semibold text-muted">
                  Versão v{config?.publishedVersion ?? 0}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Exiba ofertas, grades de tamanhos disponíveis e coleções em
                qualquer Smart TV ou monitor conectado.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={togglingActive}
              className="retail-button"
            >
              <Power size={15} />
              <span>
                {config?.active ? "Pausar Transmissão" : "Colocar TV no Ar"}
              </span>
            </button>

            {tvUrl && (
              <>
                <button
                  type="button"
                  onClick={handleCopyTvLink}
                  className="retail-button"
                  title="Copiar link público para abrir na Smart TV"
                >
                  {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedLink ? "Link Copiado" : "Copiar Link TV"}</span>
                </button>
                <a
                  href={tvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="retail-button"
                  title="Abrir reprodutor de TV em nova aba"
                >
                  <ExternalLink size={15} />
                  <span>Abrir Tela da TV</span>
                </a>
              </>
            )}

            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || slides.length === 0}
              className="retail-button is-primary"
            >
              <Send size={15} />
              <span>
                {publishing
                  ? "Publicando na TV…"
                  : isDirty
                    ? "Publicar Alterações na TV"
                    : "Republicar na TV"}
              </span>
            </button>
          </div>
        </div>

        {/* Seletor rápido de abas internas */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/vitrine")}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                !isAppearanceTab
                  ? "border-brand bg-support text-brand"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              <Sliders size={14} />
              <span>Programação e Slides ({slides.length})</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/vitrine/aparencia")}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                isAppearanceTab
                  ? "border-brand bg-support text-brand"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              <Palette size={14} />
              <span>Aparência, Temas e Conexão da TV</span>
            </button>
          </div>

          {isDirty && (
            <div className="flex items-center gap-2 text-xs font-semibold text-brand">
              <AlertCircle size={14} />
              <span>Há alterações no rascunho ainda não publicadas na TV</span>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="underline hover:no-underline"
              >
                {savingDraft ? "Salvando…" : "Salvar rascunho"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Layout Principal em 2 Colunas: Editor à esquerda + Mini-TV 16:9 ao vivo à direita */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Coluna Esquerda (7 cols): Programação ou Aparência */}
        <div className="space-y-6 xl:col-span-7">
          {!isAppearanceTab ? (
            <>
              {/* Bloco 1: Catálogo da Loja para adicionar slides ou criar grade */}
              <div className="retail-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink">
                      1. Adicionar Peças ou Coleções à TV
                    </h3>
                    <p className="text-xs text-muted">
                      Selecione um grupo/produto para slide individual ou monte
                      uma grade com até 6 peças.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewGridModal}
                    className="retail-button is-primary"
                  >
                    <Layers size={15} />
                    <span>Nova Grade de Coleção (2 a 6 peças)</span>
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="relative sm:col-span-2">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar peça, referência ou categoria..."
                      className="retail-input w-full pl-9"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filtrar por categoria"
                    className="retail-input w-full"
                  >
                    <option value="ALL">Todas as categorias</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {filteredCatalog.length === 0 ? (
                    <div className="rounded-xl border border-line bg-page p-4 text-center text-xs text-muted">
                      Nenhuma mercadoria encontrada com esse filtro.
                    </div>
                  ) : (
                    filteredCatalog.slice(0, 30).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-page px-3.5 py-2.5 transition hover:border-brand"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
                            {entry.imageUrl ? (
                              <img
                                src={getFullUrl(entry.imageUrl)}
                                alt={entry.name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <ImageIcon size={18} className="text-muted" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-ink">
                              {entry.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span>
                                R$ {formatPriceBr(entry.priceSell)}
                              </span>
                              {entry.categoryName && (
                                <>
                                  <span>·</span>
                                  <span>{entry.categoryName}</span>
                                </>
                              )}
                              {entry.sizesAvailable.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="font-semibold text-brand">
                                    Tam: {entry.sizesAvailable.join(", ")}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddSingleProduct(entry)}
                          className="retail-button shrink-0"
                        >
                          <Plus size={14} />
                          <span>Adicionar Slide</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bloco 2: Sequência de Slides da Programação */}
              <div className="retail-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink">
                      2. Sequência da Programação ({slides.length}{" "}
                      {slides.length === 1 ? "slide" : "slides"})
                    </h3>
                    <p className="text-xs text-muted">
                      Ajuste preços promocionais, selos de destaque e a ordem de
                      exibição na TV.
                    </p>
                  </div>
                </div>

                {slides.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-line bg-page p-8 text-center">
                    <Tv2 size={32} className="mx-auto text-brand" />
                    <p className="mt-2 text-sm font-bold text-ink">
                      Sua programação ainda está vazia
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Adicione mercadorias acima ou crie uma Grade de Coleção
                      para iniciar a transmissão.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {slides.map((slide, index) => {
                      const isSelected =
                        previewIndex % Math.max(1, slides.length) === index;
                      const isGrid = slide.slideType === "grid";

                      if (isGrid) {
                        const grid = slide as VitrineGridSlide;
                        return (
                          <div
                            key={grid.gridId || `grid-${index}`}
                            className={`rounded-2xl border p-4 transition ${
                              isSelected
                                ? "border-brand bg-support"
                                : "border-line bg-page"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand bg-surface text-xs font-extrabold text-brand">
                                  #{index + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-md border border-brand bg-surface px-2 py-0.5 text-[11px] font-bold text-brand">
                                      <Layers size={11} />
                                      GRADE ({grid.gridProducts.length} PEÇAS)
                                    </span>
                                    <strong className="text-sm font-extrabold text-ink">
                                      {grid.gridTitle}
                                    </strong>
                                  </div>
                                  {grid.gridSubtitle && (
                                    <p className="text-xs text-muted">
                                      {grid.gridSubtitle}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewIndex(index);
                                    setAutoCyclePreview(false);
                                  }}
                                  className="retail-button"
                                  title="Visualizar este slide na Mini-TV"
                                >
                                  <Eye size={14} />
                                  <span>Ver na TV</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditGridModal(grid)}
                                  className="retail-button"
                                  title="Editar peças e título da grade"
                                >
                                  <Edit2 size={14} />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveSlide(index, -1)}
                                  disabled={index === 0}
                                  className="retail-icon-button"
                                  aria-label="Mover slide para cima"
                                >
                                  <ChevronUp size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveSlide(index, 1)}
                                  disabled={index === slides.length - 1}
                                  className="retail-icon-button"
                                  aria-label="Mover slide para baixo"
                                >
                                  <ChevronDown size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlide(index)}
                                  className="retail-icon-button"
                                  aria-label="Remover slide"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {grid.gridProducts.map((gp, gpIdx) => (
                                <span
                                  key={`${gp.productId}-${gpIdx}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink"
                                >
                                  <span>{gp.productName}</span>
                                  <span className="text-brand">
                                    R${" "}
                                    {formatPriceBr(
                                      gp.promoPrice ?? gp.priceSell,
                                    )}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      const single = slide as VitrineSlide;
                      return (
                        <div
                          key={`${single.productId}-${index}`}
                          className={`rounded-2xl border p-4 transition ${
                            isSelected
                              ? "border-brand bg-support"
                              : "border-line bg-page"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand bg-surface text-xs font-extrabold text-brand">
                                #{index + 1}
                              </span>
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface">
                                {single.imageUrl ? (
                                  <img
                                    src={getFullUrl(single.imageUrl)}
                                    alt={single.productName}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <ImageIcon size={20} className="text-muted" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-extrabold text-ink">
                                  {single.productName}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                  <span>
                                    Preço normal: R${" "}
                                    {formatPriceBr(single.priceSell)}
                                  </span>
                                  {single.sizesAvailable &&
                                    single.sizesAvailable.length > 0 && (
                                      <span>
                                        · Grade:{" "}
                                        {single.sizesAvailable.join(", ")}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewIndex(index);
                                  setAutoCyclePreview(false);
                                }}
                                className="retail-button"
                              >
                                <Eye size={14} />
                                <span>Ver na TV</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSlide(index, -1)}
                                disabled={index === 0}
                                className="retail-icon-button"
                                aria-label="Mover para cima"
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSlide(index, 1)}
                                disabled={index === slides.length - 1}
                                className="retail-icon-button"
                                aria-label="Mover para baixo"
                              >
                                <ChevronDown size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlide(index)}
                                className="retail-icon-button"
                                aria-label="Remover slide"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Controles inline do slide individual */}
                          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-[11px] font-bold uppercase text-muted">
                                Preço Promocional na TV (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  single.promoPrice !== null &&
                                  single.promoPrice !== undefined
                                    ? single.promoPrice
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  handleUpdateSingleSlide(index, {
                                    promoPrice:
                                      raw === "" ? null : Number(raw),
                                  });
                                }}
                                placeholder={`Ex: ${(single.priceSell * 0.85).toFixed(2)}`}
                                className="retail-input w-full"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-[11px] font-bold uppercase text-muted">
                                Selo de Campanha (Badge)
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={28}
                                  value={single.badge || ""}
                                  onChange={(e) =>
                                    handleUpdateSingleSlide(index, {
                                      badge: e.target.value || null,
                                    })
                                  }
                                  placeholder="Ex: OFERTA, LANÇAMENTO..."
                                  className="retail-input flex-1"
                                />
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {BADGE_PRESETS.map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() =>
                                      handleUpdateSingleSlide(index, {
                                        badge: preset,
                                      })
                                    }
                                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${
                                      single.badge === preset
                                        ? "border-brand bg-brand text-on-brand"
                                        : "border-line bg-surface text-muted hover:text-ink"
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                              <input
                                type="checkbox"
                                checked={single.showSizes !== false}
                                onChange={(e) =>
                                  handleUpdateSingleSlide(index, {
                                    showSizes: e.target.checked,
                                  })
                                }
                              />
                              <span>
                                Exibir grade de tamanhos e cores em estoque na
                                TV
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Aba 2: Aparência, Temas e Conexão da TV */
            <div className="space-y-6">
              <div className="retail-surface p-5">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink">
                  Temas Visuais da Vitrine (Paleta Oficial Roxo e Branco)
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  Escolha a atmosfera visual para a tela da sua loja. Todos os
                  temas seguem o padrão tipográfico e cromático do PDV Lojista.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {VITRINE_THEME_LIST.map((t) => {
                    const selected = theme === t.slug;
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => {
                          setTheme(t.slug);
                          setIsDirty(true);
                        }}
                        className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-brand bg-support"
                            : "border-line bg-page hover:border-brand"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold text-ink">
                            {t.name}
                          </span>
                          {selected && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-brand bg-surface px-2.5 py-0.5 text-[11px] font-bold text-brand">
                              <CheckCircle2 size={12} />
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {t.description}
                        </p>
                        <div
                          className="mt-3 h-8 w-full rounded-xl border border-line"
                          style={{ background: t.bg }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="retail-surface p-5">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink">
                  Identidade da Loja e Tempo de Transição
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink">
                      Assinatura / Slogan no Rodapé da TV
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={storeTagline}
                      onChange={(e) => {
                        setStoreTagline(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Ex: Moda, Calçados e Acessórios · Consulte tamanhos"
                      className="retail-input w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink">
                      Instagram da Loja (exibido no canto superior)
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={instagramHandle}
                      onChange={(e) => {
                        setInstagramHandle(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Ex: @boutiquedonaclara"
                      className="retail-input w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink">
                      Tempo por Slide Individual (segundos)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={120}
                      value={slideDuration}
                      onChange={(e) => {
                        setSlideDuration(
                          Math.max(3, Math.min(120, Number(e.target.value) || 8)),
                        );
                        setIsDirty(true);
                      }}
                      className="retail-input w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink">
                      Tempo por Grade de Coleção (segundos)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={gridSlideDuration}
                      onChange={(e) => {
                        setGridSlideDuration(
                          Math.max(
                            5,
                            Math.min(180, Number(e.target.value) || 15),
                          ),
                        );
                        setIsDirty(true);
                      }}
                      className="retail-input w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink">
                      Posição do Logotipo da Loja na TV
                    </label>
                    <select
                      value={logoPosition}
                      onChange={(e) => {
                        setLogoPosition(e.target.value);
                        setIsDirty(true);
                      }}
                      className="retail-input w-full"
                    >
                      {LOGO_POSITIONS.map((pos) => (
                        <option key={pos.value} value={pos.value}>
                          {pos.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-ink">
                      <input
                        type="checkbox"
                        checked={showLogo}
                        onChange={(e) => {
                          setShowLogo(e.target.checked);
                          setIsDirty(true);
                        }}
                      />
                      <span>Exibir logotipo da loja na TV</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Card de Conexão na Smart TV */}
              <div className="retail-surface p-5">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink">
                  Como Conectar sua Smart TV ou Segundo Monitor
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Abra o navegador da Smart TV, TV Box ou computador secundário e
                  acesse o endereço público abaixo. A tela sincroniza novas
                  promoções automaticamente a cada 30 segundos sem precisar de
                  senha.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-support p-3">
                  <code className="flex-1 truncate text-xs font-bold text-ink">
                    {tvUrl || "Carregando link público..."}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyTvLink}
                    className="retail-button"
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLink ? "Copiado" : "Copiar URL"}</span>
                  </button>
                  {tvUrl && (
                    <a
                      href={tvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="retail-button is-primary"
                    >
                      <ExternalLink size={14} />
                      <span>Testar Player</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coluna Direita (5 cols): Preview 16:9 ao vivo da TV */}
        <div className="xl:col-span-5">
          <div className="retail-surface sticky top-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-brand" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink">
                  Simulador ao Vivo (16:9)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {slides.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAutoCyclePreview((v) => !v)}
                    className="retail-button"
                  >
                    {autoCyclePreview ? (
                      <>
                        <Pause size={13} />
                        <span>Pausar Ciclo</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        <span>Girar Slides</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Moldura 16:9 da Mini-TV */}
            <div
              className="mt-3 overflow-hidden rounded-2xl border-2 border-ink shadow-lg"
              style={{ aspectRatio: "16 / 9", width: "100%" }}
            >
              {activePreviewSlide ? (
                <VitrineStageCanvas
                  data={previewData}
                  slide={activePreviewSlide}
                  nextSlides={nextPreviewSlides}
                  totalSlides={slides.length}
                  currentDuration={
                    activePreviewSlide.slideType === "grid"
                      ? gridSlideDuration
                      : slideDuration
                  }
                  slidePhase="visible"
                  compactPreview
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-ink p-4 text-center text-surface">
                  <Tv2 size={32} className="text-brand" />
                  <p className="mt-2 text-xs font-bold">
                    Adicione produtos para visualizar a TV ao vivo
                  </p>
                </div>
              )}
            </div>

            {/* Paginador rápido de slides do preview */}
            {slides.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted">
                  Exibindo slide {(previewIndex % slides.length) + 1} de{" "}
                  {slides.length}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {slides.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPreviewIndex(idx);
                        setAutoCyclePreview(false);
                      }}
                      className={`h-7 min-w-[28px] rounded-lg border px-2 text-xs font-bold transition ${
                        previewIndex % slides.length === idx
                          ? "border-brand bg-brand text-on-brand"
                          : "border-line bg-page text-muted hover:text-ink"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-line bg-page p-3 text-xs text-muted">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">
                  Tempo estimado do ciclo completo:
                </span>
                <span className="font-extrabold text-brand">
                  <Clock size={12} className="mr-1 inline" />
                  {slides.reduce(
                    (acc, s) =>
                      acc +
                      (s.duration ||
                        (s.slideType === "grid"
                          ? gridSlideDuration
                          : slideDuration)),
                    0,
                  )}
                  s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Criação / Edição de Grade de Coleção (2 a 6 peças) */}
      {gridModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "color-mix(in srgb, #272321 62%, transparent)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Configurar Grade de Coleção"
        >
          <div className="retail-surface max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <Layers size={20} className="text-brand" />
                <div>
                  <h3 className="text-base font-extrabold text-ink">
                    {editingGridId
                      ? "Editar Grade de Coleção"
                      : "Nova Grade de Coleção na TV (2 a 6 peças)"}
                  </h3>
                  <p className="text-xs text-muted">
                    Exiba até 6 produtos simultaneamente em um único slide de
                    coleção ou oferta conjunta.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGridModalOpen(false)}
                className="retail-icon-button"
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  Título da Grade
                </label>
                <input
                  type="text"
                  value={gridTitle}
                  onChange={(e) => setGridTitle(e.target.value)}
                  placeholder="Ex: Lookbook Outono / Inverno"
                  className="retail-input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  Subtítulo
                </label>
                <input
                  type="text"
                  value={gridSubtitle}
                  onChange={(e) => setGridSubtitle(e.target.value)}
                  placeholder="Ex: Peças selecionadas no balcão"
                  className="retail-input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  Selo da Grade (Badge)
                </label>
                <input
                  type="text"
                  value={gridBadge}
                  onChange={(e) => setGridBadge(e.target.value)}
                  placeholder="Ex: COLEÇÃO"
                  className="retail-input w-full"
                />
              </div>
            </div>

            {/* Atalho: Preencher com Categoria */}
            {categories.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-page p-3">
                <span className="text-xs font-bold text-ink">
                  <Tag size={12} className="mr-1 inline text-brand" />
                  Preenchimento rápido por categoria:
                </span>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleFillGridByCategory(cat)}
                    className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
                  >
                    + {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Peças Selecionadas na Grade */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-ink">
                  Peças selecionadas ({gridSelectedItems.length}/6)
                </span>
              </div>

              {gridSelectedItems.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {gridSelectedItems.map((item, idx) => (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-brand bg-support px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-ink">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-muted">
                          Normal: R$ {formatPriceBr(item.priceSell)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Promo R$"
                          value={item.promoPrice ?? ""}
                          onChange={(e) => {
                            const val =
                              e.target.value === ""
                                ? null
                                : Number(e.target.value);
                            setGridSelectedItems((prev) =>
                              prev.map((p, i) =>
                                i === idx ? { ...p, promoPrice: val } : p,
                              ),
                            );
                          }}
                          className="retail-input w-24 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setGridSelectedItems((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="retail-icon-button"
                          aria-label="Remover peça da grade"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Busca para adicionar mais itens à grade */}
            <div className="mt-4">
              <input
                type="search"
                value={gridSearchTerm}
                onChange={(e) => setGridSearchTerm(e.target.value)}
                placeholder="Filtrar catálogo para adicionar na grade..."
                className="retail-input w-full"
              />
              <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {catalog
                  .filter(
                    (c) =>
                      !gridSearchTerm.trim() ||
                      c.name
                        .toLowerCase()
                        .includes(gridSearchTerm.trim().toLowerCase()),
                  )
                  .map((entry) => {
                    const isChecked = gridSelectedItems.some(
                      (p) =>
                        (entry.retailGroupId &&
                          p.retailGroupId === entry.retailGroupId) ||
                        p.productId === entry.productId,
                    );
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleToggleGridProduct(entry)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                          isChecked
                            ? "border-brand bg-support font-bold text-brand"
                            : "border-line bg-page text-ink hover:border-brand"
                        }`}
                      >
                        <span>
                          {entry.name} · R$ {formatPriceBr(entry.priceSell)}
                        </span>
                        <span>{isChecked ? "Selecionado ✓" : "+ Incluir"}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setGridModalOpen(false)}
                className="retail-button"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveGridModal}
                className="retail-button is-primary"
              >
                Salvar Grade ({gridSelectedItems.length} peças)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RetailVitrinePage;
