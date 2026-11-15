import React, { createContext, useContext, useEffect, useState } from 'react';
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

/**
 * Permite que a prévia interativa em iframe forneça seu próprio `contentWindow`
 * para que breakpoints (`matchMedia`), portais de modais/gavetas e travas de
 * rolagem respeitem o viewport real da prévia sem afetar o painel administrativo.
 */
export const StorefrontWindowContext = createContext<Window | null>(null);

export function useStorefrontWindow(): Window | null {
  const ctxWin = useContext(StorefrontWindowContext);
  if (ctxWin) return ctxWin;
  return typeof window !== 'undefined' ? window : null;
}

const scrollLockRegistry = new WeakMap<
  Document,
  { count: number; overflow: string; paddingRight: string }
>();

/**
 * Trava a rolagem do body em modais e gavetas compensando a largura da barra
 * de rolagem para evitar qualquer deslocamento horizontal ("carranco") no topo.
 */
export function useBodyScrollLock(locked: boolean): void {
  const win = useStorefrontWindow();

  useEffect(() => {
    const doc = win?.document;
    if (!locked || !win || !doc?.body || !doc?.documentElement) {
      return;
    }

    const body = doc.body;
    const docEl = doc.documentElement;
    let entry = scrollLockRegistry.get(doc);

    if (!entry || entry.count === 0) {
      entry = {
        count: 0,
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
      };
      const scrollbarGap = Math.max(0, win.innerWidth - docEl.clientWidth);
      body.style.overflow = 'hidden';
      if (scrollbarGap > 0) {
        body.style.paddingRight = `${scrollbarGap}px`;
      }
      scrollLockRegistry.set(doc, entry);
    }

    entry.count += 1;

    return () => {
      const current = scrollLockRegistry.get(doc);
      if (!current) return;
      current.count = Math.max(0, current.count - 1);
      if (current.count === 0) {
        body.style.overflow = current.overflow;
        body.style.paddingRight = current.paddingRight;
      }
    };
  }, [locked, win]);
}

export function useIsMobileViewport(breakpoint = 640): boolean {
  const win = useStorefrontWindow();
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (!win) return false;
    return win.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (!win || !win.matchMedia) return;
    const mql = win.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    win.addEventListener('resize', update);
    return () => {
      mql.removeEventListener('change', update);
      win.removeEventListener('resize', update);
    };
  }, [breakpoint, win]);

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

export function resolveBagTargetCoords(targetDoc?: Document | null): {
  x: number;
  y: number;
} | null {
  const doc =
    targetDoc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const mobileBar = doc.querySelector<HTMLElement>(
    '[data-sf-mobile-bag-target="true"]',
  );
  if (mobileBar) {
    const r = mobileBar.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { x: r.left + 32, y: r.top + r.height / 2 };
    }
  }

  const headerBag = doc.querySelector<HTMLElement>(
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
  const win = useStorefrontWindow();
  const portalBody =
    win?.document?.body ||
    (typeof document !== 'undefined' ? document.body : null);

  useEffect(() => {
    if (!shouldReduceMotion || tokens.length === 0) return;
    for (const tk of tokens) {
      onCompleteToken(tk.id);
    }
  }, [shouldReduceMotion, tokens, onCompleteToken]);

  if (!portalBody || shouldReduceMotion) return null;

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
                x: [
                  tk.startX - 22,
                  (tk.startX + tk.targetX) / 2 - 20,
                  tk.targetX - 16,
                ],
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
              className="fixed top-0 left-0 w-11 h-11 rounded-2xl bg-brand text-on-brand border-2 border-surface shadow-lg flex items-center justify-center overflow-hidden p-1"
            >
              {tk.imageUrl ? (
                <img
                  src={getFullUrl(tk.imageUrl)}
                  alt=""
                  className="w-full h-full object-contain"
                />
              ) : (
                <ShoppingBag size={18} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    portalBody,
  );
}
