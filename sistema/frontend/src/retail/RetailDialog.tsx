import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function RetailDialog({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    function handle(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key === "Tab") {
        const items = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ) || []),
        ];
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="retail-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`retail-dialog ${wide ? "retail-dialog-wide" : ""}`}
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="retail-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            data-tooltip="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </header>
        {children}
        {footer && <footer className="retail-dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
