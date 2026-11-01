import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Tv2, Sparkles, Maximize2, Layers } from "lucide-react";
import { getFullUrl } from "@/lib/getFullUrl";

export interface VitrineSlide {
  slideType?: "single";
  productId: string;
  retailGroupId?: string | null;
  productName: string;
  categoryName?: string | null;
  imageUrl: string | null;
  priceSell: number;
  promoPrice: number | null;
  badge: string | null;
  duration?: number;
  showSizes?: boolean;
  sizesAvailable?: string[];
  colorsAvailable?: string[];
  order: number;
}

export interface GridProduct {
  productId: string;
  retailGroupId?: string | null;
  productName: string;
  categoryName?: string | null;
  imageUrl: string | null;
  priceSell: number;
  promoPrice: number | null;
  sizesAvailable?: string[];
  colorsAvailable?: string[];
}

export interface VitrineGridSlide {
  slideType: "grid";
  gridId: string;
  order: number;
  gridTitle: string;
  gridSubtitle?: string;
  gridBadge?: string | null;
  duration?: number;
  gridProducts: GridProduct[];
}

export type AnyVitrineSlide = VitrineSlide | VitrineGridSlide;

export interface VitrinePublicData {
  active: boolean;
  version: number;
  storeName?: string;
  storeTagline?: string | null;
  theme: string;
  customBgUrl: string | null;
  showLogo: boolean;
  logoPosition?: string;
  logoUrl: string | null;
  instagramHandle?: string | null;
  slideDuration: number;
  gridSlideDuration: number;
  slides: AnyVitrineSlide[];
}

export interface VitrineThemeSpec {
  slug: string;
  name: string;
  description: string;
  bg: string;
  accent: string;
  accentSecondary: string;
  text: string;
  cardSurface: string;
  isLight?: boolean;
}

export const VITRINE_THEMES: Record<string, VitrineThemeSpec> = {
  dark_premium: {
    slug: "dark_premium",
    name: "Noite Imperial",
    description: "Fundo grafite profundo com iluminação radial em roxo vibrante",
    bg: "radial-gradient(ellipse at 22% 45%, color-mix(in srgb, #7C3AED 58%, #272321) 0%, #272321 68%, #272321 100%)",
    accent: "#7C3AED",
    accentSecondary: "#6D28D9",
    text: "#FFFFFF",
    cardSurface: "color-mix(in srgb, #272321 76%, transparent)",
  },
  purple_luxury: {
    slug: "purple_luxury",
    name: "Editorial Roxo",
    description: "Degradê diagonal de grafite para roxo profundo de boutique",
    bg: "linear-gradient(135deg, #272321 0%, #6D28D9 52%, #7C3AED 100%)",
    accent: "#F3E8FF",
    accentSecondary: "#7C3AED",
    text: "#FFFFFF",
    cardSurface: "color-mix(in srgb, #272321 68%, transparent)",
  },
  light_clean: {
    slug: "light_clean",
    name: "Vitrine Clara",
    description: "Estúdio branco e lavanda suave com alto contraste tipográfico",
    bg: "linear-gradient(135deg, #FFFFFF 0%, #F8F7FC 48%, #F3E8FF 100%)",
    accent: "#7C3AED",
    accentSecondary: "#6D28D9",
    text: "#272321",
    cardSurface: "color-mix(in srgb, #FFFFFF 88%, #F3E8FF)",
    isLight: true,
  },
  neon_night: {
    slug: "neon_night",
    name: "Palco Urbano",
    description: "Contraste intenso para vitrines de streetwear e calçados",
    bg: "linear-gradient(145deg, #272321 0%, color-mix(in srgb, #6D28D9 65%, #272321) 55%, #7C3AED 100%)",
    accent: "#7C3AED",
    accentSecondary: "#F3E8FF",
    text: "#FFFFFF",
    cardSurface: "color-mix(in srgb, #272321 78%, transparent)",
  },
  dark_glass: {
    slug: "dark_glass",
    name: "Vidro Fumê",
    description: "Superfície escura minimalista com molduras translúcidas",
    bg: "linear-gradient(160deg, #272321 0%, color-mix(in srgb, #272321 82%, #7C3AED) 65%, #272321 100%)",
    accent: "#F3E8FF",
    accentSecondary: "#7C3AED",
    text: "#FFFFFF",
    cardSurface: "color-mix(in srgb, #272321 72%, transparent)",
  },
  carbon_fiber: {
    slug: "carbon_fiber",
    name: "Grafite Puro",
    description: "Textura geométrica discreta para destacar fotos de peças claras",
    bg: "repeating-linear-gradient(45deg, #272321 0px, #272321 6px, color-mix(in srgb, #272321 90%, #665F70) 6px, color-mix(in srgb, #272321 90%, #665F70) 12px)",
    accent: "#7C3AED",
    accentSecondary: "#E5E1ED",
    text: "#FFFFFF",
    cardSurface: "color-mix(in srgb, #272321 80%, transparent)",
  },
};

export const VITRINE_THEME_LIST = Object.values(VITRINE_THEMES);

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: (i * 6.3 + 4) % 98,
  size: (i % 4) + 2,
  duration: 10 + (i % 7) * 1.8,
  delay: (i % 6) * 1.3,
  opacity: 0.14 + (i % 4) * 0.06,
}));

export function formatPriceBr(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatProductTitle(str: string): string {
  if (!str) return "";
  const lowerWords = [
    "de",
    "do",
    "da",
    "dos",
    "das",
    "e",
    "em",
    "com",
    "sem",
    "para",
    "por",
    "a",
    "o",
    "as",
    "os",
    "no",
    "na",
  ];
  return str
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (!word) return "";
      if (/^(pp|p|m|g|gg|xg|xgg|un|\d+[a-z]*)$/i.test(word)) {
        return word.toUpperCase();
      }
      if (i > 0 && lowerWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function InstagramSvgIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.5"
        fill="#7C3AED"
        stroke="#FFFFFF"
        strokeWidth="1.6"
      />
      <circle
        cx="12"
        cy="12"
        r="4.2"
        stroke="#FFFFFF"
        strokeWidth="1.8"
      />
      <circle cx="17.4" cy="6.6" r="1.2" fill="#FFFFFF" />
    </svg>
  );
}

function BrandWatermarkSvg({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="8" fill="#7C3AED" />
      <path
        d="M9.5 18.5C6.5 15.5 6.5 10.5 9.5 7.5C12.2 4.8 16.5 4.5 19.5 6.8"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M18.5 9.5C21.5 12.5 21.5 17.5 18.5 20.5C15.8 23.2 11.5 23.5 8.5 21.2"
        stroke="#F3E8FF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M11.5 16.5L16.5 11.5"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GridProductCard({
  product,
  theme,
  delay,
}: {
  product: GridProduct;
  theme: VitrineThemeSpec;
  delay: number;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const src = product.imageUrl ? getFullUrl(product.imageUrl) : "";
  const displayPrice = product.promoPrice ?? product.priceSell;
  const hasPromo =
    product.promoPrice != null && product.promoPrice < product.priceSell;
  const formattedPrice = formatPriceBr(displayPrice);
  const [integers, cents] = formattedPrice.split(",");
  const sizes = (product.sizesAvailable || []).slice(0, 6);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: theme.isLight
          ? "#FFFFFF"
          : "color-mix(in srgb, #272321 76%, transparent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 20,
        border: theme.isLight
          ? "1.5px solid #E5E1ED"
          : "1.5px solid color-mix(in srgb, #7C3AED 36%, transparent)",
        boxShadow: theme.isLight
          ? "0 12px 28px color-mix(in srgb, #272321 10%, transparent)"
          : "0 12px 32px color-mix(in srgb, #272321 55%, transparent)",
        animation: "vitrineFadeUp .5s ease both",
        animationDelay: `${delay}s`,
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Topo da Peça: Fundo de Estúdio */}
      <div
        style={{
          width: "100%",
          flex: "1 1 0",
          minHeight: 0,
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(8px, 1.2vw, 16px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {src ? (
          <img
            src={src}
            alt={product.productName}
            onLoad={() => setImgLoaded(true)}
            style={{
              maxHeight: "100%",
              maxWidth: "100%",
              objectFit: "contain",
              opacity: imgLoaded ? 1 : 0,
              transition: "opacity .3s ease",
              filter:
                "drop-shadow(0 4px 12px color-mix(in srgb, #272321 14%, transparent))",
            }}
          />
        ) : (
          <Layers size={38} style={{ color: "#665F70", opacity: 0.45 }} />
        )}

        {hasPromo && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "#7C3AED",
              color: "#FFFFFF",
              fontFamily: "'Inter', sans-serif",
              fontSize: "clamp(9px, 0.85vw, 12px)",
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 999,
              textTransform: "uppercase",
            }}
          >
            OFERTA
          </div>
        )}

        {sizes.length > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              display: "flex",
              justifyContent: "center",
              gap: 4,
              flexWrap: "wrap",
            }}
          >
            {sizes.map((sz) => (
              <span
                key={sz}
                style={{
                  background: "color-mix(in srgb, #272321 82%, transparent)",
                  color: "#FFFFFF",
                  fontSize: "clamp(8px, 0.75vw, 11px)",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 6,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {sz}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Divisória Luminosa */}
      <div
        style={{
          width: "100%",
          height: 2,
          background:
            "linear-gradient(to right, transparent, color-mix(in srgb, #7C3AED 70%, transparent), transparent)",
          flexShrink: 0,
        }}
      />

      {/* Base do Card: Nome e Preço */}
      <div
        style={{
          width: "100%",
          padding: "clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 16px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: theme.isLight
            ? "#F8F7FC"
            : "color-mix(in srgb, #272321 62%, transparent)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(11px, 1.2vw, 16px)",
            fontWeight: 700,
            textAlign: "center",
            color: theme.isLight ? "#272321" : "#FFFFFF",
            lineHeight: 1.2,
            marginBottom: "clamp(4px, 0.6vw, 8px)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.3em",
          }}
        >
          {formatProductTitle(product.productName)}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          {hasPromo && (
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(9px, 0.9vw, 12px)",
                fontWeight: 600,
                opacity: 0.65,
                textDecoration: "line-through",
                color: theme.isLight ? "#665F70" : "#E5E1ED",
                marginBottom: 2,
              }}
            >
              DE R$ {formatPriceBr(product.priceSell)}
            </div>
          )}

          <div
            style={{
              display: "inline-flex",
              alignItems: "flex-start",
              justifyContent: "center",
              background: theme.isLight
                ? "#F3E8FF"
                : "color-mix(in srgb, #7C3AED 22%, transparent)",
              border: "1px solid color-mix(in srgb, #7C3AED 45%, transparent)",
              borderRadius: 999,
              padding: "3px clamp(12px, 1.4vw, 20px)",
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(10px, 1.1vw, 15px)",
                fontWeight: 900,
                color: theme.isLight ? "#6D28D9" : "#F3E8FF",
                marginRight: 3,
                marginTop: "clamp(2px, 0.35vw, 5px)",
                lineHeight: 1,
              }}
            >
              R$
            </span>
            <span
              style={{
                fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                fontSize: "clamp(24px, 3.6vw, 46px)",
                color: theme.isLight ? "#7C3AED" : "#FFFFFF",
                lineHeight: 0.88,
                letterSpacing: "0.01em",
              }}
            >
              {integers}
            </span>
            <span
              style={{
                fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                fontSize: "clamp(13px, 1.8vw, 24px)",
                color: theme.isLight ? "#6D28D9" : "#F3E8FF",
                lineHeight: 0.88,
                marginTop: "clamp(2px, 0.3vw, 4px)",
                marginLeft: 1,
              }}
            >
              ,{cents || "00"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GridSlideView({
  slide,
  theme,
}: {
  slide: VitrineGridSlide;
  theme: VitrineThemeSpec;
}) {
  const count = slide.gridProducts.length;
  const cols = count <= 2 ? 2 : count <= 3 ? 3 : count <= 4 ? 2 : 3;
  const subtitle = slide.gridSubtitle || "• SELEÇÃO ESPECIAL •";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: "clamp(10px, 1.6vw, 24px)",
          animation: "vitrineFadeUp .45s ease both",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(9px, 1vw, 14px)",
            fontWeight: 800,
            letterSpacing: "0.28em",
            color: theme.accent,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {subtitle}
        </div>

        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: "clamp(28px, 4.6vw, 62px)",
            letterSpacing: "0.06em",
            color: theme.text,
            lineHeight: 0.96,
            textTransform: "uppercase",
          }}
        >
          {slide.gridTitle}
        </div>

        {slide.gridBadge && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#7C3AED",
              color: "#FFFFFF",
              fontSize: "clamp(9px, 0.9vw, 12px)",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              letterSpacing: "0.2em",
              padding: "4px 16px",
              borderRadius: 999,
              marginTop: 6,
              textTransform: "uppercase",
            }}
          >
            {slide.gridBadge}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "clamp(8px, 1.2vw, 18px)",
          alignContent: "stretch",
          minHeight: 0,
        }}
      >
        {slide.gridProducts.map((product, idx) => (
          <GridProductCard
            key={`${product.productId}-${idx}`}
            product={product}
            theme={theme}
            delay={idx * 0.06}
          />
        ))}
      </div>
    </div>
  );
}

function TabloidPriceDisplay({
  price,
  theme,
}: {
  price: number;
  theme: VitrineThemeSpec;
}) {
  const formatted = formatPriceBr(price);
  const [integers, cents] = formatted.split(",");

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "flex-start",
        justifyContent: "center",
        animation: "vitrineDropPrice .65s cubic-bezier(.34,1.56,.64,1) both",
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "clamp(18px, 2.8vw, 42px)",
          fontWeight: 900,
          color: theme.accent,
          marginRight: "clamp(4px, 0.5vw, 8px)",
          marginTop: "clamp(6px, 1.1vw, 18px)",
          lineHeight: 1,
        }}
      >
        R$
      </div>

      <div
        style={{
          fontFamily: "'Bebas Neue', 'Inter', sans-serif",
          fontSize: "clamp(72px, 12vw, 176px)",
          lineHeight: 0.85,
          color: theme.isLight ? "#7C3AED" : "#FFFFFF",
          letterSpacing: "-0.02em",
          textShadow: theme.isLight
            ? "0 6px 24px color-mix(in srgb, #7C3AED 22%, transparent)"
            : "0 0 36px color-mix(in srgb, #7C3AED 75%, transparent), 0 8px 28px color-mix(in srgb, #272321 90%, transparent)",
        }}
      >
        {integers}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          marginLeft: "clamp(2px, 0.3vw, 6px)",
          marginTop: "clamp(4px, 0.9vw, 14px)",
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: "clamp(34px, 5.8vw, 88px)",
            lineHeight: 0.85,
            color: theme.accent,
          }}
        >
          ,{cents || "00"}
        </div>
      </div>
    </div>
  );
}

/**
 * Palco visual reutilizável (usado tanto na TV em tela cheia quanto na Mini-TV de preview do painel).
 */
export function VitrineStageCanvas({
  data,
  slide,
  nextSlides = [],
  totalSlides = 1,
  currentDuration = 8,
  slidePhase = "visible",
  compactPreview = false,
  onClick,
}: {
  data: {
    storeName?: string;
    storeTagline?: string | null;
    theme: string;
    customBgUrl?: string | null;
    showLogo?: boolean;
    logoPosition?: string;
    logoUrl?: string | null;
    instagramHandle?: string | null;
  };
  slide: AnyVitrineSlide | null | undefined;
  nextSlides?: AnyVitrineSlide[];
  totalSlides?: number;
  currentDuration?: number;
  slidePhase?: "entering" | "visible" | "leaving";
  compactPreview?: boolean;
  onClick?: () => void;
}) {
  const theme = VITRINE_THEMES[data.theme] || VITRINE_THEMES.dark_premium;
  const isGridSlide = slide?.slideType === "grid";
  const singleSlide = isGridSlide ? null : (slide as VitrineSlide | undefined);
  const hasPromo =
    !isGridSlide &&
    singleSlide?.promoPrice != null &&
    singleSlide.promoPrice < singleSlide.priceSell;
  const discount =
    hasPromo && singleSlide
      ? Math.round((1 - singleSlide.promoPrice! / singleSlide.priceSell) * 100)
      : 0;

  const isEntering = slidePhase === "entering";
  const isLeaving = slidePhase === "leaving";
  const background = data.customBgUrl
    ? `url(${getFullUrl(data.customBgUrl)}) center/cover no-repeat`
    : theme.bg;

  const resolvedLogo = data.logoUrl ? getFullUrl(data.logoUrl) : "";
  const sizesList =
    singleSlide?.showSizes !== false
      ? (singleSlide?.sizesAvailable || []).slice(0, 8)
      : [];
  const colorsList =
    singleSlide?.showSizes !== false
      ? (singleSlide?.colorsAvailable || []).slice(0, 5)
      : [];

  return (
    <div
      onClick={onClick}
      style={{
        background,
        height: "100%",
        width: "100%",
        overflow: "hidden",
        fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
        color: theme.text,
        position: "relative",
        userSelect: "none",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800;900&display=swap');

        @keyframes vitrineFloatUp {
          0%   { transform: translateY(100%) scale(0.5); opacity: 0; }
          15%  { opacity: var(--op); }
          85%  { opacity: var(--op); }
          100% { transform: translateY(-20%) scale(1.15); opacity: 0; }
        }
        @keyframes vitrineProductFloat {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-12px); }
        }
        @keyframes vitrineBadgePop {
          0%   { transform: scale(0.6) rotate(-8deg); opacity: 0; }
          70%  { transform: scale(1.08) rotate(2deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes vitrineDropPrice {
          0%   { opacity: 0; transform: translateY(-28px) scale(1.12); }
          70%  { transform: translateY(4px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vitrineFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vitrineProgressFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>

      {data.customBgUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "color-mix(in srgb, #272321 42%, transparent)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Partículas luminosas sutis */}
      {!theme.isLight &&
        !compactPreview &&
        PARTICLES.map((p) => (
          <div
            key={p.id}
            style={
              {
                position: "absolute",
                left: `${p.x}%`,
                bottom: "-8px",
                width: `${p.size}px`,
                height: `${p.size}px`,
                borderRadius: "50%",
                background: theme.accent,
                "--op": p.opacity,
                opacity: p.opacity,
                animation: `vitrineFloatUp ${p.duration}s ${p.delay}s ease-in-out infinite`,
                pointerEvents: "none",
              } as React.CSSProperties
            }
          />
        ))}

      {/* Cabeçalho da Loja (Logo + Nome Fantasia) */}
      {data.showLogo !== false && (
        <div
          style={{
            position: "absolute",
            top: compactPreview ? 12 : 24,
            left: compactPreview ? 14 : 28,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: compactPreview ? 8 : 12,
            background: theme.isLight
              ? "color-mix(in srgb, #FFFFFF 86%, transparent)"
              : "color-mix(in srgb, #272321 62%, transparent)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: theme.isLight
              ? "1px solid #E5E1ED"
              : "1px solid color-mix(in srgb, #FFFFFF 16%, transparent)",
            padding: compactPreview ? "4px 10px" : "8px 16px",
            borderRadius: 999,
          }}
        >
          {resolvedLogo ? (
            <img
              src={resolvedLogo}
              alt={data.storeName || "Logo da loja"}
              style={{
                height: compactPreview ? 22 : 42,
                maxWidth: compactPreview ? 80 : 150,
                objectFit: "contain",
                borderRadius: 6,
              }}
            />
          ) : (
            <BrandWatermarkSvg size={compactPreview ? 20 : 32} />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: compactPreview ? 10 : 15,
                fontWeight: 800,
                color: theme.text,
                lineHeight: 1.1,
              }}
            >
              {data.storeName || "PDV Lojista"}
            </span>
            {data.storeTagline && (
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: compactPreview ? 8 : 11,
                  fontWeight: 600,
                  color: theme.isLight ? "#665F70" : "#F3E8FF",
                  letterSpacing: "0.04em",
                }}
              >
                {data.storeTagline}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Instagram da Loja */}
      {data.instagramHandle && (
        <div
          style={{
            position: "absolute",
            top: compactPreview ? 12 : 24,
            right:
              !isGridSlide && singleSlide?.badge
                ? compactPreview
                  ? 96
                  : 170
                : compactPreview
                  ? 14
                  : 28,
            zIndex: 22,
            display: "flex",
            alignItems: "center",
            gap: compactPreview ? 5 : 8,
            background: theme.isLight
              ? "color-mix(in srgb, #FFFFFF 88%, transparent)"
              : "color-mix(in srgb, #272321 62%, transparent)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: theme.isLight
              ? "1.5px solid #E5E1ED"
              : "1.5px solid color-mix(in srgb, #FFFFFF 18%, transparent)",
            borderRadius: 999,
            padding: compactPreview ? "3px 10px 3px 5px" : "6px 16px 6px 8px",
          }}
        >
          <InstagramSvgIcon size={compactPreview ? 15 : 24} />
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: compactPreview ? 9 : "clamp(12px, 1.3vw, 18px)",
              fontWeight: 800,
              color: theme.text,
            }}
          >
            {data.instagramHandle.startsWith("@")
              ? data.instagramHandle
              : `@${data.instagramHandle}`}
          </span>
        </div>
      )}

      {/* Selo Superior Direito — Slide Individual */}
      {!isGridSlide && singleSlide?.badge && (
        <div
          style={{
            position: "absolute",
            top: compactPreview ? 12 : 24,
            right: compactPreview ? 14 : 28,
            zIndex: 20,
            background: "#7C3AED",
            color: "#FFFFFF",
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: compactPreview ? 12 : "clamp(16px, 2vw, 28px)",
            letterSpacing: 2.5,
            padding: compactPreview ? "3px 10px" : "7px 22px",
            borderRadius: 999,
            boxShadow: "0 4px 24px color-mix(in srgb, #7C3AED 60%, transparent)",
            animation: "vitrineBadgePop .6s cubic-bezier(.34,1.56,.64,1) both",
          }}
        >
          {singleSlide.badge}
        </div>
      )}

      {/* Selo Circular de % OFF */}
      {!isGridSlide && hasPromo && discount >= 5 && (
        <div
          style={{
            position: "absolute",
            top: singleSlide?.badge
              ? compactPreview
                ? 42
                : 76
              : compactPreview
                ? 12
                : 24,
            right: compactPreview ? 14 : 28,
            zIndex: 20,
            width: compactPreview ? 42 : 76,
            height: compactPreview ? 42 : 76,
            borderRadius: "50%",
            background: "#6D28D9",
            border: "2px solid #F3E8FF",
            color: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            boxShadow: "0 4px 20px color-mix(in srgb, #7C3AED 65%, transparent)",
          }}
        >
          <div style={{ fontSize: compactPreview ? 15 : 28, lineHeight: 1 }}>
            -{discount}%
          </div>
          <div
            style={{
              fontSize: compactPreview ? 7 : 10,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            OFF
          </div>
        </div>
      )}

      {/* PALCO DO SLIDE */}
      {!slide ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: theme.isLight ? "#665F70" : "#F3E8FF",
          }}
        >
          <Tv2 size={compactPreview ? 32 : 56} />
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: compactPreview ? 12 : 18,
              fontWeight: 700,
            }}
          >
            Adicione peças ou crie uma grade promocional
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: isGridSlide ? "flex-start" : "center",
            padding: compactPreview
              ? isGridSlide
                ? "46px 16px 42px"
                : "44px 18px 42px"
              : isGridSlide
                ? "82px 48px 110px"
                : "86px 56px 126px",
            opacity: isEntering ? 0 : isLeaving ? 0 : 1,
            transform: isEntering
              ? "scale(1.03)"
              : isLeaving
                ? "scale(0.97)"
                : "scale(1)",
            transition:
              isEntering || isLeaving
                ? "opacity .65s ease, transform .65s ease"
                : "none",
          }}
        >
          {isGridSlide ? (
            <GridSlideView slide={slide as VitrineGridSlide} theme={theme} />
          ) : (
            singleSlide && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                }}
              >
                {/* Moldura da Foto da Peça */}
                <div
                  style={{
                    animation: compactPreview
                      ? "none"
                      : "vitrineProductFloat 5s ease-in-out infinite",
                    background: "#FFFFFF",
                    borderRadius: compactPreview ? 16 : 26,
                    border: theme.isLight
                      ? "2px solid #E5E1ED"
                      : "2px solid color-mix(in srgb, #7C3AED 45%, #FFFFFF)",
                    boxShadow: theme.isLight
                      ? "0 16px 40px color-mix(in srgb, #272321 12%, transparent)"
                      : "0 24px 64px color-mix(in srgb, #272321 65%, transparent), 0 0 42px color-mix(in srgb, #7C3AED 35%, transparent)",
                    padding: compactPreview ? "10px 18px" : "18px 32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    maxWidth: compactPreview ? "62%" : "58vw",
                    maxHeight: compactPreview ? "40%" : "36vh",
                    minWidth: compactPreview ? 96 : 210,
                    minHeight: compactPreview ? 72 : 140,
                  }}
                >
                  {singleSlide.imageUrl ? (
                    <img
                      src={getFullUrl(singleSlide.imageUrl)}
                      alt={singleSlide.productName}
                      style={{
                        maxHeight: compactPreview ? 96 : "calc(36vh - 36px)",
                        maxWidth: "100%",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <Sparkles
                      size={compactPreview ? 28 : 54}
                      style={{ color: "#7C3AED" }}
                    />
                  )}
                </div>

                {/* Categoria + Nome da Peça */}
                <div
                  style={{
                    textAlign: "center",
                    width: "100%",
                    marginTop: compactPreview ? 8 : 16,
                    marginBottom: compactPreview ? 4 : 8,
                  }}
                >
                  {singleSlide.categoryName && (
                    <div
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: compactPreview ? 8 : "clamp(10px, 1vw, 14px)",
                        fontWeight: 800,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: theme.accent,
                        marginBottom: 2,
                      }}
                    >
                      {singleSlide.categoryName}
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                      fontSize: compactPreview
                        ? "clamp(16px, 2.4vw, 24px)"
                        : (singleSlide.productName.length || 0) > 34
                          ? "clamp(28px, 4vw, 56px)"
                          : "clamp(34px, 5vw, 72px)",
                      lineHeight: 1.04,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      color: theme.text,
                    }}
                  >
                    {singleSlide.productName}
                  </div>
                </div>

                {/* Grade de Tamanhos e Cores Disponíveis (Exclusivo Lojista) */}
                {(sizesList.length > 0 || colorsList.length > 0) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexWrap: "wrap",
                      gap: compactPreview ? 4 : 8,
                      marginBottom: compactPreview ? 6 : 12,
                    }}
                  >
                    {sizesList.length > 0 && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: compactPreview ? 3 : 6,
                          background: theme.isLight
                            ? "#F3E8FF"
                            : "color-mix(in srgb, #272321 68%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, #7C3AED 45%, transparent)",
                          borderRadius: 999,
                          padding: compactPreview ? "2px 8px" : "5px 14px",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: compactPreview ? 7 : 11,
                            fontWeight: 800,
                            letterSpacing: "0.1em",
                            color: theme.isLight ? "#6D28D9" : "#F3E8FF",
                            textTransform: "uppercase",
                          }}
                        >
                          TAM:
                        </span>
                        {sizesList.map((sz) => (
                          <span
                            key={sz}
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontSize: compactPreview ? 8 : 13,
                              fontWeight: 900,
                              background: "#7C3AED",
                              color: "#FFFFFF",
                              padding: compactPreview ? "1px 5px" : "2px 8px",
                              borderRadius: 6,
                            }}
                          >
                            {sz}
                          </span>
                        ))}
                      </div>
                    )}

                    {colorsList.length > 0 && !compactPreview && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: theme.isLight
                            ? "#FFFFFF"
                            : "color-mix(in srgb, #272321 68%, transparent)",
                          border: theme.isLight
                            ? "1px solid #E5E1ED"
                            : "1px solid color-mix(in srgb, #FFFFFF 18%, transparent)",
                          borderRadius: 999,
                          padding: "5px 14px",
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          color: theme.text,
                        }}
                      >
                        <span>Cores: {colorsList.join(" • ")}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Preço Protagonista */}
                <div style={{ textAlign: "center" }}>
                  {hasPromo ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          background: theme.isLight
                            ? "#F3E8FF"
                            : "color-mix(in srgb, #7C3AED 22%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, #7C3AED 45%, transparent)",
                          color: theme.isLight ? "#6D28D9" : "#F3E8FF",
                          fontFamily: "'Inter', sans-serif",
                          fontSize: compactPreview
                            ? 9
                            : "clamp(11px, 1.3vw, 18px)",
                          fontWeight: 700,
                          padding: compactPreview ? "1px 8px" : "3px 16px",
                          borderRadius: 999,
                          marginBottom: compactPreview ? 2 : 4,
                        }}
                      >
                        <span style={{ textDecoration: "line-through" }}>
                          DE R$ {formatPriceBr(singleSlide.priceSell)}
                        </span>
                      </div>
                      {!compactPreview && (
                        <div
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "clamp(9px, 1vw, 14px)",
                            fontWeight: 900,
                            letterSpacing: 3.5,
                            color: theme.accent,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          • POR APENAS •
                        </div>
                      )}
                      {compactPreview ? (
                        <div
                          style={{
                            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                            fontSize: 28,
                            lineHeight: 1,
                            color: theme.isLight ? "#7C3AED" : "#FFFFFF",
                          }}
                        >
                          R$ {formatPriceBr(singleSlide.promoPrice!)}
                        </div>
                      ) : (
                        <TabloidPriceDisplay
                          price={singleSlide.promoPrice!}
                          theme={theme}
                        />
                      )}
                    </div>
                  ) : compactPreview ? (
                    <div
                      style={{
                        fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                        fontSize: 28,
                        lineHeight: 1,
                        color: theme.isLight ? "#7C3AED" : "#FFFFFF",
                      }}
                    >
                      R$ {formatPriceBr(singleSlide.priceSell)}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize: "clamp(9px, 1vw, 14px)",
                          fontWeight: 900,
                          letterSpacing: 3.5,
                          color: theme.accent,
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        • APENAS •
                      </div>
                      <TabloidPriceDisplay
                        price={singleSlide.priceSell}
                        theme={theme}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Trilho Inferior "A SEGUIR" (somente em tela cheia quando há mais slides) */}
      {!compactPreview && nextSlides.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 88,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 24px",
            background: theme.isLight
              ? "linear-gradient(to top, color-mix(in srgb, #F3E8FF 92%, transparent) 0%, transparent 100%)"
              : "linear-gradient(to top, color-mix(in srgb, #272321 82%, transparent) 0%, transparent 100%)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2.5,
              color: theme.accent,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              borderRight: "1px solid color-mix(in srgb, #7C3AED 35%, transparent)",
              paddingRight: 12,
              marginRight: 4,
            }}
          >
            A SEGUIR
          </div>

          {nextSlides.map((s, idx) => {
            const isGrid = s.slideType === "grid";
            const key = isGrid
              ? (s as VitrineGridSlide).gridId
              : `${(s as VitrineSlide).productId}-${idx}`;
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: theme.isLight
                    ? "#FFFFFF"
                    : "color-mix(in srgb, #FFFFFF 8%, transparent)",
                  border: theme.isLight
                    ? "1px solid #E5E1ED"
                    : "1px solid color-mix(in srgb, #FFFFFF 14%, transparent)",
                  borderRadius: 12,
                  padding: "5px 12px 5px 6px",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {!isGrid && (s as VitrineSlide).imageUrl ? (
                    <img
                      src={getFullUrl((s as VitrineSlide).imageUrl)}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <Layers size={18} style={{ color: "#7C3AED" }} />
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      color: theme.text,
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isGrid
                      ? (s as VitrineGridSlide).gridTitle
                      : formatProductTitle((s as VitrineSlide).productName)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                      fontSize: 15,
                      color: theme.accent,
                      lineHeight: 1.1,
                    }}
                  >
                    {isGrid
                      ? `${(s as VitrineGridSlide).gridProducts.length} peças`
                      : `R$ ${formatPriceBr((s as VitrineSlide).promoPrice ?? (s as VitrineSlide).priceSell)}`}
                  </div>
                </div>
              </div>
            );
          })}

          {totalSlides > 5 && (
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                color: theme.isLight ? "#665F70" : "#E5E1ED",
                whiteSpace: "nowrap",
              }}
            >
              +{totalSlides - 5} slides
            </div>
          )}
        </div>
      )}

      {/* Barra de Progresso Inferior */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: compactPreview ? 3 : 4,
          background: "color-mix(in srgb, #7C3AED 18%, transparent)",
          zIndex: 50,
        }}
      >
        {slidePhase === "visible" && slide && (
          <div
            style={{
              height: "100%",
              background: "linear-gradient(to right, #7C3AED, #6D28D9)",
              animation: `vitrineProgressFill ${currentDuration}s linear both`,
            }}
          />
        )}
      </div>

      {/* Assinatura Oficial PDV Lojista no Canto Inferior Direito */}
      <div
        style={{
          position: "absolute",
          bottom: compactPreview ? 8 : 16,
          right: compactPreview ? 10 : 24,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: compactPreview ? 5 : 8,
          background: theme.isLight
            ? "color-mix(in srgb, #FFFFFF 88%, transparent)"
            : "color-mix(in srgb, #272321 72%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: theme.isLight
            ? "1px solid #E5E1ED"
            : "1px solid color-mix(in srgb, #FFFFFF 16%, transparent)",
          borderRadius: 999,
          padding: compactPreview ? "3px 8px 3px 5px" : "6px 14px 6px 8px",
          pointerEvents: "none",
        }}
      >
        <BrandWatermarkSvg size={compactPreview ? 14 : 24} />
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: compactPreview ? 8 : 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: theme.text,
            textTransform: "uppercase",
          }}
        >
          PDV LOJISTA
        </span>
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const POLL_INTERVAL = 30_000;

export function RetailVitrineTvPage() {
  const { tvPublicId } = useParams<{ tvPublicId: string }>();

  const [data, setData] = useState<VitrinePublicData | null>(null);
  const [inactive, setInactive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slidePhase, setSlidePhase] = useState<
    "entering" | "visible" | "leaving"
  >("entering");
  const [error, setError] = useState(false);

  const versionRef = useRef<number>(-1);
  const etagRef = useRef<string>("");
  const slidesRef = useRef<AnyVitrineSlide[]>([]);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlaylist = useCallback(
    async (isFirstLoad = false) => {
      if (!tvPublicId) return;
      try {
        const headers: Record<string, string> = {};
        if (!isFirstLoad && etagRef.current) {
          headers["If-None-Match"] = etagRef.current;
        }
        const res = await fetch(`${API_BASE}/vitrine/public/${tvPublicId}`, {
          headers,
        });
        if (res.status === 304) return;
        if (res.status === 404) {
          setError(true);
          return;
        }
        const json = await res.json();
        if (!json.active) {
          setInactive(true);
          setData(json);
          return;
        }
        const newEtag = res.headers.get("etag") || `"v${json.version}"`;
        etagRef.current = newEtag;
        if (json.version !== versionRef.current || isFirstLoad) {
          versionRef.current = json.version;
          const sorted = [...(json.slides || [])].sort(
            (a, b) => (a.order || 0) - (b.order || 0),
          );
          slidesRef.current = sorted;
          setData(json);
          setInactive(false);
          setError(false);
          if (isFirstLoad) {
            setCurrentIndex(0);
            setSlidePhase("entering");
          }
        }
      } catch {
        if (isFirstLoad) setError(true);
      }
    },
    [tvPublicId],
  );

  useEffect(() => {
    fetchPlaylist(true);
    pollTimerRef.current = setInterval(
      () => fetchPlaylist(false),
      POLL_INTERVAL,
    );
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, [fetchPlaylist]);

  useEffect(() => {
    if (!data?.slides?.length) return;
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);

    const allSlides =
      slidesRef.current.length > 0 ? slidesRef.current : data.slides;
    const currentSlide =
      allSlides[currentIndex % Math.max(1, allSlides.length)];
    const isGrid = currentSlide?.slideType === "grid";
    const customDuration = (currentSlide as any)?.duration;
    const duration =
      (customDuration ||
        (isGrid ? data.gridSlideDuration || 15 : data.slideDuration || 8)) *
      1000;
    const ENTER = 650;
    const LEAVE = 550;

    if (slidePhase === "entering") {
      phaseTimerRef.current = setTimeout(() => setSlidePhase("visible"), ENTER);
    } else if (slidePhase === "visible") {
      phaseTimerRef.current = setTimeout(
        () => setSlidePhase("leaving"),
        Math.max(1500, duration - ENTER - LEAVE),
      );
    } else if (slidePhase === "leaving") {
      phaseTimerRef.current = setTimeout(() => {
        const slides =
          slidesRef.current.length > 0 ? slidesRef.current : data.slides;
        setCurrentIndex((prev) => (prev + 1) % Math.max(1, slides.length));
        setSlidePhase("entering");
      }, LEAVE);
    }
  }, [slidePhase, data, currentIndex]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  if (error) {
    return (
      <div
        style={{
          background: "#272321",
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "#FFFFFF",
          gap: 12,
        }}
      >
        <Tv2 size={56} style={{ color: "#7C3AED" }} />
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          Vitrine Digital não encontrada
        </div>
        <div style={{ fontSize: 13, color: "#E5E1ED" }}>
          Confira o código da TV ({tvPublicId}) no painel administrativo da loja.
        </div>
      </div>
    );
  }

  if (inactive || !data || !data.slides?.length) {
    return (
      <div
        onClick={handleToggleFullscreen}
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, #7C3AED 28%, #272321) 0%, #272321 75%)",
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          cursor: "pointer",
          color: "#FFFFFF",
          fontFamily: "'Inter', system-ui, sans-serif",
          gap: 14,
        }}
      >
        <BrandWatermarkSvg size={56} />
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {data?.storeName || "PDV Lojista"}
        </div>
        <div
          style={{
            color: "#F3E8FF",
            fontSize: 13,
            letterSpacing: 3,
            fontWeight: 700,
            textTransform: "uppercase",
            background: "color-mix(in srgb, #7C3AED 25%, transparent)",
            border: "1px solid color-mix(in srgb, #7C3AED 45%, transparent)",
            padding: "6px 18px",
            borderRadius: 999,
          }}
        >
          {inactive ? "Vitrine em Espera" : "Sincronizando Programação..."}
        </div>
      </div>
    );
  }

  const slides = slidesRef.current.length > 0 ? slidesRef.current : data.slides;
  const activeSlide = slides[currentIndex % slides.length];
  const isGridSlide = activeSlide?.slideType === "grid";
  const nextSlides = slides
    .filter((_, i) => i !== currentIndex % slides.length)
    .slice(0, 4);
  const currentDuration =
    (activeSlide as any)?.duration ||
    (isGridSlide ? data.gridSlideDuration || 15 : data.slideDuration || 8);

  return (
    <div style={{ width: "100vw", height: "100dvh", position: "relative" }}>
      <VitrineStageCanvas
        data={data}
        slide={activeSlide}
        nextSlides={nextSlides}
        totalSlides={slides.length}
        currentDuration={currentDuration}
        slidePhase={slidePhase}
        onClick={handleToggleFullscreen}
      />
      <button
        type="button"
        onClick={handleToggleFullscreen}
        title="Alternar tela cheia"
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          zIndex: 70,
          background: "color-mix(in srgb, #272321 55%, transparent)",
          border: "1px solid color-mix(in srgb, #FFFFFF 15%, transparent)",
          color: "#FFFFFF",
          borderRadius: 999,
          padding: "6px 10px",
          opacity: 0.35,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
        }}
      >
        <Maximize2 size={13} />
      </button>
    </div>
  );
}

export default RetailVitrineTvPage;
