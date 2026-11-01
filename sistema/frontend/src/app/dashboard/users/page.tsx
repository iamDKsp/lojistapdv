"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { Shield, ShieldAlert, CheckCircle2, XCircle, Plus, KeyRound, Lock, Eye, EyeOff, UserRound } from "lucide-react";
import { toast } from "sonner";
import UserModal from "@/components/UserModal";
import OperatorsManagementModal from "@/components/OperatorsManagementModal";
import { PdvLojistaLoader } from "@/components/ui";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  imageUrl?: string | null;
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [operatorsModalOpen, setOperatorsModalOpen] = useState(false);

  // Discount PIN modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [discountPin, setDiscountPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  // Cashier PIN modal state (PIN do Caixa)
  const [cashierPinModalOpen, setCashierPinModalOpen] = useState(false);
  const [cashierPin, setCashierPin] = useState('');
  const [confirmCashierPin, setConfirmCashierPin] = useState('');
  const [showCashierPin, setShowCashierPin] = useState(false);
  const [savingCashierPin, setSavingCashierPin] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/users");
      setUsers(data);
    } catch {
      toast.error("Erro ao carregar usuários. Apenas admins têm acesso.");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, active: boolean) => {
    try {
      await api.patch(`/users/${id}/toggle-status`);
      toast.success(`Usuário ${active ? 'inativado' : 'ativado'} com sucesso.`);
      window.dispatchEvent(new CustomEvent("operators-updated"));
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao alterar status.");
    }
  };

  const handleOpenModal = () => {
    setEditUser(null);
    setModalOpen(true);
  };

  const handleRowClick = (u: User) => {
    setEditUser(u);
    setModalOpen(true);
  };

  const handleSaveDiscountPin = async () => {
    if (discountPin.length < 4) { toast.error("O PIN deve ter no mínimo 4 dígitos."); return; }
    if (discountPin !== confirmPin) { toast.error("Os PINs não coincidem."); return; }
    setSavingPin(true);
    try {
      await api.post('/tenants/me/discount-pin', { pin: discountPin });
      toast.success("PIN de desconto configurado com sucesso!");
      setPinModalOpen(false);
      setDiscountPin(''); setConfirmPin('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao salvar o PIN.");
    } finally {
      setSavingPin(false);
    }
  };

  const handleSaveCashierPin = async () => {
    if (cashierPin.length < 4) { toast.error("O PIN deve ter no mínimo 4 dígitos."); return; }
    if (cashierPin !== confirmCashierPin) { toast.error("Os PINs não coincidem."); return; }
    setSavingCashierPin(true);
    try {
      await api.post('/tenants/me/cashier-pin', { pin: cashierPin });
      toast.success("PIN do Caixa configurado com sucesso!");
      setCashierPinModalOpen(false);
      setCashierPin(''); setConfirmCashierPin('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao salvar o PIN do Caixa.");
    } finally {
      setSavingCashierPin(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Equipe</h1>
          <p className="text-muted text-sm mt-1">Gerencie os acessos do seu estabelecimento</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setOperatorsModalOpen(true)}
            className="bg-surface hover:bg-support border border-line text-brand px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer text-sm font-semibold shadow-sm"
            data-tooltip="Gerenciar operadores e PINs de seleção no Caixa (PDV)"
          >
            <Shield size={16} /> Operadores do PDV (PINs)
          </button>
          <button
            onClick={() => setCashierPinModalOpen(true)}
            className="bg-surface hover:bg-support border border-line text-brand px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer text-sm font-semibold shadow-sm"
            data-tooltip="Configurar PIN do Caixa para desbloqueio e visualização no PDV"
          >
            <KeyRound size={16} /> PIN do Caixa
          </button>
          <button
            onClick={() => setPinModalOpen(true)}
            className="bg-surface hover:bg-support border border-line text-brand px-4 py-2 rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer text-sm font-semibold shadow-sm"
            data-tooltip="Configurar PIN de desconto para o PDV"
          >
            <KeyRound size={16} /> PIN de Desconto
          </button>
          <button
            onClick={handleOpenModal}
            className="bg-brand hover:bg-brand text-on-brand px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-line active:scale-95 text-sm font-bold cursor-pointer hover:text-on-brand"
          >
            <Plus size={18} /> Novo Colaborador
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <PdvLojistaLoader mode="loader" size={44} label="Carregando equipe..." />
        </div>
      ) : (
        <div className="bg-page/50 border border-line rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[560px] text-left bg-transparent border-collapse">
              <thead>
                <tr className="border-b border-line text-muted text-sm">
                  <th className="p-4 font-medium whitespace-nowrap">Colaborador</th>
                  <th className="p-4 font-medium whitespace-nowrap">Função</th>
                  <th className="p-4 font-medium whitespace-nowrap">Status do Acesso</th>
                  <th className="p-4 font-medium whitespace-nowrap text-right pr-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface transition-colors cursor-pointer group" onClick={() => handleRowClick(u)}>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-support border border-brand flex items-center justify-center overflow-hidden shrink-0">
                          {u.imageUrl ? (
                            <img
                              src={getFullUrl(u.imageUrl)}
                              alt={u.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserRound size={18} className="text-brand" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-ink">{u.name}</p>
                          <p className="text-sm text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {u.role === "admin" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-support text-brand border border-brand whitespace-nowrap">
                          <ShieldAlert size={14} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-support text-muted border border-line whitespace-nowrap">
                          <Shield size={14} /> Operador de Caixa
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-support text-brand border border-brand whitespace-nowrap">
                          <CheckCircle2 size={14} /> Acesso Liberado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-support text-brand border border-brand whitespace-nowrap">
                          <XCircle size={14} /> Acesso Bloqueado
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleStatus(u.id, u.active)}
                        disabled={u.role === "admin"}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                          u.role === "admin"
                            ? "opacity-30 cursor-not-allowed border-line bg-page"
                            : u.active
                            ? "hover:bg-support text-brand border-brand hover:border-brand"
                            : "hover:bg-support text-brand border-brand hover:border-brand"
                        }`}
                      >
                        {u.active ? "Bloquear Acesso" : "Liberar Acesso"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted">Nenhum colaborador encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-page border-t border-line text-xs text-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>Equipe: {users.length} {users.length === 1 ? "funcionário cadastrado" : "funcionários cadastrados"} (fotos exibidas no topo do PDV)</span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-brand">
                <Lock size={12} /> PIN do Caixa desbloqueia visualização/auditoria no PDV
              </span>
              <span className="flex items-center gap-1.5 text-brand">
                <Lock size={12} /> PIN de Desconto protege alterações de preço no PDV
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de PIN do Caixa */}
      {cashierPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-page border border-line rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-support flex items-center justify-center">
                  <KeyRound size={20} className="text-brand" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">PIN do Caixa</h3>
                  <p className="text-xs text-muted">Desbloqueia auditoria e valores restritos no PDV</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-muted block mb-2">Novo PIN do Caixa (mín. 4 dígitos)</label>
                <div className="relative">
                  <input
                    type={showCashierPin ? 'text' : 'password'}
                    value={cashierPin}
                    onChange={e => setCashierPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="••••"
                    className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    maxLength={8}
                    autoFocus
                  />
                  <button onClick={() => setShowCashierPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-muted cursor-pointer">
                    {showCashierPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted block mb-2">Confirmar PIN do Caixa</label>
                <input
                  type={showCashierPin ? 'text' : 'password'}
                  value={confirmCashierPin}
                  onChange={e => setConfirmCashierPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••"
                  className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  maxLength={8}
                  onKeyDown={e => e.key === 'Enter' && handleSaveCashierPin()}
                />
              </div>
              {cashierPin && confirmCashierPin && cashierPin !== confirmCashierPin && (
                <p className="text-brand text-xs text-center">Os PINs não coincidem</p>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => { setCashierPinModalOpen(false); setCashierPin(''); setConfirmCashierPin(''); }}
                className="flex-1 py-3 rounded-xl border border-line text-muted hover:bg-surface transition font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCashierPin}
                disabled={savingCashierPin || cashierPin.length < 4 || cashierPin !== confirmCashierPin}
                className="flex-1 py-3 rounded-xl bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-on-brand font-bold transition active:scale-95 cursor-pointer shadow-lg shadow-line hover:text-on-brand"
              >
                {savingCashierPin ? 'Salvando...' : 'Salvar PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de PIN de Desconto */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-page border border-line rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-support flex items-center justify-center">
                  <KeyRound size={20} className="text-brand" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">PIN de Desconto</h3>
                  <p className="text-xs text-muted">Protege alterações de preço no PDV</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-muted block mb-2">Novo PIN (mín. 4 dígitos)</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={discountPin}
                    onChange={e => setDiscountPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="••••"
                    className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    maxLength={8}
                    autoFocus
                  />
                  <button onClick={() => setShowPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-muted cursor-pointer">
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted block mb-2">Confirmar PIN</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••"
                  className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  maxLength={8}
                  onKeyDown={e => e.key === 'Enter' && handleSaveDiscountPin()}
                />
              </div>
              {discountPin && confirmPin && discountPin !== confirmPin && (
                <p className="text-brand text-xs text-center">Os PINs não coincidem</p>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => { setPinModalOpen(false); setDiscountPin(''); setConfirmPin(''); }}
                className="flex-1 py-3 rounded-xl border border-line text-muted hover:bg-surface transition font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDiscountPin}
                disabled={savingPin || discountPin.length < 4 || discountPin !== confirmPin}
                className="flex-1 py-3 rounded-xl bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-on-brand font-bold transition active:scale-95 cursor-pointer hover:text-on-brand"
              >
                {savingPin ? 'Salvando...' : 'Salvar PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <UserModal
          user={editUser}
          onClose={() => { setModalOpen(false); setEditUser(null); }}
          onSuccess={() => { setModalOpen(false); setEditUser(null); fetchUsers(); }}
        />
      )}
      {operatorsModalOpen && (
        <OperatorsManagementModal onClose={() => { setOperatorsModalOpen(false); fetchUsers(); }} />
      )}
    </div>
  );
}
