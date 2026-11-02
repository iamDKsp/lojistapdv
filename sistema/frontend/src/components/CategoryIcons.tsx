"use client";

import React, { useMemo, useState } from "react";

export type CategoryIconGroup = "category" | "bonus";

export interface CategoryIconDefinition {
  id: string;
  label: string;
  shortLabel: string;
  group: CategoryIconGroup;
  keywords: string[];
}

export const CATEGORY_ICON_OPTIONS: CategoryIconDefinition[] = [
  // Categorias da Loja (18)
  {
    id: "camiseta",
    label: "Camisetas & Polos",
    shortLabel: "Camiseta",
    group: "category",
    keywords: ["camiseta", "t-shirt", "tshirt", "polo", "regata", "baby look", "babylook", "malha"],
  },
  {
    id: "camisa",
    label: "Camisas & Blusas",
    shortLabel: "Camisa",
    group: "category",
    keywords: ["camisa", "social", "blusa", "cropped", "linho", "viscose", "tricoline", "alfaiataria"],
  },
  {
    id: "calca",
    label: "Calças & Jeans",
    shortLabel: "Calça",
    group: "category",
    keywords: ["calca", "calça", "jeans", "denim", "cargo", "jogger", "sarja", "legging", "pantalona"],
  },
  {
    id: "bermuda",
    label: "Bermudas & Shorts",
    shortLabel: "Bermuda",
    group: "category",
    keywords: ["bermuda", "short", "shorts", "mauricinho", "elastano"],
  },
  {
    id: "jaqueta",
    label: "Jaquetas & Moletons",
    shortLabel: "Jaqueta",
    group: "category",
    keywords: ["jaqueta", "moletom", "casaco", "blusa de frio", "corta-vento", "corta vento", "sueter", "suéter", "cardigan", "hoodie", "blazer"],
  },
  {
    id: "vestido",
    label: "Vestidos & Macacões",
    shortLabel: "Vestido",
    group: "category",
    keywords: ["vestido", "macacao", "macacão", "macaquinho", "longo", "midi", "festa"],
  },
  {
    id: "saia",
    label: "Saias & Conjuntos",
    shortLabel: "Saia",
    group: "category",
    keywords: ["saia", "conjunto", "plissada", "evase", "evasê"],
  },
  {
    id: "calcado",
    label: "Calçados & Tênis",
    shortLabel: "Calçado",
    group: "category",
    keywords: ["tenis", "tênis", "calcado", "calçado", "sapato", "sandalia", "sandália", "chinelo", "bota", "mocassim", "sapatilha", "papete", "rasteirinha", "salto"],
  },
  {
    id: "bone",
    label: "Bonés & Chapelaria",
    shortLabel: "Boné",
    group: "category",
    keywords: ["bone", "boné", "chapeu", "chapéu", "bucket", "touca", "gorro", "viseira", "aba curva", "aba reta"],
  },
  {
    id: "relogio",
    label: "Relógios & Smartwatches",
    shortLabel: "Relógio",
    group: "category",
    keywords: ["relogio", "relógio", "smartwatch", "cronografo", "cronógrafo", "pulso", "casio"],
  },
  {
    id: "oculos",
    label: "Óculos & Armações",
    shortLabel: "Óculos",
    group: "category",
    keywords: ["oculos", "óculos", "lente", "armacao", "armação", "solar", "polarizado", "aviador"],
  },
  {
    id: "carteira",
    label: "Carteiras & Cintos",
    shortLabel: "Carteira",
    group: "category",
    keywords: ["carteira", "porta-cartao", "porta cartao", "porta-cartão", "cinto", "couro", "acessorio", "acessório", "acessorios", "acessórios"],
  },
  {
    id: "bolsa",
    label: "Bolsas & Mochilas",
    shortLabel: "Bolsa",
    group: "category",
    keywords: ["bolsa", "mochila", "necessaire", "nécessaire", "pochete", "mala", "tiracolo", "shoulder bag", "ecobag", "clutch"],
  },
  {
    id: "joia",
    label: "Joias & Semijoias",
    shortLabel: "Joia",
    group: "category",
    keywords: ["joia", "jóia", "semijoia", "bijuteria", "colar", "corrente", "pulseira", "anel", "brinco", "prata", "folheado", "pingente"],
  },
  {
    id: "perfume",
    label: "Perfumaria & Beleza",
    shortLabel: "Perfume",
    group: "category",
    keywords: ["perfume", "colonia", "colônia", "cosmetico", "cosmético", "hidratante", "body splash", "maquiagem", "beleza", "aroma"],
  },
  {
    id: "meia",
    label: "Moda Íntima & Meias",
    shortLabel: "Íntima/Meia",
    group: "category",
    keywords: ["meia", "cueca", "calcinha", "sutia", "sutiã", "lingerie", "intima", "íntima", "pijama", "boxer"],
  },
  {
    id: "praia",
    label: "Moda Praia & Fitness",
    shortLabel: "Praia/Fit",
    group: "category",
    keywords: ["praia", "biquini", "biquíni", "maio", "maiô", "sunga", "saida de praia", "saída de praia", "fitness", "academia", "treino", "esporte", "esportivo"],
  },
  {
    id: "infantil",
    label: "Moda Infantil & Bebê",
    shortLabel: "Infantil",
    group: "category",
    keywords: ["infantil", "bebe", "bebê", "kids", "juvenil", "enxoval", "body", "menino", "menina"],
  },

  // Ícones Bônus (10)
  {
    id: "cabide",
    label: "Cabide · Coleção Geral",
    shortLabel: "Cabide",
    group: "bonus",
    keywords: ["colecao", "coleção", "geral", "roupa", "vestuario", "vestuário", "moda"],
  },
  {
    id: "sacola",
    label: "Sacola · Boutique",
    shortLabel: "Boutique",
    group: "bonus",
    keywords: ["sacola", "boutique", "loja", "compras", "varejo"],
  },
  {
    id: "estrela",
    label: "Estrela · Destaques",
    shortLabel: "Destaque",
    group: "bonus",
    keywords: ["destaque", "mais vendidos", "campeao", "campeão", "top", "best seller"],
  },
  {
    id: "diamante",
    label: "Diamante · Linha Premium",
    shortLabel: "Premium",
    group: "bonus",
    keywords: ["premium", "luxo", "importado", "grife", "prime", "ouro"],
  },
  {
    id: "etiqueta",
    label: "Etiqueta · Promoções & Outlet",
    shortLabel: "Promoção",
    group: "bonus",
    keywords: ["promocao", "promoção", "oferta", "outlet", "liquidacao", "liquidação", "desconto", "queima"],
  },
  {
    id: "presente",
    label: "Presente · Kits & Combos",
    shortLabel: "Presente/Kit",
    group: "bonus",
    keywords: ["presente", "kit", "combo", "lembrancinha", "caixa", "natal", "dia das maes", "dia dos pais"],
  },
  {
    id: "raio",
    label: "Raio · Lançamentos & Drops",
    shortLabel: "Lançamento",
    group: "bonus",
    keywords: ["lancamento", "lançamento", "novidade", "drop", "novo", "express"],
  },
  {
    id: "coracao",
    label: "Coração · Favoritos",
    shortLabel: "Favoritos",
    group: "bonus",
    keywords: ["favorito", "queridinho", "amor", "selecao", "seleção"],
  },
  {
    id: "coroa",
    label: "Coroa · Edição Especial",
    shortLabel: "VIP/Especial",
    group: "bonus",
    keywords: ["vip", "especial", "exclusivo", "limitado", "edicao", "edição"],
  },
  {
    id: "floco",
    label: "Inverno & Tricô",
    shortLabel: "Inverno",
    group: "bonus",
    keywords: ["inverno", "trico", "tricô", "la", "lã", "cachecol", "termica", "térmica"],
  },
];

const STORAGE_KEY = "pdv_lojista_category_icons_v1";

function normalizeText(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getSavedCategoryIconsMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCategoryIconPreference(
  categoryIdOrName: string,
  iconId: string | null | undefined,
  categoryName?: string
) {
  if (typeof window === "undefined") return;
  try {
    const map = getSavedCategoryIconsMap();
    const cleanId = String(categoryIdOrName || "").trim();
    const cleanName = normalizeText(categoryName || categoryIdOrName);
    if (iconId && CATEGORY_ICON_OPTIONS.some((o) => o.id === iconId)) {
      if (cleanId) map[`id:${cleanId}`] = iconId;
      if (cleanName) map[`name:${cleanName}`] = iconId;
    } else {
      if (cleanId) delete map[`id:${cleanId}`];
      if (cleanName) delete map[`name:${cleanName}`];
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export function syncCategoriesIconsToStorage(
  categories: Array<{ id?: string; name?: string; icon?: string | null }>
) {
  if (typeof window === "undefined" || !Array.isArray(categories)) return;
  try {
    const map = getSavedCategoryIconsMap();
    let changed = false;
    for (const cat of categories) {
      if (cat?.icon && CATEGORY_ICON_OPTIONS.some((o) => o.id === cat.icon)) {
        if (cat.id && map[`id:${cat.id}`] !== cat.icon) {
          map[`id:${cat.id}`] = cat.icon;
          changed = true;
        }
        const norm = normalizeText(cat.name);
        if (norm && map[`name:${norm}`] !== cat.icon) {
          map[`name:${norm}`] = cat.icon;
          changed = true;
        }
      }
    }
    if (changed) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

export function detectIconFromText(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return "camiseta";

  // Check more specific keywords first (e.g., camiseta before camisa, relogio before acessorio)
  const priorityOrder = [
    "relogio",
    "oculos",
    "bone",
    "calcado",
    "bermuda",
    "vestido",
    "saia",
    "jaqueta",
    "calca",
    "bolsa",
    "joia",
    "perfume",
    "meia",
    "praia",
    "infantil",
    "camiseta",
    "camisa",
    "carteira",
    "presente",
    "etiqueta",
    "diamante",
    "estrela",
    "raio",
    "coracao",
    "coroa",
    "floco",
    "sacola",
    "cabide",
  ];

  for (const iconId of priorityOrder) {
    const def = CATEGORY_ICON_OPTIONS.find((item) => item.id === iconId);
    if (!def) continue;
    for (const kw of def.keywords) {
      const normKw = normalizeText(kw);
      if (normKw && normalized.includes(normKw)) {
        return def.id;
      }
    }
  }

  return "cabide";
}

export function resolveCategoryIconId(params: {
  explicitIcon?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  productName?: string | null;
}): string {
  const { explicitIcon, categoryId, categoryName, productName } = params;

  if (explicitIcon && CATEGORY_ICON_OPTIONS.some((o) => o.id === explicitIcon)) {
    return explicitIcon;
  }

  const savedMap = getSavedCategoryIconsMap();
  if (categoryId && savedMap[`id:${categoryId}`]) {
    return savedMap[`id:${categoryId}`];
  }
  const normCat = normalizeText(categoryName);
  if (normCat && savedMap[`name:${normCat}`]) {
    return savedMap[`name:${normCat}`];
  }

  // If productName has a very specific item type (like "Relógio casual" inside "Acessórios"), check productName + categoryName
  if (productName) {
    const fromProduct = detectIconFromText(productName);
    if (fromProduct !== "cabide") return fromProduct;
  }

  if (categoryName) {
    const fromCategory = detectIconFromText(categoryName);
    if (fromCategory !== "cabide") return fromCategory;
  }

  return productName || categoryName ? detectIconFromText(`${productName || ""} ${categoryName || ""}`) : "camiseta";
}

export function getCategoryIconDefinition(iconId: string): CategoryIconDefinition {
  return (
    CATEGORY_ICON_OPTIONS.find((item) => item.id === iconId) ||
    CATEGORY_ICON_OPTIONS[0]
  );
}

/**
 * Renderiza o glifo SVG vetorial (em viewBox 0 0 120 96) usando exclusivamente
 * os tokens aprovados da paleta roxa, branca e neutra.
 */
function renderVectorGlyph(iconId: string) {
  switch (iconId) {
    case "camiseta":
      return (
        <>
          <path
            d="M35 20 L47 13 H73 L85 20 L102 37 L90 49 L79 39 V80 H41 V39 L30 49 L18 37 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M47 13 C50 23, 70 23, 73 13"
            fill="var(--pdv-support)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M47 32 H73"
            stroke="var(--pdv-white)"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.75"
          />
        </>
      );

    case "camisa":
      return (
        <>
          <path
            d="M36 18 L48 12 H72 L84 18 L99 36 L88 47 L78 38 V81 H42 V38 L32 47 L21 36 Z"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M48 12 L60 26 L72 12"
            fill="var(--pdv-support)"
            stroke="var(--pdv-text)"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path
            d="M60 26 V81"
            stroke="var(--pdv-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="38" r="2" fill="var(--pdv-text)" />
          <circle cx="60" cy="50" r="2" fill="var(--pdv-text)" />
          <circle cx="60" cy="62" r="2" fill="var(--pdv-text)" />
          <rect
            x="65"
            y="36"
            width="9"
            height="10"
            rx="2"
            fill="var(--pdv-support)"
            stroke="var(--pdv-primary)"
            strokeWidth="1.8"
          />
        </>
      );

    case "calca":
      return (
        <>
          <path
            d="M38 14 H82 L88 82 H66 L60 44 L54 82 H32 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <rect
            x="38"
            y="14"
            width="44"
            height="9"
            rx="2"
            fill="var(--pdv-text)"
          />
          <path
            d="M60 23 V42 M40 28 C46 28, 49 32, 49 37 M80 28 C74 28, 71 32, 71 37"
            stroke="var(--pdv-white)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      );

    case "bermuda":
      return (
        <>
          <path
            d="M34 18 H86 L92 68 H65 L60 46 L55 68 H28 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <rect
            x="34"
            y="18"
            width="52"
            height="10"
            rx="3"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.6"
          />
          <path
            d="M57 23 V34 M63 23 V32"
            stroke="var(--pdv-primary)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M36 35 C43 35, 46 39, 46 45 M84 35 C77 35, 74 39, 74 45"
            stroke="var(--pdv-white)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      );

    case "jaqueta":
      return (
        <>
          <path
            d="M36 18 L48 12 H72 L84 18 L102 42 L90 52 L79 38 V80 H41 V38 L30 52 L18 42 Z"
            fill="var(--pdv-text)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M48 12 L60 28 L72 12"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-white)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M60 28 V80"
            stroke="var(--pdv-primary)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M47 58 H55 M65 58 H73"
            stroke="var(--pdv-white)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      );

    case "vestido":
      return (
        <>
          <path
            d="M45 14 L52 26 H68 L75 14 L81 28 L72 43 L92 80 H28 L48 43 L39 28 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M48 43 H72"
            stroke="var(--pdv-white)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M52 54 L44 76 M68 54 L76 76 M60 52 V76"
            stroke="var(--pdv-support)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </>
      );

    case "saia":
      return (
        <>
          <rect
            x="40"
            y="18"
            width="40"
            height="10"
            rx="3"
            fill="var(--pdv-text)"
          />
          <path
            d="M40 28 H80 L94 78 H26 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M50 32 L42 74 M60 32 V74 M70 32 L78 74"
            stroke="var(--pdv-white)"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </>
      );

    case "calcado":
      return (
        <>
          <path
            d="M20 62 C20 49, 33 44, 46 42 L64 26 L76 30 L86 46 L102 50 C108 52, 110 58, 110 66 V70 H18 V64 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <rect
            x="16"
            y="68"
            width="96"
            height="10"
            rx="5"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
          />
          <path
            d="M57 38 L66 42 M63 33 L72 37 M34 56 H58"
            stroke="var(--pdv-white)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );

    case "bone":
      return (
        <>
          <path
            d="M24 58 C24 31, 41 18, 62 18 C83 18, 96 31, 97 58 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M62 18 C52 28, 48 42, 48 58 M62 18 C72 28, 76 42, 76 58"
            stroke="var(--pdv-white)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="62" cy="16" r="3.5" fill="var(--pdv-text)" />
          <path
            d="M22 58 H99 C108 58, 114 63, 116 68 H48 C34 68, 24 63, 22 58 Z"
            fill="var(--pdv-text)"
          />
        </>
      );

    case "relogio":
      return (
        <>
          <rect
            x="48"
            y="8"
            width="24"
            height="80"
            rx="6"
            fill="var(--pdv-text)"
          />
          <rect
            x="84"
            y="43"
            width="6"
            height="10"
            rx="2"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2"
          />
          <circle
            cx="60"
            cy="48"
            r="26"
            fill="var(--pdv-white)"
            stroke="var(--pdv-primary)"
            strokeWidth="4"
          />
          <circle
            cx="60"
            cy="48"
            r="22"
            fill="none"
            stroke="var(--pdv-text)"
            strokeWidth="2"
          />
          <path
            d="M60 33 V48 L71 55"
            stroke="var(--pdv-text)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="60" cy="48" r="3" fill="var(--pdv-primary)" />
        </>
      );

    case "oculos":
      return (
        <>
          <path
            d="M14 42 L26 32 M106 42 L94 32"
            stroke="var(--pdv-text)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="16"
            y="36"
            width="38"
            height="28"
            rx="10"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="3"
          />
          <rect
            x="66"
            y="36"
            width="38"
            height="28"
            rx="10"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="3"
          />
          <path
            d="M54 44 H66 M54 50 H66"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M24 44 L32 56 M74 44 L82 56"
            stroke="var(--pdv-white)"
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.85"
          />
        </>
      );

    case "carteira":
      return (
        <>
          <rect
            x="22"
            y="22"
            width="74"
            height="54"
            rx="10"
            fill="var(--pdv-text)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
          />
          <path
            d="M28 30 H88"
            stroke="var(--pdv-support)"
            strokeWidth="2"
            strokeDasharray="4 4"
            opacity="0.65"
          />
          <path
            d="M72 39 H99 V59 H72 C65 59, 61 54, 61 49 C61 44, 65 39, 72 39 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-white)"
            strokeWidth="2.4"
          />
          <circle cx="71" cy="49" r="3" fill="var(--pdv-white)" />
        </>
      );

    case "bolsa":
      return (
        <>
          <path
            d="M44 34 V24 C44 15, 76 15, 76 24 V34"
            fill="none"
            stroke="var(--pdv-text)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M28 32 H92 L98 78 C98 81, 95 83, 92 83 H28 C25 83, 22 81, 22 78 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M26 46 Q60 58 94 46"
            fill="none"
            stroke="var(--pdv-white)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <rect
            x="54"
            y="46"
            width="12"
            height="12"
            rx="3"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.4"
          />
        </>
      );

    case "joia":
      return (
        <>
          <path
            d="M32 16 C32 42, 88 42, 88 16"
            fill="none"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeDasharray="3 3"
            strokeLinecap="round"
          />
          <polygon
            points="60,36 78,52 60,82 42,52"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <polygon
            points="60,42 70,52 60,72 50,52"
            fill="var(--pdv-support)"
            opacity="0.7"
          />
          <path
            d="M26 52 H34 M30 48 V56 M86 44 H92 M89 41 V47"
            stroke="var(--pdv-primary)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      );

    case "perfume":
      return (
        <>
          <rect
            x="50"
            y="12"
            width="20"
            height="10"
            rx="3"
            fill="var(--pdv-text)"
          />
          <rect
            x="54"
            y="22"
            width="12"
            height="8"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.4"
          />
          <path
            d="M70 17 H82 C86 17, 88 20, 88 24"
            fill="none"
            stroke="var(--pdv-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <rect
            x="34"
            y="30"
            width="52"
            height="52"
            rx="14"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
          />
          <rect
            x="43"
            y="44"
            width="34"
            height="24"
            rx="6"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.2"
          />
          <path
            d="M51 56 H69"
            stroke="var(--pdv-primary)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      );

    case "meia":
      return (
        <>
          <path
            d="M46 14 H70 V48 C70 58, 84 60, 88 68 C91 74, 86 82, 76 82 H52 C42 82, 38 74, 42 64 L46 52 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <rect
            x="46"
            y="14"
            width="24"
            height="10"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.6"
          />
          <path
            d="M46 30 H70"
            stroke="var(--pdv-white)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M46 56 C54 56, 58 62, 56 70"
            fill="none"
            stroke="var(--pdv-support)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );

    case "praia":
      return (
        <>
          <circle
            cx="60"
            cy="36"
            r="16"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
          />
          <path
            d="M60 12 V16 M60 56 V60 M36 36 H40 M80 36 H84 M43 19 L46 22 M74 50 L77 53 M77 19 L74 22 M46 50 L43 53"
            stroke="var(--pdv-primary)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M22 68 Q36 60 50 68 T78 68 T98 68"
            fill="none"
            stroke="var(--pdv-text)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M28 78 Q42 70 56 78 T84 78"
            fill="none"
            stroke="var(--pdv-primary)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </>
      );

    case "infantil":
      return (
        <>
          <path
            d="M38 18 L48 13 H72 L82 18 L96 32 L86 42 L78 35 V62 C78 70, 70 82, 60 82 C50 82, 42 70, 42 62 V35 L34 42 L24 32 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M48 13 C52 21, 68 21, 72 13"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.6"
          />
          <circle cx="60" cy="44" r="8" fill="var(--pdv-white)" />
          <circle cx="56" cy="75" r="2" fill="var(--pdv-white)" />
          <circle cx="64" cy="75" r="2" fill="var(--pdv-white)" />
        </>
      );

    case "cabide":
      return (
        <>
          <path
            d="M60 32 C60 26, 69 24, 69 18 C69 13, 64 10, 59 10 C54 10, 51 13, 51 17"
            fill="none"
            stroke="var(--pdv-text)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M60 32 L100 62 C104 65, 102 72, 96 72 H24 C18 72, 16 65, 20 62 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M36 62 H84"
            stroke="var(--pdv-white)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </>
      );

    case "sacola":
      return (
        <>
          <path
            d="M32 30 H88 L94 82 H26 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M46 36 V22 C46 13, 74 13, 74 22 V36"
            fill="none"
            stroke="var(--pdv-text)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="46" cy="38" r="2.5" fill="var(--pdv-white)" />
          <circle cx="74" cy="38" r="2.5" fill="var(--pdv-white)" />
          <rect
            x="44"
            y="50"
            width="32"
            height="16"
            rx="5"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2"
          />
        </>
      );

    case "estrela":
      return (
        <>
          <polygon
            points="60,12 71,36 97,39 78,57 83,83 60,70 37,83 42,57 23,39 49,36"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <polygon
            points="60,24 66,39 82,41 70,52 73,68 60,60 47,68 50,52 38,41 54,39"
            fill="var(--pdv-support)"
            opacity="0.65"
          />
        </>
      );

    case "diamante":
      return (
        <>
          <polygon
            points="38,18 82,18 100,40 60,84 20,40"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M20 40 H100 M38 18 L48 40 L60 84 L72 40 L82 18 M48 40 L60 18 L72 40"
            fill="none"
            stroke="var(--pdv-white)"
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.85"
          />
        </>
      );

    case "etiqueta":
      return (
        <>
          <path
            d="M26 18 H62 L96 52 L64 84 L30 50 V22 C30 20, 28 18, 26 18 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <circle
            cx="44"
            cy="34"
            r="5"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.4"
          />
          <path
            d="M54 60 L68 46 M53 48 H56 M65 58 H68"
            stroke="var(--pdv-white)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );

    case "presente":
      return (
        <>
          <rect
            x="28"
            y="40"
            width="64"
            height="42"
            rx="6"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
          />
          <rect
            x="24"
            y="28"
            width="72"
            height="14"
            rx="4"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
          />
          <rect x="55" y="28" width="10" height="54" fill="var(--pdv-text)" />
          <path
            d="M60 28 C48 28, 40 20, 44 14 C48 9, 57 16, 60 28 C63 16, 72 9, 76 14 C80 20, 72 28, 60 28 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
        </>
      );

    case "raio":
      return (
        <>
          <circle
            cx="60"
            cy="48"
            r="34"
            fill="var(--pdv-support)"
            stroke="var(--pdv-primary)"
            strokeWidth="2.5"
          />
          <polygon
            points="66,14 36,52 57,52 52,82 84,44 63,44"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
        </>
      );

    case "coracao":
      return (
        <>
          <path
            d="M60 80 C60 80, 22 56, 22 34 C22 21, 33 14, 44 14 C52 14, 57 19, 60 25 C63 19, 68 14, 76 14 C87 14, 98 21, 98 34 C98 56, 60 80, 60 80 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M34 32 C34 26, 39 22, 44 22"
            fill="none"
            stroke="var(--pdv-white)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </>
      );

    case "coroa":
      return (
        <>
          <path
            d="M22 68 L18 28 L44 46 L60 20 L76 46 L102 28 L98 68 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <rect
            x="22"
            y="68"
            width="76"
            height="10"
            rx="4"
            fill="var(--pdv-text)"
          />
          <circle cx="60" cy="18" r="4" fill="var(--pdv-white)" stroke="var(--pdv-text)" strokeWidth="2" />
          <circle cx="18" cy="26" r="3.5" fill="var(--pdv-white)" stroke="var(--pdv-text)" strokeWidth="2" />
          <circle cx="102" cy="26" r="3.5" fill="var(--pdv-white)" stroke="var(--pdv-text)" strokeWidth="2" />
        </>
      );

    case "floco":
      return (
        <>
          <path
            d="M60 12 V84 M24 48 H96 M35 23 L85 73 M85 23 L35 73"
            stroke="var(--pdv-primary)"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="48"
            r="10"
            fill="var(--pdv-white)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
          />
          <circle cx="60" cy="48" r="4" fill="var(--pdv-primary)" />
        </>
      );

    default:
      return (
        <>
          <path
            d="M35 20 L47 13 H73 L85 20 L102 37 L90 49 L79 39 V80 H41 V39 L30 49 L18 37 Z"
            fill="var(--pdv-primary)"
            stroke="var(--pdv-text)"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

/**
 * Ilustração vetorial rica para Cards de Produto (PDV, Catálogo e Preview).
 */
export function CategoryIconIllustration({
  iconId,
  categoryId,
  categoryName,
  productName,
  compact = false,
}: {
  iconId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  productName?: string | null;
  compact?: boolean;
}) {
  const resolvedId = resolveCategoryIconId({
    explicitIcon: iconId,
    categoryId,
    categoryName,
    productName,
  });

  if (compact) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at 50% 35%, var(--pdv-support) 0%, var(--pdv-background) 78%)",
          padding: 4,
        }}
      >
        <svg
          viewBox="0 0 120 96"
          style={{ width: "86%", height: "86%", overflow: "visible" }}
        >
          {renderVectorGlyph(resolvedId)}
        </svg>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 50% 35%, var(--pdv-support) 0%, var(--pdv-background) 78%)",
        position: "relative",
        padding: 12,
      }}
    >
      <svg
        viewBox="0 0 120 96"
        style={{
          width: "74%",
          height: "74%",
          maxWidth: 112,
          maxHeight: 88,
          overflow: "visible",
        }}
      >
        <circle cx="60" cy="48" r="38" fill="var(--pdv-support)" />
        {renderVectorGlyph(resolvedId)}
      </svg>
      <span
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          padding: "2px 7px",
          borderRadius: 6,
          background: "var(--pdv-white)",
          border: "1px solid var(--pdv-border)",
          color: "var(--pdv-text-secondary)",
          fontSize: 10,
          fontWeight: 700,
          maxWidth: "85%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {categoryName || getCategoryIconDefinition(resolvedId).shortLabel}
      </span>
    </div>
  );
}

/**
 * Ícone compacto para botões de categoria no PDV, tabelas e listas.
 */
export function CategoryIconBadge({
  iconId,
  categoryId,
  categoryName,
  size = 20,
}: {
  iconId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  size?: number;
}) {
  const resolvedId = resolveCategoryIconId({
    explicitIcon: iconId,
    categoryId,
    categoryName,
  });

  return (
    <svg
      viewBox="0 0 120 96"
      width={size}
      height={Math.round(size * 0.8)}
      aria-hidden="true"
      style={{ flexShrink: 0, overflow: "visible" }}
    >
      {renderVectorGlyph(resolvedId)}
    </svg>
  );
}

export const SUGGESTED_CATEGORY_NAMES_BY_ICON: Record<string, string> = {
  camiseta: "Camisetas",
  camisa: "Camisas",
  calca: "Calças",
  bermuda: "Bermudas",
  jaqueta: "Jaquetas",
  vestido: "Vestidos",
  saia: "Saias",
  calcado: "Calçados",
  bone: "Bonés",
  relogio: "Relógios",
  oculos: "Óculos",
  carteira: "Acessórios",
  bolsa: "Bolsas",
  joia: "Joias",
  perfume: "Perfumaria",
  meia: "Moda Íntima",
  praia: "Moda Praia & Fitness",
  infantil: "Moda Infantil",
  cabide: "Coleção Geral",
  sacola: "Boutique",
  estrela: "Destaques",
  diamante: "Linha Premium",
  etiqueta: "Promoções & Outlet",
  presente: "Kits & Presentes",
  raio: "Lançamentos",
  coracao: "Favoritos",
  coroa: "Especiais",
  floco: "Inverno & Tricô",
};

export function getSuggestedCategoryName(iconId: string): string {
  return SUGGESTED_CATEGORY_NAMES_BY_ICON[iconId] || "Nova Categoria";
}

/**
 * Seletor interativo de Ícones de Categoria + Ícones Bônus com Preview ao Vivo.
 * Usado na criação/edição de categoria em `/estoque/categorias` e no modal de Grupo de Mercadorias.
 */
export function CategoryIconPicker({
  value,
  categoryName,
  onChange,
  compact = false,
  categoryActive = true,
  onSuggestName,
}: {
  value: string | null | undefined;
  categoryName: string;
  onChange: (iconId: string | null) => void;
  compact?: boolean;
  categoryActive?: boolean;
  onSuggestName?: (suggestedName: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"all" | "category" | "bonus">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const autoDetectedId = useMemo(
    () => detectIconFromText(categoryName || "Camisetas"),
    [categoryName]
  );

  const effectiveIconId = value || autoDetectedId;
  const effectiveDef = getCategoryIconDefinition(effectiveIconId);
  const suggestedName = getSuggestedCategoryName(effectiveIconId);
  const displayCategoryName = categoryName.trim() || suggestedName || "Nova Categoria";

  const filteredOptions = useMemo(() => {
    const base =
      activeTab === "category"
        ? CATEGORY_ICON_OPTIONS.filter((o) => o.group === "category")
        : activeTab === "bonus"
        ? CATEGORY_ICON_OPTIONS.filter((o) => o.group === "bonus")
        : CATEGORY_ICON_OPTIONS;

    const normSearch = normalizeText(searchQuery);
    if (!normSearch) return base;

    return base.filter((opt) => {
      const hay = normalizeText(
        `${opt.label} ${opt.shortLabel} ${getSuggestedCategoryName(opt.id)} ${opt.keywords.join(" ")}`
      );
      return hay.includes(normSearch);
    });
  }, [activeTab, searchQuery]);

  return (
    <div
      style={{
        display: "grid",
        gap: compact ? 10 : 14,
        padding: compact ? 12 : 16,
        borderRadius: 14,
        background: "var(--pdv-background)",
        border: "1px solid var(--pdv-border)",
      }}
    >
      {/* Bloco de Preview em Tempo Real (Card de Mercadoria + Pílula do PDV) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "92px 1fr" : "136px 1fr",
          gap: 14,
          alignItems: "stretch",
          padding: 12,
          borderRadius: 12,
          background: "var(--pdv-white)",
          border: "1px solid var(--pdv-border)",
        }}
      >
        {/* Mini Card de Produto Simulado */}
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid var(--pdv-border)",
            background: "var(--pdv-white)",
            display: "flex",
            flexDirection: "column",
            opacity: categoryActive ? 1 : 0.65,
          }}
        >
          <div style={{ height: compact ? 64 : 78, position: "relative" }}>
            <CategoryIconIllustration
              iconId={effectiveIconId}
              categoryName={displayCategoryName}
            />
            <span
              style={{
                position: "absolute",
                top: 5,
                left: 5,
                padding: "2px 6px",
                borderRadius: 999,
                fontSize: 8,
                fontWeight: 800,
                background: "var(--pdv-text)",
                color: "var(--pdv-white)",
              }}
            >
              10+ itens
            </span>
          </div>
          {!compact && (
            <div
              style={{
                padding: "5px 7px",
                borderTop: "1px solid var(--pdv-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "var(--pdv-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {effectiveDef.shortLabel}
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "var(--pdv-primary)",
                }}
              >
                PDV
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 7, minWidth: 0, alignContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--pdv-primary)",
              }}
            >
              Simulação ao Vivo · PDV & Catálogo
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: categoryActive ? "var(--pdv-support)" : "var(--pdv-background)",
                  color: categoryActive ? "var(--pdv-primary)" : "var(--pdv-text-secondary)",
                  border: "1px solid var(--pdv-border)",
                }}
              >
                {categoryActive ? "● Ativa no PDV" : "○ Oculta no PDV"}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "var(--pdv-support)",
                  color: "var(--pdv-primary)",
                }}
              >
                {value ? `Ícone: ${effectiveDef.shortLabel}` : `Automático (${effectiveDef.shortLabel})`}
              </span>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--pdv-text-secondary)",
              lineHeight: 1.35,
            }}
          >
            { effectiveDef.label } — pílula de filtro no caixa e estampa dos produtos:
          </p>

          {/* Simulação do botão de filtro de categoria do PDV */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 12px",
                borderRadius: 999,
                background: categoryActive ? "var(--pdv-primary)" : "var(--pdv-background)",
                color: categoryActive ? "var(--pdv-white)" : "var(--pdv-text-secondary)",
                border: categoryActive ? "1px solid var(--pdv-primary)" : "1px dashed var(--pdv-border)",
                fontSize: 12,
                fontWeight: 800,
                maxWidth: "100%",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: "var(--pdv-white)",
                  display: "inline-grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <CategoryIconBadge iconId={effectiveIconId} size={15} />
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayCategoryName}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: categoryActive ? "var(--pdv-white)" : "var(--pdv-support)",
                  color: "var(--pdv-primary)",
                }}
              >
                10
              </span>
            </span>

            {onSuggestName && categoryName.trim().toLowerCase() !== suggestedName.toLowerCase() && (
              <button
                type="button"
                onClick={() => onSuggestName(suggestedName)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--pdv-border)",
                  background: "var(--pdv-support)",
                  color: "var(--pdv-primary)",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Usar nome &ldquo;{suggestedName}&rdquo;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Busca + Abas: Todos / Categorias / Ícones Bônus + Botão Automático */}
      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        {!compact && (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ícone por nome ou estilo (ex: relógio, vestido, tênis, premium, inverno)..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--pdv-border)",
                background: "var(--pdv-white)",
                color: "var(--pdv-text)",
                fontSize: 12,
                fontWeight: 600,
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--pdv-border)",
                  background: "var(--pdv-background)",
                  color: "var(--pdv-text-secondary)",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Limpar
              </button>
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[
              { id: "all" as const, label: `Todos (${CATEGORY_ICON_OPTIONS.length})` },
              {
                id: "category" as const,
                label: `Categorias Loja (${CATEGORY_ICON_OPTIONS.filter((o) => o.group === "category").length})`,
              },
              {
                id: "bonus" as const,
                label: `Ícones Bônus (${CATEGORY_ICON_OPTIONS.filter((o) => o.group === "bonus").length})`,
              },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: `1px solid ${active ? "var(--pdv-primary)" : "var(--pdv-border)"}`,
                    background: active ? "var(--pdv-support)" : "var(--pdv-white)",
                    color: active ? "var(--pdv-primary)" : "var(--pdv-text-secondary)",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              padding: "5px 10px",
              borderRadius: 8,
              border: `1px solid ${!value ? "var(--pdv-primary)" : "var(--pdv-border)"}`,
              background: !value ? "var(--pdv-primary)" : "var(--pdv-white)",
              color: !value ? "var(--pdv-white)" : "var(--pdv-text-secondary)",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Automático pelo nome
          </button>
        </div>
      </div>

      {/* Grade de Ícones para Escolha */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact
            ? "repeat(auto-fill, minmax(76px, 1fr))"
            : "repeat(auto-fill, minmax(92px, 1fr))",
          gap: 7,
          maxHeight: compact ? 185 : 270,
          overflowY: "auto",
          paddingRight: 2,
        }}
      >
        {filteredOptions.map((option) => {
          const isSelected = value === option.id;
          const isAutoMatch = !value && autoDetectedId === option.id;
          const active = isSelected || isAutoMatch;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                if (onSuggestName && !categoryName.trim()) {
                  onSuggestName(getSuggestedCategoryName(option.id));
                }
              }}
              title={`${option.label} — Sugestão: ${getSuggestedCategoryName(option.id)}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "8px 5px",
                borderRadius: 10,
                border: active
                  ? "2px solid var(--pdv-primary)"
                  : "1px solid var(--pdv-border)",
                background: active ? "var(--pdv-support)" : "var(--pdv-white)",
                color: "var(--pdv-text)",
                cursor: "pointer",
                position: "relative",
                minHeight: 68,
              }}
            >
              {option.group === "bonus" && (
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    fontSize: 8,
                    fontWeight: 800,
                    padding: "1px 4px",
                    borderRadius: 4,
                    background: active ? "var(--pdv-primary)" : "var(--pdv-background)",
                    color: active ? "var(--pdv-white)" : "var(--pdv-primary)",
                    border: "1px solid var(--pdv-border)",
                  }}
                >
                  BÔNUS
                </span>
              )}
              <CategoryIconBadge iconId={option.id} size={30} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 800 : 700,
                  color: active ? "var(--pdv-primary)" : "var(--pdv-text-secondary)",
                  textAlign: "center",
                  lineHeight: 1.15,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {option.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
