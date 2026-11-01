import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Save, Plus, Trash2, CreditCard } from "lucide-react";
import PdvLojistaLoader from "./PdvLojistaLoader";
import { RetailSelect } from "./ui/Select";

const METHOD_OPTIONS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "pix", label: "Pix" },
  { value: "outros", label: "Outros" },
];

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sale: any;
}

export function EditPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  sale,
}: EditPaymentModalProps) {
  const [payments, setPayments] = useState<{ method: string; value: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && sale) {
      setPayments(
        sale.payments.map((p: any) => ({
          method: p.method,
          value: Number(p.value).toFixed(2),
        })),
      );
    } else {
      setPayments([]);
    }
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;

  const totalSale = Number(sale.total);
  const currentTotal = payments.reduce(
    (acc, p) => acc + (parseFloat(p.value) || 0),
    0,
  );
  const diff = totalSale - currentTotal;
  const isDiffZero = Math.abs(diff) < 0.01;

  const handleAddPayment = () => {
    setPayments([
      ...payments,
      { method: "dinheiro", value: diff > 0 ? diff.toFixed(2) : "0.00" },
    ]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleUpdatePayment = (
    index: number,
    field: "method" | "value",
    val: string,
  ) => {
    const newPayments = [...payments];
    newPayments[index][field] = val;
    setPayments(newPayments);
  };

  const handleSave = async () => {
    if (!isDiffZero) {
      toast.error(
        "A soma dos pagamentos deve ser exatamente igual ao total da venda.",
      );
      return;
    }

    setLoading(true);
    try {
      const payload = payments.map((p) => ({
        method: p.method,
        value: parseFloat(p.value),
      }));

      await api.put(`/sales/${sale.id}/payments`, { payments: payload });
      toast.success("Forma de pagamento atualizada com sucesso!");
      onSuccess();
    } catch (e: any) {
      toast.error(
        e.response?.data?.message || "Erro ao atualizar pagamento.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/90 backdrop-blur-sm p-4">
      <div
        className="bg-page border border-line rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        aria-busy={loading}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line bg-page">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-support text-brand flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-ink tracking-tight">
                Editar Pagamento
              </h2>
              <p className="text-xs text-muted">
                Venda: {sale.id.split("-")[0]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            data-tooltip="Fechar"
            className="p-2 hover:bg-surface rounded-full text-muted hover:text-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center bg-page/50 p-4 rounded-2xl border border-line">
            <span className="text-muted font-medium">Total da Venda</span>
            <span className="text-2xl font-black text-brand">
              R$ {totalSale.toFixed(2)}
            </span>
          </div>

          <div className="space-y-3">
            {payments.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 bg-page p-3 rounded-xl border border-line"
              >
                <div className="flex-1">
                  <RetailSelect
                    aria-label={`Forma de pagamento ${idx + 1}`}
                    value={p.method}
                    onValueChange={(val) =>
                      handleUpdatePayment(idx, "method", val)
                    }
                    options={METHOD_OPTIONS}
                  />
                </div>

                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={p.value}
                    onChange={(e) =>
                      handleUpdatePayment(idx, "value", e.target.value)
                    }
                    className="w-full bg-page border border-line text-ink rounded-lg pl-8 pr-2 py-2 text-sm font-bold focus:outline-none focus:border-brand"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemovePayment(idx)}
                  aria-label="Remover forma de pagamento"
                  data-tooltip="Remover forma de pagamento"
                  className="p-2 text-muted hover:text-brand hover:bg-support rounded-lg transition-colors"
                  disabled={payments.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddPayment}
            className="w-full py-3 flex items-center justify-center gap-2 text-brand font-bold border border-brand hover:bg-support rounded-xl transition-colors text-sm cursor-pointer"
          >
            <Plus size={16} /> Adicionar forma de pagamento
          </button>

          {/* Validation Banner */}
          {!isDiffZero && (
            <div className="p-3 rounded-xl border flex items-center justify-between text-sm bg-support border-brand text-brand">
              <span className="font-bold">
                {diff > 0 ? "Falta distribuir:" : "Valor excedente:"}
              </span>
              <span className="font-black">R$ {Math.abs(diff).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-page flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-muted hover:bg-surface transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDiffZero || loading}
            className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand disabled:opacity-50 disabled:cursor-not-allowed text-on-brand transition-colors flex items-center gap-2 hover:text-on-brand"
          >
            {loading ? (
              <>
                <PdvLojistaLoader
                  mode="loader"
                  compact
                  size={16}
                  label="Salvando pagamento"
                />
                <span>Salvando…</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Salvar Pagamento</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
