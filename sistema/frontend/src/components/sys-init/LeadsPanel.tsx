import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  PauseCircle,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatWhatsappMask } from "@/retail/DemoLeadModal";

export interface LeadLeadgerInfo {
  synced: boolean;
  outboxStatus: string | null;
  outboxDeliveredAt: string | null;
  outboxError: string | null;
  cadenceStatus: string | null;
  pauseReason: string | null;
  sentCount: number;
  totalSteps: number;
  nextStepOrder: number | null;
  nextStepAt: string | null;
  lastSentAt: string | null;
  repliedAt: string | null;
}

export interface LeadRecord {
  id: string;
  name: string;
  whatsapp: string;
  status: string;
  notes: string | null;
  accessCount: number;
  lastAccessAt: string;
  createdAt: string;
  updatedAt: string;
  leadger?: LeadLeadgerInfo | null;
}

interface LeadgerConfigMeta {
  configured: boolean;
  secretTooShort?: boolean;
  source?: string;
  endpointUrl?: string;
  remoteOnline?: boolean;
  remoteStats?: {
    total?: number;
    active?: number;
    replied?: number;
    converted?: number;
    messagesSent?: number;
  } | null;
}

interface LeadsPanelProps {
  pin: string;
  onCountChange?: (count: number) => void;
}

const LEAD_STATUS_OPTIONS = [
  { value: "NOVO", label: "Novo Lead" },
  { value: "EM_DEMO", label: "Testando Demo" },
  { value: "CONTATADO", label: "Contatado" },
  { value: "CONVERTIDO", label: "Convertido" },
  { value: "DESCARTADO", label: "Descartado" },
] as const;

function formatShortDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeLeadgerStatus(info?: LeadLeadgerInfo | null): {
  label: string;
  sublabel: string;
  emphasized: boolean;
  paused: boolean;
} {
  if (!info) {
    return {
      label: "Aguardando envio ao Leadger",
      sublabel: "Clique em Sincronizar para iniciar a régua automática",
      emphasized: false,
      paused: false,
    };
  }

  if (info.cadenceStatus === "converted") {
    return {
      label: "Convertido no Leadger",
      sublabel: `${info.sentCount}/${info.totalSteps || 7} mensagens disparadas antes da conversão`,
      emphasized: true,
      paused: false,
    };
  }

  if (info.cadenceStatus === "paused" || info.cadenceStatus === "opted_out") {
    const reasonLabel =
      info.pauseReason === "lead_replied"
        ? "Lead respondeu no WhatsApp • Automação pausada"
        : info.pauseReason === "operator_manual_chat"
        ? "Atendimento humano iniciado • Automação pausada"
        : info.pauseReason === "opt_out" || info.cadenceStatus === "opted_out"
        ? "Lead solicitou parada (Opt-out)"
        : "Cadência pausada manualmente no Leadger";

    return {
      label:
        info.pauseReason === "lead_replied"
          ? "Respondeu no WhatsApp"
          : "Cadência Pausada",
      sublabel: `${reasonLabel} (${info.sentCount}/${info.totalSteps || 7} enviadas)`,
      emphasized: info.pauseReason === "lead_replied",
      paused: true,
    };
  }

  if (info.cadenceStatus === "completed") {
    return {
      label: `Régua Concluída (${info.sentCount}/${info.totalSteps || 7})`,
      sublabel: info.lastSentAt
        ? `Último envio em ${formatShortDateTime(info.lastSentAt)}`
        : "Todas as etapas provocantes foram enviadas",
      emphasized: true,
      paused: false,
    };
  }

  if (info.cadenceStatus === "active") {
    const nextTxt = info.nextStepAt
      ? `Próxima (#${info.nextStepOrder || info.sentCount + 1}) em ${formatShortDateTime(info.nextStepAt)}`
      : info.lastSentAt
      ? `Último disparo em ${formatShortDateTime(info.lastSentAt)}`
      : "Agendando 1ª mensagem de boas-vindas";
    return {
      label: `Régua Ativa • ${info.sentCount}/${info.totalSteps || 7} enviadas`,
      sublabel: nextTxt,
      emphasized: true,
      paused: false,
    };
  }

  if (info.outboxStatus === "delivered") {
    return {
      label: "Sincronizado com Leadger",
      sublabel: info.outboxDeliveredAt
        ? `Entregue em ${formatShortDateTime(info.outboxDeliveredAt)}`
        : "Evento recebido pelo Leadger",
      emphasized: true,
      paused: false,
    };
  }

  if (info.outboxStatus === "retry_scheduled" || info.outboxStatus === "pending") {
    return {
      label: "Na fila de envio p/ Leadger",
      sublabel: info.outboxError || "Aguardando conexão com o webhook do Leadger",
      emphasized: false,
      paused: false,
    };
  }

  if (info.outboxStatus === "failed" || info.outboxStatus === "blocked") {
    return {
      label: "Falha no envio ao Leadger",
      sublabel: info.outboxError || "Use Reenviar para tentar novamente",
      emphasized: false,
      paused: true,
    };
  }

  return {
    label: "Ainda não enviado ao Leadger",
    sublabel: "Sincronize para disparar as mensagens no WhatsApp",
    emphasized: false,
    paused: false,
  };
}

export function LeadsPanel({ pin, onCountChange }: LeadsPanelProps) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [leadgerConfig, setLeadgerConfig] = useState<LeadgerConfigMeta | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingLeadId, setSyncingLeadId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    if (!pin) return;
    setLoading(true);
    try {
      const res = await api.get("/tenants/setup/leads", {
        headers: { "x-setup-pin": pin },
      });
      const list: LeadRecord[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.leads)
        ? res.data.leads
        : [];
      setLeads(list);
      if (res.data && !Array.isArray(res.data) && res.data.leadgerConfig) {
        setLeadgerConfig(res.data.leadgerConfig);
      }
      onCountChange?.(list.length);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Erro ao carregar leads da demonstração.",
      );
    } finally {
      setLoading(false);
    }
  }, [pin, onCountChange]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    setSavingId(leadId);
    try {
      const res = await api.patch(
        `/tenants/setup/leads/${leadId}`,
        { status: newStatus },
        { headers: { "x-setup-pin": pin } },
      );
      setLeads((prev) =>
        prev.map((item) =>
          item.id === leadId
            ? { ...item, ...res.data, leadger: res.data?.leadger ?? item.leadger }
            : item,
        ),
      );
      toast.success("Status do lead atualizado.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao atualizar lead.");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveNotes = async (leadId: string) => {
    setSavingId(leadId);
    try {
      const res = await api.patch(
        `/tenants/setup/leads/${leadId}`,
        { notes: notesDraft.trim() || null },
        { headers: { "x-setup-pin": pin } },
      );
      setLeads((prev) =>
        prev.map((item) =>
          item.id === leadId
            ? { ...item, ...res.data, leadger: res.data?.leadger ?? item.leadger }
            : item,
        ),
      );
      setEditingNotesId(null);
      toast.success("Observação salva.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao salvar observação.");
    } finally {
      setSavingId(null);
    }
  };

  const handleSyncSingleLead = async (lead: LeadRecord) => {
    setSyncingLeadId(lead.id);
    try {
      const res = await api.post(
        `/tenants/setup/leads/${lead.id}/sync-leadger`,
        { pin },
        { headers: { "x-setup-pin": pin } },
      );
      if (res.data?.lead) {
        setLeads((prev) =>
          prev.map((item) => (item.id === lead.id ? res.data.lead : item)),
        );
      }
      if (res.data?.delivered) {
        toast.success(`Lead "${lead.name}" sincronizado com o Teltech Leadger!`);
      } else {
        toast.info(
          res.data?.error ||
            "Evento colocado na fila Outbox para envio ao Leadger.",
        );
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Erro ao sincronizar lead com o Teltech Leadger.",
      );
    } finally {
      setSyncingLeadId(null);
    }
  };

  const handleSyncAllLeads = async () => {
    setSyncingAll(true);
    try {
      const res = await api.post(
        "/tenants/setup/leads/sync-leadger",
        { pin },
        { headers: { "x-setup-pin": pin } },
      );
      toast.success(
        `Sincronização Leadger: ${res.data?.delivered || 0} entregue(s), ${
          res.data?.queued || 0
        } na fila (de ${res.data?.total || 0} leads).`,
      );
      await loadLeads();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Erro ao sincronizar leads com o Leadger.",
      );
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDeleteLead = async (lead: LeadRecord) => {
    if (
      !window.confirm(
        `Deseja remover o lead "${lead.name}" (${formatWhatsappMask(lead.whatsapp)})?`,
      )
    ) {
      return;
    }
    setSavingId(lead.id);
    try {
      await api.delete(`/tenants/setup/leads/${lead.id}`, {
        headers: { "x-setup-pin": pin },
      });
      setLeads((prev) => {
        const next = prev.filter((item) => item.id !== lead.id);
        onCountChange?.(next.length);
        return next;
      });
      toast.success("Lead removido com sucesso.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao remover lead.");
    } finally {
      setSavingId(null);
    }
  };

  const handleManualDemoReset = async () => {
    setResettingDemo(true);
    try {
      await api.post(
        "/tenants/setup/demo-reset",
        {},
        { headers: { "x-setup-pin": pin } },
      );
      toast.success(
        "Loja Demonstração restaurada ao estado habitual com caixa, financeiro e fotos.",
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao resetar Loja Demonstração.",
      );
    } finally {
      setResettingDemo(false);
    }
  };

  const handleCopyPhone = (lead: LeadRecord) => {
    navigator.clipboard.writeText(lead.whatsapp);
    setCopiedId(lead.id);
    toast.success("WhatsApp copiado!");
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === lead.id ? null : prev));
    }, 1500);
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("pt-BR");
    const total = leads.length;
    const accessedToday = leads.filter((l) => {
      const d = l.lastAccessAt || l.createdAt;
      return d && new Date(d).toLocaleDateString("pt-BR") === todayStr;
    }).length;
    const recurring = leads.filter((l) => (l.accessCount || 1) > 1).length;
    const converted = leads.filter(
      (l) =>
        l.status === "CONVERTIDO" || l.leadger?.cadenceStatus === "converted",
    ).length;
    const syncedCount = leads.filter((l) => l.leadger?.synced).length;
    const totalMessagesSent = leads.reduce(
      (acc, l) => acc + Number(l.leadger?.sentCount || 0),
      0,
    );
    return {
      total,
      accessedToday,
      recurring,
      converted,
      syncedCount,
      totalMessagesSent,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "ALL" && lead.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        lead.name?.toLowerCase().includes(q) ||
        lead.whatsapp?.includes(q) ||
        formatWhatsappMask(lead.whatsapp).toLowerCase().includes(q) ||
        lead.notes?.toLowerCase().includes(q)
      );
    });
  }, [leads, searchTerm, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Resumo de Conexão Automática com Teltech Leadger */}
      <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-support border border-brand text-brand shrink-0 mt-0.5">
            <ShieldCheck size={20} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-extrabold text-ink">
                Automação WhatsApp via Teltech Leadger
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  leadgerConfig?.configured && leadgerConfig?.remoteOnline
                    ? "bg-support text-brand border border-brand"
                    : "bg-page text-muted border border-line"
                }`}
              >
                {leadgerConfig?.configured
                  ? leadgerConfig.remoteOnline
                    ? "Conectado em Tempo Real"
                    : "Webhook Configurado (Resumo Offline)"
                  : leadgerConfig?.secretTooShort
                  ? "Segredo < 32 caracteres"
                  : "Aguardando LEADGER_WEBHOOK_SECRET"}
              </span>
            </div>
            <p className="text-xs text-muted">
              Todo visitante da Loja Demonstração dispara automaticamente o
              evento <code className="font-mono text-brand">lead.demo_accessed</code>{" "}
              para a régua provocante no Baileys do{" "}
              <strong className="text-ink">Teltech Leadger (Funil Demo)</strong>
              {" · "}
              <strong className="text-ink">{stats.syncedCount}</strong>/
              {stats.total} sincronizados{" · "}
              <strong className="text-brand">{stats.totalMessagesSent}</strong>{" "}
              mensagens enviadas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSyncAllLeads}
            disabled={syncingAll || leads.length === 0}
            className="h-9 px-3.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
            title="Envia ou atualiza todos os leads não descartados no Funil Demo do Teltech Leadger"
          >
            {syncingAll ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span>Sincronizar Leads c/ Leadger</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-support text-brand rounded-xl">
            <UserPlus size={24} />
          </div>
          <div>
            <p className="text-muted text-sm">Leads Únicos</p>
            <p className="text-2xl font-bold text-ink">
              {stats.total}{" "}
              <span className="text-xs font-normal text-muted">
                sem duplicidade
              </span>
            </p>
          </div>
        </div>

        <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-support text-brand rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-muted text-sm">Acessos Hoje</p>
            <p className="text-2xl font-bold text-ink">{stats.accessedToday}</p>
          </div>
        </div>

        <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-support text-brand rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-muted text-sm">Retornaram (2+ acessos)</p>
            <p className="text-2xl font-bold text-ink">{stats.recurring}</p>
          </div>
        </div>

        <div className="bg-page/50 border border-line rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-support text-brand rounded-xl">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-muted text-sm">Convertidos</p>
            <p className="text-2xl font-bold text-brand">{stats.converted}</p>
          </div>
        </div>
      </div>

      {/* Barra de Busca, Filtros e Controle da Loja Demonstração */}
      <div className="bg-page/60 border border-line rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar lead por nome, WhatsApp ou observação..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-line text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleManualDemoReset}
              disabled={resettingDemo}
              className="h-10 px-3.5 rounded-xl border border-brand bg-support text-brand hover:bg-brand hover:text-on-brand text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
              title="Restaura imediatamente o estoque, fotos, caixa e financeiro da Loja Demonstração"
            >
              {resettingDemo ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              <span>Resetar Loja Demo</span>
            </button>

            <button
              type="button"
              onClick={loadLeads}
              disabled={loading}
              className="h-10 px-3.5 rounded-xl border border-line bg-surface hover:bg-support text-ink text-xs font-bold flex items-center gap-2 transition"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              statusFilter === "ALL"
                ? "bg-brand text-on-brand border-brand"
                : "bg-surface text-muted border-line hover:text-ink"
            }`}
          >
            Todos ({leads.length})
          </button>
          {LEAD_STATUS_OPTIONS.map((opt) => {
            const count = leads.filter((l) => l.status === opt.value).length;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  statusFilter === opt.value
                    ? "bg-brand text-on-brand border-brand"
                    : "bg-surface text-muted border-line hover:text-ink"
                }`}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Leads */}
      {loading && leads.length === 0 ? (
        <div className="bg-page/50 border border-line rounded-3xl p-12 flex flex-col items-center justify-center gap-3 text-muted">
          <Loader2 size={28} className="animate-spin text-brand" />
          <p className="text-sm font-medium">Carregando leads capturados...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-page/50 border border-line rounded-3xl p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-support border border-brand flex items-center justify-center text-brand">
            <Store size={26} />
          </div>
          <h3 className="text-lg font-bold text-ink">
            Nenhum lead encontrado
          </h3>
          <p className="text-sm text-muted max-w-md">
            Quando um visitante clicar em{" "}
            <strong className="text-ink">Loja Demonstração</strong> na tela de
            login e informar seu nome e WhatsApp, ele aparecerá automaticamente
            aqui e entrará na régua do Teltech Leadger.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => {
            const maskedPhone = formatWhatsappMask(lead.whatsapp);
            const whatsappUrl = `https://wa.me/55${lead.whatsapp}?text=${encodeURIComponent(
              `Olá ${lead.name}! Vi que você testou a Loja Demonstração do PDV Lojista. Posso te ajudar a configurar para o seu comércio?`,
            )}`;
            const isEditingNote = editingNotesId === lead.id;
            const isSaving = savingId === lead.id;
            const isSyncingThis = syncingLeadId === lead.id;
            const lgInfo = lead.leadger;
            const lgDesc = describeLeadgerStatus(lgInfo);
            const totalSteps = Math.max(1, Number(lgInfo?.totalSteps || 7));
            const sentCount = Math.max(0, Number(lgInfo?.sentCount || 0));
            const pct = Math.min(100, Math.round((sentCount / totalSteps) * 100));

            return (
              <div
                key={lead.id}
                className="bg-page/70 border border-line hover:border-brand rounded-2xl p-5 flex flex-col justify-between gap-4 transition shadow-sm"
              >
                <div className="flex flex-col gap-3">
                  {/* Topo: Nome + Contador de Acessos */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-ink truncate">
                        {lead.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                          <Phone size={13} />
                          {maskedPhone}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(lead)}
                          className="p-1 rounded-lg bg-surface border border-line text-muted hover:text-brand transition"
                          title="Copiar WhatsApp"
                        >
                          {copiedId === lead.id ? (
                            <Check size={12} className="text-brand" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>

                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-support border border-brand text-brand text-xs font-bold flex items-center gap-1">
                      <Sparkles size={12} />
                      {lead.accessCount || 1}{" "}
                      {(lead.accessCount || 1) === 1 ? "acesso" : "acessos"}
                    </span>
                  </div>

                  {/* Bloco Resumo de Disparos Automáticos (Teltech Leadger) */}
                  <div
                    className={`rounded-xl p-3 border space-y-2 ${
                      lgDesc.emphasized
                        ? "bg-support/60 border-brand"
                        : "bg-surface/80 border-line"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink truncate">
                        {lgDesc.paused ? (
                          <PauseCircle size={13} className="text-brand shrink-0" />
                        ) : lgDesc.emphasized ? (
                          <CheckCircle2 size={13} className="text-brand shrink-0" />
                        ) : (
                          <AlertCircle size={13} className="text-muted shrink-0" />
                        )}
                        <span className="truncate">{lgDesc.label}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSyncSingleLead(lead)}
                        disabled={isSyncingThis}
                        className="shrink-0 px-2 py-1 rounded-lg bg-surface hover:bg-brand hover:text-on-brand text-brand border border-line text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-50"
                        title="Sincronizar / Reenviar lead para o Teltech Leadger"
                      >
                        {isSyncingThis ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Send size={11} />
                        )}
                        <span>{lgInfo?.synced ? "Atualizar" : "Enviar"}</span>
                      </button>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-surface border border-line overflow-hidden">
                      <div
                        className="h-full bg-brand transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-muted leading-snug">
                      {lgDesc.sublabel}
                    </p>
                  </div>

                  {/* Datas de Primeiro Cadastro e Último Acesso */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-surface/70 border border-line text-xs">
                    <div>
                      <span className="text-muted block">1º acesso</span>
                      <strong className="text-ink">
                        {new Date(lead.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted block">Último acesso</span>
                      <strong className="text-brand">
                        {new Date(
                          lead.lastAccessAt || lead.createdAt,
                        ).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                    </div>
                  </div>

                  {/* Seletor de Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted">
                      Estágio comercial:
                    </span>
                    <select
                      value={lead.status || "NOVO"}
                      disabled={isSaving}
                      onChange={(e) =>
                        handleUpdateStatus(lead.id, e.target.value)
                      }
                      className="h-8 px-2.5 rounded-xl bg-support border border-brand text-brand text-xs font-bold focus:outline-none"
                    >
                      {LEAD_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Observações */}
                  {isEditingNote ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={2}
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Anotações comerciais sobre este lead..."
                        className="w-full p-2.5 rounded-xl bg-surface border border-brand text-xs text-ink focus:outline-none resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingNotesId(null)}
                          className="px-2.5 py-1 rounded-lg border border-line bg-surface text-xs text-muted hover:text-ink"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveNotes(lead.id)}
                          className="px-3 py-1 rounded-lg bg-brand text-on-brand text-xs font-bold hover:bg-brand-hover flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} /> Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNotesId(lead.id);
                        setNotesDraft(lead.notes || "");
                      }}
                      className="text-left p-2.5 rounded-xl bg-surface/50 hover:bg-support/50 border border-line text-xs text-muted transition flex items-start gap-2"
                    >
                      <FileText size={13} className="text-brand shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {lead.notes || "Clique para adicionar observação comercial..."}
                      </span>
                    </button>
                  )}
                </div>

                {/* Ações do Lead */}
                <div className="flex items-center gap-2 pt-2 border-t border-line">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-9 rounded-xl bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <MessageCircle size={14} />
                    <span>Chamar no WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleDeleteLead(lead)}
                    className="h-9 w-9 rounded-xl border border-line bg-surface hover:bg-support text-muted hover:text-brand flex items-center justify-center transition"
                    title="Excluir lead"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default LeadsPanel;
