import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getFullUrl } from "@/lib/getFullUrl";
import { toast } from "sonner";
import { useShift } from "@/contexts/ShiftContext";
import {
  Lock,
  User,
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  AlertCircle,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import PdvLojistaLoader from "./PdvLojistaLoader";

interface OperatorLoginModalProps {
  onSuccess: () => void;
  onClose?: () => void;
  isReauth?: boolean;
}

interface OperatorData {
  id: string;
  name: string;
  isManager?: boolean;
  jobTitle?: string | null;
  imageUrl?: string | null;
  hasOpenRegister?: boolean;
}

export function OperatorLoginModal({
  onSuccess,
  onClose,
  isReauth = false,
}: OperatorLoginModalProps) {
  const [operators, setOperators] = useState<OperatorData[]>([]);
  const [loadingOps, setLoadingOps] = useState(true);

  const [selectedOp, setSelectedOp] = useState<OperatorData | null>(null);
  const [pin, setPin] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { operator, setOperator, isRegisterQuerying } = useShift();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/operators?context=cashier")
      .then((res) => {
        const ops = res.data;
        setOperators(ops);
        // Em reautenticação (F5 ou token expirado), pré-seleciona automaticamente o operador já logado
        if (isReauth && operator?.id) {
          const matched = ops.find((o: any) => o.id === operator.id);
          if (matched) setSelectedOp(matched);
        }
      })
      .catch(() => toast.error("Erro ao carregar operadores."))
      .finally(() => setLoadingOps(false));
  }, [isReauth, operator?.id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOp || pin.length < 4) return;

    setLoadingLogin(true);
    setErrorMessage(null);
    try {
      const res = await api.post("/auth/operator-login", {
        operatorId: selectedOp.id,
        pin,
        context: "cashier",
      });
      const { operatorToken, ...operatorData } = res.data;
      setOperator(
        {
          ...operatorData,
          imageUrl: operatorData.imageUrl ?? selectedOp.imageUrl ?? null,
        },
        operatorToken,
      );
      toast.success(
        isReauth
          ? "Reautenticação concluída com sucesso!"
          : `Bem-vindo, ${res.data.name}!`,
      );
      onSuccess();
    } catch {
      const msg = "Senha incorreta. Ao esquecer, contate o administrador.";
      setErrorMessage(msg);
      toast.error(msg, { duration: 4000 });
      setPin("");
    } finally {
      setLoadingLogin(false);
    }
  };

  const { logout } = useAuthStore();

  const handleGlobalLogout = () => {
    logout();
    navigate("/login");
  };

  const stencilBusy = loadingOps || loadingLogin || isRegisterQuerying;
  const stencilStatusLabel = loadingLogin
    ? "Validando credencial e consultando caixa…"
    : isRegisterQuerying
      ? "Consultando sessão e caixa do operador…"
      : loadingOps
        ? "Consultando operadores habilitados…"
        : undefined;

  return (
    <div className="pdv-mobile-sheet-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          isReauth ? "Reautenticação do Operador" : "Seleção de Operador"
        }
        className="pdv-mobile-sheet relative bg-page border border-line w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-8 animate-in fade-in zoom-in-95 duration-200"
        aria-busy={stencilBusy}
      >
        <div className="retail-sheet-handle" aria-hidden="true" />
        {!isReauth && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full text-muted hover:text-ink bg-surface/60 hover:bg-surface transition cursor-pointer"
            data-tooltip="Cancelar e manter operador atual"
            aria-label="Cancelar e manter operador atual"
          >
            <X size={18} />
          </button>
        )}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex flex-col items-center justify-center min-h-[116px]">
            <PdvLojistaLoader
              mode="stencil"
              size={80}
              active={true}
              label={stencilStatusLabel}
            />
          </div>
          <h2 className="text-2xl font-black text-ink tracking-tight">
            {isReauth ? "Reautenticação do Operador" : "Seleção de Operador"}
          </h2>
          <p className="text-muted mt-2 text-sm">
            {isReauth
              ? "Sua credencial de segurança expirou ou a página foi recarregada. Confirme seu PIN para continuar."
              : "Escolha seu perfil e informe seu PIN para acessar o PDV."}
          </p>
        </div>

        {loadingOps ? (
          <div
            className="py-8 text-center text-sm font-semibold text-muted"
            role="status"
          >
            Carregando lista de operadores…
          </div>
        ) : !selectedOp ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-[320px] overflow-y-auto">
            {operators.map((op) => (
              <button
                type="button"
                key={op.id}
                onClick={() => setSelectedOp(op)}
                className="bg-page hover:bg-surface border border-line hover:border-brand p-4 rounded-2xl flex items-center gap-4 transition-all text-left group cursor-pointer"
              >
                <div className="relative w-10 h-10 bg-surface group-hover:bg-support rounded-full flex items-center justify-center shrink-0 transition-colors overflow-hidden border border-line group-hover:border-brand">
                  {op.imageUrl ? (
                    <img
                      src={getFullUrl(op.imageUrl)}
                      alt={op.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <User
                      className="text-muted group-hover:text-brand transition-colors"
                      size={20}
                    />
                  )}
                  {op.hasOpenRegister && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-brand border-2 border-line rounded-full text-on-brand"
                      data-tooltip="Ativo no caixa"
                    />
                  )}
                </div>
                <div className="flex-1 flex justify-between items-center overflow-hidden gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink font-bold truncate">{op.name}</p>
                    <p className="text-xs text-muted uppercase tracking-wider truncate">
                      {op.jobTitle || (op.isManager ? "Gerente" : "Operador")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleLogin} autoComplete="off" className="space-y-5">
            <button
              type="button"
              onClick={() => {
                setSelectedOp(null);
                setPin("");
                setErrorMessage(null);
              }}
              className="flex items-center gap-2 text-muted hover:text-ink transition-colors text-sm font-semibold mb-2 cursor-pointer"
            >
              <ArrowLeft size={16} />{" "}
              {isReauth ? "Entrar com outro operador" : "Voltar aos operadores"}
            </button>

            <div className="bg-page border border-line rounded-2xl p-5 text-center">
              <div className="w-14 h-14 bg-support border border-brand rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden">
                {selectedOp.imageUrl ? (
                  <img
                    src={getFullUrl(selectedOp.imageUrl)}
                    alt={selectedOp.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="text-brand" size={28} />
                )}
              </div>
              <h3 className="text-lg font-bold text-ink">{selectedOp.name}</h3>
              <p className="text-muted text-xs">
                {selectedOp.jobTitle ||
                  (selectedOp.isManager ? "Gerente de Caixa" : "Operador")}
              </p>
            </div>

            <div className="space-y-3">
              <label
                htmlFor="operator-pin-input"
                className="text-sm font-bold text-muted mb-1 block text-center"
              >
                Digite seu PIN (4-6 dígitos)
              </label>
              <input
                id="operator-pin-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                autoFocus
                disabled={loadingLogin}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/[^0-9]/g, ""));
                  if (errorMessage) setErrorMessage(null);
                }}
                maxLength={6}
                className={`pdv-secret-input w-full bg-page border-2 ${
                  errorMessage
                    ? "border-brand bg-support focus:border-brand"
                    : "border-line focus:border-brand"
                } rounded-2xl px-4 py-3.5 text-center text-3xl tracking-[1em] font-black text-ink outline-none transition-all`}
                placeholder="••••"
              />

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-center justify-center gap-2 p-3 bg-support border border-brand rounded-xl text-brand text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200 text-center"
                >
                  <AlertCircle size={15} className="shrink-0 text-brand" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loadingLogin || pin.length < 4}
              className="w-full bg-brand hover:bg-brand disabled:opacity-50 text-on-brand font-bold py-4 rounded-2xl transition-all shadow-lg shadow-line flex justify-center items-center gap-2 text-lg active:scale-95 hover:text-on-brand cursor-pointer"
            >
              <Lock size={20} />
              {loadingLogin ? "Validando acesso…" : "Acessar PDV"}
            </button>
          </form>
        )}

        <div className="mt-7 pt-5 border-t border-line flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/inicio")}
              className="text-muted hover:text-ink font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LayoutDashboard size={16} /> Voltar ao Painel Administrativo
            </button>
          </div>

          <button
            type="button"
            onClick={handleGlobalLogout}
            className="text-brand hover:text-brand font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <LogOut size={14} /> Sair do Sistema (Logout)
          </button>
        </div>
      </div>
    </div>
  );
}
