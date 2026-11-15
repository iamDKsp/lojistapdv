import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wifi,
  WifiOff,
  UploadCloud,
  ShieldCheck,
  AlertTriangle,
  Database,
  RefreshCw,
  HandCoins,
  UserCheck,
  Clock,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useShift } from '@/contexts/ShiftContext';
import {
  getCachedProducts,
  getPendingSales,
  getReviewSales,
  getTenantPendingAndReviewSales,
  getDeviceSyncDiagnostics,
  markSaleSynced,
  markSaleReview,
  type OfflineSale,
} from '@/lib/db';
import { sendCheckout } from '@/lib/checkout-api';
import { withSaleOperationLock } from '@/lib/sale-operation-lock';
import PdvLojistaLoader from '@/components/PdvLojistaLoader';
import {
  OperatorAvatarThumb,
  OperatorInlineBadge,
  StockItemThumb,
} from '@/components/EntityPhotos';
import {
  StoreModuleHeader,
  StoreKpiCard,
  formatBrl,
  getPaymentMethodLabel,
} from '@/components/analytics/StoreAnalyticsUI';
import { apiError } from './types';

export function RetailOperationsPage() {
  const user = useAuthStore((state) => state.user);
  const shift = useShift();

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [rows, setRows] = useState<OfflineSale[]>([]);
  const [cachedProductImageMap, setCachedProductImageMap] = useState<
    Map<string, string>
  >(() => new Map());
  const [diagnostics, setDiagnostics] = useState<{
    cachedProductsCount: number;
    lastCatalogSyncAt: number | null;
    syncedTodayCount: number;
    totalSyncedCount: number;
  }>({
    cachedProductsCount: 0,
    lastCatalogSyncAt: null,
    syncedTodayCount: 0,
    totalSyncedCount: 0,
  });
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'review'>('all');

  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'superadmin' ||
    user?.role === 'group_owner';

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const load = useCallback(async () => {
    const tenantId = user?.tenant;
    if (!tenantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const diagPromise = getDeviceSyncDiagnostics(tenantId);
      let salesList: OfflineSale[] = [];

      if (isAdmin) {
        salesList = await getTenantPendingAndReviewSales(tenantId);
      } else if (shift.operator?.id) {
        const [pending, review] = await Promise.all([
          getPendingSales(tenantId, shift.operator.id),
          getReviewSales(tenantId, shift.operator.id),
        ]);
        salesList = [...pending, ...review];
      }

      const [diag, cachedProds] = await Promise.all([
        diagPromise,
        getCachedProducts(tenantId).catch(() => []),
      ]);
      const imgMap = new Map<string, string>();
      for (const p of cachedProds) {
        const url =
          (p as any).imageUrl || (p as any).retailGroup?.imageUrl || null;
        if (p.id && url) {
          imgMap.set(p.id, url);
        }
      }
      setCachedProductImageMap(imgMap);
      setRows(salesList);
      setDiagnostics(diag);
      setLastCheckedAt(new Date());
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [user?.tenant, isAdmin, shift.operator?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const operatorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const op of shift.operators || []) {
      map.set(op.id, op.name);
    }
    if (shift.operator) {
      map.set(shift.operator.id, shift.operator.name);
    }
    return map;
  }, [shift.operators, shift.operator]);

  const operatorImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const op of shift.operators || []) {
      if (op.imageUrl) map.set(op.id, op.imageUrl);
    }
    if (shift.operator?.imageUrl) {
      map.set(shift.operator.id, shift.operator.imageUrl);
    }
    return map;
  }, [shift.operators, shift.operator]);

  const { pendingRows, reviewRows, pendingTotalBrl, reviewTotalBrl } = useMemo(() => {
    const pending: OfflineSale[] = [];
    const review: OfflineSale[] = [];
    let pSum = 0;
    let rSum = 0;
    for (const r of rows) {
      if (r.syncStatus === 'REVIEW') {
        review.push(r);
        rSum += Number(r.total || 0);
      } else {
        pending.push(r);
        pSum += Number(r.total || 0);
      }
    }
    return {
      pendingRows: pending,
      reviewRows: review,
      pendingTotalBrl: pSum,
      reviewTotalBrl: rSum,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (filterTab === 'pending') return pendingRows;
    if (filterTab === 'review') return reviewRows;
    return rows;
  }, [rows, pendingRows, reviewRows, filterTab]);

  async function retry(row: OfflineSale) {
    if (
      shift.needsOperatorReauth ||
      row.operatorId !== shift.operator?.id ||
      !row.rawPayload ||
      !navigator.onLine
    ) {
      const targetName = operatorNameMap.get(row.operatorId) || 'operador da venda';
      setError(
        `Identifique ${targetName} com PIN na frente de caixa e garanta conexão ativa para recuperar esta operação.`,
      );
      return;
    }
    setBusy(row.localId);
    setError('');
    try {
      await withSaleOperationLock(row.tenantId, row.localId, async () => {
        const res = await sendCheckout(
          row.rawPayload,
          row.tenantId,
          row.operatorId,
        );
        await markSaleSynced(row.localId, res.data.id, row.tenantId);
      });
      await load();
    } catch (err: any) {
      setError(apiError(err));
      if (
        err?.response?.status >= 400 &&
        err.response.status < 500 &&
        ![401, 429].includes(err.response.status)
      ) {
        await markSaleReview(row.localId, row.tenantId, apiError(err));
      }
      await load();
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <StoreModuleHeader
        title="Operações Locais deste Dispositivo"
        subtitle="Monitoramento da fila de contingência offline, integridade do catálogo local e recuperação segura com chave de idempotência."
        badge={
          isOnline ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-support border border-brand text-brand text-[11px] font-bold">
              <Wifi size={12} />
              Terminal Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink text-on-brand text-[11px] font-bold">
              <WifiOff size={12} />
              Modo Offline em Contingência
            </span>
          )
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-brand' : 'text-brand'} />
              Verificar agora
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold transition-colors"
            >
              <HandCoins size={14} />
              Abrir frente de caixa
            </Link>
          </>
        }
      />

      {/* 4 KPIs de Diagnóstico do Dispositivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StoreKpiCard
          emphasis={isOnline ? 'primary' : 'contrast'}
          label="Conectividade do Terminal"
          value={isOnline ? 'Conectado' : 'Sem Internet'}
          icon={isOnline ? <Wifi size={17} /> : <WifiOff size={17} />}
          subtitle={
            <span className="tabular-nums">
              Última verificação às{' '}
              <strong className="text-ink">
                {lastCheckedAt.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </strong>
            </span>
          }
        />

        <StoreKpiCard
          emphasis={pendingRows.length > 0 ? 'primary' : 'default'}
          active={filterTab === 'pending'}
          onClick={
            rows.length > 0
              ? () => setFilterTab((cur) => (cur === 'pending' ? 'all' : 'pending'))
              : undefined
          }
          label="Fila Pendente de Envio"
          value={
            <span>
              {pendingRows.length}{' '}
              <span className="text-sm font-semibold text-muted">
                {pendingRows.length === 1 ? 'operação' : 'operações'}
              </span>
            </span>
          }
          icon={<UploadCloud size={17} />}
          subtitle={
            pendingRows.length > 0 ? (
              <span>
                Total retido:{' '}
                <strong className="text-brand tabular-nums">
                  {formatBrl(pendingTotalBrl)}
                </strong>
              </span>
            ) : (
              <span>Nenhuma venda aguardando sincronização</span>
            )
          }
        />

        <StoreKpiCard
          emphasis={reviewRows.length > 0 ? 'contrast' : 'default'}
          active={filterTab === 'review'}
          onClick={
            rows.length > 0
              ? () => setFilterTab((cur) => (cur === 'review' ? 'all' : 'review'))
              : undefined
          }
          label="Para Conferência Manual"
          value={
            <span>
              {reviewRows.length}{' '}
              <span className="text-sm font-semibold text-muted">
                {reviewRows.length === 1 ? 'registro' : 'registros'}
              </span>
            </span>
          }
          icon={reviewRows.length > 0 ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
          subtitle={
            reviewRows.length > 0 ? (
              <span>
                Valor em revisão:{' '}
                <strong className="text-ink tabular-nums">
                  {formatBrl(reviewTotalBrl)}
                </strong>
              </span>
            ) : (
              <span>Zero conflitos de estoque ou validação</span>
            )
          }
        />

        <StoreKpiCard
          label="Catálogo Offline & Operador"
          value={
            <span>
              {diagnostics.cachedProductsCount}{' '}
              <span className="text-sm font-semibold text-muted">itens locais</span>
            </span>
          }
          icon={<Database size={17} />}
          badge={
            shift.operator && !shift.needsOperatorReauth ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-support border border-brand text-[11px] font-semibold text-brand">
                <OperatorAvatarThumb
                  name={shift.operator.name}
                  imageUrl={shift.operator.imageUrl}
                  operatorId={shift.operator.id}
                  size="xs"
                />
                <span>{shift.operator.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-page border border-line text-[11px] font-medium text-muted">
                <Lock size={11} />
                PIN não autenticado
              </span>
            )
          }
          subtitle={
            diagnostics.lastCatalogSyncAt ? (
              <span className="tabular-nums">
                Cache atualizado em{' '}
                {new Date(diagnostics.lastCatalogSyncAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            ) : (
              <span>Abra o PDV para salvar o catálogo neste navegador</span>
            )
          }
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-brand bg-support p-4 text-xs font-medium text-ink flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="px-2.5 py-1 rounded bg-surface border border-brand text-brand font-bold cursor-pointer"
          >
            Entendi
          </button>
        </div>
      )}

      {/* Aviso de Identificação por PIN quando há pendências ou quando não é Admin */}
      {(rows.length > 0 || !isAdmin) && (!shift.operator || shift.needsOperatorReauth) && (
        <div className="bg-page border border-line rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg bg-support text-brand flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={16} />
            </span>
            <div>
              <strong className="text-xs font-bold text-ink block">
                Autenticação por PIN necessária para reenvio manual
              </strong>
              <p className="text-xs text-muted mt-0.5">
                {isAdmin
                  ? 'Como administrador você visualiza todas as operações retidas neste terminal. Para reenviar um pedido recusado, identifique o operador titular com PIN na frente de caixa.'
                  : 'Abra a frente de caixa e digite seu PIN de operador para consultar e recuperar suas operações locais.'}
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-support border border-brand text-brand hover:bg-brand hover:text-on-brand text-xs font-bold transition-colors"
          >
            <UserCheck size={14} />
            Identificar PIN no caixa
          </Link>
        </div>
      )}

      {loading ? (
        <div className="retail-loader-region py-14 flex items-center justify-center">
          <PdvLojistaLoader mode="loader" size={56} label="Inspecionando banco local do terminal…" />
        </div>
      ) : rows.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex bg-page border border-line p-1 rounded-lg gap-1">
              {(
                [
                  { id: 'all', label: `Todas (${rows.length})` },
                  { id: 'pending', label: `Pendentes (${pendingRows.length})` },
                  { id: 'review', label: `Conferência (${reviewRows.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    filterTab === tab.id
                      ? 'bg-brand text-on-brand'
                      : 'text-muted hover:text-ink hover:bg-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">
              A recuperação reutiliza o mesmo identificador local, impedindo cobrança ou baixa dupla.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleRows.map((row) => {
              const isReview = row.syncStatus === 'REVIEW';
              const opName = operatorNameMap.get(row.operatorId) || 'Operador registrado';
              const canRetryNow =
                !shift.needsOperatorReauth &&
                shift.operator?.id === row.operatorId &&
                Boolean(row.rawPayload) &&
                isOnline;

              return (
                <article
                  key={row.localId}
                  className={`rounded-xl border p-5 bg-surface flex flex-col justify-between gap-4 ${
                    isReview ? 'border-ink' : 'border-brand'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="text-xl font-bold text-ink tabular-nums block">
                          {formatBrl(row.total)}
                        </strong>
                        <span className="text-[11px] text-muted tabular-nums block mt-0.5">
                          {new Date(row.createdAt).toLocaleString('pt-BR')} · ID{' '}
                          <code className="font-mono">{row.localId.slice(0, 10)}</code>
                        </span>
                      </div>

                      {isReview ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink text-on-brand text-[11px] font-bold">
                          <AlertTriangle size={12} />
                          Conferir recusa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-support border border-brand text-brand text-[11px] font-bold">
                          <Clock size={12} />
                          Pendente de envio
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <OperatorInlineBadge
                        size="xs"
                        variant="pill"
                        label="Operador:"
                        name={row.operatorName || opName}
                        imageUrl={
                          row.operatorImageUrl ||
                          operatorImageMap.get(row.operatorId)
                        }
                        operatorId={row.operatorId}
                      />
                      {row.payments?.map((p, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-page border border-line text-muted font-medium"
                        >
                          {p.label || getPaymentMethodLabel(p.method)} ({formatBrl(p.value)})
                        </span>
                      ))}
                    </div>

                    <div className="p-3 rounded-lg bg-page border border-line space-y-1.5">
                      {row.items.map((item, iIdx) => (
                        <div
                          key={`${item.productId}-${iIdx}`}
                          className="flex items-center justify-between gap-2 text-xs tabular-nums"
                        >
                          <span className="inline-flex items-center gap-2 text-ink font-medium min-w-0">
                            <StockItemThumb
                              size="xs"
                              name={item.productName}
                              imageUrl={
                                item.imageUrl ||
                                cachedProductImageMap.get(item.productId)
                              }
                              product={item}
                            />
                            <span className="truncate">
                              <strong className="text-brand">{item.quantity}×</strong>{' '}
                              {item.productName}
                            </span>
                          </span>
                          <span className="text-muted shrink-0">
                            {formatBrl(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {row.syncError && (
                      <div className="p-3 rounded-lg bg-support border border-brand text-xs text-ink">
                        <strong className="font-bold text-brand block mb-0.5">
                          Diagnóstico do servidor:
                        </strong>
                        {row.syncError}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
                    {!canRetryNow ? (
                      <span className="text-[11px] text-muted">
                        {!isOnline
                          ? 'Aguardando conexão com a internet…'
                          : `Requer PIN de ${opName} no caixa`}
                      </span>
                    ) : (
                      <span className="text-[11px] text-brand font-semibold">
                        Pronto para recuperação idempotente
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={Boolean(busy) || !canRetryNow}
                      onClick={() => void retry(row)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold disabled:opacity-45 transition-colors cursor-pointer"
                    >
                      {busy === row.localId ? (
                        <>
                          <PdvLojistaLoader
                            mode="loader"
                            compact
                            size={14}
                            label="Sincronizando operação"
                          />
                          <span>Recuperando…</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={14} />
                          <span>Recuperar esta operação</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        /* Estado Vazio Ilustrativo & Tranquilizador para o Lojista */
        <section className="bg-surface border border-line rounded-2xl p-6 md:p-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-support border border-brand text-brand flex items-center justify-center mx-auto">
              <ShieldCheck size={28} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-ink">
                Terminal sincronizado · nenhuma pendência local
              </h2>
              <p className="text-xs md:text-sm text-muted mt-1 leading-relaxed">
                Todas as vendas realizadas neste computador/dispositivo já foram confirmadas no servidor da loja.
                {diagnostics.totalSyncedCount > 0 && (
                  <>
                    {' '}
                    Histórico local já recuperou{' '}
                    <strong className="text-ink tabular-nums">
                      {diagnostics.totalSyncedCount}{' '}
                      {diagnostics.totalSyncedCount === 1
                        ? 'operação de contingência'
                        : 'operações de contingência'}
                    </strong>
                    {diagnostics.syncedTodayCount > 0
                      ? ` (${diagnostics.syncedTodayCount} hoje)`
                      : ''}
                    .
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left pt-2">
              <div className="p-3.5 rounded-xl bg-page border border-line">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink mb-1">
                  <CheckCircle2 size={14} className="text-brand shrink-0" />
                  Proteção contra Quedas
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Se a internet oscilar no balcão, a venda é gravada localmente com foto fiscal congelada.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-page border border-line">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink mb-1">
                  <CheckCircle2 size={14} className="text-brand shrink-0" />
                  Zero Duplicidade
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Cada venda carrega uma chave única de idempotência que impede baixar o estoque duas vezes.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-page border border-line">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink mb-1">
                  <CheckCircle2 size={14} className="text-brand shrink-0" />
                  Auditoria por Operador
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Caso haja conflito de estoque, o registro fica retido aqui para conferência segura da gerência.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
