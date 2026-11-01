import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { FileText, X, AlertOctagon, Receipt, Trash2, EyeOff, Edit2, KeyRound, Unlock, ShieldCheck, SlidersHorizontal, Sparkles, CheckCircle2, RotateCcw, Save } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useShift } from '@/contexts/ShiftContext';
import { usePinAuthStore } from '@/store/pinAuth';
import { EditPaymentModal } from './EditPaymentModal';
import PdvLojistaLoader from './PdvLojistaLoader';

// Mapa de IDs de métodos padrão → nome legível para exibição na auditoria
const METHOD_DISPLAY: Record<string, string> = {
  dinheiro:             'Dinheiro',
  pix:                  'Pix',
  credito:              'Crédito',
  debito:               'Débito',
  credito_loja:         'Crédito na loja',
};

export function CloseRegisterModal({ 
  isOpen, 
  onClose, 
  registerId,
  isAdminView = false,
}: { 
  isOpen: boolean; 
  onClose: (closed: boolean) => void; 
  registerId: string | undefined;
  isAdminView?: boolean;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closingValue, setClosingValue] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1 = auditoria, 2 = confirmação final
  const [mobileTab, setMobileTab] = useState<'summary' | 'sales'>('summary');

  // Estados de Desbloqueio por PIN do Caixa
  const [isUnlockedByPin, setIsUnlockedByPin] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [cashierPinInput, setCashierPinInput] = useState('');
  const [verifyingCashierPin, setVerifyingCashierPin] = useState(false);

  // Estados de Correção Opcional de Recebimentos Digitais (Confirmados/Salvos)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustCredit, setAdjustCredit] = useState('');
  const [adjustDebit, setAdjustDebit] = useState('');
  const [adjustPix, setAdjustPix] = useState('');
  const [adjustCustom, setAdjustCustom] = useState<Record<string, string>>({});
  const [adjustNotes, setAdjustNotes] = useState('');

  // Estados Temporários / Rascunho (Descartados caso feche no 'X' sem salvar)
  const [tempCredit, setTempCredit] = useState('');
  const [tempDebit, setTempDebit] = useState('');
  const [tempPix, setTempPix] = useState('');
  const [tempCustom, setTempCustom] = useState<Record<string, string>>({});
  const [tempNotes, setTempNotes] = useState('');

  const openAdjustModal = () => {
    setTempCredit(adjustCredit);
    setTempDebit(adjustDebit);
    setTempPix(adjustPix);
    setTempCustom({ ...adjustCustom });
    setTempNotes(adjustNotes);
    setAdjustModalOpen(true);
  };

  const { user } = useAuthStore();
  const { operator } = useShift();

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const canSeeTotals = isAdminView 
    ? true 
    : isUnlockedByPin
      ? true
      : isAdmin && !operator 
        ? true 
        : Boolean(data?.register?.operator?.isManager ?? operator?.isManager);

  const handleVerifyCashierPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cashierPinInput || cashierPinInput.length < 4) {
      toast.error('Informe o PIN do Caixa (mínimo 4 dígitos).');
      return;
    }
    if (!registerId) {
      toast.error('Caixa não selecionado para validação de PIN.');
      return;
    }
    setVerifyingCashierPin(true);
    try {
      const res = await api.post('/tenants/me/verify-cashier-pin', { pin: cashierPinInput, registerId });
      if (res.data?.pinAuthToken) {
        usePinAuthStore.getState().setPinAuth(res.data.pinAuthToken);
      }
      setIsUnlockedByPin(true);
      setUnlockModalOpen(false);
      setCashierPinInput('');
      toast.success('Valores e auditoria do caixa desbloqueados com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'PIN do Caixa incorreto.');
      setCashierPinInput('');
    } finally {
      setVerifyingCashierPin(false);
    }
  };

  useEffect(() => {
    const handlePinAuthExpired = () => {
      setIsUnlockedByPin(false);
      setUnlockModalOpen(true);
      toast.error('Sua autorização por PIN expirou. Digite o PIN novamente para continuar.');
    };

    window.addEventListener('pin-auth-expired', handlePinAuthExpired);
    return () => {
      window.removeEventListener('pin-auth-expired', handlePinAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsUnlockedByPin(false);
      usePinAuthStore.getState().clearPinAuth();
    }
  }, [isOpen, registerId]);

  const renderMoney = (
    val: number | string | undefined | null,
    options?: { prefix?: string; sign?: '+' | '-' }
  ) => {
    const prefix = options?.prefix ?? 'R$ ';
    const signStr = options?.sign ? `${options.sign} ` : '';
    if (canSeeTotals) {
      return `${signStr}${prefix}${Number(val || 0).toFixed(2)}`;
    }
    return (
      <span className="tracking-widest font-mono text-muted select-none">
        {signStr}{prefix}•••••
      </span>
    );
  };

  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [editingSale, setEditingSale] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInitiateCancel = (saleId: string) => {
    setCancelSaleId(saleId);
    setCancelReason('');
  };

  const handleCancelSale = async () => {
    if (!cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento.');
      return;
    }
    setCancelling(true);
    try {
      await api.post(`/sales/${cancelSaleId}/cancel`, { reason: cancelReason });
      toast.success('Venda cancelada com sucesso. Estoque e caixa atualizados.');
      
      const res = await api.get(`/cash-registers/${registerId}/report?_t=${Date.now()}`);
      setData(res.data);
      setClosingValue(res.data.report.expectedDinheiro);
      setCancelSaleId(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao cancelar venda.');
    } finally {
      setCancelling(false);
    }
  };

  const loadReport = async (regId = registerId, preserveInputs = false) => {
    if (!regId) return;
    try {
      const res = await api.get(`/cash-registers/${regId}/report?_t=${Date.now()}`);
      setData(res.data);

      if (!preserveInputs) {
        if (res.data.register?.status !== 'closed' || res.data.register?.closingValue == null) {
          setClosingValue(res.data.report?.expectedDinheiro ?? 0);
        } else {
          setClosingValue(Number(res.data.register.closingValue || 0));
        }

        const cDetailsRaw = res.data.register?.closingDetails || res.data.conferenceDetails || res.data.report?.closingDetails || res.data.report?.conferenceDetails;
        if (cDetailsRaw) {
          try {
            const cDetails = typeof cDetailsRaw === 'string' ? JSON.parse(cDetailsRaw) : cDetailsRaw;
            setAdjustCredit(cDetails.declaredCredit != null ? String(cDetails.declaredCredit) : '');
            setAdjustDebit(cDetails.declaredDebit != null ? String(cDetails.declaredDebit) : '');
            setAdjustPix(cDetails.declaredPix != null ? String(cDetails.declaredPix) : '');
            setAdjustCustom(cDetails.declaredCustom || {});
            setAdjustNotes(cDetails.notes || '');
            if (cDetails.declaredCash != null && (res.data.register?.status !== 'closed' || res.data.register?.closingValue == null)) {
              setClosingValue(Number(cDetails.declaredCash));
            }
          } catch {
            // fallback se não for JSON válido
          }
        } else {
          setAdjustCredit('');
          setAdjustDebit('');
          setAdjustPix('');
          setAdjustCustom({});
          setAdjustNotes('');
        }
      }
    } catch {
      toast.error('Falha ao gerar relatório detalhado');
    }
  };

  const handlePaymentEdited = async () => {
    setEditingSale(null);
    setLoading(true);
    try {
      await loadReport();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !registerId) return;
    setLoading(true);
    setData(null);
    setStep(1);
    setMobileTab('summary');
    setIsUnlockedByPin(false);
    setUnlockModalOpen(false);
    setCashierPinInput('');
    setAdjustModalOpen(false);
    loadReport(registerId).finally(() => setLoading(false));
  }, [isOpen, registerId]);

  const hasDigitalAdjustments = Boolean(
    adjustCredit !== '' ||
    adjustDebit !== '' ||
    adjustPix !== '' ||
    Object.keys(adjustCustom).length > 0 ||
    adjustNotes.trim()
  );

  const declaredCreditVal = adjustCredit !== '' ? parseFloat(adjustCredit) || 0 : Number(data?.report?.totalCredito || 0);
  const declaredDebitVal = adjustDebit !== '' ? parseFloat(adjustDebit) || 0 : Number(data?.report?.totalDebito || 0);
  const declaredPixVal = adjustPix !== '' ? parseFloat(adjustPix) || 0 : Number(data?.report?.totalPix || 0);

  const computedTotalDigital = declaredCreditVal + declaredDebitVal + declaredPixVal +
    (data?.report?.customMethods || []).reduce((acc: number, cm: any) => {
      const v = adjustCustom[cm.method] !== undefined ? parseFloat(adjustCustom[cm.method]) || 0 : Number(cm.total || 0);
      return acc + v;
    }, 0);

  const computedTotalVendas = Number(data?.report?.totalDinheiro || 0) + computedTotalDigital;

  if (!isOpen) return null;
  if (!mounted) return null;

  if (!registerId) {
    const fallbackContent = (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/35 backdrop-blur-sm p-4">
        <div className="bg-page border border-line rounded-3xl w-full max-w-md p-8 text-center shadow-2xl">
          <p className="text-muted text-lg">Nenhum caixa aberto no momento.</p>
          <button onClick={() => onClose(false)} className="mt-6 px-6 py-3 rounded-xl bg-surface hover:bg-support text-ink font-bold transition">Fechar</button>
        </div>
      </div>
    );
    return createPortal(fallbackContent, document.body);
  }

  const goToConfirmation = () => {
    setClosingValue(0);
    setStep(2);
  };

  const buildClosingDetailsPayload = (overrideFields?: {
    credit?: string;
    debit?: string;
    pix?: string;
    custom?: Record<string, string>;
    notes?: string;
    cash?: number;
  }) => {
    const cred = overrideFields?.credit !== undefined ? overrideFields.credit : adjustCredit;
    const deb = overrideFields?.debit !== undefined ? overrideFields.debit : adjustDebit;
    const px = overrideFields?.pix !== undefined ? overrideFields.pix : adjustPix;
    const cust = overrideFields?.custom !== undefined ? overrideFields.custom : adjustCustom;
    const nts = overrideFields?.notes !== undefined ? overrideFields.notes : adjustNotes;
    const cashVal = overrideFields?.cash !== undefined ? overrideFields.cash : closingValue;

    const dCred = cred !== '' ? parseFloat(cred) || 0 : Number(data?.report?.totalCredito || 0);
    const dDeb = deb !== '' ? parseFloat(deb) || 0 : Number(data?.report?.totalDebito || 0);
    const dPix = px !== '' ? parseFloat(px) || 0 : Number(data?.report?.totalPix || 0);

    const formattedCustom: Record<string, number> = {};
    if (cust && typeof cust === 'object') {
      for (const [k, v] of Object.entries(cust)) {
        if (v !== '' && v !== undefined && v !== null) {
          formattedCustom[k] = parseFloat(String(v)) || 0;
        }
      }
    }

    const dDigital = dCred + dDeb + dPix +
      (data?.report?.customMethods || []).reduce((acc: number, cm: any) => {
        const v = formattedCustom[cm.method] !== undefined ? formattedCustom[cm.method] : Number(cm.total || 0);
        return acc + v;
      }, 0);

    const totalAjustado = Number(data?.report?.totalDinheiro || 0) + dDigital;
    const originalVendas = Number(data?.report?.totalVendas || 0);

    return {
      declaredCash: cashVal,
      declaredCredit: dCred,
      declaredDebit: dDeb,
      declaredPix: dPix,
      declaredCustom: formattedCustom,
      totalVendasOriginal: originalVendas,
      totalVendasAjustado: totalAjustado,
      diffDigital: totalAjustado - originalVendas,
      notes: nts.trim(),
      adjustedAt: new Date().toISOString(),
      adjustedBy: user?.name || operator?.name || 'Operador',
      dataVersion: data?.dataVersion || data?.report?.dataVersion || '',
    };
  };

  const handleSaveDraft = async () => {
    if (!registerId) return;
    setSubmitting(true);
    try {
      const closingDetails = buildClosingDetailsPayload();
      await api.patch(`/cash-registers/${registerId}/conference`, {
        conferenceDetails: closingDetails,
      });
      toast.success('Rascunho de conferência salvo com sucesso!');
      await loadReport(registerId, true);
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.data?.errorSource === 'version_mismatch') {
        await loadReport(registerId, true);
        toast.error('Novas movimentações foram registradas no caixa. Os totais do sistema foram atualizados, mas seus dados foram preservados. Revise e salve novamente.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao salvar rascunho de conferência');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    setSubmitting(true);
    try {
      const closingDetails = buildClosingDetailsPayload();
      const payload = {
        closingValue: canSeeTotals ? closingValue : null,
        closingDetails,
      };
      await api.post(`/cash-registers/${registerId}/close`, payload);
      toast.success('Caixa encerrado formalmente. Bom descanso!');
      onClose(true);
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.data?.errorSource === 'version_mismatch') {
        await loadReport(registerId, true);
        toast.error('Novas vendas foram registradas durante a conferência. Os valores do sistema foram atualizados, mas suas contagens foram preservadas. Revise e confirme novamente.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao fechar caixa');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAudit = async (customPayload?: any, andClose = false) => {
    setSubmitting(true);
    try {
      const closingDetails = customPayload !== undefined 
        ? buildClosingDetailsPayload(customPayload) 
        : buildClosingDetailsPayload();
      const valToSave = data?.register?.closingValue != null ? Number(data.register.closingValue) : closingValue;
      await api.patch(`/cash-registers/${registerId}/audit`, {
        closingValue: valToSave,
        closingDetails,
      });
      toast.success('Auditoria e ajustes salvos com sucesso!');
      if (andClose) {
        onClose(true);
      } else {
        await loadReport(registerId, true);
      }
      return true;
    } catch (err: any) {
      if (err.response?.status === 409 || err.response?.data?.errorSource === 'version_mismatch') {
        await loadReport(registerId, true);
        toast.error('Novas movimentações foram registradas no caixa. Os dados do sistema foram atualizados, mas suas contagens foram preservadas. Revise e confirme novamente.');
      } else {
        toast.error(err.response?.data?.message || 'Erro ao salvar auditoria');
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const modalBody = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/35 backdrop-blur-sm p-4 lg:p-8 transition-all">
      <div className="bg-page border border-line rounded-[2rem] w-full max-w-6xl shadow-[0_0_100px_color-mix(in srgb, #7C3AED 10%, transparent)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col h-full max-h-[95vh] lg:max-h-[90vh]">
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-line bg-page/50 shrink-0">
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3"><FileText className="text-brand" /> Auditoria de Fechamento</h2>
          <button onClick={() => onClose(false)} aria-label="Fechar" data-tooltip="Fechar" className="p-2 hover:bg-surface rounded-full text-muted hover:text-ink transition-colors"><X size={24}/></button>
        </div>

        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center" role="status" aria-busy="true">
            <PdvLojistaLoader mode="loader" size={48} label="Carregando auditoria de caixa…" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Abas responsivas para Mobile */}
            <div className="flex lg:hidden border-b border-line bg-page/80 p-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab('summary')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileTab === 'summary'
                    ? 'bg-brand text-on-brand shadow-md shadow-line'
                    : 'bg-page text-muted hover:text-muted'
                }`}
              >
                <FileText size={15} /> Resumo Financeiro
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('sales')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileTab === 'sales'
                    ? 'bg-brand text-on-brand shadow-md shadow-line'
                    : 'bg-page text-muted hover:text-muted'
                }`}
              >
                <Receipt size={15} /> Vendas ({data?.report?.countSales || 0})
              </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
              {/* Lado Esquerdo: Resumo Financeiro e Declaração */}
              <div className={`w-full lg:w-[45%] h-auto lg:h-full flex-col border-b lg:border-b-0 lg:border-r border-line bg-page lg:overflow-y-auto custom-scrollbar shrink-0 ${
                mobileTab === 'summary' ? 'flex' : 'hidden lg:flex'
              }`}>
                <div className="p-4 md:p-6 space-y-4 md:space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                  {isUnlockedByPin && (
                    <div className="flex items-center justify-between p-3 bg-support border border-brand rounded-2xl text-brand text-xs font-bold animate-in fade-in duration-200">
                      <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-brand" /> Auditoria Desbloqueada via PIN</span>
                      <span className="text-[10px] uppercase bg-support px-2 py-0.5 rounded font-mono">Visão Completa</span>
                    </div>
                  )}

                  {(data?.conferenceIsStale || data?.report?.conferenceIsStale) && (
                    <div className="flex items-center gap-2.5 p-3 bg-support border border-brand rounded-2xl text-brand text-xs font-semibold animate-in fade-in duration-200">
                      <AlertOctagon size={16} className="shrink-0 text-brand" />
                      <span>Novas vendas ou movimentações foram registradas após o último rascunho de conferência. Os dados do sistema foram atualizados.</span>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-muted pb-2 border-b border-line">
                    <span>
                      Abertura: <strong className="text-muted text-sm ml-1">{new Date(data.register.openingTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</strong>
                      {data.register.operator?.name && (
                        <span className="ml-1.5 text-brand font-semibold">({data.register.operator.name})</span>
                      )}
                    </span>
                    <span>Vendas do Turno: <strong className="text-muted text-sm ml-1">{data.report.countSales}</strong></span>
                  </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between p-4 bg-page rounded-2xl border border-line">
                    <span className="text-muted">Fundo de Troco (Inicial)</span>
                    <span className="font-bold text-ink">{renderMoney(data.register.openingValue)}</span>
                  </div>
                  
                  <div className="flex justify-between p-4 bg-support text-brand rounded-2xl border border-brand">
                    <span>(+) Recebimentos em Dinheiro Físico</span>
                    <span className="font-bold text-lg">{renderMoney(data.report.totalDinheiro, { sign: '+' })}</span>
                  </div>
                  
                  {data.report.totalSuprimentos > 0 && (
                    <div className="flex flex-col p-4 bg-support text-brand rounded-2xl border border-brand">
                      <div className="flex justify-between items-center w-full border-b border-brand pb-2 mb-2">
                        <span>(+) Suprimentos Injetados (Reforço)</span>
                        <span className="font-bold text-lg">{renderMoney(data.report.totalSuprimentos, { sign: '+' })}</span>
                      </div>
                      <div className="space-y-1.5 mt-1">
                        {data.report.movements.filter((m: any) => m.type === 'IN').map((m: any) => (
                           <div key={m.id} className="flex justify-between text-xs text-brand items-center">
                             <div className="flex items-center gap-2">
                               <span className="bg-support px-1.5 py-0.5 rounded font-mono border border-brand">{new Date(m.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                               <span className="line-clamp-1">{m.reason || 'Sem descrição informada'}</span>
                             </div>
                             <span className="font-bold whitespace-nowrap">{renderMoney(m.value)}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.report.totalSangrias > 0 && (
                    <div className="flex flex-col p-4 bg-support text-brand rounded-2xl border border-brand">
                      <div className="flex justify-between items-center w-full border-b border-brand pb-2 mb-2">
                        <span>(-) Sangrias Transferidas (Vales, etc)</span>
                        <span className="font-bold text-lg">{renderMoney(data.report.totalSangrias, { sign: '-' })}</span>
                      </div>
                      <div className="space-y-1.5 mt-1">
                        {data.report.movements.filter((m: any) => m.type === 'OUT').map((m: any) => (
                           <div key={m.id} className="flex justify-between text-xs text-brand items-center">
                             <div className="flex items-center gap-2">
                               <span className="bg-support px-1.5 py-0.5 rounded font-mono border border-brand">{new Date(m.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                               <span className="line-clamp-1">{m.reason || 'Sem descrição informada'}</span>
                             </div>
                             <span className="font-bold whitespace-nowrap">{renderMoney(m.value)}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2 p-4 bg-page/50 rounded-2xl border border-line text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-muted font-bold uppercase text-[10px] tracking-widest">Recebimentos Digitais (Em Conta)</p>
                      {canSeeTotals && (
                        <button
                          type="button"
                          onClick={openAdjustModal}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-brand hover:text-brand bg-support hover:bg-support border border-brand px-2.5 py-1 rounded-xl transition cursor-pointer"
                          data-tooltip="Corrigir valores reais apurados na maquininha / extrato"
                        >
                          <SlidersHorizontal size={12} />
                          {hasDigitalAdjustments ? 'Ajustado (Editar)' : 'Corrigir Valores'}
                        </button>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-brand">
                      <span>Cartão de Crédito</span>
                      <div className="text-right">
                        <span className="font-bold">{renderMoney(adjustCredit !== '' ? parseFloat(adjustCredit) || 0 : data.report.totalCredito || 0)}</span>
                        {adjustCredit !== '' && canSeeTotals && (
                          <span className="text-[10px] text-muted block">Sistema: R$ {Number(data.report.totalCredito || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-brand">
                      <span>Cartão de Débito</span>
                      <div className="text-right">
                        <span className="font-bold">{renderMoney(adjustDebit !== '' ? parseFloat(adjustDebit) || 0 : data.report.totalDebito || 0)}</span>
                        {adjustDebit !== '' && canSeeTotals && (
                          <span className="text-[10px] text-muted block">Sistema: R$ {Number(data.report.totalDebito || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-brand">
                      <span>Transferências (Pix)</span>
                      <div className="text-right">
                        <span className="font-bold">{renderMoney(adjustPix !== '' ? parseFloat(adjustPix) || 0 : data.report.totalPix || 0)}</span>
                        {adjustPix !== '' && canSeeTotals && (
                          <span className="text-[10px] text-muted block">Sistema: R$ {Number(data.report.totalPix || 0).toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    {(data.report.customMethods || []).map((cm: any) => {
                      const customVal = adjustCustom[cm.method] !== undefined ? parseFloat(adjustCustom[cm.method]) || 0 : Number(cm.total || 0);
                      return (
                        <div key={cm.method} className="flex justify-between items-center text-brand">
                          <span>{cm.label}</span>
                          <div className="text-right">
                            <span className="font-bold">{renderMoney(customVal)}</span>
                            {adjustCustom[cm.method] !== undefined && canSeeTotals && (
                              <span className="text-[10px] text-muted block">Sistema: R$ {Number(cm.total || 0).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {hasDigitalAdjustments && adjustNotes && (
                      <div className="pt-2 border-t border-line text-[11px] text-brand italic">
                        Obs: {adjustNotes}
                      </div>
                    )}
                  </div>

                  {Array.isArray(data.report.salesByOperator) && data.report.salesByOperator.length > 0 && (
                    <div className="space-y-2 p-4 bg-page/50 rounded-2xl border border-line text-sm">
                      <p className="text-muted font-bold uppercase text-[10px] tracking-widest mb-1">
                        Vendas por Funcionário neste Turno
                      </p>
                      {data.report.salesByOperator.map((opStat: any) => (
                        <div key={opStat.operatorId} className="flex justify-between items-center text-ink">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold truncate">{opStat.operatorName}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-support text-brand border border-brand">
                              {opStat.countSales} {opStat.countSales === 1 ? 'venda' : 'vendas'}
                            </span>
                          </div>
                          <span className="font-bold text-brand whitespace-nowrap">
                            {renderMoney(opStat.totalSales)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {canSeeTotals && (
                    <div className="flex justify-between p-4 bg-surface text-ink rounded-2xl border border-line mt-4">
                      <div>
                        <span className="text-muted font-bold block">Faturamento Bruto</span>
                        <span className="text-xs text-muted block">
                          {hasDigitalAdjustments ? (
                            <span className="text-brand font-medium">Ajustado (Sistema: R$ {Number(data.report.totalVendas || 0).toFixed(2)})</span>
                          ) : (
                            'Todas transações da sessão'
                          )}
                        </span>
                      </div>
                      <span className="font-black text-xl self-center text-brand">
                        R$ {computedTotalVendas.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {canSeeTotals ? (
                  <div className="p-5 border-l-4 border-l-brand bg-support rounded-r-2xl border border-brand">
                    <p className="text-xs text-brand font-extrabold uppercase tracking-widest mb-2">Total Esperado na Gaveta</p>
                    <p className="text-4xl font-black text-brand drop-shadow-sm">R$ {Number(data.report.expectedDinheiro).toFixed(2)}</p>
                  </div>
                ) : (
                  <div className="p-5 border-l-4 border-l-brand bg-support rounded-r-2xl border border-brand space-y-3">
                    <p className="text-xs text-brand font-extrabold uppercase flex items-center gap-2"><EyeOff size={14}/> Auditoria Cega</p>
                    <p className="text-muted text-sm">Você não tem acesso ao valor esperado. O gerente fará a conferência da gaveta no fechamento.</p>
                    <button
                      type="button"
                      onClick={() => setUnlockModalOpen(true)}
                      className="w-full py-2.5 px-4 bg-brand hover:bg-brand text-on-brand rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-line mt-1 hover:text-on-brand"
                    >
                      <KeyRound size={14} /> Inserir PIN do Caixa para Revelar
                    </button>
                  </div>
                )}

                {data.register.status === 'closed' ? (
                  <div className="pt-4 text-center bg-page rounded-[2rem] p-6 border border-line shadow-inner">
                     {data.register.closingValue == null ? (
                       canSeeTotals ? (
                         <div className="text-left">
                           <p className="text-brand font-bold mb-2 flex items-center gap-2"><AlertOctagon size={16}/> Pendente de Auditoria</p>
                           <p className="text-muted text-sm mb-4">Este caixa foi fechado às cegas por um operador. Insira a contagem da gaveta para finalizar a auditoria.</p>
                           <div className="flex gap-2">
                             <input 
                               type="number" 
                               step="0.01"
                               value={closingValue || ''}
                               onChange={e => setClosingValue(parseFloat(e.target.value) || 0)}
                               placeholder="R$ 0,00"
                               className="flex-1 bg-page border border-line rounded-xl px-4 py-3 text-ink font-bold"
                             />
                             <button 
                               onClick={() => void handleAudit()}
                               disabled={submitting}
                               className="bg-brand hover:bg-brand text-on-brand font-bold px-6 rounded-xl flex items-center gap-2 hover:text-on-brand"
                             >
                               {submitting ? <PdvLojistaLoader mode="loader" compact size={16} /> : 'Auditar'}
                             </button>
                           </div>
                         </div>
                       ) : (
                         <p className="text-brand font-bold flex justify-center gap-2 items-center"><AlertOctagon size={18}/> Fechamento Pendente de Auditoria</p>
                       )
                     ) : (
                       <>
                         <p className="text-muted text-sm">Este caixa já foi auditado e encerrado formalmente.</p>
                         <p className="text-brand font-black text-2xl mt-4 flex justify-center gap-2 items-center">
                           Declarado: R$ {Number(data.register.closingValue).toFixed(2)}
                         </p>
                         {Number(data.register.closingValue) !== Number(data.report.expectedDinheiro) && (
                            <p className="text-brand text-sm mt-4 border border-brand bg-support inline-block px-4 py-2 rounded-full font-bold">
                              <AlertOctagon size={16} className="inline mr-1 -mt-0.5"/> Diferença Constatada (Quebra): R$ {(Number(data.register.closingValue) - Number(data.report.expectedDinheiro)).toFixed(2)}
                            </p>
                         )}
                       </>
                     )}
                  </div>
                ) : (
                  <div className="pt-2 p-4 bg-page rounded-2xl border border-line text-center">
                    <p className="text-muted text-xs uppercase tracking-wider">Próximo passo</p>
                    <p className="text-muted text-sm mt-1">{canSeeTotals ? 'Você irá conferir e digitar o valor físico da gaveta na próxima tela.' : 'Você irá encerrar este turno definitivamente na próxima tela.'}</p>
                  </div>
                )}
                
                {data.register.status === 'closed' ? (
                  <div className="flex gap-3 mt-4">
                    {isAdmin && (
                      <button 
                        onClick={() => void handleAudit(undefined, true)}
                        disabled={submitting}
                        className="flex-1 py-4 rounded-2xl font-bold bg-brand hover:bg-brand disabled:opacity-60 text-on-brand transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-line active:scale-95 cursor-pointer hover:text-on-brand"
                      >
                        {submitting ? <PdvLojistaLoader mode="loader" compact size={18} /> : <Save size={18}/>}
                        Salvar Auditoria
                      </button>
                    )}
                    <button 
                      onClick={() => onClose(true)}
                      className={`${isAdmin ? 'px-6' : 'w-full'} py-4 rounded-2xl font-bold bg-surface hover:bg-support text-ink transition-all flex items-center justify-center gap-2 text-base cursor-pointer`}
                    >
                      Fechar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-4">
                    {canSeeTotals && (
                      <button 
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={submitting}
                        className="py-5 px-4 rounded-2xl font-bold bg-surface hover:bg-support disabled:opacity-60 text-muted transition-all flex items-center justify-center gap-2 text-sm cursor-pointer border border-line shadow-md active:scale-95"
                        data-tooltip="Salvar rascunho de conferência"
                      >
                        {submitting ? <PdvLojistaLoader mode="loader" compact size={18} /> : <Save size={18}/>}
                        Salvar Rascunho
                      </button>
                    )}
                    <button 
                      onClick={goToConfirmation}
                      className="flex-1 py-5 rounded-2xl font-bold bg-brand hover:bg-brand text-on-brand transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-lg hover:text-on-brand"
                    >
                      Confirmar Gaveta e Continuar →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Lado Direito: Transações Detalhadas (Painel Rolável Grande) */}
            <div className={`w-full lg:w-[55%] h-auto lg:h-full flex-col bg-page/80 shrink-0 ${
              mobileTab === 'sales' ? 'flex' : 'hidden lg:flex'
            }`}>
              <div className="p-4 md:p-6 border-b border-line flex items-center gap-3 bg-page">
                 <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-muted">
                   <Receipt size={22}/>
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-ink tracking-tight">Registro Individual de Operações</h3>
                    <p className="text-muted text-xs mt-0.5">Todas as {data.report.countSales} transações logadas neste turno.</p>
                 </div>
              </div>
              
              <div className="flex-1 h-auto lg:h-full overflow-y-visible lg:overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4 animate-fade-in">
                {data.report.salesDetails && data.report.salesDetails.length > 0 ? (
                  data.report.salesDetails.map((s: any) => (
                    <div key={s.id} className={`bg-page/50 border border-line rounded-2xl p-4 md:p-5 hover:border-line transition-all group relative overflow-hidden ${s.status === 'cancelled' ? 'opacity-40 border-brand' : ''}`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.status === 'cancelled' ? 'bg-support' : 'bg-surface group-hover:bg-brand hover:text-on-brand'} transition-colors`}></div>
                      
                      <div className="flex justify-between items-start mb-4 border-b border-line pb-4">
                        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                          <span className="font-bold text-muted bg-page px-2.5 py-1 rounded-lg border border-line shadow-inner text-xs tracking-wider">
                             {new Date(s.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                          </span>
                          <span className="text-muted text-[11px] font-mono bg-page px-2 py-0.5 rounded">ID: {s.id.split('-')[0]}</span>
                          {s.operator?.name && (
                            <span className="bg-support text-brand text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-brand">
                              Vendedor: {s.operator.name}
                            </span>
                          )}
                          {s.status === 'cancelled' && (
                            <span className="bg-support text-brand text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-brand">
                              Cancelada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className={`font-extrabold text-lg md:text-xl ${s.status === 'cancelled' ? 'text-muted line-through decoration-brand decoration-2' : 'text-brand'}`}>
                            R$ {Number(s.total || 0).toFixed(2)}
                          </span>
                          {isAdmin && s.status !== 'cancelled' && data.register.status === 'open' && (
                            <button
                              onClick={() => handleInitiateCancel(s.id)}
                              className="p-2 md:p-1.5 bg-support hover:bg-brand text-brand hover:text-on-brand rounded-xl md:rounded-lg transition-all border border-brand shadow-lg active:scale-95 cursor-pointer ml-1"
                              data-tooltip="Cancelar Venda"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <ul className="text-muted text-sm space-y-2 mb-5 ml-1">
                        {s.items.map((i: any) => (
                          <li key={i.id} className="flex items-center gap-3 p-2 hover:bg-surface rounded-lg transition-colors">
                             <span className="text-ink font-bold bg-surface px-2 py-0.5 rounded text-xs">{i.quantity}x</span> 
                             <span className={`flex-1 font-medium text-xs md:text-sm ${s.status === 'cancelled' ? 'line-through text-muted' : ''}`}>{i.product?.name || 'Item Removido/Desconhecido'}</span>
                             <span className="text-muted font-mono text-xs">R$ {(Number(i.priceUnit || 0) * Number(i.quantity || 0)).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="flex items-center justify-between gap-4 pt-4 border-t border-line">
                        <div className="flex flex-wrap gap-2">
                          {s.payments.map((p: any, idx: number) => (
                            <span key={idx} className="bg-support text-brand text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg border border-brand tracking-wider">
                              {p.label || METHOD_DISPLAY[p.method] || p.method} (R$ {Number(p.value || 0).toFixed(2)})
                            </span>
                          ))}
                        </div>
                        {s.status !== 'cancelled' && data.register.status === 'open' && (
                          <button
                            onClick={() => setEditingSale(s)}
                            className="p-2 md:p-1.5 text-muted hover:text-brand hover:bg-support rounded-xl md:rounded-lg transition-colors border border-transparent hover:border-brand shrink-0"
                            data-tooltip="Editar Pagamento"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </div>

                      {s.status === 'cancelled' && s.cancelReason && (
                        <div className="mt-3 p-3 bg-support rounded-xl border border-brand text-xs text-brand animate-in fade-in slide-in-from-top-1 duration-200">
                          <strong>Motivo do Cancelamento:</strong> {s.cancelReason}
                          {s.cancelledAt && (
                            <span className="block mt-1 text-[10px] text-muted">
                              Cancelado em: {new Date(s.cancelledAt).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted space-y-4 py-20">
                    <div className="w-24 h-24 rounded-full bg-page border border-line flex items-center justify-center shadow-inner">
                      <Receipt size={40} className="text-muted"/>
                    </div>
                    <p className="font-medium text-muted">Nenhuma transação efetuada nesta sessão.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
        )}
      </div>

      <EditPaymentModal
        isOpen={!!editingSale}
        onClose={() => setEditingSale(null)}
        onSuccess={handlePaymentEdited}
        sale={editingSale}
      />

      {/* ═══ PASSO 2 — Confirmação Final de Fechamento ═══ */}
      {step === 2 && data && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-page border border-line rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-line bg-page">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-support border border-brand rounded-xl flex items-center justify-center">
                  <FileText className="text-brand" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-ink tracking-tight">Confirmação de Fechamento</h2>
                  <p className="text-xs text-muted mt-0.5">Revise os dados antes de encerrar definitivamente</p>
                </div>
              </div>
              <button onClick={() => setStep(1)} className="p-2 hover:bg-surface rounded-full text-muted hover:text-ink transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh] custom-scrollbar">

              {!canSeeTotals && (
                <div className="bg-support border border-brand rounded-xl p-4 flex items-center gap-3">
                  <EyeOff className="text-brand shrink-0" size={20} />
                  <div>
                    <p className="text-brand font-bold text-sm">Fechamento com Auditoria Cega</p>
                    <p className="text-muted text-xs mt-0.5">Os valores do turno foram registrados no sistema. A conferência da gaveta será realizada pelo gerente.</p>
                  </div>
                </div>
              )}

              {canSeeTotals && (
                <div className="bg-page border border-line focus-within:border-brand rounded-xl p-5 transition-colors">
                  <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-3">Valor Físico em Caixa</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-black text-xl">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      autoFocus
                      value={closingValue || ''}
                      onChange={e => setClosingValue(parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="w-full bg-page border border-line rounded-xl py-3 pl-14 pr-4 text-2xl font-black text-ink focus:outline-none focus:border-brand transition-colors shadow-inner placeholder:text-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none m-0"
                      style={{ WebkitAppearance: 'none', margin: 0 }}
                    />
                  </div>
                </div>
              )}

              {closingValue > 0 && (() => {
                const diff = closingValue - Number(data.report.expectedDinheiro);
                const bateu = Math.abs(diff) < 0.01;
                const sobra = diff > 0.01;
                return (
                  <div className="rounded-xl p-4 border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 bg-support border-brand">
                    <div>
                      {bateu ? (
                        <>
                          <p className="text-brand font-bold text-sm">Sem divergências</p>
                          <p className="text-muted text-xs mt-0.5">O valor físico bate com o sistema.</p>
                        </>
                      ) : sobra ? (
                        <>
                          <p className="text-brand font-bold text-sm">Sobra de R$ {diff.toFixed(2)}</p>
                          <p className="text-muted text-xs mt-0.5">O valor físico excede o esperado.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-brand font-bold text-sm">Quebra de R$ {Math.abs(diff).toFixed(2)}</p>
                          <p className="text-muted text-xs mt-0.5">O valor físico está abaixo do esperado.</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Dinheiro Físico */}
                <div className="bg-page border border-line rounded-xl p-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Dinheiro Físico</p>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Fundo inicial</span>
                    <span className="text-ink font-medium">{renderMoney(data.register.openingValue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Vendas físicas</span>
                    <span className="text-brand font-medium">{renderMoney(data.report.totalDinheiro, { sign: '+' })}</span>
                  </div>
                  {data.report.totalSuprimentos > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Suprimentos</span>
                      <span className="text-brand font-medium">{renderMoney(data.report.totalSuprimentos, { sign: '+' })}</span>
                    </div>
                  )}
                  {data.report.totalSangrias > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Sangrias</span>
                      <span className="text-brand font-medium">{renderMoney(data.report.totalSangrias, { sign: '-' })}</span>
                    </div>
                  )}
                  {canSeeTotals && (
                    <div className="border-t border-line pt-2.5 mt-2.5 flex justify-between items-center">
                      <span className="text-muted text-xs font-bold">Total Esperado</span>
                      <span className="text-ink font-bold text-sm">R$ {Number(data.report.expectedDinheiro).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Recebimentos Digitais */}
                <div className="bg-page border border-line rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Recebimentos Digitais</p>
                    {hasDigitalAdjustments && (
                      <span className="text-[9px] font-bold uppercase bg-support text-brand border border-brand px-1.5 py-0.5 rounded">
                        Valores Ajustados
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Crédito</span>
                    <div className="text-right">
                      <span className="text-ink font-medium">{renderMoney(adjustCredit !== '' ? parseFloat(adjustCredit) || 0 : data.report.totalCredito || 0)}</span>
                      {adjustCredit !== '' && canSeeTotals && (
                        <span className="text-[10px] text-muted block">Sistema: R$ {Number(data.report.totalCredito || 0).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Débito</span>
                    <div className="text-right">
                      <span className="text-ink font-medium">{renderMoney(adjustDebit !== '' ? parseFloat(adjustDebit) || 0 : data.report.totalDebito || 0)}</span>
                      {adjustDebit !== '' && canSeeTotals && (
                        <span className="text-[10px] text-muted block">Sistema: R$ {Number(data.report.totalDebito || 0).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Pix</span>
                    <div className="text-right">
                      <span className="text-ink font-medium">{renderMoney(adjustPix !== '' ? parseFloat(adjustPix) || 0 : data.report.totalPix || 0)}</span>
                      {adjustPix !== '' && canSeeTotals && (
                        <span className="text-[10px] text-muted block">Sistema: R$ {Number(data.report.totalPix || 0).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  {(data.report.customMethods || []).map((cm: any) => {
                    const customVal = adjustCustom[cm.method] !== undefined ? parseFloat(adjustCustom[cm.method]) || 0 : Number(cm.total || 0);
                    return (
                      <div key={cm.method} className="flex justify-between items-center text-xs">
                        <span className="text-muted">{cm.label}</span>
                        <div className="text-right">
                          <span className="text-ink font-medium">{renderMoney(customVal)}</span>
                          {adjustCustom[cm.method] !== undefined && canSeeTotals && (
                            <span className="text-[10px] text-muted block">Sistema: R$ {Number(cm.total || 0).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-line pt-2.5 mt-2.5 flex justify-between items-center">
                    <span className="text-muted text-xs font-bold">Total Digital</span>
                    <span className="text-ink font-bold text-sm">
                      {renderMoney(computedTotalDigital)}
                    </span>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-between items-center bg-page border border-line rounded-xl px-4 py-3">
                  <div>
                    <span className="text-muted text-xs font-bold uppercase block">Faturamento do Turno</span>
                    {hasDigitalAdjustments && (
                      <span className="text-[10px] text-brand block">Original do Sistema: R$ {Number(data.report.totalVendas || 0).toFixed(2)}</span>
                    )}
                  </div>
                  <span className="text-brand font-black text-xl">R$ {computedTotalVendas.toFixed(2)}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl font-bold bg-surface hover:bg-support text-ink transition-all text-sm"
                >
                  Voltar
                </button>
                <button
                  onClick={handleClose}
                  disabled={submitting}
                  className="flex-[2] py-3 rounded-xl font-bold bg-brand hover:bg-brand disabled:opacity-60 text-on-brand transition-all active:scale-95 flex items-center justify-center gap-2 text-sm hover:text-on-brand"
                >
                  {submitting ? <PdvLojistaLoader mode="loader" compact size={16} /> : 'Encerrar Caixa'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal de Confirmação de Cancelamento de Venda ═══ */}
      {cancelSaleId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-page border border-brand rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="flex items-center justify-between p-5 border-b border-line bg-support">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-page border border-brand rounded-xl flex items-center justify-center">
                  <Trash2 className="text-brand" size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-base">Cancelar Venda</h4>
                  <p className="text-xs text-muted mt-0.5">Esta ação irá estornar o estoque automaticamente</p>
                </div>
              </div>
              <button
                onClick={() => setCancelSaleId(null)}
                className="p-1.5 hover:bg-surface rounded-full text-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-muted text-xs font-semibold uppercase tracking-wider block mb-2">
                  Motivo do Cancelamento <span className="text-brand">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Ex: Pedido errado, cliente desistiu, lançamento duplicado..."
                  rows={3}
                  autoFocus
                  className="w-full bg-page border border-line focus:border-brand rounded-xl px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="bg-support border border-brand rounded-xl p-3 flex items-start gap-2">
                <AlertOctagon size={14} className="text-brand mt-0.5 shrink-0" />
                <p className="text-xs text-brand">
                  O estoque dos produtos será estornado automaticamente e a venda ficará marcada como cancelada no histórico.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-line">
              <button
                onClick={() => setCancelSaleId(null)}
                disabled={cancelling}
                className="flex-1 py-3 rounded-xl font-bold bg-surface hover:bg-support disabled:opacity-50 text-ink transition-all text-sm cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelSale}
                disabled={cancelling || !cancelReason.trim()}
                className="flex-[2] py-3 rounded-xl font-bold bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-on-brand transition-all active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer hover:text-on-brand"
              >
                {cancelling ? <PdvLojistaLoader mode="loader" compact size={16} /> : <Trash2 size={16} />}
                {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal de Inserção de PIN do Caixa / Gerente para Revelar Valores ═══ */}
      {unlockModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-page border border-line rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-line flex items-center justify-between bg-page">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-support flex items-center justify-center border border-brand">
                  <KeyRound size={20} className="text-brand" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">PIN do Caixa</h3>
                  <p className="text-xs text-muted">Revelar valores e auditoria</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setUnlockModalOpen(false); setCashierPinInput(''); }}
                className="p-1.5 hover:bg-surface rounded-full text-muted hover:text-ink transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyCashierPin} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-2 text-center">
                  Digite o PIN do Caixa ou do Gerente
                </label>
                <input
                  type="password"
                  autoFocus
                  value={cashierPinInput}
                  onChange={e => setCashierPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••"
                  className="w-full bg-page border-2 border-line focus:border-brand rounded-2xl px-4 py-3.5 text-center text-3xl tracking-[0.5em] font-mono font-bold text-ink outline-none transition-all"
                  maxLength={8}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setUnlockModalOpen(false); setCashierPinInput(''); }}
                  className="flex-1 py-3 rounded-xl border border-line text-muted hover:bg-surface transition font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={verifyingCashierPin || cashierPinInput.length < 4}
                  className="flex-1 py-3 rounded-xl bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-on-brand font-bold transition active:scale-95 text-sm flex items-center justify-center gap-2 shadow-lg shadow-line cursor-pointer hover:text-on-brand"
                >
                  {verifyingCashierPin ? <PdvLojistaLoader mode="loader" compact size={16} /> : <Unlock size={16} />}
                  Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal de Ajuste/Conferência Opcional de Recebimentos Digitais ═══ */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-page border border-line rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-line flex items-center justify-between bg-page shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-support flex items-center justify-center border border-brand text-brand">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">Conferência de Recebimentos Digitais</h3>
                  <p className="text-xs text-muted">Ajuste opcional com base na maquininha / extrato</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="p-1.5 hover:bg-surface rounded-full text-muted hover:text-ink transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="p-3.5 bg-surface border border-line rounded-2xl text-xs text-muted space-y-1">
                <p className="font-semibold text-ink flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand" />
                  Como funciona a correção de valores?
                </p>
                <p className="text-muted leading-relaxed">
                  Caso algum pagamento tenha sido lançado no método incorreto pelo operador no PDV, você pode declarar os valores reais apurados. O faturamento e os relatórios do caixa refletirão os valores reais declarados.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-brand">Cartão de Crédito Real</label>
                  <span className="text-muted">Sistema: R$ {Number(data.report.totalCredito || 0).toFixed(2)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tempCredit}
                    onChange={e => setTempCredit(e.target.value)}
                    placeholder={Number(data.report.totalCredito || 0).toFixed(2)}
                    className="w-full bg-page border border-line focus:border-brand rounded-xl py-2.5 pl-10 pr-4 text-ink font-bold text-base outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-brand">Cartão de Débito Real</label>
                  <span className="text-muted">Sistema: R$ {Number(data.report.totalDebito || 0).toFixed(2)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tempDebit}
                    onChange={e => setTempDebit(e.target.value)}
                    placeholder={Number(data.report.totalDebito || 0).toFixed(2)}
                    className="w-full bg-page border border-line focus:border-brand rounded-xl py-2.5 pl-10 pr-4 text-ink font-bold text-base outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-brand">Transferências (Pix) Real</label>
                  <span className="text-muted">Sistema: R$ {Number(data.report.totalPix || 0).toFixed(2)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tempPix}
                    onChange={e => setTempPix(e.target.value)}
                    placeholder={Number(data.report.totalPix || 0).toFixed(2)}
                    className="w-full bg-page border border-line focus:border-brand rounded-xl py-2.5 pl-10 pr-4 text-ink font-bold text-base outline-none transition"
                  />
                </div>
              </div>

              {(data.report.customMethods || []).map((cm: any) => (
                <div key={cm.method} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-brand">{cm.label} Real</label>
                    <span className="text-muted">Sistema: R$ {Number(cm.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={tempCustom[cm.method] ?? ''}
                      onChange={e => setTempCustom({ ...tempCustom, [cm.method]: e.target.value })}
                      placeholder={Number(cm.total || 0).toFixed(2)}
                      className="w-full bg-page border border-line focus:border-brand rounded-xl py-2.5 pl-10 pr-4 text-ink font-bold text-base outline-none transition"
                    />
                  </div>
                </div>
              ))}

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-muted block">Justificativa / Observação (Opcional)</label>
                <input
                  value={tempNotes}
                  onChange={e => setTempNotes(e.target.value)}
                  placeholder="Ex: Diferença de R$ 1,50 decorrente de erro na seleção de cartão no PDV"
                  className="w-full bg-page border border-line focus:border-brand rounded-xl px-4 py-2.5 text-xs text-ink outline-none transition placeholder:text-muted"
                />
              </div>

              {(() => {
                const tempDeclaredCreditVal = tempCredit !== '' ? parseFloat(tempCredit) || 0 : Number(data?.report?.totalCredito || 0);
                const tempDeclaredDebitVal = tempDebit !== '' ? parseFloat(tempDebit) || 0 : Number(data?.report?.totalDebito || 0);
                const tempDeclaredPixVal = tempPix !== '' ? parseFloat(tempPix) || 0 : Number(data?.report?.totalPix || 0);
                const tempDigitalVal = tempDeclaredCreditVal + tempDeclaredDebitVal + tempDeclaredPixVal +
                  (data?.report?.customMethods || []).reduce((acc: number, cm: any) => {
                    const v = tempCustom[cm.method] !== undefined ? parseFloat(tempCustom[cm.method]) || 0 : Number(cm.total || 0);
                    return acc + v;
                  }, 0);
                const tempTotalVendas = Number(data?.report?.totalDinheiro || 0) + tempDigitalVal;
                const tempDiff = tempTotalVendas - Number(data?.report?.totalVendas || 0);

                return (
                  <div className="p-4 bg-surface border border-line rounded-2xl space-y-2">
                    <div className="flex justify-between text-xs text-muted">
                      <span>Faturamento Original (Sistema):</span>
                      <span className="font-semibold text-ink">R$ {Number(data.report.totalVendas || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Variação Total (Diferença):</span>
                      <span className="font-bold text-brand">
                        {tempDiff >= 0 ? '+' : ''} R$ {tempDiff.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-line pt-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-ink">Faturamento Real Declarado:</span>
                      <span className="text-lg font-black text-brand">R$ {tempTotalVendas.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-5 border-t border-line flex gap-3 shrink-0 bg-page">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setTempCredit('');
                  setTempDebit('');
                  setTempPix('');
                  setTempCustom({});
                  setTempNotes('');
                  toast.info('Valores redefinidos para o padrão original. Clique em Aplicar para confirmar.');
                }}
                className="py-3 px-4 rounded-xl border border-line hover:bg-surface disabled:opacity-60 text-muted hover:text-ink transition font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                data-tooltip="Limpar rascunho e usar valores originais"
              >
                <RotateCcw size={14} /> Restaurar Padrão
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setAdjustCredit(tempCredit);
                  setAdjustDebit(tempDebit);
                  setAdjustPix(tempPix);
                  setAdjustCustom(tempCustom);
                  setAdjustNotes(tempNotes);
                  setAdjustModalOpen(false);

                  if (data?.register?.status === 'closed') {
                    await handleAudit({
                      credit: tempCredit,
                      debit: tempDebit,
                      pix: tempPix,
                      custom: tempCustom,
                      notes: tempNotes,
                    });
                  } else {
                    const hasAdj = Boolean(
                      tempCredit !== '' ||
                      tempDebit !== '' ||
                      tempPix !== '' ||
                      Object.keys(tempCustom).length > 0 ||
                      tempNotes.trim()
                    );
                    if (hasAdj) {
                      toast.success('Valores digitais ajustados aplicados com sucesso!');
                    } else {
                      toast.info('Valores originais do sistema restaurados.');
                    }
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-brand hover:bg-brand disabled:opacity-60 text-on-brand font-bold transition active:scale-95 text-xs flex items-center justify-center gap-2 shadow-lg shadow-line cursor-pointer hover:text-on-brand"
              >
                {submitting ? <PdvLojistaLoader mode="loader" compact size={16} /> : <CheckCircle2 size={16} />}
                <span>{data?.register?.status === 'closed' ? 'Salvar e Aplicar Ajustes' : 'Aplicar Ajustes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return createPortal(modalBody, document.body);
}
