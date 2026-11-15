import React, { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  ExternalLink,
  Navigation,
  Package,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type ExpressDispatchStatus =
  | "WAITING"
  | "FOUND"
  | "REQUESTED"
  | "PICKED_UP"
  | "DISPATCHED"
  | "DELIVERED";

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
  status: ExpressDispatchStatus;
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

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const norm = (v: number, a: number, b: number) =>
  clamp((v - a) / (b - a), 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOutBack = (x: number, overshoot = 1.45) => {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export interface DeliveryStageDescriptor {
  index: number;
  shortLabel: string;
  subLabel: string;
  badge: string;
  mobileBadge: string;
  title: string;
  desc: string;
  bubble: string;
  targetZoom: number;
  focusX: number;
  focusY: number;
  mobileFocusX: number;
  mobileFocusY: number;
  parallaxSpeed: number;
}

export function buildDeliveryStages(params: {
  storeName: string;
  orderRef?: string;
  courierName?: string | null;
  vehiclePlate?: string | null;
  distanceText?: string | null;
  pinCode?: string | null;
}): DeliveryStageDescriptor[] {
  const refLabel = params.orderRef ? `#${params.orderRef}` : "do pedido";
  const courierShort = params.courierName || "Entregador 99";
  const distInfo = params.distanceText || "Em rota expressa";
  const pinHint = params.pinCode
    ? `Informe o código ${params.pinCode} ao receber.`
    : "Acompanhe a chegada em tempo real.";

  return [
    {
      index: 0,
      shortLabel: "1. Encontrou",
      subLabel: "Aceitou pedido",
      badge: "ETAPA 1 • MOTORISTA ENCONTRADO",
      mobileBadge: "ETAPA 1 DE 5",
      title: "Sistema encontrou motorista",
      desc: `${courierShort} aceitou a solicitação da loja ${params.storeName} e está pronto para buscar o pacote ${refLabel}.`,
      bubble: `Chamado aceito! • ${courierShort}`,
      targetZoom: 1.16,
      focusX: 330,
      focusY: 236,
      mobileFocusX: 315,
      mobileFocusY: 228,
      parallaxSpeed: 0,
    },
    {
      index: 1,
      shortLabel: "2. Indo à loja",
      subLabel: "A caminho da loja",
      badge: "ETAPA 2 • A CAMINHO DA LOJA",
      mobileBadge: "ETAPA 2 DE 5",
      title: "Motorista vai até a loja",
      desc: `Entregador em deslocamento contínuo até ${params.storeName} enquanto o pacote ${refLabel} aguarda no balcão.`,
      bubble: "Indo buscar na loja PDV »",
      targetZoom: 1.4,
      focusX: 345,
      focusY: 248,
      mobileFocusX: 345,
      mobileFocusY: 242,
      parallaxSpeed: 1.0,
    },
    {
      index: 2,
      shortLabel: "3. Pegou pacote",
      subLabel: "Coleta na loja",
      badge: "ETAPA 3 • PACOTE COLETADO",
      mobileBadge: "ETAPA 3 DE 5",
      title: "Motorista pegou o pacote",
      desc: `Pacote ${refLabel} bipado na expedição de ${params.storeName} e acondicionado na bag térmica de entrega.`,
      bubble: `Pacote ${refLabel} na bag!`,
      targetZoom: 1.15,
      focusX: 365,
      focusY: 222,
      mobileFocusX: 365,
      mobileFocusY: 218,
      parallaxSpeed: 0,
    },
    {
      index: 3,
      shortLabel: "4. Chegando",
      subLabel: distInfo,
      badge: "ETAPA 4 • CHEGANDO AO CLIENTE",
      mobileBadge: "ETAPA 4 DE 5",
      title: "Motorista está chegando",
      desc: `O entregador já saiu da loja com seu pacote e está indo até você. ${pinHint}`,
      bubble: `Levando pacote ${refLabel} »`,
      targetZoom: 1.48,
      focusX: 345,
      focusY: 248,
      mobileFocusX: 345,
      mobileFocusY: 242,
      parallaxSpeed: 1.35,
    },
    {
      index: 4,
      shortLabel: "5. Entregue",
      subLabel: "Finalizado ✓",
      badge: "ETAPA 5 • ENTREGA CONCLUÍDA",
      mobileBadge: "ETAPA 5 DE 5",
      title: "Motorista entregou o pacote",
      desc: `Entrega finalizada com sucesso! Obrigado por comprar na ${params.storeName}.`,
      bubble: "Pacote entregue com sucesso ✓",
      targetZoom: 1.15,
      focusX: 375,
      focusY: 222,
      mobileFocusX: 372,
      mobileFocusY: 218,
      parallaxSpeed: 0,
    },
  ];
}

/**
 * Palco SVG 2D a 60 FPS com Câmera de Zoom Dinâmico + Parallax Infinito de 4 Camadas
 * Usado tanto na versão Desktop (760x332) quanto no recorte vertical Mobile (170 54 420 278).
 */
export function StorefrontDeliveryMotion2DCanvas({
  stageIndex,
  stages,
  storeName,
  orderRef,
  courierName,
  vehiclePlate,
  subStatusText,
  mobileViewport = false,
  hideHudOverlay = false,
  autoCycle = false,
  replaySignal = 0,
  onAutoAdvanceStage,
  onClickStageAdvance,
  className = "",
}: {
  stageIndex: number;
  stages: DeliveryStageDescriptor[];
  storeName: string;
  orderRef?: string;
  courierName?: string | null;
  vehiclePlate?: string | null;
  subStatusText?: string;
  mobileViewport?: boolean;
  hideHudOverlay?: boolean;
  autoCycle?: boolean;
  replaySignal?: number;
  onAutoAdvanceStage?: (nextStage: number) => void;
  onClickStageAdvance?: () => void;
  className?: string;
}) {
  const rawUid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    skyGrad: `pdvSkyGrad_${rawUid}`,
    beamGrad: `pdvBeamGrad_${rawUid}`,
    elevShadow: `pdvElevShadow_${rawUid}`,
    hudShadow: `pdvHudShadow_${rawUid}`,
    cloudTile: `pdvCloudTile_${rawUid}`,
    skylineTile: `pdvSkylineTile_${rawUid}`,
    midgroundTile: `pdvMidTile_${rawUid}`,
    roadTile: `pdvRoadTile_${rawUid}`,
  };

  const cameraRigRef = useRef<SVGGElement | null>(null);
  const parallaxCloudsRef = useRef<SVGGElement | null>(null);
  const parallaxSkylineRef = useRef<SVGGElement | null>(null);
  const parallaxMidgroundRef = useRef<SVGGElement | null>(null);
  const parallaxRoadRef = useRef<SVGGElement | null>(null);
  const startTotemGroupRef = useRef<SVGGElement | null>(null);
  const totemWave1Ref = useRef<SVGCircleElement | null>(null);
  const totemWave2Ref = useRef<SVGCircleElement | null>(null);
  const storeWorldGroupRef = useRef<SVGGElement | null>(null);
  const storeAwning0Ref = useRef<SVGPathElement | null>(null);
  const storeAwning1Ref = useRef<SVGPathElement | null>(null);
  const storeAwning2Ref = useRef<SVGPathElement | null>(null);
  const storeCounterPkgRef = useRef<SVGGElement | null>(null);
  const storeScannerLineRef = useRef<SVGLineElement | null>(null);
  const clientWorldGroupRef = useRef<SVGGElement | null>(null);
  const clientConfirmWaveRef = useRef<SVGCircleElement | null>(null);
  const clientDeliveredPkgRef = useRef<SVGGElement | null>(null);
  const clientCheckBadgeRef = useRef<SVGGElement | null>(null);
  const clientConfettiRef = useRef<SVGGElement | null>(null);
  const speedWindGroupRef = useRef<SVGGElement | null>(null);
  const windLine1Ref = useRef<SVGLineElement | null>(null);
  const windLine2Ref = useRef<SVGLineElement | null>(null);
  const puffCircle1Ref = useRef<SVGCircleElement | null>(null);
  const motoSuspensionRef = useRef<SVGGElement | null>(null);
  const headlightConeRef = useRef<SVGPolygonElement | null>(null);
  const wheelBackSpokesRef = useRef<SVGGElement | null>(null);
  const wheelFrontSpokesRef = useRef<SVGGElement | null>(null);
  const scarfWavePathRef = useRef<SVGPathElement | null>(null);
  const bagBodyRectRef = useRef<SVGRectElement | null>(null);
  const bagLogoLRef = useRef<SVGPathElement | null>(null);
  const bagActiveDotRef = useRef<SVGCircleElement | null>(null);
  const bagLidHingeRef = useRef<SVGGElement | null>(null);
  const parabolicPkgNodeRef = useRef<SVGGElement | null>(null);
  const heroSpeechBubbleRef = useRef<SVGGElement | null>(null);
  const heroBubbleBgRef = useRef<SVGRectElement | null>(null);
  const heroBubbleTextRef = useRef<SVGTextElement | null>(null);

  const animRef = useRef({
    stepIndex: stageIndex,
    stepElapsed: 0,
    lastTime: performance.now(),
    camZoom: stages[stageIndex]?.targetZoom ?? 1.16,
    camX: mobileViewport
      ? (stages[stageIndex]?.mobileFocusX ?? 330)
      : (stages[stageIndex]?.focusX ?? 330),
    camY: mobileViewport
      ? (stages[stageIndex]?.mobileFocusY ?? 230)
      : (stages[stageIndex]?.focusY ?? 236),
    currentSpeed: stages[stageIndex]?.parallaxSpeed ?? 0,
    wheelAngle: 0,
    scrollClouds: 0,
    scrollSkyline: 0,
    scrollMid: 0,
    scrollRoad: 0,
    totemX: 255,
    storeX: 920,
    clientX: 920,
  });

  const latestPropsRef = useRef({
    stageIndex,
    stages,
    mobileViewport,
    autoCycle,
    onAutoAdvanceStage,
  });
  latestPropsRef.current = {
    stageIndex,
    stages,
    mobileViewport,
    autoCycle,
    onAutoAdvanceStage,
  };

  // Sincroniza mudança de etapa ou sinal de replay
  useEffect(() => {
    const s = animRef.current;
    s.stepIndex = stageIndex;
    s.stepElapsed = 0;

    if (stageIndex === 0) {
      s.totemX = 255;
      s.storeX = 920;
      s.clientX = 920;
    } else if (stageIndex === 1) {
      s.storeX = 920;
      s.clientX = 920;
    } else if (stageIndex === 2) {
      s.storeX = mobileViewport ? 560 : 680;
      s.clientX = 920;
    } else if (stageIndex === 3) {
      s.clientX = 920;
    } else if (stageIndex === 4) {
      s.storeX = -500;
      s.clientX = mobileViewport ? 560 : 680;
    }
  }, [stageIndex, replaySignal, mobileViewport]);

  useEffect(() => {
    let rafId = 0;
    animRef.current.lastTime = performance.now();

    const tick = (now: number) => {
      const s = animRef.current;
      const {
        stages: curStages,
        mobileViewport: isMob,
        autoCycle: isAuto,
        onAutoAdvanceStage: advanceCb,
      } = latestPropsRef.current;

      const dt = Math.min(0.06, (now - s.lastTime) / 1000);
      s.lastTime = now;
      const nowSec = now / 1000;

      s.stepElapsed += dt;

      if (isAuto && s.stepElapsed >= 4.8 && advanceCb) {
        advanceCb((s.stepIndex + 1) % 5);
        s.stepElapsed = 0;
      }

      const idx = clamp(s.stepIndex, 0, 4);
      const t = s.stepElapsed;
      const stageCfg = curStages[idx] || curStages[0];

      // 1. Interpola Câmera (Zoom + Foco)
      const camSmooth = Math.min(1, dt * 4.2);
      const targetFocusX = isMob ? stageCfg.mobileFocusX : stageCfg.focusX;
      const targetFocusY = isMob ? stageCfg.mobileFocusY : stageCfg.focusY;
      s.camZoom = lerp(s.camZoom, stageCfg.targetZoom, camSmooth);
      s.camX = lerp(s.camX, targetFocusX, camSmooth);
      s.camY = lerp(s.camY, targetFocusY, camSmooth);

      const cx = 380 - s.camX * s.camZoom;
      const cy = 225 - s.camY * s.camZoom;
      cameraRigRef.current?.setAttribute(
        "transform",
        `translate(${cx.toFixed(2)},${cy.toFixed(2)}) scale(${s.camZoom.toFixed(3)})`,
      );

      // 2. Velocidade do Parallax Infinito
      let targetSpeed = stageCfg.parallaxSpeed;
      if (idx === 2 && t < 0.75) {
        targetSpeed = (1 - easeOutCubic(t / 0.75)) * 0.85;
      } else if (idx === 4 && t < 0.75) {
        targetSpeed = (1 - easeOutCubic(t / 0.75)) * 0.95;
      }
      s.currentSpeed = lerp(s.currentSpeed, targetSpeed, Math.min(1, dt * 5));

      // 3. Atualiza as 4 Camadas de Parallax (módulo 760px)
      s.scrollClouds =
        (s.scrollClouds + dt * (12 + s.currentSpeed * 28)) % 760;
      s.scrollSkyline = (s.scrollSkyline + dt * s.currentSpeed * 95) % 760;
      s.scrollMid = (s.scrollMid + dt * s.currentSpeed * 240) % 760;
      s.scrollRoad = (s.scrollRoad + dt * s.currentSpeed * 480) % 760;

      parallaxCloudsRef.current?.setAttribute(
        "transform",
        `translate(${(-s.scrollClouds).toFixed(1)}, 0)`,
      );
      parallaxSkylineRef.current?.setAttribute(
        "transform",
        `translate(${(-s.scrollSkyline).toFixed(1)}, 0)`,
      );
      parallaxMidgroundRef.current?.setAttribute(
        "transform",
        `translate(${(-s.scrollMid).toFixed(1)}, 0)`,
      );
      parallaxRoadRef.current?.setAttribute(
        "transform",
        `translate(${(-s.scrollRoad).toFixed(1)}, 0)`,
      );

      // 4. Prédios de Eventos (Totem, Loja PDV Lojista, Casa do Cliente)
      if (idx === 0) {
        s.totemX = lerp(s.totemX, 255, Math.min(1, dt * 6));
        const w1 = (nowSec * 1.4) % 1;
        const w2 = (nowSec * 1.4 + 0.5) % 1;
        totemWave1Ref.current?.setAttribute("r", (8 + w1 * 26).toFixed(1));
        totemWave1Ref.current?.setAttribute(
          "opacity",
          ((1 - w1) * 0.75).toFixed(2),
        );
        totemWave2Ref.current?.setAttribute("r", (8 + w2 * 26).toFixed(1));
        totemWave2Ref.current?.setAttribute(
          "opacity",
          ((1 - w2) * 0.75).toFixed(2),
        );
      } else {
        s.totemX -= dt * s.currentSpeed * 280;
        totemWave1Ref.current?.setAttribute("opacity", "0");
        totemWave2Ref.current?.setAttribute("opacity", "0");
      }
      startTotemGroupRef.current?.setAttribute(
        "transform",
        `translate(${s.totemX.toFixed(1)}, 166)`,
      );

      if (idx === 2) {
        const approachP = easeOutCubic(clamp(t / 0.75, 0, 1));
        s.storeX = lerp(isMob ? 560 : 640, 310, approachP);
      } else if (idx === 3) {
        s.storeX -= dt * s.currentSpeed * 280;
      } else {
        s.storeX = 920;
      }
      storeWorldGroupRef.current?.setAttribute(
        "transform",
        `translate(${s.storeX.toFixed(1)}, 128)`,
      );

      const awningAmp = idx === 2 ? 2.2 : 0.8;
      storeAwning0Ref.current?.setAttribute(
        "transform",
        `translate(0,${(Math.sin(nowSec * 6.5) * awningAmp).toFixed(2)})`,
      );
      storeAwning1Ref.current?.setAttribute(
        "transform",
        `translate(0,${(Math.sin(nowSec * 6.5 - 0.8) * awningAmp).toFixed(2)})`,
      );
      storeAwning2Ref.current?.setAttribute(
        "transform",
        `translate(0,${(Math.sin(nowSec * 6.5 - 1.6) * awningAmp).toFixed(2)})`,
      );

      if (idx === 4) {
        const approachC = easeOutCubic(clamp(t / 0.75, 0, 1));
        s.clientX = lerp(isMob ? 560 : 660, 368, approachC);
      } else {
        s.clientX = 920;
      }
      clientWorldGroupRef.current?.setAttribute(
        "transform",
        `translate(${s.clientX.toFixed(1)}, 138)`,
      );

      // 5. Física do Motoboy (Rodas, Suspensão, Empinada, Cachecol e Bag)
      s.wheelAngle = (s.wheelAngle + dt * (60 + s.currentSpeed * 680)) % 360;
      wheelBackSpokesRef.current?.setAttribute(
        "transform",
        `rotate(${s.wheelAngle.toFixed(0)})`,
      );
      wheelFrontSpokesRef.current?.setAttribute(
        "transform",
        `rotate(${s.wheelAngle.toFixed(0)})`,
      );

      const vibeFreq = s.currentSpeed > 0.2 ? 32 : 18;
      const vibeAmp = s.currentSpeed > 0.2 ? 1.5 : 0.7;
      let suspY = Math.sin(nowSec * vibeFreq) * vibeAmp;
      let tiltDeg = 0;
      let squashX = 1;
      let squashY = 1;
      let bagLidAngle = 0;
      let hasPackage = false;

      if (idx === 1 || idx === 3) {
        if (t < 0.65) {
          tiltDeg = -Math.sin((t / 0.65) * Math.PI) * 8.5;
        } else {
          tiltDeg = -1.8 + Math.sin(nowSec * 3.5) * 1.4;
        }
      }

      const localCycle3 = t % 3.6;
      if (idx === 2) {
        if (t < 0.75) {
          tiltDeg = Math.sin((t / 0.75) * Math.PI) * 5.5;
        }
        if (localCycle3 > 0.6 && localCycle3 < 1.8) {
          const openP =
            localCycle3 < 1.1
              ? easeOutBack(norm(localCycle3, 0.6, 1.0), 1.4)
              : 1 - easeInOutCubic(norm(localCycle3, 1.5, 1.8));
          bagLidAngle = -openP * 70;
        }
        hasPackage = localCycle3 > 1.45 || t > 1.8;

        if (localCycle3 > 1.42 && localCycle3 < 1.88) {
          const imp = Math.sin(norm(localCycle3, 1.42, 1.88) * Math.PI);
          suspY += imp * 5.5;
          squashX = 1 + imp * 0.08;
          squashY = 1 - imp * 0.08;
          tiltDeg = -imp * 4.2;
        }

        if (localCycle3 < 0.85) {
          storeCounterPkgRef.current?.setAttribute("opacity", "1");
          storeScannerLineRef.current?.setAttribute(
            "opacity",
            localCycle3 > 0.45 ? "1" : "0",
          );
        } else {
          storeCounterPkgRef.current?.setAttribute("opacity", "0");
        }

        if (localCycle3 >= 0.82 && localCycle3 <= 1.48) {
          const pj = norm(localCycle3, 0.82, 1.46);
          const fx = lerp(s.storeX + 106, 320, pj);
          const fy = lerp(212, 248, pj) - Math.sin(pj * Math.PI) * 58;
          parabolicPkgNodeRef.current?.setAttribute("opacity", "1");
          parabolicPkgNodeRef.current?.setAttribute(
            "transform",
            `translate(${fx.toFixed(1)},${fy.toFixed(1)})`,
          );
        } else {
          parabolicPkgNodeRef.current?.setAttribute("opacity", "0");
        }
      } else if (idx === 3) {
        hasPackage = true;
        parabolicPkgNodeRef.current?.setAttribute("opacity", "0");
      } else if (idx === 4) {
        if (t < 0.75) {
          tiltDeg = Math.sin((t / 0.75) * Math.PI) * 5.5;
        }
        if (t > 0.55 && t < 1.55) {
          const openP =
            t < 0.95
              ? easeOutBack(norm(t, 0.55, 0.9), 1.35)
              : 1 - easeInOutCubic(norm(t, 1.25, 1.55));
          bagLidAngle = -openP * 66;
        }
        hasPackage = t < 1.25;

        if (t >= 0.72 && t <= 1.32) {
          const pd = norm(t, 0.72, 1.3);
          const fx = lerp(320, s.clientX + 56, pd);
          const fy = lerp(248, 232, pd) - Math.sin(pd * Math.PI) * 54;
          parabolicPkgNodeRef.current?.setAttribute("opacity", "1");
          parabolicPkgNodeRef.current?.setAttribute(
            "transform",
            `translate(${fx.toFixed(1)},${fy.toFixed(1)})`,
          );
        } else {
          parabolicPkgNodeRef.current?.setAttribute("opacity", "0");
        }

        if (t > 1.3) {
          const popS = easeOutBack(norm(t, 1.3, 1.68), 1.55);
          const floatCheck = Math.sin(nowSec * 4) * 2.5;
          clientDeliveredPkgRef.current?.setAttribute("opacity", "1");
          clientDeliveredPkgRef.current?.setAttribute(
            "transform",
            `translate(56, 94) scale(${popS.toFixed(2)})`,
          );
          clientCheckBadgeRef.current?.setAttribute("opacity", "1");
          clientCheckBadgeRef.current?.setAttribute(
            "transform",
            `translate(62,${(18 + floatCheck).toFixed(1)}) scale(${popS.toFixed(2)})`,
          );

          const waveP = (nowSec * 1.2) % 1;
          clientConfirmWaveRef.current?.setAttribute(
            "r",
            (26 + waveP * 44).toFixed(1),
          );
          clientConfirmWaveRef.current?.setAttribute(
            "opacity",
            ((1 - waveP) * 0.35).toFixed(2),
          );

          const confCycle = ((t - 1.3) % 2.4) / 2.4;
          clientConfettiRef.current?.setAttribute(
            "opacity",
            (1 - confCycle).toFixed(2),
          );
          clientConfettiRef.current?.setAttribute(
            "transform",
            `translate(62,${(34 - confCycle * 26).toFixed(1)}) scale(${(0.85 + confCycle * 0.45).toFixed(2)})`,
          );
        } else {
          clientDeliveredPkgRef.current?.setAttribute("opacity", "0");
          clientCheckBadgeRef.current?.setAttribute("opacity", "0");
          clientConfirmWaveRef.current?.setAttribute("opacity", "0");
          clientConfettiRef.current?.setAttribute("opacity", "0");
        }
      } else {
        parabolicPkgNodeRef.current?.setAttribute("opacity", "0");
      }

      motoSuspensionRef.current?.setAttribute(
        "transform",
        `translate(0,${suspY.toFixed(2)}) rotate(${tiltDeg.toFixed(2)}) scale(${squashX.toFixed(2)},${squashY.toFixed(2)})`,
      );

      const isDriving = s.currentSpeed > 0.25;
      headlightConeRef.current?.setAttribute(
        "opacity",
        isDriving ? "1" : "0.35",
      );
      speedWindGroupRef.current?.setAttribute("opacity", isDriving ? "1" : "0");

      if (isDriving) {
        const wShift1 = ((nowSec * 9) % 1) * 28;
        const wShift2 = ((nowSec * 9 + 0.5) % 1) * 32;
        windLine1Ref.current?.setAttribute(
          "transform",
          `translate(${(-wShift1).toFixed(1)}, 0)`,
        );
        windLine2Ref.current?.setAttribute(
          "transform",
          `translate(${(-wShift2).toFixed(1)}, 0)`,
        );
        puffCircle1Ref.current?.setAttribute(
          "cx",
          (-40 - wShift1 * 0.8).toFixed(1),
        );
        puffCircle1Ref.current?.setAttribute(
          "opacity",
          (1 - wShift1 / 28).toFixed(2),
        );
      }

      const scarfWave =
        Math.sin(nowSec * (isDriving ? 24 : 8)) * (isDriving ? 4.5 : 1.2);
      scarfWavePathRef.current?.setAttribute(
        "d",
        `M -1 -29 Q -13 ${(-32 + scarfWave).toFixed(1)} -23 ${(-27 - scarfWave).toFixed(1)}`,
      );

      bagLidHingeRef.current?.setAttribute(
        "transform",
        `translate(-12, -11) rotate(${bagLidAngle.toFixed(1)})`,
      );
      bagBodyRectRef.current?.setAttribute(
        "fill",
        hasPackage ? "#7C3AED" : "#FFFFFF",
      );
      bagLogoLRef.current?.setAttribute(
        "fill",
        hasPackage ? "#FFFFFF" : "#7C3AED",
      );
      bagActiveDotRef.current?.setAttribute("opacity", hasPackage ? "1" : "0");

      if (!isMob && heroSpeechBubbleRef.current) {
        const isHighlighted = hasPackage || (idx === 4 && t > 1.3);
        heroSpeechBubbleRef.current.setAttribute(
          "transform",
          `translate(345,${(192 + suspY * 0.6).toFixed(1)})`,
        );
        heroBubbleBgRef.current?.setAttribute(
          "fill",
          isHighlighted ? "#7C3AED" : "#FFFFFF",
        );
        heroBubbleTextRef.current?.setAttribute(
          "fill",
          isHighlighted ? "#FFFFFF" : "#272321",
        );
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const currentStage = stages[stageIndex] || stages[0];
  const displayStoreName = (storeName || "PDV LOJISTA")
    .toUpperCase()
    .slice(0, 18);
  const displayPkgLabel = orderRef
    ? `RETIRADA #${orderRef}`
    : "COLETA EXPRESSA";
  const displayCourierLine =
    [courierName || "Entregador 99", vehiclePlate].filter(Boolean).join(" • ") ||
    "99Entrega Expressa";

  return (
    <svg
      viewBox={mobileViewport ? "170 54 420 278" : "0 0 760 332"}
      preserveAspectRatio="xMidYMid slice"
      onClick={onClickStageAdvance}
      className={`block w-full h-full select-none ${
        onClickStageAdvance ? "cursor-pointer" : ""
      } ${className}`}
      aria-label={currentStage.title}
    >
      <defs>
        <linearGradient id={ids.skyGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F8F7FC" />
          <stop offset="100%" stopColor="#F3E8FF" stopOpacity="0.65" />
        </linearGradient>
        <linearGradient id={ids.beamGrad} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
        <filter
          id={ids.elevShadow}
          x="-15%"
          y="-15%"
          width="130%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="5"
            floodColor="#7C3AED"
            floodOpacity="0.18"
          />
        </filter>
        <filter id={ids.hudShadow} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="#272321"
            floodOpacity="0.08"
          />
        </filter>

        {/* Tile 1: Nuvens (760px) */}
        <g id={ids.cloudTile}>
          <rect x="50" y="68" width="64" height="16" rx="8" fill="#FFFFFF" />
          <rect x="210" y="52" width="88" height="18" rx="9" fill="#FFFFFF" />
          <rect
            x="420"
            y="72"
            width="70"
            height="15"
            rx="7.5"
            fill="#FFFFFF"
          />
          <rect
            x="610"
            y="56"
            width="76"
            height="17"
            rx="8.5"
            fill="#FFFFFF"
          />
        </g>

        {/* Tile 2: Skyline Urbano (760px) */}
        <g id={ids.skylineTile}>
          <rect x="10" y="132" width="72" height="120" rx="6" fill="#F3E8FF" />
          <rect x="92" y="102" width="88" height="150" rx="6" fill="#E5E1ED" />
          <g fill="#FFFFFF" opacity="0.75">
            <rect x="106" y="116" width="14" height="12" rx="2" />
            <rect x="128" y="116" width="14" height="12" rx="2" />
            <rect x="150" y="116" width="14" height="12" rx="2" />
            <rect x="106" y="136" width="14" height="12" rx="2" />
            <rect x="128" y="136" width="14" height="12" rx="2" />
            <rect x="150" y="136" width="14" height="12" rx="2" />
          </g>
          <rect x="190" y="140" width="68" height="112" rx="6" fill="#F3E8FF" />
          <rect x="268" y="114" width="94" height="138" rx="6" fill="#E5E1ED" />
          <rect x="372" y="136" width="76" height="116" rx="6" fill="#F3E8FF" />
          <rect x="458" y="98" width="92" height="154" rx="6" fill="#E5E1ED" />
          <g fill="#FFFFFF" opacity="0.75">
            <rect x="474" y="114" width="16" height="12" rx="2" />
            <rect x="498" y="114" width="16" height="12" rx="2" />
            <rect x="474" y="134" width="16" height="12" rx="2" />
            <rect x="498" y="134" width="16" height="12" rx="2" />
          </g>
          <rect x="560" y="128" width="84" height="124" rx="6" fill="#F3E8FF" />
          <rect x="654" y="110" width="96" height="142" rx="6" fill="#E5E1ED" />
        </g>

        {/* Tile 3: Árvores e Postes da Calçada (760px) */}
        <g id={ids.midgroundTile}>
          <line
            x1="80"
            y1="154"
            x2="80"
            y2="246"
            stroke="#E5E1ED"
            strokeWidth="3.5"
          />
          <path
            d="M 80 154 Q 95 154 100 160"
            fill="none"
            stroke="#665F70"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="100" cy="162" r="4" fill="#7C3AED" opacity="0.55" />

          <rect x="168" y="218" width="5" height="28" fill="#665F70" />
          <circle
            cx="170.5"
            cy="204"
            r="18"
            fill="#F3E8FF"
            stroke="#E5E1ED"
            strokeWidth="1.8"
          />
          <circle
            cx="170.5"
            cy="186"
            r="13"
            fill="#FFFFFF"
            stroke="#E5E1ED"
            strokeWidth="1.8"
          />

          <rect
            x="260"
            y="234"
            width="32"
            height="6"
            rx="2"
            fill="#FFFFFF"
            stroke="#665F70"
            strokeWidth="1.5"
          />
          <line
            x1="266"
            y1="240"
            x2="266"
            y2="246"
            stroke="#665F70"
            strokeWidth="2"
          />
          <line
            x1="286"
            y1="240"
            x2="286"
            y2="246"
            stroke="#665F70"
            strokeWidth="2"
          />

          <line
            x1="360"
            y1="154"
            x2="360"
            y2="246"
            stroke="#E5E1ED"
            strokeWidth="3.5"
          />
          <path
            d="M 360 154 Q 375 154 380 160"
            fill="none"
            stroke="#665F70"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="380" cy="162" r="4" fill="#7C3AED" opacity="0.55" />

          <rect x="468" y="218" width="5" height="28" fill="#665F70" />
          <circle
            cx="470.5"
            cy="204"
            r="18"
            fill="#F3E8FF"
            stroke="#E5E1ED"
            strokeWidth="1.8"
          />
          <circle
            cx="470.5"
            cy="186"
            r="13"
            fill="#FFFFFF"
            stroke="#E5E1ED"
            strokeWidth="1.8"
          />

          <line
            x1="600"
            y1="154"
            x2="600"
            y2="246"
            stroke="#E5E1ED"
            strokeWidth="3.5"
          />
          <path
            d="M 600 154 Q 615 154 620 160"
            fill="none"
            stroke="#665F70"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="620" cy="162" r="4" fill="#7C3AED" opacity="0.55" />

          <rect x="698" y="218" width="5" height="28" fill="#665F70" />
          <circle
            cx="700.5"
            cy="204"
            r="16"
            fill="#F3E8FF"
            stroke="#E5E1ED"
            strokeWidth="1.8"
          />
          <circle
            cx="700.5"
            cy="188"
            r="11"
            fill="#FFFFFF"
            stroke="#E5E1ED"
            strokeWidth="1.8"
          />
        </g>

        {/* Tile 4: Pista e Faixas do Asfalto (760px) */}
        <g id={ids.roadTile}>
          <line
            x1="95"
            y1="246"
            x2="95"
            y2="258"
            stroke="#E5E1ED"
            strokeWidth="2"
          />
          <line
            x1="190"
            y1="246"
            x2="190"
            y2="258"
            stroke="#E5E1ED"
            strokeWidth="2"
          />
          <line
            x1="285"
            y1="246"
            x2="285"
            y2="258"
            stroke="#E5E1ED"
            strokeWidth="2"
          />
          <line
            x1="380"
            y1="246"
            x2="380"
            y2="258"
            stroke="#E5E1ED"
            strokeWidth="2"
          />
          <line
            x1="475"
            y1="246"
            x2="475"
            y2="258"
            stroke="#E5E1ED"
            strokeWidth="2"
          />
          <line
            x1="570"
            y1="246"
            x2="570"
            y2="258"
            stroke="#E5E1ED"
            strokeWidth="2"
          />
          <line
            x1="665"
            y1="246"
            x2="665"
            y2="258"
            stroke="#E5E1ED"
            strokeWidth="2"
          />
          <g fill="#FFFFFF">
            <rect x="10" y="284" width="42" height="5" rx="2.5" />
            <rect x="86" y="284" width="42" height="5" rx="2.5" />
            <rect x="162" y="284" width="42" height="5" rx="2.5" />
            <rect x="238" y="284" width="42" height="5" rx="2.5" />
            <rect x="314" y="284" width="42" height="5" rx="2.5" />
            <rect x="390" y="284" width="42" height="5" rx="2.5" />
            <rect x="466" y="284" width="42" height="5" rx="2.5" />
            <rect x="542" y="284" width="42" height="5" rx="2.5" />
            <rect x="618" y="284" width="42" height="5" rx="2.5" />
            <rect x="694" y="284" width="42" height="5" rx="2.5" />
          </g>
        </g>
      </defs>

      <rect x="0" y="0" width="760" height="340" fill={`url(#${ids.skyGrad})`} />

      {/* CAMERA RIG (Zoom Dinâmico + Parallax Infinito) */}
      <g ref={cameraRigRef}>
        <g ref={parallaxCloudsRef} opacity="0.85">
          <use href={`#${ids.cloudTile}`} x="-760" y="0" />
          <use href={`#${ids.cloudTile}`} x="0" y="0" />
          <use href={`#${ids.cloudTile}`} x="760" y="0" />
        </g>

        <g ref={parallaxSkylineRef}>
          <use href={`#${ids.skylineTile}`} x="-760" y="0" />
          <use href={`#${ids.skylineTile}`} x="0" y="0" />
          <use href={`#${ids.skylineTile}`} x="760" y="0" />
        </g>

        <g ref={parallaxMidgroundRef}>
          <use href={`#${ids.midgroundTile}`} x="-760" y="0" />
          <use href={`#${ids.midgroundTile}`} x="0" y="0" />
          <use href={`#${ids.midgroundTile}`} x="760" y="0" />
        </g>

        <rect
          x="-400"
          y="246"
          width="1600"
          height="12"
          fill="#FFFFFF"
          stroke="#E5E1ED"
          strokeWidth="1.5"
        />
        <rect x="-400" y="258" width="1600" height="90" fill="#F3E8FF" />
        <line
          x1="-400"
          y1="258"
          x2="1200"
          y2="258"
          stroke="#7C3AED"
          strokeWidth="3"
          opacity="0.35"
        />

        <g ref={parallaxRoadRef}>
          <use href={`#${ids.roadTile}`} x="-760" y="0" />
          <use href={`#${ids.roadTile}`} x="0" y="0" />
          <use href={`#${ids.roadTile}`} x="760" y="0" />
        </g>

        {/* Totem de Partida */}
        <g ref={startTotemGroupRef} transform="translate(275, 166)">
          <rect
            x="0"
            y="14"
            width="42"
            height="66"
            rx="8"
            fill="#FFFFFF"
            stroke="#7C3AED"
            strokeWidth="2"
            filter={`url(#${ids.elevShadow})`}
          />
          <rect x="6" y="21" width="30" height="20" rx="4" fill="#F3E8FF" />
          <circle cx="21" cy="31" r="5" fill="#7C3AED" />
          <rect x="8" y="48" width="26" height="4" rx="2" fill="#7C3AED" />
          <rect x="8" y="56" width="18" height="3.5" rx="1.5" fill="#E5E1ED" />
          <text
            x="21"
            y="74"
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="700"
            fill="#665F70"
          >
            PONTO
          </text>
          <g transform="translate(21, 8)">
            <circle
              ref={totemWave1Ref}
              r="10"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="2.2"
              opacity="0"
            />
            <circle
              ref={totemWave2Ref}
              r="22"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="1.8"
              opacity="0"
            />
          </g>
        </g>

        {/* Fachada Oficial da Loja PDV Lojista */}
        <g ref={storeWorldGroupRef} transform="translate(920, 128)">
          <rect
            x="0"
            y="12"
            width="162"
            height="106"
            rx="12"
            fill="#FFFFFF"
            stroke="#7C3AED"
            strokeWidth="2.5"
            filter={`url(#${ids.elevShadow})`}
          />
          <path
            d="M 0 24 Q 0 12 12 12 L 150 12 Q 162 12 162 24 L 162 46 L 0 46 Z"
            fill="#7C3AED"
          />

          <g transform="translate(12, 16) scale(0.40)">
            <rect x="0" y="0" width="64" height="64" rx="14" fill="#FFFFFF" />
            <path d="M16 15H26V39H48V49H16Z" fill="#7C3AED" />
            <g transform="translate(30, 12) scale(0.96)">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 12H21V23H3ZM6 23V16C6 15.4 6.4 15 7 15H10C10.6 15 11 15.4 11 16V23ZM14.7 15H17.3C17.7 15 18 15.3 18 15.7V19.3C18 19.7 17.7 20 17.3 20H14.7C14.3 20 14 19.7 14 19.3V15.7C14 15.3 14.3 15 14.7 15Z"
                fill="#7C3AED"
              />
              <path d="M4 2H9L8 9C7.5 12 0 12 1 9Z" fill="#7C3AED" />
              <path d="M10 2H14L15 9C16 12 8 12 9 9Z" fill="#7C3AED" />
              <path d="M15 2H20L23 9C24 12 16.5 12 16 9Z" fill="#7C3AED" />
            </g>
          </g>
          <text
            x="46"
            y="29"
            fontSize="11"
            fontWeight="700"
            fill="#FFFFFF"
            letterSpacing="0.4"
          >
            {displayStoreName}
          </text>
          <text x="46" y="40" fontSize="9.5" fontWeight="600" fill="#F3E8FF">
            COLETA EXPRESSA
          </text>

          <g transform="translate(8, 44)">
            <path
              ref={storeAwning0Ref}
              d="M 2 0 L 46 0 L 42 15 Q 22 20 0 15 Z"
              fill="#6D28D9"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <path
              ref={storeAwning1Ref}
              d="M 49 0 L 97 0 L 97 15 Q 73 20 49 15 Z"
              fill="#7C3AED"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <path
              ref={storeAwning2Ref}
              d="M 100 0 L 144 0 L 146 15 Q 124 20 100 15 Z"
              fill="#6D28D9"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          </g>

          <rect
            x="16"
            y="66"
            width="38"
            height="52"
            rx="5"
            fill="#F3E8FF"
            stroke="#7C3AED"
            strokeWidth="1.8"
          />
          <rect x="21" y="72" width="28" height="24" rx="3" fill="#FFFFFF" />
          <rect
            x="66"
            y="66"
            width="80"
            height="36"
            rx="6"
            fill="#F8F7FC"
            stroke="#E5E1ED"
            strokeWidth="1.8"
          />
          <rect x="62" y="98" width="88" height="7" rx="3" fill="#7C3AED" />
          <text
            x="106"
            y="113"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="#665F70"
          >
            {displayPkgLabel}
          </text>

          <g ref={storeCounterPkgRef} transform="translate(106, 84)">
            <rect
              x="-12"
              y="-12"
              width="24"
              height="24"
              rx="5"
              fill="#FFFFFF"
              stroke="#7C3AED"
              strokeWidth="2.2"
            />
            <rect x="-10" y="-2.5" width="20" height="5" fill="#F3E8FF" />
            <rect x="-3.5" y="-10" width="7" height="20" fill="#7C3AED" />
            <line
              ref={storeScannerLineRef}
              x1="-18"
              y1="0"
              x2="18"
              y2="0"
              stroke="#7C3AED"
              strokeWidth="2.5"
              opacity="0"
            />
          </g>
        </g>

        {/* Casa do Cliente */}
        <g ref={clientWorldGroupRef} transform="translate(920, 138)">
          <circle
            ref={clientConfirmWaveRef}
            cx="62"
            cy="54"
            r="32"
            fill="#7C3AED"
            opacity="0"
          />
          <path
            d="M 6 36 L 62 2 L 118 36 Z"
            fill="#7C3AED"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            filter={`url(#${ids.elevShadow})`}
          />
          <rect
            x="14"
            y="34"
            width="96"
            height="74"
            rx="8"
            fill="#FFFFFF"
            stroke="#7C3AED"
            strokeWidth="2.4"
            filter={`url(#${ids.elevShadow})`}
          />
          <rect
            x="24"
            y="44"
            width="38"
            height="16"
            rx="4"
            fill="#F3E8FF"
            stroke="#7C3AED"
            strokeWidth="1.2"
          />
          <text
            x="43"
            y="55"
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="#7C3AED"
          >
            DESTINO
          </text>
          <rect
            x="24"
            y="68"
            width="38"
            height="24"
            rx="4"
            fill="#F8F7FC"
            stroke="#E5E1ED"
            strokeWidth="1.6"
          />
          <rect
            x="72"
            y="54"
            width="26"
            height="54"
            rx="4"
            fill="#F3E8FF"
            stroke="#7C3AED"
            strokeWidth="1.8"
          />
          <circle cx="92" cy="82" r="2.2" fill="#7C3AED" />

          <g
            ref={clientDeliveredPkgRef}
            transform="translate(56, 94) scale(0)"
            opacity="0"
          >
            <rect
              x="-13"
              y="-13"
              width="26"
              height="26"
              rx="6"
              fill="#FFFFFF"
              stroke="#7C3AED"
              strokeWidth="2.4"
              filter={`url(#${ids.elevShadow})`}
            />
            <rect x="-11" y="-3" width="22" height="6" fill="#F3E8FF" />
            <rect x="-4" y="-11" width="8" height="22" fill="#7C3AED" />
          </g>

          <g
            ref={clientCheckBadgeRef}
            transform="translate(62, 18) scale(0)"
            opacity="0"
          >
            <circle
              r="19"
              fill="#7C3AED"
              stroke="#FFFFFF"
              strokeWidth="3"
              filter={`url(#${ids.elevShadow})`}
            />
            <path
              d="M -7.5 0.5 L -2 6.5 L 8.5 -5.5"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          <g
            ref={clientConfettiRef}
            transform="translate(62, 34)"
            opacity="0"
          >
            <rect
              x="-42"
              y="-22"
              width="7"
              height="7"
              rx="1.5"
              fill="#7C3AED"
              transform="rotate(20)"
            />
            <circle cx="-26" cy="-38" r="4.5" fill="#6D28D9" />
            <rect
              x="28"
              y="-30"
              width="7"
              height="7"
              rx="1.5"
              fill="#7C3AED"
              transform="rotate(-25)"
            />
            <circle
              cx="44"
              cy="-16"
              r="5"
              fill="#F3E8FF"
              stroke="#7C3AED"
              strokeWidth="1.5"
            />
            <rect
              x="-4"
              y="-46"
              width="6.5"
              height="6.5"
              rx="1"
              fill="#6D28D9"
              transform="rotate(45)"
            />
          </g>
        </g>

        {/* Motoboy Centralizado no Palco */}
        <g transform="translate(345, 272)">
          <ellipse
            cx="0"
            cy="15"
            rx="40"
            ry="6"
            fill="#272321"
            opacity="0.16"
          />

          <g ref={speedWindGroupRef} opacity="0">
            <line
              ref={windLine1Ref}
              x1="-78"
              y1="-22"
              x2="-42"
              y2="-22"
              stroke="#7C3AED"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.75"
            />
            <line
              ref={windLine2Ref}
              x1="-92"
              y1="-8"
              x2="-52"
              y2="-8"
              stroke="#6D28D9"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.55"
            />
            <line
              x1="-68"
              y1="-36"
              x2="-38"
              y2="-36"
              stroke="#7C3AED"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.45"
            />
            <circle
              ref={puffCircle1Ref}
              cx="-42"
              cy="4"
              r="5.5"
              fill="#FFFFFF"
              stroke="#E5E1ED"
              strokeWidth="1.5"
            />
            <circle
              cx="-58"
              cy="0"
              r="8"
              fill="#F3E8FF"
              stroke="#E5E1ED"
              strokeWidth="1.2"
            />
          </g>

          <g ref={motoSuspensionRef}>
            <polygon
              ref={headlightConeRef}
              points="28,-15 120,-34 120,10 28,-6"
              fill={`url(#${ids.beamGrad})`}
              opacity="0"
            />

            <g transform="translate(-24, 3)">
              <circle r="12.5" fill="#272321" />
              <circle r="7" fill="#FFFFFF" />
              <circle r="2.8" fill="#7C3AED" />
              <g ref={wheelBackSpokesRef}>
                <line
                  x1="-6.5"
                  y1="0"
                  x2="6.5"
                  y2="0"
                  stroke="#7C3AED"
                  strokeWidth="2"
                />
                <line
                  x1="0"
                  y1="-6.5"
                  x2="0"
                  y2="6.5"
                  stroke="#7C3AED"
                  strokeWidth="2"
                />
              </g>
            </g>

            <g transform="translate(26, 3)">
              <circle r="12.5" fill="#272321" />
              <circle r="7" fill="#FFFFFF" />
              <circle r="2.8" fill="#7C3AED" />
              <g ref={wheelFrontSpokesRef}>
                <line
                  x1="-6.5"
                  y1="0"
                  x2="6.5"
                  y2="0"
                  stroke="#7C3AED"
                  strokeWidth="2"
                />
                <line
                  x1="0"
                  y1="-6.5"
                  x2="0"
                  y2="6.5"
                  stroke="#7C3AED"
                  strokeWidth="2"
                />
              </g>
            </g>

            <path d="M -30 4 L -8 4 L -4 -3 L -28 0 Z" fill="#272321" />
            <rect
              x="-9"
              y="-8"
              width="15"
              height="11"
              rx="2.5"
              fill="#665F70"
              stroke="#FFFFFF"
              strokeWidth="1.2"
            />
            <line
              x1="15"
              y1="-20"
              x2="26"
              y2="3"
              stroke="#272321"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            <path
              d="M 16 -8 Q 27 -13 34 -5"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="3.8"
              strokeLinecap="round"
            />
            <path
              d="M -28 -4 L -13 -13 L 7 -13 L 18 -22 L 27 -18 L 20 -3 L -24 -1 Z"
              fill="#7C3AED"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M 2 -14 L 16 -20 L 20 -14 L 6 -9 Z" fill="#6D28D9" />
            <path
              d="M 25 -19 L 30 -16 L 27 -10 L 22 -13 Z"
              fill="#FFFFFF"
              stroke="#7C3AED"
              strokeWidth="1.6"
            />
            <rect
              x="15"
              y="-26"
              width="6"
              height="9"
              rx="1.5"
              fill="#FFFFFF"
              stroke="#7C3AED"
              strokeWidth="1.5"
            />
            <path
              d="M -15 -13 Q -4 -12 4 -14 L 2 -8 L -16 -8 Z"
              fill="#272321"
            />
            <path
              d="M -3 -10 L 4 -2 L 0 5"
              fill="none"
              stroke="#272321"
              strokeWidth="5.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M -4 -13 L 2 -30 L 16 -20"
              fill="none"
              stroke="#6D28D9"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="-2"
              y1="-19"
              x2="1"
              y2="-26"
              stroke="#F3E8FF"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            <path
              ref={scarfWavePathRef}
              d="M -1 -29 Q -14 -32 -22 -27"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            <g transform="translate(4, -37)">
              <circle r="10" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
              <path
                d="M 2 -4.2 L 10 -3.2 L 10 3.2 L 2 2.2 Z"
                fill="#FFFFFF"
              />
            </g>

            {/* Bag Térmica Traseira com Tampa Articulada */}
            <g transform="translate(-25, -24)">
              <rect
                ref={bagBodyRectRef}
                x="-12"
                y="-11"
                width="24"
                height="23"
                rx="4.5"
                fill="#FFFFFF"
                stroke="#7C3AED"
                strokeWidth="2.4"
              />
              <path
                ref={bagLogoLRef}
                d="M -4.5 -5.5 H 0 V 3.5 H 5.5 V 7 H -4.5 Z"
                fill="#7C3AED"
              />
              <circle
                ref={bagActiveDotRef}
                cx="7"
                cy="-6"
                r="3"
                fill="#FFFFFF"
                opacity="0"
              />
              <g ref={bagLidHingeRef} transform="translate(-12, -11) rotate(0)">
                <rect
                  x="0"
                  y="-4"
                  width="24"
                  height="5"
                  rx="2"
                  fill="#6D28D9"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                />
              </g>
            </g>
          </g>
        </g>

        {/* Pacote Saltando em Arco Parabólico */}
        <g ref={parabolicPkgNodeRef} transform="translate(345, 220)" opacity="0">
          <rect
            x="-14"
            y="-14"
            width="28"
            height="28"
            rx="6"
            fill="#FFFFFF"
            stroke="#7C3AED"
            strokeWidth="2.5"
            filter={`url(#${ids.elevShadow})`}
          />
          <rect x="-12" y="-3.5" width="24" height="7" fill="#F3E8FF" />
          <rect x="-4" y="-12" width="8" height="24" fill="#7C3AED" />
          <circle
            cx="10"
            cy="-10"
            r="7.5"
            fill="#7C3AED"
            stroke="#FFFFFF"
            strokeWidth="1.6"
          />
          <path
            d="M 7 -10 L 9.2 -7.5 L 13.5 -12"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Balão de Status ao Vivo (Apenas na versão Desktop Ampla) */}
        {!mobileViewport && (
          <g
            ref={heroSpeechBubbleRef}
            transform="translate(345, 192)"
            filter={`url(#${ids.hudShadow})`}
          >
            <rect
              ref={heroBubbleBgRef}
              x="-96"
              y="-14"
              width="192"
              height="26"
              rx="8"
              fill="#FFFFFF"
              stroke="#7C3AED"
              strokeWidth="1.8"
            />
            <polygon points="-5,12 0,18 5,12" fill="#7C3AED" />
            <text
              ref={heroBubbleTextRef}
              x="0"
              y="3"
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="700"
              fill="#272321"
            >
              {currentStage.bubble}
            </text>
          </g>
        )}
      </g>

      {/* HUD Superior Embutido no Palco Desktop */}
      {!mobileViewport && !hideHudOverlay && (
        <g>
          <g transform="translate(12, 10)" filter={`url(#${ids.hudShadow})`}>
            <rect
              x="0"
              y="0"
              width="284"
              height="40"
              rx="9"
              fill="#FFFFFF"
              fillOpacity="0.95"
              stroke="#E5E1ED"
              strokeWidth="1.2"
            />
            <rect x="6" y="6" width="4" height="28" rx="2" fill="#7C3AED" />
            <text
              x="17"
              y="16"
              fontSize="10"
              fontWeight="700"
              fill="#7C3AED"
              letterSpacing="0.4"
            >
              {currentStage.badge}
            </text>
            <text x="17" y="32" fontSize="12.5" fontWeight="700" fill="#272321">
              {currentStage.title}
            </text>
          </g>

          <g transform="translate(528, 10)" filter={`url(#${ids.hudShadow})`}>
            <rect
              x="0"
              y="0"
              width="220"
              height="40"
              rx="9"
              fill="#FFFFFF"
              fillOpacity="0.95"
              stroke="#E5E1ED"
              strokeWidth="1.2"
            />
            <circle
              cx="20"
              cy="20"
              r="12"
              fill="#F3E8FF"
              stroke="#7C3AED"
              strokeWidth="1.5"
            />
            <circle cx="20" cy="20" r="5.5" fill="#7C3AED" />
            <text x="38" y="17" fontSize="11.5" fontWeight="700" fill="#272321">
              {displayCourierLine.slice(0, 24)}
            </text>
            <text x="38" y="31" fontSize="11" fontWeight="600" fill="#7C3AED">
              {(subStatusText || currentStage.subLabel).slice(0, 26)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

/**
 * Calculadora interativa de rota e frete 99 Entregas exibida no Checkout (/loja/:slug/finalizar)
 * Integrada com a Cena 2D Parallax + Zoom da moto em rota.
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

  const destText =
    quote?.destination?.neighborhood || quote?.destination?.city
      ? [quote.destination.neighborhood, quote.destination.city]
          .filter(Boolean)
          .join(" · ")
      : hasCompleteZip
        ? `CEP ${cleanZip.slice(0, 5)}-${cleanZip.slice(5)}`
        : "Digite seu CEP";

  const distanceText =
    quote?.available && quote.distanceKm !== null
      ? `~${quote.distanceKm.toFixed(1).replace(".", ",")} km · ~${quote.estimatedMinutes} min`
      : destText;

  // Estágio automático da cena 2D conforme o preenchimento do CEP
  const computedStage = loadingQuote
    ? 1
    : quote?.available
      ? 3
      : 0;

  const [manualPreviewStage, setManualPreviewStage] = useState<number | null>(
    null,
  );

  useEffect(() => {
    setManualPreviewStage(null);
  }, [computedStage, selectedVehicle]);

  const activeStage = manualPreviewStage ?? computedStage;
  const stages = buildDeliveryStages({
    storeName,
    courierName:
      selectedVehicle === "CARRO" ? "99Entrega Carro" : "99Entrega Moto",
    distanceText,
  });

  return (
    <div className="rounded-2xl border border-line bg-page p-3.5 sm:p-4 space-y-3.5">
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

      {/* Palco 2D Parallax + Zoom no Checkout */}
      <div className="rounded-2xl border border-line bg-surface p-2.5 space-y-2 shadow-2xs">
        <div className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-line bg-page">
          <StorefrontDeliveryMotion2DCanvas
            stageIndex={activeStage}
            stages={stages}
            storeName={originNeighborhood || originCity || storeName}
            courierName={
              selectedVehicle === "CARRO" ? "99Entrega Carro" : "99Entrega Moto"
            }
            subStatusText={distanceText}
            onClickStageAdvance={() =>
              setManualPreviewStage(((activeStage + 1) % 5))
            }
          />
        </div>

        {/* Seletor rápido das 5 fases para o cliente ver como funciona */}
        <div className="grid grid-cols-5 gap-1.5">
          {stages.map((st) => {
            const isCurrent = st.index === activeStage;
            const isCompleted = st.index < activeStage;
            return (
              <button
                key={st.index}
                type="button"
                onClick={() => setManualPreviewStage(st.index)}
                className={`py-1.5 px-1 rounded-lg border text-center transition cursor-pointer ${
                  isCurrent
                    ? "bg-brand border-brand text-on-brand shadow-xs"
                    : isCompleted
                      ? "bg-support border-brand text-ink"
                      : "bg-page border-line text-muted hover:border-brand"
                }`}
              >
                <span className="block text-[11px] font-bold truncate">
                  {st.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {!hasCompleteZip && (
          <p className="text-xs text-muted text-center pt-0.5">
            Preencha os 8 dígitos do seu CEP acima para calcular a rota 99 na
            hora.
          </p>
        )}

        {loadingQuote && (
          <p className="text-xs font-semibold text-brand text-center pt-0.5 animate-pulse">
            Traçando melhor rota 99 Entregas para o seu CEP...
          </p>
        )}

        {!loadingQuote && quote && !quote.available && (
          <div className="rounded-lg border border-brand bg-support px-3 py-2 text-xs text-ink font-medium">
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
                className={`text-left rounded-xl border p-3.5 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? "border-brand bg-support shadow-xs ring-1 ring-brand"
                    : "border-line bg-surface hover:border-brand"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink truncate">
                      {opt.label}
                    </span>
                    <span className="text-sm font-extrabold text-brand shrink-0">
                      {opt.fee === 0 ? "Grátis" : formatBrl(opt.fee)}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-1 mt-0.5">
                    {opt.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-ink">
                    <Clock className="h-3.5 w-3.5 text-brand" />
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
 * Cena 2D Motion (Zoom + Parallax Infinito) de acompanhamento da entrega na tela pública do pedido
 * (/loja/:slug/pedido/:referencia) — Responsiva com Palco Amplo no Desktop e Bottom Sheet no Mobile.
 */
export function StorefrontOrderDeliveryScene({
  storeName,
  orderReference,
  commercialStatus,
  fulfillmentStatus,
  deliveryFee,
  deliveryDestination,
  expressQuote,
  expressDispatch,
}: {
  storeName: string;
  orderReference?: string;
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

  // Determinar estágio real do pedido (0 a 4)
  let liveStageIndex = 0;
  if (
    fulfillmentStatus === "DELIVERED" ||
    dispatchStatus === "DELIVERED" ||
    (commercialStatus === "COMPLETED" && fulfillmentStatus === "DELIVERED")
  ) {
    liveStageIndex = 4; // 5. Entregue
  } else if (
    fulfillmentStatus === "OUT_FOR_DELIVERY" ||
    dispatchStatus === "DISPATCHED"
  ) {
    liveStageIndex = 3; // 4. Chegando (Zoom + Parallax com pacote na bag)
  } else if (
    dispatchStatus === "PICKED_UP" ||
    fulfillmentStatus === "READY_FOR_PICKUP"
  ) {
    liveStageIndex = 2; // 3. Pegou pacote na loja
  } else if (
    dispatchStatus === "REQUESTED" ||
    fulfillmentStatus === "PREPARING" ||
    commercialStatus === "CONFIRMED" ||
    commercialStatus === "COMPLETED"
  ) {
    liveStageIndex = 1; // 2. Indo até a loja (Zoom + Parallax)
  } else {
    liveStageIndex = 0; // 1. Encontrou motorista / Aguardando
  }

  const [overrideStage, setOverrideStage] = useState<number | null>(null);
  const [autoCycle, setAutoCycle] = useState(false);
  const [replayCount, setReplayCount] = useState(0);

  // Quando o status real do pedido muda no servidor, sincroniza a visualização
  useEffect(() => {
    setOverrideStage(null);
    setAutoCycle(false);
  }, [liveStageIndex]);

  const activeStageIndex = overrideStage ?? liveStageIndex;

  const destSummary = [
    deliveryDestination?.neighborhood,
    deliveryDestination?.city,
  ]
    .filter(Boolean)
    .join(" · ");

  const distanceSummary = expressQuote?.distanceKm
    ? `~${expressQuote.distanceKm.toFixed(1).replace(".", ",")} km${
        expressQuote.estimatedMinutes
          ? ` · ~${expressQuote.estimatedMinutes} min`
          : ""
      }`
    : destSummary || "Entrega Expressa";

  const stages = buildDeliveryStages({
    storeName,
    orderRef: orderReference,
    courierName:
      expressDispatch?.courierName ||
      (vehicleType === "CARRO" ? "99Entrega Carro" : "99Entrega Moto"),
    vehiclePlate: expressDispatch?.vehiclePlate,
    distanceText: distanceSummary,
    pinCode: expressDispatch?.confirmationPin,
  });

  const currentStage = stages[activeStageIndex] || stages[0];
  const pinCode = expressDispatch?.confirmationPin
    ? String(expressDispatch.confirmationPin).trim()
    : null;
  const pinDigits = pinCode ? pinCode.split("") : [];

  const handleSelectStage = (idx: number) => {
    setAutoCycle(false);
    setOverrideStage(idx === liveStageIndex ? null : idx);
  };

  return (
    <div className="rounded-3xl border border-line bg-surface overflow-hidden shadow-xs">
      {/* ================= VERSÃO DESKTOP (sm:block) — PALCO AMPLO SEM TOPO + 5 BOTÕES ================= */}
      <div className="hidden sm:flex flex-col gap-2.5 p-3">
        <div className="relative w-full h-[332px] rounded-2xl overflow-hidden border border-line bg-page">
          <StorefrontDeliveryMotion2DCanvas
            stageIndex={activeStageIndex}
            stages={stages}
            storeName={storeName}
            orderRef={orderReference}
            courierName={
              expressDispatch?.courierName ||
              (vehicleType === "CARRO" ? "99Entrega Carro" : "99Entrega Moto")
            }
            vehiclePlate={expressDispatch?.vehiclePlate}
            subStatusText={
              deliveryFee !== undefined
                ? `${distanceSummary} · ${
                    deliveryFee === 0 ? "Frete Grátis" : formatBrl(deliveryFee)
                  }`
                : distanceSummary
            }
            autoCycle={autoCycle}
            replaySignal={replayCount}
            onAutoAdvanceStage={(nextIdx) => setOverrideStage(nextIdx)}
            onClickStageAdvance={() => {
              setAutoCycle(false);
              setOverrideStage((activeStageIndex + 1) % 5);
            }}
          />
        </div>

        {/* 5 Etapas Clicáveis */}
        <div className="grid grid-cols-5 gap-2">
          {stages.map((st) => {
            const isCurrent = st.index === activeStageIndex;
            const isCompleted = st.index < activeStageIndex;
            return (
              <button
                key={st.index}
                type="button"
                onClick={() => handleSelectStage(st.index)}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  isCurrent
                    ? "bg-brand border-brand text-on-brand shadow-xs -translate-y-0.5"
                    : isCompleted
                      ? "bg-support border-brand text-ink"
                      : "bg-page border-line text-muted hover:border-brand hover:bg-surface"
                }`}
              >
                <span className="text-xs font-extrabold">{st.shortLabel}</span>
                <span
                  className={`text-xs font-semibold truncate w-full ${
                    isCurrent ? "text-on-brand" : "text-muted"
                  }`}
                >
                  {st.subLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Rodapé de Status + Controles da Cena */}
        <div className="flex items-center justify-between gap-3 pt-1 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-brand shrink-0" />
            <span className="text-xs font-medium text-muted truncate">
              {currentStage.desc}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {overrideStage !== null && overrideStage !== liveStageIndex && (
              <button
                type="button"
                onClick={() => {
                  setAutoCycle(false);
                  setOverrideStage(null);
                }}
                className="px-2.5 py-1 rounded-lg border border-brand bg-support text-brand text-xs font-bold cursor-pointer"
              >
                Status real ({stages[liveStageIndex]?.shortLabel})
              </button>
            )}
            <button
              type="button"
              onClick={() => setAutoCycle((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                autoCycle
                  ? "bg-brand border-brand text-on-brand"
                  : "bg-surface border-line text-ink hover:border-brand"
              }`}
            >
              {autoCycle ? "Auto-Avançar: ON" : "Loop Contínuo"}
            </button>
            <button
              type="button"
              onClick={() => setReplayCount((c) => c + 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-line bg-surface text-ink hover:border-brand text-xs font-semibold cursor-pointer"
              title="Repetir animação desta etapa"
            >
              <RotateCcw className="h-3.5 w-3.5 text-brand" />
              <span>Repetir</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= VERSÃO MOBILE (sm:hidden) — PALCO VERTICAL + BOTTOM SHEET ================= */}
      <div className="sm:hidden flex flex-col">
        <div className="relative w-full h-64 bg-page overflow-hidden">
          {/* Pill Flutuante sobre o Céu no Mobile */}
          <div className="absolute top-3 left-3 right-3 z-10 rounded-xl border border-line bg-surface/95 px-3 py-2 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-on-brand text-xs font-extrabold shrink-0">
                L
              </span>
              <span className="text-xs font-extrabold text-ink truncate">
                {orderReference ? `Pedido #${orderReference}` : storeName}
              </span>
            </div>
            <span className="rounded-full bg-support px-2.5 py-0.5 text-xs font-bold text-brand shrink-0">
              {distanceSummary}
            </span>
          </div>

          <StorefrontDeliveryMotion2DCanvas
            stageIndex={activeStageIndex}
            stages={stages}
            storeName={storeName}
            orderRef={orderReference}
            courierName={expressDispatch?.courierName}
            vehiclePlate={expressDispatch?.vehiclePlate}
            mobileViewport
            autoCycle={autoCycle}
            replaySignal={replayCount}
            onAutoAdvanceStage={(nextIdx) => setOverrideStage(nextIdx)}
            onClickStageAdvance={() => {
              setAutoCycle(false);
              setOverrideStage((activeStageIndex + 1) % 5);
            }}
          />
        </div>

        {/* Bottom Sheet Arredondado sobrepondo a base do palco */}
        <div className="relative z-10 -mt-5 rounded-t-[24px] border-t border-line bg-surface px-4 pt-2.5 pb-4 space-y-3 shadow-xs">
          <div className="w-9 h-1 rounded-full bg-line mx-auto" />

          <div>
            <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-brand">
              <span>{currentStage.mobileBadge}</span>
              <span>{currentStage.subLabel}</span>
            </div>
            <h3 className="text-base font-extrabold text-ink mt-0.5">
              {currentStage.title}
            </h3>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              {currentStage.desc}
            </p>
          </div>

          {/* 5 Barras Segmentadas Clicáveis no Mobile */}
          <div className="grid grid-cols-5 gap-1.5 pt-0.5">
            {stages.map((st) => {
              const isCurrent = st.index === activeStageIndex;
              const isDone = st.index < activeStageIndex;
              return (
                <button
                  key={st.index}
                  type="button"
                  onClick={() => handleSelectStage(st.index)}
                  className="py-1 flex flex-col gap-1 text-left cursor-pointer"
                >
                  <div
                    className={`h-1.5 w-full rounded-full overflow-hidden ${
                      isDone
                        ? "bg-brand"
                        : isCurrent
                          ? "bg-brand animate-pulse"
                          : "bg-line"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold truncate ${
                      isCurrent || isDone ? "text-ink" : "text-muted"
                    }`}
                  >
                    {st.index + 1}. {st.shortLabel.split(". ")[1]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Card Mobile do Entregador + Código PIN */}
          <div className="rounded-xl border border-line bg-page p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-support border border-brand flex items-center justify-center shrink-0">
                <Navigation className="h-4 w-4 text-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-ink truncate">
                  {expressDispatch?.courierName ||
                    (vehicleType === "CARRO"
                      ? "99Entrega Carro"
                      : "99Entrega Moto")}
                </p>
                <p className="text-xs text-muted truncate">
                  {expressDispatch?.vehiclePlate
                    ? `Placa ${expressDispatch.vehiclePlate}`
                    : "Rastreio em tempo real"}
                </p>
              </div>
            </div>

            {pinCode && activeStageIndex < 4 && (
              <div className="rounded-lg bg-brand text-on-brand px-2.5 py-1.5 text-xs font-extrabold shrink-0">
                CÓD: {pinCode}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Painel Complementar Desktop: PIN de Segurança + Link Externo 99 */}
      {(pinDigits.length > 0 ||
        expressDispatch?.courierName ||
        expressDispatch?.vehiclePlate ||
        expressDispatch?.trackingUrl) && (
        <div className="px-4 py-3.5 border-t border-line bg-page flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            {(expressDispatch?.courierName || expressDispatch?.vehiclePlate) && (
              <div className="flex items-center gap-2 text-xs">
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

            {pinDigits.length > 0 && activeStageIndex < 4 && (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  <span>PIN de recebimento:</span>
                </div>
                <div className="flex items-center gap-1">
                  {pinDigits.map((digit, idx) => (
                    <span
                      key={idx}
                      className="inline-flex h-7 w-6 items-center justify-center rounded-lg border border-brand bg-support font-mono text-xs font-extrabold text-brand"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {expressDispatch?.trackingUrl && (
            <a
              href={expressDispatch.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-on-brand px-4 py-2 text-xs font-bold transition-colors shrink-0"
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
