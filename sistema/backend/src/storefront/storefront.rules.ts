import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const APPROVED_STOREFRONT_PALETTE = [
  '#7C3AED',
  '#6D28D9',
  '#FFFFFF',
  '#F8F7FC',
  '#F3E8FF',
  '#272321',
  '#665F70',
  '#E5E1ED',
] as const;

export const STOREFRONT_TEMPLATES = [
  'editorial_roxo',
  'minimal_branco',
  'vitrine_escura',
] as const;

export type StorefrontTemplateId = (typeof STOREFRONT_TEMPLATES)[number];

export const STOREFRONT_SECTION_TYPES = [
  'header',
  'hero',
  'categories',
  'featured',
  'collection',
  'fulfillment_info',
  'footer',
] as const;

export type StorefrontSectionType = (typeof STOREFRONT_SECTION_TYPES)[number];

export interface StorefrontSectionConfig {
  id: string;
  type: StorefrontSectionType;
  enabled: boolean;
  title?: string;
  subtitle?: string;
  categoryId?: string | null;
}

export interface StorefrontBannerConfig {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  ctaLabel?: string;
  targetType?: 'all' | 'featured' | 'category' | 'product';
  targetValue?: string;
  enabled: boolean;
}

export interface StorefrontThemeConfig {
  template: StorefrontTemplateId;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  announcementText: string;
  banners: StorefrontBannerConfig[];
  sections: StorefrontSectionConfig[];
}

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'login',
  'pos',
  'caixa',
  'catalogo',
  'clientes',
  'trocas',
  'crediario',
  'vitrine',
  'loja-virtual',
  'sys-init',
  'dashboard',
  'health',
  'tv',
  'static',
  'assets',
]);

export function normalizeStorefrontSlug(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return cleaned;
}

export function assertValidStorefrontSlug(raw: unknown): string {
  const slug = normalizeStorefrontSlug(raw);
  if (!slug || slug.length < 3 || slug.length > 64) {
    throw new BadRequestException(
      'O endereço público (slug) deve ter entre 3 e 64 caracteres (letras, números e hífens).',
    );
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new BadRequestException('Endereço público (slug) em formato inválido.');
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new BadRequestException(
      `O endereço "${slug}" é reservado pelo sistema. Escolha outro nome para sua loja.`,
    );
  }
  return slug;
}

export function buildProductPublicSlug(name: string, retailGroupId: string): string {
  const base = normalizeStorefrontSlug(name) || 'produto';
  const suffix = String(retailGroupId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 6);
  return suffix ? `${base}-${suffix}` : base;
}

export function sanitizePlainText(
  value: unknown,
  maxLength: number,
  fieldName?: string,
): string {
  const raw = String(value ?? '').trim();
  if (/<script|javascript:|onerror=|onload=|<iframe|<object/i.test(raw)) {
    throw new BadRequestException(
      `Conteúdo não permitido em ${fieldName || 'campo de texto'}.`,
    );
  }
  const stripped = raw.replace(/[<>]/g, '').trim();
  if (stripped.length > maxLength) {
    return stripped.slice(0, maxLength);
  }
  return stripped;
}

export function sanitizeSafeImageUrl(url: unknown): string | null {
  if (url === null || url === undefined || url === '') return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (raw.length > 1024) {
    throw new BadRequestException('URL de imagem excede o limite permitido.');
  }
  if (/^(javascript|vbscript|data:text)/i.test(raw)) {
    throw new BadRequestException('URL de imagem inválida ou insegura.');
  }
  if (
    raw.startsWith('/api/products/uploads/images/') ||
    raw.startsWith('/api/tenants/uploads/logos/') ||
    raw.startsWith('/uploads/') ||
    /^https:\/\//i.test(raw) ||
    /^http:\/\/(localhost|127\.0\.0\.1)/i.test(raw)
  ) {
    return raw;
  }
  throw new BadRequestException(
    'A imagem deve pertencer à galeria oficial da loja ou usar endereço HTTPS válido.',
  );
}

export function getDefaultStorefrontTheme(storeName = 'Minha Loja'): StorefrontThemeConfig {
  return {
    template: 'editorial_roxo',
    primaryColor: '#7C3AED',
    accentColor: '#6D28D9',
    surfaceColor: '#F8F7FC',
    textColor: '#272321',
    heroTitle: storeName ? `Bem-vindo à ${storeName}` : 'Confira nossa coleção',
    heroSubtitle:
      'Escolha suas peças favoritas, selecione tamanho e cor e finalize seu pedido pelo WhatsApp.',
    heroCtaLabel: 'Ver catálogo',
    announcementText: 'Retirada na loja ou entrega a combinar pelo WhatsApp',
    banners: [],
    sections: [
      { id: 'sec-header', type: 'header', enabled: true, title: 'Cabeçalho' },
      { id: 'sec-hero', type: 'hero', enabled: true, title: 'Capa de destaque' },
      { id: 'sec-categories', type: 'categories', enabled: true, title: 'Categorias' },
      { id: 'sec-featured', type: 'featured', enabled: true, title: 'Destaques da loja' },
      { id: 'sec-collection', type: 'collection', enabled: true, title: 'Catálogo completo' },
      {
        id: 'sec-fulfillment',
        type: 'fulfillment_info',
        enabled: true,
        title: 'Retirada e Entrega',
      },
      { id: 'sec-footer', type: 'footer', enabled: true, title: 'Rodapé e Contato' },
    ],
  };
}

function validatePaletteColor(raw: unknown, fallback: string): string {
  const upper = String(raw || fallback).trim().toUpperCase();
  if ((APPROVED_STOREFRONT_PALETTE as readonly string[]).includes(upper)) {
    return upper;
  }
  throw new BadRequestException(
    `Cor "${String(raw)}" fora da paleta aprovada (${APPROVED_STOREFRONT_PALETTE.join(', ')}).`,
  );
}

export function validateAndSanitizeTheme(
  rawTheme: any,
  storeName = 'Minha Loja',
): StorefrontThemeConfig {
  const defaults = getDefaultStorefrontTheme(storeName);
  if (!rawTheme || typeof rawTheme !== 'object') {
    return defaults;
  }

  const template: StorefrontTemplateId = (
    STOREFRONT_TEMPLATES as readonly string[]
  ).includes(String(rawTheme.template || ''))
    ? (rawTheme.template as StorefrontTemplateId)
    : defaults.template;

  const primaryColor = validatePaletteColor(
    rawTheme.primaryColor,
    defaults.primaryColor,
  );
  const accentColor = validatePaletteColor(
    rawTheme.accentColor,
    defaults.accentColor,
  );
  const surfaceColor = validatePaletteColor(
    rawTheme.surfaceColor,
    defaults.surfaceColor,
  );
  const textColor = validatePaletteColor(rawTheme.textColor, defaults.textColor);

  const heroTitle =
    sanitizePlainText(rawTheme.heroTitle, 120, 'Título de capa') ||
    defaults.heroTitle;
  const heroSubtitle =
    sanitizePlainText(rawTheme.heroSubtitle, 280, 'Subtítulo de capa') ||
    defaults.heroSubtitle;
  const heroCtaLabel =
    sanitizePlainText(rawTheme.heroCtaLabel, 40, 'Botão da capa') ||
    defaults.heroCtaLabel;
  const announcementText = sanitizePlainText(
    rawTheme.announcementText ?? defaults.announcementText,
    140,
    'Faixa de aviso',
  );

  const rawBanners = Array.isArray(rawTheme.banners)
    ? rawTheme.banners.slice(0, 6)
    : [];
  const banners: StorefrontBannerConfig[] = rawBanners.map(
    (b: any, idx: number) => {
      const targetType = ['all', 'featured', 'category', 'product'].includes(
        String(b?.targetType || ''),
      )
        ? (b.targetType as StorefrontBannerConfig['targetType'])
        : 'all';
      return {
        id: sanitizePlainText(b?.id || `banner-${idx + 1}`, 40),
        title: sanitizePlainText(b?.title || 'Destaque', 100, 'Título do banner'),
        subtitle: sanitizePlainText(b?.subtitle || '', 200, 'Subtítulo do banner'),
        imageUrl: sanitizeSafeImageUrl(b?.imageUrl),
        ctaLabel: sanitizePlainText(b?.ctaLabel || 'Conferir', 40),
        targetType,
        targetValue: sanitizePlainText(b?.targetValue || '', 120),
        enabled: b?.enabled !== false,
      };
    },
  );

  const rawSections = Array.isArray(rawTheme.sections)
    ? rawTheme.sections.slice(0, 12)
    : defaults.sections;
  const sections: StorefrontSectionConfig[] = [];
  const seenTypes = new Set<string>();

  for (let i = 0; i < rawSections.length; i++) {
    const s = rawSections[i];
    const type = String(s?.type || '') as StorefrontSectionType;
    if (!(STOREFRONT_SECTION_TYPES as readonly string[]).includes(type)) {
      continue;
    }
    const id = sanitizePlainText(s?.id || `sec-${type}-${i}`, 40);
    sections.push({
      id,
      type,
      enabled: s?.enabled !== false,
      title: sanitizePlainText(s?.title || '', 80),
      subtitle: sanitizePlainText(s?.subtitle || '', 160),
      categoryId: s?.categoryId ? sanitizePlainText(s.categoryId, 64) : null,
    });
    seenTypes.add(type);
  }

  for (const defSec of defaults.sections) {
    if (!seenTypes.has(defSec.type)) {
      sections.push(defSec);
    }
  }

  return {
    template,
    primaryColor,
    accentColor,
    surfaceColor,
    textColor,
    heroTitle,
    heroSubtitle,
    heroCtaLabel,
    announcementText,
    banners,
    sections,
  };
}

export function normalizeWhatsappPhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    return digits;
  }
  throw new BadRequestException(
    'Informe um número de WhatsApp válido com DDD (ex.: 11999999999 ou 5511999999999).',
  );
}

export function normalizeCustomerPhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new BadRequestException(
      'Informe um telefone/WhatsApp válido com DDD para contato.',
    );
  }
  return digits;
}

export function generateOrderAccessToken(): string {
  return randomBytes(24).toString('hex');
}

export function hashOrderAccessToken(token: string): string {
  return createHash('sha256')
    .update(String(token || '').trim())
    .digest('hex');
}

export function verifyOrderAccessToken(
  providedToken: unknown,
  storedHash: unknown,
): boolean {
  const cleanToken = String(providedToken ?? '').trim();
  const cleanHash = String(storedHash ?? '').trim();
  if (!cleanToken || !cleanHash || cleanToken.length < 16) return false;
  const computed = hashOrderAccessToken(cleanToken);
  if (computed.length !== cleanHash.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(computed, 'utf8'),
      Buffer.from(cleanHash, 'utf8'),
    );
  } catch {
    return false;
  }
}

export function normalizeOrderIdempotencyKey(
  rawKey: unknown,
  tenantId: string,
): string {
  const trimmed = String(rawKey ?? '').trim();
  if (!trimmed || trimmed.length < 8 || trimmed.length > 120) {
    throw new BadRequestException(
      'Chave de idempotência do pedido inválida ou ausente.',
    );
  }
  return createHash('sha256')
    .update(`${tenantId}::storefront-order::${trimmed}`)
    .digest('hex')
    .slice(0, 64);
}

export function computeStorefrontOrderFingerprint(payload: {
  customerPhone: string;
  fulfillmentMode: string;
  items: { productId: string; quantity: number }[];
}): string {
  const canonicalItems = [...(payload.items || [])]
    .map((item) => ({
      productId: String(item.productId || '').trim(),
      quantity: Number(item.quantity || 0),
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  const canonical = JSON.stringify({
    phone: String(payload.customerPhone || '').replace(/\D/g, ''),
    mode: String(payload.fulfillmentMode || 'PICKUP').toUpperCase(),
    items: canonicalItems,
  });

  return createHash('sha256').update(canonical).digest('hex').slice(0, 64);
}

export function formatCurrencyBrl(value: number | string): string {
  const num = Number(value || 0);
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

export function buildStorefrontWhatsappMessage(params: {
  storeName: string;
  introText?: string | null;
  reference: string;
  customerName: string;
  customerPhone: string;
  fulfillmentMode: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: any;
  notes?: string | null;
  total: number;
  items: {
    productName: string;
    size?: string | null;
    color?: string | null;
    quantity: number;
    priceUnit: number;
    subtotal: number;
  }[];
  orderStatusUrl?: string;
  compact?: boolean;
}): string {
  const lines: string[] = [];
  const intro =
    params.introText?.trim() ||
    `Olá! Acabei de registrar um pedido na *${params.storeName || 'Loja Virtual'}*.`;
  lines.push(intro);
  lines.push('');
  lines.push(`*Pedido:* ${params.reference}`);
  lines.push(`*Cliente:* ${params.customerName} (${params.customerPhone})`);
  lines.push(
    `*Atendimento:* ${
      params.fulfillmentMode === 'DELIVERY'
        ? 'Entrega a combinar'
        : 'Retirada na loja'
    }`,
  );

  if (params.fulfillmentMode === 'DELIVERY' && params.deliveryAddress) {
    const addr = params.deliveryAddress;
    const parts = [
      addr.street,
      addr.number ? `nº ${addr.number}` : '',
      addr.complement,
      addr.neighborhood,
      addr.city,
      addr.zipCode ? `CEP ${addr.zipCode}` : '',
      addr.reference ? `(Ref.: ${addr.reference})` : '',
    ].filter(Boolean);
    if (parts.length > 0) {
      lines.push(`*Endereço:* ${parts.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('*Itens do pedido:*');

  const maxDetailedItems = params.compact ? 5 : 20;
  const shownItems = params.items.slice(0, maxDetailedItems);

  for (const item of shownItems) {
    const variantParts = [item.size, item.color].filter(Boolean);
    const variantSuffix = variantParts.length
      ? ` [${variantParts.join(' / ')}]`
      : '';
    lines.push(
      `- ${item.quantity}x ${item.productName}${variantSuffix} — ${formatCurrencyBrl(item.subtotal)}`,
    );
  }

  if (params.items.length > shownItems.length) {
    const remainingCount = params.items.length - shownItems.length;
    lines.push(`...e mais ${remainingCount} item(ns) no pedido.`);
  }

  lines.push('');
  lines.push(`*Total dos produtos:* ${formatCurrencyBrl(params.total)}`);

  if (params.notes?.trim()) {
    lines.push(`*Observações:* ${params.notes.trim()}`);
  }

  if (params.orderStatusUrl) {
    lines.push('');
    lines.push(`Acompanhar pedido: ${params.orderStatusUrl}`);
  }

  return lines.join('\n');
}

export function buildStorefrontWhatsappUrl(
  whatsappPhone: string | null | undefined,
  message: string,
): string | null {
  if (!whatsappPhone) return null;
  const digits = String(whatsappPhone).replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ── RBAC e Matriz de Transições de Estado ────────────────────────────────────

export function assertStorefrontAdminRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (!['admin', 'superadmin', 'manager', 'group_owner'].includes(role)) {
    throw new ForbiddenException(
      'Apenas administradores podem alterar configurações ou publicação da Loja Virtual.',
    );
  }
}

export function assertStorefrontCatalogRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    !['admin', 'superadmin', 'manager', 'group_owner', 'stockist'].includes(role)
  ) {
    throw new ForbiddenException(
      'Sem permissão para gerenciar produtos e categorias da Loja Virtual.',
    );
  }
}

export function assertStorefrontOrderViewRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    ![
      'admin',
      'superadmin',
      'manager',
      'group_owner',
      'operator',
      'stockist',
    ].includes(role)
  ) {
    throw new ForbiddenException(
      'Sem permissão para visualizar pedidos da Loja Virtual.',
    );
  }
}

export function assertStorefrontOrderManageRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    !['admin', 'superadmin', 'manager', 'group_owner', 'operator'].includes(role)
  ) {
    throw new ForbiddenException(
      'Apenas administradores ou operadores de caixa podem confirmar, recusar, cancelar ou converter pedidos.',
    );
  }
}

export function assertStorefrontFulfillmentRole(req: any): void {
  const role = String(req?.user?.role || '').toLowerCase();
  if (
    ![
      'admin',
      'superadmin',
      'manager',
      'group_owner',
      'operator',
      'stockist',
    ].includes(role)
  ) {
    throw new ForbiddenException(
      'Sem permissão para atualizar o andamento da separação/entrega.',
    );
  }
}

const ALLOWED_COMMERCIAL_TRANSITIONS: Record<string, string[]> = {
  AWAITING_CONFIRMATION: [
    'CONFIRMED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
    'COMPLETED',
  ],
  CONFIRMED: ['CANCELLED', 'EXPIRED', 'COMPLETED'],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
  COMPLETED: ['CANCELLED'], // Somente via cancelamento da Sale vinculada
};

export function assertValidCommercialTransition(
  currentStatus: string,
  nextStatus: string,
): void {
  const allowed = ALLOWED_COMMERCIAL_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new BadRequestException(
      `Transição de estado comercial inválida: de "${currentStatus}" para "${nextStatus}".`,
    );
  }
}

const VALID_FULFILLMENT_STATUSES = new Set([
  'WAITING_SEPARATION',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

export function assertValidFulfillmentStatus(status: unknown): string {
  const normalized = String(status || '').trim().toUpperCase();
  if (!VALID_FULFILLMENT_STATUSES.has(normalized)) {
    throw new BadRequestException(
      `Status de atendimento inválido: "${String(status)}".`,
    );
  }
  return normalized;
}

// ── DTO Mappers Públicos (Allowlist Estrita — Nunca expor custos/dados internos) ──

export function toPublicCategoryDto(sc: any) {
  return {
    id: sc.categoryId,
    storefrontCategoryId: sc.id,
    slug: sc.slug,
    name: sc.displayName || sc.category?.name || 'Categoria',
    description: sc.description || null,
    icon: sc.category?.icon || null,
    featured: Boolean(sc.featured),
    sortOrder: Number(sc.sortOrder ?? 0),
  };
}

export function toPublicVariantDto(
  variant: any,
  reservedQty: number,
  groupPriceSell: number,
) {
  const physical = Math.max(0, Math.floor(Number(variant.stock ?? 0)));
  const availableStock = Math.max(0, physical - Math.max(0, reservedQty));
  const priceSell = Number(groupPriceSell || variant.priceSell || 0);
  return {
    id: variant.id,
    size: variant.size || null,
    color: variant.color || null,
    unit: variant.unit || 'UN',
    priceSell,
    availableStock,
    inStock: Boolean(variant.active !== false && availableStock > 0),
  };
}

export function toPublicProductDto(
  sp: any,
  reservedByProductId: Map<string, { quantity: number }>,
) {
  const rg = sp.retailGroup;
  const priceSell = Number(rg?.priceSell ?? 0);
  const rawGallery = Array.isArray(sp.galleryUrlsJson) ? sp.galleryUrlsJson : [];
  const mainImage = rg?.imageUrl || rawGallery[0] || null;
  const gallery = Array.from(
    new Set([mainImage, ...rawGallery].filter(Boolean)),
  ) as string[];

  const activeVariants = (rg?.variants || []).filter(
    (v: any) => v.active !== false,
  );
  const variants = activeVariants.map((v: any) =>
    toPublicVariantDto(
      v,
      reservedByProductId.get(v.id)?.quantity ?? 0,
      priceSell,
    ),
  );

  const totalAvailableStock = variants.reduce(
    (acc: number, v: any) => acc + v.availableStock,
    0,
  );
  const sizes = Array.from(
    new Set(variants.map((v: any) => v.size).filter(Boolean)),
  ) as string[];
  const colors = Array.from(
    new Set(variants.map((v: any) => v.color).filter(Boolean)),
  ) as string[];

  return {
    id: rg.id,
    storefrontProductId: sp.id,
    slug: sp.publicSlug,
    title: sp.commercialTitle || rg.name,
    description: sp.commercialDescription || null,
    badgeLabel: sp.badgeLabel || null,
    categoryId: rg.categoryId,
    categoryName: rg.category?.name || null,
    imageUrl: mainImage,
    galleryUrls: gallery,
    priceSell,
    featured: Boolean(sp.featured),
    sortOrder: Number(sp.sortOrder ?? 0),
    totalAvailableStock,
    inStock: totalAvailableStock > 0,
    sizes,
    colors,
    variants,
  };
}

export function toPublicOrderDto(
  order: any,
  whatsappUrl: string | null,
  whatsappMessage: string,
  compactWhatsappUrl?: string | null,
) {
  return {
    reference: order.reference,
    code: order.code,
    customerFirstName: String(order.customerName || '').split(/\s+/)[0] || 'Cliente',
    fulfillmentMode: order.fulfillmentMode,
    commercialStatus: order.commercialStatus,
    reservationStatus: order.reservationStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    reservationExpiresAt: order.reservationExpiresAt,
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount ?? 0),
    total: Number(order.total ?? 0),
    notes: order.notes || null,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt || null,
    completedAt: order.completedAt || null,
    cancelledAt: order.cancelledAt || null,
    cancelReason: order.cancelReason || null,
    items: (order.items || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      size: item.size || null,
      color: item.color || null,
      variantLabel: item.variantLabel || null,
      imageUrl: item.imageUrl || null,
      unit: item.unit || 'UN',
      quantity: Number(item.quantity),
      priceUnit: Number(item.priceUnit),
      subtotal: Number(item.subtotal),
    })),
    whatsappUrl,
    compactWhatsappUrl: compactWhatsappUrl || whatsappUrl,
    whatsappMessage,
  };
}
