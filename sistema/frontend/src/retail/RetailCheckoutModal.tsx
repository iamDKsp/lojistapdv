import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  AlertCircle,
  BadgePercent,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  CreditCard,
  Landmark,
  Lock,
  LockOpen,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Ticket,
  Trash2,
  WifiOff,
  Zap,
} from "lucide-react";
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
  installments?: number;
  firstDueDate?: string;
};

type PaymentTileOption = {
  id: string;
  name: string;
  hint: string;
  icon: ComponentType<{ size?: number }>;
  disabled: boolean;
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
  crediario: "05",
  credito_loja: "99",
};

const cents = (n: number) => Math.round(n * 100) / 100;

export type DiscountMode = "amount" | "percent";

export function computeCheckoutDiscount(
  subtotal: number,
  mode: DiscountMode,
  rawInput: string,
): {
  discountAmount: number;
  effectivePct: number;
  wasClamped: boolean;
} {
  const safeSubtotal = Math.max(0, cents(subtotal));
  const maxDiscount = Math.max(0, cents(safeSubtotal - 0.01));
  const normalized = String(rawInput ?? "").trim().replace(",", ".");
  const parsed = normalized === "" ? 0 : Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || maxDiscount <= 0) {
    return { discountAmount: 0, effectivePct: 0, wasClamped: false };
  }
  if (mode === "percent") {
    const clampedPct = Math.min(100, Math.max(0, parsed));
    const rawAmount = cents((safeSubtotal * clampedPct) / 100);
    const discountAmount = Math.min(rawAmount, maxDiscount);
    const effectivePct =
      safeSubtotal > 0
        ? Math.round((discountAmount / safeSubtotal) * 1000) / 10
        : 0;
    return {
      discountAmount,
      effectivePct,
      wasClamped: parsed > 100 || rawAmount > maxDiscount,
    };
  }
  const rawAmount = cents(Math.max(0, parsed));
  const discountAmount = Math.min(rawAmount, maxDiscount);
  const effectivePct =
    safeSubtotal > 0
      ? Math.round((discountAmount / safeSubtotal) * 1000) / 10
      : 0;
  return {
    discountAmount,
    effectivePct,
    wasClamped: rawAmount > maxDiscount,
  };
}

function formatPctPtBr(pct: number): string {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(".", ",");
}

function defaultDueDateIso(days = 30): string {
  const dt = new Date(Date.now() + Math.max(1, days) * 86400000);
  return dt.toISOString().slice(0, 10);
}

function resolveMethodVisual(id: string): {
  icon: ComponentType<{ size?: number }>;
  hint: string;
} {
  switch (id) {
    case "dinheiro":
      return { icon: Banknote, hint: "Espécie e troco" };
    case "pix":
      return { icon: QrCode, hint: "Instantâneo" };
    case "credito":
      return { icon: CreditCard, hint: "Maquininha · crédito" };
    case "debito":
      return { icon: Landmark, hint: "Maquininha · à vista" };
    case "crediario":
      return { icon: CalendarClock, hint: "Carnê parcelado" };
    case "credito_loja":
      return { icon: Ticket, hint: "Vale-troca da loja" };
    default:
      return { icon: Coins, hint: "Personalizado" };
  }
}

function buildQuickAmounts(
  remaining: number,
  method: string,
): { label: string; amount: number }[] {
  if (remaining <= 0) return [];
  if (method === "dinheiro") {
    const steps = remaining >= 100 ? [10, 20, 50, 100] : [5, 10, 20, 50, 100];
    const candidates = new Set<number>();
    for (const step of steps) {
      const rounded = Math.ceil(remaining / step) * step;
      if (rounded > remaining + 0.009) candidates.add(cents(rounded));
    }
    const nextFifty = Math.ceil(remaining / 50) * 50 + 50;
    if (nextFifty > remaining + 0.009) candidates.add(cents(nextFifty));
    const sorted = [...candidates].sort((a, b) => a - b).slice(0, 3);
    return [
      { label: `Exato · ${money(remaining)}`, amount: remaining },
      ...sorted.map((amt) => ({ label: money(amt), amount: amt })),
    ];
  }
  const list: { label: string; amount: number }[] = [
    { label: `Restante · ${money(remaining)}`, amount: remaining },
  ];
  if (remaining >= 2) {
    const half = cents(remaining / 2);
    list.push({ label: `50% · ${money(half)}`, amount: half });
  }
  return list;
}

function StorefrontBrandBadge() {
  return (
    <span className="retail-checkout-brand-emblem" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
        <path d="M12 13H23V41H50V52H12Z" fill="currentColor" />
        <g transform="translate(28 10) scale(1.04)">
          <path d="M3 12H21V23H3Z" fill="currentColor" />
          <path
            d="M6 23V16Q6 15 7 15H10Q11 15 11 16V23Z"
            fill="var(--pdv-support)"
          />
          <rect
            x="14"
            y="15"
            width="4"
            height="5"
            rx=".7"
            fill="var(--pdv-support)"
          />
          <path
            d="M4 2H9L8 9C7.5 12 0 12 1 9Z M10 2H14L15 9C16 12 8 12 9 9Z M15 2H20L23 9C24 12 16.5 12 16 9Z"
            fill="currentColor"
          />
        </g>
      </svg>
    </span>
  );
}

export function RetailCheckoutModal({
  onClose,
  onDone,
  isOnline,
  config,
  initialMethod = "dinheiro",
  initialOpenDiscount = false,
}: {
  onClose: () => void;
  onDone: () => void;
  isOnline: boolean;
  config: any;
  initialMethod?: string;
  initialOpenDiscount?: boolean;
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
  const [customerCrediario, setCustomerCrediario] = useState<any | null>(null);
  const [installments, setInstallments] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState(() => defaultDueDateIso(30));
  const [customMethods, setCustomMethods] = useState<
    { id: string; name: string }[]
  >([]);
  const [discount, setDiscount] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("amount");
  const [discountDrawerOpen, setDiscountDrawerOpen] = useState(
    Boolean(initialOpenDiscount),
  );
  const [pin, setPin] = useState("");
  const [pinApproved, setPinApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    kind: string;
    data?: any;
    message?: string;
    subtotal: number;
    discount: number;
    discountPct: number;
    total: number;
    snapshot: any[];
  } | null>(null);
  const [emit, setEmit] = useState(false);
  const pinInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);

  const maxDiscountAmount = Math.max(0, cents(cart.total - 0.01));
  const {
    discountAmount: discountNumber,
    effectivePct: effectiveDiscountPct,
    wasClamped: discountWasClamped,
  } = useMemo(
    () => computeCheckoutDiscount(cart.total, discountMode, discount),
    [cart.total, discountMode, discount],
  );
  const discountQuickPresets = useMemo(() => {
    if (maxDiscountAmount <= 0) return [];
    if (discountMode === "percent") {
      return [5, 10, 15, 20].map((pct) => ({
        label: `${pct}%`,
        rawValue: String(pct),
      }));
    }
    return [5, 10, 15, 20, 50]
      .filter((amt) => amt <= maxDiscountAmount)
      .slice(0, 4)
      .map((amt) => ({
        label: `R$ ${amt}`,
        rawValue: String(amt),
      }));
  }, [discountMode, maxDiscountAmount]);
  const total = cents(cart.total - discountNumber);
  const paid = cents(payments.reduce((sum, pay) => sum + pay.value, 0));
  const remaining = cents(total - paid);
  const totalTroco = cents(
    payments.reduce(
      (sum, pay) =>
        sum + (pay.method === "dinheiro" ? Math.max(0, pay.given - pay.value) : 0),
      0,
    ),
  );
  const totalPieces = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart.items],
  );
  const paidPercent =
    total > 0 ? Math.min(100, Math.max(0, Math.round((paid / total) * 100))) : 0;
  const isSettled = payments.length > 0 && Math.abs(remaining) <= 0.009 && total > 0;

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
  const crediarioAvailable = Boolean(modules.crediario);

  const paymentTiles: PaymentTileOption[] = useMemo(() => {
    const base: PaymentTileOption[] = methodsAll.map((m) => {
      const vis = resolveMethodVisual(m.id);
      return {
        id: m.id,
        name: m.name,
        hint: vis.hint,
        icon: vis.icon,
        disabled: busy,
      };
    });
    if (crediarioAvailable) {
      const vis = resolveMethodVisual("crediario");
      base.push({
        id: "crediario",
        name: "Fiado / Crediário",
        hint: vis.hint,
        icon: vis.icon,
        disabled: busy || !isOnline,
      });
    }
    const creditVis = resolveMethodVisual("credito_loja");
    base.push({
      id: "credito_loja",
      name: "Crédito na loja",
      hint: customerId ? creditVis.hint : "Requer cliente",
      icon: creditVis.icon,
      disabled: busy || !customerId || !isOnline,
    });
    return base;
  }, [methodsAll, crediarioAvailable, busy, isOnline, customerId]);

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
                  "crediario",
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
    setCustomerCrediario(null);
    if (!customerId || !isOnline) return;
    const controller = new AbortController();
    api
      .get(`/retail/credits/${customerId}`, { signal: controller.signal })
      .then((res) => setCredits(res.data))
      .catch((err) => {
        if (!controller.signal.aborted) setError(apiError(err));
      });
    if (crediarioAvailable) {
      api
        .get(`/crediario/customers/${customerId}`, { signal: controller.signal })
        .then((res) => {
          setCustomerCrediario(res.data);
          const dueDays = Number(res.data?.settings?.defaultDueDays || 30);
          setFirstDueDate(defaultDueDateIso(dueDays));
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [customerId, isOnline, crediarioAvailable]);

  useEffect(() => {
    if (busy || result) return;
    function onShortcutKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest('[role="listbox"]'))
      ) {
        return;
      }
      const num = Number(event.key);
      if (Number.isInteger(num) && num >= 1 && num <= paymentTiles.length) {
        const chosen = paymentTiles[num - 1];
        if (chosen && !chosen.disabled) {
          event.preventDefault();
          setMethod(chosen.id);
          setError("");
        }
      }
    }
    window.addEventListener("keydown", onShortcutKey);
    return () => window.removeEventListener("keydown", onShortcutKey);
  }, [busy, result, paymentTiles]);

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  function commitPayment(explicitAmount?: number) {
    if (remaining <= 0) return;
    const given =
      explicitAmount !== undefined
        ? cents(explicitAmount)
        : value === ""
          ? remaining
          : cents(Number(value));
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
    if (method === "crediario") {
      if (!isOnline || !customerId) {
        setError(
          "Selecione um cliente cadastrado e confirme conexão ativa para lançar no Fiado / Crediário.",
        );
        return;
      }
      if (
        customerCrediario?.summary &&
        !customerCrediario.summary.canBuyOnCrediario
      ) {
        setError(
          customerCrediario.summary.blockReason ||
            "Este cliente não está apto para compras no crediário.",
        );
        return;
      }
      const alreadyCrediario = payments
        .filter((p) => p.method === "crediario")
        .reduce((sum, p) => sum + p.value, 0);
      const effectiveTake = Math.min(given, remaining);
      if (
        customerCrediario?.summary &&
        cents(alreadyCrediario + effectiveTake) >
          Number(customerCrediario.summary.availableCredit)
      ) {
        setError(
          `Limite insuficiente no crediário. Disponível: ${money(customerCrediario.summary.availableCredit)}.`,
        );
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) {
        setError("Informe uma data válida para o 1º vencimento do crediário.");
        return;
      }
    }
    const instCount = Math.max(1, Number(installments || 1));
    setPayments((rows) => [
      ...rows,
      {
        method,
        label:
          method === "credito_loja"
            ? "Crédito na loja"
            : method === "crediario"
              ? instCount > 1
                ? `Fiado / Crediário (${instCount}x)`
                : "Fiado / Crediário"
              : methodsAll.find((m) => m.id === method)?.name || method,
        value: Math.min(given, remaining),
        given,
        ...(method === "credito_loja" ? { creditId } : {}),
        ...(method === "crediario"
          ? { installments: instCount, firstDueDate }
          : {}),
      },
    ]);
    setValue("");
    setError("");
  }

  function addPayment() {
    commitPayment();
  }

  useEffect(() => {
    if (!discountDrawerOpen) return;
    const timer = window.setTimeout(() => {
      if (!pinApproved) {
        pinInputRef.current?.focus();
      } else {
        discountInputRef.current?.focus();
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [discountDrawerOpen, pinApproved]);

  function switchDiscountMode(nextMode: DiscountMode) {
    if (nextMode === discountMode) return;
    const currentParsed = Number(String(discount).trim().replace(",", "."));
    if (
      nextMode === "percent" &&
      Number.isFinite(currentParsed) &&
      currentParsed >= 100
    ) {
      setDiscount("");
    }
    if (discount.trim() !== "") {
      setPayments([]);
    }
    setDiscountMode(nextMode);
    setError("");
    window.setTimeout(() => discountInputRef.current?.focus(), 20);
  }

  async function verifyPin() {
    setBusy(true);
    setError("");
    try {
      await api.post("/tenants/me/verify-discount-pin", { pin });
      setPinApproved(true);
      setDiscountDrawerOpen(true);
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
    if (discountNumber > 0 && !pinApproved) {
      setError("Autorize o desconto com o PIN gerencial.");
      return;
    }
    if (
      !isOnline &&
      payments.some(
        (p) => p.method === "credito_loja" || p.method === "crediario",
      )
    ) {
      setError(
        "O crédito da loja e o crediário exigem conexão ativa para validar o saldo do cliente.",
      );
      return;
    }
    setBusy(true);
    setError("");
    cart.setOperationLocked(true);
    const tenantId = user.tenant,
      operatorId = operator.id,
      operationId = cart.getOrCreateOperationId(),
      subtotalSnapshot = cart.total;
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
        ...(p.method === "crediario"
          ? {
              installments: p.installments || 1,
              firstDueDate: p.firstDueDate,
            }
          : {}),
      })),
      discount: discountNumber,
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
      subtotal: subtotalSnapshot,
      total,
      discount: discountNumber,
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
      setResult({
        ...outcome,
        subtotal: subtotalSnapshot,
        discount: discountNumber,
        discountPct: effectiveDiscountPct,
        total,
        snapshot,
      });
      onDone();
    } catch (err) {
      setError(apiError(err));
    } finally {
      cart.setOperationLocked(false);
      setBusy(false);
    }
  }

  if (result) {
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
        className="retail-checkout-result-dialog"
        topSlot={<div className="retail-checkout-top-bar" aria-hidden="true" />}
        headerIcon={<StorefrontBrandBadge />}
      >
        <div className="retail-dialog-body retail-checkout-result-body">
          <div className="retail-result-hero">
            <span className="retail-result-check-halo" aria-hidden="true">
              <CheckCircle2 size={30} />
            </span>
            <div className="retail-result-hero-copy">
              <span className="retail-checkout-kicker">
                {result.kind === "confirmed"
                  ? "Comprovante emitido"
                  : "Registro preservado"}
              </span>
              <strong>
                {result.kind === "confirmed"
                  ? `Venda #${result.data?.code || result.data?.id}`
                  : "Registro local — sem confirmação online"}
              </strong>
            </div>
          </div>

          <div className="retail-checkout-ticket is-receipt-view">
            <div className="retail-ticket-awning" aria-hidden="true" />
            <div className="retail-ticket-head">
              <img
                src="/brand/logo-principal.svg"
                alt="PDV Lojista"
                className="retail-receipt-logo"
              />
              <span className="retail-ticket-pill">
                {result.snapshot.reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0,
                )}{" "}
                un.
              </span>
            </div>

            <div className="retail-ticket-items-list">
              {result.snapshot.map((item) => (
                <div className="retail-ticket-item-line" key={item.cartKey}>
                  <span>
                    <strong>{item.quantity}×</strong> {item.name}
                  </span>
                  <strong className="retail-number">
                    {money(item.subtotal)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="retail-ticket-tear" aria-hidden="true">
              <span className="retail-ticket-notch is-left" />
              <span className="retail-ticket-dashed" />
              <span className="retail-ticket-notch is-right" />
            </div>

            {result.discount > 0 && (
              <div className="retail-receipt-discount-breakdown">
                <div className="retail-ticket-subrow">
                  <span>Subtotal</span>
                  <span className="retail-number">
                    {money(result.subtotal)}
                  </span>
                </div>
                <div className="retail-ticket-subrow is-discount">
                  <span>Desconto ({formatPctPtBr(result.discountPct)}%)</span>
                  <strong className="retail-number">
                    -{money(result.discount)}
                  </strong>
                </div>
              </div>
            )}

            <div className="retail-ticket-total-block">
              <span>Total liquidado</span>
              <strong className="retail-number">{money(result.total)}</strong>
            </div>
          </div>

          <p className="retail-checkout-notice" role="status">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>
              {result.kind === "confirmed"
                ? result.data?.emitirNfce
                  ? "Venda confirmada. A emissão fiscal será acompanhada na gestão de NFC-e."
                  : "Venda confirmada e estoque atualizado."
                : result.kind === "review"
                  ? `${result.message} O registro foi preservado para conferência.`
                  : "O registro está salvo neste dispositivo. A sincronização recupera esta mesma operação, sem gerar outra venda."}
            </span>
          </p>

          <div className="retail-result-actions">
            {result.kind === "confirmed" && (
              <button
                type="button"
                className="retail-button"
                onClick={() => window.print()}
              >
                <Printer size={17} aria-hidden="true" />
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
        </div>
      </RetailDialog>
    );
  }

  const maxInstallments = Math.max(
    1,
    Number(customerCrediario?.settings?.maxInstallments || 6),
  );
  const quickAmounts = buildQuickAmounts(remaining, method);
  const valueLabel =
    method === "dinheiro"
      ? "Valor recebido em dinheiro"
      : method === "crediario"
        ? "Valor a lançar no crediário"
        : "Valor do pagamento";
  const simulatedCashGiven = value === "" ? 0 : cents(Number(value));
  const simulatedTroco =
    method === "dinheiro" &&
    remaining > 0 &&
    Number.isFinite(simulatedCashGiven) &&
    simulatedCashGiven > remaining
      ? cents(simulatedCashGiven - remaining)
      : 0;
  const activeMethodObj = paymentTiles.find((m) => m.id === method);
  const canInstantSettle =
    remaining > 0 &&
    !busy &&
    method !== "credito_loja" &&
    !(method === "crediario" && (!customerId || !isOnline));

  return (
    <RetailDialog
      title="Finalizar venda"
      onClose={close}
      busy={busy}
      className="retail-checkout-dialog"
      topSlot={<div className="retail-checkout-top-bar" aria-hidden="true" />}
      headerIcon={<StorefrontBrandBadge />}
      headerMeta={
        <div className="retail-checkout-header-pills" aria-hidden="true">
          <span className="retail-checkout-meta-pill">
            {totalPieces} {totalPieces === 1 ? "peça" : "peças"}
          </span>
          {operator?.name && (
            <span className="retail-checkout-meta-pill is-subtle">
              {operator.name.split(" ")[0]}
            </span>
          )}
        </div>
      }
    >
      <div className="retail-dialog-body retail-checkout-body" aria-busy={busy}>
        <div className="retail-checkout-grid">
          {/* Coluna Esquerda: Identificação, Meios de Pagamento e Lançamento */}
          <div className="retail-checkout-ops">
            <CustomerPicker
              value={customerId}
              onChange={setCustomerId}
              required={method === "crediario" || method === "credito_loja"}
              disabled={busy || !isOnline}
            />

            <div className="retail-checkout-section">
              <div className="retail-field-head">
                <span className="retail-checkout-section-label">
                  Forma de pagamento
                </span>
                <span className="retail-shortcut-caption" aria-hidden="true">
                  Atalhos 1–{paymentTiles.length}
                </span>
              </div>
              <div
                className="retail-pay-grid"
                role="group"
                aria-label="Formas de pagamento"
              >
                {paymentTiles.map((opt, idx) => {
                  const Icon = opt.icon;
                  const isSelected = method === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      className={`retail-pay-tile ${isSelected ? "is-selected" : ""}`}
                      disabled={opt.disabled}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setMethod(opt.id);
                        setError("");
                      }}
                    >
                      <span className="retail-pay-tile-icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span className="retail-pay-tile-copy">
                        <span className="retail-pay-tile-name">{opt.name}</span>
                        <small
                          className="retail-pay-tile-hint"
                          aria-hidden="true"
                        >
                          {opt.hint}
                        </small>
                      </span>
                      <span
                        className="retail-pay-tile-badge"
                        aria-hidden="true"
                      >
                        {isSelected ? (
                          <Check size={12} strokeWidth={2.8} />
                        ) : (
                          idx + 1
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {method === "credito_loja" && (
              <div className="retail-checkout-subpanel">
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
              </div>
            )}

            {method === "crediario" && (
              <div className="retail-checkout-subpanel retail-stack-compact">
                {!customerId ? (
                  <small className="retail-muted">
                    Selecione ou cadastre o cliente acima para consultar o limite
                    do crediário.
                  </small>
                ) : customerCrediario?.summary ? (
                  <div className="retail-crediario-summary">
                    <div className="retail-row retail-spread">
                      <span>Limite disponível</span>
                      <strong className="retail-number">
                        {money(customerCrediario.summary.availableCredit)}
                      </strong>
                    </div>
                    <div className="retail-row retail-spread">
                      <small className="retail-muted">
                        Em aberto: {money(customerCrediario.summary.usedCredit)}{" "}
                        / Limite:{" "}
                        {money(customerCrediario.summary.effectiveCreditLimit)}
                      </small>
                      {!customerCrediario.summary.canBuyOnCrediario && (
                        <small className="retail-crediario-alert">
                          <AlertCircle size={13} aria-hidden="true" />
                          <span>{customerCrediario.summary.blockReason}</span>
                        </small>
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="retail-form-grid">
                  <label className="retail-field">
                    Parcelas
                    <RetailSelect
                      aria-label="Parcelas do crediário"
                      value={installments}
                      onValueChange={setInstallments}
                      disabled={busy}
                      options={Array.from(
                        { length: maxInstallments },
                        (_, idx) => {
                          const count = idx + 1;
                          const baseVal =
                            remaining > 0 ? cents(remaining / count) : 0;
                          return {
                            value: String(count),
                            label:
                              count === 1
                                ? `1x à prazo (${money(remaining)})`
                                : `${count}x de ~${money(baseVal)}`,
                          };
                        },
                      )}
                    />
                  </label>
                  <label className="retail-field">
                    1º Vencimento
                    <input
                      type="date"
                      value={firstDueDate}
                      disabled={busy}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="retail-pay-entry-card">
              <div className="retail-pay-entry-row">
                <div className="retail-field" style={{ flex: 1 }}>
                  <label htmlFor="retail-checkout-amount">{valueLabel}</label>
                  <div className="retail-currency-input-wrap">
                    <span className="retail-currency-prefix" aria-hidden="true">
                      R$
                    </span>
                    <input
                      id="retail-checkout-amount"
                      disabled={busy}
                      type="number"
                      min=".01"
                      step=".01"
                      className="retail-number"
                      value={value}
                      placeholder={Math.max(0, remaining).toFixed(2)}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && remaining > 0) {
                          e.preventDefault();
                          addPayment();
                        }
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="retail-button retail-pay-add-btn"
                  disabled={busy || remaining <= 0}
                  onClick={addPayment}
                >
                  <Plus size={18} aria-hidden="true" />
                  Adicionar
                </button>
              </div>

              {remaining > 0 && quickAmounts.length > 0 && (
                <div className="retail-quick-chips-row">
                  <div className="retail-quick-chips">
                    {quickAmounts.map((chip) => {
                      const activeChip =
                        value !== "" &&
                        Math.abs(Number(value) - chip.amount) < 0.005;
                      return (
                        <button
                          type="button"
                          key={chip.label}
                          disabled={busy}
                          className={`retail-quick-chip ${activeChip ? "is-active" : ""}`}
                          onClick={() => {
                            setValue(chip.amount.toFixed(2));
                            setError("");
                          }}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  {simulatedTroco > 0 && (
                    <span className="retail-simulated-troco retail-number">
                      <Coins size={13} aria-hidden="true" />
                      Troco: {money(simulatedTroco)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div
              className={`retail-discount-card ${discountDrawerOpen || discountNumber > 0 ? "is-open" : ""}`}
            >
              <div className="retail-discount-bar">
                <div className="retail-discount-info">
                  <span
                    className={`retail-discount-icon ${pinApproved ? "is-unlocked" : ""}`}
                    aria-hidden="true"
                  >
                    <BadgePercent size={14} />
                  </span>
                  <div className="retail-discount-copy">
                    <strong>
                      {discountNumber > 0
                        ? `Desconto aplicado: -${money(discountNumber)} (${formatPctPtBr(effectiveDiscountPct)}%)`
                        : pinApproved
                          ? "Desconto liberado (% ou R$)"
                          : "Desconto autorizado (% ou R$)"}
                    </strong>
                    <small>
                      {pinApproved
                        ? "Escolha entre valor em R$ ou percentual (%)"
                        : "Requer autorização por PIN gerencial"}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="retail-pill-toggle"
                  disabled={busy}
                  aria-expanded={discountDrawerOpen}
                  onClick={() => setDiscountDrawerOpen((open) => !open)}
                >
                  {pinApproved ? (
                    <LockOpen size={12} aria-hidden="true" />
                  ) : (
                    <Lock size={12} aria-hidden="true" />
                  )}
                  <span>
                    {discountDrawerOpen
                      ? "Ocultar"
                      : pinApproved
                        ? "Editar desconto"
                        : "Liberar PIN"}
                  </span>
                </button>
              </div>

              {discountDrawerOpen && (
                <div className="retail-discount-drawer">
                  {!pinApproved ? (
                    <div className="retail-pay-entry-row">
                      <label className="retail-field" style={{ flex: 1 }}>
                        PIN gerencial
                        <input
                          ref={pinInputRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          className="pdv-secret-input"
                          placeholder="Digite o PIN"
                          value={pin}
                          disabled={busy}
                          onChange={(e) => setPin(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && pin) {
                              e.preventDefault();
                              void verifyPin();
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="retail-button retail-button-primary retail-pay-add-btn"
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
                  ) : (
                    <>
                      <div className="retail-discount-mode-head">
                        <label htmlFor="retail-checkout-discount">
                          {discountMode === "percent"
                            ? "Desconto percentual (%)"
                            : "Desconto em valor (R$)"}
                        </label>
                        <div
                          className="retail-discount-mode-switch"
                          role="group"
                          aria-label="Modo de cálculo do desconto"
                        >
                          <button
                            type="button"
                            disabled={busy}
                            aria-pressed={discountMode === "amount"}
                            className={`retail-discount-mode-btn ${discountMode === "amount" ? "is-active" : ""}`}
                            onClick={() => switchDiscountMode("amount")}
                          >
                            <Banknote size={13} aria-hidden="true" />
                            <span>Valor (R$)</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            aria-pressed={discountMode === "percent"}
                            className={`retail-discount-mode-btn ${discountMode === "percent" ? "is-active" : ""}`}
                            onClick={() => switchDiscountMode("percent")}
                          >
                            <BadgePercent size={13} aria-hidden="true" />
                            <span>Percentual (%)</span>
                          </button>
                        </div>
                      </div>

                      <div className="retail-field">
                        <div className="retail-currency-input-wrap">
                          <span
                            className="retail-currency-prefix"
                            aria-hidden="true"
                          >
                            {discountMode === "percent" ? "%" : "R$"}
                          </span>
                          <input
                            id="retail-checkout-discount"
                            ref={discountInputRef}
                            type="number"
                            min="0"
                            max={
                              discountMode === "percent"
                                ? 99.99
                                : maxDiscountAmount
                            }
                            step=".01"
                            placeholder={
                              discountMode === "percent"
                                ? "Ex.: 10"
                                : "Ex.: 15,00"
                            }
                            className="retail-number"
                            value={discount}
                            disabled={busy || maxDiscountAmount <= 0}
                            onChange={(e) => {
                              setDiscount(e.target.value);
                              setPayments([]);
                              setError("");
                            }}
                          />
                        </div>
                      </div>

                      {(discountQuickPresets.length > 0 ||
                        discountNumber > 0) && (
                        <div className="retail-quick-chips-row">
                          <div className="retail-quick-chips">
                            {discountQuickPresets.map((preset) => {
                              const parsedInput = Number(
                                String(discount).trim().replace(",", "."),
                              );
                              const isActivePreset =
                                discount.trim() !== "" &&
                                Number.isFinite(parsedInput) &&
                                Math.abs(
                                  parsedInput - Number(preset.rawValue),
                                ) < 0.005;
                              return (
                                <button
                                  type="button"
                                  key={preset.label}
                                  disabled={busy}
                                  className={`retail-quick-chip ${isActivePreset ? "is-active" : ""}`}
                                  onClick={() => {
                                    setDiscount(preset.rawValue);
                                    setPayments([]);
                                    setError("");
                                  }}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                            {discountNumber > 0 && (
                              <button
                                type="button"
                                disabled={busy}
                                className="retail-quick-chip"
                                onClick={() => {
                                  setDiscount("");
                                  setPayments([]);
                                  setError("");
                                }}
                              >
                                Limpar
                              </button>
                            )}
                          </div>

                          {discountNumber > 0 && (
                            <span className="retail-discount-preview retail-number">
                              <BadgePercent size={13} aria-hidden="true" />
                              {discountMode === "percent"
                                ? `Equivale a -${money(discountNumber)} · Final: ${money(total)}`
                                : `Equivale a ${formatPctPtBr(effectiveDiscountPct)}% · Final: ${money(total)}`}
                            </span>
                          )}
                        </div>
                      )}

                      {discountWasClamped && maxDiscountAmount > 0 && (
                        <small className="retail-discount-clamp-note">
                          Ajustado ao limite máximo ({money(maxDiscountAmount)})
                          para manter total positivo na venda.
                        </small>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Cupom Vivo de Balcão */}
          <aside
            className="retail-checkout-ticket"
            aria-label="Resumo do cupom de venda"
          >
            <div className="retail-ticket-awning" aria-hidden="true" />
            <div className="retail-ticket-top">
              <div className="retail-ticket-head">
                <span className="retail-ticket-tag">
                  <ReceiptText size={13} aria-hidden="true" />
                  Cupom de balcão
                </span>
                <span className="retail-ticket-pill">
                  {cart.items.length}{" "}
                  {cart.items.length === 1 ? "item" : "itens"}
                </span>
              </div>

              {cart.items.length > 0 && (
                <div className="retail-ticket-mini-items">
                  {cart.items.slice(0, 3).map((item) => (
                    <div
                      className="retail-ticket-mini-item"
                      key={item.cartKey}
                    >
                      <span className="retail-ticket-mini-name">
                        <strong>{item.quantity}×</strong> {item.name}
                      </span>
                      <span className="retail-number">
                        {money(item.subtotal)}
                      </span>
                    </div>
                  ))}
                  {cart.items.length > 3 && (
                    <small className="retail-ticket-more-items">
                      + {cart.items.length - 3} outro(s) item(ns) na sacola
                    </small>
                  )}
                </div>
              )}

              <div className="retail-ticket-subtotals">
                <div className="retail-ticket-subrow">
                  <span>Subtotal</span>
                  <span className="retail-number">{money(cart.total)}</span>
                </div>
                {discountNumber > 0 && (
                  <div className="retail-ticket-subrow is-discount">
                    <span>
                      Desconto ({formatPctPtBr(effectiveDiscountPct)}%)
                    </span>
                    <strong className="retail-number">
                      -{money(discountNumber)}
                    </strong>
                  </div>
                )}
              </div>

              <div className="retail-ticket-hero-total">
                <span>Total a pagar</span>
                <strong className="retail-number">{money(total)}</strong>
              </div>
            </div>

            <div className="retail-ticket-tear" aria-hidden="true">
              <span className="retail-ticket-notch is-left" />
              <span className="retail-ticket-dashed" />
              <span className="retail-ticket-notch is-right" />
            </div>

            <div className="retail-ticket-bottom">
              <div className="retail-settlement-progress">
                <div className="retail-settlement-head">
                  <span>Composição do pagamento</span>
                  <strong className="retail-number">{paidPercent}%</strong>
                </div>
                <div className="retail-settlement-bar" aria-hidden="true">
                  <div
                    className="retail-settlement-bar-fill"
                    style={{ width: `${paidPercent}%` }}
                  />
                </div>
              </div>

              {payments.length === 0 ? (
                <div className="retail-ticket-empty-ledger">
                  <p>Nenhum pagamento lançado no cupom.</p>
                  {canInstantSettle && activeMethodObj && (
                    <button
                      type="button"
                      className="retail-instant-settle-btn"
                      onClick={() => commitPayment(remaining)}
                    >
                      <Zap size={13} aria-hidden="true" />
                      <span>
                        Quitar {money(remaining)} em {activeMethodObj.name}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="retail-ticket-payments-list">
                  {payments.map((pay, i) => {
                    const MethodIcon = resolveMethodVisual(pay.method).icon;
                    return (
                      <div className="retail-ticket-pay-row" key={i}>
                        <div className="retail-ticket-pay-main">
                          <span
                            className="retail-ticket-pay-icon"
                            aria-hidden="true"
                          >
                            <MethodIcon size={14} />
                          </span>
                          <div className="retail-ticket-pay-text">
                            <strong>{pay.label}</strong>
                            {pay.firstDueDate && (
                              <small>
                                1º venc:{" "}
                                {pay.firstDueDate
                                  .split("-")
                                  .reverse()
                                  .join("/")}
                              </small>
                            )}
                            {pay.given > pay.value && (
                              <small>
                                Recebido {money(pay.given)} · Troco{" "}
                                {money(pay.given - pay.value)}
                              </small>
                            )}
                          </div>
                        </div>
                        <div className="retail-ticket-pay-right">
                          <strong className="retail-number">
                            {money(pay.value)}
                          </strong>
                          <button
                            type="button"
                            className="retail-ticket-remove-btn"
                            aria-label={`Remover pagamento ${pay.label}`}
                            data-tooltip="Remover pagamento"
                            disabled={busy}
                            onClick={() =>
                              setPayments((rows) =>
                                rows.filter((_, index) => index !== i),
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                className={`retail-ticket-balance-box ${isSettled ? "is-settled" : ""}`}
              >
                <div className="retail-ticket-balance-main">
                  <span className="retail-ticket-balance-label">
                    {isSettled ? (
                      <CheckCircle2 size={16} aria-hidden="true" />
                    ) : (
                      <Clock3 size={16} aria-hidden="true" />
                    )}
                    <span>Falta pagar</span>
                  </span>
                  <strong className="retail-number">
                    {money(Math.max(0, remaining))}
                  </strong>
                </div>
                {isSettled && (
                  <small className="retail-ticket-settled-note">
                    Total coberto — pronto para confirmar a venda
                  </small>
                )}
              </div>

              {totalTroco > 0 && (
                <div className="retail-ticket-troco-box">
                  <span>
                    <Coins size={15} aria-hidden="true" />
                    Troco a devolver
                  </span>
                  <strong className="retail-number">{money(totalTroco)}</strong>
                </div>
              )}

              {nfceAvailable && (
                <div className="retail-ticket-nfce-row">
                  <RetailSwitch
                    checked={emit}
                    disabled={busy || !isOnline}
                    onCheckedChange={setEmit}
                    label="Emitir NFC-e"
                  />
                </div>
              )}
            </div>
          </aside>
        </div>

        {!isOnline && (
          <p className="retail-checkout-notice">
            <WifiOff size={16} aria-hidden="true" />
            <span>
              Sem conexão: o registro ficará pendente neste dispositivo.
              Créditos da loja e crediário ficam indisponíveis até a reconexão.
            </span>
          </p>
        )}

        {error && (
          <p role="alert" className="retail-checkout-notice is-alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>

      <footer className="retail-dialog-footer retail-checkout-footer">
        <span className="retail-checkout-footer-hint" aria-hidden="true">
          {isSettled
            ? "Confira o cupom ao lado e finalize"
            : "Lance um ou mais pagamentos até zerar o saldo"}
        </span>
        <div className="retail-checkout-footer-btns">
          <button
            type="button"
            className="retail-button retail-checkout-back-btn"
            onClick={close}
            disabled={busy}
          >
            Voltar
          </button>
          <button
            type="button"
            className="retail-button retail-button-primary retail-checkout-submit-btn"
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
              <>
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>Confirmar venda</span>
              </>
            ) : (
              "Salvar registro pendente"
            )}
          </button>
        </div>
      </footer>
    </RetailDialog>
  );
}
