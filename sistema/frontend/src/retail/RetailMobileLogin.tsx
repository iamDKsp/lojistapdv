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
 * Slide 4 — Módulo Loja Virtual (Ilustração editorial exclusiva seguindo a mesma
 * direção de arte arquitetônica dos slides 1–3: criação do catálogo online /loja/sua-loja,
 * chave de publicação animada, grade P/M/G sincronizada em tempo real, sacola com
 * reserva automática de estoque e disparo de pedido via WhatsApp).
 */
const VirtualStoreModuleIllustration = memo(
  function VirtualStoreModuleIllustration() {
    return (
      <div className="retail-mlogin-illustration-wrap" aria-hidden="true">
        <svg
          viewBox="0 0 280 246"
          fill="none"
          className="retail-mlogin-svg is-virtual-store"
        >
          {/* Aura circular suave de fundo + partículas editoriais */}
          <circle cx="142" cy="120" r="84" fill="#F8F7FC" />
          <circle cx="42" cy="30" r="4" fill="#F3E8FF" />
          <circle cx="246" cy="118" r="5" stroke="#E5E1ED" strokeWidth="1.4" />
          <path
            d="M236 22 V30 M232 26 H240 M32 126 V134 M28 130 H36"
            stroke="#7C3AED"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Pedestal e rampa arquitetônica listrada à direita (assinatura visual do login) */}
          <rect
            x="178"
            y="156"
            width="68"
            height="64"
            rx="4"
            fill="#6D28D9"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <polygon
            points="136,220 246,156 246,220"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M156 220 L246 168 M178 220 L246 180 M200 220 L246 193 M222 220 L246 206"
            stroke="#FFFFFF"
            strokeWidth="1.3"
          />

          {/* Moldura Central do Smartphone / Vitrine Online (/loja/sua-loja) */}
          <g className="retail-mlogin-float-slow">
            {/* Sombra sólida deslocada da vitrine mobile */}
            <rect
              x="80"
              y="22"
              width="128"
              height="186"
              rx="14"
              fill="#272321"
            />
            {/* Corpo do aparelho / navegador da Loja Virtual */}
            <rect
              x="74"
              y="16"
              width="128"
              height="186"
              rx="14"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.5"
            />

            {/* Barra de endereço da Loja Virtual (/loja/sua-marca) */}
            <rect
              x="84"
              y="26"
              width="108"
              height="16"
              rx="5"
              fill="#F3E8FF"
              stroke="#272321"
              strokeWidth="1.2"
            />
            <circle
              cx="93"
              cy="34"
              r="3.2"
              fill="#7C3AED"
              className="retail-mlogin-vstore-pulse"
            />
            <line
              x1="101"
              y1="34"
              x2="152"
              y2="34"
              stroke="#272321"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <rect
              x="160"
              y="30"
              width="26"
              height="8"
              rx="4"
              fill="#7C3AED"
            />

            {/* Toldo Digital Listrado na Vitrine do Celular */}
            <path
              d="M78 48 L86 39 H190 L198 48 Z"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path
              d="M78 48 C78 56, 98 56, 98 48 C98 56, 118 56, 118 48 C118 56, 138 56, 138 48 C138 56, 158 56, 158 48 C158 56, 178 56, 178 48 C178 56, 198 56, 198 48 Z"
              fill="#6D28D9"
              stroke="#272321"
              strokeWidth="1.3"
            />

            {/* Card de Produto Destaque da Coleção Online */}
            <rect
              x="86"
              y="60"
              width="104"
              height="96"
              rx="8"
              fill="#F8F7FC"
              stroke="#272321"
              strokeWidth="1.3"
            />
            {/* Etiqueta de Preço no Canto do Card */}
            <rect
              x="148"
              y="66"
              width="36"
              height="13"
              rx="4"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.1"
            />
            <line
              x1="154"
              y1="72.5"
              x2="178"
              y2="72.5"
              stroke="#7C3AED"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Cabide e Peça Editorial na Vitrine Digital */}
            <path
              d="M138 69 C138 66, 141 66, 141 68 C141 70, 138 71, 138 73 M126 77 L138 72 L150 77"
              stroke="#272321"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M116 82 L126 76 H150 L160 82 L153 94 L147 90 V122 H129 V90 L123 94 Z"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            {/* Detalhes de estampa na peça */}
            <circle cx="134" cy="92" r="2" fill="#F3E8FF" />
            <circle cx="143" cy="96" r="2" fill="#F3E8FF" />
            <circle cx="135" cy="104" r="2" fill="#F3E8FF" />
            <circle cx="142" cy="110" r="2" fill="#F3E8FF" />

            {/* Pílulas de Grade em Tempo Real (P / M / G) com Seleção Animada */}
            <g transform="translate(94, 130)">
              <rect
                x="0"
                y="0"
                width="24"
                height="16"
                rx="4"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1.2"
              />
              <text
                x="12"
                y="11.5"
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="800"
                fill="#272321"
              >
                P
              </text>

              <g className="retail-mlogin-vstore-size">
                <rect
                  x="32"
                  y="0"
                  width="24"
                  height="16"
                  rx="4"
                  fill="#7C3AED"
                  stroke="#272321"
                  strokeWidth="1.2"
                />
                <text
                  x="44"
                  y="11.5"
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="800"
                  fill="#FFFFFF"
                >
                  M
                </text>
              </g>

              <rect
                x="64"
                y="0"
                width="24"
                height="16"
                rx="4"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1.2"
              />
              <text
                x="76"
                y="11.5"
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="800"
                fill="#272321"
              >
                G
              </text>
            </g>

            {/* Botão "Pedir no WhatsApp / Reservar Grade" dentro da Vitrine */}
            <g className="retail-mlogin-vstore-cta">
              <rect
                x="86"
                y="164"
                width="104"
                height="24"
                rx="6"
                fill="#272321"
              />
              <circle cx="100" cy="176" r="6" fill="#7C3AED" />
              <path
                d="M97.5 176 L99.5 178 L103 174"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="112"
                y="173"
                width="54"
                height="6"
                rx="3"
                fill="#FFFFFF"
              />
              <circle cx="178" cy="176" r="3" fill="#F3E8FF" />
            </g>
          </g>

          {/* CARD FLUTUANTE ESQUERDO SUPERIOR — Construtor / Publicação em 1 Clique */}
          <g className="retail-mlogin-vstore-builder">
            <rect
              x="12"
              y="40"
              width="82"
              height="64"
              rx="8"
              fill="#F3E8FF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            {/* Barra de topo do construtor */}
            <rect
              x="20"
              y="48"
              width="42"
              height="6"
              rx="3"
              fill="#272321"
            />
            {/* Paleta de personalização da marca */}
            <circle
              cx="26"
              cy="65"
              r="5.5"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.2"
            />
            <circle
              cx="41"
              cy="65"
              r="5.5"
              fill="#6D28D9"
              stroke="#272321"
              strokeWidth="1.2"
            />
            <circle
              cx="56"
              cy="65"
              r="5.5"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.2"
            />
            {/* Chave Seletora Animada "LOJA NO AR" */}
            <rect
              x="20"
              y="78"
              width="66"
              height="18"
              rx="9"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.3"
            />
            <circle
              cx="62"
              cy="87"
              r="5.5"
              fill="#F3E8FF"
              stroke="#272321"
              strokeWidth="1.1"
            />
            <circle
              className="retail-mlogin-bento-knob"
              cx="42"
              cy="87"
              r="6"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.2"
            />
          </g>

          {/* CARD FLUTUANTE DIREITO SUPERIOR — Sacola + Reserva de Estoque */}
          <g className="retail-mlogin-float-fast">
            <rect
              x="188"
              y="34"
              width="78"
              height="74"
              rx="9"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.4"
            />
            {/* Sacola de Compras Editorial */}
            <path
              d="M216 58 V52 C216 46, 238 46, 238 52 V58"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M208 56 H246 L249 88 H205 Z"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* Símbolo L oficial na sacola */}
            <path d="M221 64 H225 V75 H234 V79 H221 Z" fill="#7C3AED" />
            {/* Selo +1 Peça Reservada */}
            <circle
              cx="248"
              cy="54"
              r="10"
              fill="#272321"
              stroke="#FFFFFF"
              strokeWidth="1.4"
            />
            <text
              x="248"
              y="57.5"
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="800"
              fill="#FFFFFF"
            >
              +1
            </text>
            <rect
              x="202"
              y="94"
              width="50"
              height="6"
              rx="3"
              fill="#F3E8FF"
            />
          </g>

          {/* CARD FLUTUANTE INFERIOR ESQUERDO — Pedido Recebido no WhatsApp + Reserva */}
          <g className="retail-mlogin-vstore-order">
            <path
              d="M14 148 H134 C138.4 148, 142 151.6, 142 156 V194 C142 198.4, 138.4 202, 134 202 H42 L26 213 V202 H14 C9.6 202, 6 198.4, 6 194 V156 C6 151.6, 9.6 148, 14 148 Z"
              fill="#272321"
              stroke="#272321"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle cx="30" cy="175" r="13" fill="#7C3AED" />
            <path
              d="M24.5 175 L28.5 179 L36 171"
              stroke="#FFFFFF"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="50"
              y="161"
              width="52"
              height="10"
              rx="3"
              fill="#7C3AED"
            />
            <text
              x="76"
              y="168.5"
              textAnchor="middle"
              fontSize="6.8"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.4"
            >
              RESERVADO
            </text>
            <rect x="50" y="176" width="76" height="6" rx="3" fill="#FFFFFF" />
            <rect x="50" y="186" width="54" height="5" rx="2.5" fill="#F3E8FF" />
          </g>

          {/* Linha de base arquitetônica */}
          <line
            x1="16"
            y1="220"
            x2="264"
            y2="220"
            stroke="#272321"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    );
  },
);

const DELIVERY_ONBOARDING_STAGES = [
  {
    index: 0,
    shortLabel: "1. Aceito",
    title: "Sistema encontrou motorista",
    badge: "ETAPA 1 • CHAMADO ACEITO",
    sub: "Vinculado ao Pedido Nº 4092",
    bubble: "Chamado aceito! • Nº 4092",
    targetZoom: 1.12,
    focusX: 332,
    focusY: 236,
    parallaxSpeed: 0,
  },
  {
    index: 1,
    shortLabel: "2. Indo à loja",
    title: "Motorista vai até a loja",
    badge: "ETAPA 2 • EM DESLOCAMENTO",
    sub: "Indo coletar na loja",
    bubble: "Indo buscar na loja PDV »",
    targetZoom: 1.34,
    focusX: 345,
    focusY: 248,
    parallaxSpeed: 1.0,
  },
  {
    index: 2,
    shortLabel: "3. Coleta",
    title: "Motorista pegou o pacote",
    badge: "ETAPA 3 • COLETADO NA LOJA",
    sub: "Pacote Nº 4092 na bag ✓",
    bubble: "Pacote Nº 4092 coletado!",
    targetZoom: 1.08,
    focusX: 365,
    focusY: 222,
    parallaxSpeed: 0,
  },
  {
    index: 3,
    shortLabel: "4. Em rota",
    title: "Motorista está chegando",
    badge: "ETAPA 4 • RUMO AO CLIENTE",
    sub: "Rastreio ao vivo »",
    bubble: "Levando pacote Nº 4092 »",
    targetZoom: 1.4,
    focusX: 345,
    focusY: 248,
    parallaxSpeed: 1.35,
  },
  {
    index: 4,
    shortLabel: "5. Entregue",
    title: "Motorista entregou o pacote",
    badge: "ETAPA 5 • ENTREGA CONCLUÍDA",
    sub: "Recebido pelo cliente ✓",
    bubble: "Pacote entregue em casa ✓",
    targetZoom: 1.08,
    focusX: 375,
    focusY: 222,
    parallaxSpeed: 0,
  },
] as const;

/**
 * Slide 5 — Módulo Entrega em Casa (Reutilizando a animação 2D com câmera de zoom
 * e parallax infinito do motoboy: 1. Encontrou motorista -> 2. Indo à loja ->
 * 3. Coletou pacote na loja PDV Lojista -> 4. Em rota -> 5. Entregou na casa do cliente).
 */
const HomeDeliveryMotoboyIllustration = memo(
  function HomeDeliveryMotoboyIllustration() {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const controlRef = useRef<{
      goToStep: (idx: number, manual?: boolean) => void;
    } | null>(null);

    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;

      const q = <T extends Element = SVGElement>(sel: string) =>
        svg.querySelector<T>(sel);

      const el = {
        cameraRig: q("#mloginMotoCameraRig"),
        parallaxClouds: q("#mloginParallaxClouds"),
        parallaxSkyline: q("#mloginParallaxSkyline"),
        parallaxMidground: q("#mloginParallaxMidground"),
        parallaxRoad: q("#mloginParallaxRoad"),
        startTotemGroup: q("#mloginStartTotemGroup"),
        totemWave1: q("#mloginTotemWave1"),
        totemWave2: q("#mloginTotemWave2"),
        storeWorldGroup: q("#mloginStoreWorldGroup"),
        storeAwning0: q("#mloginStoreAwning0"),
        storeAwning1: q("#mloginStoreAwning1"),
        storeAwning2: q("#mloginStoreAwning2"),
        storeCounterPkg: q("#mloginStoreCounterPkg"),
        storeScannerLine: q("#mloginStoreScannerLine"),
        clientWorldGroup: q("#mloginClientWorldGroup"),
        clientConfirmWave: q("#mloginClientConfirmWave"),
        clientDeliveredPkg: q("#mloginClientDeliveredPkg"),
        clientCheckBadge: q("#mloginClientCheckBadge"),
        clientConfetti: q("#mloginClientConfetti"),
        speedWindGroup: q("#mloginSpeedWindGroup"),
        windLine1: q("#mloginWindLine1"),
        windLine2: q("#mloginWindLine2"),
        puffCircle1: q("#mloginPuffCircle1"),
        motoSuspension: q("#mloginMotoSuspension"),
        headlightCone: q("#mloginHeadlightCone"),
        wheelBackSpokes: q("#mloginWheelBackSpokes"),
        wheelFrontSpokes: q("#mloginWheelFrontSpokes"),
        scarfWavePath: q("#mloginScarfWavePath"),
        bagBodyRect: q("#mloginBagBodyRect"),
        bagLogoL: q("#mloginBagLogoL"),
        bagActiveDot: q("#mloginBagActiveDot"),
        bagLidHinge: q("#mloginBagLidHinge"),
        parabolicPkgNode: q("#mloginParabolicPkgNode"),
        heroSpeechBubble: q("#mloginHeroSpeechBubble"),
        heroBubbleBg: q("#mloginHeroBubbleBg"),
        heroBubbleText: q("#mloginHeroBubbleText"),
        stageTopBadge: q("#mloginStageTopBadge"),
        stageTopTitle: q("#mloginStageTopTitle"),
        stageTopSub: q("#mloginStageTopSub"),
      };

      const state = {
        stepIndex: 0,
        stepElapsed: 0,
        autoCycle: true,
        stepDuration: 3.4,
        lastTime: performance.now(),
        camZoom: 1.12,
        camX: 332,
        camY: 236,
        currentSpeed: 0,
        wheelAngle: 0,
        scrollClouds: 0,
        scrollSkyline: 0,
        scrollMid: 0,
        scrollRoad: 0,
        totemX: 255,
        storeX: 920,
        clientX: 920,
      };

      const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));
      const norm = (v: number, a: number, b: number) =>
        clamp((v - a) / (b - a), 0, 1);
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
      const easeInOutCubic = (x: number) =>
        x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      const easeOutBack = (x: number, overshoot = 1.45) => {
        const c1 = overshoot;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };

      function goToStep(newIndex: number, manual = false) {
        state.stepIndex = newIndex;
        state.stepElapsed = 0;
        if (manual) {
          state.stepDuration = 4.6;
        }

        if (newIndex === 0) {
          state.totemX = 255;
          state.storeX = 920;
          state.clientX = 920;
        } else if (newIndex === 1) {
          state.storeX = 920;
          state.clientX = 920;
        } else if (newIndex === 2) {
          state.storeX = 640;
          state.clientX = 920;
        } else if (newIndex === 3) {
          state.clientX = 920;
        } else if (newIndex === 4) {
          state.storeX = -500;
          state.clientX = 660;
        }

        const info = DELIVERY_ONBOARDING_STAGES[newIndex];
        if (el.stageTopBadge) el.stageTopBadge.textContent = info.badge;
        if (el.stageTopTitle) el.stageTopTitle.textContent = info.title;
        if (el.stageTopSub) el.stageTopSub.textContent = info.sub;
        if (el.heroBubbleText) el.heroBubbleText.textContent = info.bubble;
        setActiveStep(newIndex);
      }

      controlRef.current = { goToStep };
      goToStep(0);

      let rafId = 0;

      function tick(now: number) {
        const dt = Math.min(0.06, (now - state.lastTime) / 1000);
        state.lastTime = now;
        const nowSec = now / 1000;

        state.stepElapsed += dt;

        if (state.autoCycle && state.stepElapsed >= state.stepDuration) {
          goToStep((state.stepIndex + 1) % 5);
        }

        const idx = state.stepIndex;
        const t = state.stepElapsed;
        const stageCfg = DELIVERY_ONBOARDING_STAGES[idx];

        const camSmooth = Math.min(1, dt * 4.2);
        state.camZoom = lerp(state.camZoom, stageCfg.targetZoom, camSmooth);
        state.camX = lerp(state.camX, stageCfg.focusX, camSmooth);
        state.camY = lerp(state.camY, stageCfg.focusY, camSmooth);

        const cx = 230 - state.camX * state.camZoom;
        const cy = 224 - state.camY * state.camZoom;
        el.cameraRig?.setAttribute(
          "transform",
          `translate(${cx.toFixed(2)},${cy.toFixed(2)}) scale(${state.camZoom.toFixed(3)})`,
        );

        let targetSpeed: number = stageCfg.parallaxSpeed;
        if (idx === 2 && t < 0.75) {
          targetSpeed = (1 - easeOutCubic(t / 0.75)) * 0.85;
        } else if (idx === 4 && t < 0.75) {
          targetSpeed = (1 - easeOutCubic(t / 0.75)) * 0.95;
        }

        state.currentSpeed = lerp(
          state.currentSpeed,
          targetSpeed,
          Math.min(1, dt * 5),
        );

        state.scrollClouds =
          (state.scrollClouds + dt * (12 + state.currentSpeed * 28)) % 760;
        state.scrollSkyline =
          (state.scrollSkyline + dt * state.currentSpeed * 95) % 760;
        state.scrollMid =
          (state.scrollMid + dt * state.currentSpeed * 240) % 760;
        state.scrollRoad =
          (state.scrollRoad + dt * state.currentSpeed * 480) % 760;

        el.parallaxClouds?.setAttribute(
          "transform",
          `translate(${(-state.scrollClouds).toFixed(1)}, 0)`,
        );
        el.parallaxSkyline?.setAttribute(
          "transform",
          `translate(${(-state.scrollSkyline).toFixed(1)}, 0)`,
        );
        el.parallaxMidground?.setAttribute(
          "transform",
          `translate(${(-state.scrollMid).toFixed(1)}, 0)`,
        );
        el.parallaxRoad?.setAttribute(
          "transform",
          `translate(${(-state.scrollRoad).toFixed(1)}, 0)`,
        );

        if (idx === 0) {
          state.totemX = lerp(state.totemX, 255, Math.min(1, dt * 6));
          const w1 = (nowSec * 1.4) % 1;
          const w2 = (nowSec * 1.4 + 0.5) % 1;
          el.totemWave1?.setAttribute("r", (8 + w1 * 26).toFixed(1));
          el.totemWave1?.setAttribute("opacity", ((1 - w1) * 0.75).toFixed(2));
          el.totemWave2?.setAttribute("r", (8 + w2 * 26).toFixed(1));
          el.totemWave2?.setAttribute("opacity", ((1 - w2) * 0.75).toFixed(2));
        } else {
          state.totemX -= dt * state.currentSpeed * 280;
          el.totemWave1?.setAttribute("opacity", "0");
          el.totemWave2?.setAttribute("opacity", "0");
        }
        el.startTotemGroup?.setAttribute(
          "transform",
          `translate(${state.totemX.toFixed(1)}, 166)`,
        );

        if (idx === 2) {
          const approachP = easeOutCubic(clamp(t / 0.75, 0, 1));
          state.storeX = lerp(640, 310, approachP);
        } else if (idx === 3) {
          state.storeX -= dt * state.currentSpeed * 280;
        } else {
          state.storeX = 920;
        }
        el.storeWorldGroup?.setAttribute(
          "transform",
          `translate(${state.storeX.toFixed(1)}, 128)`,
        );

        const awningAmp = idx === 2 ? 2.2 : 0.8;
        el.storeAwning0?.setAttribute(
          "transform",
          `translate(0,${(Math.sin(nowSec * 6.5) * awningAmp).toFixed(2)})`,
        );
        el.storeAwning1?.setAttribute(
          "transform",
          `translate(0,${(Math.sin(nowSec * 6.5 - 0.8) * awningAmp).toFixed(2)})`,
        );
        el.storeAwning2?.setAttribute(
          "transform",
          `translate(0,${(Math.sin(nowSec * 6.5 - 1.6) * awningAmp).toFixed(2)})`,
        );

        if (idx === 4) {
          const approachC = easeOutCubic(clamp(t / 0.75, 0, 1));
          state.clientX = lerp(660, 368, approachC);
        } else {
          state.clientX = 920;
        }
        el.clientWorldGroup?.setAttribute(
          "transform",
          `translate(${state.clientX.toFixed(1)}, 138)`,
        );

        state.wheelAngle =
          (state.wheelAngle + dt * (60 + state.currentSpeed * 680)) % 360;
        el.wheelBackSpokes?.setAttribute(
          "transform",
          `rotate(${state.wheelAngle.toFixed(0)})`,
        );
        el.wheelFrontSpokes?.setAttribute(
          "transform",
          `rotate(${state.wheelAngle.toFixed(0)})`,
        );

        const vibeFreq = state.currentSpeed > 0.2 ? 32 : 18;
        const vibeAmp = state.currentSpeed > 0.2 ? 1.5 : 0.7;
        let suspY = Math.sin(nowSec * vibeFreq) * vibeAmp;
        let tiltDeg = 0;
        let squashX = 1;
        let squashY = 1;
        let bagLidAngle = 0;
        let hasPackage = false;

        if (idx === 1 || idx === 3) {
          if (t < 0.65) {
            tiltDeg = -Math.sin((t / 0.65) * Math.PI) * 8.5;
          } else {
            tiltDeg = -1.8 + Math.sin(nowSec * 3.5) * 1.4;
          }
        }

        const localCycle3 = t % 3.4;
        if (idx === 2) {
          if (t < 0.75) {
            tiltDeg = Math.sin((t / 0.75) * Math.PI) * 5.5;
          }
          if (localCycle3 > 0.6 && localCycle3 < 1.8) {
            const openP =
              localCycle3 < 1.1
                ? easeOutBack(norm(localCycle3, 0.6, 1.0), 1.4)
                : 1 - easeInOutCubic(norm(localCycle3, 1.5, 1.8));
            bagLidAngle = -openP * 70;
          }
          hasPackage = localCycle3 > 1.45 || t > 1.8;

          if (localCycle3 > 1.42 && localCycle3 < 1.88) {
            const imp = Math.sin(norm(localCycle3, 1.42, 1.88) * Math.PI);
            suspY += imp * 5.5;
            squashX = 1 + imp * 0.08;
            squashY = 1 - imp * 0.08;
            tiltDeg = -imp * 4.2;
          }

          if (localCycle3 < 0.85) {
            el.storeCounterPkg?.setAttribute("opacity", "1");
            el.storeScannerLine?.setAttribute(
              "opacity",
              localCycle3 > 0.45 ? "1" : "0",
            );
          } else {
            el.storeCounterPkg?.setAttribute("opacity", "0");
          }

          if (localCycle3 >= 0.82 && localCycle3 <= 1.48) {
            const pj = norm(localCycle3, 0.82, 1.46);
            const startPkgX = state.storeX + 106;
            const startPkgY = 212;
            const endPkgX = 345 - 25;
            const endPkgY = 248;
            const fx = lerp(startPkgX, endPkgX, pj);
            const fy =
              lerp(startPkgY, endPkgY, pj) - Math.sin(pj * Math.PI) * 58;
            el.parabolicPkgNode?.setAttribute("opacity", "1");
            el.parabolicPkgNode?.setAttribute(
              "transform",
              `translate(${fx.toFixed(1)},${fy.toFixed(1)})`,
            );
          } else {
            el.parabolicPkgNode?.setAttribute("opacity", "0");
          }
        } else if (idx === 3) {
          hasPackage = true;
          el.parabolicPkgNode?.setAttribute("opacity", "0");
        } else if (idx === 4) {
          if (t < 0.75) {
            tiltDeg = Math.sin((t / 0.75) * Math.PI) * 5.5;
          }
          if (t > 0.55 && t < 1.55) {
            const openP =
              t < 0.95
                ? easeOutBack(norm(t, 0.55, 0.9), 1.35)
                : 1 - easeInOutCubic(norm(t, 1.25, 1.55));
            bagLidAngle = -openP * 66;
          }
          hasPackage = t < 1.25;

          if (t >= 0.72 && t <= 1.32) {
            const pd = norm(t, 0.72, 1.3);
            const fx = lerp(320, state.clientX + 56, pd);
            const fy = lerp(248, 232, pd) - Math.sin(pd * Math.PI) * 54;
            el.parabolicPkgNode?.setAttribute("opacity", "1");
            el.parabolicPkgNode?.setAttribute(
              "transform",
              `translate(${fx.toFixed(1)},${fy.toFixed(1)})`,
            );
          } else {
            el.parabolicPkgNode?.setAttribute("opacity", "0");
          }

          if (t > 1.3) {
            const popS = easeOutBack(norm(t, 1.3, 1.68), 1.55);
            const floatCheck = Math.sin(nowSec * 4) * 2.5;
            el.clientDeliveredPkg?.setAttribute("opacity", "1");
            el.clientDeliveredPkg?.setAttribute(
              "transform",
              `translate(56, 94) scale(${popS.toFixed(2)})`,
            );
            el.clientCheckBadge?.setAttribute("opacity", "1");
            el.clientCheckBadge?.setAttribute(
              "transform",
              `translate(62,${(18 + floatCheck).toFixed(1)}) scale(${popS.toFixed(2)})`,
            );

            const waveP = (nowSec * 1.2) % 1;
            el.clientConfirmWave?.setAttribute(
              "r",
              (26 + waveP * 44).toFixed(1),
            );
            el.clientConfirmWave?.setAttribute(
              "opacity",
              ((1 - waveP) * 0.35).toFixed(2),
            );

            const confCycle = ((t - 1.3) % 2.4) / 2.4;
            el.clientConfetti?.setAttribute(
              "opacity",
              (1 - confCycle).toFixed(2),
            );
            el.clientConfetti?.setAttribute(
              "transform",
              `translate(62,${(34 - confCycle * 26).toFixed(1)}) scale(${(0.85 + confCycle * 0.45).toFixed(2)})`,
            );
          } else {
            el.clientDeliveredPkg?.setAttribute("opacity", "0");
            el.clientCheckBadge?.setAttribute("opacity", "0");
            el.clientConfirmWave?.setAttribute("opacity", "0");
            el.clientConfetti?.setAttribute("opacity", "0");
          }
        } else {
          el.parabolicPkgNode?.setAttribute("opacity", "0");
        }

        el.motoSuspension?.setAttribute(
          "transform",
          `translate(0,${suspY.toFixed(2)}) rotate(${tiltDeg.toFixed(2)}) scale(${squashX.toFixed(2)},${squashY.toFixed(2)})`,
        );

        const isDriving = state.currentSpeed > 0.25;
        el.headlightCone?.setAttribute("opacity", isDriving ? "1" : "0.35");
        el.speedWindGroup?.setAttribute("opacity", isDriving ? "1" : "0");

        if (isDriving) {
          const wShift1 = ((nowSec * 9) % 1) * 28;
          const wShift2 = ((nowSec * 9 + 0.5) % 1) * 32;
          el.windLine1?.setAttribute(
            "transform",
            `translate(${(-wShift1).toFixed(1)}, 0)`,
          );
          el.windLine2?.setAttribute(
            "transform",
            `translate(${(-wShift2).toFixed(1)}, 0)`,
          );
          el.puffCircle1?.setAttribute(
            "cx",
            (-40 - wShift1 * 0.8).toFixed(1),
          );
          el.puffCircle1?.setAttribute(
            "opacity",
            (1 - wShift1 / 28).toFixed(2),
          );
        }

        const scarfWave =
          Math.sin(nowSec * (isDriving ? 24 : 8)) * (isDriving ? 4.5 : 1.2);
        el.scarfWavePath?.setAttribute(
          "d",
          `M -1 -29 Q -13 ${(-32 + scarfWave).toFixed(1)} -23 ${(-27 - scarfWave).toFixed(1)}`,
        );

        el.bagLidHinge?.setAttribute(
          "transform",
          `translate(-12, -11) rotate(${bagLidAngle.toFixed(1)})`,
        );
        el.bagBodyRect?.setAttribute("fill", hasPackage ? "#7C3AED" : "#FFFFFF");
        el.bagLogoL?.setAttribute("fill", hasPackage ? "#FFFFFF" : "#7C3AED");
        el.bagActiveDot?.setAttribute("opacity", hasPackage ? "1" : "0");

        const isHighlighted = hasPackage || (idx === 4 && t > 1.3);
        el.heroSpeechBubble?.setAttribute(
          "transform",
          `translate(345,${(192 + suspY * 0.6).toFixed(1)})`,
        );
        el.heroBubbleBg?.setAttribute(
          "fill",
          isHighlighted ? "#7C3AED" : "#FFFFFF",
        );
        el.heroBubbleText?.setAttribute(
          "fill",
          isHighlighted ? "#FFFFFF" : "#272321",
        );

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, []);

    return (
      <div
        className="retail-mlogin-illustration-wrap is-motoboy-wrap"
        aria-hidden="true"
      >
        <div className="retail-mlogin-motoboy-card">
          <div className="retail-mlogin-motoboy-stage">
            <svg
              ref={svgRef}
              viewBox="0 0 460 316"
              preserveAspectRatio="xMidYMid slice"
              className="retail-mlogin-motoboy-svg"
              onClick={() =>
                controlRef.current?.goToStep((activeStep + 1) % 5, true)
              }
            >
              <defs>
                <linearGradient
                  id="mloginSkyGrad"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#F8F7FC" />
                  <stop offset="100%" stopColor="#F3E8FF" stopOpacity="0.65" />
                </linearGradient>
                <linearGradient
                  id="mloginBeamGrad"
                  x1="0%"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                >
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                </linearGradient>
                <filter
                  id="mloginElevShadow"
                  x="-15%"
                  y="-15%"
                  width="130%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="4"
                    stdDeviation="5"
                    floodColor="#7C3AED"
                    floodOpacity="0.18"
                  />
                </filter>
                <filter
                  id="mloginHudShadow"
                  x="-10%"
                  y="-10%"
                  width="120%"
                  height="130%"
                >
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="3"
                    floodColor="#272321"
                    floodOpacity="0.08"
                  />
                </filter>

                {/* Tile Repetível 1: Nuvens (760px de largura) */}
                <g id="mloginCloudTile">
                  <rect
                    x="50"
                    y="68"
                    width="64"
                    height="16"
                    rx="8"
                    fill="#FFFFFF"
                  />
                  <rect
                    x="210"
                    y="52"
                    width="88"
                    height="18"
                    rx="9"
                    fill="#FFFFFF"
                  />
                  <rect
                    x="420"
                    y="72"
                    width="70"
                    height="15"
                    rx="7.5"
                    fill="#FFFFFF"
                  />
                  <rect
                    x="610"
                    y="56"
                    width="76"
                    height="17"
                    rx="8.5"
                    fill="#FFFFFF"
                  />
                </g>

                {/* Tile Repetível 2: Skyline Urbano na Paleta Oficial (760px) */}
                <g id="mloginSkylineTile">
                  <rect
                    x="10"
                    y="132"
                    width="72"
                    height="120"
                    rx="6"
                    fill="#F3E8FF"
                  />
                  <rect
                    x="92"
                    y="102"
                    width="88"
                    height="150"
                    rx="6"
                    fill="#E5E1ED"
                    opacity="0.7"
                  />
                  <g fill="#FFFFFF" opacity="0.8">
                    <rect x="106" y="116" width="14" height="12" rx="2" />
                    <rect x="128" y="116" width="14" height="12" rx="2" />
                    <rect x="150" y="116" width="14" height="12" rx="2" />
                    <rect x="106" y="136" width="14" height="12" rx="2" />
                    <rect x="128" y="136" width="14" height="12" rx="2" />
                    <rect x="150" y="136" width="14" height="12" rx="2" />
                  </g>
                  <rect
                    x="190"
                    y="140"
                    width="68"
                    height="112"
                    rx="6"
                    fill="#F3E8FF"
                  />
                  <rect
                    x="268"
                    y="114"
                    width="94"
                    height="138"
                    rx="6"
                    fill="#E5E1ED"
                    opacity="0.65"
                  />
                  <rect
                    x="372"
                    y="136"
                    width="76"
                    height="116"
                    rx="6"
                    fill="#F3E8FF"
                  />
                  <rect
                    x="458"
                    y="98"
                    width="92"
                    height="154"
                    rx="6"
                    fill="#E5E1ED"
                    opacity="0.7"
                  />
                  <g fill="#FFFFFF" opacity="0.8">
                    <rect x="474" y="114" width="16" height="12" rx="2" />
                    <rect x="498" y="114" width="16" height="12" rx="2" />
                    <rect x="474" y="134" width="16" height="12" rx="2" />
                    <rect x="498" y="134" width="16" height="12" rx="2" />
                  </g>
                  <rect
                    x="560"
                    y="128"
                    width="84"
                    height="124"
                    rx="6"
                    fill="#F3E8FF"
                  />
                  <rect
                    x="654"
                    y="110"
                    width="96"
                    height="142"
                    rx="6"
                    fill="#E5E1ED"
                    opacity="0.65"
                  />
                </g>

                {/* Tile Repetível 3: Árvores, Postes e Calçada (760px) */}
                <g id="mloginMidgroundTile">
                  <line
                    x1="80"
                    y1="154"
                    x2="80"
                    y2="246"
                    stroke="#E5E1ED"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M 80 154 Q 95 154 100 160"
                    fill="none"
                    stroke="#665F70"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="100"
                    cy="162"
                    r="4"
                    fill="#7C3AED"
                    opacity="0.55"
                  />

                  <rect x="168" y="218" width="5" height="28" fill="#665F70" />
                  <circle
                    cx="170.5"
                    cy="204"
                    r="18"
                    fill="#F3E8FF"
                    stroke="#E5E1ED"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="170.5"
                    cy="186"
                    r="13"
                    fill="#FFFFFF"
                    stroke="#E5E1ED"
                    strokeWidth="1.8"
                  />

                  <rect
                    x="260"
                    y="234"
                    width="32"
                    height="6"
                    rx="2"
                    fill="#FFFFFF"
                    stroke="#665F70"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="266"
                    y1="240"
                    x2="266"
                    y2="246"
                    stroke="#665F70"
                    strokeWidth="2"
                  />
                  <line
                    x1="286"
                    y1="240"
                    x2="286"
                    y2="246"
                    stroke="#665F70"
                    strokeWidth="2"
                  />

                  <line
                    x1="360"
                    y1="154"
                    x2="360"
                    y2="246"
                    stroke="#E5E1ED"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M 360 154 Q 375 154 380 160"
                    fill="none"
                    stroke="#665F70"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="380"
                    cy="162"
                    r="4"
                    fill="#7C3AED"
                    opacity="0.55"
                  />

                  <rect x="468" y="218" width="5" height="28" fill="#665F70" />
                  <circle
                    cx="470.5"
                    cy="204"
                    r="18"
                    fill="#F3E8FF"
                    stroke="#E5E1ED"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="470.5"
                    cy="186"
                    r="13"
                    fill="#FFFFFF"
                    stroke="#E5E1ED"
                    strokeWidth="1.8"
                  />

                  <line
                    x1="600"
                    y1="154"
                    x2="600"
                    y2="246"
                    stroke="#E5E1ED"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M 600 154 Q 615 154 620 160"
                    fill="none"
                    stroke="#665F70"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="620"
                    cy="162"
                    r="4"
                    fill="#7C3AED"
                    opacity="0.55"
                  />

                  <rect x="698" y="218" width="5" height="28" fill="#665F70" />
                  <circle
                    cx="700.5"
                    cy="204"
                    r="16"
                    fill="#F3E8FF"
                    stroke="#E5E1ED"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="700.5"
                    cy="188"
                    r="11"
                    fill="#FFFFFF"
                    stroke="#E5E1ED"
                    strokeWidth="1.8"
                  />
                </g>

                {/* Tile Repetível 4: Pista, Meio-Fio e Faixas do Asfalto (760px) */}
                <g id="mloginRoadTile">
                  <line
                    x1="95"
                    y1="246"
                    x2="95"
                    y2="258"
                    stroke="#E5E1ED"
                    strokeWidth="2"
                  />
                  <line
                    x1="190"
                    y1="246"
                    x2="190"
                    y2="258"
                    stroke="#E5E1ED"
                    strokeWidth="2"
                  />
                  <line
                    x1="285"
                    y1="246"
                    x2="285"
                    y2="258"
                    stroke="#E5E1ED"
                    strokeWidth="2"
                  />
                  <line
                    x1="380"
                    y1="246"
                    x2="380"
                    y2="258"
                    stroke="#E5E1ED"
                    strokeWidth="2"
                  />
                  <line
                    x1="475"
                    y1="246"
                    x2="475"
                    y2="258"
                    stroke="#E5E1ED"
                    strokeWidth="2"
                  />
                  <line
                    x1="570"
                    y1="246"
                    x2="570"
                    y2="258"
                    stroke="#E5E1ED"
                    strokeWidth="2"
                  />
                  <line
                    x1="665"
                    y1="246"
                    x2="665"
                    y2="258"
                    stroke="#E5E1ED"
                    strokeWidth="2"
                  />
                  <g fill="#FFFFFF">
                    <rect x="10" y="284" width="42" height="5" rx="2.5" />
                    <rect x="86" y="284" width="42" height="5" rx="2.5" />
                    <rect x="162" y="284" width="42" height="5" rx="2.5" />
                    <rect x="238" y="284" width="42" height="5" rx="2.5" />
                    <rect x="314" y="284" width="42" height="5" rx="2.5" />
                    <rect x="390" y="284" width="42" height="5" rx="2.5" />
                    <rect x="466" y="284" width="42" height="5" rx="2.5" />
                    <rect x="542" y="284" width="42" height="5" rx="2.5" />
                    <rect x="618" y="284" width="42" height="5" rx="2.5" />
                    <rect x="694" y="284" width="42" height="5" rx="2.5" />
                  </g>
                </g>
              </defs>

              {/* Fundo Base do Céu */}
              <rect
                x="0"
                y="0"
                width="460"
                height="316"
                fill="url(#mloginSkyGrad)"
              />

              {/* CAMERA RIG (Zoom Dinâmico + Parallax Infinito) */}
              <g id="mloginMotoCameraRig">
                <g id="mloginParallaxClouds" opacity="0.85">
                  <use href="#mloginCloudTile" x="-760" y="0" />
                  <use href="#mloginCloudTile" x="0" y="0" />
                  <use href="#mloginCloudTile" x="760" y="0" />
                </g>

                <g id="mloginParallaxSkyline">
                  <use href="#mloginSkylineTile" x="-760" y="0" />
                  <use href="#mloginSkylineTile" x="0" y="0" />
                  <use href="#mloginSkylineTile" x="760" y="0" />
                </g>

                <g id="mloginParallaxMidground">
                  <use href="#mloginMidgroundTile" x="-760" y="0" />
                  <use href="#mloginMidgroundTile" x="0" y="0" />
                  <use href="#mloginMidgroundTile" x="760" y="0" />
                </g>

                {/* Base da Calçada e do Asfalto */}
                <rect
                  x="-400"
                  y="246"
                  width="1600"
                  height="12"
                  fill="#FFFFFF"
                  stroke="#E5E1ED"
                  strokeWidth="1.5"
                />
                <rect
                  x="-400"
                  y="258"
                  width="1600"
                  height="90"
                  fill="#F3E8FF"
                />
                <line
                  x1="-400"
                  y1="258"
                  x2="1200"
                  y2="258"
                  stroke="#7C3AED"
                  strokeWidth="3"
                  opacity="0.35"
                />

                <g id="mloginParallaxRoad">
                  <use href="#mloginRoadTile" x="-760" y="0" />
                  <use href="#mloginRoadTile" x="0" y="0" />
                  <use href="#mloginRoadTile" x="760" y="0" />
                </g>

                {/* A) TOTEM DE PARTIDA (Etapa 1) */}
                <g id="mloginStartTotemGroup" transform="translate(255, 166)">
                  <rect
                    x="0"
                    y="14"
                    width="42"
                    height="66"
                    rx="8"
                    fill="#FFFFFF"
                    stroke="#7C3AED"
                    strokeWidth="2"
                    filter="url(#mloginElevShadow)"
                  />
                  <rect
                    x="6"
                    y="21"
                    width="30"
                    height="20"
                    rx="4"
                    fill="#F3E8FF"
                  />
                  <circle cx="21" cy="31" r="5" fill="#7C3AED" />
                  <rect
                    x="8"
                    y="48"
                    width="26"
                    height="4"
                    rx="2"
                    fill="#7C3AED"
                  />
                  <rect
                    x="8"
                    y="56"
                    width="18"
                    height="3.5"
                    rx="1.5"
                    fill="#E5E1ED"
                  />
                  <text
                    x="21"
                    y="74"
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#665F70"
                  >
                    PONTO
                  </text>
                  <g transform="translate(21, 8)">
                    <circle
                      id="mloginTotemWave1"
                      r="10"
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth="2.2"
                      opacity="0"
                    />
                    <circle
                      id="mloginTotemWave2"
                      r="22"
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth="1.8"
                      opacity="0"
                    />
                  </g>
                </g>

                {/* B) FACHADA DA LOJA PDV LOJISTA (Etapa 3) */}
                <g id="mloginStoreWorldGroup" transform="translate(920, 128)">
                  <rect
                    x="0"
                    y="12"
                    width="162"
                    height="106"
                    rx="12"
                    fill="#FFFFFF"
                    stroke="#7C3AED"
                    strokeWidth="2.5"
                    filter="url(#mloginElevShadow)"
                  />
                  <path
                    d="M 0 24 Q 0 12 12 12 L 150 12 Q 162 12 162 24 L 162 46 L 0 46 Z"
                    fill="#7C3AED"
                  />

                  {/* Símbolo Oficial L + Loja */}
                  <g transform="translate(12, 16) scale(0.40)">
                    <rect
                      x="0"
                      y="0"
                      width="64"
                      height="64"
                      rx="14"
                      fill="#FFFFFF"
                    />
                    <path d="M16 15H26V39H48V49H16Z" fill="#7C3AED" />
                    <g transform="translate(30, 12) scale(0.96)">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M3 12H21V23H3ZM6 23V16C6 15.4 6.4 15 7 15H10C10.6 15 11 15.4 11 16V23ZM14.7 15H17.3C17.7 15 18 15.3 18 15.7V19.3C18 19.7 17.7 20 17.3 20H14.7C14.3 20 14 19.7 14 19.3V15.7C14 15.3 14.3 15 14.7 15Z"
                        fill="#7C3AED"
                      />
                      <path
                        d="M4 2H9L8 9C7.5 12 0 12 1 9Z"
                        fill="#7C3AED"
                      />
                      <path
                        d="M10 2H14L15 9C16 12 8 12 9 9Z"
                        fill="#7C3AED"
                      />
                      <path
                        d="M15 2H20L23 9C24 12 16.5 12 16 9Z"
                        fill="#7C3AED"
                      />
                    </g>
                  </g>
                  <text
                    x="46"
                    y="29"
                    fontSize="11.5"
                    fontWeight="700"
                    fill="#FFFFFF"
                    letterSpacing="0.5"
                  >
                    PDV LOJISTA
                  </text>
                  <text
                    x="46"
                    y="40"
                    fontSize="9.5"
                    fontWeight="600"
                    fill="#F3E8FF"
                  >
                    COLETA EXPRESSA
                  </text>

                  {/* Toldo de 3 Gomos Animados */}
                  <g transform="translate(8, 44)">
                    <path
                      id="mloginStoreAwning0"
                      d="M 2 0 L 46 0 L 42 15 Q 22 20 0 15 Z"
                      fill="#6D28D9"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <path
                      id="mloginStoreAwning1"
                      d="M 49 0 L 97 0 L 97 15 Q 73 20 49 15 Z"
                      fill="#7C3AED"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <path
                      id="mloginStoreAwning2"
                      d="M 100 0 L 144 0 L 146 15 Q 124 20 100 15 Z"
                      fill="#6D28D9"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  </g>

                  {/* Porta e Balcão de Expedição */}
                  <rect
                    x="16"
                    y="66"
                    width="38"
                    height="52"
                    rx="5"
                    fill="#F3E8FF"
                    stroke="#7C3AED"
                    strokeWidth="1.8"
                  />
                  <rect
                    x="21"
                    y="72"
                    width="28"
                    height="24"
                    rx="3"
                    fill="#FFFFFF"
                  />
                  <rect
                    x="66"
                    y="66"
                    width="80"
                    height="36"
                    rx="6"
                    fill="#F8F7FC"
                    stroke="#E5E1ED"
                    strokeWidth="1.8"
                  />
                  <rect
                    x="62"
                    y="98"
                    width="88"
                    height="7"
                    rx="3"
                    fill="#7C3AED"
                  />
                  <text
                    x="106"
                    y="113"
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#665F70"
                  >
                    RETIRADA Nº 4092
                  </text>

                  {/* Pacote no balcão da loja */}
                  <g id="mloginStoreCounterPkg" transform="translate(106, 84)">
                    <rect
                      x="-12"
                      y="-12"
                      width="24"
                      height="24"
                      rx="5"
                      fill="#FFFFFF"
                      stroke="#7C3AED"
                      strokeWidth="2.2"
                    />
                    <rect
                      x="-10"
                      y="-2.5"
                      width="20"
                      height="5"
                      fill="#F3E8FF"
                    />
                    <rect
                      x="-3.5"
                      y="-10"
                      width="7"
                      height="20"
                      fill="#7C3AED"
                    />
                    <line
                      id="mloginStoreScannerLine"
                      x1="-18"
                      y1="0"
                      x2="18"
                      y2="0"
                      stroke="#7C3AED"
                      strokeWidth="2.5"
                      opacity="0"
                    />
                  </g>
                </g>

                {/* C) CASA DO CLIENTE (Etapa 5) */}
                <g id="mloginClientWorldGroup" transform="translate(920, 138)">
                  <circle
                    id="mloginClientConfirmWave"
                    cx="62"
                    cy="54"
                    r="32"
                    fill="#7C3AED"
                    opacity="0"
                  />
                  <path
                    d="M 6 36 L 62 2 L 118 36 Z"
                    fill="#7C3AED"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    filter="url(#mloginElevShadow)"
                  />
                  <rect
                    x="14"
                    y="34"
                    width="96"
                    height="74"
                    rx="8"
                    fill="#FFFFFF"
                    stroke="#7C3AED"
                    strokeWidth="2.4"
                    filter="url(#mloginElevShadow)"
                  />

                  <rect
                    x="24"
                    y="44"
                    width="38"
                    height="16"
                    rx="4"
                    fill="#F3E8FF"
                    stroke="#7C3AED"
                    strokeWidth="1.2"
                  />
                  <text
                    x="43"
                    y="55"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#7C3AED"
                  >
                    Nº 409
                  </text>

                  <rect
                    x="24"
                    y="68"
                    width="38"
                    height="24"
                    rx="4"
                    fill="#F8F7FC"
                    stroke="#E5E1ED"
                    strokeWidth="1.6"
                  />
                  <rect
                    x="72"
                    y="54"
                    width="26"
                    height="54"
                    rx="4"
                    fill="#F3E8FF"
                    stroke="#7C3AED"
                    strokeWidth="1.8"
                  />
                  <circle cx="92" cy="82" r="2.2" fill="#7C3AED" />

                  <g
                    id="mloginClientDeliveredPkg"
                    transform="translate(56, 94) scale(0)"
                    opacity="0"
                  >
                    <rect
                      x="-13"
                      y="-13"
                      width="26"
                      height="26"
                      rx="6"
                      fill="#FFFFFF"
                      stroke="#7C3AED"
                      strokeWidth="2.4"
                      filter="url(#mloginElevShadow)"
                    />
                    <rect
                      x="-11"
                      y="-3"
                      width="22"
                      height="6"
                      fill="#F3E8FF"
                    />
                    <rect
                      x="-4"
                      y="-11"
                      width="8"
                      height="22"
                      fill="#7C3AED"
                    />
                  </g>

                  <g
                    id="mloginClientCheckBadge"
                    transform="translate(62, 18) scale(0)"
                    opacity="0"
                  >
                    <circle
                      r="19"
                      fill="#7C3AED"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                      filter="url(#mloginElevShadow)"
                    />
                    <path
                      d="M -7.5 0.5 L -2 6.5 L 8.5 -5.5"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="3.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>

                  <g
                    id="mloginClientConfetti"
                    transform="translate(62, 34)"
                    opacity="0"
                  >
                    <rect
                      x="-42"
                      y="-22"
                      width="7"
                      height="7"
                      rx="1.5"
                      fill="#7C3AED"
                      transform="rotate(20)"
                    />
                    <circle cx="-26" cy="-38" r="4.5" fill="#6D28D9" />
                    <rect
                      x="28"
                      y="-30"
                      width="7"
                      height="7"
                      rx="1.5"
                      fill="#7C3AED"
                      transform="rotate(-25)"
                    />
                    <circle
                      cx="44"
                      cy="-16"
                      r="5"
                      fill="#F3E8FF"
                      stroke="#7C3AED"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="-4"
                      y="-46"
                      width="6.5"
                      height="6.5"
                      rx="1"
                      fill="#6D28D9"
                      transform="rotate(45)"
                    />
                  </g>
                </g>

                {/* HERO: MOTOBOY CENTRALIZADO NO PALCO */}
                <g transform="translate(345, 272)">
                  <ellipse
                    cx="0"
                    cy="15"
                    rx="40"
                    ry="6"
                    fill="#272321"
                    opacity="0.16"
                  />

                  <g id="mloginSpeedWindGroup" opacity="0">
                    <line
                      id="mloginWindLine1"
                      x1="-78"
                      y1="-22"
                      x2="-42"
                      y2="-22"
                      stroke="#7C3AED"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity="0.75"
                    />
                    <line
                      id="mloginWindLine2"
                      x1="-92"
                      y1="-8"
                      x2="-52"
                      y2="-8"
                      stroke="#6D28D9"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      opacity="0.55"
                    />
                    <line
                      x1="-68"
                      y1="-36"
                      x2="-38"
                      y2="-36"
                      stroke="#7C3AED"
                      strokeWidth="2"
                      strokeLinecap="round"
                      opacity="0.45"
                    />
                    <circle
                      id="mloginPuffCircle1"
                      cx="-42"
                      cy="4"
                      r="5.5"
                      fill="#FFFFFF"
                      stroke="#E5E1ED"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="-58"
                      cy="0"
                      r="8"
                      fill="#F3E8FF"
                      stroke="#E5E1ED"
                      strokeWidth="1.2"
                    />
                  </g>

                  <g id="mloginMotoSuspension">
                    <polygon
                      id="mloginHeadlightCone"
                      points="28,-15 120,-34 120,10 28,-6"
                      fill="url(#mloginBeamGrad)"
                      opacity="0"
                    />

                    {/* Roda Traseira */}
                    <g transform="translate(-24, 3)">
                      <circle r="12.5" fill="#272321" />
                      <circle r="7" fill="#FFFFFF" />
                      <circle r="2.8" fill="#7C3AED" />
                      <g id="mloginWheelBackSpokes">
                        <line
                          x1="-6.5"
                          y1="0"
                          x2="6.5"
                          y2="0"
                          stroke="#7C3AED"
                          strokeWidth="2"
                        />
                        <line
                          x1="0"
                          y1="-6.5"
                          x2="0"
                          y2="6.5"
                          stroke="#7C3AED"
                          strokeWidth="2"
                        />
                      </g>
                    </g>

                    {/* Roda Dianteira */}
                    <g transform="translate(26, 3)">
                      <circle r="12.5" fill="#272321" />
                      <circle r="7" fill="#FFFFFF" />
                      <circle r="2.8" fill="#7C3AED" />
                      <g id="mloginWheelFrontSpokes">
                        <line
                          x1="-6.5"
                          y1="0"
                          x2="6.5"
                          y2="0"
                          stroke="#7C3AED"
                          strokeWidth="2"
                        />
                        <line
                          x1="0"
                          y1="-6.5"
                          x2="0"
                          y2="6.5"
                          stroke="#7C3AED"
                          strokeWidth="2"
                        />
                      </g>
                    </g>

                    {/* Escapamento e Motor */}
                    <path d="M -30 4 L -8 4 L -4 -3 L -28 0 Z" fill="#272321" />
                    <rect
                      x="-9"
                      y="-8"
                      width="15"
                      height="11"
                      rx="2.5"
                      fill="#665F70"
                      stroke="#FFFFFF"
                      strokeWidth="1.2"
                    />

                    {/* Suspensão Dianteira */}
                    <line
                      x1="15"
                      y1="-20"
                      x2="26"
                      y2="3"
                      stroke="#272321"
                      strokeWidth="4.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 16 -8 Q 27 -13 34 -5"
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth="3.8"
                      strokeLinecap="round"
                    />

                    {/* Chassi e Tanque Roxo */}
                    <path
                      d="M -28 -4 L -13 -13 L 7 -13 L 18 -22 L 27 -18 L 20 -3 L -24 -1 Z"
                      fill="#7C3AED"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M 2 -14 L 16 -20 L 20 -14 L 6 -9 Z"
                      fill="#6D28D9"
                    />

                    {/* Farol Dianteiro */}
                    <path
                      d="M 25 -19 L 30 -16 L 27 -10 L 22 -13 Z"
                      fill="#FFFFFF"
                      stroke="#7C3AED"
                      strokeWidth="1.6"
                    />

                    {/* Suporte de Celular no Guidão */}
                    <rect
                      x="15"
                      y="-26"
                      width="6"
                      height="9"
                      rx="1.5"
                      fill="#FFFFFF"
                      stroke="#7C3AED"
                      strokeWidth="1.5"
                    />

                    {/* Banco e Piloto */}
                    <path
                      d="M -15 -13 Q -4 -12 4 -14 L 2 -8 L -16 -8 Z"
                      fill="#272321"
                    />
                    <path
                      d="M -3 -10 L 4 -2 L 0 5"
                      fill="none"
                      stroke="#272321"
                      strokeWidth="5.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M -4 -13 L 2 -30 L 16 -20"
                      fill="none"
                      stroke="#6D28D9"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1="-2"
                      y1="-19"
                      x2="1"
                      y2="-26"
                      stroke="#F3E8FF"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />

                    {/* Cachecol Roxo Tremulando ao Vento */}
                    <path
                      id="mloginScarfWavePath"
                      d="M -1 -29 Q -14 -32 -22 -27"
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />

                    {/* Capacete Roxo & Viseira Branca */}
                    <g transform="translate(4, -37)">
                      <circle
                        r="10"
                        fill="#7C3AED"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <path
                        d="M 2 -4.2 L 10 -3.2 L 10 3.2 L 2 2.2 Z"
                        fill="#FFFFFF"
                      />
                    </g>

                    {/* BAG TÉRMICA COM TAMPA ARTICULADA */}
                    <g transform="translate(-25, -24)">
                      <rect
                        id="mloginBagBodyRect"
                        x="-12"
                        y="-11"
                        width="24"
                        height="23"
                        rx="4.5"
                        fill="#FFFFFF"
                        stroke="#7C3AED"
                        strokeWidth="2.4"
                      />
                      <path
                        id="mloginBagLogoL"
                        d="M -4.5 -5.5 H 0 V 3.5 H 5.5 V 7 H -4.5 Z"
                        fill="#7C3AED"
                      />
                      <circle
                        id="mloginBagActiveDot"
                        cx="7"
                        cy="-6"
                        r="3"
                        fill="#FFFFFF"
                        opacity="0"
                      />
                      <g
                        id="mloginBagLidHinge"
                        transform="translate(-12, -11) rotate(0)"
                      >
                        <rect
                          x="0"
                          y="-4"
                          width="24"
                          height="5"
                          rx="2"
                          fill="#6D28D9"
                          stroke="#FFFFFF"
                          strokeWidth="1.2"
                        />
                      </g>
                    </g>
                  </g>
                </g>

                {/* PACOTE SALTANDO EM ARCO PARABÓLICO */}
                <g
                  id="mloginParabolicPkgNode"
                  transform="translate(345, 220)"
                  opacity="0"
                >
                  <rect
                    x="-14"
                    y="-14"
                    width="28"
                    height="28"
                    rx="6"
                    fill="#FFFFFF"
                    stroke="#7C3AED"
                    strokeWidth="2.5"
                    filter="url(#mloginElevShadow)"
                  />
                  <rect
                    x="-12"
                    y="-3.5"
                    width="24"
                    height="7"
                    fill="#F3E8FF"
                  />
                  <rect x="-4" y="-12" width="8" height="24" fill="#7C3AED" />
                  <circle
                    cx="10"
                    cy="-10"
                    r="7.5"
                    fill="#7C3AED"
                    stroke="#FFFFFF"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M 7 -10 L 9.2 -7.5 L 13.5 -12"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>

                {/* BALÃO DE STATUS AO VIVO ACIMA DO MOTOBOY */}
                <g
                  id="mloginHeroSpeechBubble"
                  transform="translate(345, 192)"
                  filter="url(#mloginHudShadow)"
                >
                  <rect
                    id="mloginHeroBubbleBg"
                    x="-88"
                    y="-14"
                    width="176"
                    height="25"
                    rx="8"
                    fill="#FFFFFF"
                    stroke="#7C3AED"
                    strokeWidth="1.8"
                  />
                  <polygon points="-5,11 0,17 5,11" fill="#7C3AED" />
                  <text
                    id="mloginHeroBubbleText"
                    x="0"
                    y="2.5"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#272321"
                  >
                    Chamado aceito! • Nº 4092
                  </text>
                </g>
              </g>

              {/* HUD SUPERIOR COMPACTO (Enquadrado no viewBox 460x316) */}
              <g transform="translate(10, 10)" filter="url(#mloginHudShadow)">
                <rect
                  x="0"
                  y="0"
                  width="248"
                  height="38"
                  rx="9"
                  fill="#FFFFFF"
                  fillOpacity="0.95"
                  stroke="#E5E1ED"
                  strokeWidth="1.2"
                />
                <rect x="6" y="6" width="4" height="26" rx="2" fill="#7C3AED" />
                <text
                  id="mloginStageTopBadge"
                  x="16"
                  y="15.5"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#7C3AED"
                  letterSpacing="0.3"
                >
                  ETAPA 1 • CHAMADO ACEITO
                </text>
                <text
                  id="mloginStageTopTitle"
                  x="16"
                  y="30"
                  fontSize="11.5"
                  fontWeight="700"
                  fill="#272321"
                >
                  Sistema encontrou motorista
                </text>
              </g>

              <g transform="translate(266, 10)" filter="url(#mloginHudShadow)">
                <rect
                  x="0"
                  y="0"
                  width="184"
                  height="38"
                  rx="9"
                  fill="#FFFFFF"
                  fillOpacity="0.95"
                  stroke="#E5E1ED"
                  strokeWidth="1.2"
                />
                <circle
                  cx="18"
                  cy="19"
                  r="10.5"
                  fill="#F3E8FF"
                  stroke="#7C3AED"
                  strokeWidth="1.4"
                />
                <circle cx="18" cy="19" r="4.8" fill="#7C3AED" />
                <text
                  x="34"
                  y="16"
                  fontSize="10.5"
                  fontWeight="700"
                  fill="#272321"
                >
                  Lucas M. • RXP-4E21
                </text>
                <text
                  id="mloginStageTopSub"
                  x="34"
                  y="29.5"
                  fontSize="10"
                  fontWeight="600"
                  fill="#7C3AED"
                >
                  Vinculado ao Pedido Nº 4092
                </text>
              </g>
            </svg>
          </div>

          {/* Seletor rápido das 5 etapas do Motoboy */}
          <div
            className="retail-mlogin-motoboy-steps"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {DELIVERY_ONBOARDING_STAGES.map((st) => (
              <button
                key={st.index}
                type="button"
                className={`retail-mlogin-motoboy-step ${
                  activeStep === st.index
                    ? "is-current"
                    : activeStep > st.index
                      ? "is-done"
                      : ""
                }`}
                onClick={() => controlRef.current?.goToStep(st.index, true)}
              >
                {st.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  },
);

/**
 * Slide 6 — Módulo Clientes, Crediário e Cobrança (Ilustração editorial exclusiva
 * seguindo a mesma direção de arte arquitetônica dos slides anteriores: ficha de
 * crediário do cliente, barra de limite disponível animada, carnê de parcelas 1/3, 2/3 e 3/3
 * com baixa automática, cartão de crédito da loja e disparo de lembrete de cobrança).
 */
const CustomersCreditModuleIllustration = memo(
  function CustomersCreditModuleIllustration() {
    return (
      <div className="retail-mlogin-illustration-wrap" aria-hidden="true">
        <svg
          viewBox="0 0 280 246"
          fill="none"
          className="retail-mlogin-svg is-customers-credit"
        >
          {/* Aura circular suave de fundo + partículas editoriais */}
          <circle cx="140" cy="120" r="84" fill="#F8F7FC" />
          <circle cx="34" cy="34" r="4.5" fill="#F3E8FF" />
          <circle cx="248" cy="128" r="5" stroke="#E5E1ED" strokeWidth="1.4" />
          <path
            d="M44 18 V26 M40 22 H48 M242 28 V36 M238 32 H246"
            stroke="#7C3AED"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Pedestal e rampa arquitetônica listrada à direita */}
          <rect
            x="182"
            y="160"
            width="64"
            height="60"
            rx="4"
            fill="#6D28D9"
            stroke="#272321"
            strokeWidth="1.4"
          />
          <polygon
            points="142,220 246,160 246,220"
            fill="#7C3AED"
            stroke="#272321"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M162 220 L246 172 M184 220 L246 184 M206 220 L246 196 M228 220 L246 209"
            stroke="#FFFFFF"
            strokeWidth="1.3"
          />

          {/* FICHA CENTRAL DO CLIENTE & CARNÊ DE CREDIÁRIO */}
          <g className="retail-mlogin-float-slow">
            {/* Sombra sólida deslocada */}
            <rect
              x="64"
              y="22"
              width="156"
              height="186"
              rx="12"
              fill="#272321"
            />
            {/* Corpo da Ficha do Cliente */}
            <rect
              x="58"
              y="16"
              width="156"
              height="186"
              rx="12"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.5"
            />

            {/* Cabeçalho Roxo da Ficha com Avatar Editorial do Cliente */}
            <path
              d="M58 28 C58 21.4, 63.4 16, 70 16 H202 C208.6 16, 214 21.4, 214 28 V58 H58 Z"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <circle
              cx="80"
              cy="37"
              r="13"
              fill="#F3E8FF"
              stroke="#272321"
              strokeWidth="1.3"
            />
            {/* Busto estilizado do cliente */}
            <circle
              cx="80"
              cy="33"
              r="4.2"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.2"
            />
            <path
              d="M71 45 C72 40, 88 40, 89 45"
              fill="#6D28D9"
              stroke="#272321"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            {/* Nome do cliente e selo Crediário Ativo */}
            <rect
              x="99"
              y="27"
              width="66"
              height="7"
              rx="3.5"
              fill="#FFFFFF"
            />
            <rect
              x="99"
              y="38"
              width="48"
              height="11"
              rx="4"
              fill="#6D28D9"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
            <text
              x="123"
              y="45.8"
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.3"
            >
              CREDIÁRIO OK
            </text>

            {/* Bloco de Limite de Crédito com Barra de Progresso Animada */}
            <rect
              x="68"
              y="66"
              width="136"
              height="36"
              rx="7"
              fill="#F8F7FC"
              stroke="#272321"
              strokeWidth="1.2"
            />
            <text
              x="76"
              y="78"
              fontSize="7.2"
              fontWeight="800"
              fill="#665F70"
              letterSpacing="0.3"
            >
              LIMITE DISPONÍVEL
            </text>
            <text
              x="196"
              y="78"
              textAnchor="end"
              fontSize="8"
              fontWeight="800"
              fill="#7C3AED"
            >
              R$ 1.200
            </text>
            {/* Trilho da barra de limite */}
            <rect
              x="76"
              y="84"
              width="120"
              height="9"
              rx="4.5"
              fill="#F3E8FF"
              stroke="#272321"
              strokeWidth="1.1"
            />
            {/* Preenchimento animado do limite liberado */}
            <rect
              x="77.5"
              y="85.5"
              width="94"
              height="6"
              rx="3"
              fill="#7C3AED"
              className="retail-mlogin-credit-bar"
            />

            {/* Carnê / Controle de Parcelas (1/3, 2/3, 3/3) */}
            {/* Parcela 1/3 — Quitada */}
            <g transform="translate(68, 110)">
              <rect
                x="0"
                y="0"
                width="136"
                height="22"
                rx="6"
                fill="#F3E8FF"
                stroke="#272321"
                strokeWidth="1.2"
              />
              <circle cx="13" cy="11" r="6.5" fill="#7C3AED" />
              <path
                d="M10 11 L12.2 13.2 L16.2 8.8"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text x="25" y="14" fontSize="8" fontWeight="800" fill="#272321">
                1/3 • PARCELA
              </text>
              <rect
                x="94"
                y="5"
                width="35"
                height="12"
                rx="4"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1"
              />
              <text
                x="111.5"
                y="13.2"
                textAnchor="middle"
                fontSize="6.8"
                fontWeight="800"
                fill="#7C3AED"
              >
                PAGO ✓
              </text>
            </g>

            {/* Parcela 2/3 — Quitada */}
            <g transform="translate(68, 137)">
              <rect
                x="0"
                y="0"
                width="136"
                height="22"
                rx="6"
                fill="#F3E8FF"
                stroke="#272321"
                strokeWidth="1.2"
              />
              <circle cx="13" cy="11" r="6.5" fill="#7C3AED" />
              <path
                d="M10 11 L12.2 13.2 L16.2 8.8"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text x="25" y="14" fontSize="8" fontWeight="800" fill="#272321">
                2/3 • PARCELA
              </text>
              <rect
                x="94"
                y="5"
                width="35"
                height="12"
                rx="4"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1"
              />
              <text
                x="111.5"
                y="13.2"
                textAnchor="middle"
                fontSize="6.8"
                fontWeight="800"
                fill="#7C3AED"
              >
                PAGO ✓
              </text>
            </g>

            {/* Parcela 3/3 — Baixa Animada no Caixa */}
            <g
              transform="translate(68, 164)"
              className="retail-mlogin-credit-installment"
            >
              <rect
                x="0"
                y="0"
                width="136"
                height="24"
                rx="6"
                fill="#272321"
              />
              <circle
                cx="13"
                cy="12"
                r="6.5"
                fill="#7C3AED"
                className="retail-mlogin-vstore-pulse"
              />
              <path
                d="M10 12 L12.2 14.2 L16.2 9.8"
                stroke="#FFFFFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text x="25" y="15" fontSize="8" fontWeight="800" fill="#FFFFFF">
                3/3 • RECEBER
              </text>
              <rect
                x="88"
                y="5"
                width="41"
                height="14"
                rx="4"
                fill="#7C3AED"
              />
              <text
                x="108.5"
                y="14.2"
                textAnchor="middle"
                fontSize="6.8"
                fontWeight="800"
                fill="#FFFFFF"
              >
                BAIXAR
              </text>
            </g>
          </g>

          {/* CARD FLUTUANTE SUPERIOR DIREITO — Régua de Cobrança / Lembrete Amigável */}
          <g className="retail-mlogin-credit-reminder">
            <path
              d="M168 14 H262 C266.4 14, 270 17.6, 270 22 V62 C270 66.4, 266.4 70, 262 70 H196 L182 80 V70 H168 C163.6 70, 160 66.4, 160 62 V22 C160 17.6, 163.6 14, 168 14 Z"
              fill="#272321"
              stroke="#272321"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <circle cx="180" cy="42" r="12" fill="#7C3AED" />
            {/* Ícone de sino / lembrete de cobrança */}
            <path
              d="M180 34 C176.5 34, 175 36.8, 175 40 V44 L173.5 46 H186.5 L185 44 V40 C185 36.8, 183.5 34, 180 34 Z"
              fill="#FFFFFF"
            />
            <circle cx="180" cy="48.2" r="1.8" fill="#F3E8FF" />
            <rect
              x="198"
              y="26"
              width="62"
              height="11"
              rx="3.5"
              fill="#7C3AED"
            />
            <text
              x="229"
              y="33.8"
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.3"
            >
              COBRANÇA 1-CLICK
            </text>
            <rect x="198" y="42" width="58" height="5.5" rx="2.7" fill="#FFFFFF" />
            <rect x="198" y="51" width="42" height="5" rx="2.5" fill="#F3E8FF" />
          </g>

          {/* CARD FLUTUANTE INFERIOR ESQUERDO — Cartão de Crediário Exclusivo da Loja */}
          <g className="retail-mlogin-float-fast">
            <g transform="rotate(-6 56 174)">
              <rect
                x="8"
                y="142"
                width="96"
                height="62"
                rx="9"
                fill="#7C3AED"
                stroke="#272321"
                strokeWidth="1.4"
              />
              {/* Faixa geométrica escura do cartão */}
              <path
                d="M8 156 H104 V170 H8 Z"
                fill="#6D28D9"
              />
              {/* Chip branco do cartão */}
              <rect
                x="18"
                y="176"
                width="16"
                height="12"
                rx="3"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1.1"
              />
              {/* Símbolo L oficial no canto do cartão */}
              <path d="M84 176 H88 V185 H95 V189 H84 Z" fill="#FFFFFF" />
              <rect
                x="40"
                y="179"
                width="36"
                height="5"
                rx="2.5"
                fill="#F3E8FF"
              />
              <rect
                x="40"
                y="187"
                width="24"
                height="4.5"
                rx="2.2"
                fill="#FFFFFF"
              />
            </g>
          </g>

          {/* Linha de base arquitetônica */}
          <line
            x1="16"
            y1="220"
            x2="264"
            y2="220"
            stroke="#272321"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    );
  },
);

/**
 * Slide 7 — Módulo Inteligência Comercial & Ranking de Vendedores (Ilustração editorial
 * exclusiva com o Pódio Gamificado Top 3 — #2, #1 Campeão com Coroa Animada e #3 —,
 * card de Calendário com Campeão do Dia, gráfico de Meta/Comissão e Auditoria de Descontos & Trocas).
 */
const CommercialIntelligenceModuleIllustration = memo(
  function CommercialIntelligenceModuleIllustration() {
    return (
      <div className="retail-mlogin-illustration-wrap" aria-hidden="true">
        <svg
          viewBox="0 0 280 246"
          fill="none"
          className="retail-mlogin-svg is-commercial-intel"
        >
          {/* Aura circular suave de fundo + estrelas de celebração da paleta */}
          <circle cx="140" cy="122" r="86" fill="#F8F7FC" />
          <polygon
            points="140,10 143,17 151,18 145,23 147,30 140,26 133,30 135,23 129,18 137,17"
            fill="#F3E8FF"
            stroke="#272321"
            strokeWidth="1.2"
            strokeLinejoin="round"
            className="retail-mlogin-intel-crown"
          />
          <circle cx="32" cy="112" r="4" fill="#F3E8FF" />
          <circle cx="250" cy="108" r="4.5" stroke="#E5E1ED" strokeWidth="1.4" />

          {/* ================= PÓDIO GAMIFICADO TOP 3 (#2 ESQUERDA, #1 CENTRO, #3 DIREITA) ================= */}

          {/* COLUNA #2 (Esquerda) */}
          <g>
            {/* Avatar do Vendedor #2 */}
            <g className="retail-mlogin-float-slow">
              <circle
                cx="67"
                cy="108"
                r="16"
                fill="#F3E8FF"
                stroke="#272321"
                strokeWidth="1.4"
              />
              <circle
                cx="67"
                cy="104"
                r="5"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1.2"
              />
              <path
                d="M56 118 C58 111, 76 111, 78 118"
                fill="#6D28D9"
                stroke="#272321"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
            {/* Pedestal #2 */}
            <rect
              x="38"
              y="130"
              width="58"
              height="90"
              rx="6"
              fill="#F3E8FF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <circle
              cx="67"
              cy="150"
              r="11"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.3"
            />
            <text
              x="67"
              y="153.8"
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill="#272321"
            >
              #2
            </text>
            <rect x="48" y="168" width="38" height="5" rx="2.5" fill="#7C3AED" />
            <rect x="52" y="177" width="30" height="4.5" rx="2.2" fill="#665F70" />
          </g>

          {/* COLUNA #3 (Direita) */}
          <g>
            {/* Avatar do Vendedor #3 */}
            <g className="retail-mlogin-float-slow">
              <circle
                cx="213"
                cy="120"
                r="15"
                fill="#F3E8FF"
                stroke="#272321"
                strokeWidth="1.4"
              />
              <circle
                cx="213"
                cy="116"
                r="4.8"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1.2"
              />
              <path
                d="M203 129 C205 123, 221 123, 223 129"
                fill="#272321"
                stroke="#272321"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
            {/* Pedestal #3 */}
            <rect
              x="184"
              y="142"
              width="58"
              height="78"
              rx="6"
              fill="#6D28D9"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <circle
              cx="213"
              cy="161"
              r="10.5"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.3"
            />
            <text
              x="213"
              y="164.8"
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="800"
              fill="#272321"
            >
              #3
            </text>
            <rect x="194" y="178" width="38" height="5" rx="2.5" fill="#F3E8FF" />
            <rect x="198" y="187" width="30" height="4.5" rx="2.2" fill="#FFFFFF" />
          </g>

          {/* COLUNA #1 CENTRAL — CAMPEÃO DO RANKING */}
          <g>
            {/* Coroa / Escudo Animado Acima do Campeão #1 */}
            <g className="retail-mlogin-intel-crown">
              <path
                d="M124 52 L131 40 L140 48 L149 40 L156 52 Z"
                fill="#7C3AED"
                stroke="#272321"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle cx="131" cy="38" r="2.2" fill="#272321" />
              <circle cx="140" cy="35" r="2.6" fill="#7C3AED" />
              <circle cx="149" cy="38" r="2.2" fill="#272321" />
            </g>

            {/* Avatar Hero do Vendedor #1 */}
            <g className="retail-mlogin-intel-champion">
              <circle
                cx="140"
                cy="74"
                r="20"
                fill="#7C3AED"
                stroke="#272321"
                strokeWidth="1.5"
              />
              <circle
                cx="140"
                cy="69"
                r="6"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1.3"
              />
              <path
                d="M126 87 C128 78, 152 78, 154 87"
                fill="#FFFFFF"
                stroke="#272321"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </g>

            {/* Sombra deslocada do Pedestal #1 */}
            <rect
              x="108"
              y="104"
              width="72"
              height="116"
              rx="8"
              fill="#272321"
            />
            {/* Pedestal Principal #1 em Roxo Vibrante */}
            <rect
              x="104"
              y="100"
              width="72"
              height="120"
              rx="8"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.5"
            />
            {/* Listras arquitetônicas na base do pedestal #1 */}
            <path
              d="M104 196 L128 172 M112 204 L144 172 M126 206 L160 172 M142 206 L176 172"
              stroke="#6D28D9"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Medalhão #1 */}
            <circle
              cx="140"
              cy="126"
              r="15"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <text
              x="140"
              y="130.5"
              textAnchor="middle"
              fontSize="12.5"
              fontWeight="800"
              fill="#272321"
            >
              #1
            </text>
            {/* Selo META 118% */}
            <rect
              x="114"
              y="148"
              width="52"
              height="14"
              rx="4"
              fill="#272321"
            />
            <text
              x="140"
              y="157.5"
              textAnchor="middle"
              fontSize="7.2"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.3"
            >
              META 118%
            </text>
            <rect x="118" y="168" width="44" height="5.5" rx="2.7" fill="#FFFFFF" />
          </g>

          {/* CARD FLUTUANTE SUPERIOR ESQUERDO — Calendário Diário & Campeão do Dia */}
          <g className="retail-mlogin-vstore-builder">
            <rect
              x="10"
              y="20"
              width="88"
              height="64"
              rx="8"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <path
              d="M10 28 C10 23.6, 13.6 20, 18 20 H90 C94.4 20, 98 23.6, 98 28 V36 H10 Z"
              fill="#272321"
            />
            <text
              x="54"
              y="30.8"
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.4"
            >
              CAMPEÃO DO DIA
            </text>
            {/* Grade de dias do calendário */}
            <rect
              x="18"
              y="42"
              width="20"
              height="15"
              rx="3"
              fill="#F3E8FF"
              stroke="#272321"
              strokeWidth="1.1"
            />
            <rect
              x="44"
              y="42"
              width="20"
              height="15"
              rx="3"
              fill="#7C3AED"
              stroke="#272321"
              strokeWidth="1.1"
              className="retail-mlogin-vstore-size"
            />
            <text
              x="54"
              y="52"
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="800"
              fill="#FFFFFF"
            >
              #1
            </text>
            <rect
              x="70"
              y="42"
              width="20"
              height="15"
              rx="3"
              fill="#F8F7FC"
              stroke="#272321"
              strokeWidth="1.1"
            />
            <rect
              x="18"
              y="62"
              width="72"
              height="14"
              rx="4"
              fill="#F3E8FF"
            />
            <line
              x1="24"
              y1="69"
              x2="76"
              y2="69"
              stroke="#7C3AED"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>

          {/* CARD FLUTUANTE SUPERIOR DIREITO — Comissão + Auditoria de Descontos & Trocas */}
          <g className="retail-mlogin-float-fast">
            <rect
              x="180"
              y="18"
              width="90"
              height="68"
              rx="8"
              fill="#272321"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <rect
              x="188"
              y="26"
              width="74"
              height="12"
              rx="3.5"
              fill="#7C3AED"
            />
            <text
              x="225"
              y="34.5"
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.3"
            >
              COMISSÃO & METAS
            </text>
            {/* Barras ascendentes de desempenho */}
            <rect x="192" y="60" width="10" height="16" rx="2" fill="#F3E8FF" />
            <rect x="208" y="52" width="10" height="24" rx="2" fill="#6D28D9" />
            <rect x="224" y="44" width="10" height="32" rx="2" fill="#7C3AED" />
            <rect
              x="240"
              y="40"
              width="10"
              height="36"
              rx="2"
              fill="#FFFFFF"
              className="retail-mlogin-vstore-size"
            />
            {/* Linha de tendência ascendente */}
            <path
              d="M194 56 L212 48 L228 42 L246 36"
              stroke="#F3E8FF"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>

          {/* FAIXA FLUTUANTE INFERIOR — Auditoria de Descontos vs. Trocas */}
          <g className="retail-mlogin-intel-audit">
            <rect
              x="34"
              y="194"
              width="212"
              height="26"
              rx="8"
              fill="#FFFFFF"
              stroke="#272321"
              strokeWidth="1.4"
            />
            <circle cx="50" cy="207" r="8" fill="#7C3AED" />
            <path
              d="M47 207 L49.2 209.2 L53.5 204.8"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x="64"
              y="209.8"
              fontSize="7.8"
              fontWeight="800"
              fill="#272321"
              letterSpacing="0.2"
            >
              AUDITORIA DE DESCONTOS & TROCAS
            </text>
            <circle
              cx="234"
              cy="207"
              r="4"
              fill="#7C3AED"
              className="retail-mlogin-vstore-pulse"
            />
          </g>

          {/* Linha de base arquitetônica */}
          <line
            x1="16"
            y1="220"
            x2="264"
            y2="220"
            stroke="#272321"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    );
  },
);

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
  {
    id: "virtual-store",
    title: "Crie sua Loja\nVirtual Online.",
    description:
      "Publique seu catálogo digital com tamanhos e cores em tempo real, reserva automática de estoque e pedidos direto no WhatsApp.",
    Illustration: VirtualStoreModuleIllustration,
  },
  {
    id: "home-delivery",
    title: "Entrega em Casa\ncom Motoboy.",
    description:
      "Acione motoboy direto da venda online: acompanhe a coleta do pacote na loja e a entrega na porta do cliente ao vivo.",
    Illustration: HomeDeliveryMotoboyIllustration,
  },
  {
    id: "customers-credit",
    title: "Clientes, Crediário\ne Cobrança Fácil.",
    description:
      "Controle limite de crediário por cliente, parcelas em aberto no carnê, histórico de compras e envie lembretes de cobrança.",
    Illustration: CustomersCreditModuleIllustration,
  },
  {
    id: "commercial-intel",
    title: "Ranking, Pódio e\nMetas da Equipe.",
    description:
      "Acompanhe o pódio gamificado de vendedores, o campeão de cada dia no calendário, comissões e auditoria de descontos e trocas.",
    Illustration: CommercialIntelligenceModuleIllustration,
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
