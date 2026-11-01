import React, {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
  cloneElement,
  isValidElement,
} from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delayMs?: number;
  disabled?: boolean;
}

interface Position {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

function computeTooltipPosition(
  triggerRect: DOMRect,
  tooltipRect: { width: number; height: number },
  preferredSide: 'top' | 'bottom' | 'left' | 'right' = 'top'
): Position {
  const gap = 8;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let placement = preferredSide;

  if (placement === 'top' && triggerRect.top - tooltipRect.height - gap < pad) {
    placement = 'bottom';
  } else if (placement === 'bottom' && triggerRect.bottom + tooltipRect.height + gap > vh - pad) {
    placement = 'top';
  } else if (placement === 'left' && triggerRect.left - tooltipRect.width - gap < pad) {
    placement = 'right';
  } else if (placement === 'right' && triggerRect.right + tooltipRect.width + gap > vw - pad) {
    placement = 'left';
  }

  let top = 0;
  let left = 0;

  if (placement === 'top') {
    top = triggerRect.top - tooltipRect.height - gap;
    left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  } else if (placement === 'bottom') {
    top = triggerRect.bottom + gap;
    left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  } else if (placement === 'left') {
    top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
    left = triggerRect.left - tooltipRect.width - gap;
  } else {
    top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
    left = triggerRect.right + gap;
  }

  left = Math.max(pad, Math.min(vw - tooltipRect.width - pad, left));
  top = Math.max(pad, Math.min(vh - tooltipRect.height - pad, top));

  return { top, left, placement };
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  delayMs = 150,
  disabled = false,
}) => {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>({ top: -9999, left: -9999, placement: side });
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const touchDismissRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (touchDismissRef.current !== null) {
      window.clearTimeout(touchDismissRef.current);
      touchDismissRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const bubbleEl = bubbleRef.current;
    if (!triggerEl || !bubbleEl) return;
    const triggerRect = triggerEl.getBoundingClientRect();
    const bubbleRect = bubbleEl.getBoundingClientRect();
    setPos(
      computeTooltipPosition(
        triggerRect,
        { width: bubbleRect.width || 160, height: bubbleRect.height || 32 },
        side
      )
    );
  }, [side]);

  const show = useCallback(() => {
    if (disabled || !content) return;
    clearTimers();
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, delayMs);
  }, [disabled, content, delayMs, clearTimers]);

  const hide = useCallback(() => {
    clearTimers();
    setOpen(false);
  }, [clearTimers]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    const onScrollOrResize = () => updatePosition();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, updatePosition, hide]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!isValidElement(children) || !content || disabled) {
    return children;
  }

  const childProps = children.props as Record<string, any>;

  const mergedChild = cloneElement(children as React.ReactElement<any>, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const existingRef = (children as any).ref;
      if (typeof existingRef === 'function') existingRef(node);
      else if (existingRef && typeof existingRef === 'object') existingRef.current = node;
    },
    'aria-describedby': open ? tooltipId : childProps['aria-describedby'],
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      childProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      childProps.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      childProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      childProps.onBlur?.(e);
    },
    onTouchStart: (e: React.TouchEvent) => {
      if (!open) {
        clearTimers();
        setOpen(true);
        touchDismissRef.current = window.setTimeout(() => setOpen(false), 2200);
      }
      childProps.onTouchStart?.(e);
    },
  });

  return (
    <>
      {mergedChild}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={bubbleRef}
            id={tooltipId}
            role="tooltip"
            className="pdv-tooltip"
            data-placement={pos.placement}
            style={{
              top: `${pos.top}px`,
              left: `${pos.left}px`,
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

/**
 * Camada global que substitui automaticamente atributos `data-tooltip` ou eventuais `title`
 * remanescentes na árvore DOM por um tooltip acessível e padronizado do sistema.
 */
export const GlobalTooltipLayer: React.FC = () => {
  const tooltipId = useId();
  const [activeTarget, setActiveTarget] = useState<HTMLElement | null>(null);
  const [text, setText] = useState<string>('');
  const [pos, setPos] = useState<Position>({ top: -9999, left: -9999, placement: 'top' });
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const extractTooltipElement = (node: EventTarget | null): { el: HTMLElement; label: string } | null => {
      if (!(node instanceof HTMLElement)) return null;
      const el = node.closest<HTMLElement>('[data-tooltip], [title]');
      if (!el) return null;
      if (el.tagName === 'IFRAME' || el.tagName === 'SVG' || el.tagName === 'TITLE') return null;

      const rawTitle = el.getAttribute('title');
      if (rawTitle !== null) {
        if (rawTitle.trim()) {
          el.setAttribute('data-tooltip', rawTitle.trim());
        }
        el.removeAttribute('title');
      }

      const label = el.getAttribute('data-tooltip')?.trim();
      if (!label) return null;
      return { el, label };
    };

    const handlePointerOver = (e: MouseEvent) => {
      const found = extractTooltipElement(e.target);
      if (!found) {
        clearTimer();
        setActiveTarget(null);
        return;
      }
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setActiveTarget(found.el);
        setText(found.label);
      }, 150);
    };

    const handlePointerOut = (e: MouseEvent) => {
      if (!activeTarget) {
        clearTimer();
        return;
      }
      const related = e.relatedTarget as Node | null;
      if (related && activeTarget.contains(related)) return;
      clearTimer();
      setActiveTarget(null);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const found = extractTooltipElement(e.target);
      if (!found) return;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setActiveTarget(found.el);
        setText(found.label);
      }, 120);
    };

    const handleFocusOut = () => {
      clearTimer();
      setActiveTarget(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimer();
        setActiveTarget(null);
      }
    };

    document.addEventListener('mouseover', handlePointerOver, true);
    document.addEventListener('mouseout', handlePointerOut, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimer();
      document.removeEventListener('mouseover', handlePointerOver, true);
      document.removeEventListener('mouseout', handlePointerOut, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTarget]);

  useEffect(() => {
    if (!activeTarget || !text) return;

    const prevDescribedBy = activeTarget.getAttribute('aria-describedby');
    activeTarget.setAttribute('aria-describedby', tooltipId);

    const update = () => {
      if (!activeTarget.isConnected) {
        setActiveTarget(null);
        return;
      }
      const rect = activeTarget.getBoundingClientRect();
      const bubble = bubbleRef.current?.getBoundingClientRect();
      const preferred =
        (activeTarget.getAttribute('data-tooltip-side') as 'top' | 'bottom' | 'left' | 'right') ||
        'top';
      setPos(
        computeTooltipPosition(
          rect,
          { width: bubble?.width || 160, height: bubble?.height || 32 },
          preferred
        )
      );
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      if (activeTarget.isConnected) {
        if (prevDescribedBy) activeTarget.setAttribute('aria-describedby', prevDescribedBy);
        else activeTarget.removeAttribute('aria-describedby');
      }
    };
  }, [activeTarget, text, tooltipId]);

  if (!activeTarget || !text || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={bubbleRef}
      id={tooltipId}
      role="tooltip"
      className="pdv-tooltip"
      data-placement={pos.placement}
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
      }}
    >
      {text}
    </div>,
    document.body
  );
};
