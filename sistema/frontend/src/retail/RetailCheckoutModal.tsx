import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, Trash2, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useShift } from "@/contexts/ShiftContext";
import { submitDurableCheckout } from "@/lib/durable-checkout";
import { sendCheckout } from "@/lib/checkout-api";
import { saveOfflineSale, type OfflineSale } from "@/lib/db";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";
import { RetailSelect } from "@/components/ui/Select";
import { RetailSwitch } from "@/components/ui/Switch";
import { RetailDialog } from "./RetailDialog";
import { CustomerPicker } from "./CustomerPicker";
import { apiError, money } from "./types";

type Payment = {
  method: string;
  value: number;
  given: number;
  label: string;
  creditId?: string;
};
const methods = [
  { id: "dinheiro", name: "Dinheiro" },
  { id: "pix", name: "Pix" },
  { id: "credito", name: "Cartão de crédito" },
  { id: "debito", name: "Cartão de débito" },
];
const tPag: Record<string, string> = {
  dinheiro: "01",
  pix: "17",
  credito: "03",
  debito: "04",
  credito_loja: "99",
};
const cents = (n: number) => Math.round(n * 100) / 100;

export function RetailCheckoutModal({
  onClose,
  onDone,
  isOnline,
  config,
  initialMethod = "dinheiro",
}: {
  onClose: () => void;
  onDone: () => void;
  isOnline: boolean;
  config: any;
  initialMethod?: string;
}) {
  const cart = useCartStore();
  const user = useAuthStore((state) => state.user);
  const { operator, cashRegister, needsOperatorReauth } = useShift();
  const [customerId, setCustomerId] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [method, setMethod] = useState(initialMethod);
  const [value, setValue] = useState("");
  const [credits, setCredits] = useState<any[]>([]);
  const [creditId, setCreditId] = useState("");
  const [customMethods, setCustomMethods] = useState<
    { id: string; name: string }[]
  >([]);
  const [discount, setDiscount] = useState("0");
  const [pin, setPin] = useState("");
  const [pinApproved, setPinApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    kind: string;
    data?: any;
    message?: string;
    total: number;
    snapshot: any[];
  } | null>(null);
  const [emit, setEmit] = useState(false);
  const total = cents(cart.total - Number(discount || 0));
  const paid = cents(payments.reduce((sum, pay) => sum + pay.value, 0));
  const remaining = cents(total - paid);
  const methodsAll = [
    ...methods,
    ...customMethods.filter((m) => !methods.some((base) => base.id === m.id)),
  ];
  const modules = (() => {
    try {
      return typeof config?.modulos === "string"
        ? JSON.parse(config.modulos)
        : config?.modulos || {};
    } catch {
      return { nfce: false };
    }
  })();
  const nfceAvailable = Boolean(config?.nfceAtivo) && modules.nfce !== false;

  useEffect(() => {
    let active = true;
    api
      .get("/payment-methods")
      .then((res) => {
        if (active)
          setCustomMethods(
            (res.data || []).filter(
              (m: any) =>
                m.active &&
                !m.hasVariablePricing &&
                ![
                  "dinheiro",
                  "pix",
                  "credito",
                  "debito",
                  "consumo_funcionario",
                  "credito_loja",
                ].includes(m.id),
            ),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPayments([]);
    setError("");
  }, [customerId]);

  useEffect(() => {
    setCreditId("");
    setCredits([]);
    if (!customerId || !isOnline) return;
    const controller = new AbortController();
    api
      .get(`/retail/credits/${customerId}`, { signal: controller.signal })
      .then((res) => setCredits(res.data))
      .catch((err) => {
        if (!controller.signal.aborted) setError(apiError(err));
      });
    return () => controller.abort();
  }, [customerId, isOnline]);

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  function addPayment() {
    if (remaining <= 0) return;
    const given = value === "" ? remaining : cents(Number(value));
    if (!Number.isFinite(given) || given <= 0) {
      setError("Informe um valor positivo.");
      return;
    }
    if (method !== "dinheiro" && given > remaining) {
      setError("O valor não pode exceder o saldo da venda.");
      return;
    }
    if (method === "credito_loja") {
      const credit = credits.find((c) => c.id === creditId);
      const already = payments
        .filter((p) => p.creditId === creditId)
        .reduce((sum, p) => sum + p.value, 0);
      if (
        !isOnline ||
        !customerId ||
        !credit ||
        cents(already + given) > Number(credit.balance)
      ) {
        setError("Selecione um crédito com saldo suficiente e conexão ativa.");
        return;
      }
    }
    setPayments((rows) => [
      ...rows,
      {
        method,
        label:
          method === "credito_loja"
            ? "Crédito na loja"
            : methodsAll.find((m) => m.id === method)?.name || method,
        value: Math.min(given, remaining),
        given,
        ...(method === "credito_loja" ? { creditId } : {}),
      },
    ]);
    setValue("");
    setError("");
  }

  async function verifyPin() {
    setBusy(true);
    setError("");
    try {
      await api.post("/tenants/me/verify-discount-pin", { pin });
      setPinApproved(true);
      setPin("");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (
      !user?.tenant ||
      !operator?.id ||
      !cashRegister?.id ||
      needsOperatorReauth
    ) {
      setError("Entre com o PIN e confirme um caixa aberto.");
      return;
    }
    if (!payments.length || Math.abs(remaining) > 0.009 || total <= 0) {
      setError("Confira o total e os pagamentos.");
      return;
    }
    if (Number(discount) > 0 && !pinApproved) {
      setError("Autorize o desconto com o PIN gerencial.");
      return;
    }
    if (!isOnline && payments.some((p) => p.method === "credito_loja")) {
      setError("O crédito da loja exige conexão para conferir o saldo.");
      return;
    }
    setBusy(true);
    setError("");
    cart.setOperationLocked(true);
    const tenantId = user.tenant,
      operatorId = operator.id,
      operationId = cart.getOrCreateOperationId();
    const snapshot = cart.items.map((item) => ({ ...item }));
    const body = {
      idempotencyKey: operationId,
      items: snapshot.map((i) => ({
        productId: i.id,
        quantity: i.quantity,
        priceUnit: i.effectivePriceSell,
      })),
      payments: payments.map((p) => ({
        method: p.method,
        label: p.label,
        value: p.value,
        troco: p.method === "dinheiro" ? cents(p.given - p.value) : 0,
        ...(p.creditId ? { creditId: p.creditId } : {}),
      })),
      discount: Number(discount || 0),
      customerId: customerId || undefined,
      operatorId,
      cashRegisterId: cashRegister.id,
      emitirNfce: emit && isOnline && nfceAvailable,
    };
    const localSale: Omit<OfflineSale, "id"> = {
      localId: operationId,
      idempotencyKey: operationId,
      createdAt: new Date().toISOString(),
      operatorId,
      tenantId,
      cashRegisterId: cashRegister.id,
      subtotal: cart.total,
      total,
      discount: Number(discount || 0),
      items: snapshot.map((i) => ({
        productId: i.id,
        productName: i.name,
        unit: "UN",
        quantity: i.quantity,
        priceUnit: i.effectivePriceSell,
        discount: 0,
        subtotal: i.subtotal,
        ncm: i.ncm || null,
        cest: i.cest || null,
        origem: i.origem || 0,
        cfop: i.grupoTributacao?.cfop || "5102",
        csosn: i.grupoTributacao?.csosn || null,
        cstIcms: i.grupoTributacao?.cstIcms || null,
        aliqIcms: Number(i.grupoTributacao?.aliqIcms || 0),
        valorIcms: 0,
        cstPis: i.grupoTributacao?.cstPis || "99",
        aliqPis: Number(i.grupoTributacao?.aliqPis || 0),
        valorPis: 0,
        cstCofins: i.grupoTributacao?.cstCofins || "99",
        aliqCofins: Number(i.grupoTributacao?.aliqCofins || 0),
        valorCofins: 0,
      })),
      payments: body.payments.map((p) => ({
        ...p,
        method: p.method as "dinheiro",
        tPag: tPag[p.method] || "99",
      })),
      emitirNfce: false,
      rawPayload: body,
      syncStatus: isOnline ? "SYNCING" : "PENDING",
    };
    try {
      const outcome = isOnline
        ? await submitDurableCheckout(localSale, () =>
            sendCheckout(body, tenantId, operatorId),
          )
        : (await saveOfflineSale(localSale), { kind: "pending" as const });
      if (useAuthStore.getState().user?.tenant !== tenantId) return;
      cart.setOperationLocked(false);
      cart.clearCart();
      setResult({ ...outcome, total, snapshot });
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      cart.setOperationLocked(false);
      setBusy(false);
    }
  }

  if (result)
    return (
      <RetailDialog
        title={
          result.kind === "confirmed"
            ? "Venda concluída"
            : result.kind === "review"
              ? "Venda para conferência"
              : "Venda aguardando confirmação"
        }
        onClose={close}
      >
        <div className="retail-dialog-body retail-stack">
          <CheckCircle2 size={36} aria-hidden="true" />
          <div className="retail-receipt">
            <img
              src="/brand/logo-principal.svg"
              alt="PDV Lojista"
              className="retail-logo"
            />
            <h3>
              {result.kind === "confirmed"
                ? `Venda #${result.data?.code || result.data?.id}`
                : "Registro local — sem confirmação de venda"}
            </h3>
            {result.snapshot.map((item) => (
              <div className="retail-payment-line" key={item.cartKey}>
                <span>
                  {item.quantity} × {item.name}
                </span>
                <strong>{money(item.subtotal)}</strong>
              </div>
            ))}
            <div className="retail-total">
              <span>Total</span>
              <strong>{money(result.total)}</strong>
            </div>
          </div>
          <p className="retail-message" role="status">
            {result.kind === "confirmed"
              ? result.data?.emitirNfce
                ? "Venda confirmada. A emissão fiscal será acompanhada na gestão de NFC-e."
                : "Venda confirmada e estoque atualizado."
              : result.kind === "review"
                ? `${result.message} O registro foi preservado para conferência.`
                : "O registro está salvo neste dispositivo. A sincronização recupera esta mesma operação, sem gerar outra venda."}
          </p>
          {result.kind === "confirmed" && (
            <button
              type="button"
              className="retail-button"
              onClick={() => window.print()}
            >
              <Printer size={17} />
              Imprimir comprovante
            </button>
          )}
          <button
            type="button"
            className="retail-button retail-button-primary"
            onClick={close}
          >
            Voltar ao caixa
          </button>
        </div>
      </RetailDialog>
    );

  return (
    <RetailDialog title="Finalizar venda" onClose={close} busy={busy}>
      <div className="retail-dialog-body retail-stack" aria-busy={busy}>
        <div className="retail-total" style={{ border: 0, paddingTop: 0 }}>
          <span>Total a pagar</span>
          <strong>{money(total)}</strong>
        </div>
        <CustomerPicker
          value={customerId}
          onChange={setCustomerId}
          disabled={busy || !isOnline}
        />
        <div className="retail-payment-methods">
          {methodsAll.map((m) => (
            <button
              type="button"
              className={`retail-button ${method === m.id ? "retail-button-primary" : ""}`}
              key={m.id}
              disabled={busy}
              aria-pressed={method === m.id}
              onClick={() => {
                setMethod(m.id);
                setError("");
              }}
            >
              {m.name}
            </button>
          ))}
          <button
            type="button"
            className={`retail-button ${method === "credito_loja" ? "retail-button-primary" : ""}`}
            disabled={busy || !customerId || !isOnline}
            aria-pressed={method === "credito_loja"}
            onClick={() => setMethod("credito_loja")}
          >
            Crédito na loja
          </button>
        </div>
        {method === "credito_loja" && (
          <div className="retail-field">
            <span>Crédito disponível</span>
            <RetailSelect
              aria-label="Crédito disponível"
              value={creditId}
              onValueChange={setCreditId}
              disabled={busy}
              options={[
                { value: "", label: "Selecione o crédito" },
                ...credits.map((c) => ({
                  value: c.id,
                  label: `${money(c.balance)} · ${new Date(c.createdAt).toLocaleDateString("pt-BR")}`,
                })),
              ]}
            />
          </div>
        )}
        <div className="retail-row">
          <label className="retail-field" style={{ flex: 1 }}>
            {method === "dinheiro"
              ? "Valor recebido em dinheiro"
              : "Valor do pagamento"}
            <input
              disabled={busy}
              type="number"
              min=".01"
              step=".01"
              value={value}
              placeholder={Math.max(0, remaining).toFixed(2)}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="retail-button"
            disabled={busy || remaining <= 0}
            onClick={addPayment}
          >
            <Plus size={18} />
            Adicionar
          </button>
        </div>
        {payments.map((pay, i) => (
          <div className="retail-payment-line" key={i}>
            <span>
              {pay.label}
              {pay.given > pay.value && (
                <small className="retail-muted">
                  {" "}
                  · Troco: {money(pay.given - pay.value)}
                </small>
              )}
            </span>
            <span className="retail-row">
              <strong>{money(pay.value)}</strong>
              <button
                type="button"
                className="retail-icon-button"
                aria-label={`Remover pagamento ${pay.label}`}
                data-tooltip="Remover pagamento"
                disabled={busy}
                onClick={() =>
                  setPayments((rows) => rows.filter((_, index) => index !== i))
                }
              >
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        ))}
        <div className="retail-row retail-spread">
          <span>Falta pagar</span>
          <strong>{money(Math.max(0, remaining))}</strong>
        </div>
        <details>
          <summary className="retail-muted">Desconto autorizado</summary>
          {!pinApproved && (
            <div className="retail-row" style={{ marginTop: 12 }}>
              <label className="retail-field">
                PIN gerencial
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  disabled={busy}
                  onChange={(e) => setPin(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="retail-button"
                disabled={busy || !pin}
                onClick={() => void verifyPin()}
              >
                {busy ? (
                  <>
                    <PdvLojistaLoader
                      mode="loader"
                      compact
                      size={16}
                      label="Autorizando"
                    />
                    <span>Autorizando…</span>
                  </>
                ) : (
                  "Autorizar"
                )}
              </button>
            </div>
          )}
          <label className="retail-field" style={{ marginTop: 12 }}>
            Desconto (R$)
            <input
              type="number"
              min="0"
              max={Math.max(0, cart.total - 0.01)}
              step=".01"
              value={discount}
              disabled={busy || !pinApproved}
              onChange={(e) => {
                setDiscount(e.target.value);
                setPayments([]);
              }}
            />
          </label>
        </details>
        {nfceAvailable && (
          <RetailSwitch
            checked={emit}
            disabled={busy || !isOnline}
            onCheckedChange={setEmit}
            label="Emitir NFC-e"
          />
        )}
        {!isOnline && (
          <p className="retail-message">
            Sem conexão: o registro ficará pendente neste dispositivo. Créditos
            da loja ficam indisponíveis até a reconexão.
          </p>
        )}
        {error && (
          <p role="alert" className="retail-message">
            {error}
          </p>
        )}
      </div>
      <footer className="retail-dialog-footer">
        <button
          type="button"
          className="retail-button"
          onClick={close}
          disabled={busy}
        >
          Voltar
        </button>
        <button
          type="button"
          className="retail-button retail-button-primary"
          disabled={
            busy ||
            !payments.length ||
            Math.abs(remaining) > 0.009 ||
            total <= 0
          }
          onClick={() => void submit()}
        >
          {busy ? (
            <>
              <PdvLojistaLoader
                mode="loader"
                compact
                size={18}
                label="Processando venda"
              />
              <span>Processando…</span>
            </>
          ) : isOnline ? (
            "Confirmar venda"
          ) : (
            "Salvar registro pendente"
          )}
        </button>
      </footer>
    </RetailDialog>
  );
}
