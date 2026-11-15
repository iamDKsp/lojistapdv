import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";

export interface PublicExpressQuoteOption {
  vehicleType: "MOTO" | "CARRO";
  label: string;
  description: string;
  fee: number;
  originalFee: number;
  freeShippingApplied: boolean;
  estimatedMinutes: number;
}

export interface PublicExpressQuoteResponse {
  available: boolean;
  provider: "99_ENTREGAS";
  reasonCode?:
    | "MODULE_DISABLED"
    | "MIN_ORDER_NOT_REACHED"
    | "OUT_OF_RADIUS"
    | "INVALID_CEP";
  message?: string;
  originLabel: string;
  destination: {
    zipCode: string | null;
    street: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  };
  distanceKm: number | null;
  maxRadiusKm: number;
  minOrderAmount: number;
  remainingForMinOrder: number;
  freeShippingAbove: number | null;
  remainingForFreeShipping: number;
  freeShippingApplied: boolean;
  selectedVehicle: "MOTO" | "CARRO";
  selectedFee: number;
  estimatedMinutes: number;
  options: PublicExpressQuoteOption[];
}

export interface PublicOrderExpressDispatch {
  provider: "99_ENTREGAS";
  status: "WAITING" | "REQUESTED" | "DISPATCHED" | "DELIVERED";
  vehicleType: "MOTO" | "CARRO";
  courierName: string | null;
  vehiclePlate: string | null;
  trackingUrl: string | null;
  confirmationPin: string | null;
  requestedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  updatedAt: string | null;
}

export interface PublicOrderExpressQuote {
  provider: "99_ENTREGAS";
  vehicleType: "MOTO" | "CARRO";
  label: string;
  fee: number;
  distanceKm: number | null;
  estimatedMinutes: number;
  freeShippingApplied: boolean;
  originLabel: string | null;
}

function formatBrl(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Ícone vetorial exclusivo da Moto 99 Entregas (100% paleta aprovada)
 */
function VectorMoto99({
  size = 44,
  moving = false,
}: {
  size?: number;
  moving?: boolean;
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.78)}
      viewBox="0 0 64 50"
      fill="none"
      aria-hidden="true"
    >
      {moving && (
        <>
          <line
            x1="2"
            y1="26"
            x2="10"
            y2="26"
            stroke="#7C3AED"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="4"
            y1="32"
            x2="12"
            y2="32"
            stroke="#E5E1ED"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {/* Baú 99 */}
      <rect
        x="12"
        y="12"
        width="17"
        height="15"
        rx="3.5"
        fill="#7C3AED"
        stroke="#272321"
        strokeWidth="1.8"
      />
      <text
        x="20.5"
        y="22"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="8.5"
        fontWeight="800"
        fontFamily="sans-serif"
      >
        99
      </text>
      {/* Capacete e piloto */}
      <circle cx="35" cy="12" r="5" fill="#272321" />
      <path
        d="M36 10.5H39.5C39.8 11.8 39.2 13 37.5 13H36V10.5Z"
        fill="#F3E8FF"
      />
      <path
        d="M31 18C33 17 37 18 40 23L35 28H28L31 18Z"
        fill="#6D28D9"
      />
      {/* Chassi da scooter */}
      <path
        d="M16 29H37L43 19H47L51 31H44L39 35H20L16 29Z"
        fill="#272321"
      />
      <path
        d="M46 19L51 19"
        stroke="#7C3AED"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Farol dianteiro */}
      {moving && (
        <path
          d="M52 23L62 20V28L52 25Z"
          fill="#F3E8FF"
          fillOpacity="0.85"
        />
      )}
      {/* Rodas */}
      <circle
        cx="20"
        cy="37"
        r="6.5"
        fill="#272321"
        stroke="#7C3AED"
        strokeWidth="2"
      />
      <circle cx="20" cy="37" r="2.5" fill="#FFFFFF" />
      <circle
        cx="48"
        cy="37"
        r="6.5"
        fill="#272321"
        stroke="#7C3AED"
        strokeWidth="2"
      />
      <circle cx="48" cy="37" r="2.5" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Ícone vetorial exclusivo do Carro 99 Entregas (100% paleta aprovada)
 */
function VectorCarro99({
  size = 48,
  moving = false,
}: {
  size?: number;
  moving?: boolean;
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.72)}
      viewBox="0 0 68 48"
      fill="none"
      aria-hidden="true"
    >
      {moving && (
        <>
          <line
            x1="1"
            y1="25"
            x2="8"
            y2="25"
            stroke="#7C3AED"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="3"
            y1="31"
            x2="9"
            y2="31"
            stroke="#E5E1ED"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {/* Placa de teto 99 */}
      <rect x="27" y="9" width="14" height="6" rx="2" fill="#272321" />
      {/* Carroceria */}
      <path
        d="M12 25L19 15H43L52 24L59 26C60.7 26.5 61.5 28 61.5 29.8V35H10V27.5C10 26.2 10.8 25.3 12 25Z"
        fill="#7C3AED"
        stroke="#272321"
        strokeWidth="1.8"
      />
      {/* Janelas */}
      <path d="M21 17.5H32V24H16.5L21 17.5Z" fill="#F3E8FF" />
      <path d="M35 17.5H42L48.5 24H35V17.5Z" fill="#F3E8FF" />
      {/* Emblema 99 na porta */}
      <rect x="27" y="26" width="14" height="7.5" rx="2" fill="#FFFFFF" />
      <text
        x="34"
        y="32"
        textAnchor="middle"
        fill="#272321"
        fontSize="6.8"
        fontWeight="800"
        fontFamily="sans-serif"
      >
        99
      </text>
      {moving && (
        <path
          d="M61.5 28L68 25V33L61.5 31Z"
          fill="#F3E8FF"
          fillOpacity="0.9"
        />
      )}
      {/* Rodas */}
      <circle
        cx="21"
        cy="36.5"
        r="6.2"
        fill="#272321"
        stroke="#FFFFFF"
        strokeWidth="1.8"
      />
      <circle cx="21" cy="36.5" r="2.3" fill="#7C3AED" />
      <circle
        cx="49"
        cy="36.5"
        r="6.2"
        fill="#272321"
        stroke="#FFFFFF"
        strokeWidth="1.8"
      />
      <circle cx="49" cy="36.5" r="2.3" fill="#7C3AED" />
    </svg>
  );
}

/**
 * Calculadora interativa de rota e frete 99 Entregas exibida no Checkout (/loja/:slug/finalizar)
 */
export function StorefrontCheckoutRouteCalculator({
  storeName,
  originCity,
  originNeighborhood,
  freeShippingAbove,
  cartSubtotal,
  zipCode,
  loadingQuote,
  quote,
  selectedVehicle,
  onSelectVehicle,
}: {
  storeName: string;
  originCity?: string | null;
  originNeighborhood?: string | null;
  freeShippingAbove?: number | null;
  cartSubtotal: number;
  zipCode: string;
  loadingQuote: boolean;
  quote: PublicExpressQuoteResponse | null;
  selectedVehicle: "MOTO" | "CARRO";
  onSelectVehicle: (vehicle: "MOTO" | "CARRO") => void;
}) {
  const cleanZip = String(zipCode || "").replace(/\D/g, "");
  const hasCompleteZip = cleanZip.length === 8;

  const effectiveFreeAbove =
    quote?.freeShippingAbove ?? freeShippingAbove ?? null;
  const freeProgressPct =
    effectiveFreeAbove && effectiveFreeAbove > 0
      ? Math.min(100, Math.round((cartSubtotal / effectiveFreeAbove) * 100))
      : 0;
  const unlockedFree =
    effectiveFreeAbove !== null &&
    effectiveFreeAbove > 0 &&
    cartSubtotal >= effectiveFreeAbove;
  const remainingFree =
    effectiveFreeAbove && effectiveFreeAbove > cartSubtotal
      ? Math.max(0, effectiveFreeAbove - cartSubtotal)
      : 0;

  const originText =
    [originNeighborhood, originCity].filter(Boolean).join(" · ") || storeName;
  const destText =
    quote?.destination?.neighborhood || quote?.destination?.city
      ? [quote.destination.neighborhood, quote.destination.city]
          .filter(Boolean)
          .join(" · ")
      : hasCompleteZip
        ? `CEP ${cleanZip.slice(0, 5)}-${cleanZip.slice(5)}`
        : "Digite seu CEP";

  return (
    <div className="rounded-2xl border border-line bg-page p-4 sm:p-5 space-y-4">
      {/* Cabeçalho 99 Entregas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-on-brand font-extrabold text-xs tracking-tight shadow-xs">
            99
          </span>
          <div>
            <p className="text-sm font-bold text-ink flex items-center gap-1.5">
              Entrega Expressa 99
              <span className="inline-flex items-center rounded-full bg-support px-2 py-0.5 text-[11px] font-semibold text-brand">
                Ao vivo
              </span>
            </p>
            <p className="text-xs text-muted">
              Cálculo automático de rota e acompanhamento em tempo real
            </p>
          </div>
        </div>

        {quote?.available && quote.distanceKm !== null && (
          <div className="flex items-center gap-2 text-xs font-semibold text-ink bg-surface border border-line rounded-full px-3 py-1">
            <Navigation className="h-3.5 w-3.5 text-brand" />
            <span>
              ~{quote.distanceKm.toFixed(1).replace(".", ",")} km ·{" "}
              {quote.estimatedMinutes} min
            </span>
          </div>
        )}
      </div>

      {/* Barra de progresso de Frete Grátis */}
      {effectiveFreeAbove !== null && effectiveFreeAbove > 0 && (
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            {unlockedFree ? (
              <span className="font-bold text-brand flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Frete Grátis desbloqueado na modalidade 99Entrega Moto!
              </span>
            ) : (
              <span className="font-medium text-ink">
                Faltam{" "}
                <strong className="text-brand">
                  {formatBrl(remainingFree)}
                </strong>{" "}
                para <strong>Frete Grátis</strong> no 99Entrega Moto
              </span>
            )}
            <span className="font-semibold text-muted">{freeProgressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-support overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-brand"
              initial={{ width: 0 }}
              animate={{ width: `${freeProgressPct}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Radar / Mapa Vetorial de Rota */}
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface px-4 py-3.5">
        <div className="flex items-center justify-between gap-2 text-xs mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Store className="h-3.5 w-3.5 text-brand shrink-0" />
            <span className="font-semibold text-ink truncate">{originText}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 text-right">
            <span className="font-semibold text-ink truncate">{destText}</span>
            <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
          </div>
        </div>

        <div className="relative h-14 w-full flex items-center">
          <svg
            viewBox="0 0 360 48"
            className="w-full h-12 overflow-visible"
            fill="none"
            aria-hidden="true"
          >
            {/* Traçado base */}
            <path
              d="M 18 32 Q 110 8, 180 26 T 342 22"
              stroke="#E5E1ED"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Traçado ativo roxo */}
            {(loadingQuote || quote?.available) && (
              <motion.path
                d="M 18 32 Q 110 8, 180 26 T 342 22"
                stroke="#7C3AED"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8 6"
                initial={{ pathLength: 0.15, opacity: 0.5 }}
                animate={{
                  pathLength: loadingQuote ? [0.2, 0.85, 0.2] : 1,
                  opacity: 1,
                }}
                transition={{
                  duration: loadingQuote ? 1.4 : 0.65,
                  repeat: loadingQuote ? Infinity : 0,
                  ease: "easeInOut",
                }}
              />
            )}
            {/* Ponto de partida (Loja) */}
            <circle cx="18" cy="32" r="7" fill="#F3E8FF" />
            <circle cx="18" cy="32" r="4" fill="#7C3AED" />
            {/* Ponto de chegada (Cliente) */}
            <circle
              cx="342"
              cy="22"
              r="7"
              fill={quote?.available ? "#F3E8FF" : "#F8F7FC"}
            />
            <circle
              cx="342"
              cy="22"
              r="4"
              fill={quote?.available ? "#272321" : "#665F70"}
            />
          </svg>

          {/* Veículo deslizando na rota quando cotação está ativa */}
          {quote?.available && (
            <motion.div
              key={selectedVehicle}
              initial={{ left: "10%", opacity: 0, scale: 0.85 }}
              animate={{ left: "52%", opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
              className="absolute -top-1 -translate-x-1/2 pointer-events-none"
            >
              {selectedVehicle === "CARRO" ? (
                <VectorCarro99 size={42} moving />
              ) : (
                <VectorMoto99 size={40} moving />
              )}
            </motion.div>
          )}
        </div>

        {!hasCompleteZip && (
          <p className="text-xs text-muted text-center mt-1">
            Preencha os 8 dígitos do seu CEP acima para calcular a rota 99 na
            hora.
          </p>
        )}

        {loadingQuote && (
          <p className="text-xs font-semibold text-brand text-center mt-1 animate-pulse">
            Traçando melhor rota 99 Entregas para o seu CEP...
          </p>
        )}

        {!loadingQuote && quote && !quote.available && (
          <div className="mt-2 rounded-lg border border-brand bg-support px-3 py-2 text-xs text-ink font-medium">
            {quote.message ||
              "Não foi possível disponibilizar entrega expressa para este CEP."}
          </div>
        )}
      </div>

      {/* Seleção de Modalidade: 99Entrega Moto vs 99Entrega Carro */}
      {quote?.available && quote.options.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quote.options.map((opt) => {
            const isSelected = selectedVehicle === opt.vehicleType;
            return (
              <button
                key={opt.vehicleType}
                type="button"
                onClick={() => onSelectVehicle(opt.vehicleType)}
                className={`text-left rounded-xl border p-3.5 transition-all flex items-center gap-3 ${
                  isSelected
                    ? "border-brand bg-support shadow-xs ring-1 ring-brand"
                    : "border-line bg-surface hover:border-brand"
                }`}
              >
                <div className="shrink-0">
                  {opt.vehicleType === "CARRO" ? (
                    <VectorCarro99 size={46} moving={isSelected} />
                  ) : (
                    <VectorMoto99 size={44} moving={isSelected} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink truncate">
                      {opt.label}
                    </span>
                    <span className="text-sm font-extrabold text-brand shrink-0">
                      {opt.fee === 0 ? "Grátis" : formatBrl(opt.fee)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                    {opt.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-ink">
                    <Clock className="h-3 w-3 text-brand" />
                    <span>~{opt.estimatedMinutes} min</span>
                    {opt.freeShippingApplied && opt.originalFee > opt.fee && (
                      <span className="line-through text-muted">
                        {formatBrl(opt.originalFee)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Cena animada em tempo real de acompanhamento da entrega 99 na tela pública do pedido (/loja/:slug/pedido/:referencia)
 */
export function StorefrontOrderDeliveryScene({
  storeName,
  commercialStatus,
  fulfillmentStatus,
  deliveryFee,
  deliveryDestination,
  expressQuote,
  expressDispatch,
}: {
  storeName: string;
  commercialStatus: string;
  fulfillmentStatus: string;
  deliveryFee?: number;
  deliveryDestination?: {
    neighborhood: string | null;
    city: string | null;
    zipCode: string | null;
  } | null;
  expressQuote?: PublicOrderExpressQuote | null;
  expressDispatch?: PublicOrderExpressDispatch | null;
}) {
  const isTerminalCancelled = ["CANCELLED", "REJECTED", "EXPIRED"].includes(
    commercialStatus,
  );
  if (isTerminalCancelled) {
    return null;
  }

  const dispatchStatus = expressDispatch?.status || "WAITING";
  const vehicleType =
    expressDispatch?.vehicleType || expressQuote?.vehicleType || "MOTO";

  // Determinar estágio visual (0 a 4)
  let stageIndex = 0;
  if (
    fulfillmentStatus === "DELIVERED" ||
    dispatchStatus === "DELIVERED" ||
    (commercialStatus === "COMPLETED" && fulfillmentStatus === "DELIVERED")
  ) {
    stageIndex = 4;
  } else if (
    fulfillmentStatus === "OUT_FOR_DELIVERY" ||
    dispatchStatus === "DISPATCHED"
  ) {
    stageIndex = 3;
  } else if (dispatchStatus === "REQUESTED") {
    stageIndex = 2;
  } else if (
    commercialStatus === "CONFIRMED" ||
    commercialStatus === "COMPLETED" ||
    fulfillmentStatus === "PREPARING"
  ) {
    stageIndex = 1;
  }

  const stageMeta = [
    {
      badge: "Aguardando loja",
      title: "Pedido enviado · Aguardando confirmação da loja",
      subtitle:
        "Assim que o atendente confirmar, iniciamos a separação e acionamos a entrega 99.",
      vehiclePosPct: 12,
    },
    {
      badge: "Separando peças",
      title: "Separando e embalando seu pedido na loja",
      subtitle:
        "Suas peças já estão reservadas e sendo conferidas para chamar o entregador.",
      vehiclePosPct: 30,
    },
    {
      badge: "Chamando 99",
      title: `Localizando entregador ${
        vehicleType === "CARRO" ? "99Entrega Carro" : "99Entrega Moto"
      }...`,
      subtitle:
        "A loja já solicitou a corrida expressa e aguarda a chegada do motorista na porta.",
      vehiclePosPct: 48,
    },
    {
      badge: "Em rota de entrega",
      title: `${
        vehicleType === "CARRO" ? "99Entrega Carro" : "99Entrega Moto"
      } a caminho do seu endereço!`,
      subtitle:
        "Fique atento ao interfone ou telefone e tenha o código PIN de segurança em mãos.",
      vehiclePosPct: 74,
    },
    {
      badge: "Entrega concluída",
      title: "Pedido entregue com sucesso!",
      subtitle: `Obrigado por comprar na ${storeName}. Aproveite suas peças!`,
      vehiclePosPct: 90,
    },
  ][stageIndex];

  const steps = [
    { key: "prep", label: "Na Loja", active: stageIndex >= 1 },
    { key: "request", label: "Chamando 99", active: stageIndex >= 2 },
    { key: "route", label: "A Caminho", active: stageIndex >= 3 },
    { key: "done", label: "Entregue", active: stageIndex >= 4 },
  ];

  const pinDigits = expressDispatch?.confirmationPin
    ? String(expressDispatch.confirmationPin).trim().split("")
    : [];

  const destSummary = [
    deliveryDestination?.neighborhood,
    deliveryDestination?.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-xs">
      {/* Topo com status em tempo real */}
      <div className="p-5 sm:p-6 border-b border-line bg-page">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-support border border-brand px-3 py-1 text-xs font-bold text-brand">
            <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
            {stageMeta.badge}
          </span>

          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <Truck className="h-3.5 w-3.5 text-brand" />
            <span>
              {vehicleType === "CARRO" ? "99Entrega Carro" : "99Entrega Moto"}
              {expressQuote?.distanceKm
                ? ` · ~${expressQuote.distanceKm.toFixed(1).replace(".", ",")} km`
                : ""}
              {deliveryFee !== undefined
                ? ` · ${deliveryFee === 0 ? "Frete Grátis" : formatBrl(deliveryFee)}`
                : ""}
            </span>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-extrabold text-ink">
          {stageMeta.title}
        </h2>
        <p className="text-xs sm:text-sm text-muted mt-1">
          {stageMeta.subtitle}
        </p>
      </div>

      {/* Palco Vetorial Animado da Rua Loja -> Cliente */}
      <div className="relative bg-surface px-4 pt-8 pb-5 overflow-hidden">
        {/* Silhueta urbana minimalista ao fundo */}
        <svg
          viewBox="0 0 600 90"
          className="w-full h-20 opacity-70 pointer-events-none select-none"
          fill="none"
          aria-hidden="true"
        >
          <rect x="20" y="34" width="38" height="56" rx="4" fill="#F3E8FF" />
          <rect x="66" y="18" width="46" height="72" rx="4" fill="#F8F7FC" />
          <rect x="122" y="42" width="34" height="48" rx="4" fill="#F3E8FF" />
          <rect x="210" y="26" width="52" height="64" rx="4" fill="#F8F7FC" />
          <rect x="272" y="40" width="40" height="50" rx="4" fill="#F3E8FF" />
          <rect x="370" y="22" width="48" height="68" rx="4" fill="#F8F7FC" />
          <rect x="430" y="36" width="38" height="54" rx="4" fill="#F3E8FF" />
          <rect x="515" y="28" width="50" height="62" rx="4" fill="#F3E8FF" />
        </svg>

        {/* Pista e marcadores */}
        <div className="relative -mt-6">
          {/* Pista asfaltada */}
          <div className="relative h-4 w-full rounded-full bg-page border border-line overflow-hidden">
            {/* Progresso percorrido */}
            <motion.div
              className="h-full bg-brand"
              initial={{ width: "8%" }}
              animate={{ width: `${stageMeta.vehiclePosPct}%` }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            />
          </div>

          {/* Loja na esquerda */}
          <div className="absolute -top-9 left-1 flex flex-col items-center">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-on-brand shadow-xs">
              <Store className="h-4 w-4" />
              {stageIndex === 2 && (
                <motion.span
                  className="absolute inset-0 rounded-xl border-2 border-brand"
                  animate={{ scale: [1, 1.55], opacity: [0.85, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
              )}
            </div>
          </div>

          {/* Veículo 99 animado ao longo da pista */}
          <motion.div
            className="absolute -top-11 -translate-x-1/2 z-10"
            initial={{ left: "12%" }}
            animate={{
              left: `${stageMeta.vehiclePosPct}%`,
              y: stageIndex === 3 ? [0, -2.5, 0] : 0,
            }}
            transition={{
              left: { duration: 0.95, ease: "easeInOut" },
              y: {
                duration: 0.55,
                repeat: stageIndex === 3 ? Infinity : 0,
                ease: "easeInOut",
              },
            }}
          >
            {vehicleType === "CARRO" ? (
              <VectorCarro99 size={54} moving={stageIndex === 3} />
            ) : (
              <VectorMoto99 size={52} moving={stageIndex === 3} />
            )}
          </motion.div>

          {/* Casa/Destino na direita */}
          <div className="absolute -top-9 right-1 flex flex-col items-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-xs ${
                stageIndex === 4
                  ? "bg-brand border-brand text-on-brand"
                  : "bg-surface border-line text-ink"
              }`}
            >
              {stageIndex === 4 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4 text-brand" />
              )}
            </div>
          </div>

          {/* Rótulos de origem e destino */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted mt-2 px-1">
            <span className="truncate max-w-[45%]">
              {expressQuote?.originLabel || storeName}
            </span>
            <span className="truncate max-w-[45%] text-right">
              {destSummary || "Seu endereço"}
            </span>
          </div>
        </div>

        {/* Trilha de 4 etapas */}
        <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-line">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex flex-col items-center text-center">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold mb-1 ${
                  step.active
                    ? "bg-brand text-on-brand"
                    : "bg-page border border-line text-muted"
                }`}
              >
                {step.active ? "✓" : idx + 1}
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  step.active ? "text-ink" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Painel do Entregador + Código PIN de Segurança + Link de Rastreio 99 */}
      {(pinDigits.length > 0 ||
        expressDispatch?.courierName ||
        expressDispatch?.vehiclePlate ||
        expressDispatch?.trackingUrl) && (
        <div className="p-4 sm:p-5 border-t border-line bg-page flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            {(expressDispatch?.courierName || expressDispatch?.vehiclePlate) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Package className="h-4 w-4 text-brand shrink-0" />
                {expressDispatch.courierName && (
                  <span className="font-bold text-ink">
                    Entregador: {expressDispatch.courierName}
                  </span>
                )}
                {expressDispatch.vehiclePlate && (
                  <span className="rounded-md bg-surface border border-line px-2 py-0.5 font-mono font-bold text-ink">
                    {expressDispatch.vehiclePlate}
                  </span>
                )}
              </div>
            )}

            {pinDigits.length > 0 && stageIndex < 4 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  <span>PIN de recebimento:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {pinDigits.map((digit, idx) => (
                    <span
                      key={idx}
                      className="inline-flex h-8 w-7 items-center justify-center rounded-lg border border-brand bg-support font-mono text-sm font-extrabold text-brand"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-muted">
                  Informe ao motorista ao receber o pacote
                </span>
              </div>
            )}
          </div>

          {expressDispatch?.trackingUrl && (
            <a
              href={expressDispatch.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-on-brand px-4 py-2.5 text-xs font-bold transition-colors shrink-0"
            >
              Acompanhar corrida na 99
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
