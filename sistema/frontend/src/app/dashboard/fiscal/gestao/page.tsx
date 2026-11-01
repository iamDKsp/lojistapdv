import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ReceiptText, Search, Download, Mail, ArrowLeft,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Eye, X, Calendar, ChevronLeft, ChevronRight,
  Banknote, CreditCard, QrCode, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PdvLojistaLoader, RetailDatePicker, RetailSelect } from '@/components/ui';

interface FiscalSummary {
  periodo: { startDate: string | null; endDate: string | null };
  totais: {
    totalVendasPdv: number;
    totalAutorizadoPdv: number;
    totalAjusteFiscal: number;
    totalAutorizadoNfce: number;
    totalNaoDeclarado: number;
    totalCanceladoNfce: number;
    totalRejeitadoNfce: number;
    coberturaPercent: number;
  };
  contagem: {
    autorizadas: number;
    canceladas: number;
    rejeitadas: number;
    naoEmitidas: number;
    totalGeral: number;
  };
  faixaNotas: {
    menorNota: number | null;
    maiorNota: number | null;
  };
  recebimentos: {
    dinheiro: number;
    pix: number;
    debito: number;
    credito: number;
    outros: number;
  };
}

interface FiscalSaleItem {
  name: string;
  quantity: number;
  priceUnit: number;
  subtotal: number;
}

interface FiscalPayment {
  method: string;
  value: number;
}

interface FiscalSale {
  id: string;
  nfceNumero: number | null;
  nfceSerie: number | null;
  nfceChave: string | null;
  nfceProtocolo: string | null;
  nfceStatus: 'autorizada' | 'cancelada' | 'rejeitada' | 'nao_emitida' | 'pendente';
  nfceMotivoRejeicao: string | null;
  total: number;
  fullSaleTotal: number;
  discount: number;
  source: string;
  consumidorCpf: string | null;
  consumidorNome: string | null;
  createdAt: string;
  operatorName: string;
  payments: FiscalPayment[];
  itemsCount: number;
  itemsSummary: string;
  itemsDetail: FiscalSaleItem[];
}

export default function FiscalManagementPage() {
  const navigate = useNavigate();

  // ── Filtros de Data ────────────────────────────────────────────────────────
  const [periodPreset, setPeriodPreset] = useState<'today' | 'month' | 'last_month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // ── Filtros da Tabela ──────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // ── Estados de Dados ───────────────────────────────────────────────────────
  const [summary, setSummary] = useState<FiscalSummary | null>(null);
  const [sales, setSales] = useState<FiscalSale[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [loadingList, setLoadingList] = useState<boolean>(true);

  // ── Modais ─────────────────────────────────────────────────────────────────
  const [selectedSale, setSelectedSale] = useState<FiscalSale | null>(null);
  const [cancelModalSale, setCancelModalSale] = useState<FiscalSale | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);

  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false);
  const [accountingEmail, setAccountingEmail] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [exportingZip, setExportingZip] = useState<boolean>(false);

  // ── Calcular datas com base no preset selecionado ──────────────────────────
  const applyPreset = useCallback((preset: 'today' | 'month' | 'last_month' | 'custom') => {
    setPeriodPreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDayLastMonth);
      setEndDate(lastDayLastMonth);
    }
  }, []);

  useEffect(() => {
    applyPreset('month');
    const savedEmail = localStorage.getItem('accounting_email') || '';
    if (savedEmail) setAccountingEmail(savedEmail);
  }, [applyPreset]);

  // ── Buscar Resumo Fiscal ───────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get('/sales/fiscal/summary', { params });
      setSummary(res.data);
    } catch {
      toast.error('Erro ao carregar indicadores fiscais.');
    } finally {
      setLoadingSummary(false);
    }
  }, [startDate, endDate]);

  // ── Buscar Listagem Fiscal ────────────────────────────────────────────────
  const fetchSales = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: any = { page, limit: 15 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (sourceFilter !== 'all') params.source = sourceFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await api.get('/sales/fiscal/list', { params });
      setSales(res.data.data);
      setTotalPages(res.data.meta.lastPage || 1);
      setTotalCount(res.data.meta.total || 0);
    } catch {
      toast.error('Erro ao carregar histórico de notas.');
    } finally {
      setLoadingList(false);
    }
  }, [page, startDate, endDate, statusFilter, sourceFilter, searchTerm]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // ── Exportar ZIP de XMLs ───────────────────────────────────────────────────
  const handleDownloadZip = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecione uma data inicial e final.');
      return;
    }
    setExportingZip(true);
    try {
      const res = await api.get(`/sales/export/xmls`, {
        params: { startDate, endDate },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xmls_nfce_${startDate}_a_${endDate}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download do pacote de XMLs concluído!');
    } catch {
      toast.error('Nenhum XML autorizado encontrado para este período.');
    } finally {
      setExportingZip(false);
    }
  };

  // ── Enviar XMLs por E-mail ──────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!accountingEmail || !accountingEmail.includes('@')) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    setSendingEmail(true);
    try {
      await api.post('/sales/export/xmls/send-email', {
        startDate,
        endDate,
        email: accountingEmail,
      });
      localStorage.setItem('accounting_email', accountingEmail);
      toast.success(`Pacote de XMLs enviado com sucesso para ${accountingEmail}!`);
      setEmailModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao enviar e-mail para contabilidade.');
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Cancelar Nota Fiscal ───────────────────────────────────────────────────
  const handleCancelNfce = async () => {
    if (!cancelModalSale) return;
    if (!cancelReason || cancelReason.trim().length < 15) {
      toast.error('O motivo do cancelamento deve ter pelo menos 15 caracteres.');
      return;
    }
    setCancelling(true);
    try {
      await api.post(`/sales/${cancelModalSale.id}/cancel`, { reason: cancelReason });
      toast.success('Cancelamento registrado com sucesso!');
      setCancelModalSale(null);
      setCancelReason('');
      fetchSummary();
      fetchSales();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao solicitar cancelamento.');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'autorizada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-support text-brand border border-brand">
            <CheckCircle2 size={12} /> Autorizada
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-support text-brand border border-brand">
            <XCircle size={12} /> Cancelada
          </span>
        );
      case 'rejeitada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-support text-brand border border-brand">
            <AlertTriangle size={12} /> Rejeitada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-surface text-muted border border-line">
            Não Emitida
          </span>
        );
    }
  };

  const renderPaymentBadges = (payments: FiscalPayment[]) => {
    if (!payments || payments.length === 0) {
      return <span className="text-muted text-xs">-</span>;
    }

    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {payments.map((p, idx) => {
          const m = (p.method || '').toLowerCase();
          let bg = 'bg-support text-brand border-brand';
          let label = p.method.toUpperCase();

          if (m === 'dinheiro' || m === 'money' || m === 'cash') {
            bg = 'bg-support text-brand border-brand';
            label = 'Dinheiro';
          } else if (m === 'pix') {
            bg = 'bg-support text-brand border-brand';
            label = 'PIX';
          } else if (m.includes('deb')) {
            bg = 'bg-support text-brand border-brand';
            label = 'Débito';
          } else if (m.includes('cred')) {
            bg = 'bg-support text-brand border-brand';
            label = 'Crédito';
          }

          return (
            <span key={idx} className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${bg}`}>
              {label}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* ── Topo: Título & Ações Principais ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-page border border-line p-6 rounded-2xl shadow-xl">
        <div>
          <button
            onClick={() => navigate('/inicio')}
            className="text-muted hover:text-brand flex items-center gap-2 text-xs font-bold mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao Início
          </button>
          <h1 className="text-2xl md:text-3xl font-black text-ink tracking-tight flex items-center gap-3">
            <ReceiptText className="text-brand shrink-0" size={32} />
            Gestão & Relatórios NFC-e
          </h1>
          <p className="text-muted text-sm mt-1">
            Painel executivo de cobertura fiscal, conferência de recebimentos e exportação contábil.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setEmailModalOpen(true)}
            className="bg-surface hover:bg-support text-muted px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-xs transition-all border border-line shadow-md"
          >
            <Mail size={16} className="text-brand" />
            Enviar para Contabilidade
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={exportingZip}
            className="bg-brand hover:bg-brand text-on-brand font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50 hover:text-on-brand"
          >
            {exportingZip ? (
              <PdvLojistaLoader mode="loader" compact size={16} label="Exportando XMLs" />
            ) : (
              <Download size={16} />
            )}
            {exportingZip ? 'Exportando...' : 'Baixar ZIP (XMLs)'}
          </button>
        </div>
      </div>

      {/* ── Seletor de Período ─────────────────────────────────────────────── */}
      <div className="bg-page border border-line p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Calendar size={14} className="text-brand" /> Período:
          </span>
          <button
            onClick={() => applyPreset('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              periodPreset === 'today'
                ? 'bg-brand text-on-brand shadow-md'
                : 'bg-surface text-muted hover:text-ink hover:bg-support'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => applyPreset('month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              periodPreset === 'month'
                ? 'bg-brand text-on-brand shadow-md'
                : 'bg-surface text-muted hover:text-ink hover:bg-support'
            }`}
          >
            Este Mês
          </button>
          <button
            onClick={() => applyPreset('last_month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              periodPreset === 'last_month'
                ? 'bg-brand text-on-brand shadow-md'
                : 'bg-surface text-muted hover:text-ink hover:bg-support'
            }`}
          >
            Mês Passado
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="w-40">
            <RetailDatePicker
              value={startDate}
              onValueChange={(iso) => { setStartDate(iso); setPeriodPreset('custom'); }}
              rangeStart={startDate}
              rangeEnd={endDate}
              max={endDate || undefined}
            />
          </div>
          <span className="text-muted text-xs">até</span>
          <div className="w-40">
            <RetailDatePicker
              value={endDate}
              onValueChange={(iso) => { setEndDate(iso); setPeriodPreset('custom'); }}
              rangeStart={startDate}
              rangeEnd={endDate}
              min={startDate || undefined}
            />
          </div>
          <button
            onClick={() => { fetchSummary(); fetchSales(); }}
            className="bg-surface hover:bg-support text-brand p-2.5 rounded-xl border border-line"
            data-tooltip="Atualizar Dados"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── PAINEL DE COBERTURA FISCAL (%) E RECEBIMENTOS ─────────────────── */}
      {loadingSummary ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-44 bg-page border border-line rounded-2xl animate-pulse" />
          <div className="h-44 bg-page border border-line rounded-2xl animate-pulse" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Box 1: Painel Executivo de Cobertura Fiscal */}
          <div className="lg:col-span-2 bg-gradient-to-br from-brand via-brand to-brand border border-brand p-6 rounded-2xl shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand bg-support border border-brand px-3 py-1 rounded-full">
                   Balanço & Cobertura Fiscal
                </span>
                <h3 className="text-xl font-black text-ink mt-2">
                  R$ {summary.totais.totalAutorizadoNfce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <span className="text-muted text-xs font-normal ml-2">faturados em NFC-e</span>
                </h3>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-brand font-mono">
                  {summary.totais.coberturaPercent}%
                </span>
                <p className="text-muted text-[10px] uppercase font-bold tracking-wider">Cobertura Fiscal</p>
              </div>
            </div>

            {/* Barra Visual de Cobertura */}
            <div className="my-4">
              <div className="w-full bg-page h-3.5 rounded-full overflow-hidden border border-line p-0.5">
                <div
                  className="bg-gradient-to-r from-brand to-brand h-full rounded-full transition-all duration-1000 shadow-lg"
                  style={{ width: `${Math.min(100, summary.totais.coberturaPercent)}%` }}
                />
              </div>
            </div>

            {/* Breakdown de Balanço */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-line pt-4 text-xs">
              <div className="bg-page/60 p-2.5 rounded-xl border border-line">
                <p className="text-muted text-[10px] uppercase font-bold">Vendas PDV Total</p>
                <p className="text-ink font-bold text-sm mt-0.5">R$ {summary.totais.totalVendasPdv.toFixed(2)}</p>
              </div>

              <div className="bg-page/60 p-2.5 rounded-xl border border-brand">
                <p className="text-brand text-[10px] uppercase font-bold">Emitido PDV</p>
                <p className="text-brand font-bold text-sm mt-0.5">R$ {summary.totais.totalAutorizadoPdv.toFixed(2)}</p>
              </div>

              <div className="bg-page/60 p-2.5 rounded-xl border border-brand">
                <p className="text-brand text-[10px] uppercase font-bold">Ajustes Fiscais</p>
                <p className="text-brand font-bold text-sm mt-0.5">R$ {summary.totais.totalAjusteFiscal.toFixed(2)}</p>
              </div>

              <div className="bg-page/60 p-2.5 rounded-xl border border-brand">
                <p className="text-brand text-[10px] uppercase font-bold">Não Declarado / SNF</p>
                <p className="text-brand font-bold text-sm mt-0.5">R$ {summary.totais.totalNaoDeclarado.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Box 2: Card de Recebimentos por Forma de Pagamento */}
          <div className="bg-page border border-line p-6 rounded-2xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <CreditCard className="text-brand" size={18} />
                Recebimentos em Nota
              </h3>
              <span className="text-muted text-[10px] font-mono font-bold">CONFERÊNCIA</span>
            </div>

            <div className="space-y-2.5 my-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-page/80 border border-line">
                <span className="text-brand font-semibold flex items-center gap-2">
                  <Banknote size={14} /> Dinheiro
                </span>
                <span className="text-ink font-mono font-bold">R$ {summary.recebimentos.dinheiro.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-page/80 border border-line">
                <span className="text-brand font-semibold flex items-center gap-2">
                  <QrCode size={14} /> PIX
                </span>
                <span className="text-ink font-mono font-bold">R$ {summary.recebimentos.pix.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-page/80 border border-line">
                <span className="text-brand font-semibold flex items-center gap-2">
                  <CreditCard size={14} /> Débito
                </span>
                <span className="text-ink font-mono font-bold">R$ {summary.recebimentos.debito.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-page/80 border border-line">
                <span className="text-brand font-semibold flex items-center gap-2">
                  <CreditCard size={14} /> Crédito
                </span>
                <span className="text-ink font-mono font-bold">R$ {summary.recebimentos.credito.toFixed(2)}</span>
              </div>

              {summary.recebimentos.outros > 0 && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-page/80 border border-line">
                  <span className="text-muted font-semibold flex items-center gap-2">
                    <Layers size={14} /> Outros / Fiado
                  </span>
                  <span className="text-ink font-mono font-bold">R$ {summary.recebimentos.outros.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] text-muted">
              <span>Notas autorizadas: <strong>{summary.contagem.autorizadas}</strong></span>
              <span>Série {summary.faixaNotas.menorNota ? `Nº ${summary.faixaNotas.menorNota}-${summary.faixaNotas.maiorNota}` : 'S1'}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Tabela de Histórico Fiscal ───────────────────────────────────────── */}
      <div className="bg-page border border-line rounded-2xl overflow-hidden shadow-xl">
        {/* Filtros da tabela */}
        <div className="p-4 border-b border-line flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Buscar por nº nota, chave de acesso ou CPF..."
              className="w-full bg-page border border-line rounded-xl pl-10 pr-4 py-2 text-ink placeholder:text-muted text-xs focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
            {/* Filtro Status */}
            <div className="flex items-center gap-1.5 bg-page border border-line p-1 rounded-xl text-xs">
              <span className="text-muted font-bold px-2">Status:</span>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'autorizada', label: 'Autorizadas' },
                { id: 'cancelada', label: 'Canceladas' },
                { id: 'rejeitada', label: 'Rejeitadas' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => { setStatusFilter(st.id); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === st.id ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Filtro Origem */}
            <div className="w-44">
              <RetailSelect
                value={sourceFilter}
                onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
              >
                <option value="all">Todas Origens</option>
                <option value="pdv">Vendas PDV</option>
                <option value="ajuste_fiscal">Ajuste Fiscal</option>
              </RetailSelect>
            </div>
          </div>
        </div>

        {/* Tabela */}
        {loadingList ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <PdvLojistaLoader mode="loader" size={44} label="Carregando histórico fiscal..." />
          </div>
        ) : sales.length === 0 ? (
          <div className="py-16 text-center">
            <ReceiptText size={40} className="text-muted mx-auto mb-3" />
            <p className="text-muted font-bold text-sm">Nenhuma nota localizada para os filtros selecionados</p>
            <p className="text-muted text-xs mt-1">Tente alterar o período ou os filtros de busca acima.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[950px]">
              <thead className="bg-page text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / Hora</th>
                  <th className="px-3 py-3 font-semibold text-center">Nota / Série</th>
                  <th className="px-3 py-3 font-semibold text-center">Origem</th>
                  <th className="px-3 py-3 font-semibold">Consumidor</th>
                  <th className="px-3 py-3 font-semibold text-center">Forma Pagamento</th>
                  <th className="px-3 py-3 font-semibold text-right">Valor Nota</th>
                  <th className="px-3 py-3 font-semibold text-center">Status NFC-e</th>
                  <th className="px-3 py-3 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3 text-muted font-mono text-[11px]">
                      {new Date(sale.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {sale.nfceNumero ? (
                        <span className="font-mono font-bold text-ink">
                          Nº {sale.nfceNumero} <span className="text-muted font-normal">/ S{sale.nfceSerie || 1}</span>
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sale.source === 'ajuste_fiscal'
                          ? 'bg-support text-brand border border-brand'
                          : 'bg-support text-brand border border-brand'
                      }`}>
                        {sale.source === 'ajuste_fiscal' ? 'Ajuste Fiscal' : 'PDV'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      <p className="font-semibold">{sale.consumidorNome || 'Consumidor Não Identificado'}</p>
                      {sale.consumidorCpf && <p className="text-muted font-mono text-[10px]">{sale.consumidorCpf}</p>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {renderPaymentBadges(sale.payments)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-brand text-sm">
                      R$ {sale.total.toFixed(2)}
                      {sale.fullSaleTotal > sale.total && (
                        <span className="block text-[9px] text-muted font-normal line-through">
                          PDV R$ {sale.fullSaleTotal.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {getStatusBadge(sale.nfceStatus)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="p-1.5 bg-surface hover:bg-support text-muted rounded-lg transition-colors"
                          data-tooltip="Ver Detalhes / DANFE / XML"
                        >
                          <Eye size={14} />
                        </button>
                        {sale.nfceStatus === 'autorizada' && (
                          <button
                            onClick={() => setCancelModalSale(sale)}
                            className="p-1.5 bg-support hover:bg-support text-brand border border-brand rounded-lg transition-colors"
                            data-tooltip="Cancelar NFC-e"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Padrão de Paginador */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-line flex items-center justify-between text-xs text-muted">
            <span>Mostrando página {page} de {totalPages} ({totalCount} registros)</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 bg-surface hover:bg-support text-ink rounded-lg disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-surface hover:bg-support text-ink rounded-lg disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL DE DETALHES ENRIQUECIDA DA NOTA ──────────────────────────── */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-page border border-line rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-line flex items-center justify-between bg-page">
              <div>
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <ReceiptText className="text-brand" size={20} />
                  NFC-e nº {selectedSale.nfceNumero || 'S/N'} — Detalhes Completos
                </h3>
                <p className="text-muted text-xs">ID Venda: {selectedSale.id}</p>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-muted hover:text-ink p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
              {/* Grid de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-page p-4 rounded-xl border border-line">
                <div>
                  <p className="text-muted uppercase font-bold text-[10px]">Status SEFAZ</p>
                  <div className="mt-1">{getStatusBadge(selectedSale.nfceStatus)}</div>
                </div>
                <div>
                  <p className="text-muted uppercase font-bold text-[10px]">Data / Hora</p>
                  <p className="text-ink font-semibold mt-1">{new Date(selectedSale.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-muted uppercase font-bold text-[10px]">Origem</p>
                  <p className="text-brand font-bold uppercase mt-1">
                    {selectedSale.source === 'ajuste_fiscal' ? 'Ajuste Fiscal' : 'PDV'}
                  </p>
                </div>
                <div>
                  <p className="text-muted uppercase font-bold text-[10px]">Operador</p>
                  <p className="text-ink font-semibold mt-1">{selectedSale.operatorName}</p>
                </div>
              </div>

              {/* Valores em Destaque */}
              <div className="flex items-center justify-between bg-support border border-brand p-4 rounded-xl">
                <div>
                  <p className="text-brand font-bold uppercase text-[10px]">Valor Efetivo Emitido em Nota</p>
                  <p className="text-2xl font-black text-brand">R$ {selectedSale.total.toFixed(2)}</p>
                </div>
                {selectedSale.fullSaleTotal > selectedSale.total && (
                  <div className="text-right">
                    <p className="text-muted font-bold uppercase text-[10px]">Total Bruto Venda PDV</p>
                    <p className="text-muted font-bold text-base line-through">R$ {selectedSale.fullSaleTotal.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {/* Formas de Pagamento Discriminadas */}
              <div className="bg-page p-4 rounded-xl border border-line space-y-2">
                <p className="text-muted font-bold uppercase text-[10px] flex items-center gap-1.5">
                  <CreditCard size={14} className="text-brand" /> Formas de Pagamento Discriminadas
                </p>
                {selectedSale.payments && selectedSale.payments.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {selectedSale.payments.map((p, idx) => (
                      <div key={idx} className="bg-page p-2.5 rounded-lg border border-line flex items-center justify-between">
                        <span className="text-muted font-bold uppercase text-[11px]">{p.method}</span>
                        <span className="text-brand font-mono font-bold">R$ {p.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted italic text-[11px]">Pagamento registrado no total da venda</p>
                )}
              </div>

              {/* Consumidor */}
              <div className="bg-page p-3 rounded-xl border border-line flex items-center justify-between">
                <div>
                  <p className="text-muted uppercase font-bold text-[10px]">Consumidor / Cliente</p>
                  <p className="text-ink font-semibold mt-0.5">{selectedSale.consumidorNome || 'Consumidor Não Identificado'}</p>
                </div>
                {selectedSale.consumidorCpf && (
                  <div className="text-right font-mono text-muted">
                    <p className="text-muted uppercase font-bold text-[10px]">CPF / CNPJ</p>
                    <p className="text-ink font-bold mt-0.5">{selectedSale.consumidorCpf}</p>
                  </div>
                )}
              </div>

              {/* Dados da Chave e Protocolo */}
              {selectedSale.nfceChave && (
                <div className="bg-page p-3 rounded-xl border border-line space-y-1.5">
                  <p className="text-muted uppercase font-bold text-[10px]">Chave de Acesso (44 dígitos)</p>
                  <p className="text-ink font-mono font-bold text-xs select-all break-all bg-page p-2 rounded-lg border border-line">
                    {selectedSale.nfceChave}
                  </p>
                  {selectedSale.nfceProtocolo && (
                    <p className="text-muted font-mono text-[11px] pt-1">
                      Protocolo SEFAZ: <strong className="text-brand">{selectedSale.nfceProtocolo}</strong>
                    </p>
                  )}
                </div>
              )}

              {selectedSale.nfceMotivoRejeicao && (
                <div className="bg-support border border-brand p-3 rounded-xl">
                  <p className="text-brand font-bold text-xs">Motivo da Rejeição / Erro SEFAZ:</p>
                  <p className="text-brand mt-1">{selectedSale.nfceMotivoRejeicao}</p>
                </div>
              )}

              {/* Itens Discriminados */}
              <div>
                <p className="text-muted font-bold uppercase text-[10px] mb-2">
                  Itens na Nota ({selectedSale.itemsCount})
                </p>
                {selectedSale.itemsDetail && selectedSale.itemsDetail.length > 0 ? (
                  <div className="bg-page rounded-xl border border-line overflow-hidden divide-y divide-line">
                    {selectedSale.itemsDetail.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-[11px]">
                        <div>
                          <p className="text-ink font-semibold">{item.name}</p>
                          <p className="text-muted">{item.quantity}x a R$ {item.priceUnit.toFixed(2)}</p>
                        </div>
                        <span className="text-brand font-mono font-bold">R$ {item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted bg-page p-3 rounded-xl border border-line">{selectedSale.itemsSummary}</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-line bg-page flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedSale(null)}
                className="bg-surface hover:bg-support text-ink px-4 py-2 rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CANCELAMENTO DE NOTA ───────────────────────────────────── */}
      {cancelModalSale && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-page border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-line flex items-center justify-between bg-page">
              <h3 className="text-base font-bold text-brand flex items-center gap-2">
                <XCircle size={18} /> Cancelar NFC-e nº {cancelModalSale.nfceNumero}
              </h3>
              <button onClick={() => setCancelModalSale(null)} className="text-muted hover:text-ink p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-muted">
                Você está prestes a solicitar o cancelamento da NFC-e nº <strong>{cancelModalSale.nfceNumero}</strong> (R$ {cancelModalSale.total.toFixed(2)}) diretamente na SEFAZ.
              </p>

              <div>
                <label className="block text-muted font-bold mb-1.5 uppercase text-[10px]">Motivo do Cancelamento (mínimo 15 caracteres):</label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Ex: Erro no preenchimento do valor do item ou desistência do consumidor..."
                  rows={3}
                  className="w-full bg-page border border-line rounded-xl p-3 text-ink placeholder:text-muted focus:outline-none focus:border-brand text-xs"
                />
              </div>
            </div>

            <div className="p-4 border-t border-line bg-page flex items-center justify-end gap-3">
              <button
                onClick={() => setCancelModalSale(null)}
                className="bg-surface hover:bg-support text-muted px-4 py-2 rounded-xl text-xs font-bold"
                disabled={cancelling}
              >
                Voltar
              </button>
              <button
                onClick={handleCancelNfce}
                disabled={cancelling || cancelReason.trim().length < 15}
                className="bg-brand hover:bg-brand text-on-brand px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 hover:text-on-brand"
              >
                {cancelling && <PdvLojistaLoader mode="loader" compact size={16} label="Cancelando NFC-e" />}
                {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE ENVIO DE XMLs PARA O CONTADOR ─────────────────────────── */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-page border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-line flex items-center justify-between bg-page">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Mail size={18} className="text-brand" /> Enviar Pacote de XMLs para Contabilidade
              </h3>
              <button onClick={() => setEmailModalOpen(false)} className="text-muted hover:text-ink p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-muted">
                O sistema irá compilar todos os XMLs autorizados do período (<strong>{startDate}</strong> a <strong>{endDate}</strong>) em um arquivo `.zip` e enviar diretamente por e-mail.
              </p>

              <div>
                <label className="block text-muted font-bold mb-1.5 uppercase text-[10px]">E-mail da Contabilidade:</label>
                <input
                  type="email"
                  value={accountingEmail}
                  onChange={e => setAccountingEmail(e.target.value)}
                  placeholder="exemplo@contabilidade.com.br"
                  className="w-full bg-page border border-line rounded-xl px-3 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand text-xs"
                />
              </div>
            </div>

            <div className="p-4 border-t border-line bg-page flex items-center justify-end gap-3">
              <button
                onClick={() => setEmailModalOpen(false)}
                className="bg-surface hover:bg-support text-muted px-4 py-2 rounded-xl text-xs font-bold"
                disabled={sendingEmail}
              >
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !accountingEmail.includes('@')}
                className="bg-brand hover:bg-brand text-on-brand px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 hover:text-on-brand"
              >
                {sendingEmail && <PdvLojistaLoader mode="loader" compact size={16} label="Enviando e-mail" />}
                {sendingEmail ? 'Enviando...' : 'Enviar E-mail'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
