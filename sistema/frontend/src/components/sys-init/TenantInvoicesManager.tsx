import React, { useState } from "react";
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Edit,
  Send,
  DollarSign,
  History,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  pin: string;
  tenant: any;
  invoices: any[];
  paymentHistory: any[];
  loadingHistory: boolean;
  onRefresh: () => void;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto Bancário" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "bank_transfer", label: "Transferência / TED" },
  { value: "cash", label: "Dinheiro em Espécie" },
];

export function TenantInvoicesManager({
  pin,
  tenant,
  invoices,
  paymentHistory,
  loadingHistory,
  onRefresh,
}: Props) {
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newRefMonth, setNewRefMonth] = useState(() => {
    if (tenant?.mensalidadeVencimento) {
      return new Date(tenant.mensalidadeVencimento).toISOString().slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  });
  const [newDueDate, setNewDueDate] = useState(() => {
    if (tenant?.mensalidadeVencimento) {
      return new Date(tenant.mensalidadeVencimento).toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [newAmountReais, setNewAmountReais] = useState(() =>
    String(Number(tenant?.mensalidadeValor || 0).toFixed(2))
  );
  const [newDescription, setNewDescription] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [editAmountReais, setEditAmountReais] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [payingInv, setPayingInv] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState("pix");
  const [payNotes, setPayNotes] = useState("");

  const handleCreateInvoice = async () => {
    if (!newRefMonth || !/^\d{4}-\d{2}$/.test(newRefMonth)) {
      toast.error("Informe a competência no formato AAAA-MM (ex: 2026-05).");
      return;
    }
    if (!newDueDate) {
      toast.error("Informe a data de vencimento.");
      return;
    }
    if (Number(newAmountReais) <= 0) {
      toast.error("O valor da fatura deve ser maior que zero.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(
        `/tenants/setup/${tenant.id}/invoices`,
        {
          pin,
          referenceMonth: newRefMonth,
          dueDate: newDueDate,
          amountReais: Number(newAmountReais),
          description: newDescription || `Mensalidade ${newRefMonth}`,
          notes: newNotes || undefined,
          status: "pending",
        },
        { headers: { "x-setup-pin": pin } }
      );
      toast.success(`Fatura ${newRefMonth} gerada e enfileirada no Leadger!`);
      setCreatingOpen(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao criar fatura.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (inv: any) => {
    setEditingInvId(inv.id);
    setEditAmountReais((Number(inv.amount || 0) / 100).toFixed(2));
    setEditDueDate(
      inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : ""
    );
    setEditDescription(inv.description || `Mensalidade ${inv.referenceMonth}`);
    setEditNotes(inv.notes || "");
  };

  const handleSaveEdit = async (invoiceId: string) => {
    setSubmitting(true);
    try {
      await api.patch(
        `/tenants/setup/${tenant.id}/invoices`,
        {
          pin,
          invoiceId,
          action: "edit",
          amountReais: Number(editAmountReais),
          dueDate: editDueDate,
          description: editDescription,
          notes: editNotes,
        },
        { headers: { "x-setup-pin": pin } }
      );
      toast.success("Fatura corrigida e sincronizada (version +1)!");
      setEditingInvId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao atualizar fatura.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvoiceAction = async (
    invoiceId: string,
    action: "cancel" | "reopen"
  ) => {
    const label = action === "cancel" ? "cancelar" : "reabrir";
    if (!window.confirm(`Deseja realmente ${label} esta fatura?`)) return;

    setSubmitting(true);
    try {
      await api.patch(
        `/tenants/setup/${tenant.id}/invoices`,
        { pin, invoiceId, action },
        { headers: { "x-setup-pin": pin } }
      );
      toast.success(
        action === "cancel"
          ? "Fatura cancelada com sucesso!"
          : "Fatura reaberta como pendente!"
      );
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao alterar fatura.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayInvoice = async () => {
    if (!payingInv) return;
    setSubmitting(true);
    try {
      await api.post(
        `/tenants/setup/${tenant.id}/registrar-pagamento`,
        {
          pin,
          action: "pay",
          invoiceId: payingInv.id,
          referenceMonth: payingInv.referenceMonth,
          valorPago: Number(payingInv.amount || 0) / 100,
          paymentMethod: payMethod,
          observacao:
            payNotes || `Quitação competência ${payingInv.referenceMonth}`,
        },
        { headers: { "x-setup-pin": pin } }
      );
      toast.success(
        `Competência ${payingInv.referenceMonth} quitada (+1 mês renovado)!`
      );
      setPayingInv(null);
      setPayNotes("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao registrar pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundPayment = async (logItem: any) => {
    const motivo = window.prompt(
      `Confirmar ESTORNO do pagamento de R$ ${Number(
        logItem.valor || 0
      ).toFixed(2)}?\n\nInforme o motivo do estorno:`,
      "Estorno / lançamento incorreto"
    );
    if (!motivo) return;

    setSubmitting(true);
    try {
      await api.post(
        `/tenants/setup/${tenant.id}/registrar-pagamento`,
        {
          pin,
          action: "refund",
          paymentLogId: logItem.id,
          observacao: motivo,
        },
        { headers: { "x-setup-pin": pin } }
      );
      toast.success(
        "Pagamento estornado! Vencimento e fatura revertidos com sucesso."
      );
      onRefresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao estornar pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pt-4 border-t border-line">
      {/* SEÇÃO 1: COMPETÊNCIAS / FATURAS MENSAIS */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-2">
              <FileText size={14} />
              <span>Faturas / Competências Mensais ({invoices.length})</span>
            </h4>
            <p className="text-[11px] text-muted">
              Cada competência possui{" "}
              <code className="text-ink font-mono">externalId</code> permanente
              e versionamento automático para o Teltech Leadger.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreatingOpen((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-support hover:bg-brand hover:text-on-brand text-brand border border-brand text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Plus size={13} />
            <span>
              {creatingOpen ? "Fechar Nova Fatura" : "Gerar / Antecipar Fatura"}
            </span>
          </button>
        </div>

        {/* Modal/Box de Criação de Competência */}
        {creatingOpen && (
          <div className="rounded-2xl bg-page border border-brand p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-muted font-bold mb-1">
                  Competência (YYYY-MM)
                </label>
                <input
                  type="month"
                  value={newRefMonth}
                  onChange={(e) => setNewRefMonth(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink font-mono focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted font-bold mb-1">
                  Vencimento
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted font-bold mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newAmountReais}
                  onChange={(e) => setNewAmountReais(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink font-mono focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Descrição (ex: Mensalidade PDV Lojista)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
              />
              <input
                type="text"
                placeholder="Observação interna (opcional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreatingOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-surface border border-line text-muted text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleCreateInvoice}
                className="px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold flex items-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>Emitir Fatura & Sincronizar</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Inline de Quitação */}
        {payingInv && (
          <div className="rounded-2xl bg-support border border-brand p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-ink flex items-center gap-2">
                <DollarSign size={14} className="text-brand" />
                <span>
                  Confirmar Pagamento da Competência {payingInv.referenceMonth}{" "}
                  (R$ {(Number(payingInv.amount || 0) / 100).toFixed(2)})
                </span>
              </h5>
              <button
                type="button"
                onClick={() => setPayingInv(null)}
                className="text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-muted font-bold mb-1">
                  Meio de Pagamento
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted font-bold mb-1">
                  Observação / Comprovante
                </label>
                <input
                  type="text"
                  placeholder="Ex: PIX confirmado no banco..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayingInv(null)}
                className="px-3 py-1.5 rounded-xl bg-surface border border-line text-muted text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmPayInvoice}
                className="px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold flex items-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                <span>Confirmar Recebimento (+1 Mês)</span>
              </button>
            </div>
          </div>
        )}

        {/* Lista de Competências */}
        {invoices.length === 0 ? (
          <div className="bg-page border border-line rounded-2xl p-6 text-center text-muted text-xs">
            Nenhuma fatura mensal emitida ainda. Clique em{" "}
            <strong className="text-brand">Gerar / Antecipar Fatura</strong> ou
            salve uma mensalidade acima.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {invoices.map((inv) => {
              const isEditing = editingInvId === inv.id;
              const amountReais = (Number(inv.amount || 0) / 100).toFixed(2);
              const dueStr = inv.dueDate
                ? new Date(inv.dueDate).toLocaleDateString("pt-BR", {
                    timeZone: "UTC",
                  })
                : "—";

              return (
                <div
                  key={inv.id}
                  className="rounded-xl bg-page border border-line p-3 transition hover:border-brand"
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-brand">
                        <span>
                          Editando Competência {inv.referenceMonth} (v
                          {inv.version})
                        </span>
                        <span className="font-mono text-[10px] text-muted">
                          {inv.externalId}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={editAmountReais}
                          onChange={(e) => setEditAmountReais(e.target.value)}
                          placeholder="Valor R$"
                          className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink font-mono"
                        />
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink"
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Descrição"
                          className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Motivo da correção / observação..."
                          className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingInvId(null)}
                          className="px-2.5 py-1.5 rounded-lg bg-surface border border-line text-muted text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleSaveEdit(inv.id)}
                          className="px-3 py-1.5 rounded-lg bg-brand text-on-brand text-xs font-bold"
                        >
                          Salvar Correção
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs text-ink bg-surface px-2 py-0.5 rounded border border-line">
                            {inv.referenceMonth}
                          </span>
                          <span className="font-bold text-sm text-brand font-mono">
                            R$ {amountReais}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inv.status === "paid"
                                ? "bg-support text-brand border border-brand"
                                : inv.status === "cancelled"
                                ? "bg-surface text-muted border border-line line-through"
                                : "bg-surface text-ink border border-line"
                            }`}
                          >
                            {inv.status === "paid" && <CheckCircle2 size={10} />}
                            {inv.status === "pending" && <Clock size={10} />}
                            {inv.status === "cancelled" && (
                              <XCircle size={10} />
                            )}
                            {inv.status === "paid"
                              ? `Pago (${(
                                  inv.paymentMethod || "PIX"
                                ).toUpperCase()})`
                              : inv.status === "cancelled"
                              ? "Cancelada"
                              : "Pendente"}
                          </span>
                          <span className="text-[10px] font-mono text-muted">
                            v{inv.version || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">
                          Vencimento:{" "}
                          <strong className="text-ink">{dueStr}</strong>
                          {inv.paidAt && (
                            <>
                              {" "}
                              · Pago em:{" "}
                              <strong className="text-brand">
                                {new Date(inv.paidAt).toLocaleDateString(
                                  "pt-BR"
                                )}
                              </strong>
                            </>
                          )}
                          {inv.notes && (
                            <span className="text-muted"> · {inv.notes}</span>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {inv.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingInv(inv);
                              setPayMethod(inv.paymentMethod || "pix");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-[11px] font-bold flex items-center gap-1"
                          >
                            <Check size={12} /> Quitar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(inv)}
                          className="px-2 py-1 rounded-lg bg-surface hover:bg-support text-ink border border-line text-[11px] font-semibold flex items-center gap-1"
                          title="Corrigir valor ou vencimento"
                        >
                          <Edit size={11} /> Editar
                        </button>
                        {inv.status === "pending" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleInvoiceAction(inv.id, "cancel")
                            }
                            className="px-2 py-1 rounded-lg bg-surface hover:bg-support text-muted hover:text-ink border border-line text-[11px] font-semibold flex items-center gap-1"
                          >
                            <XCircle size={11} /> Cancelar
                          </button>
                        )}
                        {inv.status === "cancelled" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleInvoiceAction(inv.id, "reopen")
                            }
                            className="px-2 py-1 rounded-lg bg-support text-brand border border-brand text-[11px] font-semibold flex items-center gap-1"
                          >
                            <RotateCcw size={11} /> Reabrir
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO 2: HISTÓRICO AUDITÁVEL DE PAGAMENTOS E ESTORNOS */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center space-x-2">
          <History size={14} className="text-brand" />
          <span>Histórico de Pagamentos & Estornos</span>
        </h4>
        {loadingHistory ? (
          <div className="py-6 text-center text-muted">
            <Loader2
              className="animate-spin mx-auto mb-2 text-brand"
              size={22}
            />
            Carregando histórico...
          </div>
        ) : paymentHistory.length === 0 ? (
          <div className="bg-page border border-line rounded-2xl p-6 text-center text-muted text-xs">
            Nenhum pagamento registrado para esta empresa ainda.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {paymentHistory.map((p) => {
              const isRefund = p.tipo === "refund" || Number(p.valor) < 0;
              const isCorrection = p.tipo === "correction";

              return (
                <div
                  key={p.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-page border rounded-xl px-4 py-2.5 text-xs ${
                    p.estornado
                      ? "border-line opacity-60"
                      : isRefund
                      ? "border-brand bg-support"
                      : "border-line"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-bold font-mono ${
                          p.estornado
                            ? "line-through text-muted"
                            : isRefund
                            ? "text-ink"
                            : isCorrection
                            ? "text-muted"
                            : "text-brand"
                        }`}
                      >
                        R$ {Number(p.valor || 0).toFixed(2)}
                      </span>
                      {p.paymentMethod && (
                        <span className="px-1.5 py-0.5 rounded bg-surface border border-line text-[10px] font-mono text-muted uppercase">
                          {p.paymentMethod}
                        </span>
                      )}
                      {p.estornado && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-support text-brand border border-brand text-[10px] font-bold uppercase">
                          <AlertTriangle size={10} /> Estornado
                        </span>
                      )}
                      {isCorrection && (
                        <span className="px-1.5 py-0.5 rounded bg-surface text-muted border border-line text-[10px] font-bold uppercase">
                          Correção
                        </span>
                      )}
                      <span className="text-muted">·</span>
                      <span className="text-ink">
                        {p.observacao || "Mensalidade"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      Registrado em{" "}
                      {new Date(p.createdAt).toLocaleString("pt-BR")} por{" "}
                      {p.registradoPor || "Admin"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.vencimentoApos && (
                      <span className="text-[11px] text-brand font-mono">
                        Venc. →{" "}
                        {new Date(p.vencimentoApos).toLocaleDateString(
                          "pt-BR",
                          {
                            timeZone: "UTC",
                          }
                        )}
                      </span>
                    )}

                    {!p.estornado && !isRefund && !isCorrection && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleRefundPayment(p)}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-support text-ink hover:text-brand border border-line hover:border-brand text-[10px] font-bold flex items-center gap-1 transition"
                        title="Estornar pagamento e reverter vencimento/fatura"
                      >
                        <RotateCcw size={11} /> Estornar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
