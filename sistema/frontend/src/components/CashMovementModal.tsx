import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, ArrowUpRight, ArrowDownRight } from "lucide-react";
import PdvLojistaLoader from "./PdvLojistaLoader";

export function CashMovementModal({
  isOpen,
  onClose,
  registerId,
}: {
  isOpen: boolean;
  onClose: (success: boolean) => void;
  registerId: string;
}) {
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [value, setValue] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || isNaN(Number(value)) || Number(value) <= 0) {
      toast.error("Gasto inválido");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/cash-registers/${registerId}/movement`, {
        type,
        value: Number(value),
        reason,
      });
      toast.success(
        type === "OUT"
          ? "Sangria registrada com sucesso!"
          : "Suprimento registrado com sucesso!",
      );
      onClose(true);
    } catch {
      toast.error("Erro ao processar movimentação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div
        className="bg-page border border-line rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        aria-busy={submitting}
      >
        <div className="flex justify-between items-center p-6 border-b border-line">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Sangria / Suprimento
          </h2>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Fechar"
            data-tooltip="Fechar"
            className="text-muted hover:text-ink transition-colors p-2 rounded-full hover:bg-surface"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType("OUT")}
              className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${
                type === "OUT"
                  ? "border-brand bg-support text-brand shadow-inner"
                  : "border-line bg-page text-muted hover:border-line hover:text-muted"
              }`}
            >
              <ArrowDownRight size={28} />
              <span className="font-bold">Sangria (Saída)</span>
            </button>
            <button
              type="button"
              onClick={() => setType("IN")}
              className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${
                type === "IN"
                  ? "border-brand bg-support text-brand shadow-inner"
                  : "border-line bg-page text-muted hover:border-line hover:text-muted"
              }`}
            >
              <ArrowUpRight size={28} />
              <span className="font-bold">Suprimento (Entrada)</span>
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted mb-2 block">
              Valor da Operação
            </label>
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold text-xl">
                R$
              </span>
              <input
                autoFocus
                type="number"
                step="0.01"
                min="0.01"
                required
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || "")}
                placeholder="0.00"
                className="w-full bg-page border-2 border-line rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-ink focus:outline-none focus:border-brand transition-colors shadow-inner"
              />
            </div>

            {/* Chips de valores rápidos */}
            <div className="flex flex-wrap gap-2">
              {[10, 20, 50, 100, 200].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() =>
                    setValue((prev) =>
                      typeof prev === "number" ? prev + val : val,
                    )
                  }
                  className="px-3 py-1.5 bg-page hover:bg-surface active:scale-95 border border-line hover:border-line text-muted rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  +{val}
                </button>
              ))}
              {value !== "" && (
                <button
                  type="button"
                  onClick={() => setValue("")}
                  className="px-3 py-1.5 bg-page/60 hover:bg-support text-muted hover:text-brand border border-line rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted mb-2 block">
              Motivo / Descrição{" "}
              <span className="text-xs text-muted font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Pagamento fornecedor, Vale, Troco Extra..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-page border border-line rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !value || Number(value) <= 0}
            className="w-full py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-brand hover:bg-brand text-on-brand hover:text-on-brand"
          >
            {submitting ? (
              <>
                <PdvLojistaLoader
                  mode="loader"
                  compact
                  size={18}
                  label="Salvando movimentação"
                />
                <span>Salvando…</span>
              </>
            ) : type === "OUT" ? (
              "Retirar Dinheiro (Sangria)"
            ) : (
              "Injetar Reforço (Suprimento)"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
