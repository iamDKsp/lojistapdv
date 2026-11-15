"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  CreditCard,
  Banknote,
  Search,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileText,
  FileSpreadsheet,
  ShoppingBag,
  Percent,
  Sparkles,
  AlertTriangle,
  Eye,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ReemitNfceModal } from '@/components/ReemitNfceModal';
import { PeriodReportModal } from '@/components/PeriodReportModal';
import { PdvLojistaLoader, RetailSelect } from '@/components/ui';
import {
  StoreModuleHeader,
  StorePeriodFilterBar,
  StoreKpiCard,
  BrandChartTooltip,
  PaymentMixDonut,
  ProductThumb,
  getSaoPauloPresetRange,
  getPaymentMethodLabel,
  formatBrl,
  formatCompactBrl,
  formatIsoDateBr,
  type StorePeriodPreset,
} from '@/components/analytics/StoreAnalyticsUI';

type RegisterSummary = {
  cashRegisterId: string;
  code?: number;
  operatorName: string;
  operatorId: string;
  openedAt: string;
  openingValue: number;
  total: number;
  salesCount: number;
};

type ProductStat = {
  productId?: string;
  name: string;
  groupName?: string | null;
  size?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  qty: number;
  revenue: number;
  pct?: number;
};

type SummaryData = {
  openRegisters: RegisterSummary[];
  currentRegister: RegisterSummary | null;
  today: { revenue: number; transactions: number };
  week: { revenue: number; vsLastWeek: number | null };
  month: { revenue: number };
  period: {
    revenue: number;
    transactions: number;
    pieces?: number;
    pa?: number;
    avgTicket: number;
    maxTicket?: number;
    totalDiscount?: number;
    discountRatePct?: number;
    identifiedSalesCount?: number;
    previousPeriod?: {
      startDate: string;
      endDate: string;
      revenue: number;
      transactions: number;
      avgTicket: number;
      vsPreviousPct: number | null;
    };
    byPaymentMethod: Record<string, number>;
    countByPaymentMethod?: Record<string, number>;
    byHour: Record<number, number>;
    countByHour?: Record<number, number>;
    byDay?: Record<string, number>;
    countByDay?: Record<string, number>;
    byWeek?: Record<string, number>;
    countByWeek?: Record<string, number>;
    byMonth?: Record<string, number>;
    countByMonth?: Record<string, number>;
    topProducts: ProductStat[];
    productsSold?: ProductStat[];
  };
  alerts?: {
    overduePayables: Array<{ id: string; description: string; amount: string; dueDate: string }>;
    upcomingPayables: Array<{ id: string; description: string; amount: string; dueDate: string }>;
  };
};

type SaleItem = {
  id: string;
  quantity: number;
  priceUnit: number;
  discount?: number;
  subtotal: number;
  productName?: string;
  product: {
    id?: string;
    name: string;
    size?: string | null;
    color?: string | null;
    imageUrl?: string | null;
  };
};

type Payment = {
  method: string;
  label?: string;
  value: number;
  troco?: number;
};

type Sale = {
  id: string;
  code?: number | null;
  subtotal: number;
  discount: number;
  status: string;
  cancelReason?: string | null;
  operator?: { name: string } | null;
  customer?: { name: string; phone?: string } | null;
  consumidorCpf?: string | null;
  consumidorNome?: string | null;
  total: number;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
  emitirNfce: boolean;
  nfceStatus: string | null;
  nfceNumero: number | null;
  nfceSerie?: number | null;
  nfceChave?: string | null;
  nfceCodRejeicao?: string | null;
  nfceMotivoRejeicao?: string | null;
  operatorId?: string;
  cashRegisterId?: string;
};

class ErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/80 p-4"
        >
          <div className="bg-surface border border-brand rounded-2xl w-full max-w-lg overflow-hidden p-6 space-y-4">
            <h2 className="text-lg font-bold text-brand">Falha ao Renderizar Modal</h2>
            <div className="p-4 bg-support border border-brand rounded-xl space-y-2 font-mono text-[11px] text-muted max-h-60 overflow-auto">
              <p className="font-bold text-brand">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              <pre className="whitespace-pre-wrap">{this.state.error?.stack}</pre>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-surface hover:bg-support text-ink rounded-xl transition text-xs font-semibold border border-line cursor-pointer"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SalesDashboard() {
  const initialRange = useMemo(() => getSaoPauloPresetRange('month'), []);
  const [preset, setPreset] = useState<StorePeriodPreset>('month');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [chartGrouping, setChartGrouping] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [isReemitModalOpen, setIsReemitModalOpen] = useState(false);
  const [saleToReemit, setSaleToReemit] = useState<Sale | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [tenantConfig, setTenantConfig] = useState<any>(null);

  // Ranking toggle: Receita ou Peças
  const [rankingMetric, setRankingMetric] = useState<'revenue' | 'qty'>('revenue');

  // Filtros e paginação da listagem de vendas
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('todos');
  const [filterNfce, setFilterNfce] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<'recentes' | 'maior_valor'>('recentes');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modal de cancelamento de venda
  const [cancelSaleTarget, setCancelSaleTarget] = useState<Sale | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancellingSale, setCancellingSale] = useState(false);

  useEffect(() => {
    api
      .get(`/tenants/me?_t=${Date.now()}`)
      .then((res) => setTenantConfig(res.data))
      .catch(console.error);
  }, []);

  const handleSelectPreset = (nextPreset: StorePeriodPreset) => {
    setPreset(nextPreset);
    setCurrentPage(1);
    if (nextPreset !== 'custom') {
      const range = getSaoPauloPresetRange(nextPreset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      if (nextPreset === 'today' || nextPreset === 'yesterday') {
        setChartGrouping('hour');
      } else {
        setChartGrouping('day');
      }
    }
  };

  const handleChangeRange = (nextStart: string, nextEnd: string) => {
    setPreset('custom');
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setCurrentPage(1);
    setChartGrouping(nextStart === nextEnd ? 'hour' : 'day');
  };

  const fetchDashboardData = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const [sumRes, salesRes] = await Promise.all([
          api.get(`/dashboard/summary?startDate=${startDate}&endDate=${endDate}`),
          api.get(`/sales?startDate=${startDate}&endDate=${endDate}&limit=250`),
        ]);
        setSummary(sumRes.data);
        setSales(salesRes.data?.data || []);
      } catch (error) {
        console.error('Erro ao buscar dados do relatório de vendas', error);
        if (!silent) {
          toast.error('Erro ao carregar dados do relatório. Tente novamente.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    void fetchDashboardData(false);

    const intervalId = setInterval(() => {
      void fetchDashboardData(true);
    }, 60000);

    const pendingInterval = setInterval(() => {
      setSales((current) => {
        const hasPending = current.some(
          (s) => s.nfceStatus === 'pendente' || s.nfceStatus === 'em_processamento',
        );
        if (hasPending) {
          void fetchDashboardData(true);
        }
        return current;
      });
    }, 5000);

    return () => {
      clearInterval(intervalId);
      clearInterval(pendingInterval);
    };
  }, [fetchDashboardData]);

  const handleEmitNfce = async (
    saleId: string,
    forceNewNumber: boolean,
    manualNumber?: number,
  ) => {
    setEmittingId(saleId);
    try {
      await api.post(`/sales/${saleId}/emit-nfce`, { forceNewNumber, manualNumber });
      toast.success('Emissão de NFC-e solicitada com sucesso!');
      void fetchDashboardData(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Erro ao emitir NFC-e';
      toast.error(msg);
    } finally {
      setEmittingId(null);
    }
  };

  const triggerEmitNfce = (sale: Sale) => {
    if (sale.nfceStatus === 'rejeitada') {
      setSaleToReemit(sale);
      setIsReemitModalOpen(true);
    } else {
      void handleEmitNfce(sale.id, false);
    }
  };

  const handleCancelSale = (sale: Sale) => {
    setCancelSaleTarget(sale);
    setCancelReasonInput('');
  };

  const confirmCancelSale = async () => {
    if (!cancelSaleTarget) return;
    const reason = cancelReasonInput.trim();
    if (reason.length < 15) {
      toast.error('O motivo deve ter pelo menos 15 caracteres.');
      return;
    }

    setCancellingSale(true);
    try {
      if (cancelSaleTarget.nfceStatus === 'autorizada') {
        await api.post(`/v1/fiscal/nfce/${cancelSaleTarget.id}/cancelar`, { motivo: reason });
      }
      await api.post(`/sales/${cancelSaleTarget.id}/cancel`, { reason });

      toast.success('Venda cancelada com sucesso!');
      if (selectedSaleDetail?.id === cancelSaleTarget.id) {
        setSelectedSaleDetail(null);
      }
      setCancelSaleTarget(null);
      setCancelReasonInput('');
      void fetchDashboardData(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Erro ao cancelar venda.';
      toast.error(msg);
    } finally {
      setCancellingSale(false);
    }
  };

  const handleReemitConfirm = async (forceNewNumber: boolean, manualNumber?: number) => {
    if (saleToReemit) {
      await handleEmitNfce(saleToReemit.id, forceNewNumber, manualNumber);
    }
  };

  // ── Impressão de cupom térmico 80mm ─────────────────────────────────────
  const printReceipt = (sale: Sale) => {
    const saleDate = new Date(sale.createdAt);
    const dateStr = saleDate.toLocaleDateString('pt-BR');
    const timeStr = saleDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const companyName = tenantConfig?.name || tenantConfig?.razaoSocial || 'Estabelecimento';
    const cnpj = tenantConfig?.cnpj || '';
    const address = tenantConfig?.address || tenantConfig?.endereco || '';
    const phone = tenantConfig?.phone || tenantConfig?.telefone || '';
    const footerMsg =
      tenantConfig?.receiptFooter || 'Obrigado pela preferência! Volte sempre!';
    const saleCodeStr = sale.code ? `#${sale.code}` : `#${sale.id.slice(0, 8)}`;

    const itemsHtml = sale.items
      .map((item, idx) => {
        const itemLabel = item.product?.name || item.productName || 'Mercadoria';
        const gradeSuffix = [
          item.product?.size ? `Tam ${item.product.size}` : '',
          item.product?.color || '',
        ]
          .filter(Boolean)
          .join(' · ');
        return `
      <div class="item">
        <div class="item-header">
          <span class="item-num">${String(idx + 1).padStart(2, '0')}</span>
          <span class="item-name">${itemLabel}${gradeSuffix ? ` (${gradeSuffix})` : ''}</span>
          <span class="item-total">R$ ${Number(item.subtotal || 0).toFixed(2)}</span>
        </div>
        <div class="item-detail">
          ${Number(item.quantity)} UN x R$ ${Number(item.priceUnit || 0).toFixed(2)}
        </div>
      </div>
    `;
      })
      .join('');

    const paymentsHtml = sale.payments
      .map(
        (p) => `
      <div class="payment-row">
        <span>${(p.label || getPaymentMethodLabel(p.method)).toUpperCase()}</span>
        <span>R$ ${Number(p.value || 0).toFixed(2)}</span>
      </div>
    `,
      )
      .join('');

    const subtotalVal = Number(sale.subtotal || sale.total || 0);
    const discountVal = Number(sale.discount || 0);
    const totalVal = Number(sale.total || 0);

    const receiptHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Cupom ${saleCodeStr}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 80mm auto; margin: 4mm 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 15px;
      font-weight: normal;
      width: 75mm;
      color: #272321;
      background: #FFFFFF;
      line-height: 1.4;
    }
    .divider { border-top: 1px dashed #272321; margin: 7px 0; }
    .header  { text-align: center; margin-bottom: 7px; }
    .header .company { font-size: 19px; font-weight: bold; text-transform: uppercase; line-height: 1.2; }
    .header .subtitle { font-size: 13px; font-weight: normal; margin-top: 2px; }
    .meta { display: flex; justify-content: space-between; font-size: 13.5px; margin: 4px 0; font-weight: normal; }
    .label-row { text-align: center; font-weight: bold; font-size: 16px; margin: 6px 0; letter-spacing: 1px; }
    .item { margin: 6px 0; }
    .item-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; }
    .item-num   { min-width: 24px; font-weight: bold; }
    .item-name  { flex: 1; margin: 0 5px; word-break: break-word; font-weight: bold; }
    .item-total { white-space: nowrap; font-weight: bold; }
    .item-detail { font-size: 13px; font-weight: normal; color: #272321; padding-left: 26px; margin-top: 2px; }
    .totals { margin-top: 6px; }
    .totals-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 15px; font-weight: normal; }
    .totals-row.grand { font-size: 19px; font-weight: bold; margin-top: 6px; }
    .payment-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 15px; font-weight: normal; }
    .footer { text-align: center; font-size: 13px; font-weight: normal; margin-top: 10px; line-height: 1.4; }
    @media print {
      html, body { width: 80mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">${companyName}</div>
    ${cnpj ? `<div class="subtitle">CNPJ: ${cnpj}</div>` : ''}
    ${address ? `<div class="subtitle">${address}</div>` : ''}
    ${phone ? `<div class="subtitle">Tel: ${phone}</div>` : ''}
  </div>
  <div class="divider"></div>
  <div class="label-row">REIMPRESSÃO DE CUPOM</div>
  <div class="meta"><span>${dateStr} ${timeStr}</span><span>Venda ${saleCodeStr}</span></div>
  <div class="meta"><span>Operador: ${sale.operator?.name || 'Operador'}</span></div>
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="totals">
    <div class="totals-row"><span>SUBTOTAL:</span><span>R$ ${subtotalVal.toFixed(2)}</span></div>
    ${discountVal > 0 ? `<div class="totals-row"><span>DESCONTO:</span><span>-R$ ${discountVal.toFixed(2)}</span></div>` : ''}
    <div class="totals-row grand"><span>TOTAL:</span><span>R$ ${totalVal.toFixed(2)}</span></div>
  </div>
  <div class="divider"></div>
  ${paymentsHtml}
  <div class="divider"></div>
  <div class="footer">${footerMsg}</div>
  <br/><br/>
</body>
</html>`;

    const printWin = window.open(
      '',
      '_blank',
      'width=340,height=600,toolbar=0,menubar=0,scrollbars=0',
    );
    if (!printWin) {
      toast.error('Popup bloqueado. Permita pop-ups para imprimir.');
      return;
    }
    printWin.document.open();
    printWin.document.write(receiptHtml);
    printWin.document.close();
    printWin.onload = () => {
      setTimeout(() => {
        printWin.print();
        setTimeout(() => printWin.close(), 800);
      }, 300);
    };
  };

  // ── Série do Gráfico Principal com Contagem e Rótulos Completos ────────
  const chartData = useMemo(() => {
    if (!summary?.period) return [];

    if (chartGrouping === 'hour') {
      const byHour = summary.period.byHour || {};
      const counts = summary.period.countByHour || {};
      const peak = Object.values(byHour).reduce((a, b) => Math.max(a, Number(b || 0)), 0);
      return Array.from({ length: 24 }, (_, h) => {
        const value = Number(byHour[h] || 0);
        return {
          name: `${String(h).padStart(2, '0')}h`,
          fullLabel: `Faixa das ${String(h).padStart(2, '0')}:00`,
          value,
          transactions: Number(counts[h] || 0),
          isPeak: value > 0 && value === peak,
        };
      });
    }

    if (chartGrouping === 'day') {
      const byDay = summary.period.byDay || {};
      const counts = summary.period.countByDay || {};
      const sortedKeys = Object.keys(byDay).sort();
      const peak = Object.values(byDay).reduce((a, b) => Math.max(a, Number(b || 0)), 0);
      return sortedKeys.map((key) => {
        const value = Number(byDay[key] || 0);
        return {
          name: formatIsoDateBr(key, true),
          fullLabel: formatIsoDateBr(key),
          value,
          transactions: Number(counts[key] || 0),
          isPeak: value > 0 && value === peak,
        };
      });
    }

    if (chartGrouping === 'week') {
      const byWeek = summary.period.byWeek || {};
      const counts = summary.period.countByWeek || {};
      const sortedKeys = Object.keys(byWeek).sort();
      const peak = Object.values(byWeek).reduce((a, b) => Math.max(a, Number(b || 0)), 0);
      return sortedKeys.map((key) => {
        const value = Number(byWeek[key] || 0);
        const label = `Sem. ${formatIsoDateBr(key, true)}`;
        return {
          name: label,
          fullLabel: `Semana iniciada em ${formatIsoDateBr(key)}`,
          value,
          transactions: Number(counts[key] || 0),
          isPeak: value > 0 && value === peak,
        };
      });
    }

    // month
    const byMonth = summary.period.byMonth || {};
    const counts = summary.period.countByMonth || {};
    const sortedKeys = Object.keys(byMonth).sort();
    const peak = Object.values(byMonth).reduce((a, b) => Math.max(a, Number(b || 0)), 0);
    const monthNames = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    return sortedKeys.map((key) => {
      const value = Number(byMonth[key] || 0);
      const parts = key.split('-');
      let label = key;
      if (parts.length === 2) {
        const mIdx = parseInt(parts[1], 10) - 1;
        label = `${monthNames[mIdx] || parts[1]}/${parts[0].slice(-2)}`;
      }
      return {
        name: label,
        fullLabel: `Mês ${label}`,
        value,
        transactions: Number(counts[key] || 0),
        isPeak: value > 0 && value === peak,
      };
    });
  }, [summary, chartGrouping]);

  const chartStats = useMemo(() => {
    let peakBucket: (typeof chartData)[number] | null = null;
    let sum = 0;
    let nonZeroCount = 0;
    for (const pt of chartData) {
      sum += pt.value;
      if (pt.value > 0) {
        nonZeroCount += 1;
        if (!peakBucket || pt.value > peakBucket.value) {
          peakBucket = pt;
        }
      }
    }
    return {
      peakBucket,
      hasData: nonZeroCount > 0,
      avgActive: nonZeroCount > 0 ? sum / nonZeroCount : 0,
    };
  }, [chartData]);

  // Ranking Top 8 ordenado por Receita ou Peças
  const rankedProducts = useMemo(() => {
    const source = summary?.period?.productsSold?.length
      ? summary.period.productsSold
      : summary?.period?.topProducts || [];
    const sorted = [...source].sort((a, b) =>
      rankingMetric === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty,
    );
    const maxVal = Math.max(
      1,
      ...sorted.slice(0, 8).map((p) => (rankingMetric === 'revenue' ? p.revenue : p.qty)),
    );
    const totRev = summary?.period?.revenue || 0;
    const totPieces =
      summary?.period?.pieces ||
      source.reduce((acc, item) => acc + Number(item.qty || 0), 0);

    return sorted.slice(0, 8).map((p) => ({
      ...p,
      barWidthPct:
        ((rankingMetric === 'revenue' ? p.revenue : p.qty) / maxVal) * 100,
      sharePct:
        rankingMetric === 'revenue'
          ? totRev > 0
            ? (p.revenue / totRev) * 100
            : 0
          : totPieces > 0
            ? (p.qty / totPieces) * 100
            : 0,
    }));
  }, [summary, rankingMetric]);

  // Filtragem da listagem de cupons (as datas já vêm filtradas do backend /sales?startDate=&endDate=)
  const filteredSales = useMemo(() => {
    let result = sales;

    if (filterPayment !== 'todos') {
      result = result.filter((s) =>
        s.payments.some((p) => {
          const m = (p.method || '').toLowerCase();
          const lbl = (p.label || '').toLowerCase();
          if (filterPayment === 'crediario') {
            return m === 'crediario' || m === 'fiado' || lbl.includes('credi');
          }
          if (filterPayment === 'credito_loja' || filterPayment === 'store_credit') {
            return (
              m === 'store_credit' ||
              m === 'credito_loja' ||
              lbl.includes('vale') ||
              lbl.includes('crédito da loja')
            );
          }
          return m === filterPayment.toLowerCase();
        }),
      );
    }

    if (filterNfce !== 'todas') {
      result = result.filter((s) => {
        if (filterNfce === 'canceladas') return s.status === 'cancelled';
        if (s.status === 'cancelled') return false;
        if (filterNfce === 'autorizadas') return s.nfceStatus === 'autorizada';
        if (filterNfce === 'rejeitadas') return s.nfceStatus === 'rejeitada';
        if (filterNfce === 'pendentes') {
          return !s.emitirNfce || !s.nfceStatus || s.nfceStatus === 'pendente';
        }
        return true;
      });
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.trim().toLowerCase();
      result = result.filter((s) => {
        const codeStr = s.code ? `#${s.code}` : '';
        const custName = (s.customer?.name || s.consumidorNome || '').toLowerCase();
        const opName = (s.operator?.name || '').toLowerCase();
        return (
          codeStr.includes(lower) ||
          String(s.code || '').includes(lower) ||
          s.total.toFixed(2).includes(lower) ||
          custName.includes(lower) ||
          opName.includes(lower) ||
          s.items.some((i) =>
            (i.product?.name || i.productName || '').toLowerCase().includes(lower),
          ) ||
          s.payments.some((p) =>
            (p.label || getPaymentMethodLabel(p.method)).toLowerCase().includes(lower),
          )
        );
      });
    }

    if (sortBy === 'maior_valor') {
      result = [...result].sort((a, b) => Number(b.total) - Number(a.total));
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return result;
  }, [sales, searchTerm, filterPayment, filterNfce, sortBy]);

  const handleExportSales = () => {
    try {
      if (filteredSales.length === 0) {
        toast.error('Não há vendas para exportar com os filtros atuais.');
        return;
      }

      const dataToExport = filteredSales.map((sale) => ({
        Cupom: sale.code ? `#${sale.code}` : sale.id.slice(0, 8),
        'Data/Hora': new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(sale.createdAt)),
        Operador: sale.operator?.name || 'Operador',
        Cliente: sale.customer?.name || sale.consumidorNome || 'Consumidor Final',
        Itens: sale.items
          .map((i) => `${Number(i.quantity)}x ${i.product?.name || i.productName || 'Mercadoria'}`)
          .join(', '),
        Pagamento: sale.payments
          .map(
            (p) =>
              `${p.label || getPaymentMethodLabel(p.method)} (R$ ${Number(p.value).toFixed(2)})`,
          )
          .join(', '),
        'Desconto (R$)': Number(Number(sale.discount || 0).toFixed(2)),
        'Total (R$)': Number(Number(sale.total || 0).toFixed(2)),
        'Status NFC-e': sale.nfceStatus || 'Não emitida',
        'Status Venda': sale.status === 'cancelled' ? 'Cancelada' : 'Concluída',
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório de Vendas');

      const fileName = `Relatorio_Vendas_${startDate}_a_${endDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Planilha Excel exportada com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao exportar Excel: ' + (err.message || 'Desconhecido'));
    }
  };

  const handleExportPDF = () => {
    try {
      if (filteredSales.length === 0) {
        toast.error('Não há vendas para exportar.');
        return;
      }
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(
        `Relatório de Vendas (${formatIsoDateBr(startDate)} a ${formatIsoDateBr(endDate)})`,
        14,
        18,
      );

      const tableData = filteredSales.map((sale) => [
        sale.code ? `#${sale.code}` : sale.id.slice(0, 6),
        new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(sale.createdAt)),
        sale.items
          .map((i) => `${Number(i.quantity)}x ${i.product?.name || i.productName || 'Item'}`)
          .join(', '),
        sale.payments.map((p) => p.label || getPaymentMethodLabel(p.method)).join(', '),
        sale.status === 'cancelled' ? 'Cancelada' : formatBrl(Number(sale.total)),
      ]);

      autoTable(doc, {
        startY: 24,
        head: [['Cupom', 'Data/Hora', 'Mercadorias', 'Pagamento', 'Total']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [124, 58, 237] },
      });

      doc.save(`Relatorio_Vendas_${startDate}_a_${endDate}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao exportar PDF: ' + (err.message || 'Desconhecido'));
    }
  };

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const currentSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (loading && !summary) {
    return (
      <div className="retail-loader-region py-16 flex items-center justify-center">
        <PdvLojistaLoader mode="loader" size={64} label="Carregando relatórios de vendas…" />
      </div>
    );
  }

  const totalPieces =
    summary?.period?.pieces ??
    (summary?.period?.productsSold || []).reduce((acc, p) => acc + Number(p.qty || 0), 0);
  const pa =
    summary?.period?.pa ??
    ((summary?.period?.transactions || 0) > 0
      ? totalPieces / (summary?.period?.transactions || 1)
      : 0);
  const openRegs = summary?.openRegisters || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho Unificado */}
      <StoreModuleHeader
        title="Relatórios de Vendas"
        subtitle="Análise comercial de faturamento, mix de recebimentos, giro de grade e auditoria de cupons e NFC-e."
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-support border border-brand text-brand hover:bg-brand hover:text-on-brand text-xs font-bold transition-colors cursor-pointer"
            >
              <TrendingUp size={14} />
              Resumo Consolidado
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors cursor-pointer"
              data-tooltip="Exportar listagem atual em PDF"
            >
              <FileText size={14} className="text-brand" />
              PDF
            </button>
            <button
              type="button"
              onClick={handleExportSales}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors cursor-pointer"
              data-tooltip="Exportar listagem atual em Excel"
            >
              <FileSpreadsheet size={14} className="text-brand" />
              Excel
            </button>
          </>
        }
      />

      {/* Barra Unificada de Período */}
      <StorePeriodFilterBar
        preset={preset}
        startDate={startDate}
        endDate={endDate}
        onSelectPreset={handleSelectPreset}
        onChangeRange={handleChangeRange}
        rightSlot={
          <button
            type="button"
            onClick={() => void fetchDashboardData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-ink hover:bg-support hover:border-brand text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-brand' : 'text-brand'} />
            Atualizar
          </button>
        }
      />

      {/* Alerta Financeiro de Contas a Pagar */}
      {summary?.alerts &&
        (summary.alerts.overduePayables.length > 0 ||
          summary.alerts.upcomingPayables.length > 0) && (
          <div className="bg-support border border-brand rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-surface border border-brand rounded-lg flex items-center justify-center shrink-0">
                <Banknote size={18} className="text-brand" />
              </div>
              <div>
                <h3 className="text-ink font-bold text-sm">Lembrete Financeiro · Contas a Pagar</h3>
                <p className="text-muted text-xs mt-0.5">
                  Você possui{' '}
                  {summary.alerts.overduePayables.length > 0 && (
                    <strong className="text-brand">
                      {summary.alerts.overduePayables.length} conta(s) vencida(s)
                    </strong>
                  )}
                  {summary.alerts.overduePayables.length > 0 &&
                    summary.alerts.upcomingPayables.length > 0 &&
                    ' e '}
                  {summary.alerts.upcomingPayables.length > 0 && (
                    <strong className="text-ink">
                      {summary.alerts.upcomingPayables.length} vencendo nos próximos 3 dias
                    </strong>
                  )}
                  .
                </p>
              </div>
            </div>
            <Link
              to="/financeiro/contas-a-pagar"
              className="shrink-0 bg-brand hover:bg-brand-hover text-on-brand font-bold py-2 px-3.5 rounded-lg transition text-xs"
            >
              Abrir Contas a Pagar
            </Link>
          </div>
        )}

      {/* 6 KPIs Comerciais Ilustrativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <StoreKpiCard
          emphasis="primary"
          label="Faturamento do Período"
          value={formatBrl(summary?.period?.revenue || 0)}
          icon={<TrendingUp size={16} />}
          deltaPct={summary?.period?.previousPeriod?.vsPreviousPct ?? null}
          subtitle={
            <span>
              Hoje:{' '}
              <strong className="text-ink tabular-nums">
                {formatBrl(summary?.today?.revenue || 0)}
              </strong>
            </span>
          }
        />

        <StoreKpiCard
          label="Volume Comercial"
          value={
            <span>
              {summary?.period?.transactions || 0}{' '}
              <span className="text-xs font-semibold text-muted">vendas</span>
            </span>
          }
          icon={<Receipt size={16} />}
          subtitle={
            <span>
              <strong className="text-ink tabular-nums">{totalPieces}</strong>{' '}
              {totalPieces === 1 ? 'peça vendida' : 'peças vendidas'}
            </span>
          }
        />

        <StoreKpiCard
          label="Ticket Médio"
          value={formatBrl(summary?.period?.avgTicket || 0)}
          icon={<CreditCard size={16} />}
          subtitle={
            <span>
              Maior cupom:{' '}
              <strong className="text-ink tabular-nums">
                {formatBrl(summary?.period?.maxTicket || 0)}
              </strong>
            </span>
          }
        />

        <StoreKpiCard
          label="PA · Peças / Venda"
          value={pa.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          icon={<ShoppingBag size={16} />}
          subtitle="Média de itens por atendimento"
        />

        <StoreKpiCard
          label="Descontos Aplicados"
          value={formatBrl(summary?.period?.totalDiscount || 0)}
          icon={<Percent size={16} />}
          badge={
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-page border border-line text-[10px] font-semibold text-muted tabular-nums">
              {(summary?.period?.discountRatePct || 0).toFixed(1)}% do potencial
            </span>
          }
          subtitle="Concedidos no balcão"
        />

        <StoreKpiCard
          label="Pico & Caixa Atual"
          value={
            chartStats.peakBucket ? (
              <span>{chartStats.peakBucket.name}</span>
            ) : openRegs.length > 0 ? (
              <span>Caixa #{openRegs[0].code ?? 1}</span>
            ) : (
              <span className="text-muted">Sem pico</span>
            )
          }
          icon={<Sparkles size={16} />}
          badge={
            chartStats.peakBucket ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-support border border-brand text-[10px] font-bold text-brand tabular-nums">
                {formatBrl(chartStats.peakBucket.value)}
              </span>
            ) : undefined
          }
          subtitle={
            <Link
              to="/inicio/historico-de-caixas"
              className="text-brand font-semibold hover:underline"
            >
              {openRegs.length > 0
                ? `${openRegs.length} caixa(s) aberto(s) agora`
                : 'Todos os caixas fechados'}
            </Link>
          }
        />
      </div>

      {/* Gráficos Lado a Lado: Ritmo de Vendas (2/3) + Mix de Pagamentos (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Gráfico de Barras Sem Barra Preta no Hover */}
        <section className="lg:col-span-8 bg-surface border border-line rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <Clock size={18} className="text-brand" />
                Ritmo de Vendas por{' '}
                {chartGrouping === 'hour'
                  ? 'Horário'
                  : chartGrouping === 'day'
                    ? 'Dia'
                    : chartGrouping === 'week'
                      ? 'Semana'
                      : 'Mês'}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                {chartGrouping === 'hour'
                  ? 'Identifique os horários de maior fluxo de clientes no balcão.'
                  : 'Evolução cronológica contínua do período filtrado.'}
              </p>
            </div>

            <div
              className="inline-flex items-center bg-page border border-line p-1 rounded-lg self-start sm:self-auto"
              role="group"
              aria-label="Agrupamento do gráfico"
            >
              {(['hour', 'day', 'week', 'month'] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setChartGrouping(group)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    chartGrouping === group
                      ? 'bg-brand text-on-brand'
                      : 'text-muted hover:text-ink hover:bg-surface'
                  }`}
                >
                  {group === 'hour'
                    ? 'Hora'
                    : group === 'day'
                      ? 'Dia'
                      : group === 'week'
                        ? 'Semana'
                        : 'Mês'}
                </button>
              ))}
            </div>
          </div>

          {!chartStats.hasData ? (
            <div className="h-[264px] rounded-xl bg-page border border-line flex flex-col items-center justify-center text-center px-6">
              <div className="w-11 h-11 rounded-full bg-support text-brand flex items-center justify-center mb-3">
                <Clock size={20} />
              </div>
              <p className="text-sm font-semibold text-ink">
                Nenhuma venda registrada neste recorte
              </p>
              <p className="text-xs text-muted mt-1 max-w-[36ch]">
                Experimente selecionar &ldquo;Este mês&rdquo; ou outro intervalo de datas acima para visualizar o ritmo de faturamento.
              </p>
            </div>
          ) : (
            <div className="h-[272px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#E5E1ED"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#665F70"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={12}
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
                  {chartStats.avgActive > 0 && chartData.length > 1 && (
                    <ReferenceLine
                      y={chartStats.avgActive}
                      stroke="#6D28D9"
                      strokeDasharray="4 4"
                      strokeWidth={1.2}
                    />
                  )}
                  <Bar
                    dataKey="value"
                    name="Faturamento"
                    maxBarSize={38}
                    radius={[6, 6, 0, 0]}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`bar-${index}`}
                        fill={entry.isPeak ? '#6D28D9' : '#7C3AED'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-brand" />
                Período regular
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: '#6D28D9' }}
                />
                Maior pico ({chartStats.peakBucket?.name || '--'})
              </span>
            </div>
            <span className="tabular-nums">
              Média ativa: <strong className="text-ink">{formatBrl(chartStats.avgActive)}</strong>
            </span>
          </div>
        </section>

        {/* Mix de Pagamentos Interativo */}
        <section className="lg:col-span-4 bg-surface border border-line rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <CreditCard size={18} className="text-brand" />
                Mix de Pagamentos
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Clique em um meio para filtrar os cupons.
              </p>
            </div>
            {filterPayment !== 'todos' && (
              <button
                type="button"
                onClick={() => {
                  setFilterPayment('todos');
                  setCurrentPage(1);
                }}
                className="text-[11px] font-semibold text-brand bg-support border border-brand px-2 py-0.5 rounded cursor-pointer"
              >
                Limpar filtro
              </button>
            )}
          </div>

          <PaymentMixDonut
            byPaymentMethod={summary?.period?.byPaymentMethod}
            countByPaymentMethod={summary?.period?.countByPaymentMethod}
            totalRevenue={summary?.period?.revenue || 0}
            selectedMethod={filterPayment === 'todos' ? undefined : filterPayment}
            onSelectMethod={(methodKey) => {
              setFilterPayment((cur) => (cur === methodKey ? 'todos' : methodKey));
              setCurrentPage(1);
            }}
          />
        </section>
      </div>

      {/* Linha Inferior: Top Mercadorias & Grade (4 col) + Histórico de Cupons (8 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Mercadorias com Foto e Grade */}
        <section className="lg:col-span-4 bg-surface border border-line rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Package size={18} className="text-brand" />
                  Top Mercadorias
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Variações líderes no período selecionado.
                </p>
              </div>

              <div className="inline-flex bg-page border border-line p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRankingMetric('revenue')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                    rankingMetric === 'revenue'
                      ? 'bg-brand text-on-brand'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  R$
                </button>
                <button
                  type="button"
                  onClick={() => setRankingMetric('qty')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                    rankingMetric === 'qty'
                      ? 'bg-brand text-on-brand'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Peças
                </button>
              </div>
            </div>

            {rankedProducts.length > 0 ? (
              <div className="space-y-3">
                {rankedProducts.map((p, idx) => (
                  <div
                    key={p.productId || `${p.name}-${idx}`}
                    className="p-2.5 rounded-xl border border-line bg-page hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
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

                      <ProductThumb imageUrl={p.imageUrl} alt={p.name} size={36} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <strong className="text-xs font-bold text-ink truncate">
                            {p.name}
                          </strong>
                          <strong className="text-xs font-bold text-brand tabular-nums shrink-0">
                            {rankingMetric === 'revenue'
                              ? formatBrl(p.revenue)
                              : `${p.qty} ${p.qty === 1 ? 'peça' : 'peças'}`}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-muted tabular-nums">
                          <span className="truncate">
                            {[
                              p.size ? `Tam ${p.size}` : '',
                              p.color || '',
                              rankingMetric === 'revenue'
                                ? `${p.qty} pçs`
                                : formatBrl(p.revenue),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                          <span>{p.sharePct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 w-full bg-support rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-brand h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, p.barWidthPct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 px-4 rounded-xl bg-page border border-line text-center">
                <p className="text-sm font-semibold text-ink">
                  Nenhuma mercadoria vendida no período
                </p>
                <p className="text-xs text-muted mt-1">
                  O ranking por receita e volume de peças aparecerá automaticamente.
                </p>
              </div>
            )}
          </div>

          {(summary?.period?.productsSold?.length || 0) > 8 && (
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="mt-4 w-full py-2 rounded-lg bg-support border border-brand text-brand text-xs font-bold hover:bg-brand hover:text-on-brand transition-colors cursor-pointer"
            >
              Ver todas as {summary?.period?.productsSold?.length} mercadorias vendidas
            </button>
          )}
        </section>

        {/* Histórico de Vendas e Gestão de NFC-e */}
        <section className="lg:col-span-8 bg-surface border border-line rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 md:p-5 border-b border-line space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Receipt size={18} className="text-brand" />
                  Histórico de Cupons & NFC-e
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Clique em qualquer venda para abrir o espelho completo do atendimento.
                </p>
              </div>
              <span className="text-xs font-semibold text-muted tabular-nums">
                {filteredSales.length}{' '}
                {filteredSales.length === 1 ? 'registro listado' : 'registros listados'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Buscar #cupom, item, cliente..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-surface border border-line rounded-lg pl-9 pr-3 py-2 text-xs text-ink focus:border-brand outline-none"
                />
              </div>

              <RetailSelect
                value={filterPayment}
                onValueChange={(val) => {
                  setFilterPayment(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'todos', label: 'Todos os pagamentos' },
                  { value: 'dinheiro', label: 'Dinheiro' },
                  { value: 'credito', label: 'Cartão de Crédito' },
                  { value: 'debito', label: 'Cartão de Débito' },
                  { value: 'pix', label: 'PIX' },
                  { value: 'crediario', label: 'Crediário (Fiado)' },
                  { value: 'credito_loja', label: 'Vale-troca' },
                ]}
              />

              <RetailSelect
                value={filterNfce}
                onValueChange={(val) => {
                  setFilterNfce(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'todas', label: 'Qualquer status fiscal' },
                  { value: 'autorizadas', label: 'NFC-e Autorizada' },
                  { value: 'pendentes', label: 'Sem nota / Pendente' },
                  { value: 'rejeitadas', label: 'NFC-e Rejeitada' },
                  { value: 'canceladas', label: 'Vendas Canceladas' },
                ]}
              />

              <RetailSelect
                value={sortBy}
                onValueChange={(val) => {
                  setSortBy(val as any);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'recentes', label: 'Mais recentes' },
                  { value: 'maior_valor', label: 'Maior valor' },
                ]}
              />
            </div>
          </div>

          {/* Tabela Desktop */}
          <div className="hidden md:block flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-page border-b border-line text-muted text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Cupom / Hora</th>
                  <th className="px-4 py-3 font-semibold">Mercadorias</th>
                  <th className="px-4 py-3 font-semibold">Pagamento</th>
                  <th className="px-4 py-3 font-semibold text-center">NFC-e</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {currentSales.map((sale) => {
                  const isCancelled = sale.status === 'cancelled';
                  const saleLabel = sale.code ? `#${sale.code}` : `#${sale.id.slice(0, 6)}`;
                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSaleDetail(sale)}
                      className={`hover:bg-page transition-colors cursor-pointer ${
                        isCancelled ? 'opacity-65' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <strong className="text-xs font-bold text-ink tabular-nums block">
                          {saleLabel}
                        </strong>
                        <span className="text-[11px] text-muted tabular-nums block">
                          {new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(sale.createdAt))}
                        </span>
                        {sale.operator?.name && (
                          <span className="text-[10px] text-muted block truncate max-w-[110px]">
                            Op. {sale.operator.name}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 max-w-[240px]">
                        <div className="space-y-1">
                          {sale.items.slice(0, 2).map((i) => (
                            <div key={i.id} className="text-xs flex gap-1.5 items-center">
                              <span className="font-bold text-brand bg-support px-1.5 py-0.2 rounded text-[11px] tabular-nums shrink-0">
                                {Number(i.quantity)}x
                              </span>
                              <span
                                className={`text-ink truncate ${
                                  isCancelled ? 'line-through text-muted' : ''
                                }`}
                              >
                                {i.product?.name || i.productName || 'Mercadoria'}
                              </span>
                            </div>
                          ))}
                          {sale.items.length > 2 && (
                            <span className="text-[11px] font-semibold text-brand">
                              +{sale.items.length - 2} mais no cupom
                            </span>
                          )}
                          {isCancelled && sale.cancelReason && (
                            <div className="text-[10px] text-muted italic truncate">
                              Cancelada: {sale.cancelReason}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-muted bg-page border border-line px-2 py-0.5 rounded">
                            <XCircle size={11} /> Cancelada
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {sale.payments.map((p, idx) => (
                              <span
                                key={idx}
                                className="inline-block text-[10px] font-bold text-ink bg-page border border-line px-2 py-0.5 rounded"
                              >
                                {p.label || getPaymentMethodLabel(p.method)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td
                        className="px-4 py-3.5 align-middle text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {sale.emitirNfce ? (
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {sale.nfceStatus === 'autorizada' ? (
                              <span className="text-brand font-bold text-[11px] inline-flex items-center gap-1 bg-support px-2 py-0.5 rounded border border-brand">
                                <CheckCircle2 size={12} />
                                {sale.nfceNumero ? `Nº ${sale.nfceNumero}` : 'Autorizada'}
                              </span>
                            ) : sale.nfceStatus === 'rejeitada' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <div className="relative group">
                                  <span className="text-on-brand font-bold text-[11px] inline-flex items-center gap-1 bg-ink px-2 py-0.5 rounded border border-ink cursor-help">
                                    <AlertTriangle size={12} /> Rejeitada
                                  </span>
                                  {sale.nfceMotivoRejeicao && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-surface text-ink text-[10px] rounded-lg border border-brand z-50 text-left pointer-events-none break-words">
                                      <div className="font-bold text-brand mb-0.5">
                                        Motivo SEFAZ:
                                      </div>
                                      {sale.nfceMotivoRejeicao}
                                    </div>
                                  )}
                                </div>
                                {!isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => triggerEmitNfce(sale)}
                                    disabled={emittingId === sale.id}
                                    className="text-brand p-1 rounded bg-support border border-brand hover:bg-brand hover:text-on-brand disabled:opacity-50 cursor-pointer"
                                    data-tooltip="Corrigir / Reemitir NFC-e"
                                  >
                                    {emittingId === sale.id ? (
                                      <PdvLojistaLoader
                                        mode="loader"
                                        compact
                                        size={12}
                                        label="Emitindo"
                                      />
                                    ) : (
                                      <RefreshCw size={12} />
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : sale.nfceStatus === 'cancelada' || isCancelled ? (
                              <span className="text-muted font-semibold text-[11px] inline-flex items-center gap-1 bg-page px-2 py-0.5 rounded border border-line">
                                <XCircle size={12} /> Cancelada
                              </span>
                            ) : (
                              <span className="text-ink font-semibold text-[11px] inline-flex items-center gap-1 bg-page px-2 py-0.5 rounded border border-dashed border-brand">
                                <Clock size={12} className="text-brand" /> Pendente
                              </span>
                            )}
                          </div>
                        ) : !isCancelled ? (
                          <button
                            type="button"
                            onClick={() => triggerEmitNfce(sale)}
                            disabled={emittingId === sale.id}
                            className="text-brand hover:bg-brand hover:text-on-brand inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded bg-surface border border-brand disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {emittingId === sale.id ? (
                              <PdvLojistaLoader mode="loader" compact size={12} label="Emitindo" />
                            ) : (
                              <Receipt size={12} />
                            )}
                            Emitir NFC-e
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted">--</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap tabular-nums">
                        <strong
                          className={`font-bold text-sm ${
                            isCancelled ? 'line-through text-muted' : 'text-brand'
                          }`}
                        >
                          {formatBrl(sale.total)}
                        </strong>
                        {Number(sale.discount || 0) > 0 && (
                          <span className="block text-[10px] text-muted">
                            Desc. -{formatBrl(sale.discount)}
                          </span>
                        )}
                      </td>

                      <td
                        className="px-4 py-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSaleDetail(sale)}
                            className="text-muted hover:text-brand p-1.5 rounded-lg bg-surface hover:bg-support border border-line transition-colors cursor-pointer"
                            data-tooltip="Ver detalhes do cupom"
                            aria-label="Ver detalhes do cupom"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => printReceipt(sale)}
                            className="text-muted hover:text-brand p-1.5 rounded-lg bg-surface hover:bg-support border border-line transition-colors cursor-pointer"
                            data-tooltip="Reimprimir cupom 80mm"
                            aria-label="Reimprimir cupom 80mm"
                          >
                            <Printer size={15} />
                          </button>
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleCancelSale(sale)}
                              className="text-muted hover:text-ink p-1.5 rounded-lg bg-surface hover:bg-page border border-line transition-colors cursor-pointer"
                              data-tooltip="Cancelar venda"
                              aria-label="Cancelar venda"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {currentSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <p className="text-sm font-semibold text-ink">
                        Nenhum cupom encontrado com os filtros atuais
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Altere o período ou limpe os filtros de busca e meio de pagamento.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile */}
          <div className="md:hidden flex flex-col divide-y divide-line">
            {currentSales.map((sale) => {
              const isCancelled = sale.status === 'cancelled';
              const saleLabel = sale.code ? `#${sale.code}` : `#${sale.id.slice(0, 6)}`;
              return (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSaleDetail(sale)}
                  className={`p-4 flex flex-col gap-2.5 bg-surface cursor-pointer ${
                    isCancelled ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <strong className="text-xs font-bold text-ink tabular-nums">
                        Cupom {saleLabel}
                      </strong>
                      <span className="text-[11px] text-muted block tabular-nums">
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(sale.createdAt))}
                      </span>
                    </div>
                    <strong
                      className={`font-bold text-base tabular-nums ${
                        isCancelled ? 'line-through text-muted' : 'text-brand'
                      }`}
                    >
                      {formatBrl(sale.total)}
                    </strong>
                  </div>

                  <div className="text-xs text-muted line-clamp-2">
                    {sale.items
                      .map(
                        (i) =>
                          `${Number(i.quantity)}x ${i.product?.name || i.productName || 'Item'}`,
                      )
                      .join(', ')}
                  </div>

                  <div
                    className="flex items-center justify-between gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap gap-1">
                      {isCancelled ? (
                        <span className="text-[10px] uppercase font-bold text-muted bg-page border border-line px-2 py-0.5 rounded">
                          Cancelada
                        </span>
                      ) : (
                        sale.payments.map((p, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold text-ink bg-page border border-line px-2 py-0.5 rounded"
                          >
                            {p.label || getPaymentMethodLabel(p.method)}
                          </span>
                        ))
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedSaleDetail(sale)}
                        className="p-1.5 rounded-lg bg-surface border border-line text-muted"
                        aria-label="Ver detalhes"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => printReceipt(sale)}
                        className="p-1.5 rounded-lg bg-surface border border-line text-muted"
                        aria-label="Reimprimir"
                      >
                        <Printer size={14} />
                      </button>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleCancelSale(sale)}
                          className="p-1.5 rounded-lg bg-surface border border-line text-muted"
                          aria-label="Cancelar venda"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {currentSales.length === 0 && (
              <div className="p-10 text-center text-xs text-muted">
                Nenhuma venda encontrada neste filtro.
              </div>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-3.5 border-t border-line bg-page flex items-center justify-between text-xs text-muted tabular-nums">
              <span>
                Exibindo {(currentPage - 1) * itemsPerPage + 1}–
                {Math.min(currentPage * itemsPerPage, filteredSales.length)} de{' '}
                {filteredSales.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1.5 rounded-lg bg-surface border border-line hover:border-brand disabled:opacity-40 cursor-pointer"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 font-semibold text-ink">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-surface border border-line hover:border-brand disabled:opacity-40 cursor-pointer"
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modal de Detalhes do Cupom */}
      {selectedSaleDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes do cupom de venda"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4"
          onClick={() => setSelectedSaleDetail(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-line bg-surface overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-line flex items-start justify-between gap-3 bg-surface">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-ink tabular-nums">
                    Cupom{' '}
                    {selectedSaleDetail.code
                      ? `#${selectedSaleDetail.code}`
                      : `#${selectedSaleDetail.id.slice(0, 8)}`}
                  </h3>
                  {selectedSaleDetail.status === 'cancelled' ? (
                    <span className="px-2 py-0.5 rounded bg-page border border-line text-muted text-[11px] font-bold uppercase">
                      Cancelada
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-support border border-brand text-brand text-[11px] font-bold uppercase">
                      Concluída
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5 tabular-nums">
                  Registrada em{' '}
                  {new Date(selectedSaleDetail.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-page cursor-pointer"
                aria-label="Fechar detalhes"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Metadados de Atendimento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-page border border-line">
                  <span className="text-[11px] text-muted block">Operador Responsável</span>
                  <strong className="text-ink font-semibold inline-flex items-center gap-1 mt-0.5">
                    <User size={13} className="text-brand" />
                    {selectedSaleDetail.operator?.name || 'Operador'}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-page border border-line">
                  <span className="text-[11px] text-muted block">Cliente / Consumidor</span>
                  <strong className="text-ink font-semibold block truncate mt-0.5">
                    {selectedSaleDetail.customer?.name ||
                      selectedSaleDetail.consumidorNome ||
                      'Consumidor não identificado'}
                  </strong>
                  {selectedSaleDetail.consumidorCpf && (
                    <span className="text-[10px] text-muted tabular-nums">
                      CPF/CNPJ: {selectedSaleDetail.consumidorCpf}
                    </span>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-page border border-line">
                  <span className="text-[11px] text-muted block">Situação NFC-e</span>
                  <strong className="text-ink font-semibold block mt-0.5">
                    {selectedSaleDetail.nfceStatus === 'autorizada'
                      ? `Autorizada ${selectedSaleDetail.nfceNumero ? `Nº ${selectedSaleDetail.nfceNumero}` : ''}`
                      : selectedSaleDetail.nfceStatus === 'rejeitada'
                        ? 'Rejeitada na SEFAZ'
                        : selectedSaleDetail.emitirNfce
                          ? selectedSaleDetail.nfceStatus || 'Pendente'
                          : 'Cupom não fiscal'}
                  </strong>
                </div>
              </div>

              {selectedSaleDetail.status === 'cancelled' && selectedSaleDetail.cancelReason && (
                <div className="p-3.5 rounded-xl bg-page border border-ink text-xs text-ink">
                  <strong className="font-bold block mb-0.5">Motivo do Cancelamento:</strong>
                  {selectedSaleDetail.cancelReason}
                </div>
              )}

              {selectedSaleDetail.nfceStatus === 'rejeitada' &&
                selectedSaleDetail.nfceMotivoRejeicao && (
                  <div className="p-3.5 rounded-xl bg-support border border-brand text-xs text-ink">
                    <strong className="font-bold text-brand block mb-0.5">
                      Retorno da SEFAZ:
                    </strong>
                    {selectedSaleDetail.nfceMotivoRejeicao}
                  </div>
                )}

              {/* Itens da Venda */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Mercadorias do Atendimento ({selectedSaleDetail.items.length})
                </h4>
                <div className="border border-line rounded-xl divide-y divide-line">
                  {selectedSaleDetail.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProductThumb
                          imageUrl={item.product?.imageUrl}
                          alt={item.product?.name || item.productName || 'Item'}
                          size={34}
                        />
                        <div className="min-w-0">
                          <strong className="text-ink font-semibold block truncate">
                            {item.product?.name || item.productName || 'Mercadoria'}
                          </strong>
                          <span className="text-[11px] text-muted tabular-nums">
                            {Number(item.quantity)} un × {formatBrl(item.priceUnit)}
                            {item.product?.size ? ` · Tam ${item.product.size}` : ''}
                            {item.product?.color ? ` · ${item.product.color}` : ''}
                          </span>
                        </div>
                      </div>
                      <strong className="text-ink font-bold tabular-nums shrink-0">
                        {formatBrl(item.subtotal)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagamentos e Totais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-page border border-line space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                    Meios de Pagamento
                  </span>
                  {selectedSaleDetail.payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between text-xs tabular-nums">
                      <span className="font-medium text-ink">
                        {p.label || getPaymentMethodLabel(p.method)}
                      </span>
                      <strong className="font-bold text-ink">{formatBrl(p.value)}</strong>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl bg-support border border-brand space-y-1.5 tabular-nums text-xs">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal</span>
                    <span>
                      {formatBrl(selectedSaleDetail.subtotal || selectedSaleDetail.total)}
                    </span>
                  </div>
                  {Number(selectedSaleDetail.discount || 0) > 0 && (
                    <div className="flex justify-between text-ink font-medium">
                      <span>Desconto concedido</span>
                      <span>-{formatBrl(selectedSaleDetail.discount)}</span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-brand/30 flex justify-between text-sm font-bold text-brand">
                    <span>Total Final</span>
                    <span>{formatBrl(selectedSaleDetail.total)}</span>
                  </div>
                </div>
              </div>

              {selectedSaleDetail.nfceChave && (
                <div className="p-3 rounded-lg bg-page border border-line text-[11px] text-muted font-mono break-all">
                  Chave NFC-e: {selectedSaleDetail.nfceChave}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-line bg-page flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => printReceipt(selectedSaleDetail)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-line text-ink hover:border-brand text-xs font-semibold cursor-pointer"
                >
                  <Printer size={14} className="text-brand" />
                  Reimprimir Cupom
                </button>
                {selectedSaleDetail.status !== 'cancelled' &&
                  selectedSaleDetail.nfceStatus !== 'autorizada' && (
                    <button
                      type="button"
                      onClick={() => triggerEmitNfce(selectedSaleDetail)}
                      disabled={emittingId === selectedSaleDetail.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-support border border-brand text-brand hover:bg-brand hover:text-on-brand text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <Receipt size={14} />
                      {selectedSaleDetail.nfceStatus === 'rejeitada'
                        ? 'Corrigir NFC-e'
                        : 'Emitir NFC-e'}
                    </button>
                  )}
              </div>

              <div className="flex items-center gap-2">
                {selectedSaleDetail.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => handleCancelSale(selectedSaleDetail)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-line text-muted hover:text-ink text-xs font-semibold cursor-pointer"
                  >
                    <XCircle size={14} />
                    Cancelar Venda
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSaleDetail(null)}
                  className="px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-on-brand text-xs font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <PeriodReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          startDate={startDate}
          endDate={endDate}
          summary={summary}
        />
      )}

      <ErrorBoundary>
        <ReemitNfceModal
          isOpen={isReemitModalOpen}
          onClose={() => {
            setIsReemitModalOpen(false);
            setSaleToReemit(null);
          }}
          sale={saleToReemit}
          onConfirm={handleReemitConfirm}
        />
      </ErrorBoundary>

      {cancelSaleTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cancelar venda"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink">Cancelar Venda</h3>
              <button
                type="button"
                disabled={cancellingSale}
                onClick={() => {
                  setCancelSaleTarget(null);
                  setCancelReasonInput('');
                }}
                className="text-muted hover:text-ink text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
            <div className="space-y-2 text-xs text-muted">
              <p>
                Confirme o cancelamento da venda de{' '}
                <strong className="text-ink">{formatBrl(cancelSaleTarget.total)}</strong>. O
                estoque das mercadorias será estornado automaticamente.
              </p>
              <label className="block font-bold text-ink pt-1">
                Motivo do cancelamento (mínimo de 15 caracteres)
              </label>
              <textarea
                rows={3}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Descreva o motivo do cancelamento da venda..."
                className="w-full rounded-xl border border-line bg-page p-3 text-sm text-ink focus:border-brand focus:outline-none"
                autoFocus
              />
              <div className="flex justify-between text-[11px]">
                <span>Exigência fiscal e de auditoria interna</span>
                <span
                  className={
                    cancelReasonInput.trim().length >= 15
                      ? 'text-brand font-bold'
                      : 'text-muted'
                  }
                >
                  {cancelReasonInput.trim().length}/15 caracteres
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                disabled={cancellingSale}
                onClick={() => {
                  setCancelSaleTarget(null);
                  setCancelReasonInput('');
                }}
                className="rounded-xl border border-line bg-page px-4 py-2 text-xs font-bold text-ink hover:bg-support cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={cancellingSale || cancelReasonInput.trim().length < 15}
                onClick={confirmCancelSale}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
              >
                {cancellingSale ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
