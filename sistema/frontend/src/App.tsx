import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { ShiftProvider } from "@/contexts/ShiftContext";
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
  return ["admin", "superadmin", "stockist"].includes(role || "") ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}

function Pos() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "stockist" ? (
    <Navigate to="/dashboard/inventory" replace />
  ) : (
    <RetailPosPage />
  );
}

export function App() {
  const [transitionState, setTransitionState] = useState<{
    active: boolean;
    runId: number;
    label: string;
  }>({
    active: true,
    runId: 1,
    label: "Abrindo PDV Lojista…",
  });

  useEffect(() => {
    const handleTransition = () => {
      setTransitionState((prev) => ({
        active: true,
        runId: prev.runId + 1,
        label: "Preparando ambiente da loja…",
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
          onComplete={() =>
            setTransitionState((prev) => ({ ...prev, active: false }))
          }
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
          <Route element={<Protected />}>
            <Route path="/grupo-portal" element={<GroupPortalPage />} />
            <Route element={<RetailLayout />}>
              <Route path="/" element={<Pos />} />
              <Route path="/dashboard" element={<Management />}>
                <Route index element={<RetailDashboardPage />} />
                <Route path="reports" element={<DashboardPage />} />
                <Route path="inventory" element={<RetailCatalogPage />} />
                <Route path="inventory/categories" element={<CategoriesPage />} />
                <Route
                  path="inventory/stock-entry"
                  element={<StockEntryPage />}
                />
                <Route
                  path="inventory/stock-count"
                  element={<StockCountPage />}
                />
                <Route
                  path="inventory/purchases/imports"
                  element={<XmlImportPage />}
                />
                <Route path="customers" element={<RetailCustomersPage />} />
                <Route path="crediario" element={<RetailCrediarioPage />} />
                <Route path="crediario/parcelas" element={<RetailCrediarioPage />} />
                <Route path="crediario/whatsapp" element={<RetailCrediarioPage />} />
                <Route path="returns" element={<RetailReturnsPage />} />
                <Route path="operations" element={<RetailOperationsPage />} />
                <Route path="registers" element={<RegistersPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="finance/payables" element={<PayablesPage />} />
                <Route path="configuracoes/empresa" element={<EmpresaPage />} />
                <Route
                  path="configuracoes/tributacao"
                  element={<TributacaoPage />}
                />
                <Route
                  path="configuracoes/payment-methods"
                  element={<PaymentMethodsPage />}
                />
                <Route path="fiscal/gestao" element={<FiscalManagementPage />} />
                <Route path="equipe" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster
        theme="light"
        position="top-center"
        duration={3500}
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
