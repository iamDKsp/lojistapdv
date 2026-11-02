import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Home,
  HandCoins,
  Package,
  Banknote,
  History,
  UserPlus,
  RotateCcw,
  ShieldCheck,
  HelpCircle,
  LogOut,
  Bell,
  Settings,
  ChevronsUpDown,
  ClipboardList,
  Menu,
  X,
  Monitor,
  Tv2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useShift } from "@/contexts/ShiftContext";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { triggerSessionEntryTransition } from "@/components/ui";
import {
  getCanonicalModuleId,
  shouldIgnoreArrowNavigation,
} from "@/lib/routes";

interface RetailShellContextValue {
  config: any;
  isAdmin: boolean;
  isStockist: boolean;
  showSidebar: boolean;
  cashierOnlyMode: boolean;
  setCashierOnlyMode: (val: boolean | ((prev: boolean) => boolean)) => void;
}

const RetailShellContext = createContext<RetailShellContextValue>({
  config: null,
  isAdmin: false,
  isStockist: false,
  showSidebar: false,
  cashierOnlyMode: false,
  setCashierOnlyMode: () => {},
});

export function useRetailShell() {
  return useContext(RetailShellContext);
}

function FallbackAvatarSvg({ variant }: { variant: number }) {
  const v = variant % 3;
  if (v === 0) {
    return (
      <svg viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="18" fill="var(--pdv-support)" />
        <circle cx="18" cy="14" r="6" fill="var(--pdv-primary)" />
        <path
          d="M7 33c1.8-6.2 6.1-9.5 11-9.5s9.2 3.3 11 9.5"
          fill="var(--pdv-primary-hover)"
        />
      </svg>
    );
  }
  if (v === 1) {
    return (
      <svg viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="18" fill="var(--pdv-background)" />
        <circle cx="18" cy="14" r="6" fill="var(--pdv-text-secondary)" />
        <path
          d="M7 33c1.8-6.2 6.1-9.5 11-9.5s9.2 3.3 11 9.5"
          fill="var(--pdv-text)"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="18" fill="var(--pdv-primary)" />
      <circle cx="18" cy="14" r="6" fill="var(--pdv-white)" />
      <path
        d="M7 33c1.8-6.2 6.1-9.5 11-9.5s9.2 3.3 11 9.5"
        fill="var(--pdv-support)"
      />
    </svg>
  );
}

/**
 * Avatares interativos da equipe do tenant no cabeçalho superior.
 * Cada ícone representa um funcionário ativo; clicar troca imediatamente para o caixa dele.
 */
export function RetailTeamAvatars({
  onClick,
  tooltip = "Equipe e operadores do turno",
}: {
  onClick?: () => void;
  tooltip?: string;
}) {
  const { operators, operator: activeOperator, quickSwitchOperator } = useShift();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  if (operators.length > 0) {
    return (
      <div
        className="retail-avatar-stack"
        role="group"
        aria-label={tooltip}
      >
        {operators.map((op, idx) => {
          const isCurrent = activeOperator?.id === op.id;
          const hasPhoto = Boolean(op.imageUrl && !failedImages[op.id]);
          const label = isCurrent
            ? `Avatar do turno ativo (${idx + 1})`
            : `Alternar turno rápido (${idx + 1})`;

          return (
            <button
              type="button"
              key={op.id}
              className={`retail-avatar-item is-a${(idx % 3) + 1} ${isCurrent ? "is-active-operator" : ""}`}
              aria-label={label}
              aria-pressed={isCurrent}
              data-tooltip={isCurrent ? `${op.name} · Em atendimento` : `Atender como ${op.name}`}
              disabled={switchingId === op.id}
              onClick={async () => {
                if (isCurrent) return;
                setSwitchingId(op.id);
                try {
                  const ok = await quickSwitchOperator(op);
                  if (!ok && onClick) onClick();
                } finally {
                  setSwitchingId(null);
                }
              }}
            >
              {hasPhoto ? (
                <img
                  src={getFullUrl(op.imageUrl)}
                  alt=""
                  className="retail-avatar-photo"
                  onError={() =>
                    setFailedImages((prev) => ({ ...prev, [op.id]: true }))
                  }
                />
              ) : (
                <FallbackAvatarSvg variant={idx} />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="retail-avatar-stack"
      onClick={onClick}
      aria-label={tooltip}
      data-tooltip={tooltip}
    >
      <span className="retail-avatar-item is-a1" aria-hidden="true">
        <FallbackAvatarSvg variant={0} />
      </span>
      <span className="retail-avatar-item is-a2" aria-hidden="true">
        <FallbackAvatarSvg variant={1} />
      </span>
      <span className="retail-avatar-item is-a3" aria-hidden="true">
        <FallbackAvatarSvg variant={2} />
      </span>
    </button>
  );
}

export function RetailOperatorAvatar({
  name,
  imageUrl,
}: {
  name?: string | null;
  imageUrl?: string | null;
}) {
  const { operator } = useShift();
  const resolvedPhoto = imageUrl !== undefined ? imageUrl : operator?.imageUrl;
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [resolvedPhoto]);

  const initials = useMemo(() => {
    if (!name) return "OP";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  return (
    <span className="retail-operator-avatar" aria-hidden="true">
      {resolvedPhoto && !imgError ? (
        <img
          src={getFullUrl(resolvedPhoto)}
          alt={name || "Operador"}
          className="retail-operator-avatar-img"
          onError={() => setImgError(true)}
        />
      ) : (
        <svg viewBox="0 0 38 38" fill="none">
          <rect width="38" height="38" rx="19" fill="var(--pdv-support)" />
          <circle cx="19" cy="13.5" r="5.5" fill="var(--pdv-primary)" />
          <path
            d="M8.5 34c1.8-5.8 5.8-8.8 10.5-8.8s8.7 3 10.5 8.8"
            fill="var(--pdv-primary-hover)"
          />
        </svg>
      )}
      <span className="retail-operator-initials">{initials}</span>
    </span>
  );
}

export function RetailLayout() {
  const { user, logout, setTenantLogo } = useAuthStore();
  const shift = useShift();
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [cashierOnlyMode, setCashierOnlyMode] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/tenants/me", { signal: controller.signal })
      .then((res) => {
        setConfig(res.data);
        if (res.data?.logoUrl !== undefined) {
          setTenantLogo(res.data.logoUrl ?? null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [user?.tenant, setTenantLogo]);

  const tenantLogoUrl = useMemo(() => {
    const raw = config?.logoUrl || user?.logoUrl || null;
    return raw ? getFullUrl(raw) : "";
  }, [config?.logoUrl, user?.logoUrl]);

  useEffect(() => {
    setLogoLoadError(false);
  }, [tenantLogoUrl]);

  useEffect(() => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  const role = user?.role || "";
  const isAdmin = role === "admin" || role === "superadmin";
  const isStockist = role === "stockist";

  // Regra solicitada: Só tem menu lateral quando for ADM (ou estoquista no módulo de estoque).
  // Quando for caixa (role === 'operator' ou modo caixa ativo), não tem menu lateral, apenas o Ponto de Venda.
  const showSidebar = (isAdmin || isStockist) && !cashierOnlyMode;

  const modules = (() => {
    try {
      return typeof config?.modulos === "string"
        ? JSON.parse(config.modulos)
        : config?.modulos || {};
    } catch {
      return {};
    }
  })();

  function moduleAllowed(path: string) {
    if (path.includes("entrada-xml") || path.includes("purchases/imports"))
      return modules.nfce !== false || modules.importacaoXml === true;
    if (
      path.includes("/configuracoes/nfce") ||
      path.includes("/fiscal/") ||
      path.includes("/tributacao")
    )
      return modules.nfce !== false;
    if (path.includes("/estoque/contagem") || path.includes("stock-count"))
      return modules.estoque !== false;
    if (path.includes("/crediario")) return Boolean(modules.crediario);
    if (path.includes("/vitrine"))
      return Boolean(modules.vitrineDigital || modules.digitalSignage);
    return true;
  }

  if (isStockist && !location.pathname.startsWith("/estoque")) {
    return <Navigate to="/estoque" replace />;
  }

  const pathname = location.pathname;
  const isPosRoute = pathname === "/";

  const railGroups = isStockist
    ? [
        [
          {
            name: "Mercadorias e grades",
            path: "/estoque",
            icon: Package,
            iconKind: "inventory",
            active:
              pathname === "/estoque" ||
              pathname.startsWith("/estoque/categorias") ||
              pathname.startsWith("/estoque/entrada-manual") ||
              pathname.startsWith("/estoque/entrada-xml"),
          },
          ...(moduleAllowed("/estoque/contagem")
            ? [
                {
                  name: "Contagem de estoque",
                  path: "/estoque/contagem",
                  icon: ClipboardList,
                  iconKind: "inventory",
                  active: pathname.startsWith("/estoque/contagem"),
                },
              ]
            : []),
        ],
      ]
    : [
        [
          {
            name: "Visão geral",
            path: "/inicio",
            icon: Home,
            iconKind: "home",
            active: pathname === "/inicio",
          },
          {
            name: "Frente de caixa",
            path: "/",
            icon: HandCoins,
            iconKind: "pos",
            active: pathname === "/",
          },
          {
            name: "Mercadorias e grades",
            path: "/estoque",
            icon: Package,
            iconKind: "inventory",
            active: pathname.startsWith("/estoque"),
          },
          {
            name: "Contas a pagar",
            path: "/financeiro/contas-a-pagar",
            icon: Banknote,
            iconKind: "finance",
            active: pathname.startsWith("/financeiro"),
          },
        ],
        [
          {
            name: "Histórico de caixas",
            path: "/inicio/historico-de-caixas",
            icon: History,
            iconKind: "registers",
            active:
              pathname.startsWith("/inicio/historico-de-caixas") ||
              pathname.startsWith("/inicio/operacoes") ||
              pathname.startsWith("/inicio/relatorios"),
          },
          {
            name: "Equipe",
            path: "/equipe",
            icon: UserPlus,
            iconKind: "team",
            active: pathname.startsWith("/equipe"),
          },
          {
            name: "Clientes e trocas",
            path: "/clientes",
            icon: RotateCcw,
            iconKind: "returns",
            active: pathname.startsWith("/clientes"),
          },
          ...(moduleAllowed("/crediario")
            ? [
                {
                  name: "Crediário e cobrança",
                  path: "/crediario",
                  icon: ClipboardList,
                  iconKind: "finance",
                  active: pathname.startsWith("/crediario"),
                },
              ]
            : []),
          ...(moduleAllowed("/vitrine")
            ? [
                {
                  name: "Vitrine e TV",
                  path: "/vitrine",
                  icon: Tv2,
                  iconKind: "vitrine",
                  active: pathname.startsWith("/vitrine"),
                },
              ]
            : []),
        ],
        [
          ...(moduleAllowed("/configuracoes/nfce")
            ? [
                {
                  name: "Gestão de NFC-e",
                  path: "/configuracoes/nfce",
                  icon: ShieldCheck,
                  iconKind: "fiscal",
                  active:
                    pathname.startsWith("/configuracoes/nfce") ||
                    pathname.startsWith("/configuracoes/tributacao"),
                },
              ]
            : []),
          {
            name: "Empresa",
            path: "/configuracoes/empresa",
            icon: HelpCircle,
            iconKind: "settings",
            active:
              pathname.startsWith("/configuracoes/empresa") ||
              pathname.startsWith("/configuracoes/pagamentos"),
          },
        ],
      ];

  const subNavTabs = useMemo(() => {
    if (isPosRoute) return [];
    if (pathname.startsWith("/estoque")) {
      return [
        { label: "Mercadorias e grades", path: "/estoque" },
        ...(moduleAllowed("/estoque/contagem")
          ? [
              {
                label: "Contagem de estoque",
                path: "/estoque/contagem",
              },
            ]
          : []),
        { label: "Categorias", path: "/estoque/categorias" },
        { label: "Entrada manual", path: "/estoque/entrada-manual" },
        ...(moduleAllowed("/estoque/entrada-xml")
          ? [
              {
                label: "Entrada por XML",
                path: "/estoque/entrada-xml",
              },
            ]
          : []),
      ];
    }
    if (pathname.startsWith("/financeiro")) {
      return [
        { label: "Contas a pagar", path: "/financeiro/contas-a-pagar" },
        { label: "Pedidos de compra", path: "/financeiro/pedidos-de-compra" },
        { label: "Fornecedores", path: "/financeiro/fornecedores" },
      ];
    }
    if (pathname.startsWith("/inicio")) {
      return [
        { label: "Visão geral", path: "/inicio" },
        { label: "Histórico de caixas", path: "/inicio/historico-de-caixas" },
        { label: "Relatórios de vendas", path: "/inicio/relatorios" },
        { label: "Operações locais", path: "/inicio/operacoes" },
      ];
    }
    if (pathname.startsWith("/clientes")) {
      return [
        { label: "Clientes e insights", path: "/clientes" },
        { label: "Trocas e créditos", path: "/clientes/trocas" },
      ];
    }
    if (pathname.startsWith("/configuracoes")) {
      return [
        { label: "Empresa", path: "/configuracoes/empresa" },
        {
          label: "Pagamentos",
          path: "/configuracoes/pagamentos",
        },
        ...(moduleAllowed("/configuracoes/tributacao")
          ? [
              {
                label: "Tributação",
                path: "/configuracoes/tributacao",
              },
              { label: "Gestão de NFC-e", path: "/configuracoes/nfce" },
            ]
          : []),
      ];
    }
    if (pathname.startsWith("/crediario")) {
      return [
        { label: "Contas de clientes", path: "/crediario" },
        { label: "Parcelas e vencimentos", path: "/crediario/parcelas" },
        { label: "WhatsApp e régua", path: "/crediario/whatsapp" },
      ];
    }
    if (pathname.startsWith("/vitrine")) {
      return [
        { label: "Programação e slides", path: "/vitrine" },
        { label: "Aparência e link da TV", path: "/vitrine/aparencia" },
      ];
    }
    return [];
  }, [
    isPosRoute,
    pathname,
    modules.nfce,
    modules.importacaoXml,
    modules.estoque,
    modules.crediario,
    modules.vitrineDigital,
    modules.digitalSignage,
  ]);

  const sectionHeading = useMemo(() => {
    if (pathname.startsWith("/estoque")) return "Catálogo e Estoque";
    if (pathname.startsWith("/financeiro")) return "Compras e Financeiro";
    if (pathname.startsWith("/inicio/historico-de-caixas"))
      return "Histórico de Caixas";
    if (pathname.startsWith("/inicio/operacoes")) return "Operações Locais";
    if (pathname.startsWith("/inicio/relatorios")) return "Relatórios da Loja";
    if (pathname.startsWith("/equipe")) return "Equipe e Acessos";
    if (pathname.startsWith("/clientes/trocas")) return "Trocas e Créditos";
    if (pathname.startsWith("/clientes")) return "Clientes e Pós-Venda";
    if (pathname.startsWith("/crediario")) return "Crediário e Cobrança";
    if (pathname.startsWith("/vitrine")) return "Vitrine Digital e TV";
    if (pathname.startsWith("/configuracoes/nfce")) return "Gestão Fiscal";
    if (pathname.startsWith("/configuracoes")) return "Configurações da Loja";
    return config?.nomeFantasia || config?.razaoSocial || "Painel da Loja";
  }, [pathname, config?.nomeFantasia, config?.razaoSocial]);

  const moduleKind = useMemo(() => {
    if (pathname === "/") return "pos";
    if (pathname.startsWith("/estoque")) return "inventory";
    if (pathname.startsWith("/crediario")) return "finance";
    if (pathname.startsWith("/vitrine")) return "vitrine";
    if (pathname.startsWith("/financeiro")) return "finance";
    if (
      pathname.startsWith("/inicio/historico-de-caixas") ||
      pathname.startsWith("/inicio/operacoes")
    )
      return "registers";
    if (pathname.startsWith("/equipe")) return "team";
    if (pathname.startsWith("/clientes")) return "returns";
    if (pathname.startsWith("/configuracoes")) return "settings";
    return "overview";
  }, [pathname]);

  const canonicalModule = useMemo(
    () => getCanonicalModuleId(pathname),
    [pathname],
  );

  const activeTabIndex = useMemo(() => {
    return subNavTabs.findIndex((tab) =>
      tab.path === "/inicio" ||
      tab.path === "/estoque" ||
      tab.path === "/clientes" ||
      tab.path === "/crediario" ||
      tab.path === "/vitrine"
        ? pathname === tab.path
        : pathname.startsWith(tab.path),
    );
  }, [subNavTabs, pathname]);

  const flatRailItems = useMemo(() => railGroups.flat(), [railGroups]);

  const activeRailIndex = useMemo(() => {
    return flatRailItems.findIndex((item) => item.active);
  }, [flatRailItems]);

  const pendingNavIntentRef = useRef<"module" | "tab" | null>(null);

  const navHistoryRef = useRef({
    pathname,
    canonicalModule,
    moduleKind,
    tabIndex: activeTabIndex,
    railIndex: activeRailIndex,
    direction: "module-enter" as
      | "tab-forward"
      | "tab-backward"
      | "module-down"
      | "module-up"
      | "module-enter",
  });

  if (navHistoryRef.current.pathname !== pathname) {
    const prev = navHistoryRef.current;
    let direction: typeof prev.direction = "module-enter";
    if (
      prev.canonicalModule === canonicalModule &&
      pendingNavIntentRef.current !== "module" &&
      prev.tabIndex !== -1 &&
      activeTabIndex !== -1 &&
      prev.tabIndex !== activeTabIndex
    ) {
      direction =
        activeTabIndex > prev.tabIndex ? "tab-forward" : "tab-backward";
    } else if (
      prev.railIndex !== -1 &&
      activeRailIndex !== -1 &&
      prev.railIndex !== activeRailIndex
    ) {
      direction =
        activeRailIndex > prev.railIndex ? "module-down" : "module-up";
    }
    navHistoryRef.current = {
      pathname,
      canonicalModule,
      moduleKind,
      tabIndex: activeTabIndex,
      railIndex: activeRailIndex,
      direction,
    };
  }

  const navDirection = navHistoryRef.current.direction;

  const prevRouteRef = useRef({
    pathname,
    canonicalModule,
    railIndex: activeRailIndex,
  });

  useEffect(() => {
    const prev = prevRouteRef.current;
    if (prev.pathname === pathname) return;

    const intent = pendingNavIntentRef.current;
    pendingNavIntentRef.current = null;

    const isModuleSwitch =
      intent === "module" ||
      (intent !== "tab" && prev.canonicalModule !== canonicalModule);

    prevRouteRef.current = {
      pathname,
      canonicalModule,
      railIndex: activeRailIndex,
    };

    if (isModuleSwitch) {
      const moduleLabel =
        pathname === "/"
          ? "Abrindo Frente de Caixa…"
          : `Abrindo ${sectionHeading}…`;
      triggerSessionEntryTransition(moduleLabel);
    }
  }, [pathname, canonicalModule, activeRailIndex, sectionHeading]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl &&
          (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
          !document.querySelector(
            '.retail-modal-overlay, .retail-demo-modal-backdrop, .retail-mobile-drawer-overlay, [role="dialog"]',
          )
        ) {
          activeEl.blur();
        }
        return;
      }

      if (
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown" &&
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
      ) {
        return;
      }

      if (shouldIgnoreArrowNavigation(event)) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (!showSidebar || flatRailItems.length <= 1) return;
        event.preventDefault();
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && activeEl.tagName === "INPUT") {
          activeEl.blur();
        }
        const currentIdx = activeRailIndex >= 0 ? activeRailIndex : 0;
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          (currentIdx + delta + flatRailItems.length) % flatRailItems.length;
        const target = flatRailItems[nextIdx];
        if (target && target.path !== pathname) {
          pendingNavIntentRef.current = "module";
          navigate(target.path);
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (isPosRoute) return;

        const delta = event.key === "ArrowRight" ? 1 : -1;

        if (event.shiftKey) {
          let innerPaths: string[] = [];
          if (pathname.startsWith("/configuracoes/empresa")) {
            innerPaths = [
              "/configuracoes/empresa",
              "/configuracoes/empresa/endereco",
              ...(moduleAllowed("/configuracoes/nfce")
                ? [
                    "/configuracoes/empresa/nfce",
                    "/configuracoes/empresa/certificado",
                  ]
                : []),
            ];
          } else if (pathname.startsWith("/financeiro/contas-a-pagar")) {
            innerPaths = [
              "/financeiro/contas-a-pagar/fixas",
              "/financeiro/contas-a-pagar/variaveis",
            ];
          } else if (pathname.startsWith("/estoque/entrada-xml")) {
            innerPaths = [
              "/estoque/entrada-xml/pendentes",
              "/estoque/entrada-xml/historico",
            ];
          }
          if (innerPaths.length > 1) {
            event.preventDefault();
            const currInnerIdx = Math.max(
              0,
              innerPaths.findIndex((p) => pathname === p),
            );
            const nextInnerIdx =
              (currInnerIdx + delta + innerPaths.length) % innerPaths.length;
            pendingNavIntentRef.current = "tab";
            navigate(innerPaths[nextInnerIdx]);
            return;
          }
        }

        if (subNavTabs.length <= 1) return;
        event.preventDefault();
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && activeEl.tagName === "INPUT") {
          activeEl.blur();
        }
        const currentTabIdx = activeTabIndex >= 0 ? activeTabIndex : 0;
        const nextTabIdx =
          (currentTabIdx + delta + subNavTabs.length) % subNavTabs.length;
        const targetTab = subNavTabs[nextTabIdx];
        if (targetTab && targetTab.path !== pathname) {
          pendingNavIntentRef.current = "tab";
          navigate(targetTab.path);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showSidebar,
    flatRailItems,
    activeRailIndex,
    isPosRoute,
    subNavTabs,
    activeTabIndex,
    pathname,
    navigate,
  ]);

  const contextValue = useMemo(
    () => ({
      config,
      isAdmin,
      isStockist,
      showSidebar,
      cashierOnlyMode,
      setCashierOnlyMode,
    }),
    [config, isAdmin, isStockist, showSidebar, cashierOnlyMode],
  );

  return (
    <RetailShellContext.Provider value={contextValue}>
      <div
        className={`retail-shell ${showSidebar ? "has-rail" : "no-rail"}`}
        data-active-module={moduleKind}
      >
        {showSidebar && (
          <aside
            className={`retail-rail ${menuOpen ? "is-open" : ""}`}
            aria-label="Menu principal"
          >
            <div className="retail-rail-top">
              <Link
                to={isStockist ? "/estoque" : "/"}
                className="retail-rail-logo"
                aria-label={
                  config?.nomeFantasia ||
                  config?.razaoSocial ||
                  user?.tenantName ||
                  "PDV Lojista"
                }
                data-tooltip={`${
                  config?.nomeFantasia ||
                  config?.razaoSocial ||
                  user?.tenantName ||
                  "PDV Lojista"
                } · Início`}
              >
                {tenantLogoUrl && !logoLoadError ? (
                  <img
                    src={tenantLogoUrl}
                    alt={
                      config?.nomeFantasia ||
                      config?.razaoSocial ||
                      user?.tenantName ||
                      "Logo da loja"
                    }
                    className="retail-rail-logo-img"
                    onError={() => setLogoLoadError(true)}
                  />
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 28 28"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M9.5 18.5C6.5 15.5 6.5 10.5 9.5 7.5C12.2 4.8 16.5 4.5 19.5 6.8"
                      stroke="var(--pdv-text)"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M18.5 9.5C21.5 12.5 21.5 17.5 18.5 20.5C15.8 23.2 11.5 23.5 8.5 21.2"
                      stroke="var(--pdv-text)"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M11.5 16.5L16.5 11.5"
                      stroke="var(--pdv-text)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </Link>
              <button
                type="button"
                className="retail-icon-button retail-menu-toggle"
                aria-label="Menu de navegação"
                aria-expanded={menuOpen}
                data-tooltip={menuOpen ? "Fechar menu" : "Abrir menu"}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>

            <nav className="retail-rail-nav" aria-label="Menu principal">
              {railGroups.map((group, groupIndex) => (
                <div className="retail-rail-group" key={groupIndex}>
                  {groupIndex > 0 && (
                    <div className="retail-rail-divider" aria-hidden="true" />
                  )}
                  {group.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      aria-label={item.name}
                      data-tooltip={item.name}
                      data-icon-kind={item.iconKind}
                      onClick={() => {
                        if (!item.active && item.path !== pathname) {
                          pendingNavIntentRef.current = "module";
                        }
                      }}
                      className={() =>
                        `retail-rail-item ${item.active ? "active" : ""}`
                      }
                    >
                      <item.icon size={20} strokeWidth={1.9} />
                      <span className="retail-rail-label">{item.name}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>

            <div className="retail-rail-bottom">
              <button
                type="button"
                className="retail-rail-item retail-rail-logout"
                onClick={logout}
                aria-label="Sair da loja"
                data-tooltip="Sair da loja"
              >
                <LogOut size={19} strokeWidth={1.9} />
                <span className="retail-rail-label">Sair da loja</span>
              </button>
            </div>
          </aside>
        )}

        <main className="retail-canvas" data-module-kind={moduleKind}>
          <div
            key={pathname}
            className="retail-route-progress"
            aria-hidden="true"
          />
          {isPosRoute ? (
            <div
              key="pos-stage"
              className="retail-pos-stage"
              data-module-kind="pos"
              data-nav-dir={navDirection}
            >
              <Outlet />
            </div>
          ) : (
            <div className="retail-dashboard-frame">
              <header className="retail-canvas-header">
                <div
                  key={sectionHeading}
                  className="retail-canvas-title-wrap retail-heading-reveal"
                >
                  <h1>{sectionHeading}</h1>
                  <div className="retail-pos-subline">
                    <span>
                      {config?.nomeFantasia ||
                        config?.razaoSocial ||
                        "PDV Lojista"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isStockist ? "Controle de Estoque" : "Administração"}
                    </span>
                  </div>
                </div>

                <div className="retail-header-actions">
                  {!isStockist && (
                    <Link
                      to="/inicio/operacoes"
                      className="retail-circle-icon-btn"
                      aria-label="Notificações e operações locais"
                      data-tooltip="Operações locais"
                    >
                      <Bell size={18} />
                      <span className="retail-bell-dot" aria-hidden="true" />
                    </Link>
                  )}

                  {!isStockist && (
                    <Link
                      to="/configuracoes/empresa"
                      className="retail-circle-icon-btn"
                      aria-label="Configurações da empresa"
                      data-tooltip="Configurações da empresa"
                    >
                      <Settings size={18} />
                    </Link>
                  )}

                  {!isStockist && (
                    <RetailTeamAvatars
                      onClick={() => navigate("/equipe")}
                      tooltip="Gerenciar equipe e acessos"
                    />
                  )}

                  {!isStockist && (
                    <Link
                      to="/"
                      className="retail-new-access-btn"
                      data-tooltip="Abrir Ponto de Venda (Criar Transação)"
                    >
                      <Monitor size={15} />
                      <span>Ponto de Venda</span>
                    </Link>
                  )}

                  <div className="retail-profile-dropdown-wrap">
                    <button
                      type="button"
                      className="retail-profile-trigger"
                      aria-label="Menu do usuário"
                      aria-expanded={profileMenuOpen}
                      onClick={() => setProfileMenuOpen((v) => !v)}
                    >
                      <RetailOperatorAvatar
                        name={shift.operator?.name || user?.name}
                      />
                      <ChevronsUpDown size={15} />
                    </button>

                    {profileMenuOpen && (
                      <div className="retail-floating-menu" role="menu">
                        <div className="retail-floating-menu-head">
                          <strong>{user?.name || "Administrador"}</strong>
                          <small>
                            {isStockist ? "Estoquista" : "Administrador"}
                          </small>
                        </div>
                        {!isStockist && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              navigate("/");
                            }}
                          >
                            <HandCoins size={15} />
                            Ir para Criar Transação (PDV)
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              setCashierOnlyMode(true);
                              navigate("/");
                            }}
                          >
                            <Monitor size={15} />
                            Modo Caixa (Sem Menu Lateral)
                          </button>
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

              {subNavTabs.length > 0 && (
                <nav
                  className="retail-subnav-bar"
                  aria-label="Seções do módulo"
                >
                  {subNavTabs.map((tab, tabIdx) => {
                    const isExactRoot =
                      tab.path === "/inicio" ||
                      tab.path === "/estoque" ||
                      tab.path === "/clientes" ||
                      tab.path === "/crediario" ||
                      tab.path === "/vitrine";
                    const isTabActive = isExactRoot
                      ? pathname === tab.path
                      : pathname.startsWith(tab.path);
                    return (
                      <NavLink
                        key={tab.path}
                        to={tab.path}
                        end={isExactRoot}
                        onClick={() => {
                          pendingNavIntentRef.current = "tab";
                        }}
                        style={
                          { "--tab-idx": tabIdx } as React.CSSProperties
                        }
                        className={`retail-cat-pill retail-subnav-pill ${isTabActive ? "is-active" : ""}`}
                      >
                        <span
                          className="retail-subnav-dot"
                          aria-hidden="true"
                        />
                        <span>{tab.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              )}

              <div
                key={pathname}
                className="retail-content retail-module-stage"
                data-module-kind={moduleKind}
                data-nav-dir={navDirection}
              >
                {moduleAllowed(location.pathname) ? (
                  <Outlet />
                ) : (
                  <p className="retail-message" role="alert">
                    Este módulo não está habilitado para esta loja.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>

        {showSidebar && (
          <>
            <nav
              className="retail-mobile-tabbar"
              aria-label="Navegação rápida mobile"
            >
              {isStockist ? (
                <>
                  <NavLink
                    to="/estoque"
                    end
                    className={({ isActive }) =>
                      `retail-mobile-tab ${isActive ? "is-active" : ""}`
                    }
                  >
                    <Package size={20} strokeWidth={2} />
                    <span>Catálogo</span>
                  </NavLink>
                  {moduleAllowed("/estoque/contagem") && (
                    <NavLink
                      to="/estoque/contagem"
                      className={({ isActive }) =>
                        `retail-mobile-tab ${isActive ? "is-active" : ""}`
                      }
                    >
                      <ClipboardList size={20} strokeWidth={2} />
                      <span>Balanço</span>
                    </NavLink>
                  )}
                  <NavLink
                    to="/estoque/entrada-manual"
                    className={({ isActive }) =>
                      `retail-mobile-tab ${isActive ? "is-active" : ""}`
                    }
                  >
                    <HandCoins size={20} strokeWidth={2} />
                    <span>Entrada</span>
                  </NavLink>
                  <button
                    type="button"
                    className={`retail-mobile-tab ${menuOpen ? "is-active" : ""}`}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    {menuOpen ? (
                      <X size={20} strokeWidth={2} />
                    ) : (
                      <Menu size={20} strokeWidth={2} />
                    )}
                    <span>Menu</span>
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    to="/"
                    end
                    className={`retail-mobile-tab ${pathname === "/" ? "is-active" : ""}`}
                  >
                    <HandCoins size={20} strokeWidth={2} />
                    <span>Balcão</span>
                  </NavLink>
                  <NavLink
                    to="/inicio"
                    end
                    className={`retail-mobile-tab ${
                      pathname.startsWith("/inicio")
                        ? "is-active"
                        : ""
                    }`}
                  >
                    <Home size={20} strokeWidth={2} />
                    <span>Resumo</span>
                  </NavLink>
                  <NavLink
                    to="/estoque"
                    className={`retail-mobile-tab ${
                      pathname.startsWith("/estoque")
                        ? "is-active"
                        : ""
                    }`}
                  >
                    <Package size={20} strokeWidth={2} />
                    <span>Estoque</span>
                  </NavLink>
                  <NavLink
                    to="/clientes"
                    className={`retail-mobile-tab ${
                      pathname.startsWith("/clientes")
                        ? "is-active"
                        : ""
                    }`}
                  >
                    <RotateCcw size={20} strokeWidth={2} />
                    <span>Clientes</span>
                  </NavLink>
                  <button
                    type="button"
                    className={`retail-mobile-tab ${
                      menuOpen ||
                      pathname.startsWith("/financeiro") ||
                      pathname.startsWith("/equipe") ||
                      pathname.startsWith("/crediario") ||
                      pathname.startsWith("/vitrine") ||
                      pathname.startsWith("/configuracoes")
                        ? "is-active"
                        : ""
                    }`}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    {menuOpen ? (
                      <X size={20} strokeWidth={2} />
                    ) : (
                      <Menu size={20} strokeWidth={2} />
                    )}
                    <span>Menu</span>
                  </button>
                </>
              )}
            </nav>

            {menuOpen && (
              <div
                className="retail-mobile-drawer-overlay"
                onClick={() => setMenuOpen(false)}
              >
                <div
                  className="retail-mobile-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu completo da loja"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="retail-sheet-handle" aria-hidden="true" />
                  <div className="retail-mobile-drawer-head">
                    <div className="retail-mobile-drawer-store">
                      <RetailOperatorAvatar
                        name={shift.operator?.name || user?.name}
                      />
                      <div>
                        <strong>
                          {config?.nomeFantasia ||
                            config?.razaoSocial ||
                            "PDV Lojista"}
                        </strong>
                        <small>
                          {shift.operator?.name || user?.name || "Operador"} ·{" "}
                          {isStockist ? "Estoquista" : "Administração"}
                        </small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="retail-icon-button"
                      aria-label="Fechar menu"
                      onClick={() => setMenuOpen(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="retail-mobile-drawer-grid">
                    {railGroups.flat().map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => {
                          if (!item.active && item.path !== pathname) {
                            pendingNavIntentRef.current = "module";
                          }
                          setMenuOpen(false);
                        }}
                        className={`retail-mobile-drawer-card ${
                          item.active ? "is-active" : ""
                        }`}
                      >
                        <span className="retail-mobile-drawer-icon">
                          <item.icon size={20} strokeWidth={1.9} />
                        </span>
                        <span>{item.name}</span>
                      </NavLink>
                    ))}
                  </div>

                  <div className="retail-mobile-drawer-foot">
                    {isAdmin && (
                      <button
                        type="button"
                        className="retail-button"
                        onClick={() => {
                          setMenuOpen(false);
                          setCashierOnlyMode(true);
                          navigate("/");
                        }}
                      >
                        <Monitor size={16} />
                        <span>Modo Somente Caixa</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="retail-button"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sair da loja</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RetailShellContext.Provider>
  );
}
