import React, { memo, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  Monitor,
  Store,
  Eye,
  EyeOff,
} from "lucide-react";
import PdvLojistaLoader from "@/components/PdvLojistaLoader";

export interface RetailMobileLoginProps {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  busy: boolean;
  error: string;
  helperNotice: string;
  setHelperNotice: (value: string) => void;
  demoPulse: boolean;
  onFillDemoStore: () => void;
  onAuthenticate: () => Promise<{ targetPath: string; userEmail: string } | null>;
  onNavigateTarget: (targetPath: string) => void;
}

/**
 * Assinatura compacta oficial da marca no canto superior direito do mobile
 * (inspirada no posicionamento superior direito do vídeo de referência,
 * utilizando o símbolo oficial L + fachada de loja e tipografia PDV lojista).
 */
const MobileBrandMark = memo(function MobileBrandMark({
  onClick,
  actionLabel,
}: {
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <button
      type="button"
      className="retail-mlogin-brand"
      onClick={onClick}
      aria-label={actionLabel || "PDV Lojista"}
    >
      <span
        className="retail-mlogin-brand-icon"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "-5px -3px -5px -5px",
        }}
      >
        <PdvLojistaLoader mode="loader" size={24} compact />
      </span>
      <span className="retail-mlogin-brand-text">
        <strong>pdv</strong> lojista
      </span>
    </button>
  );
});

/**
 * Slide 1 — Mosaico Bento do Comércio Local (Replicando o grid 6-8 blocos do vídeo 00:00–00:02.7,
 * incluindo as micro-animações contínuas dos balões de atendimento e da chave seletora).
 */
const BentoMosaicIllustration = memo(function BentoMosaicIllustration() {
  return (
    <div className="retail-mlogin-illustration-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 280 246"
        fill="none"
        className="retail-mlogin-svg is-bento"
      >
        {/* 1. Pílula vertical esquerda — Alerta / Etiqueta de Giro */}
        <g className="retail-mlogin-bento-cell is-c1">
          <rect
            x="4"
            y="4"
            width="28"
            height="74"
            rx="6"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <rect x="15.5" y="15" width="5" height="34" rx="2" fill="#7C3AED" />
          <circle cx="18" cy="58" r="3" fill="#272321" />
        </g>

        {/* 2. Card superior central — Lojista / Atendimento Principal */}
        <g className="retail-mlogin-bento-cell is-c2">
          <clipPath id="mloginBentoTopCenter">
            <rect x="40" y="4" width="144" height="74" rx="6" />
          </clipPath>
          <rect
            x="40"
            y="4"
            width="144"
            height="74"
            rx="6"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <g clipPath="url(#mloginBentoTopCenter)">
            {/* Silhueta de ombros e avental de loja com padronagem */}
            <path
              d="M54 78 C58 50, 74 42, 112 42 C150 42, 166 50, 170 78 Z"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <path
              d="M78 78 L94 42 L130 42 L146 78 Z"
              fill="#6D28D9"
              stroke="#272321"
              strokeWidth="1.4"
            />
            {/* Estampa de poá da peça */}
            <circle cx="96" cy="54" r="2.6" fill="#F3E8FF" />
            <circle cx="112" cy="50" r="2.6" fill="#F3E8FF" />
            <circle cx="126" cy="56" r="2.6" fill="#F3E8FF" />
            <circle cx="89" cy="66" r="2.6" fill="#F3E8FF" />
            <circle cx="105" cy="63" r="2.6" fill="#F3E8FF" />
            <circle cx="119" cy="67" r="2.6" fill="#F3E8FF" />
            <circle cx="134" cy="69" r="2.6" fill="#F3E8FF" />
            <circle cx="98" cy="74" r="2.4" fill="#F3E8FF" />
            <circle cx="114" cy="75" r="2.4" fill="#F3E8FF" />
            {/* Pescoço e rosto estilizado */}
            <rect
              x="105"
              y="26"
              width="14"
              height="18"
              rx="6"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <path
              d="M103 22 C103 31, 121 31, 121 22 Z"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            {/* Cabelo ondulado editorial */}
            <path
              d="M64 12 C70 22, 82 22, 88 14 C94 22, 106 22, 112 14 C118 22, 130 22, 136 14 C142 22, 154 22, 160 12 L160 4 L64 4 Z"
              fill="#272321"
            />
          </g>
          <rect
            x="40"
            y="4"
            width="144"
            height="74"
            rx="6"
            stroke="#272321"
            strokeWidth="1.4"
          />
        </g>

        {/* 3. Card superior direito — Atendente com peça listrada */}
        <g className="retail-mlogin-bento-cell is-c3">
          <clipPath id="mloginBentoTopRight">
            <rect x="192" y="4" width="84" height="74" rx="6" />
          </clipPath>
          <rect
            x="192"
            y="4"
            width="84"
            height="74"
            rx="6"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <g clipPath="url(#mloginBentoTopRight)">
            {/* Camiseta listrada em diagonal */}
            <path
              d="M204 78 L204 54 C204 44, 214 40, 232 40 L264 40 C272 40, 276 46, 276 56 L276 78 Z"
              fill="#272321"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <path
              d="M206 58 L226 40 M210 74 L244 40 M228 76 L262 40 M246 78 L276 48 M264 78 L278 64"
              stroke="#FFFFFF"
              strokeWidth="4.2"
              strokeLinecap="square"
            />
            {/* Pescoço, perfil e boné lojista */}
            <path
              d="M242 22 C242 17, 254 17, 254 24 L254 42 L242 42 Z"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <path
              d="M236 18 C242 12, 254 13, 256 20 Z"
              fill="#272321"
            />
            <line
              x1="232"
              y1="19"
              x2="244"
              y2="19"
              stroke="#272321"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
          <rect
            x="192"
            y="4"
            width="84"
            height="74"
            rx="6"
            stroke="#272321"
            strokeWidth="1.4"
          />
        </g>

        {/* 4. Card médio esquerdo — Ícone de Destaque / Vitrine */}
        <g className="retail-mlogin-bento-cell is-c4">
          <rect
            x="4"
            y="86"
            width="54"
            height="74"
            rx="6"
            fill="#272321"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <circle
            cx="31"
            cy="116"
            r="17"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <path
            d="M27 128 L35 128 L34 136 L28 136 Z"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.2"
          />
          <path
            d="M31 116 L31 131 M27 118 Q31 122 35 118"
            stroke="#7C3AED"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect
            x="24"
            y="138"
            width="14"
            height="6"
            rx="3"
            fill="#F3E8FF"
          />
        </g>

        {/* 5. Card médio central — Balões de Atendimento Animados (trocam de posição como no vídeo!) */}
        <g className="retail-mlogin-bento-cell is-c5">
          <rect
            x="66"
            y="86"
            width="118"
            height="74"
            rx="6"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.4"
          />
          {/* Balão Roxo Secundário */}
          <g className="retail-mlogin-chat-back">
            <path
              d="M104 108 H166 V136 H120 L108 147 V136 H104 Z"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </g>
          {/* Balão Escuro Principal com 3 pontos */}
          <g className="retail-mlogin-chat-front">
            <path
              d="M80 96 H144 V125 H96 L84 136 V125 H80 Z"
              fill="#272321"
              stroke="#272321"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <circle cx="99" cy="110.5" r="3.2" fill="#FFFFFF" />
            <circle cx="112" cy="110.5" r="3.2" fill="#FFFFFF" />
            <circle cx="125" cy="110.5" r="3.2" fill="#FFFFFF" />
          </g>
        </g>

        {/* 6. Card médio/inferior direito — Comprovante / Ficha de Grade */}
        <g className="retail-mlogin-bento-cell is-c6">
          <rect
            x="192"
            y="86"
            width="84"
            height="118"
            rx="6"
            fill="#272321"
            stroke="#272321"
            strokeWidth="1.4"
          />
          {/* Sombra deslocada roxa da folha */}
          <path
            d="M202 114 H248 L254 186 L202 182 Z"
            fill="#7C3AED"
          />
          {/* Folha branca com canto dobrado */}
          <g className="retail-mlogin-doc-sheet">
            <path
              d="M210 105 H254 L264 115 V176 H210 Z"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path
              d="M254 105 V115 H264 Z"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <line
              x1="219"
              y1="126"
              x2="236"
              y2="126"
              stroke="#6D28D9"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line
              x1="219"
              y1="138"
              x2="254"
              y2="138"
              stroke="#272321"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="219"
              y1="146"
              x2="254"
              y2="146"
              stroke="#272321"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="219"
              y1="154"
              x2="254"
              y2="154"
              stroke="#272321"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="219"
              y1="162"
              x2="246"
              y2="162"
              stroke="#665F70"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* 7. Card inferior esquerdo — Equipe e Estampas da Loja */}
        <g className="retail-mlogin-bento-cell is-c7">
          <clipPath id="mloginBentoBottomLeft">
            <rect x="4" y="168" width="180" height="74" rx="6" />
          </clipPath>
          <rect
            x="4"
            y="168"
            width="180"
            height="74"
            rx="6"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <g clipPath="url(#mloginBentoBottomLeft)">
            {/* Cabelo simétrico estilizado */}
            <rect x="56" y="176" width="76" height="10" rx="5" fill="#272321" />
            <rect x="46" y="185" width="96" height="12" rx="6" fill="#272321" />
            {/* Rosto/pescoço */}
            <path
              d="M86 184 L94 176 L102 184 L98 190 L98 206 L90 206 L90 190 Z"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.3"
            />
            {/* Blusa estampada da loja */}
            <path
              d="M22 242 C24 212, 42 204, 68 204 C78 210, 110 210, 120 204 C146 204, 164 212, 166 242 Z"
              fill="#272321"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <path
              d="M68 204 C78 211, 110 211, 120 204"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.3"
            />
            {/* Traços brancos da estampa */}
            <path
              d="M38 218 L44 214 M54 214 L60 218 M74 218 L82 215 M96 218 L104 214 M118 216 L125 220 M138 214 L145 218 M32 230 L40 228 M50 228 L56 234 M68 228 L76 226 M88 228 L94 233 M108 227 L116 225 M128 230 L135 226 M146 228 L154 232 M44 238 L52 237 M80 237 L88 239 M116 237 L124 239"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
          <rect
            x="4"
            y="168"
            width="180"
            height="74"
            rx="6"
            stroke="#272321"
            strokeWidth="1.4"
          />
        </g>

        {/* 8. Card inferior direito — Chave Seletora Animada (desliza igual ao vídeo!) */}
        <g className="retail-mlogin-bento-cell is-c8">
          <rect
            x="192"
            y="212"
            width="84"
            height="30"
            rx="6"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <circle
            cx="244"
            cy="227"
            r="9.5"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          <circle
            className="retail-mlogin-bento-knob"
            cx="224"
            cy="227"
            r="9.5"
            fill="#272321"
          />
        </g>
      </svg>
    </div>
  );
});

/**
 * Slide 2 — Gestão de Grades e Equipe (Replicando a ilustração arquitetônica
 * em degraus do vídeo em 00:03.3–00:04.8 na paleta roxa e branca).
 */
const GradeTeamIllustration = memo(function GradeTeamIllustration() {
  return (
    <div className="retail-mlogin-illustration-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 280 246"
        fill="none"
        className="retail-mlogin-svg is-team"
      >
        <defs>
          <clipPath id="mloginWheelClip">
            <path d="M164 14 A56 56 0 0 0 164 126 Z" />
          </clipPath>
        </defs>

        {/* Fundo suave circular */}
        <circle cx="152" cy="116" r="76" fill="#F8F7FC" />

        {/* Semicírculo quadriculado (grade da loja) */}
        <g className="retail-mlogin-float-slow">
          <path d="M164 14 A56 56 0 0 0 164 126 Z" fill="#7C3AED" />
          <g clipPath="url(#mloginWheelClip)" stroke="#FFFFFF" strokeWidth="1.2">
            <line x1="100" y1="20" x2="170" y2="90" />
            <line x1="100" y1="36" x2="170" y2="106" />
            <line x1="100" y1="52" x2="170" y2="122" />
            <line x1="100" y1="68" x2="170" y2="138" />
            <line x1="116" y1="10" x2="170" y2="64" />
            <line x1="132" y1="10" x2="170" y2="48" />
            <line x1="170" y1="20" x2="100" y2="90" />
            <line x1="170" y1="36" x2="100" y2="106" />
            <line x1="170" y1="52" x2="100" y2="122" />
            <line x1="170" y1="68" x2="100" y2="138" />
            <line x1="154" y1="10" x2="100" y2="64" />
          </g>
          {/* Barra horizontal de equilíbrio + esfera */}
          <rect x="64" y="68" width="68" height="14" rx="2" fill="#F3E8FF" stroke="#272321" strokeWidth="1.2" />
          <circle cx="70" cy="60" r="6" fill="#FFFFFF" stroke="#272321" strokeWidth="1.3" />
        </g>

        {/* Pedestal direito e rampa geométrica */}
        <rect x="166" y="152" width="68" height="84" fill="#6D28D9" />
        <polygon points="116,236 234,152 234,236" fill="#7C3AED" />
        <rect x="52" y="212" width="64" height="24" fill="#F3E8FF" stroke="#272321" strokeWidth="1.2" />

        {/* Personagem superior direito organizando a grade */}
        <g>
          {/* Casaco longo estampado em lilás */}
          <path
            d="M196 64 L228 136 L174 136 L186 64 Z"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          <path
            d="M192 84 L196 80 M204 92 L208 88 M188 106 L193 102 M206 112 L212 108 M184 124 L190 122 M202 126 L208 124 M216 122 L220 118"
            stroke="#7C3AED"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Calçado sobre o pedestal */}
          <path d="M168 152 L182 136 L198 136 L198 152 Z" fill="#272321" />
          <path d="M202 152 L216 136 L232 136 L232 152 Z" fill="#272321" />
          {/* Braços segurando a roda de grade */}
          <path
            d="M164 40 L204 60 C212 64, 212 78, 200 78 L164 78"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          {/* Cabeça e coque */}
          <circle cx="198" cy="48" r="5" fill="#FFFFFF" stroke="#272321" strokeWidth="1.3" />
          <path d="M202 43 C206 34, 214 36, 210 44 Z" fill="#272321" />
        </g>

        {/* Caixa de mercadoria flutuante no centro */}
        <rect
          x="128"
          y="128"
          width="28"
          height="28"
          rx="3"
          fill="#F3E8FF"
          stroke="#7C3AED"
          strokeWidth="1.4"
          className="retail-mlogin-float-fast"
        />

        {/* Personagem inferior esquerdo conferindo caixas */}
        <g>
          {/* Calçado esquerdo */}
          <path d="M38 192 L50 192 L50 230 L38 230 Z" fill="#272321" />
          {/* Calça com textura geométrica */}
          <path
            d="M50 194 L86 156 C92 150, 102 154, 106 164 L120 198 C124 206, 118 212, 108 212 L50 212 Z"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          <path
            d="M62 204 Q72 192 84 204 M76 184 Q88 174 98 188 M90 168 Q100 162 108 176"
            stroke="#7C3AED"
            strokeWidth="1.3"
            fill="none"
          />
          {/* Blusa roxa */}
          <path
            d="M64 166 C60 152, 72 142, 88 142 L112 142 L126 162 L140 148 L148 156 L126 178 L98 160 L82 178 L96 192 L88 200 Z"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Cabeça e cabelo */}
          <circle cx="92" cy="134" r="4.5" fill="#FFFFFF" stroke="#272321" strokeWidth="1.3" />
          <circle cx="76" cy="122" r="8" fill="#272321" />
          <path d="M82 126 L90 132" stroke="#272321" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
});

/**
 * Slide 3 — Trocas, Crédito e Caixa por PIN (Completando o 3º ponto do carrossel
 * com a fachada da loja, etiqueta de tamanho/cor e crédito do cliente).
 */
const StorefrontPosIllustration = memo(function StorefrontPosIllustration() {
  return (
    <div className="retail-mlogin-illustration-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 280 246"
        fill="none"
        className="retail-mlogin-svg is-pos"
      >
        <circle cx="140" cy="122" r="82" fill="#F8F7FC" />

        {/* Fachada Lojista Estilizada */}
        <g className="retail-mlogin-float-slow">
          <rect
            x="56"
            y="64"
            width="168"
            height="126"
            rx="10"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.5"
          />
          {/* Toldo Roxo Listrado */}
          <path
            d="M48 64 L60 38 H220 L232 64 Z"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M48 64 C48 76, 78 76, 78 64 C78 76, 108 76, 108 64 C108 76, 138 76, 138 64 C138 76, 168 76, 168 64 C168 76, 198 76, 198 64 C198 76, 232 76, 232 64 Z"
            fill="#6D28D9"
            stroke="#272321"
            strokeWidth="1.4"
          />
          {/* Vitrine de Peças P / M / G */}
          <rect
            x="72"
            y="88"
            width="84"
            height="68"
            rx="6"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.4"
          />
          {/* Camiseta em exposição na vitrine */}
          <path
            d="M98 102 L106 96 H122 L130 102 L124 112 L120 109 V142 H108 V109 L104 112 Z"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Pílulas P M G */}
          <rect x="80" y="138" width="16" height="11" rx="3" fill="#FFFFFF" stroke="#272321" strokeWidth="1.1" />
          <rect x="100" y="138" width="16" height="11" rx="3" fill="#272321" />
          <rect x="120" y="138" width="16" height="11" rx="3" fill="#FFFFFF" stroke="#272321" strokeWidth="1.1" />

          {/* Porta da Loja */}
          <rect
            x="168"
            y="88"
            width="40"
            height="102"
            rx="4"
            fill="#272321"
          />
          <rect x="174" y="96" width="28" height="44" rx="3" fill="#7C3AED" />
          <circle cx="201" cy="148" r="2.5" fill="#F3E8FF" />
        </g>

        {/* Crachá Flutuante de Crédito / Troca */}
        <g className="retail-mlogin-float-fast">
          <rect
            x="28"
            y="148"
            width="92"
            height="54"
            rx="8"
            fill="#272321"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <circle cx="50" cy="175" r="12" fill="#7C3AED" />
          <path
            d="M45 175 L49 179 L56 171"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="68" y="165" width="38" height="6" rx="3" fill="#FFFFFF" />
          <rect x="68" y="177" width="26" height="6" rx="3" fill="#F3E8FF" />
        </g>

        {/* Linha de base */}
        <line x1="20" y1="212" x2="260" y2="212" stroke="#272321" strokeWidth="1.5" />
      </svg>
    </div>
  );
});

/**
 * Ilustração Hero da Tela "Entrar." (Replicando fielmente a cena do celular direito
 * em 00:04.2–00:09.4: personagem subindo a rampa listrada roxa, segurando o envelope
 * de credencial da loja e erguendo o quadro roxo de confirmação ao lado do título).
 */
const MobileLoginHeroIllustration = memo(function MobileLoginHeroIllustration() {
  return (
    <div className="retail-mlogin-login-art" aria-hidden="true">
      <svg
        viewBox="0 0 300 226"
        fill="none"
        className="retail-mlogin-svg is-login-hero"
      >
        {/* Silhueta orgânica suave ao fundo Esquerdo */}
        <path
          d="M24 38 H108 C108 66, 86 78, 86 102 C86 124, 106 138, 106 164 C106 190, 82 214, 82 214 H24 C24 214, 48 188, 48 162 C48 136, 28 124, 28 100 C28 76, 24 62, 24 38 Z"
          fill="#F8F7FC"
        />

        {/* Quadro Roxo de Checkmark Erguido no Topo Direito */}
        <g className="retail-mlogin-check-badge">
          <rect
            x="166"
            y="4"
            width="44"
            height="44"
            rx="2"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <path
            d="M176 26 L184 34 L200 17"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Mão segurando a base do quadro */}
          <path
            d="M182 48 V39 C182 36, 187 36, 187 39 V48 H194 C194 44, 190 43, 187 43"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          <rect
            x="179"
            y="46"
            width="16"
            height="8"
            rx="2"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.3"
          />
        </g>

        {/* Rampa Geométrica Listrada Roxa no Canto Inferior Direito */}
        <g>
          <polygon points="188,218 244,162 244,218" fill="#7C3AED" />
          <path
            d="M198 218 L244 172 M210 218 L244 184 M222 218 L244 196 M234 218 L244 208"
            stroke="#FFFFFF"
            strokeWidth="1.4"
          />
        </g>

        {/* Pernas e Calçados caminhando para a rampa */}
        <g>
          {/* Perna traseira subindo a rampa */}
          <path
            d="M168 134 L224 168 L206 184 L152 148 Z"
            fill="#7C3AED"
          />
          {/* Sapato na rampa */}
          <path
            d="M214 176 L232 160 L242 166 L222 188 Z"
            fill="#272321"
          />
          {/* Perna dianteira firme na base */}
          <path
            d="M106 154 L136 154 L126 202 L96 202 Z"
            fill="#7C3AED"
          />
          {/* Sapato na base */}
          <path
            d="M94 200 H122 L134 218 H90 Z"
            fill="#272321"
          />
          <circle cx="122" cy="206" r="2.2" fill="#FFFFFF" />
          <circle cx="127" cy="206" r="2.2" fill="#FFFFFF" />
        </g>

        {/* Cabelo e Rosto do Personagem */}
        <path
          d="M84 82 C82 68, 128 56, 138 64 C144 68, 146 78, 146 86 Z"
          fill="#272321"
        />
        <path
          d="M130 68 C136 68, 138 76, 134 80"
          stroke="#F3E8FF"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Envelope Grande de Credencial da Loja nos Braços */}
        <g className="retail-mlogin-envelope-group">
          {/* Camada traseira de profundidade do envelope */}
          <rect
            x="76"
            y="102"
            width="124"
            height="74"
            rx="6"
            transform="rotate(-8 138 139)"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.4"
          />
          {/* Frente do envelope em lilás de apoio */}
          <rect
            x="66"
            y="96"
            width="124"
            height="74"
            rx="6"
            transform="rotate(-8 128 133)"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.4"
          />
          {/* Dobras do envelope */}
          <path
            d="M64 106 L130 144 L184 90"
            stroke="#272321"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M74 174 L118 137 M142 135 L192 158"
            stroke="#272321"
            strokeWidth="1.3"
          />
        </g>

        {/* Casaco branco com estampa tracejada abraçando o envelope + erguendo o quadro */}
        <g>
          <path
            d="M100 84 C122 76, 156 80, 178 78 L178 54 L196 54 L196 86 C196 96, 184 102, 166 102 L124 100 C112 100, 106 112, 110 124 L120 132 L106 144 C88 136, 82 108, 100 84 Z"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Traços da estampa do casaco */}
          <path
            d="M108 92 L114 89 M126 88 L132 92 M146 88 L152 86 M166 88 L172 92 M186 64 L190 60 M184 76 L190 74 M186 88 L190 84 M96 104 L102 100 M94 116 L100 118 M98 128 L104 126"
            stroke="#272321"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Mão esquerda segurando o envelope */}
          <path
            d="M114 128 L128 132 L124 146 L110 140 Z"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </g>

        {/* Detalhes Botânicos / Vaso Minimalista na Linha de Base */}
        <g>
          {/* Vaso esquerdo */}
          <path
            d="M42 192 H56 L54 198 C62 202, 62 216, 49 218 C36 216, 36 202, 44 198 Z"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          <path
            d="M49 192 V146 M49 176 L38 162 M49 166 L58 154"
            stroke="#272321"
            strokeWidth="1.2"
          />
          <polygon points="49,142 43,136 55,136" fill="#7C3AED" />
          <polygon points="36,159 30,154 41,153" fill="#7C3AED" />
          <polygon points="60,151 55,145 65,146" fill="#7C3AED" />

          {/* Broto central */}
          <path
            d="M156 218 V188 M156 206 L146 196 M156 202 L166 194"
            stroke="#272321"
            strokeWidth="1.2"
          />
          <polygon points="156,184 151,179 161,179" fill="#7C3AED" />
          <polygon points="144,194 139,190 148,189" fill="#7C3AED" />
          <polygon points="168,192 163,187 172,188" fill="#7C3AED" />
        </g>

        {/* Linha de chão contínua */}
        <line
          x1="14"
          y1="218"
          x2="286"
          y2="218"
          stroke="#272321"
          strokeWidth="1.4"
        />
      </svg>
    </div>
  );
});

/**
 * Ilustração Hero da Tela "Acesso Liberado!" / "Sucesso!" (Replicando fielmente
 * o frame 12.2s do vídeo na paleta oficial roxo e branco).
 */
const MobileSuccessHeroIllustration = memo(function MobileSuccessHeroIllustration() {
  return (
    <div className="retail-mlogin-success-art" aria-hidden="true">
      <svg
        viewBox="0 0 300 210"
        fill="none"
        className="retail-mlogin-svg is-success-hero"
      >
        {/* Partículas decorativas sutis */}
        <circle cx="96" cy="24" r="4" fill="#F3E8FF" />
        <circle cx="144" cy="26" r="7" stroke="#E5E1ED" strokeWidth="1.3" />
        <circle cx="268" cy="64" r="4" fill="#F3E8FF" />
        <circle cx="42" cy="112" r="3" fill="#F3E8FF" />
        <path
          d="M214 10 V18 M210 14 H218 M54 88 V96 M50 92 H58 M262 152 V160 M258 156 H266"
          stroke="#E5E1ED"
          strokeWidth="1.3"
          strokeLinecap="round"
        />

        {/* Barra deslizante inclinada superior */}
        <g transform="rotate(9 112 74)">
          <rect
            x="56"
            y="64"
            width="110"
            height="20"
            rx="3"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          <polygon points="65,70 65,78 72,74" fill="#FFFFFF" />
          <rect
            x="78"
            y="70"
            width="72"
            height="8"
            rx="4"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.1"
          />
          <circle
            cx="144"
            cy="74"
            r="6.5"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.3"
          />
        </g>

        {/* Círculo escuro com sinal "+" acima da barra */}
        <circle cx="158" cy="54" r="11" fill="#272321" />
        <path
          d="M158 49 V59 M153 54 H163"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Quadro de Foto de Produto Inclinado à Esquerda */}
        <g transform="rotate(18 58 156)">
          <rect
            x="34"
            y="132"
            width="48"
            height="48"
            rx="2"
            fill="#FFFFFF"
            stroke="#272321"
            strokeWidth="1.3"
          />
          <rect
            x="40"
            y="138"
            width="36"
            height="36"
            fill="#272321"
          />
          <polygon points="40,174 54,150 66,174" fill="#FFFFFF" />
          <polygon points="56,174 66,158 76,174" fill="#F3E8FF" />
          <circle cx="65" cy="146" r="3" fill="#FFFFFF" />
        </g>

        {/* Arco Curvo Azul/Lilás na Base */}
        <path
          d="M84 156 C106 156, 122 170, 126 190 H110 C106 176, 96 168, 84 168 Z"
          fill="#F3E8FF"
          stroke="#272321"
          strokeWidth="1.3"
        />
        <circle cx="95" cy="164" r="3" fill="#272321" />

        {/* Círculo com Mini-Janela do Sistema */}
        <circle cx="188" cy="168" r="21" fill="#F3E8FF" />
        <rect
          x="174"
          y="157"
          width="28"
          height="22"
          rx="2"
          fill="#FFFFFF"
          stroke="#272321"
          strokeWidth="1.2"
        />
        <rect x="174" y="157" width="28" height="5" fill="#272321" />
        <rect
          x="177"
          y="165"
          width="8"
          height="11"
          fill="#7C3AED"
          stroke="#272321"
          strokeWidth="1"
        />
        <line x1="188" y1="167" x2="198" y2="167" stroke="#272321" strokeWidth="1.2" />
        <line x1="188" y1="171" x2="198" y2="171" stroke="#272321" strokeWidth="1.2" />
        <line x1="188" y1="175" x2="195" y2="175" stroke="#665F70" strokeWidth="1.2" />

        {/* Triângulo Escuro Direito com Lâmpada Roxa e Estrela */}
        <polygon
          points="190,144 256,126 238,190"
          fill="#272321"
          stroke="#272321"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle cx="228" cy="150" r="14" fill="#7C3AED" />
        <circle cx="223" cy="145" r="3.5" fill="#F3E8FF" />
        <rect
          x="224"
          y="162"
          width="8"
          height="6"
          rx="1.5"
          fill="#F3E8FF"
        />
        {/* Estrela de 5 pontas acima do triângulo */}
        <polygon
          points="240,94 244,103 254,104 246,110 248,120 240,115 232,120 234,110 226,104 236,103"
          fill="#F3E8FF"
          stroke="#272321"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Grande Checkmark Roxo Principal Apoiado na Linha */}
        <path
          d="M78 126 L108 96 L140 128 L228 40 L258 70 L140 190 Z"
          fill="#7C3AED"
          stroke="#272321"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Linha horizontal de base */}
        <line
          x1="28"
          y1="190"
          x2="272"
          y2="190"
          stroke="#272321"
          strokeWidth="1.3"
        />
      </svg>
    </div>
  );
});

const ONBOARDING_SLIDES = [
  {
    id: "mosaic",
    title: "Abra o Balcão e\nVenda Agora.",
    description:
      "Atenda clientes, organize grades por tamanho e cor e acompanhe o ritmo do seu comércio local com agilidade.",
    Illustration: BentoMosaicIllustration,
  },
  {
    id: "grades",
    title: "Controle Grades\ncom Facilidade.",
    description:
      "Consulte peças por numeração e cor, registre trocas de mercadoria e emita crédito na loja sem esforço.",
    Illustration: GradeTeamIllustration,
  },
  {
    id: "pos",
    title: "Caixa por PIN e\nGiro Seguro.",
    description:
      "Cada atendente acessa o caixa rápido com seu PIN individual e todo o movimento fica protegido.",
    Illustration: StorefrontPosIllustration,
  },
] as const;

type MobileFlowStage =
  | "onboarding"
  | "login"
  | "expanding"
  | "spinning"
  | "revealing"
  | "success";

export function RetailMobileLogin({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  busy,
  error,
  helperNotice,
  setHelperNotice,
  demoPulse,
  onFillDemoStore,
  onAuthenticate,
  onNavigateTarget,
}: RetailMobileLoginProps) {
  const [stage, setStage] = useState<MobileFlowStage>("onboarding");
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");
  const [authResult, setAuthResult] = useState<{
    targetPath: string;
    userEmail: string;
  } | null>(null);

  const touchStartX = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  function clearAllTimers() {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  function scheduleTimer(fn: () => void, delayMs: number) {
    const id = window.setTimeout(fn, delayMs);
    timersRef.current.push(id);
    return id;
  }

  function handleNextOnboarding() {
    setSlideDirection("next");
    if (slideIndex < ONBOARDING_SLIDES.length - 1) {
      setSlideIndex((prev) => prev + 1);
    } else {
      setStage("login");
    }
  }

  function handleBackButton() {
    if (stage === "success") {
      clearAllTimers();
      setStage("login");
      return;
    }
    if (stage === "login") {
      setSlideDirection("prev");
      setStage("onboarding");
      return;
    }
    if (stage === "onboarding") {
      if (slideIndex > 0) {
        setSlideDirection("prev");
        setSlideIndex((prev) => prev - 1);
      } else {
        setStage("login");
      }
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 44) return;

    if (deltaX < 0) {
      handleNextOnboarding();
    } else if (deltaX > 0 && slideIndex > 0) {
      setSlideDirection("prev");
      setSlideIndex((prev) => prev - 1);
    }
  }

  async function handleMobileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || stage === "expanding" || stage === "spinning") return;

    clearAllTimers();
    // Fase 1 (9.6s–9.9s do vídeo): O botão ENTRAR se expande preenchendo a tela em roxo
    setStage("expanding");

    const spinTimer = scheduleTimer(() => {
      setStage("spinning");
    }, 280);

    const startedAt = performance.now();
    const res = await onAuthenticate();

    if (!res) {
      window.clearTimeout(spinTimer);
      clearAllTimers();
      setStage("login");
      return;
    }

    setAuthResult(res);
    const elapsed = performance.now() - startedAt;
    const remainingSpin = Math.max(820 - elapsed, 360);

    // Fase 2 -> 3 (10.3s–11.5s do vídeo): Arco fecha em círculo branco e abre revelando a tela branca
    scheduleTimer(() => {
      setStage("revealing");
      scheduleTimer(() => {
        setStage("success");
      }, 460);
    }, remainingSpin);
  }

  function handleProceed() {
    clearAllTimers();
    onNavigateTarget(authResult?.targetPath || "/");
  }

  const CurrentSlide = ONBOARDING_SLIDES[slideIndex];

  return (
    <main
      className={`retail-mlogin is-stage-${stage}`}
      aria-label="Acesso móvel PDV Lojista"
    >
      {/* Mosaico geométrico externo (visível em molduras mobile/tablet até 768px) */}
      <div className="retail-mlogin-ambient" aria-hidden="true">
        <div className="retail-mlogin-ambient-tile is-t1" />
        <div className="retail-mlogin-ambient-tile is-t2" />
        <div className="retail-mlogin-ambient-tile is-t3" />
        <div className="retail-mlogin-ambient-tile is-t4" />
      </div>

      <div className="retail-mlogin-phone">
        {/* Recorte diagonal/curvo suave de fundo idêntico ao vídeo */}
        <div className="retail-mlogin-bg-sweep" aria-hidden="true" />

        {/* Barra de Topo: Seta Voltar à esquerda e Assinatura PDV lojista à direita */}
        <header className="retail-mlogin-topbar">
          <button
            type="button"
            className="retail-mlogin-back-btn"
            onClick={handleBackButton}
            aria-label={
              stage === "onboarding" && slideIndex === 0
                ? "Ir para tela de login"
                : "Voltar"
            }
          >
            <ChevronLeft size={20} strokeWidth={2.3} />
          </button>

          {stage !== "success" && (
            <MobileBrandMark
              onClick={() =>
                setStage((prev) =>
                  prev === "onboarding" ? "login" : "onboarding",
                )
              }
              actionLabel={
                stage === "onboarding"
                  ? "Ir direto para Entrar"
                  : "Ver apresentação"
              }
            />
          )}
        </header>

        {/* TELA 1: CARROSSEL DE APRESENTAÇÃO MOBILE (00:00–00:03.3 do vídeo) */}
        {stage === "onboarding" && (
          <section
            className="retail-mlogin-screen is-onboarding"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label="Apresentação do sistema"
          >
            <div
              key={CurrentSlide.id}
              className={`retail-mlogin-slide is-${slideDirection}`}
            >
              <CurrentSlide.Illustration />

              <div className="retail-mlogin-copy">
                <h1>
                  {CurrentSlide.title.split("\n").map((line, i) => (
                    <React.Fragment key={line}>
                      {i > 0 && <br />}
                      {line}
                    </React.Fragment>
                  ))}
                </h1>
                <p>{CurrentSlide.description}</p>
              </div>
            </div>

            <footer className="retail-mlogin-onboard-foot">
              <div className="retail-mlogin-dots-wrap">
                <div
                  className="retail-mlogin-dots"
                  role="tablist"
                  aria-label="Etapas de introdução"
                >
                  {ONBOARDING_SLIDES.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={slideIndex === idx}
                      aria-label={`Slide ${idx + 1}`}
                      className={`retail-mlogin-dot ${slideIndex === idx ? "is-active" : ""}`}
                      onClick={() => {
                        setSlideDirection(idx > slideIndex ? "next" : "prev");
                        setSlideIndex(idx);
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="retail-mlogin-skip-link"
                  onClick={() => setStage("login")}
                >
                  Entrar direto
                </button>
              </div>

              <div className="retail-mlogin-next-halo">
                <button
                  type="button"
                  className="retail-mlogin-next-btn"
                  onClick={handleNextOnboarding}
                  aria-label={
                    slideIndex < ONBOARDING_SLIDES.length - 1
                      ? "Próximo slide"
                      : "Abrir tela de login"
                  }
                >
                  <ChevronRight size={22} strokeWidth={2.5} />
                </button>
              </div>
            </footer>
          </section>
        )}

        {/* TELA 2: FORMULÁRIO "Entrar." (00:03.3–00:09.6 do vídeo) */}
        {(stage === "login" ||
          stage === "expanding" ||
          stage === "spinning") && (
          <section
            className="retail-mlogin-screen is-login-form"
            aria-label="Formulário de acesso à loja"
            aria-busy={busy || stage !== "login"}
          >
            <div className="retail-mlogin-heading-row">
              <h1>Entrar.</h1>
            </div>

            <MobileLoginHeroIllustration />

            <form
              className="retail-mlogin-form"
              onSubmit={handleMobileSubmit}
              autoComplete="off"
            >
              <label
                className={`retail-mlogin-field ${demoPulse ? "is-autofilled" : ""}`}
              >
                <span className="retail-mlogin-label">E-mail</span>
                <div className="retail-mlogin-input-box">
                  <input
                    type="email"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy || stage !== "login"}
                    placeholder="atendimento@seucomercio.com.br"
                  />
                  <span className="retail-mlogin-input-icon" aria-hidden="true">
                    <Mail size={16} strokeWidth={1.9} />
                  </span>
                </div>
              </label>

              <label
                className={`retail-mlogin-field ${demoPulse ? "is-autofilled" : ""}`}
              >
                <span className="retail-mlogin-label">Senha</span>
                <div className="retail-mlogin-input-box">
                  <input
                    type="text"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy || stage !== "login"}
                    placeholder="••••••••••••"
                    className={showPassword ? undefined : "pdv-secret-input"}
                  />
                  <button
                    type="button"
                    className="retail-mlogin-lock-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={1.9} />
                    ) : (
                      <Lock size={16} strokeWidth={1.9} />
                    )}
                  </button>
                </div>
              </label>

              {error && (
                <p className="retail-mlogin-alert" role="alert">
                  {error}
                </p>
              )}

              {helperNotice && !error && (
                <p className="retail-mlogin-alert is-helper" role="status">
                  {helperNotice}
                </p>
              )}

              <button
                type="submit"
                className={`retail-mlogin-submit ${demoPulse ? "is-invited" : ""}`}
                disabled={busy || stage !== "login"}
              >
                <span>ENTRAR</span>
              </button>

              <div className="retail-mlogin-aux">
                <button
                  type="button"
                  className="retail-mlogin-forgot"
                  onClick={() =>
                    setHelperNotice(
                      "Solicite a redefinição de senha ao responsável da loja ou à administração.",
                    )
                  }
                >
                  Esqueceu sua senha?
                </button>

                <div className="retail-mlogin-quick-row">
                  <button
                    type="button"
                    className="retail-mlogin-chip"
                    onClick={onFillDemoStore}
                    disabled={busy || stage !== "login"}
                  >
                    <Store size={13} />
                    <span>Loja Demonstração</span>
                  </button>
                  <button
                    type="button"
                    className="retail-mlogin-chip"
                    onClick={() =>
                      setHelperNotice(
                        "Após entrar com o e-mail da loja, cada atendente opera o caixa com seu PIN individual.",
                      )
                    }
                    disabled={busy || stage !== "login"}
                  >
                    <Monitor size={13} />
                    <span>Caixa por PIN</span>
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        {/* TELA 3: CONFIRMAÇÃO "Acesso Liberado!" (00:11.7–00:13.3 do vídeo) */}
        {stage === "success" && (
          <section
            className="retail-mlogin-screen is-success"
            aria-label="Acesso confirmado"
          >
            <h1 className="retail-mlogin-success-title">Acesso Liberado!</h1>

            <MobileSuccessHeroIllustration />

            <div className="retail-mlogin-success-copy">
              <p>Conectamos seu terminal ao balcão de</p>
              <strong>
                {authResult?.userEmail || email || "demo@lojista.local"}
              </strong>
            </div>

            <button
              type="button"
              className="retail-mlogin-submit is-proceed"
              onClick={handleProceed}
            >
              <span>ABRIR BALCÃO</span>
            </button>
          </section>
        )}

        {/* CAMADA DE TRANSIÇÃO DO VÍDEO (Expansão do Botão -> Arco Giratório -> Revelação Circular) */}
        {(stage === "expanding" ||
          stage === "spinning" ||
          stage === "revealing") && (
          <div
            className={`retail-mlogin-Portal is-${stage}`}
            role="status"
            aria-live="polite"
            aria-label="Autenticando acesso à loja"
          >
            {stage === "expanding" && (
              <span className="retail-mlogin-portal-label">ENTRAR</span>
            )}

            {stage === "spinning" && (
              <PdvLojistaLoader mode="loader" size={88} />
            )}

            {stage === "revealing" && (
              <div className="retail-mlogin-iris-wrap">
                <div className="retail-mlogin-iris-white" />
                <div className="retail-mlogin-iris-dot" />
              </div>
            )}
          </div>
        )}

        {/* Barra indicadora inferior estilo mobile nativo do vídeo */}
        <div className="retail-mlogin-homebar" aria-hidden="true" />
      </div>
    </main>
  );
}
export default RetailMobileLogin;
