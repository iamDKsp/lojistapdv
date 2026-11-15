import React, { useState, useMemo } from 'react';
import {
  X,
  TrendingUp,
  DollarSign,
  CreditCard,
  Package,
  Search,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import {
  formatBrl,
  formatIsoDateBr,
  getPaymentMethodLabel,
  PaymentMethodIcon,
  ProductThumb,
} from '@/components/analytics/StoreAnalyticsUI';

type ProductSold = {
  productId?: string;
  name: string;
  groupName?: string | null;
  size?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  qty: number;
  revenue: number;
};

type SummaryData = {
  currentRegister: any;
  today: any;
  week: any;
  month: any;
  period: {
    revenue: number;
    transactions: number;
    pieces?: number;
    pa?: number;
    avgTicket: number;
    totalDiscount?: number;
    byPaymentMethod: Record<string, number>;
    byHour: Record<number, number>;
    topProducts: any[];
    productsSold?: ProductSold[];
  };
};

interface PeriodReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  summary: SummaryData | null;
}

export function PeriodReportModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  summary,
}: PeriodReportModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'qty' | 'revenue'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'name' | 'qty' | 'revenue') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const processedProducts = useMemo(() => {
    let list = [...(summary?.period?.productsSold || [])];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => {
        const name = (p?.name || 'Desconhecido').toLowerCase();
        const size = (p?.size || '').toLowerCase();
        const color = (p?.color || '').toLowerCase();
        return name.includes(q) || size.includes(q) || color.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sortField === 'name') {
        const valA = a.name || '';
        const valB = b.name || '';
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      const numA = Number(a[sortField]) || 0;
      const numB = Number(b[sortField]) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });

    return list;
  }, [summary, searchQuery, sortField, sortDirection]);

  if (!isOpen) return null;

  const totalRevenue = summary?.period?.revenue || 0;
  const totalPieces =
    summary?.period?.pieces ??
    (summary?.period?.productsSold || []).reduce((acc, p) => acc + Number(p.qty || 0), 0);
  const pa =
    summary?.period?.pa ??
    ((summary?.period?.transactions || 0) > 0
      ? totalPieces / (summary?.period?.transactions || 1)
      : 0);

  const sortedPayments = Object.entries(summary?.period?.byPaymentMethod || {})
    .filter(([, val]) => Number(val) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Relatório consolidado do período"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/50 p-4"
    >
      <div className="bg-surface border border-line rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-line bg-surface">
          <div>
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-ink">
              <TrendingUp size={20} className="text-brand" />
              Relatório Consolidado do Período
            </h2>
            <p className="text-xs text-muted mt-0.5 tabular-nums">
              Intervalo analisado: {formatIsoDateBr(startDate)} até {formatIsoDateBr(endDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar relatório"
            className="text-muted hover:text-ink transition rounded-lg hover:bg-page p-2 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 bg-surface">
          {/* 4 KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-page border border-line p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-support rounded-lg text-brand shrink-0">
                <DollarSign size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-muted uppercase font-semibold block">
                  Total Faturado
                </span>
                <span className="text-base md:text-lg font-bold text-ink tabular-nums truncate block">
                  {formatBrl(totalRevenue)}
                </span>
              </div>
            </div>

            <div className="bg-page border border-line p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-support rounded-lg text-brand shrink-0">
                <TrendingUp size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-muted uppercase font-semibold block">
                  Ticket Médio
                </span>
                <span className="text-base md:text-lg font-bold text-ink tabular-nums truncate block">
                  {formatBrl(summary?.period?.avgTicket || 0)}
                </span>
              </div>
            </div>

            <div className="bg-page border border-line p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-support rounded-lg text-brand shrink-0">
                <Receipt size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-muted uppercase font-semibold block">
                  Atendimentos
                </span>
                <span className="text-base md:text-lg font-bold text-ink tabular-nums block">
                  {summary?.period?.transactions || 0} vendas
                </span>
              </div>
            </div>

            <div className="bg-page border border-line p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-support rounded-lg text-brand shrink-0">
                <ShoppingBag size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-muted uppercase font-semibold block">
                  Giro & PA
                </span>
                <span className="text-base md:text-lg font-bold text-ink tabular-nums block">
                  {totalPieces} pçs · PA {pa.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Entradas por Meio de Pagamento */}
          <div className="bg-surface border border-line p-4 md:p-5 rounded-xl space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <CreditCard size={15} className="text-brand" />
              Fluxo de Entrada por Meio de Pagamento
            </h3>

            {sortedPayments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedPayments.map(([method, value]) => {
                  const valNum = Number(value) || 0;
                  const pct = totalRevenue > 0 ? (valNum / totalRevenue) * 100 : 0;
                  return (
                    <div
                      key={method}
                      className="space-y-1.5 bg-page border border-line p-3 rounded-lg"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-ink inline-flex items-center gap-1.5">
                          <PaymentMethodIcon method={method} size={14} className="text-brand" />
                          {getPaymentMethodLabel(method)}
                        </span>
                        <span className="text-ink font-bold tabular-nums">
                          {formatBrl(valNum)}{' '}
                          <span className="text-brand">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-support rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full"
                          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted text-center py-4">
                Sem movimentações financeiras registradas neste intervalo.
              </p>
            )}
          </div>

          {/* Mercadorias Vendidas no Período */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <Package size={15} className="text-brand" />
                Mercadorias Comercializadas ({processedProducts.length})
              </h3>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Filtrar mercadoria, tamanho, cor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface border border-line text-ink rounded-lg pl-9 pr-3 py-1.5 text-xs focus:border-brand outline-none"
                />
              </div>
            </div>

            <div className="border border-line rounded-xl overflow-y-auto overflow-x-auto bg-surface max-h-[300px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-page border-b border-line text-muted font-semibold uppercase tracking-wider select-none">
                    <th
                      onClick={() => handleSort('name')}
                      className="p-3 cursor-pointer hover:text-ink transition-colors"
                    >
                      Mercadoria / Grade{' '}
                      {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('qty')}
                      className="p-3 text-center w-28 cursor-pointer hover:text-ink transition-colors"
                    >
                      Peças {sortField === 'qty' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th
                      onClick={() => handleSort('revenue')}
                      className="p-3 text-right w-36 cursor-pointer hover:text-ink transition-colors"
                    >
                      Receita{' '}
                      {sortField === 'revenue' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {processedProducts.map((p, idx) => (
                    <tr key={p.productId || idx} className="hover:bg-page transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb
                            imageUrl={p.imageUrl}
                            alt={p.name || 'Mercadoria'}
                            size={32}
                          />
                          <div className="min-w-0">
                            <strong className="font-semibold text-ink block truncate">
                              {p.name || 'Desconhecido'}
                            </strong>
                            {(p.size || p.color) && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {p.size && (
                                  <span className="px-1.5 py-0.2 rounded bg-support text-brand font-semibold text-[10px]">
                                    Tam {p.size}
                                  </span>
                                )}
                                {p.color && (
                                  <span className="px-1.5 py-0.2 rounded bg-page border border-line text-muted font-medium text-[10px]">
                                    {p.color}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-ink tabular-nums">
                        {p.qty || 0}
                      </td>
                      <td className="p-3 text-right font-bold text-brand tabular-nums">
                        {formatBrl(p.revenue || 0)}
                      </td>
                    </tr>
                  ))}
                  {processedProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted">
                        Nenhuma mercadoria encontrada no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-page flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand font-bold transition text-xs cursor-pointer"
          >
            Fechar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}
