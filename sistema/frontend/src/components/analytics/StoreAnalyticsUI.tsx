import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Banknote,
  QrCode,
  CreditCard,
  ClipboardList,
  RotateCcw,
  Wallet,
  Package,
  Calendar,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { RetailDatePicker } from '@/components/ui';
import { getFullUrl } from '@/lib/getFullUrl';

// ── Utilitários de Fuso Horário (America/Sao_Paulo) e Moeda ────────────────

const spDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getSaoPauloTodayIso(): string {
  const parts = spDateFormatter.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function shiftIsoDate(isoDay: string, deltaDays: number): string {
  return new Date(new Date(`${isoDay}T12:00:00Z`).getTime() + deltaDays * 86400000)
    .toISOString()
    .slice(0, 10);
}

export type StorePeriodPreset = 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'custom';

export function getSaoPauloPresetRange(preset: Exclude<StorePeriodPreset, 'custom'>): {
  startDate: string;
  endDate: string;
} {
  const today = getSaoPauloTodayIso();
  if (preset === 'today') {
    return { startDate: today, endDate: today };
  }
  if (preset === 'yesterday') {
    const yest = shiftIsoDate(today, -1);
    return { startDate: yest, endDate: yest };
  }
  if (preset === 'last7') {
    return { startDate: shiftIsoDate(today, -6), endDate: today };
  }
  if (preset === 'week') {
    const noon = new Date(`${today}T12:00:00Z`);
    const dow = noon.getUTCDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    return { startDate: shiftIsoDate(today, diffToMonday), endDate: today };
  }
  // month
  return { startDate: `${today.slice(0, 8)}01`, endDate: today };
}

export function formatIsoDateBr(isoDay?: string | null, short = false): string {
  if (!isoDay || !/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) return isoDay || '';
  const [y, m, d] = isoDay.split('-');
  return short ? `${d}/${m}` : `${d}/${m}/${y}`;
}

export function formatBrl(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

export function formatCompactBrl(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: abs >= 10000 ? 0 : 1,
      maximumFractionDigits: 1,
    })}k`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

export function calcDeltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

// ── Metadados de Pagamento (Paleta Roxo & Branco Aprovada) ─────────────────

export const BRAND_SLICE_PALETTE = [
  '#7C3AED',
  '#6D28D9',
  '#7C3AEDA6',
  '#7C3AED66',
  '#272321',
  '#665F70',
] as const;

export function getPaymentMethodLabel(method: string): string {
  const key = (method || '').toLowerCase();
  switch (key) {
    case 'dinheiro':
      return 'Dinheiro';
    case 'pix':
      return 'Pix';
    case 'credito':
      return 'Cartão de Crédito';
    case 'debito':
      return 'Cartão de Débito';
    case 'crediario':
    case 'fiado':
      return 'Crediário (Fiado)';
    case 'credito_loja':
    case 'store_credit':
      return 'Vale-troca / Crédito';
    case 'consumo_funcionario':
      return 'Consumo Equipe';
    default:
      return method || 'Outros';
  }
}

export function PaymentMethodIcon({
  method,
  size = 15,
  className = '',
}: {
  method: string;
  size?: number;
  className?: string;
}) {
  const key = (method || '').toLowerCase();
  if (key.includes('pix')) return <QrCode size={size} className={className} />;
  if (key.includes('dinh')) return <Banknote size={size} className={className} />;
  if (key.includes('crediario') || key.includes('fiado'))
    return <ClipboardList size={size} className={className} />;
  if (key.includes('credito_loja') || key.includes('store_credit') || key.includes('vale'))
    return <RotateCcw size={size} className={className} />;
  if (key.includes('cred') || key.includes('deb'))
    return <CreditCard size={size} className={className} />;
  return <Wallet size={size} className={className} />;
}

// ── Cabeçalho Unificado do Módulo Relatórios / Início ──────────────────────

export function StoreModuleHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-line">
      <div className="min-w-0">
        {badge && <div className="mb-1.5 flex flex-wrap items-center gap-2">{badge}</div>}
        <h1 className="management-page-title text-2xl md:text-[26px] font-bold tracking-tight text-ink">
          {title}
        </h1>
        <p className="management-page-description text-xs md:text-sm text-muted mt-1">
          {subtitle}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ── Barra de Período Unificada (Fuso São Paulo) ────────────────────────────

export function StorePeriodFilterBar({
  preset,
  startDate,
  endDate,
  presets = [
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Este mês' },
    { id: 'custom', label: 'Personalizado' },
  ],
  onSelectPreset,
  onChangeRange,
  rightSlot,
  alwaysShowDateInputs = false,
}: {
  preset: StorePeriodPreset;
  startDate: string;
  endDate: string;
  presets?: Array<{ id: StorePeriodPreset; label: string }>;
  onSelectPreset: (preset: StorePeriodPreset) => void;
  onChangeRange: (start: string, end: string) => void;
  rightSlot?: React.ReactNode;
  alwaysShowDateInputs?: boolean;
}) {
  const showPickers = alwaysShowDateInputs || preset === 'custom';

  return (
    <div className="bg-page border border-line rounded-xl p-2.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex flex-wrap items-center bg-surface border border-line rounded-lg p-1 gap-1"
          role="group"
          aria-label="Atalhos de período"
        >
          {presets.map((item) => {
            const active = preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPreset(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-brand text-on-brand'
                    : 'text-muted hover:text-ink hover:bg-page'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {showPickers ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[148px]">
              <RetailDatePicker
                value={startDate}
                onValueChange={(next) => {
                  const adjustedEnd = next > endDate ? next : endDate;
                  onChangeRange(next, adjustedEnd);
                }}
                rangeStart={startDate}
                rangeEnd={endDate}
                max={endDate}
                allowClear={false}
                aria-label="Data inicial"
              />
            </div>
            <span className="text-xs font-medium text-muted">até</span>
            <div className="w-[148px]">
              <RetailDatePicker
                value={endDate}
                onValueChange={(next) => {
                  const adjustedStart = next < startDate ? next : startDate;
                  onChangeRange(adjustedStart, next);
                }}
                rangeStart={startDate}
                rangeEnd={endDate}
                min={startDate}
                allowClear={false}
                aria-label="Data final"
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelectPreset('custom')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-medium text-muted hover:text-ink hover:border-brand transition-colors cursor-pointer"
            title="Clique para personalizar datas"
          >
            <Calendar size={13} className="text-brand" />
            <span className="tabular-nums">
              {startDate === endDate
                ? formatIsoDateBr(startDate)
                : `${formatIsoDateBr(startDate)} — ${formatIsoDateBr(endDate)}`}
            </span>
          </button>
        )}
      </div>

      {rightSlot && (
        <div className="flex flex-wrap items-center gap-2">{rightSlot}</div>
      )}
    </div>
  );
}

// ── Card de KPI Ilustrativo (100% Paleta Aprovada) ─────────────────────────

export function StoreKpiCard({
  label,
  value,
  icon,
  subtitle,
  deltaPct,
  deltaLabel = 'vs. período ant.',
  invertDeltaMeaning = false,
  badge,
  progressPct,
  emphasis = 'default',
  active = false,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  subtitle?: React.ReactNode;
  deltaPct?: number | null;
  deltaLabel?: string;
  invertDeltaMeaning?: boolean;
  badge?: React.ReactNode;
  progressPct?: number | null;
  emphasis?: 'default' | 'primary' | 'contrast';
  active?: boolean;
  onClick?: () => void;
}) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const isPositive = hasDelta && (invertDeltaMeaning ? deltaPct! <= 0 : deltaPct! >= 0);
  const isZero = hasDelta && Math.abs(deltaPct!) < 0.05;

  const containerClasses = [
    'relative overflow-hidden rounded-xl border p-4 md:p-5 flex flex-col justify-between gap-3 transition-colors text-left w-full',
    active
      ? 'bg-support border-brand'
      : emphasis === 'primary'
        ? 'bg-surface border-brand'
        : emphasis === 'contrast'
          ? 'bg-surface border-ink'
          : 'bg-surface border-line',
    onClick ? 'cursor-pointer hover:border-brand' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {emphasis === 'primary' && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-brand"
        />
      )}
      {emphasis === 'contrast' && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-ink"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted leading-snug">
          {label}
        </span>
        <span
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            emphasis === 'contrast'
              ? 'bg-ink text-on-brand'
              : active
                ? 'bg-brand text-on-brand'
                : 'bg-support text-brand'
          }`}
        >
          {icon}
        </span>
      </div>

      <div className="space-y-2">
        <div className="text-2xl xl:text-[26px] font-bold tracking-tight text-ink tabular-nums leading-tight">
          {value}
        </div>

        {(hasDelta || badge) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {hasDelta && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums border ${
                  isZero
                    ? 'bg-page text-muted border-line'
                    : isPositive
                      ? 'bg-support text-brand border-brand'
                      : 'bg-page text-ink border-line'
                }`}
              >
                {isZero ? (
                  <Minus size={11} />
                ) : deltaPct! > 0 ? (
                  <ArrowUpRight size={12} />
                ) : (
                  <ArrowDownRight size={12} />
                )}
                {deltaPct! > 0 ? '+' : ''}
                {deltaPct!.toFixed(1)}% {deltaLabel}
              </span>
            )}
            {badge}
          </div>
        )}

        {typeof progressPct === 'number' && (
          <div className="w-full h-1.5 rounded-full bg-support overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
            />
          </div>
        )}

        {subtitle && (
          <div className="text-xs text-muted leading-relaxed flex items-center gap-1.5 flex-wrap">
            {subtitle}
          </div>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={containerClasses}
      >
        {content}
      </button>
    );
  }

  return <article className={containerClasses}>{content}</article>;
}

// ── Tooltip de Gráfico Padronizado na Identidade Roxo & Branco ─────────────

export function BrandChartTooltip({
  active,
  payload,
  label,
  titlePrefix = '',
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  titlePrefix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload || {};

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E1ED',
        borderRadius: 10,
        padding: '10px 12px',
        color: '#272321',
        minWidth: 175,
        boxShadow: '0 8px 24px #27232114',
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5 mb-2">
        <span className="text-xs font-bold text-ink">
          {titlePrefix}
          {row.fullLabel || label}
        </span>
        {typeof row.transactions === 'number' && (
          <span className="text-[11px] font-semibold text-brand bg-support px-1.5 py-0.5 rounded tabular-nums">
            {row.transactions} {row.transactions === 1 ? 'venda' : 'vendas'}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {payload.map((entry: any, idx: number) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-4 text-xs tabular-nums"
          >
            <span className="flex items-center gap-1.5 text-muted font-medium">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color || '#7C3AED' }}
              />
              {entry.name || 'Valor'}
            </span>
            <strong className="text-ink font-bold">
              {formatBrl(Number(entry.value || 0))}
            </strong>
          </div>
        ))}
        {typeof row.transactions === 'number' &&
          row.transactions > 0 &&
          typeof row.value === 'number' && (
            <div className="pt-1 mt-1 border-t border-line flex items-center justify-between gap-4 text-[11px] text-muted tabular-nums">
              <span>Ticket médio</span>
              <span className="font-semibold text-ink">
                {formatBrl(row.value / row.transactions)}
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

// ── Donut Interativo de Mix de Pagamentos (Sem fatia cinza dominante!) ─────

export function PaymentMixDonut({
  byPaymentMethod,
  countByPaymentMethod,
  totalRevenue,
  onSelectMethod,
  selectedMethod,
}: {
  byPaymentMethod?: Record<string, number>;
  countByPaymentMethod?: Record<string, number>;
  totalRevenue: number;
  onSelectMethod?: (methodKey: string) => void;
  selectedMethod?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const items = Object.entries(byPaymentMethod || {})
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([key, rawVal], idx) => {
      const value = Number(rawVal || 0);
      const sumBase = totalRevenue > 0 ? totalRevenue : value;
      const pct = sumBase > 0 ? (value / sumBase) * 100 : 0;
      const color = BRAND_SLICE_PALETTE[idx % BRAND_SLICE_PALETTE.length];
      return {
        key,
        name: getPaymentMethodLabel(key),
        value,
        pct,
        count: countByPaymentMethod?.[key] ?? null,
        color,
      };
    });

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-support text-brand flex items-center justify-center mb-3">
          <CreditCard size={20} />
        </div>
        <p className="text-sm font-semibold text-ink">Sem pagamentos no período</p>
        <p className="text-xs text-muted mt-1 max-w-[24ch]">
          Assim que novas vendas forem registradas, a distribuição por meio de pagamento aparecerá aqui.
        </p>
      </div>
    );
  }

  const totalPaymentsSum = items.reduce((acc, i) => acc + i.value, 0);
  const activeSlice = hoveredIdx !== null && items[hoveredIdx] ? items[hoveredIdx] : items[0];

  return (
    <div className="flex-1 flex flex-col justify-between gap-4">
      <div className="relative h-[196px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={items.length > 1 ? 3 : 0}
              stroke="#FFFFFF"
              strokeWidth={2}
              onMouseEnter={(_, idx) => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {items.map((entry, idx) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  style={{
                    cursor: onSelectMethod ? 'pointer' : 'default',
                    opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.65,
                  }}
                  onClick={() => onSelectMethod?.(entry.key)}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E1ED',
                      borderRadius: 10,
                      padding: '8px 11px',
                      color: '#272321',
                    }}
                  >
                    <div className="text-xs font-bold text-ink">{d.name}</div>
                    <div className="text-xs font-semibold text-brand tabular-nums mt-0.5">
                      {formatBrl(d.value)} ({d.pct.toFixed(1)}%)
                    </div>
                    {d.count !== null && (
                      <div className="text-[11px] text-muted mt-0.5">
                        {d.count} {d.count === 1 ? 'atendimento' : 'atendimentos'}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centro interativo do Donut */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate max-w-[104px]">
            {hoveredIdx !== null ? activeSlice.name : `Líder · ${items[0].name.split(' ')[0]}`}
          </span>
          <strong className="text-sm font-bold text-ink tabular-nums mt-0.5">
            {hoveredIdx !== null
              ? `${activeSlice.pct.toFixed(1)}%`
              : `${((items[0].value / Math.max(1, totalPaymentsSum)) * 100).toFixed(0)}%`}
          </strong>
          <span className="text-[11px] text-brand font-semibold tabular-nums">
            {formatBrl(hoveredIdx !== null ? activeSlice.value : items[0].value)}
          </span>
        </div>
      </div>

      {/* Lista rica de meios de pagamento */}
      <div className="space-y-2">
        {items.map((item, idx) => {
          const isSelected = selectedMethod && selectedMethod === item.key;
          const pctShare = totalPaymentsSum > 0 ? (item.value / totalPaymentsSum) * 100 : 0;
          return (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onSelectMethod?.(item.key)}
              role={onSelectMethod ? 'button' : undefined}
              tabIndex={onSelectMethod ? 0 : undefined}
              onKeyDown={(e) => {
                if (onSelectMethod && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelectMethod(item.key);
                }
              }}
              className={`rounded-lg border p-2.5 transition-colors ${
                isSelected
                  ? 'bg-support border-brand'
                  : 'bg-page border-line hover:bg-surface'
              } ${onSelectMethod ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <PaymentMethodIcon method={item.key} size={14} className="text-brand shrink-0" />
                  <span className="font-semibold text-ink truncate">{item.name}</span>
                  {item.count !== null && item.count > 0 && (
                    <span className="text-[11px] text-muted tabular-nums shrink-0">
                      · {item.count}x
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <strong className="text-ink font-bold">{formatBrl(item.value)}</strong>
                  <span className="text-[11px] font-semibold text-brand bg-support px-1.5 py-0.5 rounded">
                    {pctShare.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-support overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, pctShare))}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Miniatura de Mercadoria / Grupo (Foto Compartilhada do Grupo) ──────────

export function ProductThumb({
  imageUrl,
  alt,
  size = 40,
}: {
  imageUrl?: string | null;
  alt: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = imageUrl ? getFullUrl(imageUrl) : '';

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="rounded-lg object-cover border border-line bg-page shrink-0"
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-lg border border-line bg-support text-brand flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      <Package size={Math.round(size * 0.46)} />
    </span>
  );
}
