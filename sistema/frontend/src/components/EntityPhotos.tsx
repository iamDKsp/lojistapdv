import { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { useShift } from '@/contexts/ShiftContext';
import { useAuthStore } from '@/store/auth';
import { getFullUrl } from '@/lib/getFullUrl';

export function normalizeEntityName(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizeBaseEntityName(raw?: string | null): string {
  return normalizeEntityName(String(raw || '').replace(/\s*\([^)]*\)\s*/g, ' '));
}

export function getOperatorInitials(name?: string | null): string {
  const clean = String(name || '').trim();
  if (!clean) return 'OP';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function useResolvedOperatorPhoto(params: {
  operatorId?: string | null;
  name?: string | null;
  imageUrl?: string | null;
}): string | null {
  const { operatorId, name, imageUrl } = params;
  const { operators, operator: activeOperator } = useShift();
  const authUser = useAuthStore((s) => s.user);

  return useMemo(() => {
    if (typeof imageUrl === 'string' && imageUrl.trim()) {
      return imageUrl.trim();
    }

    const cleanId = operatorId ? String(operatorId).trim() : '';
    const normName = normalizeEntityName(name);
    const baseName = normalizeBaseEntityName(name);

    if (cleanId) {
      if (activeOperator?.id === cleanId && activeOperator.imageUrl) {
        return activeOperator.imageUrl;
      }
      const byId = operators.find((o) => o.id === cleanId && o.imageUrl);
      if (byId?.imageUrl) return byId.imageUrl;
      if (authUser?.id === cleanId && authUser.imageUrl) {
        return authUser.imageUrl;
      }
    }

    if (normName || baseName) {
      const matchesName = (candidate?: string | null) => {
        if (!candidate) return false;
        const cNorm = normalizeEntityName(candidate);
        const cBase = normalizeBaseEntityName(candidate);
        return (
          (Boolean(normName) && cNorm === normName) ||
          (Boolean(baseName) && cBase === baseName)
        );
      };

      if (activeOperator?.imageUrl && matchesName(activeOperator.name)) {
        return activeOperator.imageUrl;
      }

      const byOpName = operators.find(
        (o) => Boolean(o.imageUrl) && matchesName(o.name),
      );
      if (byOpName?.imageUrl) return byOpName.imageUrl;

      if (authUser?.imageUrl && matchesName(authUser.name)) {
        return authUser.imageUrl;
      }
    }

    return null;
  }, [imageUrl, operatorId, name, operators, activeOperator, authUser]);
}

const AVATAR_SIZE_CLASSES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base',
} as const;

export interface OperatorAvatarThumbProps {
  name?: string | null;
  imageUrl?: string | null;
  operatorId?: string | null;
  size?: keyof typeof AVATAR_SIZE_CLASSES;
  className?: string;
  title?: string;
}

export function OperatorAvatarThumb({
  name,
  imageUrl,
  operatorId,
  size = 'sm',
  className = '',
  title,
}: OperatorAvatarThumbProps) {
  const resolvedPhoto = useResolvedOperatorPhoto({
    operatorId,
    name,
    imageUrl,
  });
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [resolvedPhoto]);

  const initials = useMemo(() => getOperatorInitials(name), [name]);
  const sizeClass = AVATAR_SIZE_CLASSES[size] || AVATAR_SIZE_CLASSES.sm;

  return (
    <span
      title={title || name || undefined}
      className={`inline-flex items-center justify-center rounded-full bg-support text-brand border border-line overflow-hidden shrink-0 font-bold select-none ${sizeClass} ${className}`}
    >
      {resolvedPhoto && !imgError ? (
        <img
          src={getFullUrl(resolvedPhoto)}
          alt={name || 'Operador'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : name ? (
        <span className="leading-none tracking-tight">{initials}</span>
      ) : (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full">
          <rect width="36" height="36" rx="18" fill="var(--pdv-support)" />
          <circle cx="18" cy="13.5" r="5.5" fill="var(--pdv-primary)" />
          <path
            d="M8 33c1.8-5.8 5.8-8.8 10-8.8s8.2 3 10 8.8"
            fill="var(--pdv-primary-hover)"
          />
        </svg>
      )}
    </span>
  );
}

export interface OperatorInlineBadgeProps {
  name?: string | null;
  imageUrl?: string | null;
  operatorId?: string | null;
  label?: string;
  roleLabel?: string | null;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'plain' | 'pill';
  className?: string;
  nameClassName?: string;
}

export function OperatorInlineBadge({
  name,
  imageUrl,
  operatorId,
  label,
  roleLabel,
  size = 'sm',
  variant = 'plain',
  className = '',
  nameClassName = '',
}: OperatorInlineBadgeProps) {
  const displayName = name?.trim() || 'Administrador';
  const pillClasses =
    variant === 'pill'
      ? 'px-2 py-1 rounded-full bg-page border border-line'
      : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 min-w-0 max-w-full ${pillClasses} ${className}`}
    >
      <OperatorAvatarThumb
        name={displayName}
        imageUrl={imageUrl}
        operatorId={operatorId}
        size={size}
      />
      <span className="inline-flex items-center gap-1 min-w-0 truncate">
        {label ? (
          <span className="text-muted font-medium shrink-0">{label}</span>
        ) : null}
        <span className={`font-semibold text-ink truncate ${nameClassName}`}>
          {displayName}
        </span>
        {roleLabel ? (
          <span className="text-[10px] font-medium text-muted shrink-0">
            · {roleLabel}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function resolveStockItemImageUrl(params: {
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  product?: any;
}): string | null {
  const candidates = [
    params.imageUrl,
    params.fallbackImageUrl,
    params.product?.imageUrl,
    params.product?.retailGroup?.imageUrl,
    params.product?.product?.imageUrl,
    params.product?.product?.retailGroup?.imageUrl,
    params.product?.saleItem?.imageUrl,
    params.product?.saleItem?.product?.imageUrl,
    params.product?.saleItem?.product?.retailGroup?.imageUrl,
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  return null;
}

const STOCK_THUMB_SIZE_CLASSES = {
  xs: { box: 'w-6 h-6', icon: 'w-3 h-3' },
  sm: { box: 'w-8 h-8', icon: 'w-3.5 h-3.5' },
  md: { box: 'w-10 h-10', icon: 'w-4 h-4' },
  lg: { box: 'w-12 h-12', icon: 'w-5 h-5' },
  xl: { box: 'w-16 h-16', icon: 'w-6 h-6' },
} as const;

const STOCK_THUMB_ROUNDED_CLASSES = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
} as const;

export interface StockItemThumbProps {
  name?: string | null;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  product?: any;
  size?: keyof typeof STOCK_THUMB_SIZE_CLASSES;
  rounded?: keyof typeof STOCK_THUMB_ROUNDED_CLASSES;
  className?: string;
}

export function StockItemThumb({
  name,
  imageUrl,
  fallbackImageUrl,
  product,
  size = 'sm',
  rounded = 'md',
  className = '',
}: StockItemThumbProps) {
  const resolvedUrl = useMemo(
    () =>
      resolveStockItemImageUrl({
        imageUrl,
        fallbackImageUrl,
        product,
      }),
    [imageUrl, fallbackImageUrl, product],
  );
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [resolvedUrl]);

  const sizeCfg = STOCK_THUMB_SIZE_CLASSES[size] || STOCK_THUMB_SIZE_CLASSES.sm;
  const roundedClass =
    STOCK_THUMB_ROUNDED_CLASSES[rounded] || STOCK_THUMB_ROUNDED_CLASSES.md;

  return (
    <span
      title={name || product?.name || product?.productName || undefined}
      className={`inline-flex items-center justify-center bg-page border border-line overflow-hidden shrink-0 select-none ${sizeCfg.box} ${roundedClass} ${className}`}
    >
      {resolvedUrl && !imgError ? (
        <img
          src={getFullUrl(resolvedUrl)}
          alt={name || product?.name || product?.productName || 'Mercadoria'}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <Package className={`${sizeCfg.icon} text-muted`} />
      )}
    </span>
  );
}
