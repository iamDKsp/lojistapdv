import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getFullUrl } from '@/lib/getFullUrl';
import { CategoryIconIllustration } from '@/components/CategoryIcons';

function clampFocal(val: unknown, fallback = 50): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

const PADDING_CLASSES: Record<'none' | 'xs' | 'sm' | 'md' | 'lg', string> = {
  none: 'p-0',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-3 sm:p-4',
  lg: 'p-4 sm:p-6',
};

/**
 * Quadro unificado de mercadoria para cartões, carrosséis, detalhe, "Monte o look" e sacola.
 * - Exibe sempre a peça inteira com margem (`object-contain`), sem cortar óculos largos,
 *   bonés, tênis ou calças compridas.
 * - Preserva transparência de PNG/SVG/WebP sobre fundo neutro (`bg-page` #F8F7FC),
 *   garantindo contraste suave inclusive para peças brancas (#FFFFFF).
 */
export function StorefrontProductFrame({
  imageUrl,
  secondaryImageUrl,
  alt,
  categoryId,
  categoryName,
  productName,
  padding = 'md',
  aspectClassName = 'aspect-[4/5]',
  roundedClassName = 'rounded-xl',
  bordered = true,
  hoverScale = false,
  eager = false,
  className = '',
  imgClassName = '',
  onClick,
  children,
}: {
  imageUrl?: string | null;
  secondaryImageUrl?: string | null;
  alt?: string;
  categoryId?: string | null;
  categoryName?: string | null;
  productName?: string | null;
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  aspectClassName?: string;
  roundedClassName?: string;
  bordered?: boolean;
  hoverScale?: boolean;
  eager?: boolean;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [imageUrl]);

  const hasValidPhoto = Boolean(imageUrl && !failed);
  const resolvedSecondary =
    secondaryImageUrl && secondaryImageUrl !== imageUrl ? secondaryImageUrl : null;
  const padClass = PADDING_CLASSES[padding] || PADDING_CLASSES.md;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative overflow-hidden bg-page flex items-center justify-center ${aspectClassName} ${roundedClassName} ${
        bordered ? 'border border-line' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {hasValidPhoto ? (
        <div className={`relative w-full h-full flex items-center justify-center ${padClass}`}>
          {!loaded && (
            <div
              aria-hidden="true"
              className="absolute inset-2 rounded-lg bg-support/35 animate-pulse"
            />
          )}
          <img
            src={getFullUrl(imageUrl!)}
            alt={alt || productName || 'Mercadoria'}
            loading={eager ? 'eager' : 'lazy'}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`w-full h-full object-contain object-center select-none transition-all duration-300 ease-out ${
              hoverScale ? 'group-hover/card:scale-[1.03]' : ''
            } ${loaded ? 'opacity-100' : 'opacity-0'} ${
              resolvedSecondary ? 'sm:group-hover/card:opacity-0' : ''
            } ${imgClassName}`}
          />
          {resolvedSecondary && (
            <img
              src={getFullUrl(resolvedSecondary)}
              alt=""
              loading="lazy"
              aria-hidden="true"
              className={`hidden sm:block absolute inset-0 w-full h-full object-contain object-center select-none opacity-0 group-hover/card:opacity-100 transition-all duration-300 ease-out ${padClass} ${
                hoverScale ? 'group-hover/card:scale-[1.03]' : ''
              }`}
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <CategoryIconIllustration
            categoryId={categoryId || undefined}
            categoryName={categoryName || undefined}
            productName={productName || alt || 'Mercadoria'}
            compact={padding === 'xs' || padding === 'sm'}
          />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Quadro exclusivo para imagens de campanha, capa (hero) e banners promocionais.
 * Aqui o recorte (`object-cover`) é intencional e controlado por ponto focal (`focalX`, `focalY`),
 * com suporte a arte dedicada para celular (`mobileImageUrl`).
 */
export function StorefrontCampaignVisual({
  imageUrl,
  mobileImageUrl,
  alt = '',
  focalX = 50,
  focalY = 50,
  eager = false,
  className = '',
  imgClassName = '',
  emptyLabel = 'Imagem de campanha',
}: {
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  alt?: string;
  focalX?: number;
  focalY?: number;
  eager?: boolean;
  className?: string;
  imgClassName?: string;
  emptyLabel?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl, mobileImageUrl]);

  const x = clampFocal(focalX, 50);
  const y = clampFocal(focalY, 50);
  const primarySrc = imageUrl || mobileImageUrl || null;

  if (!primarySrc || failed) {
    return (
      <div
        className={`w-full h-full bg-support/45 flex flex-col items-center justify-center gap-1.5 text-muted p-4 text-center ${className}`}
      >
        <ImageIcon size={22} className="text-brand/70" />
        <span className="text-[11px] font-medium">{emptyLabel}</span>
      </div>
    );
  }

  const resolvedDesktop = getFullUrl(primarySrc);
  const resolvedMobile = mobileImageUrl ? getFullUrl(mobileImageUrl) : null;

  return (
    <picture className={`block w-full h-full overflow-hidden ${className}`}>
      {resolvedMobile && (
        <source media="(max-width: 639px)" srcSet={resolvedMobile} />
      )}
      <img
        src={resolvedDesktop}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
        style={{ objectPosition: `${x}% ${y}%` }}
        className={`w-full h-full object-cover transition-transform duration-500 ${imgClassName}`}
      />
    </picture>
  );
}
