"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PdvLojistaLoader } from '@/components/ui';

export interface PackagingItem {
  id: string;
  name: string;
  multiplier: number;
  createdAt?: string;
}

interface ManagePackagingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPackagingsChange?: () => void;
}

export default function ManagePackagingsModal({
  isOpen,
  onClose,
  onPackagingsChange,
}: ManagePackagingsModalProps) {
  const [packagings, setPackagings] = useState<PackagingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newMultiplier, setNewMultiplier] = useState<number | ''>(6);

  const fetchPackagings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchase-orders/packagings/all');
      setPackagings(data || []);
    } catch {
      toast.error('Erro ao buscar embalagens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPackagings();
    }
  }, [isOpen, fetchPackagings]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    const trimmedName = newName.trim();
    const multNum = Number(newMultiplier);

    if (!trimmedName) {
      toast.error('Informe o nome da embalagem (ex: Fardo c/ 6).');
      return;
    }

    if (!multNum || multNum < 1) {
      toast.error('Informe uma quantidade de unidades válida (maior ou igual a 1).');
      return;
    }

    setCreating(true);
    try {
      await api.post('/purchase-orders/packagings', {
        name: trimmedName,
        multiplier: multNum,
      });

      setNewName('');
      setNewMultiplier(6);
      toast.success(`Embalagem "${trimmedName}" cadastrada com sucesso!`);
      await fetchPackagings();
      onPackagingsChange?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Erro ao cadastrar embalagem.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/purchase-orders/packagings/${id}`);
      toast.success(`Embalagem "${name}" removida!`);
      await fetchPackagings();
      onPackagingsChange?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Erro ao remover embalagem.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-page border border-line w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-line flex justify-between items-center bg-page/90 backdrop-blur-sm z-10 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-support flex items-center justify-center text-brand border border-brand">
              <Package size={18} />
            </div>
            <div>
              <h2 className="font-bold text-ink text-base">Gerenciar Embalagens</h2>
              <p className="text-muted text-xs">Configure fardos, caixas e kits para conversão</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Cadastro Rápido */}
          <div className="bg-page/70 border border-line rounded-xl p-3.5 space-y-2.5">
            <label className="text-xs font-semibold text-muted block">
              Cadastrar Nova Embalagem:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nome (ex: Fardo c/ 6)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                disabled={creating}
                className="flex-1 bg-page border border-line rounded-xl px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none transition-colors disabled:opacity-50"
              />
              <div className="relative w-24">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Und (ex: 6)"
                  value={newMultiplier}
                  onChange={(e) => setNewMultiplier(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  disabled={creating}
                  className="w-full bg-page border border-line rounded-xl px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none text-center transition-colors disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || !newMultiplier}
                className="bg-brand hover:bg-brand disabled:opacity-40 disabled:cursor-not-allowed text-on-brand px-3.5 rounded-xl font-bold transition flex items-center justify-center shadow-md active:scale-95 shrink-0 hover:text-on-brand"
                data-tooltip="Adicionar Embalagem"
              >
                {creating ? <PdvLojistaLoader mode="loader" compact size={18} label="Adicionando embalagem" /> : <Plus size={18} />}
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Exemplo: ao cadastrar <strong>Fardo c/ 12</strong> (Und: 12), dar entrada em 2 fardos somará 24 unidades no estoque.
            </p>
          </div>

          {/* Lista de Embalagens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted px-1">
              <span>Embalagens Cadastradas</span>
              <span className="text-muted">{packagings.length} {packagings.length === 1 ? 'tipo' : 'tipos'}</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <PdvLojistaLoader mode="loader" size={40} label="Carregando embalagens..." />
              </div>
            ) : packagings.length === 0 ? (
              <div className="text-center py-8 px-4 bg-page border border-dashed border-line rounded-xl">
                <Package size={28} className="mx-auto text-muted mb-2 opacity-60" />
                <p className="text-muted text-sm font-medium">Nenhuma embalagem cadastrada.</p>
                <p className="text-muted text-xs mt-0.5">Cadastre acima os formatos de venda/compra do seu estabelecimento.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-0.5">
                {packagings.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center bg-page border border-line hover:border-line p-3 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-page flex items-center justify-center text-muted border border-line font-mono text-xs font-bold">
                        {p.multiplier}x
                      </div>
                      <div>
                        <strong className="block text-sm text-muted">{p.name}</strong>
                        <span className="text-xs text-brand font-medium">
                          Multiplica por {p.multiplier} un no estoque
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      disabled={deletingId === p.id}
                      className="text-muted hover:text-brand p-2 rounded-lg hover:bg-support transition-colors disabled:opacity-50"
                      data-tooltip="Excluir embalagem"
                    >
                      {deletingId === p.id ? (
                        <PdvLojistaLoader mode="loader" compact size={16} label="Excluindo" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-page/60 border-t border-line flex justify-end">
          <button
            onClick={onClose}
            className="bg-surface hover:bg-support text-muted px-5 py-2 rounded-xl text-sm font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
