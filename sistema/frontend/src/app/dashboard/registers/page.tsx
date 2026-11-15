"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Search,
  RefreshCw,
  FileSpreadsheet,
  HandCoins,
  Wallet,
  Scale,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CloseRegisterModal } from '@/components/CloseRegisterModal';
import { PdvLojistaLoader, RetailDatePicker } from '@/components/ui';
import { OperatorInlineBadge } from '@/components/EntityPhotos';
import {
  StoreModuleHeader,
  StoreKpiCard,
  formatBrl,
} from '@/components/analytics/StoreAnalyticsUI';

type CashRegisterRow = {
  id: string;
  userId?: string;
  operator?: { id: string; name: string; imageUrl?: string | null; isManager?: boolean };
  code?: number;
  openingTime: string;
  closingTime?: string | null;
  openingValue: number;
  closingValue?: number | null;
  status: string;
  totalSales?: number;
  salesCount?: number;
  totalCashSales?: number;
  totalDigitalSales?: number;
  totalSuprimentos?: number;
  totalSangrias?: number;
  expectedCash?: number;
  diffCash?: number | null;
  closingDetails?: any;
};

type RegisterStatusFilter = 'all' | 'open' | 'pending' | 'divergent' | 'exact';

const spDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toSpIsoDay(isoTimestamp: string): string {
  const parts = spDayFormatter.formatToParts(new Date(isoTimestamp));
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function formatDateTimeBr(value?: string | null): string {
  if (!value) return '--';
  return new Date(value)
    .toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    .replace(',', ' ·');
}

function formatShiftDuration(start?: string, end?: string | null): string {
  if (!start) return '';
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffMin = Math.max(0, Math.round((endMs - startMs) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function CashRegistersHistoryPage() {
  const [registers, setRegisters] = useState<CashRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RegisterStatusFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchRegisters = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get(`/cash-registers?_t=${Date.now()}`);
      setRegisters(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar o histórico de caixas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRegisters(false);
  }, [fetchRegisters]);

  const handleModalClose = () => {
    setSelectedId(null);
    void fetchRegisters(true);
  };

  // Filtra por janela de datas (quando informada) antes de calcular contadores das pílulas
  const dateFilteredRegisters = useMemo(() => {
    return registers.filter((reg) => {
      if (!startDate && !endDate) return true;
      const openDay = toSpIsoDay(reg.openingTime);
      if (startDate && openDay < startDate) return false;
      if (endDate && openDay > endDate) return false;
      return true;
    });
  }, [registers, startDate, endDate]);

  const metrics = useMemo(() => {
    let openCount = 0;
    let openExpectedCash = 0;
    let pendingAuditCount = 0;
    let divergentCount = 0;
    let exactCount = 0;
    let totalSales = 0;
    let totalCashSales = 0;
    let totalDigitalSales = 0;
    let netDiffCash = 0;

    for (const reg of dateFilteredRegisters) {
      totalSales += Number(reg.totalSales || 0);
      totalCashSales += Number(reg.totalCashSales || 0);
      totalDigitalSales += Number(reg.totalDigitalSales || 0);

      if (reg.status === 'open') {
        openCount += 1;
        openExpectedCash += Number(reg.expectedCash ?? reg.openingValue ?? 0);
      } else if (reg.closingValue === null || reg.closingValue === undefined) {
        pendingAuditCount += 1;
      } else {
        const diff =
          typeof reg.diffCash === 'number'
            ? reg.diffCash
            : Number(reg.closingValue || 0) - Number(reg.expectedCash ?? reg.openingValue ?? 0);
        netDiffCash += diff;
        if (Math.abs(diff) >= 0.01) divergentCount += 1;
        else exactCount += 1;
      }
    }

    return {
      openCount,
      openExpectedCash,
      pendingAuditCount,
      divergentCount,
      exactCount,
      totalSales,
      totalCashSales,
      totalDigitalSales,
      netDiffCash: Number(netDiffCash.toFixed(2)),
    };
  }, [dateFilteredRegisters]);

  const filteredRegisters = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return dateFilteredRegisters.filter((reg) => {
      if (statusFilter === 'open' && reg.status !== 'open') return false;
      if (
        statusFilter === 'pending' &&
        !(reg.status !== 'open' && (reg.closingValue === null || reg.closingValue === undefined))
      )
        return false;
      if (statusFilter === 'divergent') {
        if (reg.status === 'open' || reg.closingValue === null || reg.closingValue === undefined)
          return false;
        const diff = Number(reg.diffCash ?? 0);
        if (Math.abs(diff) < 0.01) return false;
      }
      if (statusFilter === 'exact') {
        if (reg.status === 'open' || reg.closingValue === null || reg.closingValue === undefined)
          return false;
        const diff = Number(reg.diffCash ?? 0);
        if (Math.abs(diff) >= 0.01) return false;
      }

      if (q) {
        const opName = (reg.operator?.name || 'Administrador').toLowerCase();
        const codeStr = reg.code != null ? `#${reg.code}` : '';
        const rawCode = reg.code != null ? String(reg.code) : '';
        if (
          !opName.includes(q) &&
          !codeStr.includes(q) &&
          !rawCode.includes(q) &&
          !reg.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [dateFilteredRegisters, statusFilter, searchTerm]);

  const handleExportExcel = () => {
    if (filteredRegisters.length === 0) {
      toast.error('Nenhum turno encontrado para exportar com os filtros atuais.');
      return;
    }
    try {
      const rows = filteredRegisters.map((reg) => {
        const statusLabel =
          reg.status === 'open'
            ? 'Aberto'
            : reg.closingValue == null
              ? 'Pendente de Auditoria'
              : 'Auditado / Fechado';
        return {
          Caixa: reg.code != null ? `#${reg.code}` : reg.id.slice(0, 8),
          Status: statusLabel,
          Operador: reg.operator?.name || 'Administrador',
          Abertura: formatDateTimeBr(reg.openingTime),
          Fechamento: formatDateTimeBr(reg.closingTime),
          'Fundo Inicial (R$)': Number(Number(reg.openingValue || 0).toFixed(2)),
          'Vendas Totais (R$)': Number(Number(reg.totalSales || 0).toFixed(2)),
          'Vendas Dinheiro (R$)': Number(Number(reg.totalCashSales || 0).toFixed(2)),
          'Vendas Digitais (R$)': Number(Number(reg.totalDigitalSales || 0).toFixed(2)),
          'Gaveta Esperada (R$)': Number(Number(reg.expectedCash || 0).toFixed(2)),
          'Gaveta Declarada (R$)':
            reg.closingValue != null ? Number(Number(reg.closingValue).toFixed(2)) : '',
          'Diferença de Gaveta (R$)':
            typeof reg.diffCash === 'number' ? Number(reg.diffCash.toFixed(2)) : '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoria de Caixas');
      XLSX.writeFile(wb, `Auditoria_Caixas_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Planilha de auditoria exportada com sucesso!');
    } catch (err: any) {
      toast.error('Falha ao exportar Excel: ' + (err?.message || 'Erro desconhecido'));
    }
  };

  if (loading) {
    return (
      <div className="retail-loader-region py-16 flex items-center justify-center">
        <PdvLojistaLoader mode="loader" size={64} label="Carregando histórico e auditoria de caixas…" />
      </div>
    );
  }

  const cashSharePct =
    metrics.totalSales > 0 ? (metrics.totalCashSales / metrics.totalSales) * 100 : 0;

  return (
    <div className="space-y-6 pb-8">
      <StoreModuleHeader
        title="Histórico e Auditoria de Caixas"
        subtitle="Acompanhe turnos abertos, fechamentos cegos pendentes e conferência exata de valores em gaveta."
        actions={
          <>
            <button
              type="button"
              onClick={() => void fetchRegisters(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-brand' : 'text-brand'} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-support border border-brand text-brand hover:bg-brand hover:text-on-brand text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              Exportar Excel
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold transition-colors"
            >
              <HandCoins size={14} />
              Ir ao caixa
            </Link>
          </>
        }
      />

      {/* 4 KPIs de Auditoria (clicáveis para filtrar a listagem!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StoreKpiCard
          emphasis={metrics.openCount > 0 ? 'primary' : 'default'}
          active={statusFilter === 'open'}
          onClick={() => setStatusFilter((cur) => (cur === 'open' ? 'all' : 'open'))}
          label="Turnos Abertos Agora"
          value={
            <span>
              {metrics.openCount}{' '}
              <span className="text-sm font-semibold text-muted">
                {metrics.openCount === 1 ? 'turno ativo' : 'turnos ativos'}
              </span>
            </span>
          }
          icon={<CheckCircle2 size={17} />}
          subtitle={
            metrics.openCount > 0 ? (
              <span>
                Dinheiro esperado em gaveta:{' '}
                <strong className="text-ink tabular-nums">
                  {formatBrl(metrics.openExpectedCash)}
                </strong>
              </span>
            ) : (
              <span>Clique para filtrar turnos em atendimento</span>
            )
          }
        />

        <StoreKpiCard
          emphasis={metrics.pendingAuditCount > 0 ? 'contrast' : 'default'}
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter((cur) => (cur === 'pending' ? 'all' : 'pending'))}
          label="Pendentes de Auditoria"
          value={
            <span>
              {metrics.pendingAuditCount}{' '}
              <span className="text-sm font-semibold text-muted">
                {metrics.pendingAuditCount === 1 ? 'fechamento cego' : 'fechamentos cegos'}
              </span>
            </span>
          }
          icon={<Clock size={17} />}
          badge={
            metrics.pendingAuditCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-support text-brand border border-brand">
                Requer conferência do gestor
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-page text-muted border border-line">
                Tudo conferido
              </span>
            )
          }
          subtitle="Clique para listar turnos aguardando auditoria"
        />

        <StoreKpiCard
          label="Volume Movimentado nos Turnos"
          value={formatBrl(metrics.totalSales)}
          icon={<Wallet size={17} />}
          progressPct={cashSharePct}
          subtitle={
            <span className="tabular-nums">
              Espécie <strong className="text-ink">{formatBrl(metrics.totalCashSales)}</strong> ·
              Digital <strong className="text-ink">{formatBrl(metrics.totalDigitalSales)}</strong>
            </span>
          }
        />

        <StoreKpiCard
          emphasis={metrics.divergentCount > 0 ? 'contrast' : 'default'}
          active={statusFilter === 'divergent'}
          onClick={() => setStatusFilter((cur) => (cur === 'divergent' ? 'all' : 'divergent'))}
          label="Conferência de Gaveta"
          value={
            metrics.divergentCount === 0 ? (
              <span className="text-brand">Sem divergências</span>
            ) : (
              <span>
                {metrics.netDiffCash > 0 ? '+' : ''}
                {formatBrl(metrics.netDiffCash)}
              </span>
            )
          }
          icon={metrics.divergentCount > 0 ? <AlertTriangle size={17} /> : <Scale size={17} />}
          badge={
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-page text-ink border border-line tabular-nums">
              {metrics.exactCount} exato(s) · {metrics.divergentCount} com diferença
            </span>
          }
          subtitle="Clique para filtrar caixas com sobra ou falta"
        />
      </div>

      {/* Barra de Filtros, Busca e Datas */}
      <div className="bg-page border border-line rounded-xl p-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Buscar #caixa ou operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-1.5 text-xs text-ink focus:border-brand outline-none"
            />
          </div>

          <div
            className="inline-flex flex-wrap items-center bg-surface border border-line rounded-lg p-1 gap-1"
            role="group"
            aria-label="Filtrar por status do caixa"
          >
            {(
              [
                { id: 'all', label: `Todos (${dateFilteredRegisters.length})` },
                { id: 'open', label: `Abertos (${metrics.openCount})` },
                { id: 'pending', label: `Pendentes (${metrics.pendingAuditCount})` },
                { id: 'divergent', label: `Com diferença (${metrics.divergentCount})` },
                { id: 'exact', label: `Exatos (${metrics.exactCount})` },
              ] as const
            ).map((pill) => {
              const active = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand text-on-brand'
                      : 'text-muted hover:text-ink hover:bg-page'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Abertura:</span>
          <div className="w-[144px]">
            <RetailDatePicker
              value={startDate}
              onValueChange={setStartDate}
              rangeStart={startDate || undefined}
              rangeEnd={endDate || undefined}
              max={endDate || undefined}
              placeholder="Data inicial"
              aria-label="Filtrar abertura a partir de"
            />
          </div>
          <span className="text-xs text-muted">até</span>
          <div className="w-[144px]">
            <RetailDatePicker
              value={endDate}
              onValueChange={setEndDate}
              rangeStart={startDate || undefined}
              rangeEnd={endDate || undefined}
              min={startDate || undefined}
              placeholder="Data final"
              aria-label="Filtrar abertura até"
            />
          </div>
          {(startDate || endDate || searchTerm || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface border border-line text-xs font-semibold text-muted hover:text-ink hover:border-brand transition-colors cursor-pointer"
            >
              <X size={13} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela Desktop + Cards Mobile em superfície branca autêntica */}
      <section className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line bg-page text-muted text-[11px] uppercase tracking-wider">
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold">Caixa & Operador</th>
                <th className="px-5 py-3.5 font-semibold">Período do Turno</th>
                <th className="px-5 py-3.5 font-semibold text-right">Fundo & Mov.</th>
                <th className="px-5 py-3.5 font-semibold text-right">Faturamento</th>
                <th className="px-5 py-3.5 font-semibold text-right">Conferência de Gaveta</th>
                <th className="px-5 py-3.5 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRegisters.map((reg) => {
                const isOpen = reg.status === 'open';
                const isPendingAudit =
                  !isOpen && (reg.closingValue === null || reg.closingValue === undefined);
                const diff = typeof reg.diffCash === 'number' ? reg.diffCash : null;
                const duration = formatShiftDuration(reg.openingTime, reg.closingTime);

                return (
                  <tr
                    key={reg.id}
                    className="hover:bg-page transition-colors"
                  >
                    <td className="px-5 py-4 whitespace-nowrap">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand text-on-brand text-[11px] font-bold tracking-wide">
                          <CheckCircle2 size={13} />
                          ABERTO
                        </span>
                      ) : isPendingAudit ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-support text-brand border border-brand text-[11px] font-bold tracking-wide">
                          <Clock size={13} />
                          PENDENTE DE AUDITORIA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-page text-muted border border-line text-[11px] font-bold tracking-wide">
                          <ShieldCheck size={13} className="text-brand" />
                          AUDITADO
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-ink tabular-nums">
                          #{reg.code ?? '--'}
                        </strong>
                        <OperatorInlineBadge
                          name={reg.operator?.name || 'Administrador'}
                          operatorId={reg.operator?.id || reg.userId}
                          imageUrl={reg.operator?.imageUrl}
                          size="sm"
                        />
                      </div>
                      <span className="text-[11px] text-muted tabular-nums block mt-0.5">
                        {reg.salesCount ?? 0}{' '}
                        {(reg.salesCount ?? 0) === 1 ? 'venda registrada' : 'vendas registradas'}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                      <div className="text-ink font-medium tabular-nums">
                        {formatDateTimeBr(reg.openingTime)}
                      </div>
                      <div className="text-muted text-[11px] tabular-nums mt-0.5">
                        {isOpen
                          ? `Em andamento (${duration})`
                          : `Fechou ${formatDateTimeBr(reg.closingTime)} (${duration})`}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right tabular-nums">
                      <div className="text-xs font-bold text-ink">
                        {formatBrl(reg.openingValue)}
                      </div>
                      {(Number(reg.totalSuprimentos || 0) > 0 ||
                        Number(reg.totalSangrias || 0) > 0) ? (
                        <div className="text-[11px] text-muted mt-0.5">
                          {Number(reg.totalSuprimentos || 0) > 0 && (
                            <span className="mr-1.5">
                              +Sup {formatBrl(reg.totalSuprimentos)}
                            </span>
                          )}
                          {Number(reg.totalSangrias || 0) > 0 && (
                            <span>-Sang {formatBrl(reg.totalSangrias)}</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted mt-0.5">Sem sangria/supr.</div>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right tabular-nums">
                      <strong className="text-sm font-bold text-brand block">
                        {formatBrl(reg.totalSales || 0)}
                      </strong>
                      <span className="text-[11px] text-muted block mt-0.5">
                        Esp. {formatBrl(reg.totalCashSales || 0)} · Dig.{' '}
                        {formatBrl(reg.totalDigitalSales || 0)}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right tabular-nums">
                      {isOpen ? (
                        <div>
                          <span className="text-xs font-semibold text-ink block">
                            Esperado: {formatBrl(reg.expectedCash ?? reg.openingValue)}
                          </span>
                          <span className="text-[11px] text-muted">Gaveta em operação</span>
                        </div>
                      ) : isPendingAudit ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-support text-brand border border-brand text-[11px] font-semibold">
                            Aguardando conferência
                          </span>
                          <span className="text-[11px] text-muted block mt-0.5">
                            Esperado: {formatBrl(reg.expectedCash ?? reg.openingValue)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold text-ink">
                            Declarado: {formatBrl(reg.closingValue)}
                          </span>
                          {diff === null || Math.abs(diff) < 0.01 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-support text-brand border border-brand text-[11px] font-semibold">
                              <CheckCircle2 size={11} /> Gaveta exata
                            </span>
                          ) : diff < 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-ink text-on-brand text-[11px] font-bold">
                              <AlertTriangle size={11} /> Falta {formatBrl(diff)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-page text-ink border border-ink text-[11px] font-bold">
                              <ArrowUpRight size={11} /> Sobra +{formatBrl(diff)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(reg.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          isPendingAudit
                            ? 'bg-brand hover:bg-brand-hover text-on-brand'
                            : isOpen
                              ? 'bg-support border border-brand text-brand hover:bg-brand hover:text-on-brand'
                              : 'bg-surface border border-line text-ink hover:bg-support hover:border-brand'
                        }`}
                      >
                        <FileText size={14} />
                        {isOpen
                          ? 'Conferir / Fechar'
                          : isPendingAudit
                            ? 'Auditar agora'
                            : 'Ver extrato'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredRegisters.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <p className="text-sm font-semibold text-ink">
                      Nenhum turno encontrado com os filtros selecionados
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Ajuste os filtros de status, operador ou intervalo de abertura acima.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Visualização Mobile (Cards Ricos) */}
        <div className="md:hidden divide-y divide-line">
          {filteredRegisters.map((reg) => {
            const isOpen = reg.status === 'open';
            const isPendingAudit =
              !isOpen && (reg.closingValue === null || reg.closingValue === undefined);
            const diff = typeof reg.diffCash === 'number' ? reg.diffCash : null;

            return (
              <div key={reg.id} className="p-4 space-y-3 bg-surface">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm font-bold text-ink tabular-nums">
                        Caixa #{reg.code ?? '--'}
                      </strong>
                      <OperatorInlineBadge
                        name={reg.operator?.name || 'Administrador'}
                        operatorId={reg.operator?.id || reg.userId}
                        imageUrl={reg.operator?.imageUrl}
                        size="xs"
                      />
                    </div>
                    <span className="text-[11px] text-muted block tabular-nums mt-0.5">
                      {formatDateTimeBr(reg.openingTime)} · {reg.salesCount ?? 0} vendas
                    </span>
                  </div>
                  {isOpen ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand text-on-brand text-[10px] font-bold">
                      <CheckCircle2 size={11} /> ABERTO
                    </span>
                  ) : isPendingAudit ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-support text-brand border border-brand text-[10px] font-bold">
                      <Clock size={11} /> PENDENTE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-page text-muted border border-line text-[10px] font-bold">
                      <ShieldCheck size={11} className="text-brand" /> AUDITADO
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-page border border-line text-xs tabular-nums">
                  <div>
                    <span className="text-[11px] text-muted block">Fundo inicial</span>
                    <strong className="text-ink font-bold">{formatBrl(reg.openingValue)}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Vendas no turno</span>
                    <strong className="text-brand font-bold">{formatBrl(reg.totalSales)}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Gaveta esperada</span>
                    <strong className="text-ink font-semibold">
                      {formatBrl(reg.expectedCash ?? reg.openingValue)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted block">Resultado auditoria</span>
                    {isOpen ? (
                      <span className="text-muted font-medium">Em aberto</span>
                    ) : isPendingAudit ? (
                      <span className="text-brand font-bold">Pendente</span>
                    ) : diff === null || Math.abs(diff) < 0.01 ? (
                      <span className="text-brand font-bold">Gaveta exata</span>
                    ) : diff < 0 ? (
                      <span className="text-ink font-bold">Falta {formatBrl(diff)}</span>
                    ) : (
                      <span className="text-ink font-bold">Sobra +{formatBrl(diff)}</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedId(reg.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      isPendingAudit
                        ? 'bg-brand text-on-brand'
                        : 'bg-support border border-brand text-brand'
                    }`}
                  >
                    <FileText size={14} />
                    {isOpen
                      ? 'Conferir / Fechar Caixa'
                      : isPendingAudit
                        ? 'Auditar Caixa'
                        : 'Ver Extrato Completo'}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredRegisters.length === 0 && (
            <div className="p-10 text-center text-xs text-muted">
              Nenhum turno encontrado com os filtros selecionados.
            </div>
          )}
        </div>
      </section>

      <CloseRegisterModal
        isOpen={!!selectedId}
        registerId={selectedId || ''}
        onClose={handleModalClose}
        isAdminView={true}
      />
    </div>
  );
}
