import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Wallet,
  CalendarClock,
  MessageCircle,
  QrCode,
  Send,
  Plus,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  RefreshCw,
  FileText,
  Sparkles,
  Phone,
  PowerOff,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import { RetailSwitch } from "@/components/ui/Switch";
import { RetailSelect } from "@/components/ui/Select";
import { RetailDialog } from "./RetailDialog";
import { CustomerPicker } from "./CustomerPicker";
import { apiError, money } from "./types";

const TEMPLATE_VARIABLES = [
  "{cliente}",
  "{loja}",
  "{valor}",
  "{vencimento}",
  "{parcela}",
  "{saldo_devedor}",
  "{pix}",
  "{beneficiario_pix}",
];

function formatDateBr(dateInput?: string | null): string {
  if (!dateInput) return "—";
  const iso = String(dateInput).slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return String(dateInput);
  return `${d}/${m}/${y}`;
}

function defaultDueIso(days = 30): string {
  return new Date(Date.now() + Math.max(1, days) * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function RetailCrediarioPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection: "customers" | "receivables" | "whatsapp" =
    location.pathname.includes("/crediario/whatsapp")
      ? "whatsapp"
      : location.pathname.includes("/crediario/parcelas")
        ? "receivables"
        : "customers";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<any | null>(null);

  // Customers state
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<
    "ALL" | "WITH_DEBT" | "OVERDUE" | "BLOCKED"
  >("ALL");

  // Receivables state
  const [receivables, setReceivables] = useState<any[]>([]);
  const [receivableSearch, setReceivableSearch] = useState("");
  const [receivableFilter, setReceivableFilter] = useState<
    "OPEN_ALL" | "OVERDUE" | "DUE_TODAY" | "UPCOMING_7_DAYS" | "PAID"
  >("OPEN_ALL");

  // WhatsApp & Settings state
  const [settingsForm, setSettingsForm] = useState<any | null>(null);
  const [whatsappState, setWhatsappState] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");

  // Modals state
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<
    any | null
  >(null);
  const [editingCustomerCredit, setEditingCustomerCredit] = useState<
    any | null
  >(null);
  const [paymentModal, setPaymentModal] = useState<{
    customerId: string;
    customerName: string;
    receivableId?: string;
    receivableLabel?: string;
    suggestedAmount: number;
  } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentInCashRegister, setPaymentInCashRegister] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState("");

  // Manual receivable modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualInstallments, setManualInstallments] = useState("1");
  const [manualFirstDue, setManualFirstDue] = useState(() => defaultDueIso(30));
  const [manualSendWhatsapp, setManualSendWhatsapp] = useState(true);

  const loadOverview = useCallback(async () => {
    try {
      const res = await api.get("/crediario/overview");
      setOverview(res.data);
      setWhatsappState(res.data.whatsapp);
      setSettingsForm((prev: any) => prev || res.data.settings);
    } catch (err) {
      setError(apiError(err));
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await api.get("/crediario/customers", {
        params: {
          search: customerSearch || undefined,
          filter: customerFilter,
        },
      });
      setCustomers(res.data || []);
    } catch (err) {
      setError(apiError(err));
    }
  }, [customerSearch, customerFilter]);

  const loadReceivables = useCallback(async () => {
    try {
      const res = await api.get("/crediario/receivables", {
        params: {
          filter: receivableFilter,
          search: receivableSearch || undefined,
        },
      });
      setReceivables(res.data || []);
    } catch (err) {
      setError(apiError(err));
    }
  }, [receivableFilter, receivableSearch]);

  const loadWhatsappAndSettings = useCallback(async () => {
    try {
      const [setRes, logsRes] = await Promise.all([
        api.get("/crediario/settings"),
        api.get("/crediario/logs", { params: { limit: 60 } }),
      ]);
      setSettingsForm(setRes.data.settings);
      setWhatsappState(setRes.data.whatsapp);
      setLogs(logsRes.data || []);
    } catch (err) {
      setError(apiError(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const tasks: Promise<any>[] = [loadOverview()];
    if (activeSection === "customers") tasks.push(loadCustomers());
    if (activeSection === "receivables") tasks.push(loadReceivables());
    if (activeSection === "whatsapp") tasks.push(loadWhatsappAndSettings());

    Promise.all(tasks).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [
    activeSection,
    loadOverview,
    loadCustomers,
    loadReceivables,
    loadWhatsappAndSettings,
  ]);

  // Auto-polling do status do WhatsApp enquanto estiver aguardando leitura do QR Code ou reconectando
  useEffect(() => {
    if (
      activeSection !== "whatsapp" &&
      whatsappState?.status !== "CONNECTING" &&
      whatsappState?.status !== "QR_READY"
    ) {
      return;
    }
    if (
      whatsappState?.status !== "CONNECTING" &&
      whatsappState?.status !== "QR_READY"
    ) {
      return;
    }
    const timer = setInterval(() => {
      api
        .get("/crediario/whatsapp/status")
        .then((res) => {
          setWhatsappState(res.data);
          if (res.data?.status === "CONNECTED") {
            toast.success("WhatsApp da loja conectado com sucesso!");
            void loadOverview();
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [activeSection, whatsappState?.status, loadOverview]);

  async function openCustomerFicha(customerId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await api.get(`/crediario/customers/${customerId}`);
      setSelectedCustomerDetail(res.data);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCustomerCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomerCredit) return;
    setBusy(true);
    try {
      await api.put(`/crediario/customers/${editingCustomerCredit.id}/credit`, {
        name: editingCustomerCredit.name,
        phone: editingCustomerCredit.phone,
        cpfCnpj: editingCustomerCredit.cpfCnpj,
        creditLimit: Number(editingCustomerCredit.creditLimit || 0),
        preferredDueDay: editingCustomerCredit.preferredDueDay
          ? Number(editingCustomerCredit.preferredDueDay)
          : null,
        creditBlocked: Boolean(editingCustomerCredit.creditBlocked),
        whatsappOptIn: Boolean(editingCustomerCredit.whatsappOptIn),
        creditNotes: editingCustomerCredit.creditNotes || null,
      });
      toast.success("Configurações de crédito do cliente atualizadas!");
      setEditingCustomerCredit(null);
      await Promise.all([loadCustomers(), loadOverview()]);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentModal) return;
    const amt = Number(paymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Informe um valor válido para a baixa.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/crediario/payments", {
        customerId: paymentModal.customerId,
        receivableId: paymentModal.receivableId,
        amount: amt,
        paymentMethod,
        registerInCashRegister: paymentInCashRegister,
        notes: paymentNotes.trim() || undefined,
        requestKey: crypto.randomUUID(),
      });
      toast.success(
        `Baixa de ${money(res.data.totalPaid)} registrada com sucesso!`,
      );
      setPaymentModal(null);
      setPaymentAmount("");
      setPaymentNotes("");
      await Promise.all([
        loadOverview(),
        activeSection === "customers" ? loadCustomers() : loadReceivables(),
      ]);
      if (selectedCustomerDetail?.customer?.id === paymentModal.customerId) {
        const refreshed = await api.get(
          `/crediario/customers/${paymentModal.customerId}`,
        );
        setSelectedCustomerDetail(refreshed.data);
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateManualReceivable(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCustomerId || Number(manualAmount) <= 0) {
      toast.error("Selecione o cliente e informe um valor positivo.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/crediario/receivables/manual", {
        customerId: manualCustomerId,
        description: manualDescription.trim() || "Conta avulsa no crediário",
        amount: Number(manualAmount),
        installments: Number(manualInstallments || 1),
        firstDueDate: manualFirstDue,
        sendWhatsappNotification: manualSendWhatsapp,
      });
      toast.success("Conta / parcelas criadas com sucesso!");
      setManualModalOpen(false);
      setManualCustomerId("");
      setManualDescription("");
      setManualAmount("");
      setManualInstallments("1");
      await Promise.all([loadOverview(), loadCustomers(), loadReceivables()]);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendManualReminder(receivableId: string) {
    setBusy(true);
    try {
      const res = await api.post(`/crediario/receivables/${receivableId}/remind`);
      toast.success(`Cobrança enviada no WhatsApp (${res.data.phone})!`);
      await Promise.all([loadOverview(), loadReceivables()]);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRunBillingSweep() {
    setBusy(true);
    try {
      const res = await api.post("/crediario/run-billing");
      toast.success(
        `Régua executada: ${res.data.sent} enviada(s), ${res.data.skippedAlreadySent} já disparada(s) hoje, ${res.data.failed} falha(s).`,
      );
      await Promise.all([
        loadOverview(),
        activeSection === "whatsapp" ? loadWhatsappAndSettings() : loadReceivables(),
      ]);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectWhatsapp(resetSession = false) {
    setBusy(true);
    try {
      const res = await api.post("/crediario/whatsapp/connect", {
        resetSession,
      });
      setWhatsappState(res.data);
      if (res.data.status === "CONNECTED") {
        toast.success("WhatsApp conectado!");
      } else {
        toast.info(
          "Aguarde o QR Code e escaneie pelo WhatsApp da loja (Aparelhos Conectados).",
        );
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnectWhatsapp() {
    setBusy(true);
    try {
      const res = await api.post("/crediario/whatsapp/disconnect");
      setWhatsappState(res.data);
      toast.success("Sessão do WhatsApp desconectada.");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTestWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast.error("Informe o número de WhatsApp para teste.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/crediario/whatsapp/test", {
        phone: testPhone.trim(),
        message: testMessage.trim() || undefined,
      });
      toast.success("Mensagem de teste enviada pelo Baileys!");
      setTestMessage("");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsForm) return;
    setBusy(true);
    try {
      const res = await api.put("/crediario/settings", settingsForm);
      setSettingsForm(res.data);
      toast.success("Configurações do Crediário e Régua salvas com sucesso!");
      await loadOverview();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  const totals = overview?.totals || {
    totalOpen: 0,
    totalOverdue: 0,
    dueToday: 0,
    receivedThisMonth: 0,
    customersWithDebtCount: 0,
    overdueCustomersCount: 0,
  };

  return (
    <div className="retail-stack">
      <div className="retail-page-header">
        <div>
          <h1>Crediário (Fiado) e Cobrança Automática</h1>
          <p>
            Gerencie limites de clientes, parcelas de vendas a prazo e a régua
            automática de cobrança via WhatsApp (Baileys).
          </p>
        </div>
        <div className="retail-row">
          <button
            type="button"
            className="retail-button"
            disabled={busy}
            onClick={() => setManualModalOpen(true)}
          >
            <Plus size={17} />
            Nova conta avulsa
          </button>
          <button
            type="button"
            className="retail-button retail-button-primary"
            disabled={busy}
            onClick={() => navigate("/dashboard/crediario/whatsapp")}
          >
            <MessageCircle size={17} />
            {whatsappState?.status === "CONNECTED"
              ? `WhatsApp Conectado (${whatsappState.connectedPhone || "Ativo"})`
              : "Conectar WhatsApp (Baileys)"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="retail-message">
          {error}
        </p>
      )}

      {/* Indicadores Gerais do Crediário */}
      <div className="retail-kpis">
        <div className="retail-kpi">
          <span>Total a receber (em aberto)</span>
          <strong>{money(totals.totalOpen)}</strong>
          <small className="retail-muted">
            {totals.customersWithDebtCount} cliente(s) com saldo ativo
          </small>
        </div>
        <div className="retail-kpi">
          <span>Parcelas vencidas (em atraso)</span>
          <strong>{money(totals.totalOverdue)}</strong>
          <small className="retail-muted">
            {totals.overdueCustomersCount} cliente(s) em atraso · Vence hoje:{" "}
            {money(totals.dueToday)}
          </small>
        </div>
        <div className="retail-kpi">
          <span>Recebido neste mês</span>
          <strong>{money(totals.receivedThisMonth)}</strong>
          <small className="retail-muted">
            Baixas e amortizações confirmadas
          </small>
        </div>
        <div className="retail-kpi">
          <span>Motor WhatsApp (Baileys)</span>
          <strong>
            {whatsappState?.status === "CONNECTED"
              ? "Conectado"
              : whatsappState?.status === "QR_READY"
                ? "Aguardando QR Code"
                : whatsappState?.status === "CONNECTING"
                  ? "Conectando…"
                  : "Desconectado"}
          </strong>
          <small className="retail-muted">
            {overview?.settings?.whatsappAutoBilling
              ? `Régua ativa · Disparo às ${overview?.settings?.dispatchHour || "09:00"}`
              : "Régua automática pausada"}
          </small>
        </div>
      </div>

      {loading ? (
        <div className="retail-panel" style={{ padding: 48, textAlign: "center" }}>
          <PdvLojistaLoader
            mode="loader"
            size={48}
            label="Carregando módulo de crediário..."
          />
        </div>
      ) : (
        <>
          {/* ============================================================
              SEÇÃO 1: CONTAS DE CLIENTES (/dashboard/crediario)
             ============================================================ */}
          {activeSection === "customers" && (
            <div className="retail-panel retail-stack">
              <div className="retail-row retail-spread">
                <div className="retail-row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {[
                    { id: "ALL", label: "Todos os Clientes" },
                    { id: "WITH_DEBT", label: "Com Saldo Devedor" },
                    { id: "OVERDUE", label: "Em Atraso" },
                    { id: "BLOCKED", label: "Bloqueados" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`retail-button ${customerFilter === f.id ? "retail-button-primary" : ""}`}
                      onClick={() => setCustomerFilter(f.id as any)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <label className="retail-search" style={{ minWidth: 260 }}>
                  <Search size={17} />
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Buscar cliente por nome, telefone ou CPF..."
                  />
                </label>
              </div>

              {customers.length > 0 ? (
                <div className="retail-table-wrap">
                  <table className="retail-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Limite de Crédito</th>
                        <th>Saldo Devedor</th>
                        <th>Disponível</th>
                        <th>Próximo Vencimento</th>
                        <th>Situação</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                            <br />
                            <small className="retail-muted">
                              <Phone
                                size={12}
                                style={{ display: "inline", marginRight: 4 }}
                              />
                              {c.phone}
                              {c.cpfCnpj ? ` · ${c.cpfCnpj}` : ""}
                            </small>
                          </td>
                          <td className="retail-number">
                            {money(c.effectiveCreditLimit)}
                            {c.customCreditLimit <= 0 && (
                              <>
                                <br />
                                <small className="retail-muted">Padrão da loja</small>
                              </>
                            )}
                          </td>
                          <td className="retail-number">
                            <strong>{money(c.usedCredit)}</strong>
                            {c.overdueAmount > 0 && (
                              <>
                                <br />
                                <small className="retail-muted">
                                  Vencido: {money(c.overdueAmount)}
                                </small>
                              </>
                            )}
                          </td>
                          <td className="retail-number">
                            {money(c.availableCredit)}
                          </td>
                          <td>
                            {c.nextDueDate ? formatDateBr(c.nextDueDate) : "—"}
                          </td>
                          <td>
                            <span className="retail-badge">
                              {c.creditBlocked ? (
                                <>
                                  <Lock size={13} /> Bloqueado
                                </>
                              ) : c.overdueCount > 0 ? (
                                <>
                                  <AlertCircle size={13} /> {c.overdueCount} em
                                  atraso
                                </>
                              ) : c.usedCredit > 0 ? (
                                <>
                                  <CalendarClock size={13} /> Em aberto
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={13} /> Em dia
                                </>
                              )}
                            </span>
                          </td>
                          <td>
                            <div className="retail-row" style={{ gap: 6 }}>
                              <button
                                type="button"
                                className="retail-button"
                                onClick={() => void openCustomerFicha(c.id)}
                              >
                                <FileText size={15} />
                                Extrato
                              </button>
                              {c.usedCredit > 0 && (
                                <button
                                  type="button"
                                  className="retail-button retail-button-primary"
                                  onClick={() => {
                                    setPaymentModal({
                                      customerId: c.id,
                                      customerName: c.name,
                                      suggestedAmount: c.usedCredit,
                                    });
                                    setPaymentAmount(String(c.usedCredit));
                                  }}
                                >
                                  <Wallet size={15} />
                                  Receber
                                </button>
                              )}
                              <button
                                type="button"
                                className="retail-button"
                                onClick={() =>
                                  setEditingCustomerCredit({
                                    ...c,
                                    creditLimit:
                                      c.customCreditLimit > 0
                                        ? c.customCreditLimit
                                        : c.effectiveCreditLimit,
                                  })
                                }
                              >
                                {c.creditBlocked ? (
                                  <Unlock size={15} />
                                ) : (
                                  <Lock size={15} />
                                )}
                                Limite
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="retail-empty">
                  <Wallet size={32} />
                  <p>Nenhum cliente encontrado para este filtro.</p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              SEÇÃO 2: PARCELAS E VENCIMENTOS (/dashboard/crediario/parcelas)
             ============================================================ */}
          {activeSection === "receivables" && (
            <div className="retail-panel retail-stack">
              <div className="retail-row retail-spread">
                <div className="retail-row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {[
                    { id: "OPEN_ALL", label: "Em Aberto" },
                    { id: "OVERDUE", label: "Vencidas (Em Atraso)" },
                    { id: "DUE_TODAY", label: "Vencem Hoje" },
                    { id: "UPCOMING_7_DAYS", label: "Próximos 7 Dias" },
                    { id: "PAID", label: "Quitadas" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`retail-button ${receivableFilter === f.id ? "retail-button-primary" : ""}`}
                      onClick={() => setReceivableFilter(f.id as any)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="retail-row" style={{ gap: 8 }}>
                  <label className="retail-search" style={{ minWidth: 230 }}>
                    <Search size={17} />
                    <input
                      value={receivableSearch}
                      onChange={(e) => setReceivableSearch(e.target.value)}
                      placeholder="Filtrar por cliente ou venda..."
                    />
                  </label>
                  <button
                    type="button"
                    className="retail-button"
                    disabled={busy}
                    onClick={() => void handleRunBillingSweep()}
                  >
                    <Send size={16} />
                    Disparar Régua Agora
                  </button>
                </div>
              </div>

              {receivables.length > 0 ? (
                <div className="retail-table-wrap">
                  <table className="retail-table">
                    <thead>
                      <tr>
                        <th>Vencimento</th>
                        <th>Cliente</th>
                        <th>Descrição / Venda</th>
                        <th>Parcela</th>
                        <th>Valor Original</th>
                        <th>Em Aberto</th>
                        <th>Status / Cobranças</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivables.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{formatDateBr(r.dueDate)}</strong>
                            <br />
                            <small className="retail-muted">
                              {r.status === "PAID"
                                ? `Pago em ${formatDateBr(r.paidAt)}`
                                : r.daysDiff < 0
                                  ? `${Math.abs(r.daysDiff)} dia(s) em atraso`
                                  : r.daysDiff === 0
                                    ? "Vence hoje"
                                    : `Em ${r.daysDiff} dia(s)`}
                            </small>
                          </td>
                          <td>
                            <strong>{r.customer?.name}</strong>
                            <br />
                            <small className="retail-muted">
                              {r.customer?.phone}
                            </small>
                          </td>
                          <td>{r.description}</td>
                          <td>
                            {r.installmentNumber}/{r.totalInstallments}
                          </td>
                          <td className="retail-number">
                            {money(r.originalAmount)}
                          </td>
                          <td className="retail-number">
                            <strong>{money(r.remainingAmount)}</strong>
                          </td>
                          <td>
                            <span className="retail-badge">
                              {r.status === "PAID"
                                ? "Quitada"
                                : r.isOverdue
                                  ? "Vencida"
                                  : r.isDueToday
                                    ? "Vence hoje"
                                    : r.status === "PARTIAL"
                                      ? "Parcial"
                                      : "A vencer"}
                            </span>
                            {r.reminderCount > 0 && (
                              <>
                                <br />
                                <small className="retail-muted">
                                  {r.reminderCount} lembrete(s) enviado(s)
                                </small>
                              </>
                            )}
                          </td>
                          <td>
                            {(r.status === "OPEN" || r.status === "PARTIAL") && (
                              <div className="retail-row" style={{ gap: 6 }}>
                                <button
                                  type="button"
                                  className="retail-button retail-button-primary"
                                  disabled={busy}
                                  onClick={() => {
                                    setPaymentModal({
                                      customerId: r.customerId,
                                      customerName: r.customer?.name || "Cliente",
                                      receivableId: r.id,
                                      receivableLabel: `${r.description} (${r.installmentNumber}/${r.totalInstallments})`,
                                      suggestedAmount: Number(r.remainingAmount),
                                    });
                                    setPaymentAmount(String(r.remainingAmount));
                                  }}
                                >
                                  <Wallet size={15} />
                                  Baixar
                                </button>
                                <button
                                  type="button"
                                  className="retail-button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleSendManualReminder(r.id)
                                  }
                                >
                                  <MessageCircle size={15} />
                                  Cobrar WhatsApp
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="retail-empty">
                  <CalendarClock size={32} />
                  <p>Nenhuma parcela encontrada para este filtro.</p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              SEÇÃO 3: WHATSAPP (BAILEYS) & RÉGUA AUTOMÁTICA
             ============================================================ */}
          {activeSection === "whatsapp" && settingsForm && (
            <div className="retail-stack">
              {/* Painel de Conexão do WhatsApp via Baileys */}
              <div className="retail-panel retail-stack">
                <div className="retail-row retail-spread">
                  <div>
                    <h2>Conexão do WhatsApp da Loja (Baileys)</h2>
                    <p className="retail-muted">
                      Conecte o WhatsApp da própria loja escaneando o QR Code. A
                      sessão fica salva no banco de dados com isolamento total
                      por tenant.
                    </p>
                  </div>
                  <span className="retail-badge">
                    {whatsappState?.status === "CONNECTED" ? (
                      <>
                        <CheckCircle2 size={14} /> Conectado:{" "}
                        {whatsappState.connectedPhone || "Ativo"}
                      </>
                    ) : whatsappState?.status === "QR_READY" ? (
                      <>
                        <QrCode size={14} /> Aguardando leitura do QR Code
                      </>
                    ) : whatsappState?.status === "CONNECTING" ? (
                      <>
                        <RefreshCw size={14} /> Inicializando sessão…
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} /> Desconectado
                      </>
                    )}
                  </span>
                </div>

                {whatsappState?.lastError && (
                  <p className="retail-message" role="alert">
                    {whatsappState.lastError}
                  </p>
                )}

                <div className="retail-form-grid">
                  <div
                    className="retail-stack"
                    style={{
                      padding: 20,
                      borderRadius: 18,
                      border: "1px solid var(--pdv-border)",
                      background: "var(--pdv-background)",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                    }}
                  >
                    {whatsappState?.status === "CONNECTED" ? (
                      <>
                        <CheckCircle2 size={44} />
                        <h3>WhatsApp Pareado e Pronto</h3>
                        <p className="retail-muted">
                          Número conectado:{" "}
                          <strong>
                            {whatsappState.connectedPhone || "Identificado"}
                          </strong>{" "}
                          ({whatsappState.connectedName || "Loja"})
                        </p>
                        <div className="retail-row" style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="retail-button"
                            disabled={busy}
                            onClick={() => void handleDisconnectWhatsapp()}
                          >
                            <PowerOff size={16} />
                            Desconectar aparelho
                          </button>
                        </div>
                      </>
                    ) : whatsappState?.qrDataUrl ? (
                      <>
                        <img
                          src={whatsappState.qrDataUrl}
                          alt="QR Code de conexão do WhatsApp Baileys"
                          style={{
                            width: 240,
                            height: 240,
                            borderRadius: 16,
                            border: "2px solid var(--pdv-primary)",
                            background: "var(--pdv-white)",
                            padding: 8,
                          }}
                        />
                        <p className="retail-muted">
                          Abra o WhatsApp no celular da loja →{" "}
                          <strong>Aparelhos conectados</strong> →{" "}
                          <strong>Conectar um aparelho</strong> e aponte a
                          câmera.
                        </p>
                        <button
                          type="button"
                          className="retail-button"
                          disabled={busy}
                          onClick={() => void handleConnectWhatsapp(true)}
                        >
                          <RefreshCw size={16} />
                          Gerar novo QR Code
                        </button>
                      </>
                    ) : (
                      <>
                        <QrCode size={44} />
                        <h3>Nenhum aparelho conectado</h3>
                        <p className="retail-muted">
                          Gere um QR Code para parear o WhatsApp da loja e
                          ativar o envio automático de comprovantes e cobranças.
                        </p>
                        <button
                          type="button"
                          className="retail-button retail-button-primary"
                          disabled={busy}
                          onClick={() => void handleConnectWhatsapp(false)}
                        >
                          <QrCode size={17} />
                          {busy ? "Gerando QR Code…" : "Gerar QR Code do WhatsApp"}
                        </button>
                      </>
                    )}
                  </div>

                  <form
                    className="retail-stack"
                    onSubmit={handleSendTestWhatsapp}
                    style={{
                      padding: 20,
                      borderRadius: 18,
                      border: "1px solid var(--pdv-border)",
                      background: "var(--pdv-background)",
                    }}
                  >
                    <h3>Disparo de Teste Rápido</h3>
                    <p className="retail-muted">
                      Envie uma mensagem imediata para conferir a entrega pelo
                      Baileys.
                    </p>
                    <label className="retail-field">
                      Telefone com DDD
                      <input
                        type="tel"
                        placeholder="Ex: 14999998888"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                      />
                    </label>
                    <label className="retail-field">
                      Mensagem opcional
                      <textarea
                        rows={2}
                        placeholder="Deixe em branco para usar a mensagem padrão de validação..."
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                      />
                    </label>
                    <div className="retail-row" style={{ gap: 8 }}>
                      <button
                        type="submit"
                        className="retail-button retail-button-primary"
                        disabled={
                          busy || whatsappState?.status !== "CONNECTED"
                        }
                      >
                        <Send size={16} />
                        Enviar teste no WhatsApp
                      </button>
                      <button
                        type="button"
                        className="retail-button"
                        disabled={
                          busy || whatsappState?.status !== "CONNECTED"
                        }
                        onClick={() => void handleRunBillingSweep()}
                      >
                        <Sparkles size={16} />
                        Processar régua de hoje
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Formulário de Configuração da Régua e Limites */}
              <form
                className="retail-panel retail-stack"
                onSubmit={handleSaveSettings}
              >
                <div className="retail-row retail-spread">
                  <div>
                    <h2>Regras do Crediário, PIX e Templates Automáticos</h2>
                    <p className="retail-muted">
                      Personalize os limites, chave PIX e os textos que seus
                      clientes recebem em cada etapa do crediário.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="retail-button retail-button-primary"
                    disabled={busy}
                  >
                    <Save size={17} />
                    {busy ? "Salvando…" : "Salvar Configurações"}
                  </button>
                </div>

                <div className="retail-form-grid">
                  <label className="retail-field">
                    Limite de crédito padrão por cliente (R$)
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={settingsForm.defaultCreditLimit}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          defaultCreditLimit: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="retail-field">
                    Prazo padrão do 1º vencimento (dias)
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={settingsForm.defaultDueDays}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          defaultDueDays: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="retail-field">
                    Máximo de parcelas no PDV
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={settingsForm.maxInstallments}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          maxInstallments: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="retail-field">
                    Horário diário da régua automática
                    <input
                      type="time"
                      value={settingsForm.dispatchHour || "09:00"}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          dispatchHour: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="retail-field">
                    Chave PIX da loja (para sair na cobrança)
                    <input
                      type="text"
                      placeholder="CNPJ, CPF, E-mail, Telefone ou Chave Aleatória"
                      value={settingsForm.pixKey || ""}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          pixKey: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="retail-field">
                    Nome do favorecido PIX
                    <input
                      type="text"
                      placeholder="Ex: Loja Roxo & Branco LTDA"
                      value={settingsForm.pixBeneficiary || ""}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          pixBeneficiary: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="retail-form-grid">
                  <RetailSwitch
                    checked={Boolean(settingsForm.enabled)}
                    onCheckedChange={(v) =>
                      setSettingsForm({ ...settingsForm, enabled: v })
                    }
                    label="Permitir novas vendas no Fiado / Crediário no PDV"
                  />
                  <RetailSwitch
                    checked={Boolean(settingsForm.blockOverdueCustomer)}
                    onCheckedChange={(v) =>
                      setSettingsForm({
                        ...settingsForm,
                        blockOverdueCustomer: v,
                      })
                    }
                    label="Bloquear novas compras fiado se o cliente tiver parcela vencida"
                  />
                  <RetailSwitch
                    checked={Boolean(settingsForm.allowPartialPayment)}
                    onCheckedChange={(v) =>
                      setSettingsForm({
                        ...settingsForm,
                        allowPartialPayment: v,
                      })
                    }
                    label="Permitir baixa parcial / amortização de parcelas"
                  />
                  <RetailSwitch
                    checked={Boolean(settingsForm.whatsappAutoBilling)}
                    onCheckedChange={(v) =>
                      setSettingsForm({
                        ...settingsForm,
                        whatsappAutoBilling: v,
                      })
                    }
                    label="Ativar disparos automáticos de cobrança pelo WhatsApp (Baileys)"
                  />
                </div>

                <div
                  className="retail-stack"
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    background: "var(--pdv-support)",
                    border: "1px solid var(--pdv-border)",
                  }}
                >
                  <small>
                    <strong>Variáveis disponíveis nos templates:</strong>{" "}
                    {TEMPLATE_VARIABLES.map((v) => (
                      <code
                        key={v}
                        style={{
                          marginRight: 8,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: "var(--pdv-white)",
                        }}
                      >
                        {v}
                      </code>
                    ))}
                  </small>
                </div>

                <div className="retail-stack">
                  <RetailSwitch
                    checked={Boolean(settingsForm.sendOnSale)}
                    onCheckedChange={(v) =>
                      setSettingsForm({ ...settingsForm, sendOnSale: v })
                    }
                    label="1. Enviar comprovante automático no WhatsApp assim que a venda fiado é concluída no PDV"
                  />
                  {settingsForm.sendOnSale && (
                    <label className="retail-field">
                      Mensagem de confirmação de compra no crediário
                      <textarea
                        rows={2}
                        value={settingsForm.templateOnSale || ""}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            templateOnSale: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <div className="retail-row" style={{ gap: 16, flexWrap: "wrap" }}>
                    <RetailSwitch
                      checked={Boolean(settingsForm.sendBeforeDue)}
                      onCheckedChange={(v) =>
                        setSettingsForm({ ...settingsForm, sendBeforeDue: v })
                      }
                      label="2. Enviar lembrete preventivo antes do vencimento"
                    />
                    {settingsForm.sendBeforeDue && (
                      <label className="retail-field" style={{ maxWidth: 200 }}>
                        Dias antes do vencimento
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={settingsForm.daysBeforeDue}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              daysBeforeDue: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                  {settingsForm.sendBeforeDue && (
                    <label className="retail-field">
                      Mensagem preventiva antes do vencimento
                      <textarea
                        rows={2}
                        value={settingsForm.templateBeforeDue || ""}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            templateBeforeDue: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <RetailSwitch
                    checked={Boolean(settingsForm.sendOnDueDate)}
                    onCheckedChange={(v) =>
                      setSettingsForm({ ...settingsForm, sendOnDueDate: v })
                    }
                    label="3. Enviar aviso no dia do vencimento da parcela"
                  />
                  {settingsForm.sendOnDueDate && (
                    <label className="retail-field">
                      Mensagem no dia do vencimento
                      <textarea
                        rows={2}
                        value={settingsForm.templateOnDueDate || ""}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            templateOnDueDate: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <div className="retail-row" style={{ gap: 16, flexWrap: "wrap" }}>
                    <RetailSwitch
                      checked={Boolean(settingsForm.sendOverdue)}
                      onCheckedChange={(v) =>
                        setSettingsForm({ ...settingsForm, sendOverdue: v })
                      }
                      label="4. Enviar cobrança automática de parcelas em atraso"
                    />
                    {settingsForm.sendOverdue && (
                      <>
                        <label className="retail-field" style={{ maxWidth: 190 }}>
                          Repetir a cada (dias)
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={settingsForm.overdueIntervalDays}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                overdueIntervalDays: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="retail-field" style={{ maxWidth: 190 }}>
                          Máx. lembretes por parcela
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={settingsForm.maxOverdueReminders}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                maxOverdueReminders: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                  {settingsForm.sendOverdue && (
                    <label className="retail-field">
                      Mensagem de cobrança de atraso (com chave PIX)
                      <textarea
                        rows={3}
                        value={settingsForm.templateOverdue || ""}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            templateOverdue: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}

                  <RetailSwitch
                    checked={Boolean(settingsForm.sendOnPayment)}
                    onCheckedChange={(v) =>
                      setSettingsForm({ ...settingsForm, sendOnPayment: v })
                    }
                    label="5. Enviar recibo automático no WhatsApp ao dar baixa / pagamento"
                  />
                  {settingsForm.sendOnPayment && (
                    <label className="retail-field">
                      Mensagem de recibo de pagamento / abatimento
                      <textarea
                        rows={2}
                        value={settingsForm.templateOnPayment || ""}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            templateOnPayment: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              </form>

              {/* Histórico de Envios */}
              <div className="retail-panel retail-stack">
                <div className="retail-row retail-spread">
                  <h3>Histórico Recente de Disparos (Baileys)</h3>
                  <span className="retail-muted">Últimos {logs.length} registros</span>
                </div>
                {logs.length > 0 ? (
                  <div className="retail-table-wrap">
                    <table className="retail-table">
                      <thead>
                        <tr>
                          <th>Data / Hora</th>
                          <th>Cliente</th>
                          <th>Gatilho</th>
                          <th>Status</th>
                          <th>Mensagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id}>
                            <td>
                              {new Date(log.createdAt).toLocaleString("pt-BR")}
                            </td>
                            <td>
                              <strong>{log.customer?.name || "Cliente"}</strong>
                              <br />
                              <small className="retail-muted">{log.phone}</small>
                            </td>
                            <td>
                              <span className="retail-badge">
                                {log.triggerType === "ON_SALE"
                                  ? "Compra Fiado"
                                  : log.triggerType === "BEFORE_DUE"
                                    ? "Preventivo"
                                    : log.triggerType === "ON_DUE_DATE"
                                      ? "Dia do Vencimento"
                                      : log.triggerType === "OVERDUE"
                                        ? "Cobrança Atraso"
                                        : log.triggerType === "ON_PAYMENT"
                                          ? "Recibo Baixa"
                                          : "Cobrança Manual"}
                              </span>
                            </td>
                            <td>
                              <span className="retail-badge">
                                {log.status === "SENT"
                                  ? "Enviado"
                                  : log.status === "FAILED"
                                    ? "Falhou"
                                    : "Pendente"}
                              </span>
                              {log.error && (
                                <>
                                  <br />
                                  <small className="retail-muted">
                                    {log.error}
                                  </small>
                                </>
                              )}
                            </td>
                            <td style={{ maxWidth: 380 }}>
                              <small>{log.message}</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="retail-empty">
                    <MessageCircle size={32} />
                    <p>Nenhuma mensagem disparada ainda.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================
          MODAL: RECEBER / DAR BAIXA (AMORTIZAÇÃO OU PARCELA)
         ============================================================ */}
      {paymentModal && (
        <RetailDialog
          title={`Receber Crediário — ${paymentModal.customerName}`}
          onClose={() => !busy && setPaymentModal(null)}
          busy={busy}
        >
          <form
            className="retail-dialog-body retail-stack"
            onSubmit={handleSubmitPayment}
          >
            <p className="retail-muted">
              {paymentModal.receivableLabel
                ? `Baixa referente a: ${paymentModal.receivableLabel}`
                : "O valor recebido abaterá automaticamente das parcelas mais antigas para as mais recentes (FIFO)."}
            </p>
            <label className="retail-field">
              Valor recebido (R$)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </label>
            <label className="retail-field">
              Meio de pagamento utilizado pelo cliente
              <RetailSelect
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                options={[
                  { value: "pix", label: "PIX" },
                  { value: "dinheiro", label: "Dinheiro" },
                  { value: "debito", label: "Cartão de Débito" },
                  { value: "credito", label: "Cartão de Crédito" },
                ]}
              />
            </label>
            <RetailSwitch
              checked={paymentInCashRegister}
              onCheckedChange={setPaymentInCashRegister}
              label="Lançar entrada (suprimento) no caixa aberto da loja"
            />
            <label className="retail-field">
              Observação (opcional)
              <input
                type="text"
                placeholder="Ex: Comprovante PIX conferido"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </label>
            <div className="retail-dialog-footer">
              <button
                type="button"
                className="retail-button"
                disabled={busy}
                onClick={() => setPaymentModal(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="retail-button retail-button-primary"
                disabled={busy}
              >
                {busy ? "Confirmando…" : "Confirmar Baixa e Enviar Recibo"}
              </button>
            </div>
          </form>
        </RetailDialog>
      )}

      {/* ============================================================
          MODAL: CONFIGURAR LIMITE E BLOQUEIO DO CLIENTE
         ============================================================ */}
      {editingCustomerCredit && (
        <RetailDialog
          title={`Limite e Conta — ${editingCustomerCredit.name}`}
          onClose={() => !busy && setEditingCustomerCredit(null)}
          busy={busy}
        >
          <form
            className="retail-dialog-body retail-stack"
            onSubmit={handleSaveCustomerCredit}
          >
            <div className="retail-form-grid">
              <label className="retail-field">
                Nome do cliente
                <input
                  required
                  value={editingCustomerCredit.name || ""}
                  onChange={(e) =>
                    setEditingCustomerCredit({
                      ...editingCustomerCredit,
                      name: e.target.value,
                    })
                  }
                />
              </label>
              <label className="retail-field">
                WhatsApp (DDD + Número)
                <input
                  required
                  value={editingCustomerCredit.phone || ""}
                  onChange={(e) =>
                    setEditingCustomerCredit({
                      ...editingCustomerCredit,
                      phone: e.target.value,
                    })
                  }
                />
              </label>
              <label className="retail-field">
                Limite de Crédito Individual (R$)
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={editingCustomerCredit.creditLimit}
                  onChange={(e) =>
                    setEditingCustomerCredit({
                      ...editingCustomerCredit,
                      creditLimit: e.target.value,
                    })
                  }
                />
              </label>
              <label className="retail-field">
                Dia preferencial de vencimento (1 a 28)
                <input
                  type="number"
                  min="1"
                  max="28"
                  placeholder="Opcional (ex: 10)"
                  value={editingCustomerCredit.preferredDueDay || ""}
                  onChange={(e) =>
                    setEditingCustomerCredit({
                      ...editingCustomerCredit,
                      preferredDueDay: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <RetailSwitch
              checked={Boolean(editingCustomerCredit.creditBlocked)}
              onCheckedChange={(v) =>
                setEditingCustomerCredit({
                  ...editingCustomerCredit,
                  creditBlocked: v,
                })
              }
              label="Bloquear este cliente para novas compras no Fiado / Crediário"
            />
            <RetailSwitch
              checked={editingCustomerCredit.whatsappOptIn !== false}
              onCheckedChange={(v) =>
                setEditingCustomerCredit({
                  ...editingCustomerCredit,
                  whatsappOptIn: v,
                })
              }
              label="Enviar comprovantes e lembretes automáticos de cobrança no WhatsApp"
            />
            <label className="retail-field">
              Observações da conta do cliente
              <textarea
                rows={2}
                value={editingCustomerCredit.creditNotes || ""}
                onChange={(e) =>
                  setEditingCustomerCredit({
                    ...editingCustomerCredit,
                    creditNotes: e.target.value,
                  })
                }
              />
            </label>
            <div className="retail-dialog-footer">
              <button
                type="button"
                className="retail-button"
                disabled={busy}
                onClick={() => setEditingCustomerCredit(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="retail-button retail-button-primary"
                disabled={busy}
              >
                {busy ? "Salvando…" : "Salvar Limite"}
              </button>
            </div>
          </form>
        </RetailDialog>
      )}

      {/* ============================================================
          MODAL: NOVA CONTA / TÍTULO AVULSO
         ============================================================ */}
      {manualModalOpen && (
        <RetailDialog
          title="Lançar Conta Avulsa no Crediário"
          onClose={() => !busy && setManualModalOpen(false)}
          busy={busy}
        >
          <form
            className="retail-dialog-body retail-stack"
            onSubmit={handleCreateManualReceivable}
          >
            <CustomerPicker
              value={manualCustomerId}
              onChange={setManualCustomerId}
              required
              disabled={busy}
            />
            <label className="retail-field">
              Descrição do lançamento
              <input
                type="text"
                placeholder="Ex: Saldo de caderneta anterior / Compra avulsa"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
              />
            </label>
            <div className="retail-form-grid">
              <label className="retail-field">
                Valor Total (R$)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                />
              </label>
              <label className="retail-field">
                Quantidade de Parcelas
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={manualInstallments}
                  onChange={(e) => setManualInstallments(e.target.value)}
                />
              </label>
              <label className="retail-field">
                Data do 1º Vencimento
                <input
                  type="date"
                  required
                  value={manualFirstDue}
                  onChange={(e) => setManualFirstDue(e.target.value)}
                />
              </label>
            </div>
            <RetailSwitch
              checked={manualSendWhatsapp}
              onCheckedChange={setManualSendWhatsapp}
              label="Enviar aviso de abertura da conta no WhatsApp do cliente agora"
            />
            <div className="retail-dialog-footer">
              <button
                type="button"
                className="retail-button"
                disabled={busy}
                onClick={() => setManualModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="retail-button retail-button-primary"
                disabled={busy}
              >
                {busy ? "Lançando…" : "Criar Conta"}
              </button>
            </div>
          </form>
        </RetailDialog>
      )}

      {/* ============================================================
          MODAL: EXTRATO COMPLETO DA CONTA DO CLIENTE
         ============================================================ */}
      {selectedCustomerDetail && (
        <RetailDialog
          title={`Extrato do Cliente — ${selectedCustomerDetail.customer?.name}`}
          onClose={() => !busy && setSelectedCustomerDetail(null)}
          busy={busy}
        >
          <div className="retail-dialog-body retail-stack">
            <div className="retail-kpis">
              <div className="retail-kpi">
                <span>Limite Total</span>
                <strong>
                  {money(selectedCustomerDetail.summary?.effectiveCreditLimit)}
                </strong>
              </div>
              <div className="retail-kpi">
                <span>Saldo em Aberto</span>
                <strong>
                  {money(selectedCustomerDetail.summary?.usedCredit)}
                </strong>
              </div>
              <div className="retail-kpi">
                <span>Disponível</span>
                <strong>
                  {money(selectedCustomerDetail.summary?.availableCredit)}
                </strong>
              </div>
            </div>

            {selectedCustomerDetail.summary?.usedCredit > 0 && (
              <button
                type="button"
                className="retail-button retail-button-primary"
                onClick={() => {
                  setPaymentModal({
                    customerId: selectedCustomerDetail.customer.id,
                    customerName: selectedCustomerDetail.customer.name,
                    suggestedAmount: selectedCustomerDetail.summary.usedCredit,
                  });
                  setPaymentAmount(
                    String(selectedCustomerDetail.summary.usedCredit),
                  );
                }}
              >
                <Wallet size={16} />
                Amortizar / Quitar Saldo ({money(selectedCustomerDetail.summary.usedCredit)})
              </button>
            )}

            <h3>Parcelas do Cliente</h3>
            {selectedCustomerDetail.receivables?.length ? (
              <div className="retail-table-wrap">
                <table className="retail-table">
                  <thead>
                    <tr>
                      <th>Vencimento</th>
                      <th>Descrição</th>
                      <th>Original</th>
                      <th>Restante</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomerDetail.receivables.map((r: any) => (
                      <tr key={r.id}>
                        <td>{formatDateBr(r.dueDate)}</td>
                        <td>
                          {r.description} ({r.installmentNumber}/
                          {r.totalInstallments})
                        </td>
                        <td className="retail-number">
                          {money(r.originalAmount)}
                        </td>
                        <td className="retail-number">
                          <strong>{money(r.remainingAmount)}</strong>
                        </td>
                        <td>
                          <span className="retail-badge">
                            {r.status === "PAID"
                              ? "Quitada"
                              : r.status === "CANCELLED"
                                ? "Cancelada"
                                : r.status === "PARTIAL"
                                  ? "Parcial"
                                  : "Aberta"}
                          </span>
                        </td>
                        <td>
                          {(r.status === "OPEN" || r.status === "PARTIAL") && (
                            <button
                              type="button"
                              className="retail-button"
                              disabled={busy}
                              onClick={() => void handleSendManualReminder(r.id)}
                            >
                              <MessageCircle size={14} />
                              Cobrar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="retail-muted">Nenhuma parcela registrada.</p>
            )}

            <div className="retail-dialog-footer">
              <button
                type="button"
                className="retail-button retail-button-primary"
                onClick={() => setSelectedCustomerDetail(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </RetailDialog>
      )}
    </div>
  );
}
