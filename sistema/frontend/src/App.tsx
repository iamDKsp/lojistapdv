import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { ShiftProvider } from "@/contexts/ShiftContext";
import { LEGACY_AND_ALIAS_REDIRECTS, ROUTES } from "@/lib/routes";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { OverduePaymentBanner } from "@/components/OverduePaymentBanner";
import { TermsAcceptanceModal } from "@/components/TermsAcceptanceModal";
import { RetailLoginPage } from "@/retail/RetailLoginPage";
import { RetailPosPage } from "@/retail/RetailPosPage";
import { RetailLayout } from "@/retail/RetailLayout";
import { RetailCatalogPage } from "@/retail/RetailCatalogPage";
import { RetailCustomersPage } from "@/retail/RetailCustomersPage";
import { RetailCrediarioPage } from "@/retail/RetailCrediarioPage";
import { RetailReturnsPage } from "@/retail/RetailReturnsPage";
import { RetailOperationsPage } from "@/retail/RetailOperationsPage";
import { RetailDashboardPage } from "@/retail/RetailDashboardPage";
import { RetailVitrinePage } from "@/retail/RetailVitrinePage";
import { RetailVitrineTvPage } from "@/retail/RetailVitrineTvPage";
import { RetailStorefrontPage } from "@/retail/RetailStorefrontPage";
import { RetailIntelligencePage } from "@/retail/RetailIntelligencePage";
import { PublicStorefrontApp } from "@/storefront/PublicStorefrontApp";
import {
  PdvLojistaLoader,
  SESSION_TRANSITION_EVENT,
  GlobalTooltipLayer,
} from "@/components/ui";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const RegistersPage = lazy(() =>
  import("@/pages/dashboard/RegistersPage").then((module) => ({
    default: module.RegistersPage,
  })),
);
const EmpresaPage = lazy(() =>
  import("@/pages/dashboard/EmpresaPage").then((module) => ({
    default: module.EmpresaPage,
  })),
);
const TributacaoPage = lazy(() =>
  import("@/pages/dashboard/TributacaoPage").then((module) => ({
    default: module.TributacaoPage,
  })),
);
const UsersPage = lazy(() => import("@/app/dashboard/users/page"));
const CategoriesPage = lazy(
  () => import("@/app/dashboard/inventory/categories/page"),
);
const StockEntryPage = lazy(
  () => import("@/app/dashboard/inventory/stock-entry/page"),
);
const StockCountPage = lazy(
  () => import("@/app/dashboard/inventory/stock-count/page"),
);
const XmlImportPage = lazy(
  () => import("@/app/dashboard/inventory/purchases/imports/page"),
);
const SuppliersPage = lazy(() => import("@/app/dashboard/suppliers/page"));
const PurchaseOrdersPage = lazy(
  () => import("@/app/dashboard/purchase-orders/page"),
);
const PayablesPage = lazy(
  () => import("@/app/dashboard/finance/payables/page"),
);
const PaymentMethodsPage = lazy(
  () => import("@/app/dashboard/configuracoes/payment-methods/page"),
);
const FiscalManagementPage = lazy(
  () => import("@/app/dashboard/fiscal/gestao/page"),
);
const GroupPortalPage = lazy(() => import("@/pages/GroupPortalPage"));
const SysInitPage = lazy(() => import("@/app/sys-init/page"));

function SysInitReturnPill() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [hasSysInitSession, setHasSysInitSession] = useState(false);

  useEffect(() => {
    try {
      const pin = sessionStorage.getItem("lojista-sysinit-pin");
      setHasSysInitSession(Boolean(pin));
    } catch {
      setHasSysInitSession(false);
    }
  }, [user?.id]);

  if (!hasSysInitSession) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 print:hidden">
      <button
        type="button"
        onClick={() => navigate("/sys-init")}
        title="Retornar ao Painel Central /sys-init"
        className="flex items-center gap-2 rounded-full border border-brand bg-support px-3.5 py-2 text-xs font-bold text-brand shadow-lg transition hover:bg-brand hover:text-on-brand"
      >
        <ShieldCheck size={15} />
        <span>Voltar ao /sys-init</span>
      </button>
    </div>
  );
}

function Protected() {
  const { token, user, logout } = useAuthStore();
  const isDemoSession = Boolean(
    user?.isDemo ||
      user?.email === "demo@lojista.local" ||
      user?.tenant === "tenant-demo-retail",
  );

  useEffect(() => {
    if (!token || !isDemoSession || typeof window === "undefined") return;

    try {
      const hasTabSession = sessionStorage.getItem("lojista-demo-tab-session") === "1";
      if (!hasTabSession) {
        logout();
        return;
      }
    } catch {
      // ignore storage errors
    }

    const handlePageHide = () => {
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({ reason: "pagehide" })], {
            type: "application/json",
          });
          navigator.sendBeacon("/api/auth/demo-reset", blob);
        } else {
          fetch("/api/auth/demo-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "pagehide" }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [token, isDemoSession, logout]);

  if (!token || user?.station) return <Navigate to="/login" replace />;
  return (
    <ShiftProvider>
      <NetworkStatusBanner />
      <OverduePaymentBanner />
      <Outlet />
      <SysInitReturnPill />
      <TermsAcceptanceModal />
    </ShiftProvider>
  );
}

function Management() {
  const role = useAuthStore((s) => s.user?.role);
  return ["admin", "superadmin", "group_owner", "stockist"].includes(role || "") ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}

function Pos() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "stockist" ? (
    <Navigate to={ROUTES.estoque.mercadorias} replace />
  ) : (
    <RetailPosPage />
  );
}

function PreserveSearchRedirect({ to }: { to: string }) {
  const location = useLocation();
  return (
    <Navigate
      to={{
        pathname: to,
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
}

export function App() {
  const isPublicExternalView =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/loja/") ||
      window.location.pathname.startsWith("/tv/"));

  const [transitionState, setTransitionState] = useState<{
    active: boolean;
    runId: number;
    label: string;
  }>({
    active: !isPublicExternalView,
    runId: 1,
    label: "Abrindo PDV Lojista…",
  });

  useEffect(() => {
    const handleTransition = (event: Event) => {
      const customEvent = event as CustomEvent<{ label?: string }>;
      const nextLabel =
        customEvent.detail?.label || "Preparando ambiente da loja…";
      setTransitionState((prev) => ({
        active: true,
        runId: prev.runId + 1,
        label: nextLabel,
      }));
    };
    window.addEventListener(SESSION_TRANSITION_EVENT, handleTransition);
    return () => {
      window.removeEventListener(SESSION_TRANSITION_EVENT, handleTransition);
    };
  }, []);

  return (
    <BrowserRouter>
      {transitionState.active && (
        <PdvLojistaLoader
          key={transitionState.runId}
          mode="transition"
          size={128}
          fullScreenOverlay
          once
          label={transitionState.label}
          onComplete={() => {
            const completedRunId = transitionState.runId;
            setTransitionState((prev) =>
              prev.runId === completedRunId ? { ...prev, active: false } : prev,
            );
          }}
        />
      )}
      <GlobalTooltipLayer />
      <Suspense
        fallback={
          <div className="retail-loader-region" style={{ minHeight: "100dvh" }}>
            <PdvLojistaLoader mode="loader" size={88} label="Carregando módulo…" />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<RetailLoginPage />} />
          <Route path="/sys-init" element={<SysInitPage />} />
          {/* Reprodutor público de TV / Vitrine Digital (acesso sem login em Smart TVs) */}
          <Route path="/tv/:tvPublicId" element={<RetailVitrineTvPage />} />
          <Route path="/vitrine/:tvPublicId" element={<RetailVitrineTvPage />} />

          {/* Loja Virtual Pública (acesso do consumidor final sem login no PDV) */}
          <Route path="/loja/:slug" element={<PublicStorefrontApp />} />
          <Route
            path="/loja/:slug/produto/:produtoSlug"
            element={<PublicStorefrontApp />}
          />
          <Route
            path="/loja/:slug/carrinho"
            element={<PublicStorefrontApp />}
          />
          <Route
            path="/loja/:slug/finalizar"
            element={<PublicStorefrontApp />}
          />
          <Route
            path="/loja/:slug/pedido/:referencia"
            element={<PublicStorefrontApp />}
          />
          <Route element={<Protected />}>
            <Route element={<RetailLayout />}>
              <Route path="/" element={<Pos />} />
              <Route element={<Management />}>
                {/* Módulo Rede Multi-Lojas */}
                <Route path="/grupo-portal/:tab" element={<GroupPortalPage />} />
                <Route
                  path="/grupo-portal/produtos/:subTab"
                  element={<GroupPortalPage />}
                />
                {/* Módulo Início */}
                <Route path="/inicio" element={<RetailDashboardPage />} />
                <Route
                  path="/inicio/historico-de-caixas"
                  element={<RegistersPage />}
                />
                <Route path="/inicio/relatorios" element={<DashboardPage />} />
                <Route
                  path="/inicio/operacoes"
                  element={<RetailOperationsPage />}
                />

                {/* Módulo Estoque */}
                <Route path="/estoque" element={<RetailCatalogPage />} />
                <Route path="/estoque/contagem" element={<StockCountPage />} />
                <Route
                  path="/estoque/categorias"
                  element={<CategoriesPage />}
                />
                <Route
                  path="/estoque/entrada-manual"
                  element={<StockEntryPage />}
                />
                <Route path="/estoque/entrada-xml" element={<XmlImportPage />} />
                <Route
                  path="/estoque/entrada-xml/:tab"
                  element={<XmlImportPage />}
                />

                {/* Módulo Financeiro e Compras */}
                <Route
                  path="/financeiro/contas-a-pagar"
                  element={<PayablesPage />}
                />
                <Route
                  path="/financeiro/contas-a-pagar/:tab"
                  element={<PayablesPage />}
                />
                <Route
                  path="/financeiro/pedidos-de-compra"
                  element={<PurchaseOrdersPage />}
                />
                <Route
                  path="/financeiro/fornecedores"
                  element={<SuppliersPage />}
                />

                {/* Módulo Equipe */}
                <Route path="/equipe" element={<UsersPage />} />

                {/* Módulo Inteligência Comercial */}
                <Route
                  path="/inteligencia-comercial"
                  element={<RetailIntelligencePage />}
                />
                <Route
                  path="/inteligencia-comercial/calendario"
                  element={<RetailIntelligencePage />}
                />
                <Route
                  path="/inteligencia-comercial/auditoria-e-metas"
                  element={<RetailIntelligencePage />}
                />

                {/* Módulo Clientes e Pós-Venda */}
                <Route path="/clientes" element={<RetailCustomersPage />} />
                <Route path="/clientes/trocas" element={<RetailReturnsPage />} />

                {/* Módulo Crediário e Cobrança */}
                <Route path="/crediario" element={<RetailCrediarioPage />} />
                <Route
                  path="/crediario/parcelas"
                  element={<RetailCrediarioPage />}
                />
                <Route
                  path="/crediario/whatsapp"
                  element={<RetailCrediarioPage />}
                />

                {/* Módulo Vitrine Digital e TV */}
                <Route path="/vitrine" element={<RetailVitrinePage />} />
                <Route
                  path="/vitrine/aparencia"
                  element={<RetailVitrinePage />}
                />

                {/* Módulo Loja Virtual */}
                <Route
                  path="/loja-virtual"
                  element={<RetailStorefrontPage />}
                />
                <Route
                  path="/loja-virtual/aparencia"
                  element={<RetailStorefrontPage />}
                />
                <Route
                  path="/loja-virtual/produtos"
                  element={<RetailStorefrontPage />}
                />
                <Route
                  path="/loja-virtual/categorias"
                  element={<RetailStorefrontPage />}
                />
                <Route
                  path="/loja-virtual/pedidos"
                  element={<RetailStorefrontPage />}
                />
                <Route
                  path="/loja-virtual/configuracoes"
                  element={<RetailStorefrontPage />}
                />

                {/* Módulo Configurações e Fiscal */}
                <Route
                  path="/configuracoes/empresa"
                  element={<EmpresaPage />}
                />
                <Route
                  path="/configuracoes/empresa/:tab"
                  element={<EmpresaPage />}
                />
                <Route
                  path="/configuracoes/pagamentos"
                  element={<PaymentMethodsPage />}
                />
                <Route
                  path="/configuracoes/tributacao"
                  element={<TributacaoPage />}
                />
                <Route
                  path="/configuracoes/nfce"
                  element={<FiscalManagementPage />}
                />
              </Route>
            </Route>
            {LEGACY_AND_ALIAS_REDIRECTS.map((item) => (
              <Route
                key={item.from}
                path={item.from}
                element={<PreserveSearchRedirect to={item.to} />}
              />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster
        theme="light"
        position="top-center"
        duration={3500}
        offset="max(16px, calc(env(safe-area-inset-top, 0px) + 10px))"
        mobileOffset={{
          top: "max(16px, calc(env(safe-area-inset-top, 0px) + 10px))",
          left: "14px",
          right: "14px",
        }}
        toastOptions={{
          style: {
            background: "var(--pdv-white)",
            color: "var(--pdv-text)",
            border: "1px solid var(--pdv-border)",
          },
        }}
      />
    </BrowserRouter>
  );
}
