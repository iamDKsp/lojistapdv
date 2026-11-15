import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHmac } from 'crypto';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { lockProducts } from '../prisma/lock-products';
import { getActiveReservedQuantities } from '../prisma/stock-reservations.helper';
import { TenantContextService } from '../prisma/tenant-context.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { retryTransaction } from '../prisma/transaction-retry';
import { SalesService } from '../sales/sales.service';
import {
  EntityPhotoResolverService,
  TenantActorPhotoLookup,
} from '../prisma/entity-photo-resolver.service';
import { isStorefrontSchemaMissingError } from '../tenants/tenant-schema-upgrade';
import { StorefrontAdminService } from './storefront-admin.service';
import {
  ExpressDispatchRecord,
  ExpressDispatchStatus,
  ExpressVehicleType,
  StorefrontDeliveryService,
} from './storefront-delivery.service';
import { StorefrontPublicService } from './storefront-public.service';
import {
  assertValidCommercialTransition,
  assertValidFulfillmentStatus,
  buildStorefrontWhatsappMessage,
  buildStorefrontWhatsappUrl,
  computeStorefrontOrderFingerprint,
  hashOrderAccessToken,
  normalizeCustomerPhone,
  normalizeOrderIdempotencyKey,
  sanitizePlainText,
  toPublicOrderDto,
  verifyOrderAccessToken,
} from './storefront.rules';

@Injectable()
export class StorefrontOrdersService {
  private readonly logger = new Logger(StorefrontOrdersService.name);
  private sweeping = false;

  constructor(
    private readonly heartPrisma: HeartPrismaService,
    private readonly tenantManager: TenantConnectionManager,
    private readonly tenantContext: TenantContextService,
    private readonly publicService: StorefrontPublicService,
    private readonly adminService: StorefrontAdminService,
    private readonly salesService: SalesService,
    @Optional()
    private readonly deliveryService: StorefrontDeliveryService = new StorefrontDeliveryService(),
    @Optional()
    private readonly photoResolver?: EntityPhotoResolverService,
  ) {}

  private deriveOrderAccessToken(tenantId: string, rawClientKey: string): string {
    const secret =
      process.env.JWT_SECRET || 'pdv-lojista-storefront-token-secret-v1';
    return createHmac('sha256', secret)
      .update(`${tenantId}::order-token::${String(rawClientKey).trim()}`)
      .digest('hex');
  }

  private buildOrderWhatsappData(
    settings: any,
    order: any,
    accessToken?: string,
    originUrl?: string,
  ) {
    const statusPath = `/loja/${settings.slug}/pedido/${order.reference}${
      accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
    }`;
    const orderStatusUrl = originUrl ? `${originUrl}${statusPath}` : statusPath;

    const baseParams = {
      storeName: settings.storeName || 'Loja Virtual',
      introText: settings.whatsappMessageIntro,
      reference: order.reference,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fulfillmentMode: (order.fulfillmentMode || 'PICKUP') as
        | 'PICKUP'
        | 'DELIVERY',
      deliveryAddress: order.deliveryAddressJson,
      notes: order.notes,
      subtotal: Number(order.subtotal ?? 0),
      total: Number(order.total ?? 0),
      items: (order.items || []).map((i: any) => ({
        productName: i.productName,
        size: i.size,
        color: i.color,
        quantity: Number(i.quantity),
        priceUnit: Number(i.priceUnit),
        priceSaleSnapshot: Number(i.priceUnit),
        subtotal: Number(i.subtotal),
      })),
      orderStatusUrl,
    };

    const fullMessage = buildStorefrontWhatsappMessage({
      ...baseParams,
      compact: false,
    });
    const compactMessage = buildStorefrontWhatsappMessage({
      ...baseParams,
      compact: true,
    });

    const whatsappUrl = buildStorefrontWhatsappUrl(
      settings.whatsappPhone,
      fullMessage.length > 1800 ? compactMessage : fullMessage,
    );
    const compactWhatsappUrl = buildStorefrontWhatsappUrl(
      settings.whatsappPhone,
      compactMessage,
    );

    return {
      whatsappMessage: fullMessage,
      compactWhatsappMessage: compactMessage,
      whatsappUrl,
      compactWhatsappUrl,
      statusPath,
    };
  }

  // ── Criação Pública Transacional de Pedido + Reserva ──────────────────────

  async createPublicOrder(rawSlug: string, body: any, originUrl?: string) {
    return this.publicService.runInPublicStoreContext(
      rawSlug,
      async ({ tenantId, db, settings, tenant }) => {
        const rawKey = String(body?.idempotencyKey || '').trim();
        const idempotencyKey = normalizeOrderIdempotencyKey(rawKey, tenantId);
        const accessToken = this.deriveOrderAccessToken(tenantId, rawKey);
        const accessTokenHash = hashOrderAccessToken(accessToken);

        const customerName = sanitizePlainText(
          body?.customer?.name ?? body?.customerName,
          120,
          'Nome do cliente',
        );
        if (!customerName || customerName.length < 2) {
          throw new BadRequestException('Informe seu nome para o atendimento.');
        }

        const customerPhone = normalizeCustomerPhone(
          body?.customer?.phone ?? body?.customerPhone,
        );
        const customerCpfRaw = String(
          body?.customer?.cpf ?? body?.customerCpf ?? '',
        ).replace(/\D/g, '');
        const customerCpf =
          customerCpfRaw.length === 11 || customerCpfRaw.length === 14
            ? customerCpfRaw
            : null;

        const fulfillmentMode = String(
          body?.fulfillmentMode || 'PICKUP',
        ).toUpperCase();
        if (fulfillmentMode !== 'PICKUP' && fulfillmentMode !== 'DELIVERY') {
          throw new BadRequestException(
            'Escolha Retirada na loja ou Entrega a combinar.',
          );
        }

        if (fulfillmentMode === 'PICKUP' && !settings.pickupEnabled) {
          throw new BadRequestException(
            'A opção de retirada na loja não está habilitada nesta vitrine.',
          );
        }
        if (fulfillmentMode === 'DELIVERY' && !settings.deliveryEnabled) {
          throw new BadRequestException(
            'A opção de entrega não está habilitada nesta vitrine.',
          );
        }

        let deliveryAddressJson: any = null;
        if (fulfillmentMode === 'DELIVERY') {
          const addr = body?.deliveryAddress || {};
          const street = sanitizePlainText(addr.street, 140, 'Rua/Logradouro');
          const number = sanitizePlainText(addr.number, 30, 'Número');
          const neighborhood = sanitizePlainText(
            addr.neighborhood,
            100,
            'Bairro',
          );
          const city = sanitizePlainText(addr.city, 100, 'Cidade');
          const complement = sanitizePlainText(
            addr.complement,
            100,
            'Complemento',
          );
          const reference = sanitizePlainText(
            addr.reference,
            140,
            'Ponto de referência',
          );
          const zipCode = String(addr.zipCode || '')
            .replace(/\D/g, '')
            .slice(0, 8);

          if (!street || !number || !neighborhood) {
            throw new BadRequestException(
              'Informe rua, número e bairro para entrega.',
            );
          }

          deliveryAddressJson = {
            street,
            number,
            neighborhood,
            city: city || null,
            complement: complement || null,
            reference: reference || null,
            zipCode: zipCode || null,
          };
        }

        const notes = body?.notes
          ? sanitizePlainText(body.notes, 500, 'Observações do pedido')
          : null;

        if (!Array.isArray(body?.items) || body.items.length === 0) {
          throw new BadRequestException(
            'Adicione ao menos um item ao carrinho.',
          );
        }
        if (body.items.length > 50) {
          throw new BadRequestException(
            'O pedido excede o limite de 50 itens distintos.',
          );
        }

        // Consolidar itens por productId
        const consolidated = new Map<
          string,
          { productId: string; quantity: number; expectedPriceUnit?: number }
        >();
        for (const rawItem of body.items) {
          const productId = String(rawItem?.productId || '').trim();
          const quantity = Number(rawItem?.quantity ?? 0);
          if (
            !productId ||
            !Number.isInteger(quantity) ||
            quantity <= 0 ||
            quantity > 200
          ) {
            throw new BadRequestException(
              'Itens ou quantidades inválidos no pedido.',
            );
          }
          const existing = consolidated.get(productId);
          if (existing) {
            existing.quantity += quantity;
            if (existing.quantity > 200) {
              throw new BadRequestException(
                'Quantidade por item excede o limite permitido por pedido.',
              );
            }
          } else {
            consolidated.set(productId, {
              productId,
              quantity,
              expectedPriceUnit:
                rawItem.expectedPriceUnit !== undefined
                  ? Number(rawItem.expectedPriceUnit)
                  : rawItem.priceUnit !== undefined
                    ? Number(rawItem.priceUnit)
                    : undefined,
            });
          }
        }

        const requestedVehicleRaw =
          fulfillmentMode === 'DELIVERY'
            ? String(
                body?.deliveryVehicle ||
                  body?.deliveryAddress?.vehicleType ||
                  '',
              )
                .trim()
                .toUpperCase()
            : '';
        const requestedVehicle: ExpressVehicleType | undefined =
          requestedVehicleRaw === 'CARRO' || requestedVehicleRaw === 'MOTO'
            ? (requestedVehicleRaw as ExpressVehicleType)
            : undefined;

        const expressModuleEnabled = tenant
          ? this.deliveryService.isExpressModuleEnabledOnTenant(tenant)
          : false;
        const expressConfig = this.deliveryService.extractConfigFromTheme(
          settings.publishedThemeJson || settings.draftThemeJson,
          tenant,
        );
        const isExpressActive = Boolean(
          fulfillmentMode === 'DELIVERY' &&
            expressModuleEnabled &&
            expressConfig.enabled,
        );

        const requestedItems = Array.from(consolidated.values());
        const fingerprint = computeStorefrontOrderFingerprint({
          customerPhone,
          fulfillmentMode,
          ...(requestedVehicle ? { deliveryVehicle: requestedVehicle } : {}),
          items: requestedItems,
        });

        const validateReplay = (existingOrder: any) => {
          if (existingOrder.requestFingerprint !== fingerprint) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_CONFLICT',
              message:
                'Esta chave de pedido já foi utilizada para um carrinho diferente.',
            });
          }
          const wa = this.buildOrderWhatsappData(
            settings,
            existingOrder,
            accessToken,
            originUrl,
          );
          return {
            ...toPublicOrderDto(
              existingOrder,
              wa.whatsappUrl,
              wa.whatsappMessage,
              wa.compactWhatsappUrl,
            ),
            accessToken,
            statusPath: wa.statusPath,
            replayed: true,
          };
        };

        // Fast-path idempotency check before entering transaction
        const preExisting = await db.storefrontOrder.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });
        if (preExisting) {
          return validateReplay(preExisting);
        }

        // Pré-aquecer cache de CEP fora da transação (nunca bloquear linhas aguardando rede externa)
        if (isExpressActive) {
          if (deliveryAddressJson?.zipCode) {
            await this.deliveryService.resolveZipCodeInfo(
              deliveryAddressJson.zipCode,
            );
          }
          if (expressConfig.originZipCode) {
            await this.deliveryService.resolveZipCodeInfo(
              expressConfig.originZipCode,
            );
          }
        }

        const productIds = requestedItems
          .map((i) => i.productId)
          .sort((a, b) => a.localeCompare(b));

        let createdOrder: any;
        try {
          createdOrder = await retryTransaction(() =>
            db.$transaction(
              async (tx: any) => {
                // Serializar sequência de códigos do tenant
                await tx.$executeRaw`
                  INSERT INTO tenant_settings (id) VALUES ('singleton')
                  ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
                `;

                const insideExisting = await tx.storefrontOrder.findUnique({
                  where: { idempotencyKey },
                  include: { items: true },
                });
                if (insideExisting) {
                  return { __replay: true, order: insideExisting };
                }

                const now = new Date();

                // Limite anti-abuso de reservas simultâneas para o mesmo telefone
                const activeOrdersByPhone = await tx.storefrontOrder.count({
                  where: {
                    customerPhone,
                    commercialStatus: 'AWAITING_CONFIRMATION',
                    reservationStatus: 'ACTIVE',
                    reservationExpiresAt: { gt: now },
                  },
                });
                if (activeOrdersByPhone >= 5) {
                  throw new BadRequestException(
                    'Você já possui pedidos aguardando confirmação nesta loja. Conclua o atendimento pelo WhatsApp ou aguarde alguns minutos.',
                  );
                }

                // Bloquear produtos em ordem determinística (evita deadlocks)
                await lockProducts(tx, productIds);

                const [productsInDb, reservedMap] = await Promise.all([
                  tx.product.findMany({
                    where: { id: { in: productIds } },
                    include: {
                      retailGroup: {
                        include: {
                          storefrontProduct: true,
                        },
                      },
                    },
                  }),
                  getActiveReservedQuantities(tx, productIds, { now }),
                ]);

                const productMap = new Map(
                  productsInDb.map((p: any) => [p.id, p]),
                );

                const priceDivergences: any[] = [];
                const orderItemsData: any[] = [];
                let subtotalCents = 0;

                for (const reqItem of requestedItems) {
                  const product = productMap.get(reqItem.productId) as any;
                  const rg = product?.retailGroup;
                  const sp = rg?.storefrontProduct;

                  if (
                    !product ||
                    product.active === false ||
                    product.isComposite ||
                    product.requiresKitchen ||
                    product.requiresBar ||
                    product.requiresCarvoaria ||
                    !rg ||
                    rg.active === false ||
                    !sp ||
                    sp.visible !== true
                  ) {
                    throw new BadRequestException(
                      'Um ou mais itens selecionados não estão disponíveis para compra nesta loja.',
                    );
                  }

                  const serverPriceUnit = Number(
                    rg.priceSell ?? product.priceSell ?? 0,
                  );
                  if (serverPriceUnit <= 0) {
                    throw new BadRequestException(
                      `O item "${sp.commercialTitle || rg.name}" está com preço inválido.`,
                    );
                  }

                  const galleryFirst = Array.isArray(sp?.galleryUrlsJson)
                    ? sp.galleryUrlsJson[0] || null
                    : null;
                  const resolvedItemImageUrl =
                    rg.imageUrl || galleryFirst || product.imageUrl || null;

                  if (
                    reqItem.expectedPriceUnit !== undefined &&
                    Math.abs(
                      Number(reqItem.expectedPriceUnit) - serverPriceUnit,
                    ) >= 0.01
                  ) {
                    priceDivergences.push({
                      productId: product.id,
                      productName:
                        sp.commercialTitle || rg.name || product.name,
                      imageUrl: resolvedItemImageUrl,
                      expectedPriceUnit: Number(reqItem.expectedPriceUnit),
                      currentPriceUnit: serverPriceUnit,
                    });
                  }

                  const physicalStock = Math.max(
                    0,
                    Math.floor(Number(product.stock ?? 0)),
                  );
                  const reservedQty =
                    reservedMap.get(product.id)?.quantity ?? 0;
                  const availableStock = Math.max(
                    0,
                    physicalStock - reservedQty,
                  );

                  if (availableStock < reqItem.quantity) {
                    throw new ConflictException({
                      code: 'INSUFFICIENT_STOCK',
                      message: `Estoque insuficiente para "${
                        sp.commercialTitle || rg.name
                      }"${
                        product.size || product.color
                          ? ` (${[product.size, product.color].filter(Boolean).join(' / ')})`
                          : ''
                      }: disponível ${availableStock}, solicitado ${reqItem.quantity}.`,
                      productId: product.id,
                      availableStock,
                      requestedQuantity: reqItem.quantity,
                    });
                  }

                  const unitCents = Math.round(serverPriceUnit * 100);
                  const itemSubtotalCents = unitCents * reqItem.quantity;
                  subtotalCents += itemSubtotalCents;

                  const variantLabel =
                    [product.size, product.color].filter(Boolean).join(' / ') ||
                    null;

                  orderItemsData.push({
                    retailGroupId: rg.id,
                    productId: product.id,
                    productName: sp.commercialTitle || rg.name || product.name,
                    size: product.size || null,
                    color: product.color || null,
                    variantLabel,
                    sku: product.shortCode || null,
                    barcode: product.barcode || null,
                    imageUrl: resolvedItemImageUrl,
                    unit: product.unit || 'UN',
                    quantity: reqItem.quantity,
                    priceUnit: new Prisma.Decimal(serverPriceUnit.toFixed(4)),
                    subtotal: new Prisma.Decimal(
                      (itemSubtotalCents / 100).toFixed(2),
                    ),
                  });
                }

                if (priceDivergences.length > 0) {
                  throw new ConflictException({
                    code: 'PRICE_DIVERGENCE',
                    message:
                      'O preço de uma ou mais mercadorias foi atualizado no catálogo. Confira os valores atualizados antes de concluir.',
                    divergences: priceDivergences,
                  });
                }

                // Vincular ou criar Customer pelo telefone normalizado
                let customer = await tx.customer.findUnique({
                  where: { phone: customerPhone },
                });
                if (!customer) {
                  customer = await tx.customer
                    .create({
                      data: {
                        name: customerName,
                        phone: customerPhone,
                        cpfCnpj: customerCpf,
                        address:
                          fulfillmentMode === 'DELIVERY' && deliveryAddressJson
                            ? `${deliveryAddressJson.street}, ${deliveryAddressJson.number} - ${deliveryAddressJson.neighborhood}`
                            : null,
                        reference:
                          fulfillmentMode === 'DELIVERY' && deliveryAddressJson
                            ? deliveryAddressJson.reference
                            : null,
                      },
                    })
                    .catch(() => null);
                }

                const lastOrder = await tx.storefrontOrder.findFirst({
                  orderBy: { code: 'desc' },
                  select: { code: true },
                });
                const nextCode = (lastOrder?.code ?? 0) + 1;
                const reference = `PED-${String(nextCode).padStart(6, '0')}`;

                const holdMinutes = Math.min(
                  120,
                  Math.max(5, Number(settings.confirmReservationMinutes ?? 15)),
                );
                const reservationExpiresAt = new Date(
                  now.getTime() + holdMinutes * 60_000,
                );

                const subtotalDecimal = new Prisma.Decimal(
                  (subtotalCents / 100).toFixed(2),
                );
                let deliveryFeeCents = 0;
                let finalDeliveryAddressJson = deliveryAddressJson
                  ? { ...deliveryAddressJson }
                  : null;

                if (isExpressActive && finalDeliveryAddressJson) {
                  const quote =
                    await this.deliveryService.calculateDeliveryQuote({
                      config: expressConfig,
                      moduleEnabled: true,
                      destinationZipCode: finalDeliveryAddressJson.zipCode,
                      neighborhood: finalDeliveryAddressJson.neighborhood,
                      city: finalDeliveryAddressJson.city,
                      subtotal: Number((subtotalCents / 100).toFixed(2)),
                      preferredVehicle: requestedVehicle,
                    });

                  if (!quote.available) {
                    throw new BadRequestException(
                      quote.message ||
                        'Entrega 99 indisponível para o endereço ou valor informado.',
                    );
                  }

                  deliveryFeeCents = Math.round(quote.selectedFee * 100);
                  const initialDispatch: ExpressDispatchRecord = {
                    provider: '99_ENTREGAS',
                    status: 'WAITING',
                    vehicleType: quote.selectedVehicle,
                    courierName: null,
                    courierPhone: null,
                    vehiclePlate: null,
                    trackingUrl: null,
                    externalOrderId: null,
                    confirmationPin:
                      this.deliveryService.generateConfirmationPin(),
                    notes: null,
                    requestedAt: null,
                    dispatchedAt: null,
                    deliveredAt: null,
                    updatedAt: now.toISOString(),
                  };

                  finalDeliveryAddressJson = {
                    ...finalDeliveryAddressJson,
                    deliveryFee: quote.selectedFee,
                    quote: {
                      provider: '99_ENTREGAS',
                      vehicleType: quote.selectedVehicle,
                      label:
                        quote.selectedVehicle === 'CARRO'
                          ? '99Entrega Carro'
                          : '99Entrega Moto',
                      fee: quote.selectedFee,
                      distanceKm: quote.distanceKm,
                      estimatedMinutes: quote.estimatedMinutes,
                      freeShippingApplied: quote.freeShippingApplied,
                      originLabel: quote.originLabel,
                    },
                    dispatch: initialDispatch,
                  };
                }

                const totalDecimal = new Prisma.Decimal(
                  ((subtotalCents + deliveryFeeCents) / 100).toFixed(2),
                );

                const order = await tx.storefrontOrder.create({
                  data: {
                    code: nextCode,
                    reference,
                    idempotencyKey,
                    requestFingerprint: fingerprint,
                    accessTokenHash,
                    customerId: customer?.id || null,
                    customerName,
                    customerPhone,
                    customerCpf,
                    fulfillmentMode,
                    deliveryAddressJson: finalDeliveryAddressJson,
                    notes,
                    subtotal: subtotalDecimal,
                    discount: new Prisma.Decimal(0),
                    total: totalDecimal,
                    commercialStatus: 'AWAITING_CONFIRMATION',
                    reservationStatus: 'ACTIVE',
                    fulfillmentStatus: 'WAITING_SEPARATION',
                    paymentStatus: 'UNREGISTERED',
                    reservationExpiresAt,
                    items: {
                      create: orderItemsData,
                    },
                    reservations: {
                      create: orderItemsData.map((oi) => ({
                        productId: oi.productId,
                        quantity: oi.quantity,
                        status: 'ACTIVE',
                        expiresAt: reservationExpiresAt,
                      })),
                    },
                    events: {
                      create: [
                        {
                          eventType: 'ORDER_CREATED',
                          fromStatus: null,
                          toStatus: 'AWAITING_CONFIRMATION',
                          actorType: 'CUSTOMER',
                          actorName: customerName,
                          reason: `Pedido criado com reserva ativa até ${reservationExpiresAt.toISOString()}`,
                          metadataJson: {
                            fulfillmentMode,
                            holdMinutes,
                          },
                        },
                      ],
                    },
                  },
                  include: {
                    items: true,
                  },
                });

                return { __replay: false, order };
              },
              {
                timeout: 20000,
                isolationLevel: 'ReadCommitted',
              },
            ),
          );
        } catch (err: any) {
          if (err?.code === 'P2002') {
            const winner = await db.storefrontOrder.findUnique({
              where: { idempotencyKey },
              include: { items: true },
            });
            if (winner) {
              return validateReplay(winner);
            }
          }
          throw err;
        }

        if (createdOrder.__replay) {
          return validateReplay(createdOrder.order);
        }

        const finalOrder = createdOrder.order;
        const wa = this.buildOrderWhatsappData(
          settings,
          finalOrder,
          accessToken,
          originUrl,
        );

        return {
          ...toPublicOrderDto(
            finalOrder,
            wa.whatsappUrl,
            wa.whatsappMessage,
            wa.compactWhatsappUrl,
          ),
          accessToken,
          statusPath: wa.statusPath,
          replayed: false,
        };
      },
    );
  }

  // ── Consulta Pública Segura do Pedido (Exige Token) ───────────────────────

  async getPublicOrderByReference(
    rawSlug: string,
    rawReference: string,
    providedToken: string,
    originUrl?: string,
  ) {
    return this.publicService.runInPublicStoreContext(
      rawSlug,
      async ({ db, settings }) => {
        const reference = String(rawReference || '')
          .trim()
          .toUpperCase();
        if (!reference || reference.length > 40) {
          throw new NotFoundException('Pedido não encontrado.');
        }

        let order = await db.storefrontOrder.findUnique({
          where: { reference },
          include: { items: true },
        });
        if (!order) {
          throw new NotFoundException('Pedido não encontrado.');
        }

        if (!verifyOrderAccessToken(providedToken, order.accessTokenHash)) {
          throw new ForbiddenException(
            'Credencial de acesso ao pedido inválida ou ausente.',
          );
        }

        // Expiração preguiçosa (lazy expiration) se o prazo já venceu
        const now = new Date();
        if (
          order.reservationStatus === 'ACTIVE' &&
          new Date(order.reservationExpiresAt) <= now &&
          ['AWAITING_CONFIRMATION', 'CONFIRMED'].includes(order.commercialStatus)
        ) {
          await this.expireSingleOrderIfDue(db, order.id, now);
          order =
            (await db.storefrontOrder.findUnique({
              where: { id: order.id },
              include: { items: true },
            })) || order;
        }

        const missingImgMap = await this.buildMissingItemImageMap(
          [order],
          db,
        );
        if (missingImgMap.size > 0 && Array.isArray(order.items)) {
          order = {
            ...order,
            items: order.items.map((it: any) => ({
              ...it,
              imageUrl: it.imageUrl || missingImgMap.get(it.productId) || null,
            })),
          };
        }

        const wa = this.buildOrderWhatsappData(
          settings,
          order,
          providedToken,
          originUrl,
        );

        return toPublicOrderDto(
          order,
          wa.whatsappUrl,
          wa.whatsappMessage,
          wa.compactWhatsappUrl,
        );
      },
      { allowUnpublishedForOrderLookup: true },
    );
  }

  // ── Expiração Durável e Idempotente (Multi-Réplica e Pós-Reinício) ────────

  async expireSingleOrderIfDue(db: any, orderId: string, now = new Date()) {
    return db.$transaction(async (tx: any) => {
      const current = await tx.storefrontOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          commercialStatus: true,
          reservationStatus: true,
          reservationExpiresAt: true,
        },
      });
      if (
        !current ||
        current.reservationStatus !== 'ACTIVE' ||
        !['AWAITING_CONFIRMATION', 'CONFIRMED'].includes(
          current.commercialStatus,
        ) ||
        new Date(current.reservationExpiresAt) > now
      ) {
        return false;
      }

      const updated = await tx.storefrontOrder.updateMany({
        where: {
          id: orderId,
          reservationStatus: 'ACTIVE',
          commercialStatus: { in: ['AWAITING_CONFIRMATION', 'CONFIRMED'] },
          reservationExpiresAt: { lte: now },
        },
        data: {
          commercialStatus: 'EXPIRED',
          reservationStatus: 'EXPIRED',
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        return false;
      }

      await tx.stockReservation.updateMany({
        where: {
          orderId,
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
          releasedAt: now,
          releaseReason: 'Prazo de reserva expirado automaticamente.',
        },
      });

      await tx.storefrontOrderEvent.create({
        data: {
          orderId,
          eventType: 'RESERVATION_EXPIRED',
          fromStatus: current.commercialStatus,
          toStatus: 'EXPIRED',
          actorType: 'SYSTEM',
          reason: 'Prazo da reserva de estoque expirou sem conclusão.',
        },
      });

      return true;
    });
  }

  async expireOverdueReservationsForTenant(db: any, now = new Date()): Promise<number> {
    if (!db?.storefrontOrder?.findMany) return 0;
    try {
      const overdueOrders = await db.storefrontOrder.findMany({
        where: {
          reservationStatus: 'ACTIVE',
          commercialStatus: { in: ['AWAITING_CONFIRMATION', 'CONFIRMED'] },
          reservationExpiresAt: { lte: now },
        },
        select: { id: true },
        take: 100,
      });

      let expiredCount = 0;
      for (const row of overdueOrders) {
        const didExpire = await this.expireSingleOrderIfDue(db, row.id, now);
        if (didExpire) expiredCount++;
      }
      return expiredCount;
    } catch (err) {
      if (isStorefrontSchemaMissingError(err)) return 0;
      throw err;
    }
  }

  @Cron('*/1 * * * *')
  async handlePeriodicReservationSweep() {
    if (this.sweeping || !this.heartPrisma?.storefrontRegistry?.findMany) return;
    this.sweeping = true;
    try {
      const registries = await this.heartPrisma.storefrontRegistry
        .findMany({
          where: { enabled: true },
          include: { tenant: true },
        })
        .catch(() => []);

      const now = new Date();
      for (const reg of registries) {
        if (!reg.tenant || reg.tenant.status !== 'active') continue;
        try {
          const db = await this.tenantManager.getTenantClient(
            reg.tenant.id,
            reg.tenant.databaseUrl,
          );
          await this.expireOverdueReservationsForTenant(db, now);
        } catch (err: any) {
          this.logger.debug(
            `Sweep de reservas ignorado para tenant ${reg.tenantId}: ${err?.message}`,
          );
        }
      }
    } finally {
      this.sweeping = false;
    }
  }

  // ── Gestão Administrativa de Pedidos ──────────────────────────────────────

  private async buildMissingItemImageMap(
    orders: any[],
    db: any,
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (!Array.isArray(orders) || orders.length === 0) return map;
    if (typeof db?.product?.findMany !== 'function') return map;

    const missingProductIds = Array.from(
      new Set(
        orders
          .flatMap((o: any) => (Array.isArray(o?.items) ? o.items : []))
          .filter((i: any) => !i?.imageUrl && i?.productId)
          .map((i: any) => String(i.productId)),
      ),
    );
    if (missingProductIds.length === 0) return map;

    try {
      const products =
        (await Promise.resolve(
          db.product.findMany({
            where: { id: { in: missingProductIds } },
            include: { retailGroup: true },
          }),
        ).catch(() => [])) || [];
      for (const p of products) {
        const img = p?.imageUrl || p?.retailGroup?.imageUrl || null;
        if (img) {
          map.set(p.id, img);
        }
      }
    } catch {
      // fallback silencioso
    }
    return map;
  }

  private async resolveEffectiveActor(
    actor: { userId?: string; name?: string } | undefined,
    ctx: { tenantId: string; userId?: string },
    db: any,
  ): Promise<{ userId: string | null; name: string | null }> {
    const userId = actor?.userId || ctx.userId || null;
    let name = actor?.name || null;
    if (!name && userId && this.photoResolver) {
      try {
        const actors = await this.photoResolver.loadTenantActors(
          ctx.tenantId,
          db,
        );
        name = actors.resolveName(userId, null);
      } catch {
        name = null;
      }
    }
    return { userId, name };
  }

  private async hydrateAdminOrders(
    orders: any[],
    tenantId: string,
    db: any,
    storeName?: string,
  ) {
    if (!Array.isArray(orders) || orders.length === 0) return [];
    const [actors, fallbackImages] = await Promise.all([
      this.photoResolver
        ? this.photoResolver.loadTenantActors(tenantId, db).catch(() => null)
        : Promise.resolve(null),
      this.buildMissingItemImageMap(orders, db),
    ]);
    return orders.map((o: any) =>
      this.formatAdminOrderDto(o, storeName, actors, fallbackImages),
    );
  }

  async listAdminOrders(filters?: {
    commercialStatus?: string;
    fulfillmentStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { ctx, db } =
      await this.adminService.assertModuleAndSchemaReady(false);
    await this.expireOverdueReservationsForTenant(db, new Date());

    const where: any = {};
    if (filters?.commercialStatus && filters.commercialStatus !== 'ALL') {
      where.commercialStatus = filters.commercialStatus;
    }
    if (filters?.fulfillmentStatus && filters.fulfillmentStatus !== 'ALL') {
      where.fulfillmentStatus = filters.fulfillmentStatus;
    }
    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { reference: { contains: term, mode: 'insensitive' } },
        { customerName: { contains: term, mode: 'insensitive' } },
        { customerPhone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, Number(filters?.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters?.limit || 30)));
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      db.storefrontOrder.count({ where }),
      db.storefrontOrder.findMany({
        where,
        include: {
          items: true,
          reservations: true,
          sale: {
            select: {
              id: true,
              code: true,
              status: true,
              total: true,
              operatorId: true,
              operator: { select: { id: true, name: true, isManager: true } },
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formattedOrders = await this.hydrateAdminOrders(
      orders,
      ctx.tenantId,
      db,
    );
    return {
      data: formattedOrders,
      items: formattedOrders,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getAdminOrderById(orderId: string) {
    const { ctx, db } =
      await this.adminService.assertModuleAndSchemaReady(false);
    await this.expireOverdueReservationsForTenant(db, new Date());

    const order = await db.storefrontOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        reservations: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
        customer: true,
        sale: {
          include: {
            payments: true,
            operator: { select: { id: true, name: true, isManager: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    const [formatted] = await this.hydrateAdminOrders(
      [order],
      ctx.tenantId,
      db,
    );
    return formatted;
  }

  private formatAdminOrderDto(
    order: any,
    storeName?: string,
    actors?: TenantActorPhotoLookup | null,
    fallbackImages?: Map<string, string | null>,
  ) {
    const customerDigits = String(order.customerPhone || '').replace(/\D/g, '');
    const customerWaPhone =
      customerDigits.length === 10 || customerDigits.length === 11
        ? `55${customerDigits}`
        : customerDigits;
    const customerWhatsappUrl = customerWaPhone
      ? `https://wa.me/${customerWaPhone}?text=${encodeURIComponent(
          `Olá, ${order.customerName}! Sobre o seu pedido *${order.reference}* na nossa loja:`,
        )}`
      : null;
    const addr =
      order.deliveryAddressJson && typeof order.deliveryAddressJson === 'object'
        ? order.deliveryAddressJson
        : null;

    const subtotalNum = Number(order.subtotal ?? 0);
    const discountNum = Number(order.discount ?? 0);
    const totalNum = Number(order.total ?? 0);
    const inferredFee = Math.max(
      0,
      Math.round((totalNum - subtotalNum + discountNum + Number.EPSILON) * 100) /
        100,
    );
    const deliveryFee =
      addr?.deliveryFee !== undefined
        ? Math.max(0, Number(addr.deliveryFee || 0))
        : inferredFee;

    const expressQuote =
      addr?.quote && typeof addr.quote === 'object' ? addr.quote : null;
    const expressDispatch: ExpressDispatchRecord | null =
      addr?.dispatch && typeof addr.dispatch === 'object'
        ? addr.dispatch
        : null;

    const customerTrackingWhatsappUrl = expressDispatch
      ? this.deliveryService.buildCustomerTrackingWhatsappUrl({
          customerPhone: order.customerPhone,
          customerName: order.customerName,
          storeName: storeName || 'Loja Virtual',
          reference: order.reference,
          dispatch: expressDispatch,
        })
      : customerWhatsappUrl;

    const dropoffCopyLine = addr
      ? [
          addr.street,
          addr.number ? `nº ${addr.number}` : '',
          addr.complement || '',
          addr.neighborhood || '',
          addr.city || '',
          addr.zipCode ? `CEP ${addr.zipCode}` : '',
        ]
          .filter(Boolean)
          .join(', ')
      : null;

    const confirmedActor =
      order.confirmedByUserId || order.confirmedByName
        ? actors
          ? actors.resolveActor(order.confirmedByUserId, order.confirmedByName)
          : { name: order.confirmedByName || null, imageUrl: null }
        : { name: null, imageUrl: null };

    const cancelledActor =
      order.cancelledByUserId || order.cancelledByName
        ? actors
          ? actors.resolveActor(order.cancelledByUserId, order.cancelledByName)
          : { name: order.cancelledByName || null, imageUrl: null }
        : { name: null, imageUrl: null };

    let formattedSale = order.sale || null;
    if (formattedSale && (formattedSale.operatorId || formattedSale.operator)) {
      const saleOpActor = actors
        ? actors.resolveActor(
            formattedSale.operatorId || formattedSale.operator?.id,
            formattedSale.operator?.name || null,
          )
        : {
            name: formattedSale.operator?.name || null,
            imageUrl: formattedSale.operator?.imageUrl || null,
          };
      formattedSale = {
        ...formattedSale,
        operatorName: saleOpActor.name,
        operatorImageUrl: saleOpActor.imageUrl,
        operator: formattedSale.operator
          ? {
              ...EntityPhotoResolverService.stripOperatorSecret(
                formattedSale.operator,
              ),
              imageUrl: saleOpActor.imageUrl,
            }
          : saleOpActor.name
            ? {
                id: formattedSale.operatorId || null,
                name: saleOpActor.name,
                imageUrl: saleOpActor.imageUrl,
              }
            : null,
      };
    }

    return {
      id: order.id,
      code: order.code,
      reference: order.reference,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerCpf: order.customerCpf,
      customerDocument: order.customerCpf,
      customerWhatsappUrl,
      customerTrackingWhatsappUrl,
      whatsappUrl: customerWhatsappUrl,
      fulfillmentMode: order.fulfillmentMode,
      deliveryMode: order.fulfillmentMode,
      deliveryAddress: addr,
      dropoffCopyLine,
      addressLine: addr?.street || null,
      addressNumber: addr?.number || null,
      addressComplement: addr?.complement || null,
      neighborhood: addr?.neighborhood || null,
      city: addr?.city || null,
      state: addr?.state || null,
      zipCode: addr?.zipCode || null,
      notes: order.notes || null,
      subtotal: subtotalNum,
      discount: discountNum,
      deliveryFee,
      total: totalNum,
      expressQuote,
      expressDispatch,
      commercialStatus: order.commercialStatus,
      reservationStatus: order.reservationStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentStatus: order.paymentStatus,
      reservationExpiresAt: order.reservationExpiresAt,
      confirmedAt: order.confirmedAt,
      confirmedByUserId: order.confirmedByUserId || null,
      confirmedByName: confirmedActor.name ?? order.confirmedByName ?? null,
      confirmedByImageUrl: confirmedActor.imageUrl,
      cancelledAt: order.cancelledAt,
      cancelledByUserId: order.cancelledByUserId || null,
      cancelledByName: cancelledActor.name ?? order.cancelledByName ?? null,
      cancelledByImageUrl: cancelledActor.imageUrl,
      cancelReason: order.cancelReason,
      completedAt: order.completedAt,
      saleId: order.saleId,
      sale: formattedSale,
      offlineConflictDetected: Boolean(order.offlineConflictDetected),
      offlineConflictNote: order.offlineConflictNote || null,
      version: Number(order.version ?? 1),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (order.items || []).map((i: any) => ({
        id: i.id,
        retailGroupId: i.retailGroupId,
        productId: i.productId,
        productName: i.productName,
        size: i.size,
        color: i.color,
        variantLabel: i.variantLabel,
        sku: i.sku,
        barcode: i.barcode,
        imageUrl: i.imageUrl || fallbackImages?.get(i.productId) || null,
        unit: i.unit,
        quantity: Number(i.quantity),
        priceUnit: Number(i.priceUnit),
        priceSaleSnapshot: Number(i.priceUnit),
        subtotal: Number(i.subtotal),
      })),
      reservations: (order.reservations || []).map((r: any) => ({
        id: r.id,
        productId: r.productId,
        quantity: Number(r.quantity),
        status: r.status,
        expiresAt: r.expiresAt,
        consumedAt: r.consumedAt,
        releasedAt: r.releasedAt,
        releaseReason: r.releaseReason,
      })),
      events: (order.events || []).map((e: any) => {
        const isStaffEvent =
          e.actorType !== 'CUSTOMER' &&
          e.actorType !== 'SYSTEM' &&
          Boolean(e.actorId || e.actorName);
        const resolvedEventActor =
          isStaffEvent && actors
            ? actors.resolveActor(e.actorId, e.actorName)
            : { name: e.actorName || null, imageUrl: null };
        return {
          id: e.id,
          eventType: e.eventType,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          actorType: e.actorType,
          actorId: e.actorId,
          actorName: isStaffEvent
            ? resolvedEventActor.name || e.actorName || null
            : e.actorName,
          actorImageUrl: isStaffEvent ? resolvedEventActor.imageUrl : null,
          reason: e.reason,
          metadata: e.metadataJson,
          createdAt: e.createdAt,
        };
      }),
    };
  }

  async confirmOrder(
    orderId: string,
    body: { holdHours?: number; reason?: string; expectedVersion?: number },
    actor: { userId?: string; name?: string },
  ) {
    const { ctx, db, tenant } =
      await this.adminService.assertModuleAndSchemaReady(true);
    const settings = await this.adminService.ensureSettingsInitialized(
      db,
      tenant,
      ctx.tenantId,
    );

    const holdHours = Math.min(
      168,
      Math.max(
        1,
        Number(body?.holdHours ?? settings.confirmedHoldHours ?? 24),
      ),
    );

    const effectiveActor = await this.resolveEffectiveActor(actor, ctx, db);

    await db.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM storefront_orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.storefrontOrder.findUnique({
        where: { id: orderId },
        include: { items: true, reservations: true },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado.');

      if (order.commercialStatus === 'CONFIRMED') {
        return; // Idempotente
      }

      assertValidCommercialTransition(order.commercialStatus, 'CONFIRMED');
      if (
        body?.expectedVersion !== undefined &&
        Number(order.version) !== Number(body.expectedVersion)
      ) {
        throw new ConflictException(
          'O pedido foi alterado por outro usuário. Atualize a página.',
        );
      }

      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + holdHours * 3600_000);
      const productIds = (order.items || []).map((i: any) => i.productId);
      await lockProducts(tx, productIds);

      // Verificar se a reserva ainda está válida ou se ainda há estoque disponível para mantê-la ativa
      const activeRes = (order.reservations || []).filter(
        (r: any) => r.status === 'ACTIVE' && new Date(r.expiresAt) > now,
      );

      if (activeRes.length === 0) {
        // Caso a reserva inicial tenha vencido há instantes, revalida disponibilidade física antes de reativar
        const [products, reservedByOthers] = await Promise.all([
          tx.product.findMany({ where: { id: { in: productIds } } }),
          getActiveReservedQuantities(tx, productIds, {
            excludeOrderId: order.id,
            now,
          }),
        ]);
        const productMap = new Map(products.map((p: any) => [p.id, p]));
        for (const item of order.items) {
          const p = productMap.get(item.productId) as any;
          const free =
            Math.max(0, Math.floor(Number(p?.stock ?? 0))) -
            (reservedByOthers.get(item.productId)?.quantity ?? 0);
          if (free < Number(item.quantity)) {
            throw new ConflictException(
              `A reserva inicial expirou e não há mais saldo livre suficiente para "${item.productName}".`,
            );
          }
        }
      }

      await tx.stockReservation.updateMany({
        where: { orderId: order.id, status: { in: ['ACTIVE', 'EXPIRED'] } },
        data: {
          status: 'ACTIVE',
          expiresAt: newExpiresAt,
          releasedAt: null,
          releaseReason: null,
        },
      });

      await tx.storefrontOrder.update({
        where: { id: order.id },
        data: {
          commercialStatus: 'CONFIRMED',
          reservationStatus: 'ACTIVE',
          reservationExpiresAt: newExpiresAt,
          confirmedAt: now,
          confirmedByUserId: effectiveActor.userId,
          confirmedByName: effectiveActor.name,
          version: { increment: 1 },
        },
      });

      await tx.storefrontOrderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'ORDER_CONFIRMED',
          fromStatus: order.commercialStatus,
          toStatus: 'CONFIRMED',
          actorType: 'ADMIN',
          actorId: effectiveActor.userId,
          actorName: effectiveActor.name,
          reason:
            sanitizePlainText(
              body?.reason ||
                `Pedido confirmado com reserva garantida por ${holdHours}h.`,
              300,
            ) || null,
          metadataJson: {
            holdHours,
            reservationExpiresAt: newExpiresAt.toISOString(),
          },
        },
      });
    });

    return this.getAdminOrderById(orderId);
  }

  async rejectOrCancelOrder(
    orderId: string,
    targetStatus: 'REJECTED' | 'CANCELLED',
    body: { reason?: string; expectedVersion?: number },
    actor: { userId?: string; name?: string },
  ) {
    const { ctx, db } =
      await this.adminService.assertModuleAndSchemaReady(true);
    const reason = sanitizePlainText(
      body?.reason ||
        (targetStatus === 'REJECTED'
          ? 'Pedido recusado pela loja.'
          : 'Pedido cancelado pela loja.'),
      400,
      'Motivo',
    );

    const existingOrder = await db.storefrontOrder.findUnique({
      where: { id: orderId },
    });
    if (!existingOrder) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    if (existingOrder.commercialStatus === targetStatus) {
      return this.getAdminOrderById(orderId);
    }

    // Se o pedido já foi convertido em Sale (COMPLETED) e a operação é CANCELLED,
    // cancelar por meio do SalesService.cancel para estornar lotes/estoque exatamente 1 vez!
    if (
      existingOrder.commercialStatus === 'COMPLETED' &&
      targetStatus === 'CANCELLED' &&
      existingOrder.saleId
    ) {
      await this.salesService.cancel(existingOrder.saleId, reason);
      return this.getAdminOrderById(orderId);
    }

    const effectiveActor = await this.resolveEffectiveActor(actor, ctx, db);

    await db.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM storefront_orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.storefrontOrder.findUnique({
        where: { id: orderId },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado.');

      if (order.commercialStatus === targetStatus) return;
      assertValidCommercialTransition(order.commercialStatus, targetStatus);

      if (
        body?.expectedVersion !== undefined &&
        Number(order.version) !== Number(body.expectedVersion)
      ) {
        throw new ConflictException(
          'O pedido foi modificado por outro operador. Atualize a tela.',
        );
      }

      const now = new Date();
      await tx.stockReservation.updateMany({
        where: {
          orderId: order.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'RELEASED',
          releasedAt: now,
          releaseReason: reason,
        },
      });

      await tx.storefrontOrder.update({
        where: { id: order.id },
        data: {
          commercialStatus: targetStatus,
          reservationStatus:
            order.reservationStatus === 'CONSUMED' ? 'CONSUMED' : 'RELEASED',
          cancelledAt: now,
          cancelledByUserId: effectiveActor.userId,
          cancelledByName: effectiveActor.name,
          cancelReason: reason,
          version: { increment: 1 },
        },
      });

      await tx.storefrontOrderEvent.create({
        data: {
          orderId: order.id,
          eventType:
            targetStatus === 'REJECTED' ? 'ORDER_REJECTED' : 'ORDER_CANCELLED',
          fromStatus: order.commercialStatus,
          toStatus: targetStatus,
          actorType: 'ADMIN',
          actorId: effectiveActor.userId,
          actorName: effectiveActor.name,
          reason,
        },
      });
    });

    return this.getAdminOrderById(orderId);
  }

  async updateFulfillmentStatus(
    orderId: string,
    body: { fulfillmentStatus: string; reason?: string },
    actor: { userId?: string; name?: string },
  ) {
    const { ctx, db } =
      await this.adminService.assertModuleAndSchemaReady(true);
    const nextFulfillment = assertValidFulfillmentStatus(
      body?.fulfillmentStatus,
    );

    const effectiveActor = await this.resolveEffectiveActor(actor, ctx, db);

    await db.$transaction(async (tx: any) => {
      const order = await tx.storefrontOrder.findUnique({
        where: { id: orderId },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (
        ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(order.commercialStatus)
      ) {
        throw new BadRequestException(
          `Não é possível alterar o atendimento de um pedido com status "${order.commercialStatus}".`,
        );
      }

      if (order.fulfillmentStatus === nextFulfillment) return;

      const nowIso = new Date().toISOString();
      let updatedAddressJson = order.deliveryAddressJson;
      if (
        order.fulfillmentMode === 'DELIVERY' &&
        updatedAddressJson &&
        typeof updatedAddressJson === 'object'
      ) {
        const prevDispatch =
          (updatedAddressJson as any).dispatch &&
          typeof (updatedAddressJson as any).dispatch === 'object'
            ? (updatedAddressJson as any).dispatch
            : null;
        if (prevDispatch) {
          const syncedStatus: ExpressDispatchStatus =
            nextFulfillment === 'DELIVERED'
              ? 'DELIVERED'
              : nextFulfillment === 'OUT_FOR_DELIVERY'
                ? 'DISPATCHED'
                : prevDispatch.status;
          updatedAddressJson = {
            ...(updatedAddressJson as any),
            dispatch: {
              ...prevDispatch,
              status: syncedStatus,
              ...(syncedStatus === 'DISPATCHED' && !prevDispatch.dispatchedAt
                ? { dispatchedAt: nowIso }
                : {}),
              ...(syncedStatus === 'DELIVERED' && !prevDispatch.deliveredAt
                ? { deliveredAt: nowIso }
                : {}),
              updatedAt: nowIso,
            },
          };
        }
      }

      await tx.storefrontOrder.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: nextFulfillment,
          deliveryAddressJson: updatedAddressJson,
          version: { increment: 1 },
        },
      });

      await tx.storefrontOrderEvent.create({
        data: {
          orderId,
          eventType: 'FULFILLMENT_UPDATED',
          fromStatus: order.fulfillmentStatus,
          toStatus: nextFulfillment,
          actorType: 'ADMIN',
          actorId: effectiveActor.userId,
          actorName: effectiveActor.name,
          reason: body?.reason
            ? sanitizePlainText(body.reason, 300)
            : `Atendimento atualizado para ${nextFulfillment}`,
        },
      });
    });

    return this.getAdminOrderById(orderId);
  }

  // ── Conversão Atômica do Pedido em Venda no PDV ───────────────────────────

  async convertOrderToSale(
    orderId: string,
    body: {
      idempotencyKey?: string;
      paymentMethodName?: string;
      payments?: {
        method: string;
        value: number;
        troco?: number;
        label?: string;
        installments?: number;
        firstDueDate?: string;
      }[];
      discount?: number;
      cashRegisterId?: string;
      operatorId?: string;
      emitirNfce?: boolean;
      customerCpf?: string;
      customerDocument?: string;
      observation?: string;
      expectedVersion?: number;
    },
    actor: { userId?: string; name?: string },
  ) {
    const { ctx, db } =
      await this.adminService.assertModuleAndSchemaReady(true);

    const order = await db.storefrontOrder.findUnique({
      where: { id: orderId },
      include: { items: true, reservations: true, sale: true },
    });
    if (!order) {
      throw new NotFoundException('Pedido da Loja Virtual não encontrado.');
    }

    // Se já foi convertido anteriormente com a mesma operação idempotente, retorna o resultado existente
    if (order.commercialStatus === 'COMPLETED' && order.saleId && order.sale) {
      return {
        order: await this.getAdminOrderById(orderId),
        sale: order.sale,
      };
    }

    const orderDiscount =
      body.discount !== undefined
        ? Number(body.discount)
        : Number(order.discount ?? 0);
    const orderSubtotal = Number(order.subtotal ?? 0);
    const orderTotal = Number(order.total ?? 0);
    const addr =
      order.deliveryAddressJson && typeof order.deliveryAddressJson === 'object'
        ? (order.deliveryAddressJson as any)
        : null;
    const inferredFee = Math.max(
      0,
      Math.round(
        (orderTotal - orderSubtotal + Number(order.discount ?? 0) + Number.EPSILON) *
          100,
      ) / 100,
    );
    const orderDeliveryFee =
      addr?.deliveryFee !== undefined
        ? Math.max(0, Number(addr.deliveryFee || 0))
        : inferredFee;
    const expectedSaleTotal = Math.max(
      0.01,
      Math.round(
        (orderSubtotal - orderDiscount + orderDeliveryFee + Number.EPSILON) *
          100,
      ) / 100,
    );

    let resolvedPayments = Array.isArray(body?.payments) ? body.payments : [];
    if (resolvedPayments.length === 0 && body?.paymentMethodName) {
      resolvedPayments = [
        {
          method: String(body.paymentMethodName).trim(),
          value: expectedSaleTotal,
          label: String(body.paymentMethodName).trim(),
        },
      ];
    }

    if (resolvedPayments.length === 0) {
      throw new BadRequestException(
        'Informe a(s) forma(s) de pagamento para converter o pedido em venda.',
      );
    }

    const checkoutItems = (order.items || []).map((item: any) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      priceUnit: Number(item.priceUnit),
      fiscalSnapshot: {
        productName: item.productName,
        unit: item.unit || 'UN',
      },
    }));

    const sale = await this.salesService.checkout({
      idempotencyKey:
        body.idempotencyKey || `storefront-order-sale-${order.id}`,
      storefrontOrderId: order.id,
      expectedOrderVersion: body.expectedVersion,
      source: 'loja_virtual',
      movimentarEstoque: true,
      operatorId: body.operatorId || actor.userId || ctx.userId,
      operatorName: actor.name || undefined,
      cashRegisterId: body.cashRegisterId || undefined,
      customerId: order.customerId || undefined,
      customerName: order.customerName,
      customerCpf:
        body.customerCpf ||
        body.customerDocument ||
        order.customerCpf ||
        undefined,
      discount: orderDiscount,
      addition: orderDeliveryFee,
      emitirNfce: Boolean(body.emitirNfce),
      items: checkoutItems,
      payments: resolvedPayments,
    });

    const updatedOrder = await this.getAdminOrderById(orderId);
    return {
      order: updatedOrder,
      sale,
    };
  }

  // ── Despacho Express 99 Entregas e Alertas de Frente de Caixa ─────────────

  private sanitizeTrackingUrl(raw: unknown): string | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    if (trimmed.length > 500) {
      throw new BadRequestException('Link de rastreio excede o tamanho máximo.');
    }
    if (!/^https:\/\//i.test(trimmed)) {
      throw new BadRequestException(
        'O link de rastreio da corrida deve iniciar com https://.',
      );
    }
    return trimmed;
  }

  async dispatchExpressOrder(
    orderId: string,
    body: {
      status?: ExpressDispatchStatus;
      vehicleType?: ExpressVehicleType;
      courierName?: string | null;
      courierPhone?: string | null;
      vehiclePlate?: string | null;
      trackingUrl?: string | null;
      externalOrderId?: string | null;
      confirmationPin?: string | null;
      notes?: string | null;
    },
    actor: { userId?: string; name?: string },
  ) {
    const { ctx, db, tenant } =
      await this.adminService.assertModuleAndSchemaReady(true);
    const settings = await this.adminService.ensureSettingsInitialized(
      db,
      tenant,
      ctx.tenantId,
    );

    const validDispatchStatuses: ExpressDispatchStatus[] = [
      'WAITING',
      'FOUND',
      'REQUESTED',
      'PICKED_UP',
      'DISPATCHED',
      'DELIVERED',
    ];
    const requestedStatus = body?.status
      ? (String(body.status).trim().toUpperCase() as ExpressDispatchStatus)
      : undefined;
    if (
      requestedStatus !== undefined &&
      !validDispatchStatuses.includes(requestedStatus)
    ) {
      throw new BadRequestException(
        `Status de despacho 99 inválido: "${String(body.status)}".`,
      );
    }

    let finalDispatch!: ExpressDispatchRecord;
    const effectiveActor = await this.resolveEffectiveActor(actor, ctx, db);

    await db.$transaction(async (tx: any) => {
      const order = await tx.storefrontOrder.findUnique({
        where: { id: orderId },
      });
      if (!order) {
        throw new NotFoundException('Pedido da Loja Virtual não encontrado.');
      }
      if (order.fulfillmentMode !== 'DELIVERY') {
        throw new BadRequestException(
          'Apenas pedidos na modalidade Entrega podem receber despacho 99 Entregas.',
        );
      }
      if (
        ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(order.commercialStatus)
      ) {
        throw new BadRequestException(
          `Não é possível despachar um pedido com status "${order.commercialStatus}".`,
        );
      }

      const prevAddr =
        order.deliveryAddressJson &&
        typeof order.deliveryAddressJson === 'object'
          ? (order.deliveryAddressJson as any)
          : {};
      const prevDispatch: Partial<ExpressDispatchRecord> =
        prevAddr.dispatch && typeof prevAddr.dispatch === 'object'
          ? prevAddr.dispatch
          : {};

      const nowIso = new Date().toISOString();
      const nextStatus: ExpressDispatchStatus =
        requestedStatus || prevDispatch.status || 'REQUESTED';
      const nextVehicle: ExpressVehicleType =
        body?.vehicleType === 'CARRO'
          ? 'CARRO'
          : body?.vehicleType === 'MOTO'
            ? 'MOTO'
            : prevDispatch.vehicleType === 'CARRO'
              ? 'CARRO'
              : prevAddr.quote?.vehicleType === 'CARRO'
                ? 'CARRO'
                : 'MOTO';

      const pinRaw =
        body?.confirmationPin !== undefined && body.confirmationPin !== null
          ? String(body.confirmationPin).replace(/\D/g, '').slice(0, 6)
          : '';
      const confirmationPin =
        pinRaw.length >= 4
          ? pinRaw
          : prevDispatch.confirmationPin ||
            this.deliveryService.generateConfirmationPin();

      finalDispatch = {
        provider: '99_ENTREGAS',
        status: nextStatus,
        vehicleType: nextVehicle,
        courierName:
          body?.courierName !== undefined
            ? sanitizePlainText(body.courierName, 80, 'Nome do entregador') ||
              null
            : prevDispatch.courierName || null,
        courierPhone:
          body?.courierPhone !== undefined
            ? String(body.courierPhone || '')
                .replace(/\D/g, '')
                .slice(0, 15) || null
            : prevDispatch.courierPhone || null,
        vehiclePlate:
          body?.vehiclePlate !== undefined
            ? sanitizePlainText(body.vehiclePlate, 12, 'Placa do veículo')
                .toUpperCase() || null
            : prevDispatch.vehiclePlate || null,
        trackingUrl:
          body?.trackingUrl !== undefined
            ? this.sanitizeTrackingUrl(body.trackingUrl)
            : prevDispatch.trackingUrl || null,
        externalOrderId:
          body?.externalOrderId !== undefined
            ? sanitizePlainText(body.externalOrderId, 80) || null
            : prevDispatch.externalOrderId || null,
        confirmationPin,
        notes:
          body?.notes !== undefined
            ? sanitizePlainText(body.notes, 240) || null
            : prevDispatch.notes || null,
        requestedAt:
          nextStatus !== 'WAITING'
            ? prevDispatch.requestedAt || nowIso
            : prevDispatch.requestedAt || null,
        dispatchedAt:
          nextStatus === 'DISPATCHED' || nextStatus === 'DELIVERED'
            ? prevDispatch.dispatchedAt || nowIso
            : prevDispatch.dispatchedAt || null,
        deliveredAt:
          nextStatus === 'DELIVERED'
            ? prevDispatch.deliveredAt || nowIso
            : null,
        updatedAt: nowIso,
      };

      const nextFulfillmentStatus =
        nextStatus === 'DELIVERED'
          ? 'DELIVERED'
          : nextStatus === 'DISPATCHED'
            ? 'OUT_FOR_DELIVERY'
            : nextStatus === 'PICKED_UP' &&
                ['WAITING_SEPARATION', 'PREPARING'].includes(
                  order.fulfillmentStatus,
                )
              ? 'READY_FOR_PICKUP'
              : (nextStatus === 'REQUESTED' || nextStatus === 'FOUND') &&
                  order.fulfillmentStatus === 'WAITING_SEPARATION'
                ? 'PREPARING'
                : order.fulfillmentStatus;

      await tx.storefrontOrder.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: nextFulfillmentStatus,
          deliveryAddressJson: {
            ...prevAddr,
            dispatch: finalDispatch,
          },
          version: { increment: 1 },
        },
      });

      await tx.storefrontOrderEvent.create({
        data: {
          orderId,
          eventType: 'EXPRESS_99_UPDATED',
          fromStatus: order.fulfillmentStatus,
          toStatus: nextFulfillmentStatus,
          actorType: 'ADMIN',
          actorId: effectiveActor.userId,
          actorName: effectiveActor.name,
          reason: `Despacho 99 (${
            nextVehicle === 'CARRO' ? 'Carro' : 'Moto'
          }): ${nextStatus}`,
          metadataJson: {
            status: nextStatus,
            vehicleType: nextVehicle,
            courierName: finalDispatch.courierName,
            vehiclePlate: finalDispatch.vehiclePlate,
            hasTrackingUrl: Boolean(finalDispatch.trackingUrl),
          },
        },
      });
    });

    const formattedOrder = await this.getAdminOrderById(orderId);
    const customerTrackingWhatsappUrl =
      this.deliveryService.buildCustomerTrackingWhatsappUrl({
        customerPhone: formattedOrder.customerPhone,
        customerName: formattedOrder.customerName,
        storeName: settings.storeName || 'Loja Virtual',
        reference: formattedOrder.reference,
        dispatch: finalDispatch,
      });

    return {
      order: {
        ...formattedOrder,
        customerTrackingWhatsappUrl,
      },
      customerTrackingWhatsappUrl,
    };
  }

  async getPosAlerts() {
    try {
      const { ctx, db, tenant } =
        await this.adminService.assertModuleAndSchemaReady(false);
      await this.expireOverdueReservationsForTenant(db, new Date());

      const settings = await this.adminService.ensureSettingsInitialized(
        db,
        tenant,
        ctx.tenantId,
      );
      const expressModuleEnabled = tenant
        ? this.deliveryService.isExpressModuleEnabledOnTenant(tenant)
        : false;
      const expressConfig = this.deliveryService.extractConfigFromTheme(
        settings.publishedThemeJson || settings.draftThemeJson,
        tenant,
      );

      const activeOrders = await db.storefrontOrder.findMany({
        where: {
          commercialStatus: { in: ['AWAITING_CONFIRMATION', 'CONFIRMED'] },
        },
        include: {
          items: true,
          reservations: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });

      const actionable = (activeOrders || []).filter(
        (o: any) => o.fulfillmentStatus !== 'DELIVERED',
      );

      // Priorizar AWAITING_CONFIRMATION + DELIVERY no topo da frente de caixa
      actionable.sort((a: any, b: any) => {
        const score = (ord: any) => {
          let s = 0;
          if (ord.commercialStatus === 'AWAITING_CONFIRMATION') s += 10;
          if (ord.fulfillmentMode === 'DELIVERY') s += 5;
          return s;
        };
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      const pendingConfirmationCount = actionable.filter(
        (o: any) => o.commercialStatus === 'AWAITING_CONFIRMATION',
      ).length;
      const pendingDeliveryCount = actionable.filter(
        (o: any) =>
          o.fulfillmentMode === 'DELIVERY' &&
          o.commercialStatus === 'AWAITING_CONFIRMATION',
      ).length;
      const activeExpressCount = actionable.filter(
        (o: any) => o.fulfillmentMode === 'DELIVERY',
      ).length;

      const originAddressLine = [
        expressConfig.originStreet,
        expressConfig.originNumber ? `nº ${expressConfig.originNumber}` : '',
        expressConfig.originNeighborhood,
        expressConfig.originCity,
        expressConfig.originState,
        expressConfig.originZipCode
          ? `CEP ${expressConfig.originZipCode}`
          : '',
      ]
        .filter(Boolean)
        .join(', ');

      const alerts = await this.hydrateAdminOrders(
        actionable.slice(0, 15),
        ctx.tenantId,
        db,
        settings.storeName || 'Loja Virtual',
      );

      return {
        enabled: true,
        expressDeliveryModuleEnabled: expressModuleEnabled,
        storeName: settings.storeName || 'Loja Virtual',
        originAddressLine: originAddressLine || null,
        serverTime: new Date().toISOString(),
        totalActionableCount: actionable.length,
        pendingConfirmationCount,
        pendingDeliveryCount,
        activeExpressCount,
        latestOrderId: actionable[0]?.id || null,
        latestOrderAt: actionable[0]?.createdAt || null,
        alerts,
      };
    } catch {
      return {
        enabled: false,
        expressDeliveryModuleEnabled: false,
        storeName: null,
        originAddressLine: null,
        serverTime: new Date().toISOString(),
        totalActionableCount: 0,
        pendingConfirmationCount: 0,
        pendingDeliveryCount: 0,
        activeExpressCount: 0,
        latestOrderId: null,
        latestOrderAt: null,
        alerts: [],
      };
    }
  }
}
