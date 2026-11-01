import React, { useState, useEffect, useCallback } from "react";
import {
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
  Eye,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  pin: string;
  tenants?: any[];
  onRefreshTenants?: () => void | Promise<void>;
}

export function LeadgerIntegrationPanel({ pin }: Props) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inspectingPayload, setInspectingPayload] = useState<any | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    running: boolean;
    processed: number;
    total: number;
    delivered: number;
    blocked: number;
  } | null>(null);

  const [data, setData] = useState<{
    config: any;
    counts: Record<string, number>;
    tenants: any[];
    events: any[];
  }>({
    config: null,
    counts: {},
    tenants: [],
    events: [],
  });

  const fetchLeadgerStatus = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      if (tenantFilter) params.set("tenantId", tenantFilter);
      params.set("limit", "80");

      const res = await api.get(
        `/tenants/setup/leadger?${params.toString()}`,
        {
          headers: { "x-setup-pin": pin },
        }
      );
      setData(res.data);
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Erro ao carregar painel do Leadger."
      );
    } finally {
      setLoading(false);
    }
  }, [pin, statusFilter, tenantFilter]);

  useEffect(() => {
    fetchLeadgerStatus();
  }, [fetchLeadgerStatus]);

  const copyValue = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1800);
    toast.success("ID copiado para a área de transferência!");
  };

  const handleDispatchDue = async () => {
    setActionLoading("dispatch_due");
    try {
      const res = await api.post(
        "/tenants/setup/leadger",
        { action: "dispatch_due", pin },
        { headers: { "x-setup-pin": pin } }
      );
      toast.success(
        `Fila processada: ${res.data.delivered || 0}/${
          res.data.processed || 0
        } evento(s) entregue(s)!`
      );
      fetchLeadgerStatus();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao processar fila.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncAll = async () => {
    if (
      !window.confirm(
        "Sincronizar TODAS as lojas em lotes seguros com o Teltech Leadger agora?\n\nIsso emitirá eventos base.upsert / client.upsert com IDs permanentes."
      )
    )
      return;

    setActionLoading("sync_all");
    let offset = 0;
    const limit = 10;
    let totalDelivered = 0;
    let totalBlocked = 0;
    let totalProcessed = 0;

    try {
      setBatchProgress({
        running: true,
        processed: 0,
        total: data.tenants.length || 1,
        delivered: 0,
        blocked: 0,
      });

      while (true) {
        const res = await api.post(
          "/tenants/setup/leadger",
          {
            action: "sync_batch",
            offset,
            limit,
            pin,
          },
          { headers: { "x-setup-pin": pin } }
        );

        const d = res.data;
        totalProcessed += Number(d.processedInBatch || 0);
        totalDelivered += Number(d.delivered || 0);
        totalBlocked += Number(d.blocked || 0);

        setBatchProgress({
          running: Boolean(d.hasMore),
          processed: totalProcessed,
          total: Number(d.totalEligible || totalProcessed),
          delivered: totalDelivered,
          blocked: totalBlocked,
        });

        if (!d.hasMore || Number(d.processedInBatch || 0) === 0) {
          break;
        }
        offset = Number(d.nextOffset);
      }

      toast.success(
        `Sincronização concluída: ${totalDelivered} entregue(s), ${totalBlocked} bloqueado(s) de ${totalProcessed} loja(s).`
      );
      fetchLeadgerStatus();
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Erro na sincronização em lote."
      );
    } finally {
      setActionLoading(null);
      setTimeout(() => setBatchProgress(null), 4000);
    }
  };

  const handleRebuildBlocked = async (outboxId: string) => {
    setActionLoading(`rebuild_${outboxId}`);
    try {
      const res = await api.post(
        "/tenants/setup/leadger",
        {
          action: "rebuild_blocked_event",
          outboxId,
          pin,
        },
        { headers: { "x-setup-pin": pin } }
      );
      if (res.data.delivered) {
        toast.success(
          `Payload reconstruído e entregue (HTTP ${res.data.statusCode})!`
        );
      } else {
        toast.error(res.data.error || "Falha ao reconstruir evento.");
      }
      fetchLeadgerStatus();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao reconstruir evento.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncSingleTenant = async (
    tenantId: string,
    eventType: "base.upsert" | "client.upsert"
  ) => {
    setActionLoading(`sync_${tenantId}`);
    try {
      const res = await api.post(
        "/tenants/setup/leadger",
        {
          action: "sync_tenant",
          tenantId,
          eventType,
          bumpVersion: true,
          pin,
        },
        { headers: { "x-setup-pin": pin } }
      );
      if (res.data.valid === false) {
        toast.error(
          `Bloqueado por validação: ${(res.data.errors || []).join(" | ")}`
        );
      } else if (res.data.delivered) {
        toast.success(
          `Evento ${eventType} entregue ao Leadger (HTTP ${res.data.statusCode})!`
        );
      } else {
        toast.info(res.data.error || "Evento enfileirado para retry.");
      }
      fetchLeadgerStatus();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao sincronizar loja.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryEvent = async (outboxId: string) => {
    setActionLoading(`retry_${outboxId}`);
    try {
      const res = await api.post(
        "/tenants/setup/leadger",
        {
          action: "retry_event",
          outboxId,
          pin,
        },
        { headers: { "x-setup-pin": pin } }
      );
      if (res.data.delivered) {
        toast.success(`Evento reenviado com sucesso (${res.data.statusCode})!`);
      } else {
        toast.error(`Falha no reenvio: ${res.data.error || "Erro"}`);
      }
      fetchLeadgerStatus();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao reenviar evento.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportReconciliation = async (format: "json" | "csv") => {
    setActionLoading("export");
    try {
      const res = await api.post(
        "/tenants/setup/leadger",
        {
          action: "export_reconciliation",
          pin,
        },
        { headers: { "x-setup-pin": pin } }
      );
      const exportData = res.data;

      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pdv-lojista-leadger-reconciliacao-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const headers = [
          "tenantId",
          "databaseName",
          "clientExternalId",
          "baseExternalId",
          "name",
          "tradeName",
          "document",
          "email",
          "phone",
          "amountCents",
          "nextDueDate",
          "status",
          "clientVersion",
          "baseVersion",
        ];
        const rows = (exportData.items || []).map((item: any) =>
          headers
            .map((h) => `"${String(item[h] ?? "").replace(/"/g, '""')}"`)
            .join(",")
        );
        const csv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pdv-lojista-leadger-reconciliacao-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(
        `Relatório de conciliação (${format.toUpperCase()}) exportado!`
      );
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao exportar conciliação.");
    } finally {
      setActionLoading(null);
    }
  };

  const cfg = data.config;
  const counts = data.counts || {};

  return (
    <div className="space-y-6">
      {/* BANNER DE CONFIGURAÇÃO & AÇÕES GLOBAIS */}
      <div className="bg-surface border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-line">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="text-brand" size={20} />
              <h2 className="text-base sm:text-lg font-extrabold text-ink">
                Integração Financeira — Teltech Leadger Webhook v1
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  cfg?.configured
                    ? "bg-support text-brand border border-brand"
                    : "bg-page text-muted border border-line"
                }`}
              >
                {cfg?.configured
                  ? "HMAC Configurado"
                  : "Aguardando LEADGER_WEBHOOK_SECRET"}
              </span>
            </div>
            <p className="text-xs text-muted">
              Endpoint:{" "}
              <code className="text-brand font-mono">
                {cfg?.endpointUrl ||
                  "https://leadger.teltech.com.br/api/webhooks/inbound/pdv_lojista"}
              </code>{" "}
              · Source:{" "}
              <code className="text-ink font-mono">
                {cfg?.source || "pdv_lojista"}
              </code>
              {cfg?.secretPreview && (
                <>
                  {" "}
                  · Segredo:{" "}
                  <code className="text-muted font-mono">
                    {cfg.secretPreview}
                  </code>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={handleDispatchDue}
              className="px-3.5 py-2 rounded-xl bg-page hover:bg-support text-ink border border-line text-xs font-bold flex items-center gap-1.5 transition"
            >
              {actionLoading === "dispatch_due" ? (
                <Loader2 size={14} className="animate-spin text-brand" />
              ) : (
                <RefreshCw size={14} className="text-brand" />
              )}
              <span>Processar Fila Pendente</span>
            </button>

            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={handleSyncAll}
              className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold flex items-center gap-1.5 transition"
            >
              {actionLoading === "sync_all" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Sincronizar Todas as Lojas</span>
            </button>

            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={() => handleExportReconciliation("csv")}
              className="px-3 py-2 rounded-xl bg-page hover:bg-support text-ink border border-line text-xs font-semibold flex items-center gap-1.5 transition"
              title="Exportar planilha de conciliação de IDs permanentes"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              disabled={actionLoading !== null}
              onClick={() => handleExportReconciliation("json")}
              className="px-3 py-2 rounded-xl bg-page hover:bg-support text-ink border border-line text-xs font-semibold flex items-center gap-1.5 transition"
              title="Exportar JSON completo de conciliação"
            >
              <Download size={13} />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Barra de Progresso de Lote */}
        {batchProgress && (
          <div className="mt-4 rounded-xl bg-support border border-brand p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-brand flex items-center gap-2">
                {batchProgress.running && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                <span>
                  Sincronização em Lotes: {batchProgress.processed} /{" "}
                  {batchProgress.total} loja(s)
                </span>
              </span>
              <span className="font-mono text-[11px] text-ink">
                Entregues: {batchProgress.delivered} · Bloqueadas:{" "}
                {batchProgress.blocked}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface overflow-hidden border border-line">
              <div
                className="h-full bg-brand transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (batchProgress.processed /
                        Math.max(1, batchProgress.total)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* KPIs da Fila Outbox */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
          <div className="bg-page border border-line rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted font-bold block">
              Entregues (2xx)
            </span>
            <span className="text-lg font-extrabold text-brand font-mono">
              {counts.delivered || 0}
            </span>
          </div>
          <div className="bg-page border border-line rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted font-bold block">
              Na Fila / Retry
            </span>
            <span className="text-lg font-extrabold text-ink font-mono">
              {(counts.pending || 0) + (counts.retry_scheduled || 0)}
            </span>
          </div>
          <div className="bg-page border border-line rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted font-bold block">
              Bloqueados (Validação/4xx)
            </span>
            <span className="text-lg font-extrabold text-ink font-mono">
              {counts.blocked || 0}
            </span>
          </div>
          <div className="bg-page border border-line rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider text-muted font-bold block">
              Falhas Esgotadas
            </span>
            <span className="text-lg font-extrabold text-muted font-mono">
              {counts.failed || 0}
            </span>
          </div>
          <div className="bg-page border border-line rounded-xl p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase tracking-wider text-muted font-bold block">
              Lojas Mapeadas
            </span>
            <span className="text-lg font-extrabold text-ink font-mono">
              {data.tenants.length}
            </span>
          </div>
        </div>
      </div>

      {/* TABELA DE CONCILIAÇÃO DE IDS EXTERNOS PERMANENTES */}
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-ink">
              Mapa de Identificadores Permanentes (Cliente + Base)
            </h3>
            <p className="text-xs text-muted">
              Estes IDs nunca mudam mesmo que o nome ou CNPJ da loja seja
              alterado.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto bg-page border border-line rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-support text-muted uppercase text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-3">Loja</th>
                <th className="py-2.5 px-3">Documento / E-mail</th>
                <th className="py-2.5 px-3">client.externalId</th>
                <th className="py-2.5 px-3">base.externalId</th>
                <th className="py-2.5 px-3">Mensalidade</th>
                <th className="py-2.5 px-3">Versões</th>
                <th className="py-2.5 px-3 text-right">Sincronizar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.tenants.map((t) => {
                const cExt = t.clientExternalId || `cli-${t.id}`;
                const bExt = t.baseExternalId || `base-${t.id}`;
                const hasDocOrEmail = Boolean(t.cnpj || t.emailContato);
                const amountNum = Number(t.mensalidadeValor || 0);

                return (
                  <tr key={t.id} className="hover:bg-support/50">
                    <td className="py-2.5 px-3 font-bold text-ink">
                      {t.nomeFantasia || t.name}
                      {!hasDocOrEmail && (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-brand font-normal"
                          title="Sem CNPJ e sem e-mail financeiro: preencha para evitar duplicidade no Leadger"
                        >
                          <AlertTriangle size={11} /> Sem doc/email
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted font-mono text-[11px]">
                      {t.cnpj || t.emailContato || "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-brand">
                      <div className="inline-flex items-center gap-1">
                        <span className="truncate max-w-[160px]">{cExt}</span>
                        <button
                          type="button"
                          onClick={() => copyValue(`c_${t.id}`, cExt)}
                          className="text-muted hover:text-brand"
                        >
                          {copiedId === `c_${t.id}` ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-ink">
                      <div className="inline-flex items-center gap-1">
                        <span className="truncate max-w-[160px]">{bExt}</span>
                        <button
                          type="button"
                          onClick={() => copyValue(`b_${t.id}`, bExt)}
                          className="text-muted hover:text-brand"
                        >
                          {copiedId === `b_${t.id}` ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-ink">
                      {amountNum > 0
                        ? `R$ ${amountNum.toFixed(2)}`
                        : "Não def."}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-muted">
                      C:v{t.clientVersion || 1} · B:v{t.baseVersion || 1}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={actionLoading !== null}
                          onClick={() =>
                            handleSyncSingleTenant(
                              t.id,
                              amountNum > 0 ? "base.upsert" : "client.upsert"
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-support hover:bg-brand hover:text-on-brand text-brand border border-brand text-[11px] font-bold flex items-center gap-1 transition"
                        >
                          {actionLoading === `sync_${t.id}` ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Send size={11} />
                          )}
                          <span>
                            {amountNum > 0 ? "base.upsert" : "client.upsert"}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FILA OUTBOX & LOGS DE ENTREGA */}
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink">
              Fila Transacional Outbox & Histórico de Webhooks
            </h3>
            <p className="text-xs text-muted">
              Monitoramento de entregas, status HTTP, idempotência (
              <code className="text-ink font-mono">eventId</code>) e reenvio
              manual.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="bg-page border border-line rounded-xl px-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Todas as lojas</option>
              {data.tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nomeFantasia || t.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-page border border-line rounded-xl px-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="delivered">Entregues (delivered)</option>
              <option value="retry_scheduled">Agendados p/ Retry</option>
              <option value="pending">Pendentes</option>
              <option value="blocked">Bloqueados (4xx / Validação)</option>
              <option value="failed">Falhas Esgotadas</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted">
            <Loader2
              className="animate-spin mx-auto mb-2 text-brand"
              size={24}
            />
            Carregando fila de eventos...
          </div>
        ) : data.events.length === 0 ? (
          <div className="bg-page border border-line rounded-xl p-8 text-center text-muted text-xs">
            Nenhum evento encontrado na fila Outbox para os filtros
            selecionados.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {data.events.map((ev) => {
              const isDelivered = ev.status === "delivered";
              const isBlocked = ev.status === "blocked" || ev.status === "failed";

              return (
                <div
                  key={ev.id}
                  className="rounded-xl bg-page border border-line p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs text-brand bg-support px-2 py-0.5 rounded border border-brand">
                        {ev.eventType}
                      </span>
                      <span className="font-bold text-xs text-ink truncate">
                        {ev.tenant?.nomeFantasia ||
                          ev.tenant?.name ||
                          "Empresa"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isDelivered
                            ? "bg-support text-brand border border-brand"
                            : isBlocked
                            ? "bg-surface text-ink border border-line"
                            : "bg-surface text-muted border border-line"
                        }`}
                      >
                        {isDelivered && <CheckCircle2 size={10} />}
                        {isBlocked && <XCircle size={10} />}
                        {!isDelivered && !isBlocked && <Clock size={10} />}
                        {ev.status}{" "}
                        {ev.lastStatusCode ? `(HTTP ${ev.lastStatusCode})` : ""}
                      </span>
                      <span className="text-[10px] font-mono text-muted">
                        Tentativas: {ev.attempts}/{ev.maxAttempts}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted font-mono truncate">
                      ID: {ev.eventId} · Criado:{" "}
                      {new Date(ev.createdAt).toLocaleString("pt-BR")}
                      {ev.deliveredAt &&
                        ` · Entregue: ${new Date(
                          ev.deliveredAt
                        ).toLocaleTimeString("pt-BR")}`}
                    </p>

                    {ev.lastError && (
                      <p className="text-[11px] text-ink font-medium break-words">
                        Detalhe: {ev.lastError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setInspectingPayload(ev)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-support text-ink border border-line text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Eye size={12} /> JSON
                    </button>
                    {ev.status === "blocked" && ev.tenantId && (
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => handleRebuildBlocked(ev.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-support hover:bg-brand hover:text-on-brand text-brand border border-brand text-[11px] font-bold flex items-center gap-1"
                        title="Recarrega os dados atuais da loja e reconstrói o JSON antes de reenviar"
                      >
                        {actionLoading === `rebuild_${ev.id}` ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        <span>Reconstruir & Enviar</span>
                      </button>
                    )}
                    {ev.status !== "delivered" && (
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => handleRetryEvent(ev.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-[11px] font-bold flex items-center gap-1"
                      >
                        {actionLoading === `retry_${ev.id}` ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        <span>Reenviar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE INSPEÇÃO DO ENVELOPE JSON */}
      {inspectingPayload && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInspectingPayload(null)}
        >
          <div
            className="bg-surface border border-line rounded-2xl max-w-2xl w-full p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h4 className="text-sm font-bold text-ink">
                  Envelope JSON v1 ({inspectingPayload.eventType})
                </h4>
                <p className="text-[11px] text-muted font-mono">
                  {inspectingPayload.eventId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingPayload(null)}
                className="p-1.5 rounded-lg bg-page text-muted hover:text-ink border border-line"
              >
                <X size={15} />
              </button>
            </div>

            <pre className="bg-page border border-line rounded-xl p-3.5 text-[11px] font-mono text-ink overflow-x-auto max-h-96">
              {JSON.stringify(inspectingPayload.payload, null, 2)}
            </pre>

            {inspectingPayload.lastResponse && (
              <div>
                <span className="text-[10px] uppercase font-bold text-muted block mb-1">
                  Última Resposta do Leadger (HTTP{" "}
                  {inspectingPayload.lastStatusCode}):
                </span>
                <pre className="bg-page border border-line rounded-xl p-2.5 text-[11px] font-mono text-muted overflow-x-auto max-h-32">
                  {inspectingPayload.lastResponse}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
