import React, { useState, useMemo } from 'react';
import { X, TrendingUp, DollarSign, CreditCard, Package, Search, Receipt } from 'lucide-react';

type ProductSold = {
  name: string;
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
    avgTicket: number;
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

export function PeriodReportModal({ isOpen, onClose, startDate, endDate, summary }: PeriodReportModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'qty' | 'revenue'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  if (!isOpen) return null;

  const formatDateBr = (dateStr: any) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const getMethodName = (method: string) => {
    const names: Record<string, string> = {
      dinheiro: 'Dinheiro',
      pix: 'Pix',
      credito: 'Cartão de Crédito',
      debito: 'Cartão de Débito',
    };
    return names[method] || method;
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      dinheiro: 'bg-brand text-on-brand',
      pix: 'bg-brand text-on-brand',
      credito: 'bg-brand text-on-brand',
      debito: 'bg-brand text-on-brand',
    };
    return colors[method] || 'bg-line';
  };

  const getMethodTextColor = (method: string) => {
    const colors: Record<string, string> = {
      dinheiro: 'text-brand',
      pix: 'text-brand',
      credito: 'text-brand',
      debito: 'text-brand',
    };
    return colors[method] || 'text-muted';
  };

  const handleSort = (field: 'name' | 'qty' | 'revenue') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filtrar, pesquisar e ordenar produtos
  const processedProducts = useMemo(() => {
    let list = [...(summary?.period?.productsSold || [])];

    // Filter
    if (searchQuery) {
      list = list.filter(p => {
        const name = p?.name || 'Desconhecido';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'name') {
        valA = valA || '';
        valB = valB || '';
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
    });

    return list;
  }, [summary, searchQuery, sortField, sortDirection]);

  const totalRevenue = summary?.period?.revenue || 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-page border border-line rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] md:max-h-[85vh] mx-4">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 md:p-5 border-b border-line bg-page">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-ink">
              <TrendingUp className="text-brand" /> Relatório de Vendas do Período
            </h2>
            <p className="text-xs text-muted mt-1">
              Período de {formatDateBr(startDate)} até {formatDateBr(endDate)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition rounded-lg hover:bg-surface p-1.5">
            <X size={20} />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 bg-page">
          
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Total Faturado */}
            <div className="bg-page/60 border border-line p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-support rounded-lg text-brand">
                <DollarSign size={22} />
              </div>
              <div>
                <span className="text-xs text-muted block font-medium">Total Faturado</span>
                <span className="text-lg font-black text-ink">{formatCurrency(totalRevenue)}</span>
              </div>
            </div>

            {/* Ticket Médio */}
            <div className="bg-page/60 border border-line p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-support rounded-lg text-brand">
                <TrendingUp size={22} />
              </div>
              <div>
                <span className="text-xs text-muted block font-medium">Ticket Médio</span>
                <span className="text-lg font-black text-ink">{formatCurrency(summary?.period?.avgTicket || 0)}</span>
              </div>
            </div>

            {/* Transações */}
            <div className="bg-page/60 border border-line p-4 rounded-xl flex items-center gap-3">
              <div className="p-2.5 bg-support rounded-lg text-brand">
                <Receipt size={22} />
              </div>
              <div>
                <span className="text-xs text-muted block font-medium">Total Vendas</span>
                <span className="text-lg font-black text-ink">{summary?.period?.transactions || 0}</span>
              </div>
            </div>

          </div>

          {/* Formas de Pagamento (Valores que entraram) */}
          <div className="bg-page border border-line p-5 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-muted flex items-center gap-2">
              <CreditCard size={16} className="text-brand" /> Fluxo de Entrada por Pagamento
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(summary?.period?.byPaymentMethod || {}).map(([method, value]) => {
                const valNum = Number(value) || 0;
                const pct = totalRevenue > 0 ? (valNum / totalRevenue) * 100 : 0;
                return (
                  <div key={method} className="space-y-1 bg-page/50 border border-line p-3 rounded-lg">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className={getMethodTextColor(method)}>{getMethodName(method)}</span>
                      <span className="text-ink font-bold">{formatCurrency(valNum)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-page rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full ${getMethodColor(method)}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {(!summary?.period?.byPaymentMethod || Object.keys(summary?.period?.byPaymentMethod || {}).length === 0) && (
                <p className="text-xs text-muted sm:col-span-2 text-center py-2">Sem movimentações financeiras no período.</p>
              )}
            </div>
          </div>

          {/* Lista de Produtos Vendidos */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-sm font-bold text-muted flex items-center gap-2">
                <Package size={16} className="text-brand" /> Produtos Vendidos no Período
              </h3>
              
              {/* Barra de Pesquisa */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input 
                  type="text"
                  placeholder="Pesquisar produto..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-page border border-line text-muted rounded-xl pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-brand outline-none placeholder:text-muted transition"
                />
              </div>
            </div>

            {/* Tabela de Produtos */}
            <div className="border border-line rounded-xl overflow-y-auto overflow-x-auto bg-page max-h-[320px] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-page border-b border-line text-muted font-bold uppercase tracking-wider select-none">
                    <th 
                      onClick={() => handleSort('name')} 
                      className="p-3 cursor-pointer hover:text-ink transition-colors"
                    >
                      Produto {sortField === 'name' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => handleSort('qty')} 
                      className="p-3 text-center w-28 cursor-pointer hover:text-ink transition-colors"
                    >
                      Qtd. Vendida {sortField === 'qty' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th 
                      onClick={() => handleSort('revenue')} 
                      className="p-3 text-right w-36 cursor-pointer hover:text-ink transition-colors"
                    >
                      Total Vendido {sortField === 'revenue' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {processedProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-page text-muted font-medium transition-colors">
                      <td className="p-3 font-semibold text-ink">{p?.name || 'Desconhecido'}</td>
                      <td className="p-3 text-center font-bold text-muted">{p?.qty || 0}</td>
                      <td className="p-3 text-right font-black text-brand">{formatCurrency(p?.revenue || 0)}</td>
                    </tr>
                  ))}
                  {processedProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted font-medium">
                        Nenhum produto com vendas encontrado no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-line bg-page flex justify-end">
          <button 
            onClick={onClose} 
            className="px-5 py-2 rounded-xl bg-surface hover:bg-support text-ink font-bold transition text-xs"
          >
            Fechar Relatório
          </button>
        </div>

      </div>
    </div>
  );
}
