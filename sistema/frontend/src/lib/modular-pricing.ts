/**
 * Catálogo oficial de módulos comercializáveis e cálculo de mensalidade do PDV Lojista.
 *
 * Plano Padrão (Base Obrigatória):
 * - Loja Padrão / Matriz: R$ 149,90/mês
 * - Filial Conectada Multi-Empresa: R$ 99,90/mês (R$ 50,00 de desconto fixo no Plano Padrão)
 *
 * Recursos inclusos no Plano Padrão (sempre liberados):
 * - Frente de Caixa (PDV) e Grade (Tamanho/Cor)
 * - Controle de Estoque, Balanço/Contagem e Entrada Manual
 * - Compras e Financeiro (Contas a Pagar e Pedidos)
 * - Clientes, Trocas e Vale-Crédito
 * - Gestão Mobile e Relatórios de Vendas/Caixas
 */

export const BASE_PLAN_PRICE = 149.9;
export const BRANCH_PLAN_PRICE = 99.9;
export const BRANCH_DISCOUNT_VALUE = Number((BASE_PLAN_PRICE - BRANCH_PLAN_PRICE).toFixed(2));

export interface CommercialModuleDefinition {
  id: string;
  label: string;
  shortBadge: string;
  price: number;
  title: string;
  description: string;
  demandLevel: "alta" | "media-alta" | "complementar" | "rede";
  dependsOn?: string;
}

export const COMMERCIAL_MODULES: ReadonlyArray<CommercialModuleDefinition> = [
  {
    id: "nfce",
    label: "Módulo Fiscal (NFC-e + Entrada XML)",
    shortBadge: "NFC-e & XML",
    price: 49.9,
    title: "Módulo Fiscal Completo (NFC-e, Tributação & Entrada XML)",
    description:
      "Emissão de cupom fiscal eletrônico (NFC-e), certificado digital A1, CSC, grupos tributários e importação de notas de compra por arquivo XML.",
    demandLevel: "alta",
  },
  {
    id: "lojaVirtual",
    label: "Módulo Loja Virtual",
    shortBadge: "Loja Virtual",
    price: 39.9,
    title: "Loja Virtual (Catálogo Público & Pedidos WhatsApp)",
    description:
      "Catálogo online personalizável em /loja/:slug integrado ao estoque da grade, carrinho, reserva de peças e conversão em venda no PDV.",
    demandLevel: "alta",
  },
  {
    id: "entregaLojaVirtual",
    label: "Módulo Entrega Loja Virtual (99 Entregas)",
    shortBadge: "99 Entregas",
    price: 24.9,
    title: "Entrega Expressa na Loja Virtual (Integração 99 Entregas)",
    description:
      "Cotação automática de frete local no checkout da Loja Virtual e solicitação de coleta por motoboy com rastreio para entrega no mesmo dia.",
    demandLevel: "complementar",
    dependsOn: "lojaVirtual",
  },
  {
    id: "crediario",
    label: "Módulo Crediário & Cobrança WhatsApp",
    shortBadge: "Crediário",
    price: 39.9,
    title: "Crediário (Fiado) & Cobrança Automática no WhatsApp",
    description:
      "Contas de clientes com limite de crédito, parcelamento na loja e régua automática de lembretes e cobrança pelo WhatsApp.",
    demandLevel: "media-alta",
  },
  {
    id: "fornecedores",
    label: "Módulo Fornecedores & Atacado SP",
    shortBadge: "Fornecedores SP",
    price: 49.9,
    title: "Gestão de Fornecedores, Pedidos Automáticos & Atacado SP",
    description:
      "Gestão completa de fornecedores, reposição automática por estoque mínimo e catálogo exclusivo de atacadistas de São Paulo com WhatsApp, fotos, preços de atacado e entrega garantida.",
    demandLevel: "media-alta",
  },
  {
    id: "vendedores",
    label: "Módulo Vendedores & Comissões",
    shortBadge: "Vendedores",
    price: 29.9,
    title: "Módulo Vendedores, Metas & Comissões",
    description:
      "Gestão de múltiplos vendedores e operadores, vínculo por venda, metas de faturamento, cálculo automático de comissão e ranking da equipe.",
    demandLevel: "alta",
  },
  {
    id: "inteligenciaComercial",
    label: "Módulo Inteligência Comercial",
    shortBadge: "Inteligência",
    price: 29.9,
    title: "Inteligência Comercial (CRM 360º, RFM & Curva ABC)",
    description:
      "Segmentação RFM (VIPs, ativos, sumidos +60d), Raio-X 360º com DNA de tamanhos e cores preferidos do cliente e análise de giro de estoque.",
    demandLevel: "complementar",
  },
  {
    id: "vitrineDigital",
    label: "Módulo Vitrine Digital & TV",
    shortBadge: "Vitrine TV",
    price: 19.9,
    title: "Vitrine Digital e Reprodutor Smart TV",
    description:
      "Programação de slides de ofertas e grades de coleção em tempo real para exibição em Smart TVs ou monitores na loja via link público /tv/:id.",
    demandLevel: "complementar",
  },
  {
    id: "multiEmpresa",
    label: "Módulo Multi-Empresa (Rede de Lojas)",
    shortBadge: "Multi-Empresa",
    price: 59.9,
    title: "Central Multi-Empresa & Conexão de Filiais",
    description:
      "Conecta múltiplas lojas do mesmo proprietário no Portal do Grupo (/grupo-portal), unifica indicadores, compartilha catálogo mestre e permite transferência de estoque entre filiais com desconto em cada loja adicional.",
    demandLevel: "rede",
  },
] as const;

export const DEFAULT_TENANT_MODULES: Record<string, boolean> = {
  // Recursos nativos do Plano Padrão (sempre inclusos)
  estoque: true,
  dashboardMobile: true,
  comprasFinanceiro: true,
  relatorios: true,
  // Módulos comercializáveis (add-ons)
  nfce: false,
  importacaoXml: false,
  lojaVirtual: false,
  entregaLojaVirtual: false,
  crediario: false,
  fornecedores: false,
  vendedores: false,
  inteligenciaComercial: false,
  vitrineDigital: false,
  multiEmpresa: false,
  // Flag de desconto para loja adicional conectada a um grupo Multi-Empresa
  filialMultiEmpresa: false,
};

export function normalizeTenantModules(raw: unknown): Record<string, boolean> {
  let parsed: Record<string, any> = {};
  try {
    if (typeof raw === "string" && raw.trim()) {
      parsed = JSON.parse(raw);
    } else if (raw && typeof raw === "object") {
      parsed = { ...(raw as Record<string, any>) };
    }
  } catch {
    parsed = {};
  }

  const nfceEnabled = Boolean(parsed.nfce || parsed.importacaoXml);
  const vitrineEnabled = Boolean(parsed.vitrineDigital || parsed.digitalSignage);

  return {
    ...DEFAULT_TENANT_MODULES,
    ...Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, Boolean(v)]),
    ),
    // Recursos do Plano Padrão permanecem sempre ativos
    estoque: true,
    dashboardMobile: true,
    comprasFinanceiro: true,
    relatorios: true,
    // Sincroniza flags equivalentes
    nfce: nfceEnabled,
    importacaoXml: nfceEnabled,
    vitrineDigital: vitrineEnabled,
    // Neutraliza flags legadas de alimentação
    comandas: false,
    kds: false,
    restaurante: false,
    carvoaria: false,
  };
}

export interface MonthlyPricingBreakdown {
  isBranch: boolean;
  basePrice: number;
  branchDiscount: number;
  addonsTotal: number;
  totalPrice: number;
  activeAddons: CommercialModuleDefinition[];
}

export function calculateTenantMonthlyPrice(
  rawModules: unknown,
): MonthlyPricingBreakdown {
  const normalized = normalizeTenantModules(rawModules);
  const isBranch = Boolean(normalized.filialMultiEmpresa);
  const basePrice = isBranch ? BRANCH_PLAN_PRICE : BASE_PLAN_PRICE;
  const branchDiscount = isBranch ? BRANCH_DISCOUNT_VALUE : 0;

  const activeAddons = COMMERCIAL_MODULES.filter((mod) =>
    Boolean(normalized[mod.id]),
  );

  const addonsTotal = Number(
    activeAddons.reduce((acc, mod) => acc + mod.price, 0).toFixed(2),
  );

  const totalPrice = Number((basePrice + addonsTotal).toFixed(2));

  return {
    isBranch,
    basePrice,
    branchDiscount,
    addonsTotal,
    totalPrice,
    activeAddons,
  };
}

export function formatBrlCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}
