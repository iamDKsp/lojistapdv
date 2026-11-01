"use client";
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { History, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { CloseRegisterModal } from '@/components/CloseRegisterModal';
import { PdvLojistaLoader } from '@/components/ui';

type CashRegister = {
  id: string;
  userId?: string;
  operator?: { id: string; name: string };
  code?: number;
  openingTime: string;
  closingTime?: string;
  openingValue: number;
  closingValue?: number;
  status: string;
  totalSales?: number;
  closingDetails?: any;
};

export default function CashRegistersHistoryPage() {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/cash-registers')
      .then(res => setRegisters(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Update register status when modal closes
  const handleModalClose = () => {
    setSelectedId(null);
    api.get(`/cash-registers?_t=${Date.now()}`)
      .then(res => setRegisters(res.data))
      .catch(console.error);
  };

  if (loading) {
    return (
      <div className="retail-card retail-loader-region">
        <PdvLojistaLoader mode="loader" size={56} label="Carregando histórico de caixas…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <History className="text-brand" size={32} /> Histórico e Auditoria de Caixas
        </h1>
      </div>
      <div className="bg-page border border-line rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-line bg-page/50">
          <h2 className="text-xl font-bold">Relatórios Anteriores</h2>
          <p className="text-muted text-sm mt-1">Acompanhe todos os turnos abertos e fechados na história da loja. Audite eventuais quebras de caixa do passado.</p>
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-page text-muted text-sm">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-left">Status</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-left">Caixa</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-left">Operador</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-left">Abertura</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-left">Fechamento</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Fundo (Início)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Faturamento</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-right">Terminou com</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {registers.map(reg => (
                <tr key={reg.id} className="hover:bg-surface transition-colors group">
                  <td className="px-6 py-5 whitespace-nowrap">
                    {reg.status === 'open' ? (
                       <span className="flex items-center gap-2 text-brand font-bold text-[11px] bg-support px-2.5 py-1 rounded-full border border-brand w-fit tracking-wider"><CheckCircle2 size={14}/> ABERTO</span>
                    ) : reg.closingValue == null ? (
                       <span className="flex items-center gap-2 text-brand font-bold text-[11px] bg-support px-2.5 py-1 rounded-full border border-brand w-fit tracking-wider">PENDENTE DE AUDITORIA</span>
                    ) : (
                       <span className="flex items-center gap-2 text-muted font-bold text-[11px] bg-surface px-2.5 py-1 rounded-full border border-line w-fit tracking-wider"><XCircle size={14}/> FECHADO</span>
                    )}
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap font-bold text-ink">
                    #{reg.code ?? '--'}
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-muted font-medium">
                    {reg.operator?.name || 'Administrador'}
                  </td>
                  <td className="px-6 py-5 text-muted font-medium whitespace-nowrap">
                    {new Date(reg.openingTime).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }).replace(',', ' -')}
                  </td>
                  <td className="px-6 py-5 text-muted whitespace-nowrap">
                    {reg.closingTime ? new Date(reg.closingTime).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }).replace(',', ' -') : '--'}
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-brand">
                    R$ {Number(reg.openingValue || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-brand">
                    R$ {Number(reg.totalSales || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-muted">
                    {reg.status === 'open' ? '--' : reg.closingValue != null ? `R$ ${Number(reg.closingValue).toFixed(2)}` : <span className="text-brand text-xs uppercase">Pendente</span>}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button 
                      onClick={() => setSelectedId(reg.id)}
                      className="p-2 text-muted hover:text-brand hover:bg-support rounded-lg transition-colors inline-block"
                      data-tooltip={reg.status === 'open' ? "Fechar Caixa" : "Ver Auditoria"}
                      aria-label={reg.status === 'open' ? "Fechar Caixa" : "Ver Auditoria"}
                    >
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {registers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">Nenhum caixa encontrado no banco de dados da loja.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="md:hidden divide-y divide-line">
          {registers.map(reg => (
            <div key={reg.id} className="p-5 space-y-4 hover:bg-surface transition-colors">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted font-mono">ID: {reg.id.slice(0, 8)}</span>
                {reg.status === 'open' ? (
                   <span className="flex items-center gap-1.5 text-brand font-bold text-[10px] bg-support px-2.5 py-0.5 rounded-full border border-brand tracking-wider"><CheckCircle2 size={12}/> ABERTO</span>
                ) : reg.closingValue == null ? (
                   <span className="flex items-center gap-1.5 text-brand font-bold text-[10px] bg-support px-2.5 py-0.5 rounded-full border border-brand tracking-wider">PENDENTE</span>
                ) : (
                   <span className="flex items-center gap-1.5 text-muted font-bold text-[10px] bg-surface px-2.5 py-0.5 rounded-full border border-line tracking-wider"><XCircle size={12}/> FECHADO</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted text-xs block">Abertura</span>
                  <span className="text-muted font-medium">{new Date(reg.openingTime).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }).replace(',', ' -')}</span>
                </div>
                <div>
                  <span className="text-muted text-xs block">Fechamento</span>
                  <span className="text-muted font-medium">{reg.closingTime ? new Date(reg.closingTime).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }).replace(',', ' -') : '--'}</span>
                </div>
                <div>
                  <span className="text-muted text-xs block">Fundo (Início)</span>
                  <span className="text-brand font-bold">R$ {Number(reg.openingValue || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted text-xs block">Terminou com</span>
                  <span className="text-muted font-bold">{reg.status === 'open' ? '--' : reg.closingValue != null ? `R$ ${Number(reg.closingValue).toFixed(2)}` : <span className="text-brand uppercase text-[10px]">Pendente</span>}</span>
                </div>
                <div>
                  <span className="text-muted text-xs block">Total Vendas</span>
                  <span className="text-brand font-bold">R$ {Number(reg.totalSales || 0).toFixed(2)}</span>
                </div>
                {reg.operator?.name && (
                  <div>
                    <span className="text-muted text-xs block">Operador</span>
                    <span className="text-muted font-medium truncate block">{reg.operator.name}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => setSelectedId(reg.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-support text-muted rounded-xl text-xs font-semibold transition-colors"
                >
                  <FileText size={14} />
                  {reg.status === 'open' ? "Fechar Caixa" : "Ver Detalhes"}
                </button>
              </div>
            </div>
          ))}
          {registers.length === 0 && (
            <div className="p-8 text-center text-muted text-sm">Nenhum caixa encontrado no banco de dados da loja.</div>
          )}
        </div>
      </div>

      <CloseRegisterModal 
        isOpen={!!selectedId} 
        registerId={selectedId || ''} 
        onClose={handleModalClose}
        isAdminView={true}
      />
    </div>
  );
}
