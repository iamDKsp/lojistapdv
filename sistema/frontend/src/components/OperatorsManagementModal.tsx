"use client";
import { useState, useEffect } from "react";
import { X, Plus, KeyRound, CheckCircle2, XCircle, Upload, UserRound, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { toast } from "sonner";
import { PdvLojistaLoader, RetailSwitch } from "@/components/ui";

interface Operator {
  id: string;
  name: string;
  active: boolean;
  isManager: boolean;
  jobTitle?: string | null;
  imageUrl?: string | null;
  hasOpenRegister?: boolean;
}

interface OperatorsManagementModalProps {
  onClose: () => void;
}

export default function OperatorsManagementModal({ onClose }: OperatorsManagementModalProps) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for adding/editing operator
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [hideReceipts, setHideReceipts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/operators");
      setOperators(data);
    } catch (err: any) {
      toast.error("Erro ao carregar colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("A foto deve ter até 8 MB.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/products/upload", formData);
      if (res.data?.imageUrl) {
        setImageUrl(res.data.imageUrl);
        toast.success("Foto do funcionário enviada!");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao enviar foto do funcionário.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleStatus = async (id: string, active: boolean) => {
    try {
      await api.patch(`/operators/${id}`, { active: !active });
      toast.success(`Colaborador ${active ? 'inativado' : 'ativado'} com sucesso.`);
      window.dispatchEvent(new CustomEvent("operators-updated"));
      fetchOperators();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao alterar status.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId && (pin.length < 4 || pin.length > 6)) {
      toast.error("O PIN deve ter entre 4 e 6 dígitos.");
      return;
    }
    if (editId && pin && (pin.length < 4 || pin.length > 6)) {
      toast.error("O PIN deve ter entre 4 e 6 dígitos.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = { 
        name, 
        isManager: !hideReceipts, 
        jobTitle: jobTitle.trim() || null,
        imageUrl: imageUrl || null,
      };
      if (pin) payload.pin = pin;

      if (editId) {
        await api.patch(`/operators/${editId}`, payload);
        toast.success("Colaborador atualizado!");
      } else {
        if (!pin) {
          toast.error("Preencha o PIN!");
          setSubmitting(false);
          return;
        }
        await api.post("/operators", payload);
        toast.success("Colaborador criado!");
      }
      
      window.dispatchEvent(new CustomEvent("operators-updated"));
      setShowForm(false);
      setEditId(null);
      setName("");
      setPin("");
      setJobTitle("");
      setImageUrl(null);
      setHideReceipts(true);
      fetchOperators();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Erro ao ${editId ? 'atualizar' : 'criar'} colaborador.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (op: Operator) => {
    setEditId(op.id);
    setName(op.name);
    setJobTitle(op.jobTitle || "");
    setImageUrl(op.imageUrl || null);
    setHideReceipts(!op.isManager);
    setPin("");
    setShowForm(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-page border border-line w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="text-lg font-bold text-ink">
            {showForm ? (editId ? "Editar Colaborador" : "Novo Colaborador") : "Colaboradores do Caixa"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-surface transition-colors">
            <X size={20} />
          </button>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="flex items-center gap-4 p-3.5 bg-surface rounded-2xl border border-line">
              <div className="w-16 h-16 rounded-full bg-page border-2 border-brand flex items-center justify-center overflow-hidden shrink-0">
                {imageUrl ? (
                  <img
                    src={getFullUrl(imageUrl)}
                    alt={name || "Foto do colaborador"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserRound className="text-brand" size={28} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink">Foto do Funcionário</p>
                <p className="text-xs text-muted mt-0.5">
                  Aparece no topo do PDV para troca rápida de operador em 1 clique.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-support text-brand border border-brand text-xs font-bold cursor-pointer hover:bg-brand hover:text-on-brand transition-colors">
                    <Upload size={13} />
                    {uploadingPhoto ? "Enviando..." : imageUrl ? "Trocar foto" : "Enviar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPhoto}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handlePhotoUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-page border border-line text-muted hover:text-brand hover:border-brand text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted mb-1.5 block">Nome do Colaborador</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-4 py-2.5 bg-page border border-line rounded-xl focus:ring-2 focus:ring-brand focus:border-brand transition-all outline-none text-ink text-sm"
              />
            </div>

            {/* Função / jobTitle */}
            <div>
              <label className="text-sm text-muted mb-1.5 block">Função <span className="text-muted">(opcional)</span></label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ex: Vendedor, Caixa, Balconista, Gerente..."
                className="w-full px-4 py-2.5 bg-page border border-line rounded-xl focus:ring-2 focus:ring-brand focus:border-brand transition-all outline-none text-ink text-sm"
              />
              {/* Sugestões rápidas */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['Vendedor', 'Caixa', 'Atendente', 'Balconista', 'Gerente'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setJobTitle(s);
                      setHideReceipts(s !== 'Gerente');
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
                      jobTitle === s
                        ? 'bg-support border-brand text-brand'
                        : 'bg-page border-line text-muted hover:border-line hover:text-muted'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-sm text-brand mb-1.5 font-semibold flex items-center gap-1.5">
                <KeyRound size={14} /> PIN do colaborador
              </label>
              <input
                type="text"
                required={!editId}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                placeholder={editId ? "Novo PIN (deixe branco p/ manter)" : "4 a 6 dígitos (usado na tela de vendas)"}
                className="w-full px-4 py-2.5 bg-page border border-brand rounded-xl focus:ring-2 focus:ring-brand focus:border-brand transition-all outline-none text-ink text-sm"
              />
              <button type="button" className="mt-2 text-sm text-brand" onClick={() => {
                const digits = new Uint32Array(6);
                crypto.getRandomValues(digits);
                setPin(Array.from(digits, n => n % 10).join(''));
              }}>Gerar novo PIN</button>
              {editId && <p className="mt-1 text-xs text-muted">Ao salvar um novo PIN, o colaborador precisará informar o novo PIN ao autenticar manualmente.</p>}
            </div>

              <div className="pt-2 bg-page/60 p-3.5 rounded-xl border border-line">
                <RetailSwitch
                  checked={hideReceipts}
                  onCheckedChange={(checked) => setHideReceipts(checked)}
                  label="Ocultar recebimentos do caixa"
                  description="Se ativo, os valores totais de fechamento (dinheiro físico, cartões, pix e total esperado na gaveta) ficam ocultos (Auditoria Cega). O operador ainda visualiza todas as vendas individuais registradas."
                />
              </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null); setName(""); setPin(""); setJobTitle(""); setImageUrl(null); setHideReceipts(true); }}
                className="flex-1 bg-surface hover:bg-support text-ink font-semibold py-2.5 px-4 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-brand hover:bg-brand disabled:opacity-50 text-on-brand font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 hover:text-on-brand"
              >
                {submitting ? <PdvLojistaLoader mode="loader" compact size={18} label="Salvando colaborador" /> : null}
                {submitting ? "Salvando..." : (editId ? "Salvar" : "Cadastrar")}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5">
            <div className="flex justify-between items-center mb-4">
              <p className="text-muted text-sm">
                Esses colaboradores aparecem nos ícones superiores do PDV para troca rápida de caixa.
              </p>
              <button 
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setPin("");
                  setJobTitle("");
                  setImageUrl(null);
                  setHideReceipts(true);
                  setShowForm(true);
                }}
                className="bg-support text-brand hover:bg-support px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
              >
                <Plus size={16} /> Novo
              </button>
            </div>

            {loading ? (
              <div className="py-10 flex justify-center">
                <PdvLojistaLoader mode="loader" size={44} label="Carregando colaboradores..." />
              </div>
            ) : operators.length === 0 ? (
              <div className="text-center py-10 bg-page/50 rounded-xl border border-line">
                <p className="text-muted mb-2">Nenhum colaborador cadastrado</p>
                <button onClick={() => setShowForm(true)} className="text-brand text-sm hover:underline font-semibold">
                  Cadastrar o primeiro
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {operators.map(op => (
                  <div key={op.id} className="flex items-center justify-between p-3 bg-page border border-line rounded-xl hover:border-brand transition-colors">
                    <div 
                      className="flex-1 flex items-center gap-3 cursor-pointer"
                      onClick={() => handleEdit(op)}
                    >
                      <div className="w-11 h-11 rounded-full bg-support border border-brand flex items-center justify-center overflow-hidden shrink-0">
                        {op.imageUrl ? (
                          <img
                            src={getFullUrl(op.imageUrl)}
                            alt={op.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserRound className="text-brand" size={20} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-ink text-base flex items-center gap-2 flex-wrap">
                          {op.name}
                          {op.isManager ? (
                            <span className="bg-support text-brand text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-brand">
                              Totais Visíveis
                            </span>
                          ) : (
                            <span className="bg-surface text-muted text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-line">
                              Recebimentos Ocultos
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {op.jobTitle && (
                            <span className="bg-support text-brand text-[10px] font-bold px-2 py-0.5 rounded border border-brand">{op.jobTitle}</span>
                          )}
                          {op.active ? (
                            <span className="flex items-center gap-1 text-[10px] text-brand bg-support px-1.5 py-0.5 rounded">
                              <CheckCircle2 size={10} /> Ativo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-brand bg-support px-1.5 py-0.5 rounded">
                              <XCircle size={10} /> Inativo
                            </span>
                          )}
                          <span className="text-muted text-xs">Clique para editar foto/PIN</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(op.id, op.active); }}
                      className={`text-xs px-2.5 py-1.5 rounded-md border transition-all ${
                        op.active
                          ? "text-brand hover:bg-support border-transparent hover:border-brand"
                          : "text-brand hover:bg-support border-transparent hover:border-brand"
                      }`}
                    >
                      {op.active ? "Bloquear" : "Liberar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
