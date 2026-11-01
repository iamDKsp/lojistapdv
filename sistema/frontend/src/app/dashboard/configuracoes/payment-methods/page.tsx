'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CreditCard, Plus, Trash2, Edit2, Check, X, Info } from 'lucide-react';
import { PdvLojistaLoader, RetailSwitch } from '@/components/ui';

interface PaymentMethod {
  id: string;
  name: string;
  tPag: string;
  active: boolean;
  emitirNfce?: boolean;
  hasVariablePricing: boolean;
}

interface FixedPaymentSettings {
  dinheiro: { emitirNfce: boolean };
  pix: { emitirNfce: boolean };
  credito: { emitirNfce: boolean };
  debito: { emitirNfce: boolean };
  consumo_funcionario: { emitirNfce: boolean };
  [key: string]: { emitirNfce: boolean };
}

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [fixedSettings, setFixedSettings] = useState<FixedPaymentSettings>({
    dinheiro: { emitirNfce: false },
    pix: { emitirNfce: false },
    credito: { emitirNfce: false },
    debito: { emitirNfce: false },
    consumo_funcionario: { emitirNfce: false },
  });
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newHasVariablePricing, setNewHasVariablePricing] = useState(false);
  const [newEmitirNfce, setNewEmitirNfce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHasVariablePricing, setEditHasVariablePricing] = useState(false);
  const [editEmitirNfce, setEditEmitirNfce] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [methodsRes, settingsRes] = await Promise.all([
        api.get('/payment-methods'),
        api.get('/payment-methods/settings').catch(() => ({ data: null })),
      ]);
      setMethods(methodsRes.data);
      if (settingsRes.data) {
        setFixedSettings(prev => ({ ...prev, ...settingsRes.data }));
      }
    } catch {
      toast.error('Erro ao carregar formas de pagamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleToggleFixedNfce = async (key: string, currentVal: boolean) => {
    const newVal = !currentVal;
    const updated = { ...fixedSettings, [key]: { emitirNfce: newVal } };
    setFixedSettings(updated as FixedPaymentSettings);
    try {
      await api.patch('/payment-methods/settings', updated);
      toast.success(`NFC-e para ${key.toUpperCase()} ${newVal ? 'ativada' : 'desativada'}!`);
    } catch {
      toast.error('Erro ao salvar configuração.');
      fetchAll();
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Digite o nome da forma de pagamento.'); return; }
    setSaving(true);
    try {
      await api.post('/payment-methods', { 
        name: newName.trim(), 
        hasVariablePricing: newHasVariablePricing,
        emitirNfce: newEmitirNfce,
      });
      toast.success(`"${newName.trim()}" adicionado!`);
      setNewName('');
      setNewHasVariablePricing(false);
      setNewEmitirNfce(true);
      fetchAll();
    } catch {
      toast.error('Erro ao adicionar forma de pagamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) { toast.error('Nome inválido.'); return; }
    try {
      await api.patch(`/payment-methods/${id}`, { 
        name: editName.trim(), 
        hasVariablePricing: editHasVariablePricing,
        emitirNfce: editEmitirNfce,
      });
      toast.success('Atualizado com sucesso!');
      setEditingId(null);
      fetchAll();
    } catch {
      toast.error('Erro ao atualizar.');
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    try {
      await api.patch(`/payment-methods/${method.id}`, { active: !method.active });
      toast.success(method.active ? 'Desativado.' : 'Ativado!');
      fetchAll();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  };

  const handleToggleCustomNfce = async (method: PaymentMethod) => {
    const currentVal = method.emitirNfce !== false;
    try {
      await api.patch(`/payment-methods/${method.id}`, { emitirNfce: !currentVal });
      toast.success(`NFC-e para "${method.name}" ${!currentVal ? 'ativada' : 'desativada'}!`);
      fetchAll();
    } catch {
      toast.error('Erro ao alterar emissão fiscal.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/payment-methods/${id}`);
      toast.success('Excluído com sucesso.');
      fetchAll();
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  const BUILTIN = [
    { 
      key: 'dinheiro', 
      label: 'Dinheiro', 
      color: 'text-brand',
      badgeBg: 'bg-support text-brand border-brand',
    },
    { 
      key: 'pix', 
      label: 'PIX', 
      color: 'text-brand',
      badgeBg: 'bg-support text-brand border-brand',
    },
    { 
      key: 'credito', 
      label: 'Cartão Crédito', 
      color: 'text-brand',
      badgeBg: 'bg-support text-brand border-brand',
    },
    { 
      key: 'debito', 
      label: 'Cartão Débito', 
      color: 'text-brand',
      badgeBg: 'bg-support text-brand border-brand',
    },
    { 
      key: 'credito_loja', 
      label: 'Crédito na loja', 
      color: 'text-brand',
      badgeBg: 'bg-support text-brand border-brand',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-ink flex items-center gap-3">
          <CreditCard className="text-brand" /> Formas de Pagamento
        </h1>
        <p className="text-muted mt-1 text-sm">
          Gerencie os métodos de pagamento aceitos e as preferências de emissão no caixa.
        </p>
      </div>

      {/* Métodos Padrão (Fixos) */}
      <div className="bg-page border border-line rounded-2xl p-5 md:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest">Métodos Padrão</h2>
            <p className="text-xs text-muted mt-0.5">Defina se a forma de pagamento emite cupom fiscal por padrão.</p>
          </div>
        </div>

        <div className="space-y-3">
          {BUILTIN.map(m => {
            const isFiscal = fixedSettings[m.key]?.emitirNfce === true;
            return (
              <div key={m.key} className="flex items-center justify-between p-4 bg-page/80 border border-line rounded-2xl gap-3 hover:border-line transition">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${m.badgeBg}`}>
                    Fixo
                  </span>
                  <div className={`font-bold text-base ${m.color}`}>{m.label}</div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleFixedNfce(m.key, isFiscal)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                      isFiscal
                        ? 'bg-support text-brand border-brand hover:bg-support'
                        : 'bg-page text-muted border-line hover:border-line hover:text-muted'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isFiscal ? 'bg-brand animate-pulse text-on-brand' : 'bg-support'}`} />
                    {isFiscal ? ' Emite NFC-e' : ' Sem Emissão'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Métodos Customizados */}
      <div className="bg-page border border-line rounded-2xl p-5 md:p-6 shadow-xl">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-muted uppercase tracking-widest">Métodos Customizados</h2>
          <p className="text-xs text-muted mt-0.5">Adicione canais e formas específicas da sua loja (ex: iFood, Vale Refeição, Convênio).</p>
        </div>

        {/* Adicionar novo */}
        <div className="bg-page/80 border border-line rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Nome do método (ex: iFood, Ticket Alimentação, Vale...)"
              className="flex-1 bg-page border border-line rounded-xl px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={saving}
              className="bg-brand hover:bg-brand disabled:opacity-50 text-on-brand px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 text-sm shrink-0 hover:text-on-brand"
            >
              {saving ? <PdvLojistaLoader mode="loader" compact size={18} label="Adicionando método" /> : <Plus size={18} />}
              {saving ? 'Adicionando...' : 'Adicionar Método'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <RetailSwitch
              size="sm"
              checked={newEmitirNfce}
              onCheckedChange={(checked) => setNewEmitirNfce(checked)}
              label="Emitir NFC-e"
            />

            <RetailSwitch
              size="sm"
              checked={newHasVariablePricing}
              onCheckedChange={(checked) => setNewHasVariablePricing(checked)}
              label="Preço Variável por Produto"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <PdvLojistaLoader mode="loader" size={44} label="Carregando formas de pagamento..." />
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum método customizado cadastrado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {methods.map(m => {
              const isFiscal = m.emitirNfce !== false;
              return (
                <div key={m.id} className={`flex flex-col gap-2 p-3.5 border rounded-2xl transition ${m.active ? 'bg-page border-line' : 'bg-page border-line opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    {editingId === m.id ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(m.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="flex-1 bg-page border border-line rounded-lg px-3 py-1.5 text-ink text-sm focus:outline-none focus:border-brand"
                          />
                          <button onClick={() => handleSaveEdit(m.id)} className="p-1.5 bg-support text-brand hover:bg-support border border-brand rounded-lg transition" data-tooltip="Salvar"><Check size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 bg-surface text-muted hover:text-muted rounded-lg transition" data-tooltip="Cancelar"><X size={16} /></button>
                        </div>
                        <div className="flex items-center gap-6 text-xs text-muted pt-1">
                          <RetailSwitch
                            size="sm"
                            checked={editEmitirNfce}
                            onCheckedChange={(checked) => setEditEmitirNfce(checked)}
                            label="Emitir NFC-e"
                          />
                          <RetailSwitch
                            size="sm"
                            checked={editHasVariablePricing}
                            onCheckedChange={(checked) => setEditHasVariablePricing(checked)}
                            label="Preço Variável"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-muted text-sm truncate">{m.name}</span>
                            {m.hasVariablePricing && (
                              <span className="text-[10px] uppercase font-bold text-brand bg-support border border-brand px-2 py-0.5 rounded-full">
                                Preço Variável
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Toggle NFC-e */}
                        <button
                          type="button"
                          onClick={() => handleToggleCustomNfce(m)}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition ${
                            isFiscal
                              ? 'bg-support text-brand border-brand hover:bg-support'
                              : 'bg-page text-muted border-line hover:border-line'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isFiscal ? 'bg-brand animate-pulse text-on-brand' : 'bg-support'}`} />
                          {isFiscal ? ' Emite NFC-e' : ' Sem Emissão'}
                        </button>

                        {/* Status Ativo/Inativo */}
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition ${
                            m.active 
                              ? 'bg-support text-brand border-brand hover:bg-support hover:text-brand hover:border-brand' 
                              : 'bg-page text-muted border-line hover:text-brand'
                          }`}
                        >
                          {m.active ? 'Ativo' : 'Inativo'}
                        </button>

                        <button 
                          onClick={() => { 
                            setEditingId(m.id); 
                            setEditName(m.name); 
                            setEditHasVariablePricing(m.hasVariablePricing);
                            setEditEmitirNfce(m.emitirNfce !== false);
                          }} 
                          className="p-1.5 text-muted hover:text-brand transition rounded-lg hover:bg-surface"
                          data-tooltip="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        
                        <button 
                          onClick={() => handleDelete(m.id, m.name)} 
                          className="p-1.5 text-muted hover:text-brand transition rounded-lg hover:bg-support"
                          data-tooltip="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 p-3.5 bg-support border border-brand rounded-2xl text-xs text-brand leading-relaxed flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Dica iFood & Plataformas:</strong> Ao fechar uma venda com forma "iFood", o caixa pode digitar o valor real recebido pelo iFood (que pode ter 12% de taxa). Isso garante que o fechamento do caixa bata no final do dia.
          </div>
        </div>
      </div>
    </div>
  );
}
