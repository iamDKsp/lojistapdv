import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';

export interface RetailDatePickerProps {
  value: string;
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  onValueChange?: (isoDate: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  min?: string;
  max?: string;
  /** Opcional: destaca intervalo quando usado em filtro de período (início/fim) */
  rangeStart?: string;
  rangeEnd?: string;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function isoToBr(iso: string): string {
  if (!iso || typeof iso !== 'string') return '';
  const clean = iso.split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

function parseIsoParts(iso: string): { year: number; month: number; day: number } | null {
  if (!iso || typeof iso !== 'string') return null;
  const clean = iso.split('T')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function isValidDayMonthYear(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const maxDays = new Date(year, month, 0).getDate();
  return day <= maxDays;
}

function toIsoString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayIso(): string {
  const now = new Date();
  return toIsoString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function formatBrMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export const RetailDatePicker: React.FC<RetailDatePickerProps> = ({
  value,
  onChange,
  onValueChange,
  placeholder = 'DD/MM/AAAA',
  disabled = false,
  required = false,
  allowClear,
  min,
  max,
  rangeStart,
  rangeEnd,
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
}) => {
  const canClear = allowClear ?? !required;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState<string>(() => isoToBr(value));
  const [hasInputError, setHasInputError] = useState(false);

  const initialParts = useMemo(() => {
    const parsed = parseIsoParts(value);
    if (parsed) return { year: parsed.year, month: parsed.month };
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(initialParts.year);
  const [viewMonth, setViewMonth] = useState<number>(initialParts.month);
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
    placement: 'bottom' | 'top';
  }>({ top: -9999, left: -9999, placement: 'bottom' });

  useEffect(() => {
    setInputText(isoToBr(value));
    setHasInputError(false);
    const parsed = parseIsoParts(value);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  const emitChange = useCallback(
    (nextIso: string) => {
      onValueChange?.(nextIso);
      onChange?.({
        target: { value: nextIso },
        currentTarget: { value: nextIso },
      });
    },
    [onValueChange, onChange]
  );

  const isDateDisabled = useCallback(
    (iso: string) => {
      if (min && iso < min) return true;
      if (max && iso > max) return true;
      return false;
    },
    [min, max]
  );

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 10;
    const gap = 6;
    const popWidth = 296;
    const popHeight = popoverRef.current?.offsetHeight || 336;

    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openUpward = spaceBelow < popHeight && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + popWidth > vw - pad) {
      left = Math.max(pad, vw - popWidth - pad);
    }

    const top = openUpward
      ? Math.max(pad, rect.top - popHeight - gap)
      : Math.min(vh - popHeight - pad, rect.bottom + gap);

    setPopoverStyle({
      top,
      left,
      placement: openUpward ? 'top' : 'bottom',
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        inputRef.current?.focus();
      }
    };

    const handleScrollOrResize = () => updatePosition();

    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('touchstart', handleOutside, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('touchstart', handleOutside, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updatePosition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = formatBrMask(raw);
    setInputText(masked);

    if (masked === '') {
      setHasInputError(false);
      if (canClear) {
        emitChange('');
      }
      return;
    }

    if (masked.length === 10) {
      const [dStr, mStr, yStr] = masked.split('/');
      const d = Number(dStr);
      const m = Number(mStr);
      const y = Number(yStr);
      if (isValidDayMonthYear(d, m, y)) {
        const iso = toIsoString(y, m, d);
        if (!isDateDisabled(iso)) {
          setHasInputError(false);
          setViewYear(y);
          setViewMonth(m);
          emitChange(iso);
          return;
        }
      }
      setHasInputError(true);
    } else {
      setHasInputError(false);
    }
  };

  const handleInputBlur = () => {
    if (inputText === '') {
      if (canClear) {
        setHasInputError(false);
        if (value) emitChange('');
      } else {
        setInputText(isoToBr(value));
      }
      return;
    }
    if (inputText.length < 10 || hasInputError) {
      setInputText(isoToBr(value));
      setHasInputError(false);
    }
  };

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const calendarDays = useMemo(() => {
    const firstDayWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const prevMonthYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth, 0).getDate();

    const cells: Array<{
      iso: string;
      day: number;
      inCurrentMonth: boolean;
    }> = [];

    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      cells.push({
        iso: toIsoString(prevMonthYear, prevMonth, d),
        day: d,
        inCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        iso: toIsoString(viewYear, viewMonth, d),
        day: d,
        inCurrentMonth: true,
      });
    }

    const nextMonthYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    let nextDay = 1;
    while (cells.length < 42) {
      cells.push({
        iso: toIsoString(nextMonthYear, nextMonth, nextDay),
        day: nextDay,
        inCurrentMonth: false,
      });
      nextDay++;
    }

    return cells;
  }, [viewYear, viewMonth]);

  const todayIso = getTodayIso();
  const cleanValue = value ? value.split('T')[0] : '';

  return (
    <>
      <div
        ref={containerRef}
        className={`pdv-datepicker ${hasInputError ? 'has-error' : ''} ${
          disabled ? 'is-disabled' : ''
        } ${className}`}
        data-open={open ? 'true' : undefined}
      >
        {name && <input type="hidden" name={name} value={cleanValue} />}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          value={inputText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel || placeholder}
          aria-invalid={hasInputError ? 'true' : undefined}
          className="pdv-datepicker-input"
        />

        {canClear && cleanValue && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInputText('');
              emitChange('');
            }}
            className="pdv-datepicker-clear"
            aria-label="Limpar data"
            data-tooltip="Limpar data"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className="pdv-datepicker-trigger"
          aria-label="Abrir calendário"
          aria-expanded={open}
        >
          <CalendarIcon size={16} aria-hidden="true" />
        </button>
      </div>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Calendário"
            className="pdv-calendar-popover"
            data-placement={popoverStyle.placement}
            style={{
              top: `${popoverStyle.top}px`,
              left: `${popoverStyle.left}px`,
            }}
          >
            <div className="pdv-calendar-header">
              <div className="pdv-calendar-nav-group">
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y - 1)}
                  className="pdv-calendar-nav-btn"
                  aria-label="Ano anterior"
                  data-tooltip="Ano anterior"
                >
                  <ChevronsLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="pdv-calendar-nav-btn"
                  aria-label="Mês anterior"
                  data-tooltip="Mês anterior"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>

              <div className="pdv-calendar-title">
                {MONTHS_PT[viewMonth - 1]} {viewYear}
              </div>

              <div className="pdv-calendar-nav-group">
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="pdv-calendar-nav-btn"
                  aria-label="Próximo mês"
                  data-tooltip="Próximo mês"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y + 1)}
                  className="pdv-calendar-nav-btn"
                  aria-label="Próximo ano"
                  data-tooltip="Próximo ano"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>

            <div className="pdv-calendar-weekdays">
              {WEEKDAYS_PT.map((wd) => (
                <span key={wd} className="pdv-calendar-weekday">
                  {wd}
                </span>
              ))}
            </div>

            <div className="pdv-calendar-grid">
              {calendarDays.map((cell) => {
                const isSelected =
                  cell.iso === cleanValue ||
                  (rangeStart && cell.iso === rangeStart) ||
                  (rangeEnd && cell.iso === rangeEnd);
                const isInRange =
                  rangeStart &&
                  rangeEnd &&
                  cell.iso > rangeStart &&
                  cell.iso < rangeEnd;
                const isToday = cell.iso === todayIso;
                const cellDisabled = isDateDisabled(cell.iso);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={cellDisabled}
                    onClick={() => {
                      if (cellDisabled) return;
                      emitChange(cell.iso);
                      setOpen(false);
                      inputRef.current?.focus();
                    }}
                    className={`pdv-calendar-day ${
                      !cell.inCurrentMonth ? 'is-outside' : ''
                    } ${isSelected ? 'is-selected' : ''} ${
                      isInRange ? 'is-in-range' : ''
                    } ${isToday ? 'is-today' : ''}`}
                    aria-label={isoToBr(cell.iso)}
                    aria-pressed={Boolean(isSelected)}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="pdv-calendar-footer">
              <button
                type="button"
                onClick={() => {
                  if (!isDateDisabled(todayIso)) {
                    emitChange(todayIso);
                    setOpen(false);
                  } else {
                    const parsed = parseIsoParts(todayIso);
                    if (parsed) {
                      setViewYear(parsed.year);
                      setViewMonth(parsed.month);
                    }
                  }
                }}
                className="pdv-calendar-footer-btn is-primary"
              >
                Hoje
              </button>

              {canClear && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    emitChange('');
                    setOpen(false);
                  }}
                  className="pdv-calendar-footer-btn"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
