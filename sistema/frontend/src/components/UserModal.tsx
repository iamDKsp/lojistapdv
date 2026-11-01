"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PdvLojistaLoader, RetailSelect } from "@/components/ui";

interface UserModalProps {
  onClose: () => void;
  onSuccess: () => void;
  user?: any;
}

export default function UserModal({ onClose, onSuccess, user }: UserModalProps) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState(user ? "" : "1234");
  const [role, setRole] = useState(user?.role || "operator");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (pin && !/^\d{4,6}$/.test(pin.trim())) {
      toast.error("O PIN do Operador deve conter de 4 a 6 números.");
      return;
    }
    
    setLoading(true);
    try {
      const payload: any = { name, email, role };
      if (password) payload.password = password;
      if (pin) payload.pin = pin.trim();

      if (user) {
        await api.patch(`/users/${user.id}`, payload);
        toast.success("Usuário atualizado com sucesso!");
      } else {
        await api.post("/users", payload);
        toast.success("Usuário e Operador de Caixa criados com sucesso!");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Erro ao ${user ? 'atualizar' : 'criar'} usuário.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-page border border-line w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="text-lg font-bold text-ink">{user ? "Editar Conta de Acesso" : "Nova Conta de Acesso"}</h2>
          <button onClick={onClose} className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-surface transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm text-muted mb-1.5 block">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-4 py-2.5 bg-page border border-line rounded-xl focus:ring-2 focus:ring-brand focus:border-brand transition-all outline-none text-ink text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-1.5 block">E-mail de Acesso</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@restaurante.com.br"
              className="w-full px-4 py-2.5 bg-page border border-line rounded-xl focus:ring-2 focus:ring-brand focus:border-brand transition-all outline-none text-ink text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-1.5 block">Nível de Acesso (Função)</label>
            <RetailSelect
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={user?.role === "admin"}
            >
              <option value="operator">Operador de Caixa (Terminal)</option>
              <option value="admin">Administrador (Total)</option>
            </RetailSelect>
          </div>

          <div>
            <label className="text-sm text-muted mb-1.5 block">
              {user ? "Nova Senha (deixe em branco para manter)" : "Senha Inicial"}
            </label>
            <input
              type="text" // Texto para facilitar a cópia
              required={!user}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2.5 bg-page border border-line rounded-xl focus:ring-2 focus:ring-brand focus:border-brand transition-all outline-none text-ink text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-1.5 block">
              {user ? "Novo PIN de Seleção no Caixa (4 a 6 números — opcional)" : "PIN de Seleção no Caixa (4 a 6 números)"}
            </label>
            <input
              type="text"
              inputMode="numeric"
              required={!user}
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={user ? "Deixe em branco para manter o PIN atual" : "Ex: 1234"}
              className="w-full px-4 py-2.5 bg-page border border-line rounded-xl focus:ring-2 focus:ring-brand focus:border-brand transition-all outline-none text-ink text-sm font-mono tracking-widest"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-brand hover:bg-brand disabled:opacity-50 text-on-brand font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 hover:text-on-brand"
          >
            {loading ? <PdvLojistaLoader mode="loader" compact size={18} label="Salvando conta" /> : null}
            {loading ? "Salvando..." : (user ? "Salvar Alterações" : "Cadastrar Conta")}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
