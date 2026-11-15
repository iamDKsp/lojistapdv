import React, { useState } from "react";
import {
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  Package,
  CreditCard,
  CalendarDays,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type ScaleProfile = "compact" | "medium" | "busy";

interface Props {
  pin: string;
  tenant: any;
  onClose: () => void;
  onCompleted?: (result: any) => void;
  onImpersonate?: (tenant: any) => void;
}

const SCALE_OPTIONS: Array<{
  id: ScaleProfile;
  title: string;
  revenueLabel: string;
  volumeLabel: string;
}> = [
  {
    id: "compact",
    title: "Porte Compacto",
    revenueLabel: "~R$ 20 mil a R$ 32 mil/mês",
    volumeLabel: "~85 a 130 vendas/mês",
  },
  {
    id: "medium",
    title: "Porte Médio (Recomendado)",
    revenueLabel: "~R$ 35 mil a R$ 65 mil/mês",
    volumeLabel: "~155 a 225 vendas/mês",
  },
  {
    id: "busy",
    title: "Loja Movimentada",
    revenueLabel: "~R$ 75 mil a R$ 110 mil/mês",
    volumeLabel: "~265 a 380 vendas/mês",
  },
];

function formatBrl(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function TenantPopulateHistoryModal({
  pin,
  tenant,
  onClose,
  onCompleted,
  onImpersonate,
}: Props) {
  const [months, setMonths] = useState<number>(12);
  const [profile, setProfile] = useState<ScaleProfile>("medium");
  const [cleanExistingMovements, setCleanExistingMovements] =
    useState<boolean>(true);
  const [complementTeam, setComplementTeam] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);

  if (!tenant) return null;

  const tenantLabel =
    tenant.nomeFantasia || tenant.name || tenant.databaseName || "Loja";

  const handleRunSimulation = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const res = await api.post(
        `/tenants/setup/${tenant.id}/populate-history`,
        {
          pin,
          months,
          profile,
          cleanExistingMovements,
          complementTeam,
        },
        {
          headers: { "x-setup-pin": pin },
        },
      );
      setResult(res.data);
      toast.success(
        `Histórico de ${months} meses gerado com sucesso em "${tenantLabel}"!`,
      );
      onCompleted?.(res.data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Não foi possível alimentar o histórico operacional desta loja.";
      setErrorMessage(Array.isArray(msg) ? msg.join(" ") : String(msg));
      toast.error(Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="populate-history-title"
    >
      <div className="bg-page border border-line rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 border-b border-line flex items-start justify-between gap-4 bg-surface">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-support px-2.5 py-0.5 text-[11px] font-bold text-brand mb-2">
              <Sparkles size={12} />
              <span>Simulação Operacional Realista</span>
            </div>
            <h2
              id="populate-history-title"
              className="text-lg sm:text-xl font-bold text-ink truncate"
            >
              Alimentar Histórico — {tenantLabel}
            </h2>
            <p className="text-xs text-muted font-mono mt-0.5 truncate">
              Banco isolado: {tenant.databaseName}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-2 rounded-xl border border-line bg-page text-muted hover:text-ink hover:border-brand transition disabled:opacity-40"
            aria-label="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {!result ? (
            <>
              {/* Garantia de preservação */}
              <div className="rounded-2xl border border-brand bg-support p-4 flex items-start gap-3">
                <ShieldCheck size={20} className="text-brand shrink-0 mt-0.5" />
                <div className="text-xs text-ink space-y-1">
                  <p className="font-bold text-brand">
                    Mercadorias, fotos, preços e Loja Virtual 100% preservados
                  </p>
                  <p className="text-muted leading-relaxed">
                    A simulação utiliza exatamente os produtos, grades, fotos,
                    categorias, operadores e o site já configurados no tenant,
                    gerando vendas no PDV e na Loja Virtual, turnos de caixa
                    auditados, reposições de estoque, contas a pagar, crediário
                    e trocas ao longo do período. Notas fiscais autorizadas
                    jamais são removidas.
                  </p>
                </div>
              </div>

              {/* Período */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Período de Operação
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[6, 12, 18].map((m) => {
                    const active = months === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={submitting}
                        onClick={() => setMonths(m)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-brand bg-support text-brand"
                            : "border-line bg-surface text-ink hover:border-brand"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-bold">{m} meses</span>
                          {active && (
                            <CheckCircle2 size={14} className="text-brand" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted block mt-0.5">
                          {m === 12
                            ? "Ciclo anual completo"
                            : m === 6
                              ? "Semestre recente"
                              : "Histórico estendido"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Porte mensal */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Porte Mensal Simulado
                </label>
                <div className="space-y-2">
                  {SCALE_OPTIONS.map((opt) => {
                    const selected = profile === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => setProfile(opt.id)}
                        className={`w-full rounded-2xl border p-3.5 text-left transition flex items-center justify-between gap-3 ${
                          selected
                            ? "border-brand bg-support"
                            : "border-line bg-surface hover:border-brand"
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-bold ${
                              selected ? "text-brand" : "text-ink"
                            }`}
                          >
                            {opt.title}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {opt.revenueLabel} · {opt.volumeLabel} (com curva
                            sazonal de Mães, Black Friday e Natal)
                          </p>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-brand bg-brand text-on-brand"
                              : "border-line bg-page"
                          }`}
                        >
                          {selected && <CheckCircle2 size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opções de limpeza e equipe */}
              <div className="space-y-2.5 rounded-2xl border border-line bg-surface p-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cleanExistingMovements}
                    disabled={submitting}
                    onChange={(e) =>
                      setCleanExistingMovements(e.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 accent-brand rounded shrink-0"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-ink block">
                      Substituir movimentações de teste anteriores
                    </span>
                    <span className="text-muted">
                      Limpa vendas de teste não fiscais, turnos antigos e contas
                      anteriores para gerar uma linha do tempo limpa e sem
                      duplicidade.
                    </span>
                  </div>
                </label>

                <div className="border-t border-line pt-2.5">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={complementTeam}
                      disabled={submitting}
                      onChange={(e) => setComplementTeam(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand rounded shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-ink block">
                        Completar equipe para o Ranking e Pódio (mínimo 4
                        operadores)
                      </span>
                      <span className="text-muted">
                        Mantém todos os operadores já cadastrados e adiciona
                        consultores(as) extras apenas se houver menos de 4
                        ativos (PIN padrão 1234).
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-brand bg-support p-3.5 flex items-start gap-2.5 text-xs text-ink">
                  <AlertCircle
                    size={16}
                    className="text-brand shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="font-bold text-brand">
                      Atenção ao executar simulação
                    </p>
                    <p className="mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Resumo executivo pós-execução */
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand bg-support p-4 flex items-start gap-3">
                <CheckCircle2
                  size={22}
                  className="text-brand shrink-0 mt-0.5"
                />
                <div className="text-xs text-ink">
                  <p className="text-sm font-bold text-brand">
                    {result.monthsCovered} meses de operação alimentados em{" "}
                    {(Number(result.durationMs || 0) / 1000).toFixed(1)}s
                  </p>
                  <p className="text-muted mt-0.5">
                    Período de{" "}
                    <strong>
                      {new Date(
                        `${result.period?.startDate}T12:00:00`,
                      ).toLocaleDateString("pt-BR")}
                    </strong>{" "}
                    até{" "}
                    <strong>
                      {new Date(
                        `${result.period?.endDate}T12:00:00`,
                      ).toLocaleDateString("pt-BR")}
                    </strong>{" "}
                    ({result.businessDaysOpen} dias operados · Caixa #
                    {result.generated?.openRegisterCode} aberto hoje).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted mb-1">
                    <ShoppingCart size={13} className="text-brand" />
                    <span>Vendas Concluídas</span>
                  </div>
                  <p className="text-lg font-extrabold text-ink font-mono">
                    {result.generated?.salesCompleted}
                  </p>
                  <p className="text-[11px] text-muted">
                    {result.generated?.saleItems} peças · Ticket{" "}
                    {formatBrl(result.generated?.averageTicket)}
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted mb-1">
                    <CalendarDays size={13} className="text-brand" />
                    <span>Faturamento Total</span>
                  </div>
                  <p className="text-lg font-extrabold text-brand font-mono">
                    {formatBrl(result.generated?.grossRevenue)}
                  </p>
                  <p className="text-[11px] text-muted">
                    Média {formatBrl(result.generated?.averageMonthlyRevenue)}
                    /mês
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted mb-1">
                    <Store size={13} className="text-brand" />
                    <span>Loja Virtual</span>
                  </div>
                  <p className="text-lg font-extrabold text-ink font-mono">
                    {result.generated?.storefrontOrdersTotal} pedidos
                  </p>
                  <p className="text-[11px] text-muted">
                    {result.generated?.storefrontOrdersActiveQueue} aguardando
                    na fila hoje
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted mb-1">
                    <Users size={13} className="text-brand" />
                    <span>Equipe & Clientes</span>
                  </div>
                  <p className="text-base font-extrabold text-ink font-mono">
                    {result.team?.totalActiveOperators} operadores
                  </p>
                  <p className="text-[11px] text-muted">
                    {result.generated?.customersTotal} clientes recorrentes
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted mb-1">
                    <Package size={13} className="text-brand" />
                    <span>Compras & Trocas</span>
                  </div>
                  <p className="text-base font-extrabold text-ink font-mono">
                    {result.generated?.purchaseOrders} pedidos compra
                  </p>
                  <p className="text-[11px] text-muted">
                    {result.generated?.returnsCount} trocas ·{" "}
                    {result.generated?.activeStoreCredits} vales ativos
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted mb-1">
                    <CreditCard size={13} className="text-brand" />
                    <span>Financeiro & Crediário</span>
                  </div>
                  <p className="text-base font-extrabold text-ink font-mono">
                    {result.generated?.payablesTotal} contas
                  </p>
                  <p className="text-[11px] text-muted">
                    {result.generated?.crediarioInstallments} parcelas crediário
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-3.5 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
                <span>
                  Catálogo intacto:{" "}
                  <strong className="text-ink">
                    {result.catalogPreserved?.activeProducts} produtos ativos
                  </strong>{" "}
                  em{" "}
                  <strong className="text-ink">
                    {result.catalogPreserved?.retailGroups} grupos
                  </strong>
                  .
                </span>
                {result.preservedFiscalSales > 0 && (
                  <span className="font-semibold text-brand">
                    {result.preservedFiscalSales} NFC-e autorizada(s)
                    preservada(s)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé estável */}
        <div className="p-5 sm:p-6 border-t border-line bg-surface flex flex-wrap items-center justify-end gap-2.5">
          {!result ? (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-line bg-page text-xs font-bold text-muted hover:text-ink transition disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleRunSimulation}
                className="min-w-[215px] px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin shrink-0" />
                    <span>Alimentando {months} meses...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="shrink-0" />
                    <span>Alimentar {months} Meses Agora</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-line bg-page text-xs font-bold text-ink hover:border-brand transition"
              >
                Concluir
              </button>
              {onImpersonate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onImpersonate(tenant);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <LogIn size={15} />
                  <span>Acessar Painel da Loja</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
