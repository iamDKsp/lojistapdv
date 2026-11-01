import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useShift } from "@/contexts/ShiftContext";
import { Wallet } from "lucide-react";
import PdvLojistaLoader from "./PdvLojistaLoader";

interface OpenShiftModalProps {
  onSuccess: () => void;
}

export function OpenShiftModal({ onSuccess }: OpenShiftModalProps) {
  const {
    operator,
    refreshShift,
    logoutOperator,
    setCashRegister,
    isRegisterQuerying,
  } = useShift();
  const [openingValue, setOpeningValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operator) return;

    const val = parseFloat(openingValue.replace(",", ".") || "0");

    if (isNaN(val) || val < 0) {
      toast.error("Informe um valor de abertura válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/cash-registers/open", {
        openingValue: val,
        operatorId: operator.id,
      });
      toast.success("Caixa aberto com sucesso!");
      if (res.data) {
        setCashRegister(res.data);
        localStorage.setItem(
          `pdvpro_cached_register_${operator.id}`,
          JSON.stringify(res.data),
        );
      }
      await refreshShift(operator.id);
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Erro ao abrir caixa.";
      toast.error(msg);
      await refreshShift(operator.id);
    } finally {
      setLoading(false);
    }
  };

  if (!operator) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 backdrop-blur-sm">
        <PdvLojistaLoader
          mode="stencil"
          size={64}
          active
          label="Verificando operador…"
        />
      </div>
    );
  }

  const stencilBusy = loading || isRegisterQuerying;

  return (
    <div className="pdv-mobile-sheet-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div
        className="pdv-mobile-sheet bg-page border border-line w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 animate-in fade-in slide-in-from-bottom-4 duration-200"
        aria-busy={stencilBusy}
      >
        <div className="retail-sheet-handle" aria-hidden="true" />
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex flex-col items-center justify-center min-h-[84px]">
            <PdvLojistaLoader
              mode="stencil"
              size={60}
              active={stencilBusy}
              label={
                loading
                  ? "Abrindo caixa e iniciando turno…"
                  : isRegisterQuerying
                    ? "Validando sessão do caixa…"
                    : undefined
              }
            />
          </div>
          <h2 className="text-2xl font-black text-ink tracking-tight flex items-center justify-center gap-2">
            <Wallet className="text-brand" size={24} />
            Abertura de Caixa
          </h2>
          <p className="text-muted mt-2 text-sm">
            Informe o valor inicial (fundo de troco) para iniciar seu turno.
          </p>
        </div>

        <form onSubmit={handleOpen} className="space-y-6">
          <div>
            <label className="text-sm font-bold text-muted mb-2 block">
              Operador Atual
            </label>
            <div className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink font-semibold cursor-not-allowed opacity-70">
              {operator.name}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-muted mb-2 block">
              Fundo de Caixa (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              disabled={loading}
              value={openingValue}
              onChange={(e) => setOpeningValue(e.target.value)}
              placeholder="0.00"
              className="w-full bg-page border-2 border-line focus:border-brand rounded-xl px-4 py-4 text-2xl font-black text-brand outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand disabled:opacity-50 text-on-brand font-bold py-4 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 text-lg active:scale-95 hover:text-on-brand cursor-pointer"
          >
            {loading
              ? "Abrindo caixa…"
              : "Abrir Caixa e Iniciar Turno"}
          </button>

          <button
            type="button"
            onClick={() => logoutOperator()}
            className="w-full bg-surface hover:bg-support text-muted hover:text-ink font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2 text-sm cursor-pointer"
          >
            Trocar Operador / Sair
          </button>
        </form>
      </div>
    </div>
  );
}
