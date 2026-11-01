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
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useShift } from "@/contexts/ShiftContext";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";

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

/**
 * Avatares estilizados da equipe dentro da paleta roxa, branca e neutra aprovada.
 */
export function RetailTeamAvatars({
  onClick,
  tooltip = "Equipe e operadores do turno",
}: {
  onClick?: () => void;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      className="retail-avatar-stack"
      onClick={onClick}
      aria-label={tooltip}
      data-tooltip={tooltip}
    >
      <span className="retail-avatar-item is-a1" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="18" fill="var(--pdv-support)" />
          <circle cx="18" cy="14" r="6" fill="var(--pdv-primary)" />
          <path
            d="M7 33c1.8-6.2 6.1-9.5 11-9.5s9.2 3.3 11 9.5"
            fill="var(--pdv-primary-hover)"
          />
        </svg>
      </span>
      <span className="retail-avatar-item is-a2" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="18" fill="var(--pdv-background)" />
          <circle cx="18" cy="14" r="6" fill="var(--pdv-text-secondary)" />
          <path
            d="M7 33c1.8-6.2 6.1-9.5 11-9.5s9.2 3.3 11 9.5"
            fill="var(--pdv-text)"
          />
        </svg>
      </span>
      <span className="retail-avatar-item is-a3" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="18" fill="var(--pdv-primary)" />
          <circle cx="18" cy="14" r="6" fill="var(--pdv-white)" />
          <path
            d="M7 33c1.8-6.2 6.1-9.5 11-9.5s9.2 3.3 11 9.5"
            fill="var(--pdv-support)"
          />
        </svg>
      </span>
    </button>
  );
}

export function RetailOperatorAvatar({ name }: { name?: string | null }) {
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
      <svg viewBox="0 0 38 38" fill="none">
        <rect width="38" height="38" rx="19" fill="var(--pdv-support)" />
        <circle cx="19" cy="13.5" r="5.5" fill="var(--pdv-primary)" />
        <path
          d="M8.5 34c1.8-5.8 5.8-8.8 10.5-8.8s8.7 3 10.5 8.8"
          fill="var(--pdv-primary-hover)"
        />
      </svg>
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
    if (path.includes("purchases/imports"))
      return modules.nfce !== false || modules.importacaoXml === true;
    if (path.includes("/fiscal/") || path.includes("/tributacao"))
      return modules.nfce !== false;
    if (path.includes("stock-count")) return modules.estoque !== false;
    return true;
  }

  if (isStockist && !location.pathname.startsWith("/dashboard/inventory")) {
    return <Navigate to="/dashboard/inventory" replace />;
  }

  const pathname = location.pathname;
  const isPosRoute = pathname === "/";

  const railGroups = isStockist
    ? [
        [
          {
            name: "Mercadorias e grades",
            path: "/dashboard/inventory",
            icon: Package,
            iconKind: "inventory",
            active:
              pathname === "/dashboard/inventory" ||
              pathname.startsWith("/dashboard/inventory/categories") ||
              pathname.startsWith("/dashboard/inventory/stock-entry") ||
              pathname.startsWith("/dashboard/inventory/purchases"),
          },
          ...(moduleAllowed("/dashboard/inventory/stock-count")
            ? [
                {
                  name: "Contagem de estoque",
                  path: "/dashboard/inventory/stock-count",
                  icon: ClipboardList,
                  iconKind: "inventory",
                  active: pathname.startsWith(
                    "/dashboard/inventory/stock-count",
                  ),
                },
              ]
            : []),
        ],
      ]
    : [
        [
          {
            name: "Visão geral",
            path: "/dashboard",
            icon: Home,
            iconKind: "home",
            active: pathname === "/dashboard",
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
            path: "/dashboard/inventory",
            icon: Package,
            iconKind: "inventory",
            active: pathname.startsWith("/dashboard/inventory"),
          },
          {
            name: "Contas a pagar",
            path: "/dashboard/finance/payables",
            icon: Banknote,
            iconKind: "finance",
            active:
              pathname.startsWith("/dashboard/finance") ||
              pathname.startsWith("/dashboard/suppliers") ||
              pathname.startsWith("/dashboard/purchase-orders"),
          },
        ],
        [
          {
            name: "Histórico de caixas",
            path: "/dashboard/registers",
            icon: History,
            iconKind: "registers",
            active:
              pathname.startsWith("/dashboard/registers") ||
              pathname.startsWith("/dashboard/operations") ||
              pathname.startsWith("/dashboard/reports"),
          },
          {
            name: "Equipe",
            path: "/dashboard/equipe",
            icon: UserPlus,
            iconKind: "team",
            active: pathname.startsWith("/dashboard/equipe"),
          },
          {
            name: "Trocas e créditos",
            path: "/dashboard/returns",
            icon: RotateCcw,
            iconKind: "returns",
            active: pathname.startsWith("/dashboard/returns"),
          },
        ],
        [
          {
            name: moduleAllowed("/dashboard/fiscal/gestao")
              ? "Gestão de NFC-e"
              : "Auditoria e segurança",
            path: moduleAllowed("/dashboard/fiscal/gestao")
              ? "/dashboard/fiscal/gestao"
              : "/dashboard/audit",
            icon: ShieldCheck,
            iconKind: "fiscal",
            active:
              pathname.startsWith("/dashboard/fiscal") ||
              pathname.includes("/tributacao") ||
              pathname.startsWith("/dashboard/audit"),
          },
          {
            name: "Empresa",
            path: "/dashboard/configuracoes/empresa",
            icon: HelpCircle,
            iconKind: "settings",
            active:
              pathname.startsWith("/dashboard/configuracoes") &&
              !pathname.includes("/tributacao"),
          },
        ],
      ];

  const subNavTabs = useMemo(() => {
    if (isPosRoute) return [];
    if (pathname.startsWith("/dashboard/inventory")) {
      return [
        { label: "Mercadorias e grades", path: "/dashboard/inventory" },
        ...(moduleAllowed("/dashboard/inventory/stock-count")
          ? [
              {
                label: "Contagem de estoque",
                path: "/dashboard/inventory/stock-count",
              },
            ]
          : []),
        { label: "Categorias", path: "/dashboard/inventory/categories" },
        { label: "Entrada manual", path: "/dashboard/inventory/stock-entry" },
        ...(moduleAllowed("/dashboard/inventory/purchases/imports")
          ? [
              {
                label: "Entrada por XML",
                path: "/dashboard/inventory/purchases/imports",
              },
            ]
          : []),
      ];
    }
    if (
      pathname.startsWith("/dashboard/finance") ||
      pathname.startsWith("/dashboard/suppliers") ||
      pathname.startsWith("/dashboard/purchase-orders")
    ) {
      return [
        { label: "Contas a pagar", path: "/dashboard/finance/payables" },
        { label: "Pedidos de compra", path: "/dashboard/purchase-orders" },
        { label: "Fornecedores", path: "/dashboard/suppliers" },
      ];
    }
    if (
      pathname.startsWith("/dashboard/registers") ||
      pathname.startsWith("/dashboard/operations") ||
      pathname.startsWith("/dashboard/reports") ||
      pathname === "/dashboard"
    ) {
      return [
        { label: "Visão geral", path: "/dashboard" },
        { label: "Histórico de caixas", path: "/dashboard/registers" },
        { label: "Relatórios de vendas", path: "/dashboard/reports" },
        { label: "Operações locais", path: "/dashboard/operations" },
      ];
    }
    if (
      pathname.startsWith("/dashboard/configuracoes") ||
      pathname.startsWith("/dashboard/fiscal")
    ) {
      return [
        { label: "Empresa", path: "/dashboard/configuracoes/empresa" },
        {
          label: "Pagamentos",
          path: "/dashboard/configuracoes/payment-methods",
        },
        ...(moduleAllowed("/dashboard/configuracoes/tributacao")
          ? [
              {
                label: "Tributação",
                path: "/dashboard/configuracoes/tributacao",
              },
              { label: "Gestão de NFC-e", path: "/dashboard/fiscal/gestao" },
            ]
          : []),
      ];
    }
    return [];
  }, [isPosRoute, pathname, modules.nfce, modules.importacaoXml, modules.estoque]);

  const sectionHeading = useMemo(() => {
    if (pathname.startsWith("/dashboard/inventory")) return "Catálogo e Estoque";
    if (
      pathname.startsWith("/dashboard/finance") ||
      pathname.startsWith("/dashboard/suppliers") ||
      pathname.startsWith("/dashboard/purchase-orders")
    )
      return "Compras e Financeiro";
    if (pathname.startsWith("/dashboard/registers"))
      return "Histórico de Caixas";
    if (pathname.startsWith("/dashboard/operations")) return "Operações Locais";
    if (pathname.startsWith("/dashboard/reports")) return "Relatórios da Loja";
    if (pathname.startsWith("/dashboard/equipe")) return "Equipe e Acessos";
    if (pathname.startsWith("/dashboard/returns")) return "Trocas e Créditos";
    if (pathname.startsWith("/dashboard/fiscal")) return "Gestão Fiscal";
    if (pathname.startsWith("/dashboard/configuracoes"))
      return "Configurações da Loja";
    return config?.nomeFantasia || config?.razaoSocial || "Painel da Loja";
  }, [pathname, config?.nomeFantasia, config?.razaoSocial]);

  const moduleKind = useMemo(() => {
    if (pathname === "/") return "pos";
    if (pathname.startsWith("/dashboard/inventory")) return "inventory";
    if (
      pathname.startsWith("/dashboard/finance") ||
      pathname.startsWith("/dashboard/suppliers") ||
      pathname.startsWith("/dashboard/purchase-orders")
    )
      return "finance";
    if (
      pathname.startsWith("/dashboard/registers") ||
      pathname.startsWith("/dashboard/operations")
    )
      return "registers";
    if (pathname.startsWith("/dashboard/equipe")) return "team";
    if (pathname.startsWith("/dashboard/returns")) return "returns";
    if (
      pathname.startsWith("/dashboard/fiscal") ||
      pathname.startsWith("/dashboard/configuracoes") ||
      pathname.startsWith("/dashboard/audit")
    )
      return "settings";
    return "overview";
  }, [pathname]);

  const activeTabIndex = useMemo(() => {
    return subNavTabs.findIndex((tab) =>
      tab.path === "/dashboard" || tab.path === "/dashboard/inventory"
        ? pathname === tab.path
        : pathname.startsWith(tab.path),
    );
  }, [subNavTabs, pathname]);

  const activeRailIndex = useMemo(() => {
    const flat = railGroups.flat();
    return flat.findIndex((item) => item.active);
  }, [railGroups]);

  const navHistoryRef = useRef({
    pathname,
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
      prev.moduleKind === moduleKind &&
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
      moduleKind,
      tabIndex: activeTabIndex,
      railIndex: activeRailIndex,
      direction,
    };
  }

  const navDirection = navHistoryRef.current.direction;

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
                to={isStockist ? "/dashboard/inventory" : "/"}
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
                      to="/dashboard/operations"
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
                      to="/dashboard/configuracoes/empresa"
                      className="retail-circle-icon-btn"
                      aria-label="Configurações da empresa"
                      data-tooltip="Configurações da empresa"
                    >
                      <Settings size={18} />
                    </Link>
                  )}

                  {!isStockist && (
                    <RetailTeamAvatars
                      onClick={() => navigate("/dashboard/equipe")}
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
                    const isTabActive =
                      tab.path === "/dashboard" ||
                      tab.path === "/dashboard/inventory"
                        ? pathname === tab.path
                        : pathname.startsWith(tab.path);
                    return (
                      <NavLink
                        key={tab.path}
                        to={tab.path}
                        end={
                          tab.path === "/dashboard" ||
                          tab.path === "/dashboard/inventory"
                        }
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
      </div>
    </RetailShellContext.Provider>
  );
}
