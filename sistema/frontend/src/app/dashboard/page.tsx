"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { ReemitNfceModal } from '@/components/ReemitNfceModal';
import { PeriodReportModal } from '@/components/PeriodReportModal';
import { PdvLojistaLoader, RetailDatePicker, RetailSelect } from '@/components/ui';
import { 
  DollarSign, TrendingUp, Package, CheckCircle2, 
  XCircle, Clock, Receipt, Download, Calendar, ArrowUpRight, 
  ArrowDownRight, CreditCard, Banknote, QrCode, Search, ChevronLeft, ChevronRight,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { UserIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, FileSpreadsheet } from 'lucide-react';

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

type SummaryData = {
  openRegisters: RegisterSummary[];
  currentRegister: RegisterSummary | null;
  today: { revenue: number; transactions: number };
  week: { revenue: number; vsLastWeek: number | null };
  month: { revenue: number };
  period: {
    revenue: number;
    transactions: number;
    avgTicket: number;
    byPaymentMethod: Record<string, number>;
    byHour: Record<number, number>;
    byDay?: Record<string, number>;
    byWeek?: Record<string, number>;
    byMonth?: Record<string, number>;
    topProducts: Array<{ name: string; qty: number; revenue: number; pct: number }>;
    productsSold?: Array<{ name: string; qty: number; revenue: number }>;
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
  subtotal: number;
  product: { name: string };
};

type Payment = {
  method: string;
  label?: string;
  value: number;
};

type Sale = {
  id: string;
  subtotal: number;
  discount: number;
  status: string;
  cancelReason?: string | null;
  operator?: { name: string } | null;
  total: number;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
  emitirNfce: boolean;
  nfceStatus: string | null;
  nfceNumero: number | null;
  nfceCodRejeicao?: string | null;
  nfceMotivoRejeicao?: string | null;
  operatorId?: string;
  cashRegisterId?: string;
};

// --- Helpers ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getMethodColor = (method: string) => {
  switch(method) {
    case 'dinheiro': return '#7C3AED'; // emerald-500
    case 'pix': return '#6D28D9'; // teal-500
    case 'credito': return '#665F70'; // indigo-500
    case 'debito': return '#272321'; // sky-500
    default: return '#E5E1ED'; // purple-500
  }
};

const getMethodName = (method: string) => {
  switch(method) {
    case 'dinheiro': return 'Dinheiro';
    case 'pix': return 'Pix';
    case 'credito': return 'Crédito';
    case 'debito': return 'Débito';
    default: return method;
  }
};

class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-page border border-brand rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <h2 className="text-lg font-bold text-brand flex items-center gap-2">
               Falha ao Renderizar Modal
            </h2>
            <div className="p-4 bg-support border border-brand rounded-xl space-y-2 font-mono text-[11px] text-muted max-h-60 overflow-auto">
              <p className="font-bold text-brand">{this.state.error?.name}: {this.state.error?.message}</p>
              <pre className="whitespace-pre-wrap">{this.state.error?.stack}</pre>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-surface hover:bg-support text-ink rounded-xl transition text-xs font-semibold border border-line"
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
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [isReemitModalOpen, setIsReemitModalOpen] = useState(false);
  const [saleToReemit, setSaleToReemit] = useState<Sale | null>(null);
  const [tenantConfig, setTenantConfig] = useState<any>(null);

  useEffect(() => {
    api.get(`/tenants/me?_t=${Date.now()}`).then(res => setTenantConfig(res.data)).catch(console.error);
  }, []);

  // Filtros de data
  const [preset, setPreset] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [chartGrouping, setChartGrouping] = useState<'hour' | 'day' | 'week' | 'month'>('hour');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Busca manual para datas customizadas
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);

  // Paginação e busca na tabela
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'recentes' | 'maior_valor'>('recentes');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { computedStartDate, computedEndDate } = useMemo(() => {
    let sDate = preset === 'custom' ? appliedStartDate : startDate;
    let eDate = preset === 'custom' ? appliedEndDate : endDate;

    if (preset === 'today') {
      const localToday = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
      sDate = localToday; eDate = localToday;
    } else if (preset === 'week') {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      sDate = start.toLocaleDateString('en-CA');
      eDate = new Date().toLocaleDateString('en-CA');
    } else if (preset === 'month') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      sDate = start.toLocaleDateString('en-CA');
      eDate = new Date().toLocaleDateString('en-CA');
    }
    return { computedStartDate: sDate, computedEndDate: eDate };
  }, [preset, appliedStartDate, appliedEndDate, startDate, endDate]);

  const fetchDashboardData = async () => {
    try {
      // Fetch summary
      const sumRes = await api.get(`/dashboard/summary?startDate=${computedStartDate}&endDate=${computedEndDate}`);
      setSummary(sumRes.data);

      const { data } = await api.get(`/sales?startDate=${computedStartDate}&endDate=${computedEndDate}&limit=200`);
      setSales(data.data || []);
    } catch (error) {
      console.error("Erro ao buscar dados do dashboard", error);
      toast.error('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDashboardData();

    // Auto-refresh a cada 60 segundos
    const intervalId = setInterval(fetchDashboardData, 60000);
    
    // Polling rápido para NFC-e pendente
    const pendingInterval = setInterval(() => {
      setSales(current => {
        const hasPending = current.some(s => s.nfceStatus === 'pendente' || s.nfceStatus === 'em_processamento');
        if (hasPending) {
          fetchDashboardData();
        }
        return current;
      });
    }, 5000);

    return () => {
      clearInterval(intervalId);
      clearInterval(pendingInterval);
    };
  }, [preset, computedStartDate, computedEndDate]);

  const handleEmitNfce = async (saleId: string, forceNewNumber: boolean, manualNumber?: number) => {
    setEmittingId(saleId);
    try {
      await api.post(`/sales/${saleId}/emit-nfce`, { forceNewNumber, manualNumber });
      toast.success('Emissão solicitada com sucesso!');
      fetchDashboardData();
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
      handleEmitNfce(sale.id, false);
    }
  };

  const handleCancelSale = async (sale: Sale) => {
    const reason = window.prompt("Motivo do cancelamento (Mínimo de 15 caracteres):");
    if (!reason) return;
    if (reason.length < 15) {
      toast.error("O motivo deve ter pelo menos 15 caracteres para a SEFAZ.");
      return;
    }

    try {
      // 1. Se tem NFC-e autorizada, cancela na SEFAZ primeiro
      if (sale.nfceStatus === 'autorizada') {
        await api.post(`/v1/fiscal/nfce/${sale.id}/cancelar`, { motivo: reason });
      }

      // 2. Cancela a venda localmente e estorna estoque
      await api.post(`/sales/${sale.id}/cancel`, { reason });
      
      toast.success("Venda cancelada com sucesso!");
      fetchDashboardData();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || 'Erro ao cancelar venda.';
      toast.error(msg);
    }
  };

  const handleReemitConfirm = async (forceNewNumber: boolean, manualNumber?: number) => {
    if (saleToReemit) {
      await handleEmitNfce(saleToReemit.id, forceNewNumber, manualNumber);
    }
  };

  // ── Impressão de cupom 80mm ────────────────────────────────────────────
  const printReceipt = (sale: Sale) => {
    const saleDate = new Date(sale.createdAt);
    const dateStr = saleDate.toLocaleDateString('pt-BR');
    const timeStr = saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const companyName = tenantConfig?.name || tenantConfig?.razaoSocial || 'Estabelecimento';
    const cnpj        = tenantConfig?.cnpj  || '';
    const address     = tenantConfig?.address || tenantConfig?.endereco || '';
    const phone       = tenantConfig?.phone  || tenantConfig?.telefone  || '';
    const footerMsg   = tenantConfig?.receiptFooter || 'Obrigado pela preferência! Volte sempre!';

    const itemsHtml = sale.items.map((item, idx) => `
      <div class="item">
        <div class="item-header">
          <span class="item-num">${String(idx + 1).padStart(2, '0')}</span>
          <span class="item-name">${item.product?.name || 'Desconhecido'}</span>
          <span class="item-total">R$ ${Number(item.subtotal || 0).toFixed(2)}</span>
        </div>
        <div class="item-detail">
          ${item.quantity} UN x R$ ${Number(item.priceUnit || 0).toFixed(2)}
        </div>
      </div>
    `).join('');

    const paymentsHtml = sale.payments.map(p => `
      <div class="payment-row">
        <span>${{ dinheiro: 'DINHEIRO', pix: 'PIX', credito: 'CRÉDITO', debito: 'DÉBITO' }[p.method] || p.method.toUpperCase()}</span>
        <span>R$ ${Number(p.value || 0).toFixed(2)}</span>
      </div>
    `).join('');

    const subtotalVal = Number(sale.subtotal || sale.total || 0);
    const discountVal = Number(sale.discount || 0);
    const totalVal    = Number(sale.total || 0);

    const receiptHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Cupom</title>
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
    .center  { text-align: center; }
    .bold    { font-weight: bold; }
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
    ${cnpj    ? `<div class="subtitle">CNPJ: ${cnpj}</div>` : ''}
    ${address ? `<div class="subtitle">${address}</div>`  : ''}
    ${phone   ? `<div class="subtitle">Tel: ${phone}</div>` : ''}
  </div>
  <div class="divider"></div>
  <div class="label-row">REIMPRESSÃO DE CUPOM</div>
  <div class="meta"><span>${dateStr} ${timeStr}</span><span>Venda #${sale.id.slice(0, 8)}</span></div>
  <div class="meta"><span>Operador: ${sale.operator?.name || 'Operador'}</span></div>
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="totals">
    <div class="totals-row"><span>SUBTOTAL:</span><span>R$ ${subtotalVal.toFixed(2)}</span></div>
    ${ discountVal > 0 ? `<div class="totals-row"><span>DESCONTO:</span><span>-R$ ${discountVal.toFixed(2)}</span></div>` : '' }
    <div class="totals-row grand"><span>TOTAL:</span><span>R$ ${totalVal.toFixed(2)}</span></div>
  </div>
  <div class="divider"></div>
  ${paymentsHtml}
  <div class="divider"></div>
  <div class="footer">${footerMsg}</div>
  <br/><br/>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=340,height=600,toolbar=0,menubar=0,scrollbars=0');
    if (!printWin) { toast.error('Popup bloqueado. Permita pop-ups para imprimir.'); return; }
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

  // --- Renderização de Dados ---
  const isCustomOrPast = preset === 'custom' || preset === 'month' || preset === 'week'; // Define se o card de "Caixa Atual" deve estar cinza

  // Dados para gráficos
  const chartData = useMemo(() => {
    if (!summary?.period) return [];

    if (chartGrouping === 'hour') {
      const byHour = summary.period.byHour || {};
      const peak = Object.values(byHour).reduce((a, b) => Math.max(a, b), 0);
      return Object.entries(byHour).map(([hour, value]) => ({
        name: `${hour}h`,
        value,
        isPeak: value > 0 && value === peak,
      }));
    }

    if (chartGrouping === 'day') {
      const byDay = summary.period.byDay || {};
      const sortedKeys = Object.keys(byDay).sort();
      const peak = Object.values(byDay).reduce((a, b) => Math.max(a, b), 0);
      return sortedKeys.map(key => {
        const value = byDay[key];
        const parts = key.split('-');
        const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : key;
        return {
          name: label,
          value,
          isPeak: value > 0 && value === peak,
        };
      });
    }

    if (chartGrouping === 'week') {
      const byWeek = summary.period.byWeek || {};
      const sortedKeys = Object.keys(byWeek).sort();
      const peak = Object.values(byWeek).reduce((a, b) => Math.max(a, b), 0);
      return sortedKeys.map(key => {
        const value = byWeek[key];
        const parts = key.split('-');
        const label = parts.length === 3 ? `Sem. ${parts[2]}/${parts[1]}` : key;
        return {
          name: label,
          value,
          isPeak: value > 0 && value === peak,
        };
      });
    }

    if (chartGrouping === 'month') {
      const byMonth = summary.period.byMonth || {};
      const sortedKeys = Object.keys(byMonth).sort();
      const peak = Object.values(byMonth).reduce((a, b) => Math.max(a, b), 0);
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return sortedKeys.map(key => {
        const value = byMonth[key];
        const parts = key.split('-');
        let label = key;
        if (parts.length === 2) {
          const monthIdx = parseInt(parts[1]) - 1;
          const monthLabel = monthNames[monthIdx] || parts[1];
          label = `${monthLabel}/${parts[0].slice(-2)}`;
        }
        return {
          name: label,
          value,
          isPeak: value > 0 && value === peak,
        };
      });
    }

    return [];
  }, [summary, chartGrouping]);

  const chartDataPayment = useMemo(() => {
    if (!summary?.period.byPaymentMethod) return [];
    return Object.entries(summary.period.byPaymentMethod)
      .filter(([_, val]) => val > 0)
      .map(([method, value]) => ({
        name: getMethodName(method),
        value,
        color: getMethodColor(method)
      }));
  }, [summary]);

  // Filtragem da tabela
  const filteredSales = useMemo(() => {
    let result = sales;

    // Aplica o filtro de data global do dashboard
    if (computedStartDate && computedEndDate) {
      const startObj = new Date(computedStartDate + 'T00:00:00');
      const endObj = new Date(computedEndDate + 'T23:59:59');
      result = result.filter(s => {
        const saleDate = new Date(s.createdAt);
        return saleDate >= startObj && saleDate <= endObj;
      });
    }

    // Filtro por método de pagamento
    if (filterPayment !== 'todos') {
      result = result.filter(s => s.payments.some(p => p.method.toLowerCase() === filterPayment.toLowerCase()));
    }

    // Busca geral (produto, valor, pagamento)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.total.toString().includes(lower) || 
        s.items.some(i => i.product?.name.toLowerCase().includes(lower)) ||
        s.payments.some(p => p.method.toLowerCase().includes(lower))
      );
    }

    // Ordenação
    if (sortBy === 'maior_valor') {
      result = [...result].sort((a, b) => b.total - a.total);
    } else {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [sales, searchTerm, filterPayment, sortBy, computedStartDate, computedEndDate]);

  const handleExportSales = () => {
    try {
      if (filteredSales.length === 0) {
        toast.error('Não há vendas para exportar com os filtros atuais.');
        return;
      }

      const dataToExport = filteredSales.map(sale => {
        return {
          'Data/Hora': new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sale.createdAt)),
          'Itens': sale.items.map(i => `${i.quantity}x ${i.product?.name || 'Produto'}`).join(', '),
          'Pagamento': sale.payments.map(p => `${p.label || getMethodName(p.method)} (R$ ${Number(p.value).toFixed(2)})`).join(', '),
          'Total (R$)': Number(sale.total).toFixed(2),
          'Desconto (R$)': sale.discount ? Number(sale.discount).toFixed(2) : '0.00',
          'Status NFC-e': sale.nfceStatus || 'Não emitida',
          'Status Venda': sale.status === 'cancelled' ? 'Cancelada' : 'Concluída'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico de Vendas');
      
      const fileName = `Vendas_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('Exportação concluída!');
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
      doc.text('Histórico de Vendas', 14, 20);
      
      const tableData = filteredSales.map(sale => [
        new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sale.createdAt)),
        sale.items.map(i => `${i.quantity}x ${i.product?.name || 'Produto'}`).join(', '),
        sale.payments.map(p => `${p.label || getMethodName(p.method)} (R$ ${Number(p.value).toFixed(2)})`).join(', '),
        `R$ ${Number(sale.total).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: 25,
        head: [['Data/Hora', 'Itens', 'Pagamento', 'Total']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [40, 40, 40] }
      });

      doc.save(`Vendas_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao exportar PDF: ' + (err.message || 'Desconhecido'));
    }
  };

  // Paginação
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const currentSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading && !summary) {
    return (
      <div className="retail-card retail-loader-region">
        <PdvLojistaLoader mode="loader" size={56} label="Consultando relatórios de vendas…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER & FILTROS --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-ink">Dashboard Analytics</h1>
          <p className="text-muted mt-1 hidden md:block">Acompanhe o desempenho do seu negócio em tempo real.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex flex-col lg:flex-row bg-page p-2 rounded-2xl border border-line gap-2 overflow-x-auto custom-scrollbar">
            <div className="flex bg-page p-1 rounded-xl min-w-max">
            {(['today', 'week', 'month', 'custom'] as const).map(p => (
              <button 
                key={p} 
                onClick={() => setPreset(p)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${preset === p ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-ink hover:bg-surface'}`}
              >
                {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Personalizado'}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2 px-1 py-1 min-w-max">
              <div style={{ width: 158 }}>
                <RetailDatePicker
                  value={startDate}
                  onValueChange={setStartDate}
                  rangeStart={startDate}
                  rangeEnd={endDate}
                  max={endDate}
                  allowClear={false}
                  aria-label="Data inicial"
                />
              </div>
              <span className="text-muted text-sm">até</span>
              <div style={{ width: 158 }}>
                <RetailDatePicker
                  value={endDate}
                  onValueChange={setEndDate}
                  rangeStart={startDate}
                  rangeEnd={endDate}
                  min={startDate}
                  allowClear={false}
                  aria-label="Data final"
                />
              </div>
              <button
                onClick={() => {
                  setAppliedStartDate(startDate);
                  setAppliedEndDate(endDate);
                }}
                className="bg-brand hover:bg-brand-hover text-on-brand p-2.5 rounded-lg transition-colors cursor-pointer"
                data-tooltip="Aplicar filtro de período"
                aria-label="Aplicar filtro de período"
              >
                <Search size={18} />
              </button>
            </div>
          )}
          </div>
          
          <div className="w-px h-8 bg-surface mx-1 hidden lg:block"></div>

          {preset === 'custom' && (
            <button 
              onClick={() => setIsReportModalOpen(true)} 
              className="flex items-center justify-center gap-2 bg-brand hover:bg-brand text-on-brand px-4 py-3 sm:py-2 rounded-xl transition-colors font-bold w-full sm:w-auto mt-2 sm:mt-0 shadow-lg shadow-line hover:text-on-brand"
            >
              <TrendingUp size={18} /> <span>Relatório de Vendas</span>
            </button>
          )}
        </div>
      </div>
      
      {/* --- ALERTAS --- */}
      {summary?.alerts && (summary.alerts.overduePayables.length > 0 || summary.alerts.upcomingPayables.length > 0) && (
        <div className="bg-support border border-brand rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-support rounded-full shrink-0">
              <Banknote size={24} className="text-brand" />
            </div>
            <div>
              <h3 className="text-ink font-bold text-lg">Atenção: Contas a Pagar!</h3>
              <p className="text-muted text-sm">
                Você tem {summary.alerts.overduePayables.length > 0 && <strong className="text-brand">{summary.alerts.overduePayables.length} conta(s) vencida(s)</strong>}
                {summary.alerts.overduePayables.length > 0 && summary.alerts.upcomingPayables.length > 0 && ' e '}
                {summary.alerts.upcomingPayables.length > 0 && <strong className="text-brand">{summary.alerts.upcomingPayables.length} conta(s) vencendo em breve</strong>}.
              </p>
            </div>
          </div>
          <a href="/dashboard/finance/payables" className="shrink-0 bg-brand hover:bg-brand text-on-brand font-bold py-2 px-4 rounded-xl shadow-lg transition text-sm hover:text-on-brand">
            Ver Contas a Pagar
          </a>
        </div>
      )}

      {/* --- KPI CARDS --- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        
        {/* Cards de Caixas Abertos — dinâmico */}
        {preset === 'today' && (summary?.openRegisters ?? []).length > 0 ? (
          (summary!.openRegisters).map((reg, idx) => (
            <div key={reg.cashRegisterId} className="col-span-2 lg:col-span-1 relative overflow-hidden p-4 md:p-6 rounded-2xl border bg-gradient-to-br from-brand to-brand border-line shadow-xl flex flex-col justify-between">
              {/* Badge ABERTO */}
              <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse text-on-brand"></span>
                <span className="text-xs font-bold text-brand tracking-wider">ABERTO</span>
              </div>
              <div className="flex items-center gap-3 text-muted font-medium mb-3">
                <DollarSign size={20} className="text-brand" />
                <span>Caixa #{reg.code ?? (idx + 1)}</span>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-ink tracking-tight">
                  {formatCurrency(reg.total)}
                </h3>
                <p className="text-sm text-muted mt-2 flex items-center gap-1.5 font-semibold">
                  <UserIcon size={14} className="text-brand" />
                  {reg.operatorName}
                </p>
                <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                  <Receipt size={12} />
                  {reg.salesCount} venda{reg.salesCount !== 1 ? 's' : ''} · desde {new Date(reg.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        ) : preset !== 'today' ? (
          /* Fora do filtro "Hoje", mostra card genérico desativado */
          <div className="col-span-2 lg:col-span-1 relative overflow-hidden p-4 md:p-6 rounded-2xl border bg-page/50 border-line opacity-60 flex flex-col justify-between">
            <div className="flex items-center gap-3 text-muted font-medium mb-3">
              <DollarSign size={20} className="text-muted" /> Caixa Atual
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-ink tracking-tight">N/A</h3>
              <p className="text-sm text-muted mt-2">Mude para &quot;Hoje&quot;</p>
            </div>
          </div>
        ) : (
          /* Hoje selecionado mas nenhum caixa aberto */
          <div className="col-span-2 lg:col-span-1 relative overflow-hidden p-4 md:p-6 rounded-2xl border bg-page/50 border-line flex flex-col justify-between">
            <div className="flex items-center gap-3 text-muted font-medium mb-3">
              <DollarSign size={20} className="text-muted" /> Caixa Atual
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-muted tracking-tight">Fechado</h3>
              <p className="text-sm text-muted mt-2">Nenhum caixa aberto</p>
            </div>
          </div>
        )}

        {/* Card 2: Hoje */}
        <div className="bg-page border border-line p-4 md:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center gap-3 text-muted font-medium mb-3">
            <Calendar size={20} className="text-brand" /> Hoje
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-ink tracking-tight truncate">
              {formatCurrency(summary?.today?.revenue || 0)}
            </h3>
            <p className="text-xs md:text-sm text-muted mt-2 flex items-center gap-1.5">
              <Receipt size={14}/> {summary?.today?.transactions || 0} transações
            </p>
          </div>
        </div>

        {/* Card 3: Semana */}
        <div className="bg-page border border-line p-4 md:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center gap-3 text-muted font-medium mb-3">
            <TrendingUp size={20} className="text-brand" /> Semana
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-ink tracking-tight truncate">
              {formatCurrency(summary?.week?.revenue || 0)}
            </h3>
            {summary?.week?.vsLastWeek !== null && summary?.week?.vsLastWeek !== undefined ? (
              <p className={`text-xs md:text-sm mt-2 flex items-center gap-1 font-medium ${summary.week.vsLastWeek >= 0 ? 'text-brand' : 'text-brand'}`}>
                {summary.week.vsLastWeek >= 0 ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
                {Math.abs(summary.week.vsLastWeek).toFixed(1)}% vs. ant.
              </p>
            ) : (
              <p className="text-xs md:text-sm text-muted mt-2 line-clamp-1">Sem histórico anterior</p>
            )}
          </div>
        </div>

        {/* Card 4: Mês / Personalizado */}
        <div className="bg-page border border-line p-4 md:p-6 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-support rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 text-muted font-medium mb-3 relative z-10">
            <Banknote size={20} className="text-brand" /> 
            {preset === 'custom' ? 'Total do Período' : 'Este Mês'}
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl md:text-3xl font-black text-ink tracking-tight truncate">
              {formatCurrency(preset === 'custom' ? (summary?.period?.revenue || 0) : (summary?.month?.revenue || 0))}
            </h3>
             <p className="text-xs md:text-sm text-muted mt-2 flex items-center gap-1.5">
               <Receipt size={14}/> Visão macro
            </p>
          </div>
        </div>

        {/* Card 5: Ticket Médio */}
        <div className="bg-page border border-line p-4 md:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center gap-3 text-muted font-medium mb-3">
            <Package size={20} className="text-brand" /> Ticket Médio
          </div>
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-ink tracking-tight truncate">
              {formatCurrency(summary?.period?.avgTicket || 0)}
            </h3>
            <p className="text-xs md:text-sm text-muted mt-2 flex items-center gap-1.5">
              Média por venda
            </p>
          </div>
        </div>

      </div>

      {/* --- GRÁFICOS & TOP PRODUTOS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico: Vendas por Período */}
        <div className="bg-page border border-line rounded-2xl p-4 md:p-6 shadow-xl lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Clock size={20} className="text-brand"/> Vendas por {chartGrouping === 'hour' ? 'Hora' : chartGrouping === 'day' ? 'Dia' : chartGrouping === 'week' ? 'Semana' : 'Mês'} (Período Selecionado)
            </h3>
            
            <div className="flex bg-page border border-line p-0.5 rounded-xl self-start sm:self-auto">
              {(['hour', 'day', 'week', 'month'] as const).map((group) => (
                <button
                  key={group}
                  onClick={() => setChartGrouping(group)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    chartGrouping === group
                      ? 'bg-brand text-on-brand shadow'
                      : 'text-muted hover:text-ink hover:bg-page'
                  }`}
                >
                  {group === 'hour' ? 'Hora' : group === 'day' ? 'Dia' : group === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[200px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#272321" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#272321" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
                <Tooltip 
                  cursor={{ fill: '#272321' }}
                  contentStyle={{ backgroundColor: '#272321', borderColor: '#272321', borderRadius: '12px', color: '#FFFFFF' }}
                  itemStyle={{ color: '#FFFFFF', fontWeight: 'bold' }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Faturamento']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isPeak ? '#7C3AED' : '#7C3AED'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico: Mix de Pagamentos */}
        <div className="bg-page border border-line rounded-2xl p-6 shadow-xl flex flex-col">
          <h3 className="text-lg font-bold text-ink mb-2 flex items-center gap-2">
            <CreditCard size={20} className="text-brand"/> Mix de Pagamentos
          </h3>
          {chartDataPayment.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartDataPayment}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartDataPayment.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                      contentStyle={{ backgroundColor: '#272321', borderColor: '#272321', borderRadius: '12px', color: '#FFFFFF' }}
                      itemStyle={{ color: '#FFFFFF', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full grid grid-cols-2 gap-3 mt-4">
                {chartDataPayment.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></span>
                    <span className="text-muted flex-1">{p.name}</span>
                    <span className="font-bold text-ink">{((p.value / summary!.period.revenue) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted italic text-sm">
              Nenhuma transação no período.
            </div>
          )}
        </div>
      </div>

      {/* --- TOP PRODUTOS E TABELA --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Produtos */}
        <div className="bg-page border border-line rounded-2xl p-4 md:p-6 shadow-xl">
          <h3 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
            <Package size={20} className="text-brand"/> Top Produtos (Receita)
          </h3>
          <div className="space-y-5">
            {summary?.period?.topProducts?.map((p, idx) => (
              <div key={idx} className="relative">
                <div className="flex justify-between items-end mb-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted w-4">{idx + 1}.</span>
                    <span className="font-semibold text-muted line-clamp-1">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-brand">{formatCurrency(p.revenue)}</span>
                  </div>
                </div>
                <div className="w-full bg-surface/50 rounded-full h-2 overflow-hidden flex items-center">
                  <div className="bg-brand h-full rounded-full text-on-brand" style={{ width: `${p.pct}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>{p.qty} unidades vendidas</span>
                  <span>{p.pct.toFixed(1)}% do total</span>
                </div>
              </div>
            ))}
            {(!summary?.period?.topProducts || summary.period.topProducts.length === 0) && (
              <p className="text-muted text-sm italic text-center py-10">Nenhum produto vendido no período.</p>
            )}
          </div>
        </div>

        {/* Histórico de Transações */}
        <div className="bg-page border border-line rounded-2xl shadow-xl flex flex-col lg:col-span-2 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-line flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2 whitespace-nowrap">
              <Receipt size={20} className="text-brand"/> Histórico de Vendas
            </h3>
            
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input 
                  type="text" 
                  placeholder="Buscar valor, produto, pgto..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-page border border-line rounded-lg pl-9 pr-3 py-2 text-sm text-ink focus:ring-1 focus:ring-brand outline-none"
                />
              </div>

              <div className="w-full sm:w-48">
                <RetailSelect
                  value={filterPayment}
                  onValueChange={(val) => {
                    setFilterPayment(val);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 'todos', label: 'Qualquer Pagamento' },
                    { value: 'dinheiro', label: 'Dinheiro' },
                    { value: 'credito', label: 'Crédito' },
                    { value: 'debito', label: 'Débito' },
                    { value: 'pix', label: 'PIX' },
                    { value: 'store_credit', label: 'Vale-troca' },
                  ]}
                />
              </div>

              <div className="w-full sm:w-44">
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

              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleExportPDF}
                  className="flex items-center justify-center gap-1.5 bg-support text-brand hover:bg-support border border-brand px-3 py-2 rounded-lg transition-colors text-sm font-semibold flex-1 sm:flex-none"
                  data-tooltip="Exportar listagem atual para PDF"
                >
                  <FileText size={16} /> PDF
                </button>
                <button 
                  onClick={handleExportSales}
                  className="flex items-center justify-center gap-1.5 bg-support text-brand hover:bg-support border border-brand px-3 py-2 rounded-lg transition-colors text-sm font-semibold flex-1 sm:flex-none"
                  data-tooltip="Exportar listagem atual para Excel"
                >
                  <FileSpreadsheet size={16} /> Excel
                </button>
              </div>
            </div>
          </div>
          
          {/* Tabela para Desktop */}
          <div className="hidden md:block flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-page/50 text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Data/Hora</th>
                  <th className="px-6 py-4 font-semibold">Itens</th>
                  <th className="px-6 py-4 font-semibold">Pagamento</th>
                  <th className="px-6 py-4 font-semibold text-center">NFC-e</th>
                  <th className="px-6 py-4 font-semibold text-right">Total</th>
                  <th className="px-6 py-4 font-semibold text-center w-[80px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {currentSales.map(sale => {
                  const isCancelled = sale.status === 'cancelled';
                  return (
                    <tr key={sale.id} className={`hover:bg-surface transition-colors ${isCancelled ? 'opacity-55 line-through' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-muted text-sm">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sale.createdAt))}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-h-20 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                          {sale.items.map(i => (
                            <div key={i.id} className="text-xs flex gap-2 items-start">
                              <span className="font-bold text-brand bg-support px-1 rounded">{i.quantity}x</span>
                              <span className="text-muted line-clamp-1">{i.product?.name || 'Desconhecido'}</span>
                            </div>
                          ))}
                          {isCancelled && sale.cancelReason && (
                            <div className="text-[10px] text-brand mt-1 italic font-medium no-underline">
                              Motivo: {sale.cancelReason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-block text-[10px] uppercase font-bold text-brand bg-support border border-brand px-2 py-0.5 rounded mr-1 no-underline">
                            CANCELADA
                          </span>
                        ) : (
                          sale.payments.map((p, idx) => (
                            <span key={idx} className="inline-block text-[10px] uppercase font-bold text-muted bg-surface border border-line px-2 py-0.5 rounded mr-1">
                              {p.label || getMethodName(p.method)}
                            </span>
                          ))
                        )}
                      </td>
                    <td className="px-6 py-4 align-middle text-center whitespace-nowrap">
                      {sale.emitirNfce ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                          {sale.nfceStatus === 'autorizada' ? (
                            <span className="text-brand font-semibold text-[11px] flex items-center justify-center gap-1 bg-support px-2 py-0.5 rounded border border-brand">
                              <CheckCircle2 size={12}/> {sale.nfceNumero ? `Nº ${sale.nfceNumero}` : 'Autorizada'}
                            </span>
                          ) : sale.nfceStatus === 'rejeitada' ? (
                            <div className="flex items-center gap-2">
                              <div className="relative group">
                                <span className="text-brand font-semibold text-[11px] flex items-center justify-center gap-1 bg-support px-2 py-0.5 rounded border border-brand cursor-help">
                                  <XCircle size={12}/> Rejeitada
                                </span>
                                {sale.nfceMotivoRejeicao && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-surface text-ink text-[10px] rounded shadow-xl border border-brand z-50 text-center pointer-events-none break-words">
                                    <div className="font-bold text-brand mb-0.5">Motivo da Rejeição:</div>
                                    {sale.nfceMotivoRejeicao}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-line"></div>
                                  </div>
                                )}
                              </div>
                              <button onClick={() => triggerEmitNfce(sale)} disabled={emittingId === sale.id} className="text-brand hover:text-brand p-1 rounded bg-support hover:bg-support disabled:opacity-50" data-tooltip="Tentar novamente">
                                {emittingId === sale.id ? <PdvLojistaLoader mode="loader" compact size={12} label="Emitindo" /> : <Receipt size={12} />}
                              </button>
                            </div>
                          ) : sale.nfceStatus === 'cancelada' || isCancelled ? (
                            <span className="text-brand font-semibold text-[11px] flex items-center justify-center gap-1 bg-support px-2 py-0.5 rounded border border-brand">
                              <XCircle size={12}/> Cancelada
                            </span>
                          ) : (
                            <span className="text-brand font-semibold text-[11px] flex items-center justify-center gap-1 bg-support px-2 py-0.5 rounded border border-brand">
                              <Clock size={12}/> Pendente
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => triggerEmitNfce(sale)} disabled={emittingId === sale.id} className="text-brand hover:text-brand flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-support hover:bg-support border border-brand disabled:opacity-50 transition-colors">
                            {emittingId === sale.id ? <PdvLojistaLoader mode="loader" compact size={12} label="Emitindo" /> : <Receipt size={12} />} Gerar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="text-brand font-black text-base">{formatCurrency(sale.total)}</span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap flex items-center justify-center gap-2">
                      <button
                        onClick={() => printReceipt(sale)}
                        className="text-muted hover:text-brand p-1.5 rounded-lg bg-surface/50 hover:bg-surface border border-line transition-colors"
                        data-tooltip="Reimprimir cupom"
                        aria-label="Reimprimir cupom"
                      >
                        <Printer size={16} />
                      </button>
                      {!isCancelled && (
                        <button
                          onClick={() => handleCancelSale(sale)}
                          className="text-muted hover:text-brand p-1.5 rounded-lg bg-surface/50 hover:bg-surface border border-line transition-colors"
                          data-tooltip="Cancelar venda"
                          aria-label="Cancelar venda"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
                {currentSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted italic">
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards para Mobile */}
          <div className="md:hidden flex flex-col divide-y divide-line">
            {currentSales.map(sale => {
              const isCancelled = sale.status === 'cancelled';
              return (
                <div key={sale.id} className={`p-4 flex flex-col gap-3 ${isCancelled ? 'opacity-55 line-through' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="text-muted text-sm font-medium">
                      {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sale.createdAt))}
                    </div>
                    <div className="text-brand font-black text-lg">
                      {formatCurrency(sale.total)}
                    </div>
                  </div>

                  <div className="text-sm text-muted line-clamp-2">
                    {sale.items.map(i => `${i.quantity}x ${i.product?.name || 'Item'}`).join(', ')}
                    {isCancelled && sale.cancelReason && (
                      <div className="text-[10px] text-brand mt-1 italic font-medium no-underline">
                        Motivo: {sale.cancelReason}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex gap-1">
                      {isCancelled ? (
                        <span className="inline-block text-[10px] uppercase font-bold text-brand bg-support border border-brand px-2 py-0.5 rounded no-underline">
                          CANCELADA
                        </span>
                      ) : (
                        sale.payments.map((p, idx) => (
                          <span key={idx} className="inline-block text-[10px] uppercase font-bold text-muted bg-surface border border-line px-2 py-0.5 rounded">
                            {p.method}
                          </span>
                        ))
                      )}
                    </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printReceipt(sale)}
                      className="text-muted hover:text-brand p-1 rounded bg-surface hover:bg-support border border-line transition-colors"
                      data-tooltip="Reimprimir cupom"
                      aria-label="Reimprimir cupom"
                    >
                      <Printer size={12} className="m-0.5" />
                    </button>

                    {!isCancelled && (
                      <button
                        onClick={() => handleCancelSale(sale)}
                        data-tooltip="Cancelar venda"
                        aria-label="Cancelar venda"
                        className="p-1 text-muted hover:text-brand rounded bg-surface hover:bg-support border border-line transition-colors"
                      >
                        <XCircle size={12} className="m-0.5" />
                      </button>
                    )}

                    {sale.emitirNfce ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        {sale.nfceStatus === 'autorizada' ? (
                          <span className="text-brand font-semibold text-[11px] flex items-center justify-center gap-1 bg-support px-2 py-0.5 rounded border border-brand">
                            <CheckCircle2 size={12}/> {sale.nfceNumero ? `Nº ${sale.nfceNumero}` : 'Autorizada'}
                          </span>
                        ) : sale.nfceStatus === 'rejeitada' ? (
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <span className="text-brand font-semibold text-[11px] flex items-center justify-center gap-1 bg-support px-2 py-0.5 rounded border border-brand cursor-help">
                                <XCircle size={12}/> Rejeitada
                              </span>
                              {sale.nfceMotivoRejeicao && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-surface text-ink text-[10px] rounded shadow-xl border border-brand z-50 text-center pointer-events-none break-words">
                                  <div className="font-bold text-brand mb-0.5">Motivo da Rejeição:</div>
                                  {sale.nfceMotivoRejeicao}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-line"></div>
                                </div>
                              )}
                            </div>
                            <button onClick={() => triggerEmitNfce(sale)} disabled={emittingId === sale.id} className="text-brand hover:text-brand p-1 rounded bg-support hover:bg-support disabled:opacity-50" data-tooltip="Tentar Novamente">
                              {emittingId === sale.id ? <PdvLojistaLoader mode="loader" compact size={12} label="Emitindo" /> : <Receipt size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-brand font-semibold text-[11px] flex items-center justify-center gap-1 bg-support px-2 py-0.5 rounded border border-brand">
                            <Clock size={12}/> Pendente
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => triggerEmitNfce(sale)} disabled={emittingId === sale.id} className="text-brand hover:text-brand flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-support hover:bg-support border border-brand disabled:opacity-50 transition-colors">
                          {emittingId === sale.id ? <PdvLojistaLoader mode="loader" compact size={12} label="Emitindo" /> : <Receipt size={12} />} Gerar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
            {currentSales.length === 0 && (
              <div className="p-12 text-center text-muted italic">
                Nenhuma venda encontrada.
              </div>
            )}
          </div>
          
          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-line bg-page flex items-center justify-between text-sm text-muted">
              <span>Mostrando {((currentPage - 1) * itemsPerPage) + 1} até {Math.min(currentPage * itemsPerPage, filteredSales.length)} de {filteredSales.length}</span>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 rounded-lg hover:bg-surface disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded-lg hover:bg-surface disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>


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
    </div>
  );
}
