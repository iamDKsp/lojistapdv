import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedDefaultGruposStatic } from '../tributacao/tributacao.service';

export const DEMO_DATABASE_NAME = 'lojista_demonstracao';
export const DEMO_LEGACY_DB_NAMES = [
  'lojista_demonstracao',
  'demo_lojista',
  'lojista_demo_local',
];
export const DEMO_USER_EMAIL = 'demo@lojista.local';
export const DEMO_USER_PASSWORD = 'Lojista123!';
export const DEMO_OPERATOR_PIN = '1234';

/**
 * Normaliza um número de WhatsApp para conter apenas dígitos (DDD + número, 10 ou 11 dígitos).
 * Remove prefixo de país 55 quando informado com 12 ou 13 dígitos.
 */
export function normalizeWhatsapp(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

export function isValidWhatsapp(raw: string): boolean {
  const clean = normalizeWhatsapp(raw);
  return clean.length === 10 || clean.length === 11;
}

function buildSvgDataUri(svgContent: string): string {
  const compact = svgContent.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(compact)}`;
}

/**
 * Fotos vetoriais de estúdio na paleta oficial roxa, branca e neutra aprovada.
 */
export const DEMO_PRODUCT_IMAGES: Record<string, string> = {
  camiseta_pima: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="164" r="108" fill="#F3E8FF"/>
      <path d="M138 66 C144 54, 176 54, 182 66" stroke="#272321" stroke-width="5" stroke-linecap="round"/>
      <path d="M104 78 L132 66 C142 80, 178 80, 188 66 L216 78 L254 122 L222 148 L204 124 V246 H116 V124 L98 148 L66 122 Z" fill="#7C3AED" stroke="#272321" stroke-width="5" stroke-linejoin="round"/>
      <path d="M132 66 C142 84, 178 84, 188 66" fill="#6D28D9" stroke="#272321" stroke-width="4"/>
      <rect x="170" y="122" width="20" height="24" rx="4" fill="#F3E8FF" stroke="#272321" stroke-width="3.5"/>
      <line x1="116" y1="228" x2="204" y2="228" stroke="#F3E8FF" stroke-width="4" stroke-dasharray="8 6"/>
      <rect x="118" y="264" width="84" height="22" rx="11" fill="#272321"/>
      <text x="160" y="279" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">ALGODÃO PIMA</text>
    </svg>
  `),
  camiseta_basica: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="164" r="108" fill="#F3E8FF"/>
      <path d="M104 80 L132 68 C142 82, 178 82, 188 68 L216 80 L252 122 L220 148 L204 126 V244 H116 V126 L100 148 L68 122 Z" fill="#FFFFFF" stroke="#272321" stroke-width="5" stroke-linejoin="round"/>
      <path d="M116 154 H204 M116 178 H204 M116 202 H204" stroke="#F3E8FF" stroke-width="8"/>
      <circle cx="160" cy="122" r="12" fill="#7C3AED" stroke="#272321" stroke-width="3.5"/>
      <rect x="118" y="264" width="84" height="22" rx="11" fill="#7C3AED"/>
      <text x="160" y="279" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">LINHA BÁSICA</text>
    </svg>
  `),
  tenis_casual: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="160" r="108" fill="#F3E8FF"/>
      <ellipse cx="160" cy="236" rx="102" ry="12" fill="#E5E1ED"/>
      <path d="M62 198 H258 C264 198, 268 202, 268 208 V216 C268 222, 262 226, 254 226 H68 C60 226, 56 220, 56 212 V204 C56 200, 59 198, 62 198 Z" fill="#FFFFFF" stroke="#272321" stroke-width="5"/>
      <path d="M68 198 L76 122 C96 122, 114 140, 128 140 C138 140, 146 116, 158 116 L222 154 C244 162, 258 176, 260 198 Z" fill="#7C3AED" stroke="#272321" stroke-width="5" stroke-linejoin="round"/>
      <path d="M110 198 C126 168, 162 162, 198 198" fill="#6D28D9" stroke="#272321" stroke-width="4"/>
      <line x1="154" y1="128" x2="170" y2="118" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="170" y1="138" x2="186" y2="128" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="186" y1="148" x2="202" y2="138" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round"/>
      <rect x="114" y="264" width="92" height="22" rx="11" fill="#272321"/>
      <text x="160" y="279" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">TÊNIS URBANO</text>
    </svg>
  `),
  calca_jeans: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="160" r="108" fill="#F3E8FF"/>
      <path d="M108 66 H212 L224 246 H178 L160 142 L142 246 H96 Z" fill="#6D28D9" stroke="#272321" stroke-width="5" stroke-linejoin="round"/>
      <rect x="108" y="66" width="104" height="20" fill="#7C3AED" stroke="#272321" stroke-width="5"/>
      <line x1="160" y1="86" x2="160" y2="134" stroke="#272321" stroke-width="4"/>
      <path d="M112 96 Q130 112 138 96 M208 96 Q190 112 182 96" stroke="#F3E8FF" stroke-width="4" stroke-linecap="round"/>
      <rect x="114" y="264" width="92" height="22" rx="11" fill="#272321"/>
      <text x="160" y="279" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">DENIM PREMIUM</text>
    </svg>
  `),
  jaqueta_corta_vento: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="162" r="108" fill="#F3E8FF"/>
      <path d="M126 56 C138 40, 182 40, 194 56 L216 78 L256 144 L226 162 L206 122 V244 H114 V122 L94 162 L64 144 L104 78 Z" fill="#272321" stroke="#272321" stroke-width="5" stroke-linejoin="round"/>
      <path d="M114 134 L160 158 L206 134 L206 174 L160 198 L114 174 Z" fill="#7C3AED"/>
      <line x1="160" y1="74" x2="160" y2="244" stroke="#FFFFFF" stroke-width="4"/>
      <rect x="110" y="264" width="100" height="22" rx="11" fill="#7C3AED"/>
      <text x="160" y="279" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">CORTA-VENTO</text>
    </svg>
  `),
  bone_aba_curva: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="160" r="108" fill="#F3E8FF"/>
      <path d="M74 178 C74 114, 118 88, 164 88 C208 88, 236 118, 236 178 Z" fill="#7C3AED" stroke="#272321" stroke-width="5" stroke-linejoin="round"/>
      <path d="M164 88 C144 114, 140 148, 140 178 M164 88 C184 114, 188 148, 188 178" stroke="#272321" stroke-width="3.5"/>
      <path d="M54 178 H258 C264 196, 224 206, 178 198 L62 192 C52 190, 50 182, 54 178 Z" fill="#272321"/>
      <circle cx="164" cy="84" r="6" fill="#272321"/>
      <rect x="148" y="132" width="32" height="20" rx="6" fill="#FFFFFF" stroke="#272321" stroke-width="3.5"/>
      <rect x="114" y="264" width="92" height="22" rx="11" fill="#272321"/>
      <text x="160" y="279" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">STRAPBACK</text>
    </svg>
  `),
  relogio_casual: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="160" r="108" fill="#F3E8FF"/>
      <rect x="136" y="52" width="48" height="216" rx="10" fill="#272321"/>
      <circle cx="160" cy="160" r="56" fill="#FFFFFF" stroke="#7C3AED" stroke-width="8"/>
      <circle cx="160" cy="160" r="46" fill="#F8F7FC" stroke="#272321" stroke-width="3"/>
      <line x1="160" y1="160" x2="160" y2="128" stroke="#272321" stroke-width="5" stroke-linecap="round"/>
      <line x1="160" y1="160" x2="184" y2="160" stroke="#7C3AED" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="160" cy="160" r="5" fill="#272321"/>
      <rect x="114" y="274" width="92" height="22" rx="11" fill="#7C3AED"/>
      <text x="160" y="289" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">CRONÓGRAFO</text>
    </svg>
  `),
  carteira_couro: buildSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" fill="none">
      <rect width="320" height="320" rx="28" fill="#F8F7FC"/>
      <circle cx="160" cy="160" r="108" fill="#F3E8FF"/>
      <rect x="76" y="96" width="156" height="106" rx="14" fill="#6D28D9" stroke="#272321" stroke-width="4.5"/>
      <rect x="86" y="110" width="158" height="108" rx="14" fill="#7C3AED" stroke="#272321" stroke-width="5"/>
      <rect x="192" y="148" width="58" height="34" rx="10" fill="#272321"/>
      <circle cx="208" cy="165" r="6" fill="#F3E8FF"/>
      <line x1="100" y1="126" x2="224" y2="126" stroke="#F3E8FF" stroke-width="3.5" stroke-dasharray="7 5"/>
      <rect x="114" y="264" width="92" height="22" rx="11" fill="#272321"/>
      <text x="160" y="279" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="700">COURO SLIM</text>
    </svg>
  `),
};

export interface DemoCatalogGroupSeed {
  key: string;
  name: string;
  category: string;
  priceSell: number;
  priceCost: number;
  ncm: string;
  imageUrl: string;
  sizes: string[];
  colors: string[];
  initialStock: number;
}

export const DEMO_CATALOG_GROUPS: DemoCatalogGroupSeed[] = [
  {
    key: 'camiseta_pima',
    name: 'Camiseta Peruana Pima',
    category: 'Camisetas',
    priceSell: 69.9,
    priceCost: 28.0,
    ncm: '61091000',
    imageUrl: DEMO_PRODUCT_IMAGES.camiseta_pima,
    sizes: ['P', 'M', 'G', 'GG'],
    colors: ['Preta', 'Branca'],
    initialStock: 14,
  },
  {
    key: 'camiseta_basica',
    name: 'Camiseta Básica Algodão',
    category: 'Camisetas',
    priceSell: 44.9,
    priceCost: 18.0,
    ncm: '61091000',
    imageUrl: DEMO_PRODUCT_IMAGES.camiseta_basica,
    sizes: ['P', 'M', 'G'],
    colors: ['Mescla', 'Preta'],
    initialStock: 16,
  },
  {
    key: 'tenis_casual',
    name: 'Tênis Casual Urbano',
    category: 'Calçados',
    priceSell: 189.9,
    priceCost: 85.0,
    ncm: '64041900',
    imageUrl: DEMO_PRODUCT_IMAGES.tenis_casual,
    sizes: ['38', '39', '40', '41'],
    colors: ['Preto', 'Branco'],
    initialStock: 8,
  },
  {
    key: 'calca_jeans',
    name: 'Calça Jeans Skinny Premium',
    category: 'Calças & Jeans',
    priceSell: 139.9,
    priceCost: 58.0,
    ncm: '62034200',
    imageUrl: DEMO_PRODUCT_IMAGES.calca_jeans,
    sizes: ['38', '40', '42', '44'],
    colors: ['Azul Escuro'],
    initialStock: 10,
  },
  {
    key: 'jaqueta_corta_vento',
    name: 'Jaqueta Corta-Vento Impermeável',
    category: 'Jaquetas & Moletons',
    priceSell: 159.9,
    priceCost: 68.0,
    ncm: '62014000',
    imageUrl: DEMO_PRODUCT_IMAGES.jaqueta_corta_vento,
    sizes: ['M', 'G', 'GG'],
    colors: ['Preta'],
    initialStock: 7,
  },
  {
    key: 'bone_aba_curva',
    name: 'Boné Aba Curva Strapback',
    category: 'Bonés & Chapelaria',
    priceSell: 49.9,
    priceCost: 19.0,
    ncm: '65050011',
    imageUrl: DEMO_PRODUCT_IMAGES.bone_aba_curva,
    sizes: ['Único'],
    colors: ['Preto', 'Grafite', 'Off-White'],
    initialStock: 15,
  },
  {
    key: 'relogio_casual',
    name: 'Relógio Casual Minimalista',
    category: 'Relógios & Acessórios',
    priceSell: 129.9,
    priceCost: 48.0,
    ncm: '91021110',
    imageUrl: DEMO_PRODUCT_IMAGES.relogio_casual,
    sizes: ['Único'],
    colors: ['Prata', 'Preto Fosco'],
    initialStock: 6,
  },
  {
    key: 'carteira_couro',
    name: 'Carteira Slim em Couro',
    category: 'Relógios & Acessórios',
    priceSell: 59.9,
    priceCost: 22.0,
    ncm: '42023100',
    imageUrl: DEMO_PRODUCT_IMAGES.carteira_couro,
    sizes: ['Único'],
    colors: ['Preta', 'Café'],
    initialStock: 12,
  },
];

/**
 * Reseta completamente o banco do tenant de demonstração para o estado habitual:
 * - Categorias e Grupos Tributários
 * - 8 Grupos de mercadorias com fotos, grades de tamanho/cor, lotes e estoque
 * - 3 Operadores (Gerente com PIN 1234, Caixa e Consultora)
 * - 3 Fornecedores, 2 Pedidos de Compra e 6 Contas a Pagar (Financeiro alimentado)
 * - 4 Clientes cadastrados
 * - 1 Caixa fechado (ontem) + 1 Caixa aberto (hoje) com suprimento, sangria, 4 vendas e 1 troca com crédito ativo
 */
export async function resetDemoDatabaseState(
  client: PrismaClient,
  visitorName?: string,
): Promise<{
  primaryOperator: { id: string; name: string; jobTitle: string | null; isManager: boolean };
  openRegister: { id: string; code: number; status: string; openingValue: number };
}> {
  const defaultPinHash = await bcrypt.hash(DEMO_OPERATOR_PIN, 10);

  // 1. Limpar dados transacionais e cadastros na ordem correta de dependências
  await client.$transaction([
    client.storeCreditUse.deleteMany({}),
    client.storeCredit.deleteMany({}),
    client.retailReturnItem.deleteMany({}),
    client.retailReturn.deleteMany({}),
    client.stockLotConsumption.deleteMany({}),
    client.saleItemModifier.deleteMany({}),
    client.saleDeliveryJob.deleteMany({}),
    client.payment.deleteMany({}),
    client.saleItem.deleteMany({}),
    client.operatorConsumption.deleteMany({}),
    client.comandaItemModifier.deleteMany({}),
    client.comandaAssetReservation.deleteMany({}),
    client.comandaItem.deleteMany({}),
    client.comanda.deleteMany({}),
    client.sale.deleteMany({}),
    client.cashRegisterConferenceRevision.deleteMany({}),
    client.cashMovement.deleteMany({}),
    client.cashRegister.deleteMany({}),
    client.inventoryLog.deleteMany({}),
    client.stockLot.deleteMany({}),
    client.purchaseOrderItem.deleteMany({}),
    client.purchaseOrder.deleteMany({}),
    client.supplierProduct.deleteMany({}),
    client.payable.deleteMany({}),
    client.nfeEntradaItem.deleteMany({}),
    client.fiscalEvent.deleteMany({}),
    client.nfeEntrada.deleteMany({}),
    client.supplier.deleteMany({}),
    client.productModifierOption.deleteMany({}),
    client.productModifierGroup.deleteMany({}),
    client.productPaymentMethodPrice.deleteMany({}),
    client.product.deleteMany({}),
    client.retailGroup.deleteMany({}),
    client.category.deleteMany({}),
    client.customer.deleteMany({}),
    client.operator.deleteMany({}),
    client.vitrineConfig.deleteMany({}),
  ]);

  // 2. Configurações e Tributação Padrão
  await client.tenantSettings.upsert({
    where: { id: 'singleton' },
    update: {
      allowNegativeStock: false,
      cashierPin: defaultPinHash,
      discountPin: defaultPinHash,
      enableExpiryControl: false,
      lowStockAlertDefault: 4,
    },
    create: {
      id: 'singleton',
      allowNegativeStock: false,
      cashierPin: defaultPinHash,
      discountPin: defaultPinHash,
      enableExpiryControl: false,
      lowStockAlertDefault: 4,
    },
  });

  await seedDefaultGruposStatic(client);
  const grupoPadrao = await client.grupoTributacao.findFirst({
    where: { isPadrao: true },
  });

  // 3. Categorias
  const categoryNames = [
    'Camisetas',
    'Calçados',
    'Calças & Jeans',
    'Jaquetas & Moletons',
    'Bonés & Chapelaria',
    'Relógios & Acessórios',
  ];
  const categoryMap = new Map<string, string>();
  for (const name of categoryNames) {
    const cat = await client.category.create({
      data: {
        name,
        grupoTributacaoId: grupoPadrao?.id ?? null,
      },
    });
    categoryMap.set(name, cat.id);
  }

  // 4. Fornecedores
  const supTextil = await client.supplier.create({
    data: {
      name: 'Têxtil Peruana & Malharia LTDA',
      cnpjCpf: '12345678000190',
      whatsapp: '11988881111',
      email: 'comercial@textilperuana.com.br',
      municipio: 'São Paulo',
      uf: 'SP',
      logradouro: 'Rua dos Têxteis',
      numero: '450',
      bairro: 'Brás',
      cep: '03010000',
    },
  });

  const supCalcados = await client.supplier.create({
    data: {
      name: 'Calçados Urbanos Indústria S.A.',
      cnpjCpf: '23456789000101',
      whatsapp: '16988882222',
      email: 'pedidos@calcadosurbanos.com.br',
      municipio: 'Franca',
      uf: 'SP',
      logradouro: 'Av. Industrial do Calçado',
      numero: '1200',
      bairro: 'Distrito Industrial',
      cep: '14406000',
    },
  });

  const supAcessorios = await client.supplier.create({
    data: {
      name: 'Acessórios & Couros Brasil LTDA',
      cnpjCpf: '34567890000112',
      whatsapp: '11988883333',
      email: 'atendimento@courosbrasil.com.br',
      municipio: 'São Paulo',
      uf: 'SP',
      logradouro: 'Av. Senador Queirós',
      numero: '310',
      bairro: 'Centro',
      cep: '01026000',
    },
  });

  // 5. Grupos de Mercadorias, Grades (Produtos), Lotes e Logs de Estoque
  const createdGroups: Array<{
    id: string;
    key: string;
    name: string;
    category: string;
    imageUrl: string;
    priceSell: number;
    sizes: string[];
    colors: string[];
  }> = [];
  const createdProducts: Array<{
    id: string;
    name: string;
    groupKey: string;
    size: string;
    color: string;
    priceSell: number;
    priceCost: number;
    ncm: string;
  }> = [];

  let barcodeCounter = 1001;
  for (const g of DEMO_CATALOG_GROUPS) {
    const categoryId = categoryMap.get(g.category)!;
    const retailGroup = await client.retailGroup.create({
      data: {
        name: g.name,
        categoryId,
        imageUrl: g.imageUrl,
        priceSell: g.priceSell,
        priceCost: g.priceCost,
        ncm: g.ncm,
        origem: 0,
        grupoTributacaoId: grupoPadrao?.id ?? null,
        active: true,
        version: 1,
      },
    });
    createdGroups.push({
      id: retailGroup.id,
      key: g.key,
      name: g.name,
      category: g.category,
      imageUrl: g.imageUrl,
      priceSell: g.priceSell,
      sizes: g.sizes,
      colors: g.colors,
    });

    for (const size of g.sizes) {
      for (const color of g.colors) {
        const code = String(barcodeCounter++);
        const variantKey = `${size.toLowerCase()}::${color.toLowerCase()}`;
        const fullName = `${g.name} · ${size} · ${color}`;
        const product = await client.product.create({
          data: {
            retailGroupId: retailGroup.id,
            categoryId,
            grupoTributacaoId: grupoPadrao?.id ?? null,
            name: fullName,
            size,
            color,
            variantKey,
            shortCode: code,
            barcode: code,
            unit: 'UN',
            active: true,
            imageUrl: g.imageUrl,
            priceCost: g.priceCost,
            priceSell: g.priceSell,
            stock: g.initialStock,
            minStock: 3,
            salesCount: 2,
            ncm: g.ncm,
            origem: 0,
            emiteNfce: true,
          },
        });

        const supplierId =
          g.category === 'Calçados'
            ? supCalcados.id
            : g.category === 'Relógios & Acessórios' || g.category === 'Bonés & Chapelaria'
              ? supAcessorios.id
              : supTextil.id;

        await client.stockLot.create({
          data: {
            productId: product.id,
            costPrice: g.priceCost,
            quantity: g.initialStock,
            remaining: g.initialStock,
            lotNumber: `LT-DEMO-${code}`,
            supplierId,
          },
        });

        await client.inventoryLog.create({
          data: {
            productId: product.id,
            type: 'IN',
            quantity: g.initialStock,
            costPrice: g.priceCost,
            origin: 'MANUAL',
            reason: 'Estoque inicial da Loja Demonstração',
          },
        });

        createdProducts.push({
          id: product.id,
          name: fullName,
          groupKey: g.key,
          size,
          color,
          priceSell: g.priceSell,
          priceCost: g.priceCost,
          ncm: g.ncm,
        });
      }
    }
  }

  // 6. Pedidos de Compra (PurchaseOrders)
  const pimaProducts = createdProducts.filter((p) => p.groupKey === 'camiseta_pima').slice(0, 3);
  const tenisProducts = createdProducts.filter((p) => p.groupKey === 'tenis_casual').slice(0, 2);

  if (pimaProducts.length > 0) {
    await client.purchaseOrder.create({
      data: {
        supplierId: supTextil.id,
        status: 'COMPLETED',
        totalEstimated: 1680.0,
        totalReal: 1680.0,
        receivedAt: new Date(Date.now() - 4 * 86400000),
        items: {
          create: pimaProducts.map((p) => ({
            productId: p.id,
            quantity: 20,
            unitMultiplier: 1,
            unitName: 'UN',
            expectedCost: p.priceCost,
            realCost: p.priceCost,
          })),
        },
      },
    });
  }

  if (tenisProducts.length > 0) {
    await client.purchaseOrder.create({
      data: {
        supplierId: supCalcados.id,
        status: 'SENT',
        totalEstimated: 2040.0,
        totalReal: 0,
        items: {
          create: tenisProducts.map((p) => ({
            productId: p.id,
            quantity: 12,
            unitMultiplier: 1,
            unitName: 'UN',
            expectedCost: p.priceCost,
          })),
        },
      },
    });
  }

  // 7. Financeiro Alimentado — Contas a Pagar (Fixas e Variáveis)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  await client.payable.createMany({
    data: [
      {
        description: 'Aluguel do Ponto Comercial · Loja Centro',
        amount: 2800.0,
        dueDate: daysFromNow(-8),
        paidAt: daysFromNow(-8),
        status: 'PAID',
        type: 'FIXED',
        isRecurring: true,
        recurrenceId: 'demo-rec-aluguel',
        recurrenceMonth: currentMonth,
        recurrenceDay: 5,
        category: 'aluguel',
        notes: 'Pago via transferência PIX imobiliária.',
      },
      {
        description: 'Energia Elétrica Comercial (Iluminação + Ar)',
        amount: 428.5,
        dueDate: daysFromNow(-4),
        paidAt: daysFromNow(-4),
        status: 'PAID',
        type: 'FIXED',
        isRecurring: true,
        recurrenceId: 'demo-rec-energia',
        recurrenceMonth: currentMonth,
        recurrenceDay: 10,
        category: 'luz',
        notes: 'Fatura mensal quitada.',
      },
      {
        description: 'Internet Fibra 600MB + Wi-Fi Balcão',
        amount: 149.9,
        dueDate: daysFromNow(-2),
        paidAt: daysFromNow(-2),
        status: 'PAID',
        type: 'FIXED',
        isRecurring: true,
        recurrenceId: 'demo-rec-internet',
        recurrenceMonth: currentMonth,
        recurrenceDay: 12,
        category: 'internet',
      },
      {
        description: 'Boleto 1/2 — Reposição Grade Camisetas Pima',
        amount: 1680.0,
        dueDate: daysFromNow(3),
        status: 'PENDING',
        type: 'VARIABLE',
        isRecurring: false,
        category: 'fornecedor',
        supplierId: supTextil.id,
        notes: 'Referente ao pedido recebido de malharia peruana.',
      },
      {
        description: 'Boleto Grade Tênis Casual Urbano (Lote Outono)',
        amount: 2040.0,
        dueDate: daysFromNow(7),
        status: 'PENDING',
        type: 'VARIABLE',
        isRecurring: false,
        category: 'fornecedor',
        supplierId: supCalcados.id,
        notes: 'Programado para pagamento após conferência.',
      },
      {
        description: 'Simples Nacional (Guia DAS Mensal)',
        amount: 695.0,
        dueDate: daysFromNow(10),
        status: 'PENDING',
        type: 'FIXED',
        isRecurring: true,
        recurrenceId: 'demo-rec-das',
        recurrenceMonth: currentMonth,
        recurrenceDay: 20,
        category: 'impostos',
      },
    ],
  });

  // 8. Operadores de Caixa / Equipe
  const opManager = await client.operator.create({
    data: {
      name: visitorName ? `${visitorName.split(' ')[0]} (Demonstração)` : 'Operador Demonstração',
      pin: defaultPinHash,
      jobTitle: 'Gerente de Loja',
      active: true,
      isManager: true,
    },
  });

  const opCashier = await client.operator.create({
    data: {
      name: 'Lucas Atendimento',
      pin: defaultPinHash,
      jobTitle: 'Caixa / Balcão',
      active: true,
      isManager: false,
    },
  });

  const opMariana = await client.operator.create({
    data: {
      name: 'Mariana Consultora',
      pin: defaultPinHash,
      jobTitle: 'Vendas & Grade',
      active: true,
      isManager: false,
    },
  });

  const opBeatriz = await client.operator.create({
    data: {
      name: 'Beatriz Moda',
      pin: defaultPinHash,
      jobTitle: 'Consultora de Estilo',
      active: true,
      isManager: false,
    },
  });

  // 9. Clientes (Customers)
  const custFernanda = await client.customer.create({
    data: {
      name: 'Fernanda Oliveira',
      phone: '11992223344',
      cpfCnpj: '23456789011',
      address: 'Rua Augusta, 890 · Consolação',
      reference: 'Cliente fiel — prefere tamanho M',
    },
  });

  const custRafael = await client.customer.create({
    data: {
      name: 'Rafael Mendes',
      phone: '11993334455',
      cpfCnpj: '34567890122',
      address: 'Av. Paulista, 1400 · Bela Vista',
    },
  });

  const custCamila = await client.customer.create({
    data: {
      name: 'Camila Santos',
      phone: '11994445566',
      cpfCnpj: '45678901233',
      address: 'Rua Oscar Freire, 512 · Jardins',
    },
  });

  // 10. Caixa #1 (Fechado ontem) para histórico de turnos
  const yesterdayOpen = new Date(now.getTime() - 28 * 3600 * 1000);
  const yesterdayClose = new Date(now.getTime() - 19 * 3600 * 1000);
  const closedReg = await client.cashRegister.create({
    data: {
      code: 1,
      operatorId: opCashier.id,
      openingTime: yesterdayOpen,
      closingTime: yesterdayClose,
      openingValue: 150.0,
      closingValue: 559.6,
      status: 'closed',
      closingDetails: JSON.stringify({
        notes: 'Turno de ontem conferido e fechado sem divergências.',
        declaredCash: 289.8,
      }),
    },
  });

  // Venda no caixa de ontem
  const prodYesterday1 = createdProducts[0]; // Camiseta Peruana Pima 69.90
  const prodYesterday2 = createdProducts.find((p) => p.groupKey === 'calca_jeans') || createdProducts[1]; // 139.90
  await client.sale.create({
    data: {
      code: 1,
      customerId: custCamila.id,
      operatorId: opCashier.id,
      cashRegisterId: closedReg.id,
      subtotal: 409.6,
      discount: 0,
      total: 409.6,
      status: 'completed',
      source: 'pdv',
      createdAt: new Date(yesterdayOpen.getTime() + 3 * 3600 * 1000),
      items: {
        create: [
          {
            productId: prodYesterday1.id,
            productName: prodYesterday1.name,
            unit: 'UN',
            quantity: 2,
            priceUnit: prodYesterday1.priceSell,
            priceCost: prodYesterday1.priceCost,
            subtotal: 139.8,
            ncm: prodYesterday1.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: prodYesterday2.id,
            productName: prodYesterday2.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: prodYesterday2.priceSell,
            priceCost: prodYesterday2.priceCost,
            subtotal: 139.9,
            ncm: prodYesterday2.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: (createdProducts.find((p) => p.groupKey === 'relogio_casual') || prodYesterday1).id,
            productName: (createdProducts.find((p) => p.groupKey === 'relogio_casual') || prodYesterday1).name,
            unit: 'UN',
            quantity: 1,
            priceUnit: 129.9,
            priceCost: 48.0,
            subtotal: 129.9,
            ncm: '91021110',
            cfop: '5102',
            csosn: '102',
          },
        ],
      },
      payments: {
        create: [
          { tPag: '01', method: 'dinheiro', label: 'Dinheiro', value: 139.8, troco: 0 },
          { tPag: '17', method: 'pix', label: 'Pix', value: 269.8, troco: 0 },
        ],
      },
    },
  });

  // 11. Caixa #2 (Aberto hoje — Pronto para testes no PDV!)
  const todayOpen = new Date(now.getTime() - 2 * 3600 * 1000);
  const openReg = await client.cashRegister.create({
    data: {
      code: 2,
      operatorId: opManager.id,
      openingTime: todayOpen,
      openingValue: 200.0,
      status: 'open',
    },
  });

  // Movimentações de caixa do turno atual (Suprimento e Sangria)
  await client.cashMovement.createMany({
    data: [
      {
        cashRegisterId: openReg.id,
        type: 'IN',
        value: 50.0,
        reason: 'Reforço de troco em cédulas pequenas',
        createdAt: new Date(todayOpen.getTime() + 15 * 60 * 1000),
      },
      {
        cashRegisterId: openReg.id,
        type: 'OUT',
        value: 30.0,
        reason: 'Pagamento entrega de embalagens e sacolas',
        createdAt: new Date(todayOpen.getTime() + 40 * 60 * 1000),
      },
    ],
  });

  // Vendas de hoje no Caixa #2
  const pPimaM = createdProducts.find((p) => p.groupKey === 'camiseta_pima' && p.size === 'M') || createdProducts[0];
  const pTenis40 = createdProducts.find((p) => p.groupKey === 'tenis_casual' && p.size === '40') || createdProducts[8];
  const pBone = createdProducts.find((p) => p.groupKey === 'bone_aba_curva') || createdProducts[18];
  const pJaqueta = createdProducts.find((p) => p.groupKey === 'jaqueta_corta_vento') || createdProducts[15];
  const pCarteira = createdProducts.find((p) => p.groupKey === 'carteira_couro') || createdProducts[22];

  // Venda #2 — Fernanda Oliveira (2 Camisetas Pima = R$ 139,80 no PIX) -> Pronta para testar Troca!
  const saleFernanda = await client.sale.create({
    data: {
      code: 2,
      customerId: custFernanda.id,
      operatorId: opManager.id,
      cashRegisterId: openReg.id,
      subtotal: 139.8,
      discount: 0,
      total: 139.8,
      status: 'completed',
      source: 'pdv',
      createdAt: new Date(todayOpen.getTime() + 25 * 60 * 1000),
      items: {
        create: [
          {
            productId: pPimaM.id,
            productName: pPimaM.name,
            unit: 'UN',
            quantity: 2,
            priceUnit: pPimaM.priceSell,
            priceCost: pPimaM.priceCost,
            subtotal: 139.8,
            ncm: pPimaM.ncm,
            cfop: '5102',
            csosn: '102',
          },
        ],
      },
      payments: {
        create: [{ tPag: '17', method: 'pix', label: 'Pix', value: 139.8, troco: 0 }],
      },
    },
    include: { items: true },
  });

  // Venda #3 — Rafael Mendes (Tênis Casual + Boné = R$ 239,80 no Cartão de Crédito)
  await client.sale.create({
    data: {
      code: 3,
      customerId: custRafael.id,
      operatorId: opManager.id,
      cashRegisterId: openReg.id,
      subtotal: 239.8,
      discount: 0,
      total: 239.8,
      status: 'completed',
      source: 'pdv',
      createdAt: new Date(todayOpen.getTime() + 55 * 60 * 1000),
      items: {
        create: [
          {
            productId: pTenis40.id,
            productName: pTenis40.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: pTenis40.priceSell,
            priceCost: pTenis40.priceCost,
            subtotal: pTenis40.priceSell,
            ncm: pTenis40.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: pBone.id,
            productName: pBone.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: pBone.priceSell,
            priceCost: pBone.priceCost,
            subtotal: pBone.priceSell,
            ncm: pBone.ncm,
            cfop: '5102',
            csosn: '102',
          },
        ],
      },
      payments: {
        create: [{ tPag: '03', method: 'credito', label: 'Cartão de Crédito', value: 239.8, troco: 0 }],
      },
    },
  });

  // Venda #4 — Balcão Rápido (Jaqueta Corta-Vento + Carteira Couro = R$ 219,80 em Dinheiro + Débito)
  await client.sale.create({
    data: {
      code: 4,
      customerId: null,
      operatorId: opManager.id,
      cashRegisterId: openReg.id,
      subtotal: 219.8,
      discount: 0,
      total: 219.8,
      status: 'completed',
      source: 'pdv',
      createdAt: new Date(todayOpen.getTime() + 85 * 60 * 1000),
      items: {
        create: [
          {
            productId: pJaqueta.id,
            productName: pJaqueta.name,
            unit: 'UN',
            quantity: 1,
            priceCost: pJaqueta.priceCost,
            priceUnit: pJaqueta.priceSell,
            subtotal: pJaqueta.priceSell,
            ncm: pJaqueta.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: pCarteira.id,
            productName: pCarteira.name,
            unit: 'UN',
            quantity: 1,
            priceCost: pCarteira.priceCost,
            priceUnit: pCarteira.priceSell,
            subtotal: pCarteira.priceSell,
            ncm: pCarteira.ncm,
            cfop: '5102',
            csosn: '102',
          },
        ],
      },
      payments: {
        create: [
          { tPag: '01', method: 'dinheiro', label: 'Dinheiro', value: 100.0, troco: 0 },
          { tPag: '04', method: 'debito', label: 'Cartão de Débito', value: 119.8, troco: 0 },
        ],
      },
    },
  });

  // 12. Exemplo de Troca + Crédito em Loja ativo para Fernanda Oliveira (1 peça da Venda #2)
  if (saleFernanda.items.length > 0) {
    const firstItem = saleFernanda.items[0];
    const ret = await client.retailReturn.create({
      data: {
        requestKey: 'demo-return-001',
        requestFingerprint: 'demo-return-fp-001',
        saleId: saleFernanda.id,
        customerId: custFernanda.id,
        operatorId: opManager.id,
        reason: 'Troca de tamanho (cliente solicitou crédito para escolher outra cor)',
        total: 69.9,
        items: {
          create: [
            {
              saleItemId: firstItem.id,
              quantity: 1,
              restock: true,
              value: 69.9,
            },
          ],
        },
      },
    });

    await client.storeCredit.create({
      data: {
        returnId: ret.id,
        customerId: custFernanda.id,
        amount: 69.9,
        balance: 69.9,
      },
    });
  }

  // 12b. Vendas históricas do mês (para alimentar o Ranking, Pódio e Calendário de Inteligência Comercial)
  const pRelogio = createdProducts.find((p) => p.groupKey === 'relogio_casual') || createdProducts[0];
  const pJeans = createdProducts.find((p) => p.groupKey === 'calca_jeans') || createdProducts[1];
  const pBasica = createdProducts.find((p) => p.groupKey === 'camiseta_basica') || createdProducts[2];

  // Venda #5 — Mariana Consultora (há 2 dias, com leve desconto promocional)
  await client.sale.create({
    data: {
      code: 5,
      customerId: custFernanda.id,
      operatorId: opMariana.id,
      cashRegisterId: closedReg.id,
      subtotal: 469.6,
      discount: 20.0,
      total: 449.6,
      status: 'completed',
      source: 'pdv',
      createdAt: new Date(now.getTime() - 2 * 86400000),
      items: {
        create: [
          {
            productId: pTenis40.id,
            productName: pTenis40.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: pTenis40.priceSell,
            priceCost: pTenis40.priceCost,
            subtotal: pTenis40.priceSell,
            ncm: pTenis40.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: pJeans.id,
            productName: pJeans.name,
            unit: 'UN',
            quantity: 2,
            priceUnit: pJeans.priceSell,
            priceCost: pJeans.priceCost,
            subtotal: 279.8,
            ncm: pJeans.ncm,
            cfop: '5102',
            csosn: '102',
          },
        ],
      },
      payments: {
        create: [{ tPag: '03', method: 'credito', label: 'Cartão de Crédito', value: 449.6, troco: 0 }],
      },
    },
  });

  // Venda #6 — Mariana Consultora (há 4 dias, combo 3 peças)
  await client.sale.create({
    data: {
      code: 6,
      customerId: custCamila.id,
      operatorId: opMariana.id,
      cashRegisterId: closedReg.id,
      subtotal: 349.7,
      discount: 0,
      total: 349.7,
      status: 'completed',
      source: 'pdv',
      createdAt: new Date(now.getTime() - 4 * 86400000),
      items: {
        create: [
          {
            productId: pJaqueta.id,
            productName: pJaqueta.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: pJaqueta.priceSell,
            priceCost: pJaqueta.priceCost,
            subtotal: pJaqueta.priceSell,
            ncm: pJaqueta.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: pRelogio.id,
            productName: pRelogio.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: pRelogio.priceSell,
            priceCost: pRelogio.priceCost,
            subtotal: pRelogio.priceSell,
            ncm: pRelogio.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: pCarteira.id,
            productName: pCarteira.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: pCarteira.priceSell,
            priceCost: pCarteira.priceCost,
            subtotal: pCarteira.priceSell,
            ncm: pCarteira.ncm,
            cfop: '5102',
            csosn: '102',
          },
        ],
      },
      payments: {
        create: [{ tPag: '17', method: 'pix', label: 'Pix', value: 349.7, troco: 0 }],
      },
    },
  });

  // Venda #7 — Beatriz Moda (há 3 dias, com desconto)
  await client.sale.create({
    data: {
      code: 7,
      customerId: custRafael.id,
      operatorId: opBeatriz.id,
      cashRegisterId: closedReg.id,
      subtotal: 274.6,
      discount: 14.6,
      total: 260.0,
      status: 'completed',
      source: 'pdv',
      createdAt: new Date(now.getTime() - 3 * 86400000),
      items: {
        create: [
          {
            productId: pBasica.id,
            productName: pBasica.name,
            unit: 'UN',
            quantity: 3,
            priceUnit: pBasica.priceSell,
            priceCost: pBasica.priceCost,
            subtotal: 134.7,
            ncm: pBasica.ncm,
            cfop: '5102',
            csosn: '102',
          },
          {
            productId: pJeans.id,
            productName: pJeans.name,
            unit: 'UN',
            quantity: 1,
            priceUnit: pJeans.priceSell,
            priceCost: pJeans.priceCost,
            subtotal: pJeans.priceSell,
            ncm: pJeans.ncm,
            cfop: '5102',
            csosn: '102',
          },
        ],
      },
      payments: {
        create: [{ tPag: '17', method: 'pix', label: 'Pix', value: 260.0, troco: 0 }],
      },
    },
  });

  // 13. Vitrine Digital & TV Promocional pré-configurada e publicada na Loja Demonstração
  const grpPima = createdGroups.find((g) => g.key === 'camiseta_pima');
  const grpTenis = createdGroups.find((g) => g.key === 'tenis_casual');
  const grpJaqueta = createdGroups.find((g) => g.key === 'jaqueta_corta_vento');
  const grpJeans = createdGroups.find((g) => g.key === 'calca_jeans');
  const grpBone = createdGroups.find((g) => g.key === 'bone_aba_curva');
  const grpRelogio = createdGroups.find((g) => g.key === 'relogio_casual');

  const demoVitrineSlides: any[] = [];
  if (grpPima) {
    demoVitrineSlides.push({
      slideType: 'single',
      productId: `group:${grpPima.id}`,
      retailGroupId: grpPima.id,
      productName: grpPima.name,
      categoryName: grpPima.category,
      imageUrl: grpPima.imageUrl,
      priceSell: grpPima.priceSell,
      promoPrice: 69.9,
      badge: 'OFERTA',
      showSizes: true,
      sizesAvailable: grpPima.sizes,
      colorsAvailable: grpPima.colors,
      order: 1,
    });
  }
  if (grpTenis) {
    demoVitrineSlides.push({
      slideType: 'single',
      productId: `group:${grpTenis.id}`,
      retailGroupId: grpTenis.id,
      productName: grpTenis.name,
      categoryName: grpTenis.category,
      imageUrl: grpTenis.imageUrl,
      priceSell: grpTenis.priceSell,
      promoPrice: 159.9,
      badge: 'DESTAQUE',
      showSizes: true,
      sizesAvailable: grpTenis.sizes,
      colorsAvailable: grpTenis.colors,
      order: 2,
    });
  }
  const gridCandidates = [grpPima, grpJaqueta, grpJeans, grpTenis, grpBone, grpRelogio].filter(
    Boolean,
  ) as typeof createdGroups;
  if (gridCandidates.length >= 2) {
    demoVitrineSlides.push({
      slideType: 'grid',
      gridId: 'grid_demo_colecao',
      order: 3,
      gridTitle: 'COLEÇÃO URBANA & ACESSÓRIOS',
      gridSubtitle: '• SELEÇÃO ESPECIAL DA SEMANA •',
      gridBadge: 'SUPER PROMO',
      duration: 15,
      gridProducts: gridCandidates.slice(0, 4).map((g) => ({
        productId: `group:${g.id}`,
        retailGroupId: g.id,
        productName: g.name,
        categoryName: g.category,
        imageUrl: g.imageUrl,
        priceSell: g.priceSell,
        promoPrice: Number((g.priceSell * 0.85).toFixed(2)),
        sizesAvailable: g.sizes,
        colorsAvailable: g.colors,
      })),
    });
  }

  await client.vitrineConfig
    .upsert({
      where: { id: 'singleton' },
      update: {
        active: true,
        version: 1,
        publishedAt: new Date(),
        publishedByUserId: 'demo-admin',
        publishedByName: 'Carla Mendes (Gerente)',
        draftUpdatedAt: new Date(),
        theme: 'dark_premium',
        showLogo: true,
        logoPosition: JSON.stringify({
          position: 'top-left',
          instagram: '@boutiquemodelo',
          gridSlideDuration: 15,
          storeTagline: 'Moda, Calçados & Acessórios',
        }),
        slideDuration: 8,
        draftSlides: demoVitrineSlides,
        publishedSlides: demoVitrineSlides,
      },
      create: {
        id: 'singleton',
        active: true,
        version: 1,
        publishedAt: new Date(),
        publishedByUserId: 'demo-admin',
        publishedByName: 'Carla Mendes (Gerente)',
        draftUpdatedAt: new Date(),
        theme: 'dark_premium',
        showLogo: true,
        logoPosition: JSON.stringify({
          position: 'top-left',
          instagram: '@boutiquemodelo',
          gridSlideDuration: 15,
          storeTagline: 'Moda, Calçados & Acessórios',
        }),
        slideDuration: 8,
        draftSlides: demoVitrineSlides,
        publishedSlides: demoVitrineSlides,
      },
    })
    .catch(() => {});

  return {
    primaryOperator: {
      id: opManager.id,
      name: opManager.name,
      jobTitle: opManager.jobTitle,
      isManager: opManager.isManager,
    },
    openRegister: {
      id: openReg.id,
      code: openReg.code || 2,
      status: openReg.status,
      openingValue: Number(openReg.openingValue),
    },
  };
}
