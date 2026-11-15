import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useShift } from "@/contexts/ShiftContext";
import { useAuthStore } from "@/store/auth";
import {
  OperatorInlineBadge,
  StockItemThumb,
} from "@/components/EntityPhotos";
import { apiError, money } from "./types";

export interface PosOrderAlertItem {
  id: string;
  code: number;
  reference: string;
  customerName: string;
  customerPhone: string;
  customerWhatsappUrl: string | null;
  customerTrackingWhatsappUrl: string | null;
  fulfillmentMode: "PICKUP" | "DELIVERY";
  dropoffCopyLine: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  city: string | null;
  zipCode: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  commercialStatus: string;
  reservationStatus: string;
  fulfillmentStatus: string;
  version: number;
  createdAt: string;
  confirmedByUserId?: string | null;
  confirmedByName?: string | null;
  confirmedByImageUrl?: string | null;
  expressQuote?: {
    provider: "99_ENTREGAS";
    vehicleType: "MOTO" | "CARRO";
    label?: string;
    fee: number;
    distanceKm: number | null;
    estimatedMinutes: number;
    freeShippingApplied?: boolean;
  } | null;
  expressDispatch?: {
    provider: "99_ENTREGAS";
    status:
      | "WAITING"
      | "FOUND"
      | "REQUESTED"
      | "PICKED_UP"
      | "DISPATCHED"
      | "DELIVERED";
    vehicleType: "MOTO" | "CARRO";
    courierName: string | null;
    courierPhone: string | null;
    vehiclePlate: string | null;
    trackingUrl: string | null;
    confirmationPin: string;
    notes: string | null;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    size: string | null;
    color: string | null;
    quantity: number;
    priceUnit: number;
    subtotal: number;
    imageUrl?: string | null;
  }>;
}

export interface PosAlertsPayload {
  enabled: boolean;
  expressDeliveryModuleEnabled: boolean;
  storeName: string | null;
  originAddressLine: string | null;
  serverTime: string;
  totalActionableCount: number;
  pendingConfirmationCount: number;
  pendingDeliveryCount: number;
  activeExpressCount: number;
  latestOrderId: string | null;
  latestOrderAt: string | null;
  alerts: PosOrderAlertItem[];
}

const SOUND_MUTE_STORAGE_KEY = "pdv_pos_delivery_sound_muted_v1";
const SEEN_ORDERS_SESSION_KEY = "pdv_pos_seen_order_ids_v1";

function playDeliveryNotificationChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + startOffset + 0.03);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + startOffset + duration,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    // Acorde duplo ascendente nítido (Mi5 -> Si5 -> Mi6)
    playNote(659.25, 0, 0.2);
    playNote(987.77, 0.16, 0.22);
    playNote(1318.51, 0.34, 0.38);

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1100);
  } catch {
    // Ignorar caso navegador bloqueie áudio antes de interação
  }
}

function loadSeenOrderIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_ORDERS_SESSION_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function persistSeenOrderIds(ids: Set<string>) {
  try {
    const recent = Array.from(ids).slice(-120);
    sessionStorage.setItem(SEEN_ORDERS_SESSION_KEY, JSON.stringify(recent));
  } catch {
    // ignore
  }
}

export function usePosStorefrontAlerts({
  enabled,
  isOnline,
}: {
  enabled: boolean;
  isOnline: boolean;
}) {
  const [data, setData] = useState<PosAlertsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_MUTE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const soundMutedRef = useRef(soundMuted);
  soundMutedRef.current = soundMuted;

  const toggleSoundMuted = useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_MUTE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      if (!next) {
        playDeliveryNotificationChime();
      }
      return next;
    });
  }, []);

  const refreshAlerts = useCallback(
    async (silent = true) => {
      if (!enabled || !isOnline) return;
      if (!silent) setLoading(true);
      try {
        const res = await api.get<PosAlertsPayload>(
          "/storefront/admin/pos-alerts",
        );
        const payload = res.data;
        setData(payload);

        if (payload?.enabled && Array.isArray(payload.alerts)) {
          const seen = loadSeenOrderIds();
          const unseenPending = payload.alerts.filter(
            (ord) =>
              ord.commercialStatus === "AWAITING_CONFIRMATION" &&
              !seen.has(ord.id),
          );

          if (unseenPending.length > 0) {
            for (const ord of unseenPending) {
              seen.add(ord.id);
            }
            persistSeenOrderIds(seen);

            const topDelivery =
              unseenPending.find((o) => o.fulfillmentMode === "DELIVERY") ||
              unseenPending[0];

            if (!soundMutedRef.current) {
              playDeliveryNotificationChime();
            }

            const isDelivery = topDelivery.fulfillmentMode === "DELIVERY";
            toast.info(
              isDelivery
                ? `Nova Entrega 99 na Loja Virtual: ${topDelivery.reference} (${topDelivery.customerName})`
                : `Novo Pedido de Retirada: ${topDelivery.reference} (${topDelivery.customerName})`,
              {
                duration: 8000,
                action: {
                  label: "Atender no Caixa",
                  onClick: () => {
                    setSelectedOrderId(topDelivery.id);
                    setDrawerOpen(true);
                  },
                },
              },
            );
          }
        }
      } catch {
        // Silencioso no caixa para não interromper operação local
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [enabled, isOnline],
  );

  useEffect(() => {
    if (!enabled || !isOnline) return;
    void refreshAlerts(true);
    const interval = window.setInterval(() => {
      void refreshAlerts(true);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [enabled, isOnline, refreshAlerts]);

  const openDrawerForOrder = useCallback((orderId?: string | null) => {
    if (orderId) setSelectedOrderId(orderId);
    setDrawerOpen(true);
  }, []);

  return {
    alertsData: data,
    loadingAlerts: loading,
    drawerOpen,
    setDrawerOpen,
    selectedOrderId,
    setSelectedOrderId,
    openDrawerForOrder,
    soundMuted,
    toggleSoundMuted,
    refreshAlerts,
  };
}

/**
 * Faixa de notificação ativa na Frente de Caixa quando há entregas 99 ou pedidos aguardando ação
 */
export function PosDeliveryAlertBanner({
  alertsData,
  soundMuted,
  onToggleSound,
  onOpenDrawer,
}: {
  alertsData: PosAlertsPayload | null;
  soundMuted: boolean;
  onToggleSound: () => void;
  onOpenDrawer: (orderId?: string | null) => void;
}) {
  if (!alertsData?.enabled || alertsData.totalActionableCount <= 0) {
    return null;
  }

  const deliveryOrders = alertsData.alerts.filter(
    (a) => a.fulfillmentMode === "DELIVERY",
  );
  const featuredOrder = deliveryOrders[0] || alertsData.alerts[0];
  const hasDelivery = deliveryOrders.length > 0;

  return (
    <div
      role="region"
      aria-label="Alertas de entregas da Loja Virtual"
      className="mx-3 mt-2 rounded-2xl border border-brand bg-support px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand font-extrabold text-xs">
          {hasDelivery ? "99" : <ShoppingBag size={16} />}
          {alertsData.pendingConfirmationCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-ink ring-2 ring-surface animate-ping" />
          )}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-extrabold text-ink">
            {hasDelivery ? (
              <span>
                {deliveryOrders.length === 1
                  ? "1 pedido de Entrega 99 na Loja Virtual"
                  : `${deliveryOrders.length} pedidos de Entrega 99 na Loja Virtual`}
              </span>
            ) : (
              <span>
                {alertsData.totalActionableCount} pedido(s) da Loja Virtual para
                atendimento
              </span>
            )}
            {alertsData.pendingConfirmationCount > 0 && (
              <span className="rounded-full bg-brand text-on-brand px-2 py-0.5 text-[11px] font-bold">
                {alertsData.pendingConfirmationCount} aguardando confirmação
              </span>
            )}
          </div>
          {featuredOrder && (
            <p className="text-xs text-muted truncate">
              Último: <strong className="text-ink">{featuredOrder.reference}</strong> ·{" "}
              {featuredOrder.customerName} ·{" "}
              {featuredOrder.fulfillmentMode === "DELIVERY"
                ? `${
                    featuredOrder.expressQuote?.vehicleType === "CARRO"
                      ? "99Entrega Carro"
                      : "99Entrega Moto"
                  }${
                    featuredOrder.neighborhood
                      ? ` (${featuredOrder.neighborhood})`
                      : ""
                  }`
                : "Retirada na loja"}{" "}
              · <strong className="text-brand">{money(featuredOrder.total)}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleSound}
          title={
            soundMuted
              ? "Ativar alerta sonoro de entregas"
              : "Silenciar alerta sonoro de entregas"
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink hover:border-brand transition cursor-pointer"
        >
          {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <button
          type="button"
          onClick={() => onOpenDrawer(featuredOrder?.id || null)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-on-brand px-4 py-2 text-xs font-extrabold transition shadow-xs cursor-pointer"
        >
          <Truck size={15} />
          <span>Atender Entrega agora</span>
        </button>
      </div>
    </div>
  );
}

const POS_QUICK_PAYMENT_METHODS = [
  { id: "pix", label: "Pix" },
  { id: "credito", label: "Cartão Crédito" },
  { id: "debito", label: "Cartão Débito" },
  { id: "dinheiro", label: "Dinheiro" },
] as const;

/**
 * Gaveta rápida sobreposta à Frente de Caixa para confirmar pedidos, despachar 99 Entregas e faturar sem sair do PDV
 */
export function PosDeliveryAlertDrawer({
  open,
  onClose,
  alertsData,
  loading,
  selectedOrderId,
  onSelectOrderId,
  cashRegisterId,
  operatorId,
  onRefresh,
  onSaleConverted,
}: {
  open: boolean;
  onClose: () => void;
  alertsData: PosAlertsPayload | null;
  loading: boolean;
  selectedOrderId: string | null;
  onSelectOrderId: (id: string) => void;
  cashRegisterId?: string | null;
  operatorId?: string | null;
  onRefresh: (silent?: boolean) => Promise<void>;
  onSaleConverted: () => void;
}) {
  const shift = useShift();
  const authUser = useAuthStore((s) => s.user);
  const [filterMode, setFilterMode] = useState<"ALL" | "DELIVERY" | "PICKUP">(
    "ALL",
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Campos de despacho 99 da ordem selecionada
  const [vehicleType, setVehicleType] = useState<"MOTO" | "CARRO">("MOTO");
  const [dispatchStatus, setDispatchStatus] = useState<
    | "WAITING"
    | "FOUND"
    | "REQUESTED"
    | "PICKED_UP"
    | "DISPATCHED"
    | "DELIVERED"
  >("REQUESTED");
  const [courierName, setCourierName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [confirmationPin, setConfirmationPin] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");

  const orders = alertsData?.alerts || [];
  const filteredOrders = orders.filter((o) =>
    filterMode === "ALL" ? true : o.fulfillmentMode === filterMode,
  );

  const activeOrder =
    filteredOrders.find((o) => o.id === selectedOrderId) ||
    filteredOrders[0] ||
    null;

  useEffect(() => {
    if (!activeOrder) return;
    const disp = activeOrder.expressDispatch;
    const quote = activeOrder.expressQuote;
    setVehicleType(disp?.vehicleType || quote?.vehicleType || "MOTO");
    setDispatchStatus(disp?.status || "REQUESTED");
    setCourierName(disp?.courierName || "");
    setVehiclePlate(disp?.vehiclePlate || "");
    setTrackingUrl(disp?.trackingUrl || "");
    setConfirmationPin(disp?.confirmationPin || "");
  }, [activeOrder?.id, activeOrder?.version]);

  if (!open) return null;

  const handleConfirmOrder = async (order: PosOrderAlertItem) => {
    setBusyAction("confirm");
    try {
      await api.post(`/storefront/admin/orders/${order.id}/confirm`, {
        expectedVersion: order.version,
      });
      toast.success(`Pedido ${order.reference} confirmado e reservado!`);
      await onRefresh(false);
    } catch (err) {
      toast.error(apiError(err, "Não foi possível confirmar o pedido."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveDispatch = async (
    order: PosOrderAlertItem,
    overrideStatus?:
      | "WAITING"
      | "FOUND"
      | "REQUESTED"
      | "PICKED_UP"
      | "DISPATCHED"
      | "DELIVERED",
    openWhatsappAfter = false,
  ) => {
    const nextSt = overrideStatus || dispatchStatus;
    setBusyAction(`dispatch-${nextSt}`);
    try {
      const { data } = await api.put(
        `/storefront/admin/orders/${order.id}/dispatch-99`,
        {
          status: nextSt,
          vehicleType,
          courierName: courierName.trim() || null,
          vehiclePlate: vehiclePlate.trim().toUpperCase() || null,
          trackingUrl: trackingUrl.trim() || null,
          confirmationPin: confirmationPin.trim() || null,
        },
      );
      setDispatchStatus(nextSt);
      toast.success(
        nextSt === "DISPATCHED"
          ? "Entrega 99 marcada como A Caminho! Animação atualizada para o cliente."
          : nextSt === "DELIVERED"
            ? "Entrega 99 concluída com sucesso!"
            : "Despacho 99 atualizado!",
      );
      await onRefresh(false);

      if (openWhatsappAfter && data?.customerTrackingWhatsappUrl) {
        window.open(
          data.customerTrackingWhatsappUrl,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (err) {
      toast.error(apiError(err, "Falha ao atualizar despacho 99 Entregas."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleConvertToSale = async (order: PosOrderAlertItem) => {
    setBusyAction("convert");
    try {
      await api.post(`/storefront/admin/orders/${order.id}/convert-to-sale`, {
        paymentMethodName: paymentMethod,
        cashRegisterId: cashRegisterId || undefined,
        operatorId: operatorId || undefined,
        expectedVersion: order.version,
      });
      toast.success(
        `Pedido ${order.reference} convertido em venda no caixa com sucesso!`,
      );
      onSaleConverted();
      await onRefresh(false);
    } catch (err) {
      toast.error(apiError(err, "Não foi possível faturar o pedido no caixa."));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-ink/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-surface text-ink h-full shadow-2xl border-l border-line flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho da Gaveta */}
        <div className="px-5 py-4 border-b border-line bg-page flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-on-brand font-extrabold text-sm">
              99
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-ink">
                Central de Entregas & Pedidos no Caixa
              </h2>
              <p className="text-xs text-muted">
                Confirme reservas, acione o entregador 99 e fature vendas sem
                sair da Frente de Caixa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onRefresh(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink hover:border-brand cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Atualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel de entregas"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink hover:border-brand cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corpo dividido: Lista à esquerda + Operação à direita */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Coluna Esquerda: Fila de Pedidos */}
          <div className="md:col-span-5 border-r border-line bg-page flex flex-col overflow-hidden">
            <div className="p-3 border-b border-line flex items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: `Todos (${orders.length})` },
                  {
                    id: "DELIVERY",
                    label: `Entregas 99 (${
                      orders.filter((o) => o.fulfillmentMode === "DELIVERY")
                        .length
                    })`,
                  },
                  {
                    id: "PICKUP",
                    label: `Retiradas (${
                      orders.filter((o) => o.fulfillmentMode === "PICKUP")
                        .length
                    })`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterMode === tab.id
                      ? "bg-brand text-on-brand"
                      : "bg-surface text-muted border border-line hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted space-y-2">
                  <Bell className="mx-auto text-brand" size={24} />
                  <p className="font-bold text-ink">
                    Nenhum pedido pendente nesta fila
                  </p>
                  <p>
                    Novos pedidos de entrega da Loja Virtual aparecerão aqui com
                    alerta sonoro automático.
                  </p>
                </div>
              ) : (
                filteredOrders.map((ord) => {
                  const selected = activeOrder?.id === ord.id;
                  const isDelivery = ord.fulfillmentMode === "DELIVERY";
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => onSelectOrderId(ord.id)}
                      className={`w-full text-left rounded-2xl border p-3.5 transition cursor-pointer space-y-1.5 ${
                        selected
                          ? "border-brand bg-support shadow-xs"
                          : "border-line bg-surface hover:border-brand"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-extrabold text-ink">
                          {ord.reference}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            isDelivery
                              ? "bg-brand text-on-brand"
                              : "bg-page border border-line text-ink"
                          }`}
                        >
                          {isDelivery ? (
                            <>
                              <Truck size={11} />
                              <span>
                                {ord.expressDispatch?.vehicleType === "CARRO" ||
                                ord.expressQuote?.vehicleType === "CARRO"
                                  ? "99 Carro"
                                  : "99 Moto"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Store size={11} />
                              <span>Retirada</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-ink truncate">
                          {ord.customerName}
                        </span>
                        <span className="text-xs font-extrabold text-brand tabular-nums">
                          {money(ord.total)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                        <span className="truncate">
                          {ord.commercialStatus === "AWAITING_CONFIRMATION"
                            ? "• Aguardando confirmação"
                            : `• Confirmado (${
                                ord.expressDispatch?.status === "DISPATCHED"
                                  ? "99 a caminho"
                                  : ord.expressDispatch?.status === "REQUESTED"
                                    ? "Chamando 99"
                                    : "Em separação"
                              })`}
                        </span>
                        <span>
                          {new Date(ord.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {ord.items.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {ord.items.slice(0, 4).map((it) => (
                            <StockItemThumb
                              key={it.id}
                              size="xs"
                              name={it.productName}
                              imageUrl={it.imageUrl}
                              product={it}
                            />
                          ))}
                          {ord.items.length > 4 && (
                            <span className="text-[10px] font-bold text-muted">
                              +{ord.items.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna Direita: Detalhes + Despacho 99 + Conversão em Venda */}
          <div className="md:col-span-7 overflow-y-auto p-5 space-y-5">
            {!activeOrder ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted text-xs">
                <Package size={28} className="text-brand mb-2" />
                <p>Selecione um pedido à esquerda para operar.</p>
              </div>
            ) : (
              <>
                {/* Cabeçalho do Pedido Selecionado */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-line">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono text-lg font-extrabold text-ink">
                        {activeOrder.reference}
                      </h3>
                      <span className="rounded-full bg-support border border-brand px-2.5 py-0.5 text-[11px] font-bold text-brand">
                        {activeOrder.commercialStatus ===
                        "AWAITING_CONFIRMATION"
                          ? "Aguardando Confirmação"
                          : "Confirmado"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-ink mt-1">
                      {activeOrder.customerName} · {activeOrder.customerPhone}
                    </p>
                    {activeOrder.confirmedByName && (
                      <div className="mt-1.5 text-xs">
                        <OperatorInlineBadge
                          size="xs"
                          variant="pill"
                          label="Confirmado por:"
                          name={activeOrder.confirmedByName}
                          imageUrl={activeOrder.confirmedByImageUrl}
                          operatorId={activeOrder.confirmedByUserId}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeOrder.customerWhatsappUrl && (
                      <a
                        href={activeOrder.customerWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand bg-support px-3 py-2 text-xs font-extrabold text-brand hover:bg-brand hover:text-on-brand transition"
                      >
                        <MessageCircle size={14} />
                        <span>Falar no WhatsApp</span>
                      </a>
                    )}
                    {activeOrder.commercialStatus ===
                      "AWAITING_CONFIRMATION" && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() => void handleConfirmOrder(activeOrder)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-on-brand px-3.5 py-2 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                      >
                        {busyAction === "confirm" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        <span>Confirmar Pedido</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bloco de Despacho 99 Entregas */}
                {activeOrder.fulfillmentMode === "DELIVERY" && (
                  <div className="rounded-2xl border border-brand bg-page p-4 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-on-brand font-extrabold text-xs">
                          99
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-ink">
                            Despacho Express 99 Entregas
                          </h4>
                          <p className="text-[11px] text-muted">
                            {activeOrder.expressQuote?.distanceKm
                              ? `Distância estimada ~${Number(
                                  activeOrder.expressQuote.distanceKm,
                                )
                                  .toFixed(1)
                                  .replace(".", ",")} km · `
                              : ""}
                            Frete cobrado:{" "}
                            <strong className="text-brand">
                              {activeOrder.deliveryFee === 0
                                ? "Grátis"
                                : money(activeOrder.deliveryFee)}
                            </strong>
                          </p>
                        </div>
                      </div>

                      <a
                        href="https://empresas.99app.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-bold text-ink hover:border-brand"
                      >
                        <span>Portal 99 Empresas</span>
                        <ExternalLink size={12} className="text-brand" />
                      </a>
                    </div>

                    {/* Endereços de Coleta e Entrega com cópia rápida */}
                    <div className="space-y-2 rounded-xl border border-line bg-surface p-3 text-xs">
                      {alertsData?.originAddressLine && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-extrabold uppercase text-muted block">
                              Coleta (Loja)
                            </span>
                            <p className="text-ink truncate">
                              {alertsData.originAddressLine}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                alertsData.originAddressLine || "",
                              );
                              toast.success("Endereço de coleta copiado!");
                            }}
                            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-ink hover:border-brand cursor-pointer"
                          >
                            <Copy size={12} />
                            <span>Copiar</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
                        <div className="min-w-0">
                          <span className="text-[10px] font-extrabold uppercase text-brand block">
                            Destino (Cliente)
                          </span>
                          <p className="font-bold text-ink">
                            {activeOrder.dropoffCopyLine ||
                              [
                                activeOrder.addressLine,
                                activeOrder.addressNumber,
                                activeOrder.neighborhood,
                                activeOrder.city,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              activeOrder.dropoffCopyLine || "",
                            );
                            toast.success(
                              "Endereço de entrega copiado para colar na 99!",
                            );
                          }}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-support border border-brand px-2.5 py-1 text-[11px] font-bold text-brand cursor-pointer"
                        >
                          <Copy size={12} />
                          <span>Copiar Destino</span>
                        </button>
                      </div>
                    </div>

                    {/* Botões rápidos das 5 etapas da animação 2D Motion */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {(
                        [
                          { id: "FOUND", label: "1. Encontrou" },
                          { id: "REQUESTED", label: "2. Indo à loja" },
                          { id: "PICKED_UP", label: "3. Pegou pacote" },
                          { id: "DISPATCHED", label: "4. Chegando" },
                          { id: "DELIVERED", label: "5. Entregue" },
                        ] as const
                      ).map((st) => {
                        const currentSt =
                          activeOrder.expressDispatch?.status || dispatchStatus;
                        const active =
                          currentSt === st.id ||
                          (st.id === "FOUND" && currentSt === "WAITING");
                        return (
                          <button
                            key={st.id}
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() =>
                              void handleSaveDispatch(activeOrder, st.id, false)
                            }
                            className={`py-2 px-1.5 rounded-xl border text-[11px] font-extrabold transition cursor-pointer ${
                              active
                                ? "bg-brand border-brand text-on-brand"
                                : "bg-surface border-line text-ink hover:border-brand"
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Dados do motorista, placa, link de rastreio e PIN */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-muted block mb-1">
                          Modalidade 99
                        </label>
                        <select
                          value={vehicleType}
                          onChange={(e) =>
                            setVehicleType(
                              e.target.value === "CARRO" ? "CARRO" : "MOTO",
                            )
                          }
                          className="w-full p-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink"
                        >
                          <option value="MOTO">99Entrega Moto</option>
                          <option value="CARRO">99Entrega Carro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted block mb-1">
                          Entregador
                        </label>
                        <input
                          type="text"
                          value={courierName}
                          onChange={(e) => setCourierName(e.target.value)}
                          placeholder="Nome na 99"
                          className="w-full p-2 rounded-xl border border-line bg-surface text-xs text-ink"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-muted block mb-1">
                          Placa / PIN
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={vehiclePlate}
                            onChange={(e) =>
                              setVehiclePlate(e.target.value.toUpperCase())
                            }
                            placeholder="ABC1D23"
                            maxLength={8}
                            className="w-full p-2 rounded-xl border border-line bg-surface text-xs font-mono uppercase text-ink"
                          />
                          <span
                            title="PIN de segurança do cliente"
                            className="inline-flex items-center gap-1 rounded-xl border border-brand bg-support px-2 text-xs font-mono font-extrabold text-brand shrink-0"
                          >
                            <ShieldCheck size={12} />
                            {confirmationPin || "----"}
                          </span>
                        </div>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[11px] font-bold text-muted block mb-1">
                          Link de Rastreio da Corrida 99 (opcional — aparece na
                          tela do cliente)
                        </label>
                        <input
                          type="url"
                          value={trackingUrl}
                          onChange={(e) => setTrackingUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full p-2 rounded-xl border border-line bg-surface text-xs text-ink"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() =>
                          void handleSaveDispatch(
                            activeOrder,
                            "DISPATCHED",
                            true,
                          )
                        }
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-on-brand py-2.5 px-4 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                      >
                        <Navigation size={14} />
                        <span>
                          Despachar 99 e Enviar Rastreio no WhatsApp
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Itens do Pedido */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                    Itens Reservados ({activeOrder.items.length})
                  </h4>
                  <div className="rounded-2xl border border-line divide-y divide-line overflow-hidden bg-surface">
                    {activeOrder.items.map((it) => (
                      <div
                        key={it.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StockItemThumb
                            size="sm"
                            name={it.productName}
                            imageUrl={it.imageUrl}
                            product={it}
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-ink">
                              {it.quantity}x {it.productName}
                            </span>
                            {(it.size || it.color) && (
                              <span className="text-muted ml-1.5">
                                ({[it.size, it.color].filter(Boolean).join(" / ")})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-extrabold text-ink tabular-nums shrink-0">
                          {money(it.subtotal)}
                        </span>
                      </div>
                    ))}
                    <div className="px-3.5 py-2.5 bg-page space-y-1 text-xs">
                      <div className="flex justify-between text-muted">
                        <span>Subtotal mercadorias</span>
                        <span>{money(activeOrder.subtotal)}</span>
                      </div>
                      {activeOrder.fulfillmentMode === "DELIVERY" && (
                        <div className="flex justify-between text-muted">
                          <span>Frete 99 Entregas</span>
                          <span className="font-bold text-brand">
                            {activeOrder.deliveryFee === 0
                              ? "Grátis"
                              : money(activeOrder.deliveryFee)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-extrabold text-sm text-ink pt-1 border-t border-line">
                        <span>Total a Receber</span>
                        <span className="text-brand">
                          {money(activeOrder.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Faturamento Rápido no Caixa */}
                <div className="rounded-2xl border border-line bg-page p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wallet size={15} className="text-brand" />
                      <h4 className="text-xs sm:text-sm font-extrabold text-ink">
                        Converter Pedido em Venda neste Caixa
                      </h4>
                    </div>
                    {(shift.operator?.name || authUser?.name) && (
                      <OperatorInlineBadge
                        size="xs"
                        variant="pill"
                        label="Operador:"
                        name={shift.operator?.name || authUser?.name}
                        imageUrl={shift.operator?.imageUrl ?? authUser?.imageUrl}
                        operatorId={shift.operator?.id || authUser?.id}
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {POS_QUICK_PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          paymentMethod === pm.id
                            ? "border-brand bg-support text-brand"
                            : "border-line bg-surface text-ink hover:border-brand"
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleConvertToSale(activeOrder)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-brand text-on-brand py-3 px-4 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                  >
                    {busyAction === "convert" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>
                      Finalizar Venda no Caixa ({money(activeOrder.total)})
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
