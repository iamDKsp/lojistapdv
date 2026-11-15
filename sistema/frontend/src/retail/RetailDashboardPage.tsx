import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Receipt,
  ShoppingBag,
  RotateCcw,
  RefreshCw,
  HandCoins,
  History,
  BarChart3,
  HardDrive,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { api } from '@/lib/api';
import PdvLojistaLoader from '@/components/PdvLojistaLoader';
import {
  StoreModuleHeader,
  StorePeriodFilterBar,
  StoreKpiCard,
  BrandChartTooltip,
  ProductThumb,
  getSaoPauloPresetRange,
  formatBrl,
  formatCompactBrl,
  formatIsoDateBr,
  calcDeltaPct,
  type StorePeriodPreset,
} from '@/components/analytics/StoreAnalyticsUI';
import { apiError } from './types';

interface OverviewGroupRow {
  id: string;
  name: string;
  quantity: number;
  revenue?: number;
  imageUrl?: string | null;
  priceSell?: number | null;
}

interface OverviewDailyPoint {
  date: string;
  label: string;
  revenue: number;
  returns: number;
  net: number;
  transactions: number;
}

interface OverviewResponse {
  startDate: string;
  endDate: string;
  revenue: number;
  returns: number;
  netMerchandise: number;
  transactions: number;
  pieces: number;
  avgTicket?: number;
  pa?: number;
  returnRatePct?: number;
  outstandingCredits: number;
  openRegisters: number;
  previousPeriod?: {
    startDate: string;
    endDate: string;
    revenue: number;
    returns: number;
    netMerchandise: number;
    transactions: number;
    pieces: number;
    avgTicket: number;
    pa: number;
  };
  dailySeries?: OverviewDailyPoint[];
  topGroups: OverviewGroupRow[];
}

export function RetailDashboardPage() {
  const initialRange = useMemo(() => getSaoPauloPresetRange('month'), []);
  const [preset, setPreset] = useState<StorePeriodPreset>('month');
  const [start, setStart] = useState(initialRange.startDate);
  const [end, setEnd] = useState(initialRange.endDate);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const handleSelectPreset = (nextPreset: StorePeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      const range = getSaoPauloPresetRange(nextPreset);
      setStart(range.startDate);
      setEnd(range.endDate);
    }
  };

  const handleChangeRange = (nextStart: string, nextEnd: string) => {
    setPreset('custom');
    setStart(nextStart);
    setEnd(nextEnd);
  };

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/retail/overview', {
          params: { startDate: start, endDate: end },
          signal,
        });
        if (!signal?.aborted) setData(res.data);
      } catch (err) {
        if (!signal?.aborted) setError(apiError(err));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [start, end],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const avgTicket = useMemo(() => {
    if (!data) return 0;
    if (typeof data.avgTicket === 'number') return data.avgTicket;
    return data.transactions > 0 ? data.revenue / data.transactions : 0;
  }, [data]);

  const pa = useMemo(() => {
    if (!data) return 0;
    if (typeof data.pa === 'number') return data.pa;
    return data.transactions > 0 ? data.pieces / data.transactions : 0;
  }, [data]);

  const returnRatePct = useMemo(() => {
    if (!data) return 0;
    if (typeof data.returnRatePct === 'number') return data.returnRatePct;
    return data.revenue > 0 ? (data.returns / data.revenue) * 100 : 0;
  }, [data]);

  const chartSeries = useMemo(() => {
    if (!data?.dailySeries?.length) return [];
    return data.dailySeries.map((pt) => ({
      ...pt,
      fullLabel: formatIsoDateBr(pt.date),
      value: pt.revenue,
    }));
  }, [data]);

  const chartStats = useMemo(() => {
    if (!chartSeries.length) return { peakDay: null as OverviewDailyPoint | null, dailyAvg: 0 };
    let peak: OverviewDailyPoint | null = null;
    let sum = 0;
    for (const pt of chartSeries) {
      sum += pt.revenue;
      if (pt.revenue > 0 && (!peak || pt.revenue > peak.revenue)) {
        peak = pt;
      }
    }
    return {
      peakDay: peak,
      dailyAvg: chartSeries.length > 0 ? sum / chartSeries.length : 0,
    };
  }, [chartSeries]);

  const maxGroupQty = useMemo(() => {
    if (!data?.topGroups?.length) return 1;
    return Math.max(1, ...data.topGroups.map((g) => g.quantity));
  }, [data]);

  return (
    <div className="space-y-6 pb-8">
      <StoreModuleHeader
        title="Visão Geral da Loja"
        subtitle="Acompanhamento executivo de vendas, trocas, ticket médio e giro dos grupos de mercadoria no fuso de São Paulo."
        badge={
          data ? (
            data.openRegisters > 0 ? (
              <Link
                to="/inicio/historico-de-caixas"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-support border border-brand text-brand text-[11px] font-bold tracking-wide hover:bg-brand hover:text-on-brand transition-colors"
              >
                <CheckCircle2 size={12} />
                {data.openRegisters}{' '}
                {data.openRegisters === 1 ? 'caixa aberto agora' : 'caixas abertos agora'}
              </Link>
            ) : (
              <Link
                to="/inicio/historico-de-caixas"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-page border border-line text-muted text-[11px] font-semibold hover:border-brand hover:text-ink transition-colors"
              >
                <Clock size={12} />
                Nenhum caixa aberto agora
              </Link>
            )
          ) : undefined
        }
        actions={
          <>
            <Link
              to="/inicio/relatorios"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors"
            >
              <BarChart3 size={15} className="text-brand" />
              Relatórios de vendas
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold transition-colors"
            >
              <HandCoins size={15} />
              Abrir frente de caixa
            </Link>
          </>
        }
      />

      <StorePeriodFilterBar
        preset={preset}
        startDate={start}
        endDate={end}
        presets={[
          { id: 'today', label: 'Hoje' },
          { id: 'yesterday', label: 'Ontem' },
          { id: 'last7', label: '7 dias' },
          { id: 'month', label: 'Este mês' },
          { id: 'custom', label: 'Personalizado' },
        ]}
        alwaysShowDateInputs
        onSelectPreset={handleSelectPreset}
        onChangeRange={handleChangeRange}
        rightSlot={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-brand' : 'text-brand'} />
            Atualizar
          </button>
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-brand bg-support p-4 text-xs font-medium text-ink flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-brand text-on-brand font-bold cursor-pointer shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="retail-loader-region py-16 flex items-center justify-center" role="status" aria-busy="true">
          <PdvLojistaLoader mode="loader" size={76} label="Carregando visão geral da loja…" />
        </div>
      ) : (
        data && (
          <>
            {/* 4 KPIs Principais do Varejo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StoreKpiCard
                emphasis="primary"
                label="Faturamento Líquido (Vendas − Trocas)"
                value={formatBrl(data.netMerchandise)}
                icon={<TrendingUp size={17} />}
                deltaPct={calcDeltaPct(
                  data.netMerchandise,
                  data.previousPeriod?.netMerchandise ?? 0,
                )}
                subtitle={
                  <span>
                    Bruto <strong className="text-ink">{formatBrl(data.revenue)}</strong> · Trocas{' '}
                    <strong className="text-ink">{formatBrl(data.returns)}</strong>
                  </span>
                }
              />

              <StoreKpiCard
                label="Ticket Médio da Loja"
                value={formatBrl(avgTicket)}
                icon={<Receipt size={17} />}
                deltaPct={calcDeltaPct(avgTicket, data.previousPeriod?.avgTicket ?? 0)}
                subtitle={
                  <span>
                    Em <strong className="text-ink">{data.transactions}</strong>{' '}
                    {data.transactions === 1 ? 'venda concluída' : 'vendas concluídas'}
                  </span>
                }
              />

              <StoreKpiCard
                label="PA · Peças por Atendimento"
                value={pa.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                icon={<ShoppingBag size={17} />}
                deltaPct={calcDeltaPct(pa, data.previousPeriod?.pa ?? 0)}
                subtitle={
                  <span>
                    Total de <strong className="text-ink">{data.pieces}</strong>{' '}
                    {data.pieces === 1 ? 'peça vendida' : 'peças vendidas'} no período
                  </span>
                }
              />

              <StoreKpiCard
                label="Trocas & Vale-Trocas Ativos"
                value={formatBrl(data.outstandingCredits)}
                icon={<RotateCcw size={17} />}
                badge={
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-page text-muted border border-line tabular-nums">
                    Trocas no período: {formatBrl(data.returns)} ({returnRatePct.toFixed(1)}%)
                  </span>
                }
                subtitle={
                  <span className="inline-flex items-center justify-between w-full gap-2">
                    <span>Crédito disponível em mãos de clientes</span>
                    <Link
                      to="/clientes/trocas"
                      className="text-brand font-semibold hover:underline inline-flex items-center gap-0.5"
                    >
                      Consultar <ArrowRight size={12} />
                    </Link>
                  </span>
                }
              />
            </div>

            {/* Grade Principal: Evolução Diária + Ranking de Grupos com Foto */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Gráfico de Evolução Diária */}
              <section className="lg:col-span-7 bg-surface border border-line rounded-xl p-5 flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-base font-bold text-ink flex items-center gap-2">
                      <BarChart3 size={18} className="text-brand" />
                      Ritmo Diário · Vendas e Trocas
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Todos os dias do intervalo selecionado, inclusive dias sem movimento.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-page border border-line text-ink font-medium">
                      <span className="w-2.5 h-2.5 rounded-xs bg-brand" />
                      Vendas brutas
                    </span>
                    {data.returns > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-page border border-line text-ink font-medium">
                        <span className="w-2.5 h-2.5 rounded-xs bg-ink" />
                        Trocas
                      </span>
                    )}
                    {chartStats.peakDay && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-support border border-brand text-brand font-semibold tabular-nums">
                        <Sparkles size={11} />
                        Pico {chartStats.peakDay.label}: {formatBrl(chartStats.peakDay.revenue)}
                      </span>
                    )}
                  </div>
                </div>

                {data.transactions === 0 && data.returns === 0 ? (
                  <div className="h-[260px] rounded-xl bg-page border border-line flex flex-col items-center justify-center text-center px-6">
                    <div className="w-11 h-11 rounded-full bg-support text-brand flex items-center justify-center mb-3">
                      <BarChart3 size={20} />
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      Nenhuma venda ou troca neste intervalo
                    </p>
                    <p className="text-xs text-muted mt-1 max-w-[36ch]">
                      Selecione outro período acima ou abra a frente de caixa para iniciar os atendimentos do dia.
                    </p>
                  </div>
                ) : (
                  <div className="h-[272px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartSeries}
                        margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="#E5E1ED"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          stroke="#665F70"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={14}
                        />
                        <YAxis
                          stroke="#665F70"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatCompactBrl}
                        />
                        <Tooltip
                          cursor={{ fill: '#F3E8FF' }}
                          content={<BrandChartTooltip />}
                        />
                        {chartStats.dailyAvg > 0 && chartSeries.length > 1 && (
                          <ReferenceLine
                            y={chartStats.dailyAvg}
                            stroke="#6D28D9"
                            strokeDasharray="4 4"
                            strokeWidth={1.2}
                          />
                        )}
                        <Bar
                          dataKey="revenue"
                          name="Vendas concluídas"
                          fill="#7C3AED"
                          maxBarSize={32}
                          radius={[6, 6, 0, 0]}
                        />
                        {data.returns > 0 && (
                          <Line
                            type="monotone"
                            dataKey="returns"
                            name="Trocas registradas"
                            stroke="#272321"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#272321', strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: '#272321' }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    Média diária no intervalo:{' '}
                    <strong className="text-ink tabular-nums">
                      {formatBrl(chartStats.dailyAvg)}
                    </strong>
                  </span>
                  <span>
                    Nota: Vendas menos trocas não representam lucro contábil nem saldo físico em gaveta.
                  </span>
                </div>
              </section>

              {/* Ranking de Grupos com Foto Compartilhada */}
              <section className="lg:col-span-5 bg-surface border border-line rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-ink flex items-center gap-2">
                        <ShoppingBag size={18} className="text-brand" />
                        Grupos Campeões de Giro
                      </h2>
                      <p className="text-xs text-muted mt-0.5">
                        Tamanhos e cores consolidados no grupo da mercadoria.
                      </p>
                    </div>
                    <Link
                      to="/estoque"
                      className="text-xs font-semibold text-brand hover:underline shrink-0 inline-flex items-center gap-1"
                    >
                      Estoque <ArrowRight size={12} />
                    </Link>
                  </div>

                  {data.topGroups.length > 0 ? (
                    <div className="space-y-3">
                      {data.topGroups.slice(0, 6).map((group, idx) => {
                        const widthPct = (group.quantity / maxGroupQty) * 100;
                        const sharePiecesPct =
                          data.pieces > 0 ? (group.quantity / data.pieces) * 100 : 0;
                        return (
                          <div
                            key={group.id}
                            className="p-2.5 rounded-xl border border-line bg-page hover:bg-surface transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums ${
                                  idx === 0
                                    ? 'bg-brand text-on-brand'
                                    : idx < 3
                                      ? 'bg-support text-brand border border-brand'
                                      : 'bg-surface text-muted border border-line'
                                }`}
                              >
                                {idx + 1}º
                              </span>

                              <ProductThumb
                                imageUrl={group.imageUrl}
                                alt={group.name}
                                size={38}
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <strong className="text-xs font-bold text-ink truncate">
                                    {group.name}
                                  </strong>
                                  <span className="text-xs font-bold text-brand tabular-nums shrink-0">
                                    {group.quantity}{' '}
                                    {group.quantity === 1 ? 'peça' : 'peças'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-[11px] text-muted mt-0.5 tabular-nums">
                                  <span>
                                    {typeof group.revenue === 'number' && group.revenue > 0
                                      ? formatBrl(group.revenue)
                                      : group.priceSell
                                        ? `Preço ${formatBrl(group.priceSell)}`
                                        : 'Grupo consolidado'}
                                  </span>
                                  <span>{sharePiecesPct.toFixed(0)}% das peças</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 h-1.5 w-full rounded-full bg-support overflow-hidden">
                              <div
                                className="h-full rounded-full bg-brand transition-all duration-300"
                                style={{ width: `${Math.max(4, widthPct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 px-4 rounded-xl bg-page border border-line text-center">
                      <p className="text-sm font-semibold text-ink">
                        Nenhuma mercadoria vendida neste período
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Os grupos mais vendidos com suas fotos e quantidades aparecerão aqui.
                      </p>
                    </div>
                  )}
                </div>

                {data.topGroups.length > 6 && (
                  <div className="pt-3 mt-3 border-t border-line text-right">
                    <Link
                      to="/inicio/relatorios"
                      className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
                    >
                      Ver todos os {data.topGroups.length} grupos vendidos{' '}
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </section>
            </div>

            {/* Faixa de Atalhos Rápidos das Abas do Módulo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to="/inicio/historico-de-caixas"
                className="group bg-surface border border-line hover:border-brand rounded-xl p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-support text-brand flex items-center justify-center shrink-0">
                    <History size={18} />
                  </span>
                  <div className="min-w-0">
                    <strong className="text-xs font-bold text-ink block truncate">
                      Histórico e Auditoria de Caixas
                    </strong>
                    <span className="text-[11px] text-muted block truncate">
                      {data.openRegisters > 0
                        ? `${data.openRegisters} turno(s) aberto(s) · conferir gavetas`
                        : 'Conferir turnos fechados, sobras e quebras'}
                    </span>
                  </div>
                </div>
                <ArrowRight
                  size={15}
                  className="text-muted group-hover:text-brand shrink-0 transition-colors"
                />
              </Link>

              <Link
                to="/inicio/relatorios"
                className="group bg-surface border border-line hover:border-brand rounded-xl p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-support text-brand flex items-center justify-center shrink-0">
                    <BarChart3 size={18} />
                  </span>
                  <div className="min-w-0">
                    <strong className="text-xs font-bold text-ink block truncate">
                      Relatórios de Vendas & NFC-e
                    </strong>
                    <span className="text-[11px] text-muted block truncate">
                      Mix de pagamentos, horário de pico, PDF e Excel
                    </span>
                  </div>
                </div>
                <ArrowRight
                  size={15}
                  className="text-muted group-hover:text-brand shrink-0 transition-colors"
                />
              </Link>

              <Link
                to="/inicio/operacoes"
                className="group bg-surface border border-line hover:border-brand rounded-xl p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-lg bg-support text-brand flex items-center justify-center shrink-0">
                    <HardDrive size={18} />
                  </span>
                  <div className="min-w-0">
                    <strong className="text-xs font-bold text-ink block truncate">
                      Operações Locais do Terminal
                    </strong>
                    <span className="text-[11px] text-muted block truncate">
                      Diagnóstico offline, catálogo em cache e fila de envio
                    </span>
                  </div>
                </div>
                <ArrowRight
                  size={15}
                  className="text-muted group-hover:text-brand shrink-0 transition-colors"
                />
              </Link>
            </div>
          </>
        )
      )}
    </div>
  );
}
