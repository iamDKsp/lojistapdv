import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Wallet,
  UserRound,
  ShoppingBag,
  Bell,
  Settings,
  UserPlus,
  ChevronsUpDown,
  BadgePercent,
  ChevronRight,
  ChevronUp,
  Monitor,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { useAuthStore } from "@/store/auth";
import { useCartStore, type Product } from "@/store/cart";
import { useShift } from "@/contexts/ShiftContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import {
  getCachedProducts,
  updateProductsCache,
  getReviewSales,
  type CachedProduct,
} from "@/lib/db";
import { OperatorLoginModal } from "@/components/OperatorLoginModal";
import { OpenShiftModal } from "@/components/OpenShiftModal";
const CloseRegisterModal = lazy(() =>
  import("@/components/CloseRegisterModal").then((module) => ({
    default: module.CloseRegisterModal,
  })),
);
import { CashMovementModal } from "@/components/CashMovementModal";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import {
  CategoryIconBadge,
  CategoryIconIllustration,
  syncCategoriesIconsToStorage,
} from "@/components/CategoryIcons";
import {
  useRetailShell,
  RetailTeamAvatars,
  RetailOperatorAvatar,
} from "./RetailLayout";
import { RetailCheckoutModal } from "./RetailCheckoutModal";
import { RetailDialog } from "./RetailDialog";
import { apiError, money } from "./types";

const QUICK_METHODS = [
  { id: "credito", label: "Cartão de Crédito" },
  { id: "pix", label: "Pix Instantâneo" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "debito", label: "Cartão de Débito" },
] as const;

/**
 * Ilustração vetorial para mercadorias sem foto enviada, adaptada à paleta roxa, branca e neutra.
 */
function ProductCardIllustration({
  name,
  categoryName,
  compact = false,
}: {
  name: string;
  categoryName?: string;
  compact?: boolean;
}) {
  return (
    <CategoryIconIllustration
      categoryName={categoryName}
      productName={name}
      compact={compact}
    />
  );
}

function LegacyProductCardIllustrationUnused({
  name,
  categoryName,
  compact = false,
}: {
  name: string;
  categoryName?: string;
  compact?: boolean;
}) {
  const key = `${name} ${categoryName || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const isShoe =
    key.includes("tenis") ||
    key.includes("calcado") ||
    key.includes("sapato") ||
    key.includes("bota") ||
    key.includes("chinelo") ||
    key.includes("runner");
  const isJacket =
    key.includes("jaqueta") ||
    key.includes("moletom") ||
    key.includes("casaco") ||
    key.includes("corta-vento");
  const isCap = key.includes("bone") || key.includes("chapeu") || key.includes("gorro");
  const isWatch = key.includes("relogio") || key.includes("pulseira") || key.includes("colar");
  const isPants = key.includes("calca") || key.includes("bermuda") || key.includes("short");
  const isWallet = key.includes("carteira") || key.includes("bolsa") || key.includes("mochila") || key.includes("cinto");

  const size = compact ? 52 : 132;

  if (isShoe) {
    const isRunner = key.includes("runner") || key.includes("pro") || key.includes("esport");
    return (
      <svg
        width={size}
        height={compact ? 52 : 94}
        viewBox="0 0 160 104"
        fill="none"
        aria-hidden="true"
        className="retail-product-svg"
      >
        <ellipse cx="80" cy="88" rx="60" ry="6" fill="var(--pdv-border)" />
        {/* Sola robusta em camadas */}
        <path
          d="M16 71h128c3.3 0 6 2.7 6 6v4c0 3.9-3.1 7-7 7H23c-4.4 0-8-3.6-8-8v-3c0-3.3 2.7-6 6-6z"
          fill="var(--pdv-white)"
          stroke="var(--pdv-text)"
          strokeWidth="2.2"
        />
        <path
          d="M20 79h120"
          stroke={isRunner ? "var(--pdv-primary)" : "var(--pdv-text)"}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Cabedal principal */}
        <path
          d="M20 71c0-9 5-16 14-18l28-5 20-21c3.5-3.5 9-4 13.5-1l9.5 6.5c6 4 14 7.5 22 8.5l11 1.5c5.5 1 9.5 5.5 9.5 11V71H20z"
          fill={isRunner ? "var(--pdv-support)" : "var(--pdv-white)"}
          stroke="var(--pdv-text)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Painel traseiro e biqueira */}
        <path
          d="M20 71c0-8 5-14 13-16l13-2.5v18.5H20z"
          fill={isRunner ? "var(--pdv-primary)" : "var(--pdv-text-secondary)"}
          opacity="0.88"
        />
        <path
          d="M116 58c8 1 16 2 22 4 4 1.5 7 5 7 9h-33l4-13z"
          fill="var(--pdv-border)"
        />
        {/* Faixa lateral de velocidade */}
        <path
          d="M48 53l25 11 40-8"
          stroke="var(--pdv-primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Cadarços */}
        <path
          d="M77 35l8 5M71 41l8 5M65 47l8 5"
          stroke="var(--pdv-text)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (isPants) {
    return (
      <svg
        width={size}
        height={compact ? 52 : 94}
        viewBox="0 0 160 104"
        fill="none"
        aria-hidden="true"
        className="retail-product-svg"
      >
        <ellipse cx="80" cy="92" rx="36" ry="5" fill="var(--pdv-border)" />
        <path
          d="M55 12h50l7 76H92L80 43 68 88H48l7-76z"
          fill="var(--pdv-text)"
          stroke="var(--pdv-text)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M55 21h50" stroke="var(--pdv-border)" strokeWidth="2" />
        {/* Bolsos Cargo Laterais */}
        <rect
          x="50"
          y="42"
          width="11"
          height="16"
          rx="2.5"
          fill="var(--pdv-text-secondary)"
          stroke="var(--pdv-support)"
          strokeWidth="1.2"
        />
        <rect
          x="99"
          y="42"
          width="11"
          height="16"
          rx="2.5"
          fill="var(--pdv-text-secondary)"
          stroke="var(--pdv-support)"
          strokeWidth="1.2"
        />
        {/* Cordão e punhos */}
        <path
          d="M77 16v9M83 16v7"
          stroke="var(--pdv-support)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="48" y="84" width="20" height="5" rx="2" fill="var(--pdv-primary)" />
        <rect x="92" y="84" width="20" height="5" rx="2" fill="var(--pdv-primary)" />
      </svg>
    );
  }

  if (isJacket) {
    return (
      <svg
        width={size}
        height={compact ? 52 : 94}
        viewBox="0 0 160 104"
        fill="none"
        aria-hidden="true"
        className="retail-product-svg"
      >
        <ellipse cx="80" cy="92" rx="44" ry="5" fill="var(--pdv-border)" />
        <path
          d="M58 16l-26 13-8 44 15 4 6-32v41h70V45l6 32 15-4-8-44-26-13c-4 6-11 9-22 9s-18-3-22-9z"
          fill="var(--pdv-support)"
          stroke="var(--pdv-text)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Recorte Chevron Tech */}
        <path
          d="M45 42l35 14 35-14"
          stroke="var(--pdv-text)"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path d="M80 25v61" stroke="var(--pdv-text)" strokeWidth="2.2" />
        {/* Gola alta */}
        <path
          d="M58 16c4-5 12-7 22-7s18 2 22 7c-4 6-11 9-22 9s-18-3-22-9z"
          fill="var(--pdv-primary)"
          stroke="var(--pdv-text)"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (isCap) {
    return (
      <svg
        width={size}
        height={compact ? 52 : 94}
        viewBox="0 0 160 104"
        fill="none"
        aria-hidden="true"
        className="retail-product-svg"
      >
        <ellipse cx="80" cy="82" rx="52" ry="6" fill="var(--pdv-border)" />
        <path
          d="M36 62c0-22 17-37 40-37s39 15 39 37H36z"
          fill="var(--pdv-primary)"
          stroke="var(--pdv-text)"
          strokeWidth="2.4"
        />
        <path
          d="M76 25v37"
          stroke="var(--pdv-support)"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
        <path
          d="M32 62h92c7 0 13 4 15 10l-40 4c-14 1-27-2-40-5l-27-9z"
          fill="var(--pdv-text)"
        />
        <circle cx="76" cy="24" r="4" fill="var(--pdv-support)" stroke="var(--pdv-text)" strokeWidth="2" />
      </svg>
    );
  }

  if (isWatch || isWallet) {
    return (
      <svg
        width={size}
        height={compact ? 52 : 94}
        viewBox="0 0 160 104"
        fill="none"
        aria-hidden="true"
        className="retail-product-svg"
      >
        <rect
          x="42"
          y="26"
          width="76"
          height="52"
          rx="12"
          fill="var(--pdv-primary-hover)"
          stroke="var(--pdv-text)"
          strokeWidth="2.4"
        />
        <path
          d="M52 26l8-9h40l8 9"
          stroke="var(--pdv-primary)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <rect
          x="88"
          y="44"
          width="30"
          height="16"
          rx="5"
          fill="var(--pdv-support)"
          stroke="var(--pdv-text)"
          strokeWidth="2"
        />
        <circle cx="97" cy="52" r="2.8" fill="var(--pdv-primary)" />
      </svg>
    );
  }

  // Default: Camiseta Premium / Vestuário
  return (
    <svg
      width={size}
      height={compact ? 52 : 94}
      viewBox="0 0 160 104"
      fill="none"
      aria-hidden="true"
      className="retail-product-svg"
    >
      <ellipse cx="80" cy="90" rx="42" ry="5" fill="var(--pdv-border)" />
      <path
        d="M58 18l-27 13 9 18 14-6v43h52V43l14 6 9-18-27-13c-3.5 6.5-10 10.5-22 10.5S61.5 24.5 58 18z"
        fill="var(--pdv-white)"
        stroke="var(--pdv-text)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M58 18c3.5 6.5 10 10.5 22 10.5S98.5 24.5 102 18"
        stroke="var(--pdv-primary)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <rect x="68" y="38" width="24" height="8" rx="4" fill="var(--pdv-support)" />
      <path d="M54 78h52" stroke="var(--pdv-support)" strokeWidth="3" />
    </svg>
  );
}

export function RetailPosPage() {
  const { user, logout } = useAuthStore();
  const shell = useRetailShell();
  const cart = useCartStore();
  const shift = useShift();
  const sync = useOfflineSync();
  const searchRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [allowNegative, setAllowNegative] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categoryDir, setCategoryDir] = useState<"forward" | "backward">(
    "forward",
  );
  const categoryIdxRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offlineCatalog, setOfflineCatalog] = useState(false);
  const [choice, setChoice] = useState<{
    name: string;
    imageUrl?: string | null;
    categoryName?: string;
    price: number;
    variants: Product[];
  } | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [closeRegister, setCloseRegister] = useState(false);
  const [movement, setMovement] = useState(false);
  const [switchOperator, setSwitchOperator] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [quickMethodIndex, setQuickMethodIndex] = useState(0);
  const [mobileBagOpen, setMobileBagOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<
    "bell" | "settings" | "profile" | null
  >(null);
  const tenant = user?.tenant;

  const isAdmin =
    user?.role === "admin" || user?.role === "superadmin" || shell.isAdmin;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!tenant) return;
      setLoading(true);
      setError("");
      try {
        const cached = await getCachedProducts(tenant);
        if (!signal?.aborted && cached.length) {
          setProducts(cached as unknown as Product[]);
          setLoading(false);
          setOfflineCatalog(true);
        }
        if (!navigator.onLine) {
          if (!cached.length)
            setError(
              "Este dispositivo ainda não possui um catálogo salvo para esta loja.",
            );
          return;
        }
        const all: any[] = [];
        let page = 1,
          lastPage = 1;
        do {
          const res = await api.get("/products", {
            params: { page, limit: 500 },
            signal,
          });
          all.push(...res.data.data);
          lastPage = res.data.meta.lastPage;
          page++;
        } while (page <= lastPage);
        if (signal?.aborted || useAuthStore.getState().user?.tenant !== tenant)
          return;
        const active = all.filter(
          (p) =>
            p.active &&
            !p.isComposite &&
            (!p.retailGroup || p.retailGroup.active),
        );
        setProducts(active);
        setOfflineCatalog(false);
        await updateProductsCache(
          active.map(
            (p) =>
              ({
                ...p,
                tenantId: tenant,
                priceSell: Number(p.priceSell),
                stock: Number(p.stock),
                unit: p.unit || "UN",
                ncm: p.ncm || null,
                cest: p.cest || null,
                origem: p.origem || 0,
                cfop: p.grupoTributacao?.cfop || "5102",
                csosn: p.grupoTributacao?.csosn || null,
                cstIcms: p.grupoTributacao?.cstIcms || null,
                aliqIcms: Number(p.grupoTributacao?.aliqIcms || 0),
                cstPis: p.grupoTributacao?.cstPis || "99",
                aliqPis: Number(p.grupoTributacao?.aliqPis || 0),
                cstCofins: p.grupoTributacao?.cstCofins || "99",
                aliqCofins: Number(p.grupoTributacao?.aliqCofins || 0),
                cachedAt: Date.now(),
              }) as CachedProduct,
          ),
          tenant,
        );
      } catch (err) {
        if (!signal?.aborted) {
          setOfflineCatalog(true);
          setError(apiError(err));
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [tenant],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    api
      .get("/tenants/me", { signal: controller.signal })
      .then((res) => setConfig(res.data))
      .catch(() => {});
    api
      .get("/products/settings", { signal: controller.signal })
      .then((res) => setAllowNegative(res.data.allowNegativeStock === true))
      .catch(() => {});
    api
      .get("/categories", { signal: controller.signal })
      .then((res) => {
        if (Array.isArray(res.data)) syncCategoriesIconsToStorage(res.data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (tenant && shift.operator?.id)
      getReviewSales(tenant, shift.operator.id)
        .then((rows) => setReviewCount(rows.length))
        .catch(() => {});
  }, [tenant, shift.operator?.id, checkout, sync.pendingCount]);

  // Estatísticas de grupos por categoria para os contadores nas pílulas (ex.: Todos os Produtos 320, Calçados 182...)
  const categoryStats = useMemo(() => {
    const allGroups = new Set<string>();
    const byCat = new Map<string, Set<string>>();
    for (const product of products) {
      const key = product.retailGroupId || product.id;
      allGroups.add(key);
      if (product.categoryId) {
        if (!byCat.has(product.categoryId)) {
          byCat.set(product.categoryId, new Set());
        }
        byCat.get(product.categoryId)!.add(key);
      }
    }
    const counts = new Map<string, number>();
    byCat.forEach((set, catId) => counts.set(catId, set.size));
    return {
      total: allGroups.size,
      byCat: counts,
    };
  }, [products]);

  const grouped = useMemo(() => {
    const term = search
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const result = new Map<
      string,
      {
        id: string;
        name: string;
        categoryName?: string;
        imageUrl?: string | null;
        price: number;
        variants: Product[];
      }
    >();
    for (const product of products) {
      if (category && product.categoryId !== category) continue;
      const key = product.retailGroupId || product.id;
      const name = product.retailGroup?.name || product.name;
      const text =
        `${name} ${product.name} ${product.barcode || ""} ${product.shortCode || ""} ${product.size || ""} ${product.color || ""}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      if (term && !text.includes(term)) continue;
      if (!result.has(key))
        result.set(key, {
          id: key,
          name,
          categoryName: product.category?.name,
          imageUrl: product.retailGroup?.imageUrl || product.imageUrl,
          price: Number(product.retailGroup?.priceSell ?? product.priceSell),
          variants: [],
        });
      result.get(key)!.variants.push(product);
    }
    return [...result.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [products, category, search]);

  const categories = [
    ...new Map(
      products
        .filter((p) => p.category)
        .map((p) => [p.category!.id, p.category!]),
    ).values(),
  ];

  function add(product: Product) {
    const existing = cart.items
      .filter((i) => i.id === product.id)
      .reduce((n, item) => n + item.quantity, 0);
    if (!allowNegative && existing + 1 > Number(product.stock)) {
      toast.error("Saldo insuficiente para este tamanho e cor.");
      return;
    }
    cart.addItem({
      ...product,
      priceSell: Number(product.priceSell),
      stock: Number(product.stock),
    });
    setChoice(null);
    setSearch("");
    if (
      typeof window !== "undefined" &&
      !window.matchMedia("(max-width: 768px)").matches
    ) {
      searchRef.current?.focus();
    }
  }

  function open(group: (typeof grouped)[number]) {
    if (group.variants.length === 1) add(group.variants[0]);
    else
      setChoice({
        name: group.name,
        imageUrl: group.imageUrl,
        categoryName: group.categoryName,
        price: group.price,
        variants: group.variants,
      });
  }

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        checkout ||
        choice ||
        switchOperator ||
        !shift.operator ||
        shift.needsOperatorReauth
      )
        return;
      if (event.key === "F2") {
        event.preventDefault();
        if (cart.items.length && shift.cashRegister) setCheckout(true);
      }
      if (event.key === "F3") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    checkout,
    choice,
    switchOperator,
    shift.operator,
    shift.needsOperatorReauth,
    shift.cashRegister,
    cart.items.length,
  ]);

  const estimatedTax = useMemo(() => {
    return cart.items.reduce((sum, item) => {
      const rate =
        Number(item.grupoTributacao?.aliqIcms || 0) +
        Number(item.grupoTributacao?.aliqPis || 0) +
        Number(item.grupoTributacao?.aliqCofins || 0);
      return sum + (item.subtotal * rate) / 100;
    }, 0);
  }, [cart.items]);

  const totalCartPieces = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items],
  );

  const currentQuickMethod = QUICK_METHODS[quickMethodIndex];

  function cycleQuickMethod() {
    setQuickMethodIndex((prev) => (prev + 1) % QUICK_METHODS.length);
  }

  const storeTitle =
    config?.nomeFantasia || shell.config?.nomeFantasia || "Frente de caixa";

  return (
    <div className="retail-pos" onClick={() => openMenu && setOpenMenu(null)}>
      <header
        className="retail-canvas-header"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="retail-canvas-title-wrap">
          <h1>Criar Transação</h1>
          <div className="retail-pos-subline">
            <span>
              {shift.operator
                ? `Operador: ${shift.operator.name}`
                : "Identifique o operador para começar"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{storeTitle}</span>
            <span className="retail-pos-role-chip">
              {isAdmin
                ? shell.cashierOnlyMode
                  ? "Modo Caixa"
                  : "Administrador"
                : "Caixa"}
            </span>
          </div>
        </div>

        <div className="retail-header-actions">
          {/* Notificações / Status da Conexão */}
          <div className="retail-profile-dropdown-wrap">
            <button
              type="button"
              className="retail-circle-icon-btn"
              aria-label="Status e sincronização"
              data-tooltip="Notificações e conexão"
              onClick={() =>
                setOpenMenu((m) => (m === "bell" ? null : "bell"))
              }
            >
              <Bell size={18} />
              {(reviewCount > 0 || sync.pendingCount > 0 || !sync.isOnline) && (
                <span className="retail-bell-dot" aria-hidden="true" />
              )}
            </button>

            {openMenu === "bell" && (
              <div className="retail-floating-menu" role="menu">
                <div className="retail-floating-menu-head">
                  <strong>Status do Terminal</strong>
                  <small>
                    {sync.isOnline ? "Conectado à loja" : "Modo offline local"}
                  </small>
                </div>
                <div className="retail-floating-menu-status">
                  <ConnectionStatus syncState={sync} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    void load();
                  }}
                >
                  <RefreshCw size={15} />
                  Atualizar produtos e saldos
                </button>
                {isAdmin && (
                  <Link
                    to="/inicio/operacoes"
                    onClick={() => setOpenMenu(null)}
                  >
                    <Package size={15} />
                    Ver operações locais ({reviewCount + sync.pendingCount})
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Configurações Rápidas do Caixa */}
          <div className="retail-profile-dropdown-wrap">
            <button
              type="button"
              className="retail-circle-icon-btn"
              aria-label="Opções do caixa"
              data-tooltip="Opções do caixa e turno"
              onClick={() =>
                setOpenMenu((m) => (m === "settings" ? null : "settings"))
              }
            >
              <Settings size={18} />
            </button>

            {openMenu === "settings" && (
              <div className="retail-floating-menu" role="menu">
                <div className="retail-floating-menu-head">
                  <strong>Controle do Caixa</strong>
                  <small>
                    {shift.cashRegister ? "Caixa aberto" : "Caixa fechado"}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={!shift.cashRegister}
                  onClick={() => {
                    setOpenMenu(null);
                    setMovement(true);
                  }}
                >
                  <Wallet size={15} />
                  Movimentação (Sangria / Suprimento)
                </button>
                <button
                  type="button"
                  disabled={!shift.cashRegister}
                  onClick={() => {
                    setOpenMenu(null);
                    setCloseRegister(true);
                  }}
                >
                  <Monitor size={15} />
                  Fechar caixa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    void load();
                  }}
                >
                  <RefreshCw size={15} />
                  Atualizar catálogo
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      shell.setCashierOnlyMode((v) => !v);
                    }}
                  >
                    <LayoutDashboard size={15} />
                    {shell.cashierOnlyMode
                      ? "Mostrar menu lateral (Visão Admin)"
                      : "Ocultar menu lateral (Visão Caixa)"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Avatares sobrepostos da equipe */}
          <RetailTeamAvatars
            onClick={() => setSwitchOperator(true)}
            tooltip="Alternar operador do caixa"
          />

          {/* Botão Pílula "+ Novo Acesso" (New Access na referência) */}
          <button
            type="button"
            className="retail-new-access-btn"
            aria-label="Trocar operador"
            data-tooltip="Trocar operador ou novo acesso por PIN"
            onClick={() => setSwitchOperator(true)}
          >
            <UserPlus size={15} />
            <span>Novo Acesso</span>
          </button>

          {/* Seletor do Operador / Conta Atual */}
          <div className="retail-profile-dropdown-wrap">
            <button
              type="button"
              className="retail-profile-trigger"
              aria-label="Perfil e sessão"
              aria-expanded={openMenu === "profile"}
              onClick={() =>
                setOpenMenu((m) => (m === "profile" ? null : "profile"))
              }
            >
              <RetailOperatorAvatar
                name={shift.operator?.name || user?.name}
              />
              <ChevronsUpDown size={15} />
            </button>

            {openMenu === "profile" && (
              <div className="retail-floating-menu" role="menu">
                <div className="retail-floating-menu-head">
                  <strong>
                    {shift.operator?.name || user?.name || "Operador"}
                  </strong>
                  <small>
                    {isAdmin
                      ? shell.cashierOnlyMode
                        ? "Modo Caixa (Sem Menu Lateral)"
                        : "Administrador"
                      : "Operador de Caixa"}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setSwitchOperator(true);
                  }}
                >
                  <UserRound size={15} />
                  Trocar operador (PIN)
                </button>
                <button
                  type="button"
                  disabled={!shift.cashRegister}
                  onClick={() => {
                    setOpenMenu(null);
                    setMovement(true);
                  }}
                >
                  <Wallet size={15} />
                  Movimentação de caixa
                </button>
                <button
                  type="button"
                  disabled={!shift.cashRegister}
                  onClick={() => {
                    setOpenMenu(null);
                    setCloseRegister(true);
                  }}
                >
                  <Monitor size={15} />
                  Fechar caixa
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        shell.setCashierOnlyMode((v) => !v);
                      }}
                    >
                      <Monitor size={15} />
                      {shell.cashierOnlyMode
                        ? "Ativar Menu Lateral (Admin)"
                        : "Simular Visão Caixa (Sem Menu)"}
                    </button>
                    <Link to="/inicio" onClick={() => setOpenMenu(null)}>
                      <LayoutDashboard size={15} />
                      Painel de Gestão
                    </Link>
                  </>
                )}
                <button type="button" onClick={logout}>
                  <LogOut size={15} />
                  Sair da loja
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {shift.registerQueryFailed && (
        <div className="retail-message" role="status">
          Não foi possível confirmar o caixa no servidor.{" "}
          {shift.cashRegister
            ? "O caixa salvo pode ser usado para registrar vendas pendentes."
            : "Atualize a conexão para consultar o caixa."}
          <button
            type="button"
            className="retail-button"
            onClick={() => void shift.refreshShift()}
          >
            Consultar caixa
          </button>
        </div>
      )}

      {reviewCount > 0 && (
        <div className="retail-message">
          <Link to="/inicio/operacoes">
            {reviewCount} operação(ões) precisam de conferência. Abrir
            registros.
          </Link>
        </div>
      )}

      <div className="retail-pos-body">
        {/* Coluna Esquerda: Filtros de Categoria + Busca + Grade de Produtos */}
        <section
          className="retail-catalog"
          aria-label="Catálogo de mercadorias"
          aria-busy={loading}
        >
          <div className="retail-catalog-controls">
            <div className="retail-catalog-filterbar">
              <div className="retail-category-row" aria-label="Categorias">
                <button
                  type="button"
                  className={`retail-cat-pill ${!category ? "is-active" : ""}`}
                  aria-pressed={!category}
                  onClick={() => {
                    setCategoryDir(
                      0 >= categoryIdxRef.current ? "forward" : "backward",
                    );
                    categoryIdxRef.current = 0;
                    setCategory("");
                  }}
                >
                  <span>Todos os Produtos</span>
                  <span className="retail-cat-count retail-number">
                    {categoryStats.total}
                  </span>
                </button>
                {categories.map((c, idx) => {
                  const pillIdx = idx + 1;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      className={`retail-cat-pill ${category === c.id ? "is-active" : ""}`}
                      aria-pressed={category === c.id}
                      onClick={() => {
                        setCategoryDir(
                          pillIdx >= categoryIdxRef.current
                            ? "forward"
                            : "backward",
                        );
                        categoryIdxRef.current = pillIdx;
                        setCategory(c.id);
                      }}
                    >
                      <CategoryIconBadge
                        iconId={(c as any).icon}
                        categoryId={c.id}
                        categoryName={c.name}
                        size={18}
                      />
                      <span>{c.name}</span>
                      <span className="retail-cat-count retail-number">
                        {categoryStats.byCat.get(c.id) || 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="retail-catalog-search-group">
                <label className="retail-pos-search">
                  <Search size={16} />
                  <span className="sr-only">
                    Buscar mercadoria ou ler código
                  </span>
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar produto ou código · F3"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const exact = products.find(
                          (p) =>
                            p.barcode === search.trim() ||
                            p.shortCode === search.trim(),
                        );
                        if (exact) add(exact);
                        else if (grouped.length === 1) open(grouped[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {offlineCatalog && (
              <p className="retail-muted" style={{ margin: "6px 0 0" }}>
                Catálogo salvo neste dispositivo · o saldo será validado na
                confirmação.
              </p>
            )}
            {error && (
              <p role="alert" className="retail-message">
                {error}
              </p>
            )}
          </div>

          <div className="retail-catalog-scroll">
            {loading ? (
              <div className="retail-loader-region" role="status">
                <PdvLojistaLoader
                  mode="loader"
                  size={88}
                  label="Carregando mercadorias…"
                />
              </div>
            ) : grouped.length ? (
              <div
                key={category || "all"}
                className="retail-products-grid"
                data-cat-dir={categoryDir}
              >
                {grouped.map((group, cardIdx) => {
                  const totalStock = group.variants.reduce(
                    (n, v) => n + Number(v.stock),
                    0,
                  );
                  const sizesPreview = [
                    ...new Set(
                      group.variants
                        .map((v) => v.size)
                        .filter(Boolean) as string[],
                    ),
                  ]
                    .slice(0, 4)
                    .join(", ");

                  return (
                    <button
                      type="button"
                      key={group.id}
                      className="retail-product-card"
                      style={
                        {
                          "--card-idx": Math.min(cardIdx, 11),
                        } as React.CSSProperties
                      }
                      onClick={() => open(group)}
                    >
                      <div className="retail-card-media">
                        <span className="retail-card-stock-badge retail-number">
                          {totalStock} em Estoque
                        </span>
                        {group.imageUrl ? (
                          <div className="retail-card-photo-stage">
                            <img
                              loading="lazy"
                              src={getFullUrl(group.imageUrl)}
                              alt=""
                              aria-hidden="true"
                              className="retail-card-photo-ambient"
                            />
                            <img
                              loading="lazy"
                              src={getFullUrl(group.imageUrl)}
                              alt=""
                              className="retail-card-photo-main"
                            />
                          </div>
                        ) : (
                          <div className="retail-card-placeholder">
                            <ProductCardIllustration
                              name={group.name}
                              categoryName={group.categoryName}
                            />
                          </div>
                        )}
                      </div>
                      <div className="retail-product-card-content">
                        <strong>{group.name}</strong>
                        <span className="retail-card-desc">
                          {group.variants.length} variações · {totalStock} peças
                          {sizesPreview ? ` · Tam. ${sizesPreview}` : ""} ·{" "}
                          {group.categoryName || "Coleção Loja"} pronta entrega
                        </span>
                        <b className="retail-card-price retail-number">
                          {money(group.price)}
                        </b>
                        <span className="retail-card-add-btn">
                          <Plus size={14} strokeWidth={2.3} />
                          <span>Adicionar ao Carrinho</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="retail-empty">
                <Package size={40} />
                <h2>
                  {search
                    ? "Nenhuma mercadoria encontrada"
                    : "Seu catálogo começa aqui"}
                </h2>
                <p>
                  {search
                    ? "Tente outro nome, código, tamanho ou cor."
                    : "Cadastre os grupos de mercadorias e suas grades na gestão."}
                </p>
                {isAdmin && (
                  <Link className="retail-button" to="/estoque">
                    Abrir mercadorias e grades
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Coluna Direita: Detalhes da Transação (Detail Transaction na referência) */}
        {mobileBagOpen && (
          <div
            className="retail-mobile-bag-backdrop"
            aria-hidden="true"
            onClick={() => setMobileBagOpen(false)}
          />
        )}
        <aside
          className={`retail-order ${mobileBagOpen ? "is-mobile-open" : ""}`}
          aria-label="Venda atual"
        >
          <div
            className="retail-sheet-handle"
            aria-hidden="true"
            onClick={() => setMobileBagOpen(false)}
          />
          <div className="retail-order-head">
            <h2>Detalhes da Transação</h2>
            <div className="retail-order-head-actions">
              <button
                type="button"
                className="retail-reset-order-btn"
                disabled={!cart.items.length || cart.isOperationLocked}
                onClick={() => cart.clearCart()}
                data-tooltip="Limpar todos os itens do pedido"
              >
                <Trash2 size={13} />
                <span>Limpar Pedido</span>
              </button>
              <button
                type="button"
                className="retail-icon-button retail-mobile-bag-close"
                aria-label="Fechar sacola"
                onClick={() => setMobileBagOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="retail-order-items">
            {cart.items.length ? (
              cart.items.map((item, itemIdx) => {
                const thumbUrl =
                  item.retailGroup?.imageUrl || item.imageUrl || null;
                return (
                  <article
                    className="retail-order-item"
                    key={item.cartKey}
                    style={
                      {
                        "--item-idx": Math.min(itemIdx, 8),
                      } as React.CSSProperties
                    }
                  >
                    <div className="retail-order-item-thumb">
                      {thumbUrl ? (
                        <img src={getFullUrl(thumbUrl)} alt="" />
                      ) : (
                        <ProductCardIllustration
                          name={item.retailGroup?.name || item.name}
                          categoryName={item.category?.name}
                          compact
                        />
                      )}
                    </div>

                    <div className="retail-order-item-main">
                      <div className="retail-order-item-top">
                        <h3>{item.retailGroup?.name || item.name}</h3>
                        <button
                          type="button"
                          className="retail-item-delete-circle"
                          aria-label={`Remover ${item.name}`}
                          data-tooltip="Remover item"
                          onClick={() => cart.removeItem(item.cartKey)}
                          disabled={cart.isOperationLocked}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="retail-order-item-pills">
                        <span className="retail-variant-pill">
                          Tam. {item.size || "Único"}
                        </span>
                        <span className="retail-variant-pill">
                          <span
                            className="retail-variant-dot"
                            aria-hidden="true"
                          />
                          {item.color || "Padrão"}
                        </span>
                      </div>

                      <div className="retail-order-quantity">
                        <div className="retail-qty-stepper">
                          <button
                            type="button"
                            className="retail-qty-circle is-minus"
                            aria-label={`Diminuir ${item.name}`}
                            data-tooltip="Diminuir quantidade"
                            disabled={cart.isOperationLocked}
                            onClick={() =>
                              cart.updateQuantity(
                                item.cartKey,
                                item.quantity - 1,
                              )
                            }
                          >
                            <Minus size={13} />
                          </button>
                          <span
                            key={item.quantity}
                            className="retail-qty-value retail-number is-pop"
                          >
                            {String(item.quantity).padStart(2, "0")}
                          </span>
                          <button
                            type="button"
                            className="retail-qty-circle is-plus"
                            aria-label={`Aumentar ${item.name}`}
                            data-tooltip="Aumentar quantidade"
                            disabled={cart.isOperationLocked}
                            onClick={() => add(item)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <div className="retail-item-total-box">
                          <span className="retail-muted">Total</span>
                          <strong className="retail-number">
                            {money(item.subtotal)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="retail-empty retail-order-empty">
                <ShoppingBag size={30} />
                <p>Escolha uma mercadoria para iniciar a venda.</p>
              </div>
            )}
          </div>

          <div className="retail-order-foot">
            {/* Card de Resumo e Promoção / Desconto */}
            <div className="retail-summary-card">
              <div className="retail-promo-bar">
                <div className="retail-promo-info">
                  <span className="retail-promo-icon" aria-hidden="true">
                    <BadgePercent size={14} />
                  </span>
                  <span>Promoção / Desconto (0%)</span>
                </div>
                <button
                  type="button"
                  className="retail-promo-btn"
                  disabled={!cart.items.length || !shift.cashRegister}
                  onClick={() => setCheckout(true)}
                >
                  Alterar Desconto
                </button>
              </div>

              <div className="retail-summary-rows">
                <div className="retail-summary-row">
                  <span>Subtotal</span>
                  <strong className="retail-number">{money(cart.total)}</strong>
                </div>
                <div className="retail-summary-row">
                  <span>Impostos (Est.)</span>
                  <strong className="retail-number">
                    {money(estimatedTax)}
                  </strong>
                </div>
                <div className="retail-summary-row">
                  <span>Desconto</span>
                  <strong className="retail-number">-{money(0)}</strong>
                </div>
              </div>

              <div className="retail-summary-total">
                <span>Total do Pagamento</span>
                <strong
                  key={cart.total}
                  className="retail-number retail-total-pop"
                >
                  {money(cart.total)}
                </strong>
              </div>
            </div>

            {/* Seletor Rápido de Método de Pagamento */}
            <div className="retail-method-card">
              <div className="retail-method-info">
                <span className="retail-card-brand-circles" aria-hidden="true">
                  <span className="is-c1" />
                  <span className="is-c2" />
                </span>
                <strong
                  key={currentQuickMethod.id}
                  className="retail-method-label-flip"
                >
                  {currentQuickMethod.label}
                </strong>
              </div>
              <button
                type="button"
                className="retail-change-method-btn"
                onClick={cycleQuickMethod}
                data-tooltip="Alternar forma de pagamento principal"
              >
                <span>Trocar Método</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Botão Principal Continuar / Finalizar venda · F2 */}
            <button
              type="button"
              className="retail-button retail-button-primary retail-continue-btn"
              aria-label="Finalizar venda · F2"
              disabled={
                !cart.items.length ||
                !shift.cashRegister ||
                shift.needsOperatorReauth ||
                cart.isOperationLocked
              }
              onClick={() => {
                setMobileBagOpen(false);
                setCheckout(true);
              }}
            >
              Continuar
            </button>
          </div>
        </aside>
      </div>

      {/* Barra Flutuante da Sacola no Mobile (<= 768px) */}
      <div
        className={`retail-mobile-bag-bar ${
          cart.items.length > 0 ? "has-items" : "is-empty"
        }`}
        role="region"
        aria-label="Resumo rápido da sacola"
      >
        <button
          type="button"
          className="retail-mobile-bag-summary"
          aria-expanded={mobileBagOpen}
          onClick={() => setMobileBagOpen((v) => !v)}
        >
          <span className="retail-mobile-bag-icon">
            <ShoppingBag size={18} strokeWidth={2.2} />
            {totalCartPieces > 0 && (
              <span className="retail-mobile-bag-badge retail-number">
                {totalCartPieces}
              </span>
            )}
          </span>
          <span className="retail-mobile-bag-text">
            <strong>
              {totalCartPieces > 0
                ? `${totalCartPieces} ${
                    totalCartPieces === 1 ? "peça na sacola" : "peças na sacola"
                  }`
                : "Sacola vazia"}
            </strong>
            <span className="retail-number">{money(cart.total)}</span>
          </span>
          <ChevronUp
            size={16}
            className={`retail-mobile-bag-chevron ${
              mobileBagOpen ? "is-open" : ""
            }`}
          />
        </button>

        <button
          type="button"
          className="retail-mobile-bag-cta"
          disabled={
            !cart.items.length ||
            !shift.cashRegister ||
            shift.needsOperatorReauth ||
            cart.isOperationLocked
          }
          onClick={() => {
            setMobileBagOpen(false);
            setCheckout(true);
          }}
        >
          Receber
        </button>
      </div>

      {choice && (
        <RetailDialog title={choice.name} onClose={() => setChoice(null)}>
          <div className="retail-dialog-body">
            <div className="retail-choice-hero">
              <div className="retail-choice-hero-media">
                {choice.imageUrl ? (
                  <>
                    <img
                      src={getFullUrl(choice.imageUrl)}
                      alt=""
                      aria-hidden="true"
                      className="retail-card-photo-ambient"
                    />
                    <img
                      src={getFullUrl(choice.imageUrl)}
                      alt=""
                      className="retail-card-photo-main"
                    />
                  </>
                ) : (
                  <ProductCardIllustration
                    name={choice.name}
                    categoryName={choice.categoryName}
                  />
                )}
              </div>
              <div className="retail-choice-hero-info">
                <span className="retail-badge">
                  {choice.categoryName || "Grade de Mercadoria"}
                </span>
                <strong className="retail-choice-hero-price retail-number">
                  {money(choice.price)}
                </strong>
                <p className="retail-muted" style={{ margin: 0 }}>
                  Escolha o tamanho e a cor. Cada opção tem saldo próprio.
                </p>
              </div>
            </div>
            <div className="retail-variant-list">
              {choice.variants.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => add(product)}
                  disabled={
                    !allowNegative &&
                    Number(product.stock) <=
                      cart.items
                        .filter((i) => i.id === product.id)
                        .reduce((n, i) => n + i.quantity, 0)
                  }
                >
                  <strong>
                    {product.size || "Único"} · {product.color || "Sortida"}
                  </strong>
                  <span>
                    {Number(product.stock)} peças em estoque ·{" "}
                    {money(product.priceSell)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </RetailDialog>
      )}

      {(!shift.operator || shift.needsOperatorReauth || switchOperator) && (
        <OperatorLoginModal
          isReauth={shift.needsOperatorReauth}
          onSuccess={() => {
            setSwitchOperator(false);
            void shift.refreshShift();
          }}
          onClose={
            shift.operator && !shift.needsOperatorReauth
              ? () => setSwitchOperator(false)
              : undefined
          }
        />
      )}

      {shift.operator &&
        !shift.needsOperatorReauth &&
        !shift.cashRegister &&
        shift.registerStatus === "closed_confirmed" && (
          <OpenShiftModal onSuccess={() => void shift.refreshShift()} />
        )}

      {checkout && (
        <RetailCheckoutModal
          isOnline={sync.isOnline}
          config={config || shell.config}
          initialMethod={currentQuickMethod.id}
          onClose={() => setCheckout(false)}
          onDone={() => {
            void load();
            void sync.syncNow();
          }}
        />
      )}

      {closeRegister && (
        <Suspense
          fallback={
            <div className="retail-modal-overlay" role="status">
              <div className="retail-panel">
                <PdvLojistaLoader
                  mode="loader"
                  size={44}
                  label="Carregando fechamento…"
                />
              </div>
            </div>
          }
        >
          <CloseRegisterModal
            isOpen
            onClose={(closed) => {
              setCloseRegister(false);
              if (closed) void shift.refreshShift();
            }}
            registerId={shift.cashRegister?.id}
          />
        </Suspense>
      )}

      {movement && shift.cashRegister && (
        <CashMovementModal
          isOpen
          registerId={shift.cashRegister.id}
          onClose={() => {
            setMovement(false);
            void shift.refreshShift();
          }}
        />
      )}
    </div>
  );
}
