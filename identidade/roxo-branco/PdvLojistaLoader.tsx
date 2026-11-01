'use client';

import React, { useEffect, useRef } from 'react';

export type PdvMotionMode = 'loader' | 'stencil' | 'transition' | 'full-logo';

export interface PdvLojistaLoaderProps {
  /** Tamanho do símbolo em pixels (padrão: 96) */
  size?: number;
  /** Modo da animação:
   * - 'loader': Fundo roxo escala, L entra pela esquerda, Loja pela direita, recolhe em loop
   * - 'stencil': L e Loja vêm visíveis em roxo de fora e invertem para branco ao entrar no fundo roxo
   * - 'transition': Transição de tela onde o fundo roxo expande cobrindo a área
   * - 'full-logo': Símbolo animado + reveal tipográfico "PDV lojista"
   */
  mode?: PdvMotionMode;
  /** Multiplicador de velocidade (padrão: 1.0 = ciclo de 2.4s) */
  speed?: number;
  /** Se verdadeiro, renderiza um overlay centralizado de tela cheia */
  fullScreenOverlay?: boolean;
  /** Texto opcional abaixo do loader */
  label?: string;
  className?: string;
}

const COLORS = {
  primary: '#7C3AED',
  white: '#FFFFFF',
  text: '#272321',
};

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const norm = (v: number, a: number, b: number) => clamp((v - a) / (b - a), 0, 1);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOutBack = (x: number, overshoot = 1.45) => {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeInBack = (x: number, overshoot = 1.3) => {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return c3 * x * x * x - c1 * x * x;
};

export const PdvLojistaLoader: React.FC<PdvLojistaLoaderProps> = ({
  size = 96,
  mode = 'loader',
  speed = 1.0,
  fullScreenOverlay = false,
  label,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Paths vetoriais exatos de simbolo.svg
    const pathL = new Path2D('M16 15H26V39H48V49H16Z');
    const pathStoreWall = new Path2D(
      'M3 12H21V23H3Z ' +
        'M6 23V16Q6 15 7 15H10Q11 15 11 16V23Z ' +
        'M14.7 15H17.3Q18 15 18 15.7V19.3Q18 20 17.3 20H14.7Q14 20 14 19.3V15.7Q14 15 14.7 15Z'
    );
    const awningPaths = [
      new Path2D('M4 2H9L8 9C7.5 12 0 12 1 9Z'),
      new Path2D('M10 2H14L15 9C16 12 8 12 9 9Z'),
      new Path2D('M15 2H20L23 9C24 12 16.5 12 16 9Z'),
    ];

    let animId: number;
    let progress = 0;
    let lastTime = performance.now();

    const canvasW = mode === 'full-logo' ? size * 3.2 : size * 1.6;
    const canvasH = size * 1.6;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;

    const drawElements = (
      fillStyle: string,
      lState: { x: number; scaleX: number; scaleY: number; alpha: number },
      sState: { x: number; scaleX: number; scaleY: number; alpha: number; awningPhase: number; awningAmp: number }
    ) => {
      ctx.fillStyle = fillStyle;

      if (lState.alpha > 0.001) {
        ctx.save();
        ctx.globalAlpha *= lState.alpha;
        ctx.translate(26 + lState.x, 32);
        ctx.scale(lState.scaleX, lState.scaleY);
        ctx.translate(-26, -32);
        ctx.fill(pathL);
        ctx.restore();
      }

      if (sState.alpha > 0.001) {
        ctx.save();
        ctx.globalAlpha *= sState.alpha;
        ctx.translate(30 + sState.x, 12);
        ctx.scale(0.96 * sState.scaleX, 0.96 * sState.scaleY);
        ctx.fill(pathStoreWall, 'evenodd');

        for (let i = 0; i < 3; i++) {
          ctx.save();
          const wave = Math.sin(sState.awningPhase - i * 0.65) * sState.awningAmp;
          ctx.translate(0, wave);
          ctx.fill(awningPaths[i]);
          ctx.restore();
        }
        ctx.restore();
      }
    };

    const render = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      progress = (progress + (dt * speed) / 2.4) % 1;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvasW, canvasH);

      let bgScale = 1;
      let bgAlpha = 1;
      let bgRadius = 16;
      const lState = { x: 0, scaleX: 1, scaleY: 1, alpha: 1 };
      const sState = { x: 0, scaleX: 1, scaleY: 1, alpha: 1, awningPhase: 0, awningAmp: 0 };
      let textP = 0;

      if (mode === 'transition') {
        if (progress < 0.3) {
          bgScale = easeOutBack(norm(progress, 0, 0.22), 1.4);
          const pL = norm(progress, 0.05, 0.27);
          lState.x = (1 - easeOutBack(pL, 1.35)) * -58;
          lState.alpha = easeOutCubic(norm(progress, 0.05, 0.14));
          const pS = norm(progress, 0.09, 0.3);
          sState.x = (1 - easeOutBack(pS, 1.35)) * 58;
          sState.alpha = easeOutCubic(norm(progress, 0.09, 0.18));
        } else if (progress < 0.56) {
          bgScale = 1 + Math.sin(norm(progress, 0.3, 0.56) * Math.PI) * 0.04;
        } else if (progress < 0.85) {
          const pExp = norm(progress, 0.56, 0.82);
          bgScale = pExp < 0.2 ? 1 - easeInOutCubic(pExp / 0.2) * 0.1 : 0.9 + Math.pow((pExp - 0.2) / 0.8, 2.5) * 14;
          bgRadius = 16 * (1 - clamp((pExp - 0.2) / 0.8));
          const pFade = norm(progress, 0.66, 0.8);
          lState.alpha = 1 - easeInCubic(pFade);
          sState.alpha = 1 - easeInCubic(pFade);
        } else {
          bgScale = 15;
          bgRadius = 0;
          bgAlpha = 1 - easeInOutCubic(norm(progress, 0.85, 0.98));
          lState.alpha = 0;
          sState.alpha = 0;
        }
      } else {
        if (progress < 0.32) {
          bgScale = easeOutBack(norm(progress, 0.02, 0.24), 1.5);
          bgAlpha = easeOutCubic(norm(progress, 0.01, 0.08));

          const pL = norm(progress, 0.06, 0.28);
          lState.x = (1 - easeOutBack(pL, 1.4)) * -60;
          lState.scaleX = 1 + (1 - easeOutCubic(pL)) * 0.16;
          lState.scaleY = 1 - (1 - easeOutCubic(pL)) * 0.06;
          lState.alpha = easeOutCubic(norm(progress, 0.06, 0.14));

          const pS = norm(progress, 0.1, 0.32);
          sState.x = (1 - easeOutBack(pS, 1.4)) * 60;
          sState.scaleX = 1 + (1 - easeOutCubic(pS)) * 0.16;
          sState.scaleY = 1 - (1 - easeOutCubic(pS)) * 0.06;
          sState.alpha = easeOutCubic(norm(progress, 0.1, 0.18));
          sState.awningPhase = pS * Math.PI * 3.5;
          sState.awningAmp = (1 - pS) * 2.5;
          textP = easeOutCubic(norm(progress, 0.18, 0.32));
        } else if (progress < 0.68) {
          const pHold = norm(progress, 0.32, 0.68);
          bgScale = 1 + Math.sin(pHold * Math.PI * 2) * 0.025;
          sState.awningPhase = pHold * Math.PI * 4;
          sState.awningAmp = Math.sin(pHold * Math.PI) * 0.65;
          textP = 1;
        } else if (progress < 0.94) {
          lState.x = easeInBack(norm(progress, 0.68, 0.88), 1.3) * -60;
          lState.alpha = 1 - easeInCubic(norm(progress, 0.78, 0.89));
          sState.x = easeInBack(norm(progress, 0.7, 0.9), 1.3) * 60;
          sState.alpha = 1 - easeInCubic(norm(progress, 0.8, 0.91));
          bgScale = Math.max(0, 1 - easeInBack(norm(progress, 0.74, 0.94), 1.25));
          bgAlpha = 1 - easeInCubic(norm(progress, 0.86, 0.94));
          textP = 1 - easeInCubic(norm(progress, 0.68, 0.82));
        } else {
          bgScale = 0;
          bgAlpha = 0;
          lState.alpha = 0;
          sState.alpha = 0;
          textP = 0;
        }
      }

      const unitScale = size / 64;
      const centerX = mode === 'full-logo' ? size * 0.8 : canvasW / 2;
      const centerY = canvasH / 2;

      ctx.save();
      ctx.translate(centerX - size / 2, centerY - size / 2);
      ctx.scale(unitScale, unitScale);

      if (mode === 'stencil') {
        drawElements(COLORS.primary, lState, sState);
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

        ctx.translate(32, 32);
        ctx.scale(1 / bgScale, 1 / bgScale);
        ctx.translate(-32, -32);

        drawElements(COLORS.white, lState, sState);
        ctx.restore();
      }

      ctx.restore();

      if (mode === 'full-logo' && textP > 0.01) {
        ctx.save();
        const textX = centerX + size / 2 + size * 0.22;
        ctx.globalAlpha = textP;
        ctx.fillStyle = COLORS.text;
        ctx.font = `600 ${Math.round(size * 0.2)}px "Segoe UI", Arial, sans-serif`;
        ctx.fillText('PDV', textX + (1 - textP) * 14, centerY - size * 0.12);
        ctx.font = `600 ${Math.round(size * 0.5)}px "Segoe UI", Arial, sans-serif`;
        ctx.fillText('lojista', textX - 2 + (1 - textP) * 22, centerY + size * 0.36);
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [size, mode, speed]);

  const content = (
    <div className={`inline-flex flex-col items-center justify-center gap-2 ${className}`}>
      <canvas
        ref={canvasRef}
        style={{
          width: mode === 'full-logo' ? size * 3.2 : size * 1.6,
          height: size * 1.6,
        }}
      />
      {label && (
        <span className="text-sm font-medium text-[#665F70] tracking-wide animate-pulse">
          {label}
        </span>
      )}
    </div>
  );

  if (fullScreenOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F8F7FC]/90 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

export default PdvLojistaLoader;
