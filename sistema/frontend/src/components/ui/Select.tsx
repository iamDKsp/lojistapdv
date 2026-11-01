import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useId,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RetailSelectProps {
  value: string | number;
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  onValueChange?: (value: string) => void;
  options?: SelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  'aria-label'?: string;
}

function extractNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (React.isValidElement(node)) {
    return extractNodeText((node.props as any)?.children);
  }
  return '';
}

function parseChildrenOptions(children: React.ReactNode): SelectOption[] {
  const result: SelectOption[] = [];
  const walk = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      const props = child.props as any;
      if (child.type === 'option') {
        const val = props.value !== undefined ? String(props.value) : extractNodeText(props.children);
        const label = extractNodeText(props.children).trim() || val;
        result.push({
          value: val,
          label,
          disabled: Boolean(props.disabled),
        });
      } else if (props?.children) {
        walk(props.children);
      }
    });
  };
  walk(children);
  return result;
}

export const RetailSelect: React.FC<RetailSelectProps> = ({
  value,
  onChange,
  onValueChange,
  options: propOptions,
  children,
  placeholder = 'Selecionar…',
  disabled = false,
  searchable,
  searchPlaceholder = 'Buscar opção…',
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
}) => {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: 'bottom' | 'top';
  }>({
    top: -9999,
    left: -9999,
    width: 220,
    maxHeight: 280,
    placement: 'bottom',
  });

  const allOptions = useMemo<SelectOption[]>(() => {
    if (propOptions && propOptions.length > 0) return propOptions;
    return parseChildrenOptions(children);
  }, [propOptions, children]);

  const strValue = String(value ?? '');

  const selectedOption = useMemo(
    () => allOptions.find((o) => o.value === strValue) || null,
    [allOptions, strValue]
  );

  const showSearch = searchable ?? allOptions.length >= 8;

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [allOptions, searchQuery]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 10;
    const gap = 6;

    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const desiredHeight = Math.min(
      320,
      (filteredOptions.length || 1) * 40 + (showSearch ? 56 : 16)
    );

    const openUpward = spaceBelow < Math.min(220, desiredHeight) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(320, (openUpward ? spaceAbove : spaceBelow) - gap));
    const width = Math.min(Math.max(rect.width, 190), vw - pad * 2);

    let left = rect.left;
    if (left + width > vw - pad) {
      left = Math.max(pad, vw - width - pad);
    }

    const popoverEl = popoverRef.current;
    const actualHeight = popoverEl ? Math.min(popoverEl.offsetHeight || desiredHeight, maxHeight) : desiredHeight;

    const top = openUpward
      ? Math.max(pad, rect.top - actualHeight - gap)
      : Math.min(vh - pad - 60, rect.bottom + gap);

    setMenuStyle({
      top,
      left,
      width,
      maxHeight,
      placement: openUpward ? 'top' : 'bottom',
    });
  }, [filteredOptions.length, showSearch]);

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    setSearchQuery('');
    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  const selectOption = useCallback(
    (opt: SelectOption) => {
      if (opt.disabled) return;
      onValueChange?.(opt.value);
      onChange?.({
        target: { value: opt.value },
        currentTarget: { value: opt.value },
      });
      closeMenu(true);
    },
    [onValueChange, onChange, closeMenu]
  );

  useEffect(() => {
    if (!open) return;
    const currentIdx = filteredOptions.findIndex((o) => o.value === strValue && !o.disabled);
    const firstEnabled = filteredOptions.findIndex((o) => !o.disabled);
    setActiveIndex(currentIdx >= 0 ? currentIdx : firstEnabled);

    updatePosition();
    const raf = requestAnimationFrame(() => {
      updatePosition();
      if (showSearch) {
        searchInputRef.current?.focus();
      } else {
        const idx = currentIdx >= 0 ? currentIdx : firstEnabled;
        if (idx >= 0) optionRefs.current[idx]?.focus();
      }
    });

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      closeMenu(false);
    };

    const handleScrollOrResize = () => updatePosition();

    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('touchstart', handleOutside, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('touchstart', handleOutside, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, filteredOptions.length, strValue, showSearch, updatePosition, closeMenu]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = optionRefs.current[activeIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex]);

  const moveFocus = (delta: number) => {
    if (filteredOptions.length === 0) return;
    let next = activeIndex;
    for (let i = 0; i < filteredOptions.length; i++) {
      next = (next + delta + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[next]?.disabled) {
        setActiveIndex(next);
        if (!showSearch) {
          optionRefs.current[next]?.focus();
        }
        break;
      }
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = filteredOptions.findIndex((o) => !o.disabled);
      if (first >= 0) setActiveIndex(first);
    } else if (e.key === 'End') {
      e.preventDefault();
      for (let i = filteredOptions.length - 1; i >= 0; i--) {
        if (!filteredOptions[i].disabled) {
          setActiveIndex(i);
          break;
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        selectOption(filteredOptions[activeIndex]);
      }
    } else if (e.key === 'Tab') {
      closeMenu(false);
    }
  };

  const hasRetailSelectClass = className.includes('retail-select');

  return (
    <>
      {name && <input type="hidden" name={name} value={strValue} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className={`pdv-select-trigger ${hasRetailSelectClass ? '' : 'retail-select'} ${className}`}
        data-open={open ? 'true' : undefined}
      >
        <span className="pdv-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`pdv-select-chevron ${open ? 'is-open' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel || placeholder}
            className="pdv-select-popover"
            data-placement={menuStyle.placement}
            onKeyDown={handleMenuKeyDown}
            style={{
              top: `${menuStyle.top}px`,
              left: `${menuStyle.left}px`,
              width: `${menuStyle.width}px`,
              maxHeight: `${menuStyle.maxHeight}px`,
            }}
          >
            {showSearch && (
              <div className="pdv-select-search">
                <Search size={14} className="pdv-select-search-icon" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="pdv-select-search-input"
                  aria-label={searchPlaceholder}
                />
              </div>
            )}

            <div className="pdv-select-options">
              {filteredOptions.length === 0 ? (
                <div className="pdv-select-empty">Nenhuma opção encontrada.</div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === strValue;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
                      onClick={() => selectOption(opt)}
                      className={`pdv-select-option ${isSelected ? 'is-selected' : ''} ${
                        isActive ? 'is-active' : ''
                      }`}
                    >
                      <span className="pdv-select-option-text">
                        <span className="pdv-select-option-label">{opt.label}</span>
                        {opt.description && (
                          <span className="pdv-select-option-desc">{opt.description}</span>
                        )}
                      </span>
                      {isSelected && (
                        <Check size={15} className="pdv-select-option-check" aria-hidden="true" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
