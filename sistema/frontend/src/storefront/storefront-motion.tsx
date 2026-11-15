import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { getFullUrl } from '@/lib/getFullUrl';

export const SF_SPRING_PILL = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 38,
  mass: 0.72,
};

export const SF_SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 34,
  mass: 0.75,
};

export const SF_SPRING_DRAWER = {
  type: 'spring' as const,
  stiffness: 410,
  damping: 40,
  mass: 0.85,
};

export const SF_SPRING_SHEET = {
  type: 'spring' as const,
  stiffness: 390,
  damping: 38,
  mass: 0.88,
};

export const SF_EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SF_VIEW_TRANSITION = {
  duration: 0.2,
  ease: SF_EASE_OUT,
};

let activeScrollLocks = 0;
let savedOverflow = '';
let savedPaddingRight = '';

/**
 * Trava a rolagem do body em modais e gavetas compensando a largura da barra
 * de rolagem para evitar qualquer deslocamento horizontal ("carranco") no topo.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const body = document.body;
    const docEl = document.documentElement;

    if (activeScrollLocks === 0) {
      savedOverflow = body.style.overflow;
      savedPaddingRight = body.style.paddingRight;
      const scrollbarGap = Math.max(0, window.innerWidth - docEl.clientWidth);
      body.style.overflow = 'hidden';
      if (scrollbarGap > 0) {
        body.style.paddingRight = `${scrollbarGap}px`;
      }
    }
    activeScrollLocks += 1;

    return () => {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);
      if (activeScrollLocks === 0) {
        body.style.overflow = savedOverflow;
        body.style.paddingRight = savedPaddingRight;
      }
    };
  }, [locked]);
}

export function useIsMobileViewport(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

export interface FlyToBagToken {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  imageUrl?: string | null;
  title?: string;
}

export function resolveBagTargetCoords(): { x: number; y: number } | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;

  // Em celulares, prioriza a barra flutuante inferior se estiver visível, senão o botão do topo
  const mobileBar = document.querySelector<HTMLElement>(
    '[data-sf-mobile-bag-target="true"]',
  );
  if (mobileBar) {
    const r = mobileBar.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { x: r.left + 32, y: r.top + r.height / 2 };
    }
  }

  const headerBag = document.querySelector<HTMLElement>(
    '[data-sf-bag-target="true"]',
  );
  if (headerBag) {
    const r = headerBag.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  return null;
}

export function FlyToBagOverlay({
  tokens,
  onCompleteToken,
}: {
  tokens: FlyToBagToken[];
  onCompleteToken: (id: number) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!shouldReduceMotion || tokens.length === 0) return;
    for (const tk of tokens) {
      onCompleteToken(tk.id);
    }
  }, [shouldReduceMotion, tokens, onCompleteToken]);

  if (typeof document === 'undefined' || shouldReduceMotion) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[95] pointer-events-none overflow-hidden"
    >
      <AnimatePresence>
        {tokens.map((tk) => {
          const midY = Math.min(tk.startY, tk.targetY) - 44;
          return (
            <motion.div
              key={tk.id}
              initial={{
                x: tk.startX - 22,
                y: tk.startY - 22,
                scale: 0.92,
                opacity: 0.98,
              }}
              animate={{
                x: [tk.startX - 22, (tk.startX + tk.targetX) / 2 - 20, tk.targetX - 16],
                y: [tk.startY - 22, midY - 20, tk.targetY - 16],
                scale: [1, 0.88, 0.34],
                opacity: [1, 0.96, 0.18],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.48,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={() => onCompleteToken(tk.id)}
              className="fixed top-0 left-0 w-11 h-11 rounded-2xl bg-brand text-on-brand border-2 border-surface shadow-lg flex items-center justify-center overflow-hidden"
            >
              {tk.imageUrl ? (
                <img
                  src={getFullUrl(tk.imageUrl)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <ShoppingBag size={18} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
