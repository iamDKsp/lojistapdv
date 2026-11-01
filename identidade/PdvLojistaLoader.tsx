import React, { useEffect, useRef, useState } from 'react';

export type PdvLoaderMode = 'loader' | 'stencil' | 'transition' | 'full-logo';

export interface PdvLojistaLoaderProps {
  /**
   * Modo da animação aprovada da marca (idêntico ao preview pdv-lojista-motion.html):
   * - 'loader': 1. Loop Carregamento
   * - 'stencil': 2. Inversão Dinâmica
   * - 'transition': 3. Transição Tela Cheia
   * - 'full-logo': 4. Logo + Tipografia
   */
  mode?: PdvLoaderMode;
  /** Tamanho base do símbolo em pixels (padrão: 88) */
  size?: number;
  /** Multiplicador de velocidade da animação (padrão: 1.0) */
  speed?: number;
  /** Se verdadeiro, renderiza em camada de tela cheia */
  fullScreenOverlay?: boolean;
  /** Texto de apoio exibido junto ao loader */
  label?: string;
  /** Posição do texto de apoio */
  labelPosition?: 'bottom' | 'right';
  /** No modo 'transition', executa 1 ciclo completo e aciona onComplete */
  once?: boolean;
  /** Mantido por compatibilidade de tipagem (sempre anima em tempo real) */
  active?: boolean;
  /** Mantido por compatibilidade de tipagem (sempre usa o motor Canvas 60fps) */
  compact?: boolean;
  /** Callback acionado ao concluir a transição de tela */
  onComplete?: () => void;
  /** Classes CSS adicionais */
  className?: string;
}

const COLORS = {
  primary: '#7C3AED',
  white: '#FFFFFF',
  bg: '#F8F7FC',
  textLight: '#272321',
  textSecondary: '#665F70',
};

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const norm = (v: number, a: number, b: number) => clamp((v - a) / (b - a), 0, 1);
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number): number => x * x * x;
const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOutBack = (x: number, s = 1.45): number =>
  1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const easeInBack = (x: number, s = 1.3): number =>
  (s + 1) * x * x * x - s * x * x;

export const PdvLojistaLoader: React.FC<PdvLojistaLoaderProps> = React.memo(({
  mode = 'loader',
  size = 88,
  speed = 1.0,
  fullScreenOverlay = false,
  label,
  labelPosition = 'bottom',
  once,
  compact = false,
  onComplete,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1366,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    if (mode !== 'transition' || typeof window === 'undefined') return;
    const handleResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mode]);

  const isTransitionOnce = mode === 'transition' && (once ?? true);

  // Dimensões do palco idênticas em proporção ao preview do chat (sem cortar overshoot nem peças externas)
  const logicalWidth =
    mode === 'transition'
      ? viewportSize.w
      : mode === 'full-logo'
      ? Math.round(size * 3.45)
      : mode === 'stencil'
      ? Math.round(size * 2.5)
      : Math.round(size * 1.45);

  const logicalHeight =
    mode === 'transition'
      ? viewportSize.h
      : Math.round(size * 1.45);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Paths oficiais extraídos de simbolo.svg (idênticos ao pdv-lojista-motion.html)
    const PATH_L = new Path2D('M16 15H26V39H48V49H16Z');
    const PATH_STORE_WALL = new Path2D(
      'M3 12H21V23H3Z ' +
        'M6 23V16Q6 15 7 15H10Q11 15 11 16V23Z ' +
        'M14.7 15H17.3Q18 15 18 15.7V19.3Q18 20 17.3 20H14.7Q14 20 14 19.3V15.7Q14 15 14.7 15Z'
    );
    const AWNING = [
      new Path2D('M4 2H9L8 9C7.5 12 0 12 1 9Z'),
      new Path2D('M10 2H14L15 9C16 12 8 12 9 9Z'),
      new Path2D('M15 2H20L23 9C24 12 16.5 12 16 9Z'),
    ];

    const dpr = window.devicePixelRatio || 1;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    let rafId = 0;
    let progress = 0;
    let lastTime = performance.now();
    let unveiled = false;
    let completed = false;

    const emitUnveil = () => {
      if (!unveiled && mode === 'transition' && typeof window !== 'undefined') {
        unveiled = true;
        window.dispatchEvent(new CustomEvent(TRANSITION_UNVEIL_EVENT));
      }
    };

    function drawParts(
      fill: string,
      lS: { x: number; scaleX: number; scaleY: number; alpha: number },
      sS: { x: number; scaleX: number; scaleY: number; alpha: number; phase: number; amp: number }
    ) {
      if (!ctx) return;
      ctx.fillStyle = fill;
      if (lS.alpha > 0.001) {
        ctx.save();
        ctx.globalAlpha *= lS.alpha;
        ctx.translate(26 + lS.x, 32);
        ctx.scale(lS.scaleX, lS.scaleY);
        ctx.translate(-26, -32);
        ctx.fill(PATH_L);
        ctx.restore();
      }
      if (sS.alpha > 0.001) {
        ctx.save();
        ctx.globalAlpha *= sS.alpha;
        ctx.translate(30 + sS.x, 12);
        ctx.scale(0.96 * sS.scaleX, 0.96 * sS.scaleY);
        ctx.fill(PATH_STORE_WALL, 'evenodd');
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.translate(0, Math.sin(sS.phase - i * 0.65) * sS.amp);
          ctx.fill(AWNING[i]);
          ctx.restore();
        }
        ctx.restore();
      }
    }

    function tick(now: number) {
      if (!ctx) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const nextProgress = progress + (dt * speed) / 2.4;

      if (mode === 'transition' && nextProgress >= 0.78) {
        emitUnveil();
      }

      if (isTransitionOnce && nextProgress >= 1) {
        progress = 1;
        emitUnveil();
        if (!completed) {
          completed = true;
          onCompleteRef.current?.();
        }
        return;
      }

      progress = nextProgress % 1;
      const t = progress;

      const w = logicalWidth;
      const h = logicalHeight;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      let bgScale = 1;
      let bgAlpha = 1;
      let bgRadius = 16;
      const lS = { x: 0, scaleX: 1, scaleY: 1, alpha: 1 };
      const sS = { x: 0, scaleX: 1, scaleY: 1, alpha: 1, phase: 0, amp: 0 };
      let textP = 0;

      const isFull = mode === 'full-logo';
      const symSize = mode === 'transition' ? Math.max(size, 112) : size;
      const uScale = symSize / 64;
      const cx = isFull ? Math.round(symSize * 0.75) : w / 2;
      const cy = h / 2;
      // Garante cobertura 100% da tela em qualquer resolução (Full HD, 2K, 4K, Ultrawide) sem borda branca
      const fullScreenScale = Math.max(24, Math.ceil(Math.hypot(w, h) / (symSize * 0.85)) + 6);

      if (mode === 'transition') {
        if (t < 0.30) {
          bgScale = easeOutBack(norm(t, 0, 0.22), 1.4);
          const pL = norm(t, 0.05, 0.27);
          lS.x = (1 - easeOutBack(pL, 1.35)) * -58;
          lS.alpha = easeOutCubic(norm(t, 0.05, 0.14));
          const pS = norm(t, 0.09, 0.30);
          sS.x = (1 - easeOutBack(pS, 1.35)) * 58;
          sS.alpha = easeOutCubic(norm(t, 0.09, 0.18));
          sS.phase = pS * Math.PI * 3;
          sS.amp = (1 - pS) * 2.2;
        } else if (t < 0.55) {
          bgScale = 1 + Math.sin(norm(t, 0.30, 0.55) * Math.PI) * 0.04;
        } else if (t < 0.85) {
          const pE = norm(t, 0.55, 0.82);
          bgScale =
            pE < 0.2
              ? 1 - easeInOutCubic(pE / 0.2) * 0.1
              : 0.9 + Math.pow((pE - 0.2) / 0.8, 2.5) * fullScreenScale;
          bgRadius = 16 * (1 - clamp((pE - 0.2) / 0.55));
          const pF = norm(t, 0.65, 0.79);
          lS.alpha = 1 - easeInCubic(pF);
          sS.alpha = 1 - easeInCubic(pF);
          lS.x = -easeInCubic(pF) * 22;
          sS.x = easeInCubic(pF) * 22;
        } else {
          bgScale = fullScreenScale + 2;
          bgRadius = 0;
          bgAlpha = 1 - easeInOutCubic(norm(t, 0.85, 0.98));
          lS.alpha = 0;
          sS.alpha = 0;
        }
      } else {
        if (t < 0.32) {
          bgScale = easeOutBack(norm(t, 0.02, 0.24), 1.5);
          bgAlpha = easeOutCubic(norm(t, 0.01, 0.08));

          const pL = norm(t, 0.06, 0.28);
          lS.x = (1 - easeOutBack(pL, 1.4)) * -60;
          lS.scaleX = 1 + (1 - easeOutCubic(pL)) * 0.16;
          lS.scaleY = 1 - (1 - easeOutCubic(pL)) * 0.06;
          lS.alpha = easeOutCubic(norm(t, 0.06, 0.14));

          const pS = norm(t, 0.10, 0.32);
          sS.x = (1 - easeOutBack(pS, 1.4)) * 60;
          sS.scaleX = 1 + (1 - easeOutCubic(pS)) * 0.16;
          sS.scaleY = 1 - (1 - easeOutCubic(pS)) * 0.06;
          sS.alpha = easeOutCubic(norm(t, 0.10, 0.18));
          sS.phase = pS * Math.PI * 3.5;
          sS.amp = (1 - pS) * 2.5;
          textP = easeOutCubic(norm(t, 0.18, 0.32));
        } else if (t < 0.68) {
          const pH = norm(t, 0.32, 0.68);
          bgScale = 1 + Math.sin(pH * Math.PI * 2) * 0.028;
          sS.phase = pH * Math.PI * 4;
          sS.amp = Math.sin(pH * Math.PI) * 0.65;
          textP = 1;
        } else if (t < 0.94) {
          lS.x = easeInBack(norm(t, 0.68, 0.88), 1.3) * -60;
          lS.alpha = 1 - easeInCubic(norm(t, 0.78, 0.89));
          sS.x = easeInBack(norm(t, 0.70, 0.90), 1.3) * 60;
          sS.alpha = 1 - easeInCubic(norm(t, 0.80, 0.91));
          bgScale = Math.max(0, 1 - easeInBack(norm(t, 0.74, 0.94), 1.25));
          bgAlpha = 1 - easeInCubic(norm(t, 0.86, 0.94));
          textP = 1 - easeInCubic(norm(t, 0.68, 0.82));
        } else {
          bgScale = 0;
          bgAlpha = 0;
          lS.alpha = 0;
          sS.alpha = 0;
          textP = 0;
        }
      }

      if (mode === 'transition' && t >= 0.77 && bgAlpha > 0.001) {
        ctx.save();
        ctx.globalAlpha = bgAlpha;
        ctx.fillStyle = COLORS.primary;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(cx - symSize / 2, cy - symSize / 2);
      ctx.scale(uScale, uScale);

      if (mode === 'stencil') {
        drawParts(COLORS.primary, lS, sS);
      }

      if (bgScale > 0.001 && bgAlpha > 0.001) {
        ctx.save();
        ctx.globalAlpha = bgAlpha;
        ctx.translate(32, 32);
        ctx.scale(bgScale, bgScale);
        ctx.translate(-32, -32);

        ctx.beginPath();
        ctx.roundRect(0, 0, 64, 64, Math.min(bgRadius, 32));
        ctx.fillStyle = COLORS.primary;
        ctx.fill();
        ctx.clip();

        if (t > 0.30 && t < 0.68) {
          const sx = -40 + norm(t, 0.32, 0.62) * 140;
          const g = ctx.createLinearGradient(sx, 0, sx + 28, 64);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, 'rgba(255,255,255,0.13)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 64, 64);
        }

        ctx.translate(32, 32);
        ctx.scale(1 / bgScale, 1 / bgScale);
        ctx.translate(-32, -32);

        drawParts(COLORS.white, lS, sS);
        ctx.restore();
      }
      ctx.restore();

      if (isFull && textP > 0.01) {
        ctx.save();
        const tx = cx + symSize / 2 + symSize * 0.205;
        ctx.globalAlpha = textP;
        ctx.fillStyle = COLORS.textLight;

        const pdvPx = Math.max(10, Math.round(symSize * 0.193));
        ctx.font = `600 ${pdvPx}px "Segoe UI", Arial, sans-serif`;
        if ('letterSpacing' in ctx) {
          (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(symSize * 0.04).toFixed(1)}px`;
        }
        ctx.fillText('PDV', tx + (1 - textP) * 14, cy - symSize * 0.114);

        const lojistaPx = Math.max(18, Math.round(symSize * 0.5));
        ctx.font = `600 ${lojistaPx}px "Segoe UI", Arial, sans-serif`;
        if ('letterSpacing' in ctx) {
          (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(-symSize * 0.014).toFixed(1)}px`;
        }
        ctx.fillText('lojista', tx - symSize * 0.023 + (1 - textP) * 24, cy + symSize * 0.364);
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    let fallbackTimer: number | undefined;
    if (isTransitionOnce) {
      fallbackTimer = window.setTimeout(() => {
        emitUnveil();
        if (!completed) {
          completed = true;
          onCompleteRef.current?.();
        }
      }, 3000);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [mode, size, speed, logicalWidth, logicalHeight, isTransitionOnce]);

  if (mode === 'transition' && fullScreenOverlay) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label || 'Entrando na loja'}
        className={className}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: 'rgba(248, 247, 252, 0.92)',
          backdropFilter: 'blur(6px)',
          animation: 'pdvTransitionOverlayFade 2.4s ease forwards',
        }}
      >
        <style>{`
          @keyframes pdvTransitionOverlayFade {
            0%, 72% { background-color: rgba(248, 247, 252, 0.94); backdrop-filter: blur(6px); }
            84%, 100% { background-color: rgba(248, 247, 252, 0); backdrop-filter: blur(0px); }
          }
        `}</style>
        <canvas
          ref={canvasRef}
          style={{
            width: '100vw',
            height: '100vh',
            display: 'block',
          }}
        />
      </div>
    );
  }

  const content = (
    <div
      role={mode === 'full-logo' ? 'img' : 'status'}
      aria-live={mode === 'full-logo' ? undefined : 'polite'}
      aria-busy={mode !== 'full-logo' ? 'true' : undefined}
      aria-label={label || (mode === 'full-logo' ? 'PDV Lojista' : 'Carregando')}
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: labelPosition === 'right' ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: label ? (compact ? '6px' : '10px') : '0px',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${logicalWidth}px`,
          height: `${logicalHeight}px`,
          display: 'block',
        }}
      />
      {label && !compact && mode !== 'full-logo' && (
        <span
          style={{
            fontFamily: '"Segoe UI", Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            color: COLORS.textSecondary,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );

  if (!fullScreenOverlay) {
    return content;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(248, 247, 252, 0.88)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {content}
    </div>
  );
});

export const SESSION_TRANSITION_EVENT = 'pdv:session-entry-transition';
export const TRANSITION_UNVEIL_EVENT = 'pdv:transition-unveil';

export function triggerSessionEntryTransition() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_TRANSITION_EVENT));
  }
}

export default PdvLojistaLoader;
