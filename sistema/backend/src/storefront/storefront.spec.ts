import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TenantContextService } from '../prisma/tenant-context.service';
import { RetailReturnsService } from '../retail/retail-returns.service';
import { SalesService } from '../sales/sales.service';
import { StorefrontAdminService } from './storefront-admin.service';
import { StorefrontOrdersService } from './storefront-orders.service';
import { StorefrontPublicService } from './storefront-public.service';

interface InMemoryTenantDb {
  tenantId: string;
  settings: any;
  revisions: any[];
  categories: any[];
  storefrontCategories: any[];
  retailGroups: any[];
  products: any[];
  storefrontProducts: any[];
  stockLots: any[];
  inventoryLogs: any[];
  orders: any[];
  orderItems: any[];
  reservations: any[];
  orderEvents: any[];
  customers: any[];
  cashRegisters: any[];
  sales: any[];
  saleItems: any[];
  payments: any[];
  returns: any[];
  client: any;
}

function createInMemoryTenantDb(
  tenantId: string,
  slug: string,
  storeName: string,
): InMemoryTenantDb {
  const state: InMemoryTenantDb = {
    tenantId,
    settings: {
      id: 'singleton',
      publicId: `pub-${tenantId}`,
      slug,
      storeName,
      tagline: `Tagline ${storeName}`,
      description: `Descrição ${storeName}`,
      logoUrl: null,
      coverUrl: null,
      whatsappPhone: '5511999998888',
      whatsappMessageIntro: 'Olá! Segue meu pedido:',
      pickupEnabled: true,
      pickupInstructions: 'Retire no balcão',
      deliveryEnabled: true,
      deliveryInstructions: 'Entrega combinada',
      deliveryFeeNote: 'A combinar',
      confirmReservationMinutes: 15,
      confirmedHoldHours: 24,
      draftThemeJson: {
        template: 'editorial_roxo',
        primaryColor: '#7C3AED',
        accentColor: '#6D28D9',
        heroTitle: `Bem-vindo à ${storeName}`,
        heroSubtitle: 'Confira nossas peças',
        heroCtaLabel: 'Ver coleção',
        announcementText: 'Frete a combinar',
        sections: [
          { id: 'sec-header', type: 'header', enabled: true },
          { id: 'sec-hero', type: 'hero', enabled: true },
          { id: 'sec-categories', type: 'categories', enabled: true },
          { id: 'sec-featured', type: 'featured', enabled: true },
          { id: 'sec-collection', type: 'collection', enabled: true },
          { id: 'sec-fulfillment', type: 'fulfillment_info', enabled: true },
          { id: 'sec-footer', type: 'footer', enabled: true },
        ],
        banners: [],
      },
      publishedThemeJson: {
        template: 'editorial_roxo',
        primaryColor: '#7C3AED',
        accentColor: '#6D28D9',
        heroTitle: `Bem-vindo à ${storeName}`,
        heroSubtitle: 'Confira nossas peças',
        heroCtaLabel: 'Ver coleção',
        announcementText: 'Frete a combinar',
        sections: [
          { id: 'sec-header', type: 'header', enabled: true },
          { id: 'sec-hero', type: 'hero', enabled: true },
          { id: 'sec-categories', type: 'categories', enabled: true },
          { id: 'sec-featured', type: 'featured', enabled: true },
          { id: 'sec-collection', type: 'collection', enabled: true },
          { id: 'sec-fulfillment', type: 'fulfillment_info', enabled: true },
          { id: 'sec-footer', type: 'footer', enabled: true },
        ],
        banners: [],
      },
      publishedVersion: 1,
      isPublished: true,
      publishedAt: new Date(),
      updatedAt: new Date(),
    },
    revisions: [],
    categories: [
      {
        id: `cat-${tenantId}`,
        name: 'Camisetas',
        icon: null,
        createdAt: new Date(),
      },
    ],
    storefrontCategories: [
      {
        id: `sc-${tenantId}`,
        categoryId: `cat-${tenantId}`,
        slug: 'camisetas',
        displayName: 'Camisetas',
        description: 'Linha casual',
        visible: true,
        featured: true,
        sortOrder: 10,
        createdAt: new Date(),
      },
    ],
    retailGroups: [
      {
        id: `rg-vis-${tenantId}`,
        name: `Camiseta Básica ${storeName}`,
        description: 'Algodão Egípcio',
        categoryId: `cat-${tenantId}`,
        imageUrl: '/api/products/uploads/images/foto1',
        priceSell: 79.9,
        priceCost: 32.5,
        ncm: '61091000',
        cest: null,
        origem: '0',
        active: true,
        version: 1,
      },
      {
        id: `rg-hid-${tenantId}`,
        name: `Peça Secreta ${storeName}`,
        description: 'Uso interno',
        categoryId: `cat-${tenantId}`,
        imageUrl: null,
        priceSell: 120.0,
        priceCost: 50.0,
        ncm: '61091000',
        cest: null,
        origem: '0',
        active: true,
        version: 1,
      },
    ],
    products: [
      {
        id: `prod-m-${tenantId}`,
        retailGroupId: `rg-vis-${tenantId}`,
        categoryId: `cat-${tenantId}`,
        name: `Camiseta Básica ${storeName} · M · Preta`,
        size: 'M',
        color: 'Preta',
        shortCode: 'CAM-M-PR',
        barcode: `7890001-${tenantId}`,
        imageUrl: '/api/products/uploads/images/foto1',
        priceSell: 79.9,
        priceCost: 32.5,
        stock: 2,
        unit: 'UN',
        active: true,
        isComposite: false,
        requiresKitchen: false,
        requiresBar: false,
        requiresCarvoaria: false,
      },
      {
        id: `prod-hid-${tenantId}`,
        retailGroupId: `rg-hid-${tenantId}`,
        categoryId: `cat-${tenantId}`,
        name: `Peça Secreta ${storeName} · U · Única`,
        size: 'U',
        color: 'Única',
        shortCode: 'SEC-U',
        barcode: `7890002-${tenantId}`,
        imageUrl: null,
        priceSell: 120.0,
        priceCost: 50.0,
        stock: 5,
        unit: 'UN',
        active: true,
        isComposite: false,
        requiresKitchen: false,
        requiresBar: false,
        requiresCarvoaria: false,
      },
    ],
    storefrontProducts: [
      {
        id: `sp-vis-${tenantId}`,
        retailGroupId: `rg-vis-${tenantId}`,
        publicSlug: `camiseta-basica-${tenantId}`,
        visible: true,
        featured: true,
        sortOrder: 10,
        commercialTitle: `Camiseta Básica ${storeName}`,
        commercialDescription: 'Malha premium confortável.',
        badgeLabel: 'Lançamento',
        galleryUrlsJson: [],
      },
      {
        id: `sp-hid-${tenantId}`,
        retailGroupId: `rg-hid-${tenantId}`,
        publicSlug: `peca-secreta-${tenantId}`,
        visible: false,
        featured: false,
        sortOrder: 20,
        commercialTitle: `Peça Secreta ${storeName}`,
        commercialDescription: null,
        badgeLabel: null,
        galleryUrlsJson: [],
      },
    ],
    stockLots: [
      {
        id: `lot-1-${tenantId}`,
        productId: `prod-m-${tenantId}`,
        quantity: 2,
        remaining: 2,
        costPrice: 32.5,
        createdAt: new Date(),
      },
    ],
    inventoryLogs: [],
    orders: [],
    orderItems: [],
    reservations: [],
    orderEvents: [],
    customers: [],
    cashRegisters: [],
    sales: [],
    saleItems: [],
    payments: [],
    returns: [],
    client: null,
  };

  const attachRelationsToGroup = (rg: any) => {
    const category =
      state.categories.find((c) => c.id === rg.categoryId) || null;
    const storefrontCategory =
      state.storefrontCategories.find((sc) => sc.categoryId === rg.categoryId) ||
      null;
    const storefrontProduct =
      state.storefrontProducts.find((sp) => sp.retailGroupId === rg.id) || null;
    const variants = state.products.filter(
      (p) => p.retailGroupId === rg.id && p.active !== false,
    );
    return {
      ...rg,
      category: category ? { ...category, storefrontCategory } : null,
      storefrontProduct,
      variants,
    };
  };

  const attachRelationsToOrder = (o: any) => {
    if (!o) return null;
    const items = state.orderItems.filter((i) => i.orderId === o.id);
    const reservations = state.reservations.filter((r) => r.orderId === o.id);
    const events = state.orderEvents
      .filter((e) => e.orderId === o.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    const sale = o.saleId
      ? state.sales.find((s) => s.id === o.saleId) || null
      : null;
    const customer = o.customerId
      ? state.customers.find((c) => c.id === o.customerId) || null
      : null;
    return {
      ...o,
      items,
      reservations,
      events,
      sale: sale
        ? {
            ...sale,
            payments: state.payments.filter((p) => p.saleId === sale.id),
          }
        : null,
      customer,
    };
  };

  let txQueue: Promise<any> = Promise.resolve();

  const client: any = {
    $transaction: async (fn: any) => {
      const prev = txQueue;
      let release!: () => void;
      txQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await prev;
      const snapshot = JSON.parse(
        JSON.stringify({
          settings: state.settings,
          revisions: state.revisions,
          categories: state.categories,
          storefrontCategories: state.storefrontCategories,
          retailGroups: state.retailGroups,
          products: state.products,
          storefrontProducts: state.storefrontProducts,
          stockLots: state.stockLots,
          inventoryLogs: state.inventoryLogs,
          orders: state.orders,
          orderItems: state.orderItems,
          reservations: state.reservations,
          orderEvents: state.orderEvents,
          customers: state.customers,
          cashRegisters: state.cashRegisters,
          sales: state.sales,
          saleItems: state.saleItems,
          payments: state.payments,
          returns: state.returns,
        }),
      );
      try {
        return await fn(client);
      } catch (err) {
        Object.assign(state, snapshot);
        throw err;
      } finally {
        release();
      }
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockImplementation((strings: any) => {
      const sql = Array.isArray(strings)
        ? strings.join(' ')
        : String(strings?.sql || '');
      if (sql.includes('information_schema.tables')) {
        return Promise.resolve([
          { table_name: 'storefront_settings' },
          { table_name: 'storefront_revisions' },
          { table_name: 'storefront_categories' },
          { table_name: 'storefront_products' },
          { table_name: 'storefront_orders' },
          { table_name: 'storefront_order_items' },
          { table_name: 'stock_reservations' },
          { table_name: 'storefront_order_events' },
        ]);
      }
      return Promise.resolve([]);
    }),
    tenantSettings: {
      findFirst: async () => ({ allowNegativeStock: false }),
      findUnique: async () => ({ id: 'singleton', allowNegativeStock: false }),
    },
    tenantPaymentMethod: {
      findMany: async () => [],
    },
    operator: {
      findUnique: async () => ({ id: 'op-1', name: 'Operador' }),
    },
    storeCreditUse: {
      findMany: async () => [],
    },
    storefrontSettings: {
      findFirst: async () =>
        state.settings ? { ...state.settings } : null,
      findUnique: async () =>
        state.settings ? { ...state.settings } : null,
      create: async ({ data }: any) => {
        state.settings = { ...data, updatedAt: new Date() };
        return { ...state.settings };
      },
      update: async ({ data }: any) => {
        state.settings = {
          ...state.settings,
          ...data,
          updatedAt: new Date(),
        };
        return { ...state.settings };
      },
    },
    storefrontRevision: {
      findFirst: async () =>
        state.revisions.length
          ? [...state.revisions].sort((a, b) => b.version - a.version)[0]
          : null,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of state.revisions) {
          if (!where?.status || r.status === where.status) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      },
      create: async ({ data }: any) => {
        const rev = {
          id: `rev-${state.revisions.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        state.revisions.push(rev);
        return rev;
      },
    },
    category: {
      findMany: async () => [...state.categories],
      findFirst: async ({ where }: any) =>
        state.categories.find(
          (c) =>
            c.name.toLowerCase() === String(where?.name?.equals || '').toLowerCase(),
        ) || null,
      findUnique: async ({ where }: any) =>
        state.categories.find(
          (c) => c.id === where.id || c.name === where.name,
        ) || null,
      create: async ({ data }: any) => {
        const created = {
          id: `cat-${state.categories.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        state.categories.push(created);
        return created;
      },
    },
    storefrontCategory: {
      findFirst: async () => state.storefrontCategories[0] || null,
      findMany: async () =>
        state.storefrontCategories.map((sc) => ({
          ...sc,
          category: {
            ...(state.categories.find((c) => c.id === sc.categoryId) || {}),
            _count: {
              retailGroups: state.retailGroups.filter(
                (g) => g.categoryId === sc.categoryId && g.active,
              ).length,
            },
          },
        })),
      create: async ({ data }: any) => {
        const sc = {
          id: `sc-${state.storefrontCategories.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        state.storefrontCategories.push(sc);
        return sc;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const sc of state.storefrontCategories) {
          if (sc.categoryId === where.categoryId) {
            Object.assign(sc, data);
            count++;
          }
        }
        return { count };
      },
    },
    retailGroup: {
      count: async () => state.retailGroups.filter((g) => g.active).length,
      findMany: async ({ where }: any) => {
        return state.retailGroups
          .filter((rg) => {
            if (where?.active !== undefined && rg.active !== where.active)
              return false;
            if (where?.storefrontProduct?.visible !== undefined) {
              const sp = state.storefrontProducts.find(
                (s) => s.retailGroupId === rg.id,
              );
              if (Boolean(sp?.visible) !== where.storefrontProduct.visible)
                return false;
            }
            if (where?.storefrontProduct?.featured !== undefined) {
              const sp = state.storefrontProducts.find(
                (s) => s.retailGroupId === rg.id,
              );
              if (Boolean(sp?.featured) !== where.storefrontProduct.featured)
                return false;
            }
            if (where?.id?.not && rg.id === where.id.not) return false;
            return true;
          })
          .map(attachRelationsToGroup);
      },
      findUnique: async ({ where }: any) => {
        const rg = state.retailGroups.find((g) => g.id === where.id);
        return rg ? attachRelationsToGroup(rg) : null;
      },
    },
    storefrontProduct: {
      findFirst: async () => state.storefrontProducts[0] || null,
      count: async ({ where }: any) => {
        return state.storefrontProducts.filter((sp) => {
          if (where?.visible !== undefined && sp.visible !== where.visible)
            return false;
          if (where?.featured !== undefined && sp.featured !== where.featured)
            return false;
          return true;
        }).length;
      },
      findMany: async ({ where }: any = {}) =>
        state.storefrontProducts
          .filter((sp) => {
            if (where?.visible !== undefined && sp.visible !== where.visible)
              return false;
            if (where?.featured !== undefined && sp.featured !== where.featured)
              return false;
            return true;
          })
          .map((sp) => {
            const rg = state.retailGroups.find(
              (g) => g.id === sp.retailGroupId,
            );
            return {
              ...sp,
              retailGroup: rg ? attachRelationsToGroup(rg) : null,
            };
          }),
      findUnique: async ({ where }: any) => {
        const sp = state.storefrontProducts.find(
          (s) =>
            (where.publicSlug && s.publicSlug === where.publicSlug) ||
            (where.retailGroupId && s.retailGroupId === where.retailGroupId),
        );
        if (!sp) return null;
        const rg = state.retailGroups.find((g) => g.id === sp.retailGroupId);
        return {
          ...sp,
          retailGroup: rg ? attachRelationsToGroup(rg) : null,
        };
      },
      upsert: async ({ where, update, create }: any) => {
        const existing = state.storefrontProducts.find(
          (s) => s.retailGroupId === where.retailGroupId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = {
          id: `sp-${state.storefrontProducts.length + 1}`,
          ...create,
        };
        state.storefrontProducts.push(created);
        return created;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const sp of state.storefrontProducts) {
          if (where?.retailGroupId?.in?.includes(sp.retailGroupId)) {
            Object.assign(sp, data);
            count++;
          }
        }
        return { count };
      },
    },
    product: {
      findMany: async ({ where }: any) => {
        return state.products
          .filter((p) => {
            if (where?.id?.in && !where.id.in.includes(p.id)) return false;
            return true;
          })
          .map((p) => {
            const rg = state.retailGroups.find((g) => g.id === p.retailGroupId);
            return {
              ...p,
              retailGroup: rg ? attachRelationsToGroup(rg) : null,
            };
          });
      },
      findUnique: async ({ where }: any) =>
        state.products.find((p) => p.id === where.id) || null,
      updateMany: async ({ where, data }: any) => {
        const prod = state.products.find((p) => p.id === where.id);
        if (!prod) return { count: 0 };
        if (
          where?.stock?.gte !== undefined &&
          Number(prod.stock) < Number(String(where.stock.gte))
        ) {
          return { count: 0 };
        }
        if (data.stock?.decrement !== undefined) {
          prod.stock =
            Number(prod.stock) - Number(String(data.stock.decrement));
        } else if (data.stock?.increment !== undefined) {
          prod.stock =
            Number(prod.stock) + Number(String(data.stock.increment));
        }
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const prod = state.products.find((p) => p.id === where.id);
        if (!prod) throw new NotFoundException('Product not found');
        if (data.stock?.decrement !== undefined) {
          prod.stock =
            Number(prod.stock) - Number(String(data.stock.decrement));
        } else if (data.stock?.increment !== undefined) {
          prod.stock =
            Number(prod.stock) + Number(String(data.stock.increment));
        } else if (data.stock !== undefined) {
          prod.stock = Number(String(data.stock));
        }
        return { ...prod };
      },
    },
    stockReservation: {
      findFirst: async () => state.reservations[0] || null,
      findMany: async ({ where }: any) => {
        return state.reservations
          .filter((r) => {
            if (where?.productId?.in && !where.productId.in.includes(r.productId))
              return false;
            if (where?.status && r.status !== where.status) return false;
            if (
              where?.expiresAt?.gt &&
              new Date(r.expiresAt) <= new Date(where.expiresAt.gt)
            )
              return false;
            if (where?.orderId?.not && r.orderId === where.orderId.not)
              return false;
            if (where?.orderId && typeof where.orderId === 'string' && r.orderId !== where.orderId)
              return false;
            return true;
          })
          .map((r) => ({
            ...r,
            order: state.orders.find((o) => o.id === r.orderId) || null,
          }));
      },
      aggregate: async ({ where }: any) => {
        const matching = state.reservations.filter((r) => {
          if (where?.status && r.status !== where.status) return false;
          if (
            where?.expiresAt?.gt &&
            new Date(r.expiresAt) <= new Date(where.expiresAt.gt)
          )
            return false;
          return true;
        });
        return {
          _count: { id: matching.length },
          _sum: {
            quantity: matching.reduce((acc, r) => acc + Number(r.quantity), 0),
          },
        };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of state.reservations) {
          if (where?.orderId && r.orderId !== where.orderId) continue;
          if (where?.status) {
            if (typeof where.status === 'string' && r.status !== where.status)
              continue;
            if (where.status.in && !where.status.in.includes(r.status)) continue;
          }
          Object.assign(r, data);
          count++;
        }
        return { count };
      },
    },
    storefrontOrder: {
      count: async ({ where }: any) => {
        return state.orders.filter((o) => {
          if (where?.customerPhone && o.customerPhone !== where.customerPhone)
            return false;
          if (where?.commercialStatus) {
            if (
              typeof where.commercialStatus === 'string' &&
              o.commercialStatus !== where.commercialStatus
            )
              return false;
            if (
              where.commercialStatus.in &&
              !where.commercialStatus.in.includes(o.commercialStatus)
            )
              return false;
          }
          if (
            where?.reservationStatus &&
            o.reservationStatus !== where.reservationStatus
          )
            return false;
          if (
            where?.reservationExpiresAt?.gt &&
            new Date(o.reservationExpiresAt) <=
              new Date(where.reservationExpiresAt.gt)
          )
            return false;
          return true;
        }).length;
      },
      findFirst: async () => {
        if (!state.orders.length) return null;
        return [...state.orders].sort((a, b) => b.code - a.code)[0];
      },
      findUnique: async ({ where }: any) => {
        const found = state.orders.find(
          (o) =>
            (where.id && o.id === where.id) ||
            (where.idempotencyKey && o.idempotencyKey === where.idempotencyKey) ||
            (where.reference && o.reference === where.reference) ||
            (where.saleId && o.saleId === where.saleId),
        );
        return attachRelationsToOrder(found);
      },
      findMany: async ({ where }: any) => {
        return state.orders
          .filter((o) => {
            if (where?.reservationStatus && o.reservationStatus !== where.reservationStatus)
              return false;
            if (
              where?.commercialStatus?.in &&
              !where.commercialStatus.in.includes(o.commercialStatus)
            )
              return false;
            if (
              where?.reservationExpiresAt?.lte &&
              new Date(o.reservationExpiresAt) >
                new Date(where.reservationExpiresAt.lte)
            )
              return false;
            return true;
          })
          .map(attachRelationsToOrder);
      },
      create: async ({ data }: any) => {
        if (
          state.orders.some((o) => o.idempotencyKey === data.idempotencyKey)
        ) {
          const err: any = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
        const orderId = `ord-${tenantId}-${state.orders.length + 1}`;
        const now = new Date();
        const orderRow = {
          id: orderId,
          code: data.code,
          reference: data.reference,
          idempotencyKey: data.idempotencyKey,
          requestFingerprint: data.requestFingerprint,
          accessTokenHash: data.accessTokenHash,
          customerId: data.customerId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerCpf: data.customerCpf,
          fulfillmentMode: data.fulfillmentMode,
          deliveryAddressJson: data.deliveryAddressJson,
          notes: data.notes,
          subtotal: Number(data.subtotal),
          discount: Number(data.discount),
          total: Number(data.total),
          commercialStatus: data.commercialStatus,
          reservationStatus: data.reservationStatus,
          fulfillmentStatus: data.fulfillmentStatus,
          paymentStatus: data.paymentStatus,
          reservationExpiresAt: data.reservationExpiresAt,
          saleId: null,
          offlineConflictDetected: false,
          offlineConflictNote: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        state.orders.push(orderRow);

        for (const item of data.items?.create || []) {
          state.orderItems.push({
            id: `oi-${state.orderItems.length + 1}`,
            orderId,
            ...item,
            priceUnit: Number(item.priceUnit),
            subtotal: Number(item.subtotal),
          });
        }
        for (const res of data.reservations?.create || []) {
          state.reservations.push({
            id: `res-${state.reservations.length + 1}`,
            orderId,
            ...res,
            createdAt: now,
          });
        }
        for (const ev of data.events?.create || []) {
          state.orderEvents.push({
            id: `ev-${state.orderEvents.length + 1}`,
            orderId,
            ...ev,
            createdAt: now,
          });
        }

        return attachRelationsToOrder(orderRow);
      },
      update: async ({ where, data }: any) => {
        const ord = state.orders.find((o) => o.id === where.id);
        if (!ord) throw new NotFoundException('Order not found');
        const { version, ...rest } = data;
        Object.assign(ord, rest);
        if (version?.increment) {
          ord.version = Number(ord.version || 1) + Number(version.increment);
        }
        ord.updatedAt = new Date();
        return attachRelationsToOrder(ord);
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const ord of state.orders) {
          if (where?.id && ord.id !== where.id) continue;
          if (
            where?.reservationStatus &&
            ord.reservationStatus !== where.reservationStatus
          )
            continue;
          if (
            where?.commercialStatus?.in &&
            !where.commercialStatus.in.includes(ord.commercialStatus)
          )
            continue;
          if (
            where?.reservationExpiresAt?.lte &&
            new Date(ord.reservationExpiresAt) >
              new Date(where.reservationExpiresAt.lte)
          )
            continue;
          const { version, ...rest } = data;
          Object.assign(ord, rest);
          if (version?.increment) {
            ord.version = Number(ord.version || 1) + Number(version.increment);
          }
          count++;
        }
        return { count };
      },
    },
    storefrontOrderItem: {
      findFirst: async () => state.orderItems[0] || null,
    },
    storefrontOrderEvent: {
      findFirst: async () => state.orderEvents[0] || null,
      create: async ({ data }: any) => {
        const ev = {
          id: `ev-${state.orderEvents.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        state.orderEvents.push(ev);
        return ev;
      },
    },
    customer: {
      findUnique: async ({ where }: any) =>
        state.customers.find(
          (c) =>
            (where.id && c.id === where.id) ||
            (where.phone && c.phone === where.phone),
        ) || null,
      create: async ({ data }: any) => {
        const c = {
          id: `cust-${state.customers.length + 1}`,
          ...data,
          storeCreditBalance: 0,
        };
        state.customers.push(c);
        return c;
      },
      update: async ({ where, data }: any) => {
        const c = state.customers.find((x) => x.id === where.id);
        if (c && data.storeCreditBalance?.increment) {
          c.storeCreditBalance += Number(data.storeCreditBalance.increment);
        }
        return c;
      },
    },
    cashRegister: {
      findFirst: async ({ where }: any) => {
        return (
          state.cashRegisters.find((cr) => {
            if (where?.status && cr.status !== where.status) return false;
            return true;
          }) || null
        );
      },
      findUnique: async ({ where }: any) =>
        state.cashRegisters.find((cr) => cr.id === where.id) || null,
      update: async ({ where, data }: any) => {
        const cr = state.cashRegisters.find((x) => x.id === where.id);
        if (cr && data.expectedCash?.increment) {
          cr.expectedCash =
            Number(cr.expectedCash || 0) + Number(data.expectedCash.increment);
        }
        return cr;
      },
    },
    stockLot: {
      findMany: async ({ where }: any) =>
        state.stockLots.filter(
          (l) => l.productId === where.productId && Number(l.remaining) > 0,
        ),
      update: async ({ where, data }: any) => {
        const lot = state.stockLots.find((l) => l.id === where.id);
        if (lot && data.remaining?.decrement !== undefined) {
          lot.remaining =
            Number(lot.remaining) - Number(String(data.remaining.decrement));
        } else if (lot && data.remaining?.increment !== undefined) {
          lot.remaining =
            Number(lot.remaining) + Number(String(data.remaining.increment));
        }
        return lot;
      },
      create: async ({ data }: any) => {
        const lot = {
          id: `lot-${state.stockLots.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        state.stockLots.push(lot);
        return lot;
      },
    },
    inventoryLog: {
      create: async ({ data }: any) => {
        const log = {
          id: `ilog-${state.inventoryLogs.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        state.inventoryLogs.push(log);
        return log;
      },
      createMany: async ({ data }: any) => {
        for (const item of data || []) {
          state.inventoryLogs.push({
            id: `ilog-${state.inventoryLogs.length + 1}`,
            ...item,
            createdAt: new Date(),
          });
        }
        return { count: (data || []).length };
      },
    },
    saleItem: {
      create: async ({ data }: any) => {
        const lotConsumptions = (data.lotConsumptions?.create || []).map(
          (lc: any) => ({
            ...lc,
            lot: state.stockLots.find((l) => l.id === lc.lotId) || {
              id: lc.lotId,
              productId: data.productId,
              costPrice: 32.5,
            },
          }),
        );
        const row = {
          id: `si-${state.saleItems.length + 1}`,
          ...data,
          lotConsumptions,
          retailReturnItems: [],
        };
        state.saleItems.push(row);
        return row;
      },
    },
    sale: {
      findFirst: async () =>
        state.sales.length
          ? [...state.sales].sort((a, b) => b.code - a.code)[0]
          : null,
      findUnique: async ({ where }: any) => {
        const s = state.sales.find((x) => x.id === where.id);
        if (!s) return null;
        return {
          ...s,
          items: state.saleItems
            .filter((si) => si.saleId === s.id)
            .map((si) => ({
              ...si,
              product: state.products.find((p) => p.id === si.productId) || null,
            })),
          payments: state.payments.filter((p) => p.saleId === s.id),
          returns: state.returns.filter((r) => r.originalSaleId === s.id),
        };
      },
      create: async ({ data }: any) => {
        if (state.sales.some((s) => s.id === data.id)) {
          const err: any = new Error('Unique constraint');
          err.code = 'P2002';
          err.meta = { target: 'PRIMARY' };
          throw err;
        }
        const createdSale = {
          id: data.id,
          code: data.code,
          requestFingerprint: data.requestFingerprint,
          operatorId: data.operatorId,
          cashRegisterId: data.cashRegisterId,
          customerId: data.customerId,
          customerName: data.customerName,
          customerCpf: data.customerCpf,
          total: Number(data.total),
          discount: Number(data.discount || 0),
          status: data.status,
          source: data.source,
          movimentarEstoque: data.movimentarEstoque,
          nfceStatus: data.nfceStatus,
          createdAt: new Date(),
        };
        state.sales.push(createdSale);

        const createdItems: any[] = [];
        for (const it of data.items?.create || []) {
          const row = {
            id: `si-${state.saleItems.length + 1}`,
            saleId: createdSale.id,
            ...it,
          };
          state.saleItems.push(row);
          createdItems.push(row);
        }
        const createdPayments: any[] = [];
        for (const pay of data.payments?.create || []) {
          const row = {
            id: `pay-${state.payments.length + 1}`,
            saleId: createdSale.id,
            ...pay,
          };
          state.payments.push(row);
          createdPayments.push(row);
        }

        return {
          ...createdSale,
          items: createdItems,
          payments: createdPayments,
        };
      },
      update: async ({ where, data }: any) => {
        const s = state.sales.find((x) => x.id === where.id);
        if (s) Object.assign(s, data);
        return s;
      },
    },
    saleDeliveryJob: {
      create: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    retailReturn: {
      count: async ({ where }: any) =>
        state.returns.filter((r) => r.saleId === where?.saleId).length,
      findFirst: async () => null,
      findUnique: async () => null,
      create: async ({ data }: any) => {
        const ret = {
          id: `ret-${state.returns.length + 1}`,
          ...data,
          items: data.items?.create || [],
          createdAt: new Date(),
        };
        state.returns.push(ret);
        return ret;
      },
    },
    storeCreditLedger: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  state.client = client;
  return state;
}

describe('Módulo Loja Virtual (Storefront) - Isolamento, Reservas, Idempotência e Conversão em Venda', () => {
  function createTestHarness() {
    const storeA = createInMemoryTenantDb('tenant-a', 'loja-alfa', 'Loja Alfa');
    const storeB = createInMemoryTenantDb('tenant-b', 'loja-beta', 'Loja Beta');

    const heartTenants: Record<string, any> = {
      'tenant-a': {
        id: 'tenant-a',
        name: 'Loja Alfa LTDA',
        nomeFantasia: 'Loja Alfa',
        databaseUrl: 'postgresql://local/tenant_a',
        status: 'active',
        modulos: { lojaVirtual: true, nfce: false },
      },
      'tenant-b': {
        id: 'tenant-b',
        name: 'Loja Beta LTDA',
        nomeFantasia: 'Loja Beta',
        databaseUrl: 'postgresql://local/tenant_b',
        status: 'active',
        modulos: { lojaVirtual: true, nfce: false },
      },
    };

    const registries: Record<string, any> = {
      'loja-alfa': {
        id: 'reg-a',
        publicId: 'pub-tenant-a',
        tenantId: 'tenant-a',
        slug: 'loja-alfa',
        storeName: 'Loja Alfa',
        enabled: true,
        published: true,
        publishedVersion: 1,
      },
      'loja-beta': {
        id: 'reg-b',
        publicId: 'pub-tenant-b',
        tenantId: 'tenant-b',
        slug: 'loja-beta',
        storeName: 'Loja Beta',
        enabled: true,
        published: true,
        publishedVersion: 1,
      },
    };

    const heartPrisma: any = {
      tenant: {
        findUnique: jest.fn(async ({ where }: any) => {
          return heartTenants[where.id] || null;
        }),
      },
      storefrontRegistry: {
        findFirst: jest.fn(async () => Object.values(registries)[0] || null),
        findUnique: jest.fn(async ({ where }: any) => {
          const reg = where.slug
            ? registries[where.slug]
            : Object.values(registries).find(
                (r: any) => r.tenantId === where.tenantId,
              );
          if (!reg) return null;
          return {
            ...reg,
            tenant: heartTenants[reg.tenantId] || null,
          };
        }),
        findMany: jest.fn(async () =>
          Object.values(registries).map((r: any) => ({
            ...r,
            tenant: heartTenants[r.tenantId],
          })),
        ),
        upsert: jest.fn(async ({ where, update, create }: any) => {
          const existing = Object.values(registries).find(
            (r: any) => r.tenantId === where.tenantId,
          );
          if (existing) {
            if (existing.slug !== update.slug) {
              delete registries[existing.slug];
            }
            Object.assign(existing, update);
            registries[existing.slug] = existing;
            return existing;
          }
          registries[create.slug] = { ...create };
          return registries[create.slug];
        }),
      },
    };

    const tenantContext = new TenantContextService();
    const tenantManager: any = {
      getTenantClient: jest.fn(async (tenantId: string) => {
        if (tenantId === 'tenant-a') return storeA.client;
        if (tenantId === 'tenant-b') return storeB.client;
        throw new Error(`Unknown tenant ${tenantId}`);
      }),
    };

    const productsService: any = {
      invalidateCache: jest.fn(),
    };
    const fiscalService: any = {};
    const integrationsService: any = {};
    const salesDeliveryService: any = {
      enqueueAndProcess: jest.fn().mockResolvedValue(undefined),
    };

    const salesService = new SalesService(
      tenantManager,
      heartPrisma,
      fiscalService,
      tenantContext,
      productsService,
      integrationsService,
      salesDeliveryService,
    );

    const returnsService = new RetailReturnsService(
      tenantManager,
      tenantContext,
      productsService,
    );

    const adminService = new StorefrontAdminService(
      heartPrisma,
      tenantManager,
      tenantContext,
    );

    const publicService = new StorefrontPublicService(
      heartPrisma,
      tenantManager,
      tenantContext,
    );

    const ordersService = new StorefrontOrdersService(
      heartPrisma,
      tenantManager,
      tenantContext,
      publicService,
      adminService,
      salesService,
    );

    return {
      storeA,
      storeB,
      heartTenants,
      registries,
      tenantContext,
      tenantManager,
      adminService,
      publicService,
      ordersService,
      salesService,
      returnsService,
    };
  }

  it('1 & 2 & 3. Isola duas lojas independentes, permite acesso público sem JWT e garante que admin logado na Loja A visitando a vitrine da Loja B resolva a Loja B', async () => {
    const h = createTestHarness();

    // Acesso público sem contexto administrativo prévio
    const pubA = await h.publicService.getStorefrontHome('loja-alfa');
    const pubB = await h.publicService.getStorefrontHome('loja-beta');
    expect(pubA.storeName).toBe('Loja Alfa');
    expect(pubB.storeName).toBe('Loja Beta');

    // Admin autenticado na Loja A visitando a vitrine pública da Loja B
    await h.tenantContext.run(
      {
        tenantId: 'tenant-a',
        databaseUrl: 'postgresql://local/tenant_a',
        userId: 'admin-a',
        role: 'admin',
      },
      async () => {
        const resolvedDuringAdminSession =
          await h.publicService.getStorefrontHome('loja-beta');
        expect(resolvedDuringAdminSession.slug).toBe('loja-beta');
        expect(resolvedDuringAdminSession.storeName).toBe('Loja Beta');

        // Criar pedido na Loja B enquanto o contexto externo é da Loja A
        const orderOnB = await h.ordersService.createPublicOrder('loja-beta', {
          idempotencyKey: 'key-isolated-b-1',
          customerName: 'Maria Visitante',
          customerPhone: '11988887777',
          fulfillmentMode: 'PICKUP',
          items: [
            {
              productId: 'prod-m-tenant-b',
              quantity: 1,
              expectedPriceUnit: 79.9,
            },
          ],
        });

        expect(orderOnB.reference).toBe('PED-000001');
        expect(h.storeB.orders).toHaveLength(1);
        expect(h.storeA.orders).toHaveLength(0);

        // O contexto administrativo externo da Loja A permanece intacto após a chamada pública
        expect(h.tenantContext.get().tenantId).toBe('tenant-a');
      },
    );
  });

  it('4 & 5. Alteração em rascunho não vaza para a vitrine pública antes de publicar, e loja despublicada/suspensa/desativada recusa novos pedidos', async () => {
    const h = createTestHarness();

    await h.tenantContext.run(
      {
        tenantId: 'tenant-a',
        databaseUrl: 'postgresql://local/tenant_a',
        userId: 'admin-a',
        role: 'admin',
      },
      async () => {
        await h.adminService.saveAppearanceDraft({
          storeName: 'Loja Alfa',
          theme: {
            template: 'vitrine_escura',
            heroTitle: 'Rascunho Secreto de Natal',
          },
        });

        // Antes de publicar, vitrine pública mantém o título publicado anterior
        const beforePublish =
          await h.publicService.getStorefrontHome('loja-alfa');
        expect(beforePublish.theme.heroTitle).toBe('Bem-vindo à Loja Alfa');

        // Publicar aplica o rascunho e cria nova revisão
        await h.adminService.publishStorefront({
          userId: 'admin-a',
          name: 'Admin Alfa',
        });
        const afterPublish =
          await h.publicService.getStorefrontHome('loja-alfa');
        expect(afterPublish.theme.heroTitle).toBe('Rascunho Secreto de Natal');
        expect(afterPublish.publishedVersion).toBe(2);

        // Despublicar bloqueia vitrine e criação de novos pedidos
        await h.adminService.unpublishStorefront();
      },
    );

    await expect(
      h.publicService.getStorefrontHome('loja-alfa'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      h.ordersService.createPublicOrder('loja-alfa', {
        idempotencyKey: 'key-unpub-1',
        customerName: 'Cliente',
        customerPhone: '11977776666',
        fulfillmentMode: 'PICKUP',
        items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Se re-publicar mas suspender o tenant no Heart, também recusa
    h.registries['loja-alfa'].published = true;
    h.storeA.settings.isPublished = true;
    h.heartTenants['tenant-a'].status = 'suspended';

    await expect(
      h.ordersService.createPublicOrder('loja-alfa', {
        idempotencyKey: 'key-susp-1',
        customerName: 'Cliente',
        customerPhone: '11977776666',
        fulfillmentMode: 'PICKUP',
        items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('6, 7, 14 & 19. Oculta produtos não publicados, rejeita preço adulterado (409 PRICE_DIVERGENCE), impede reserva acima do saldo e nunca expõe dados sensíveis ou pedidos sem token', async () => {
    const h = createTestHarness();

    // Catálogo público só lista produtos visíveis e não contém priceCost
    const catalog = await h.publicService.listProducts('loja-alfa', {});
    expect(catalog.data).toHaveLength(1);
    expect(catalog.data[0].slug).toBe('camiseta-basica-tenant-a');
    expect((catalog.data[0] as any).priceCost).toBeUndefined();
    expect((catalog.data[0].variants[0] as any).priceCost).toBeUndefined();

    // Produto oculto não pode ser comprado mesmo enviando o ID diretamente
    await expect(
      h.ordersService.createPublicOrder('loja-alfa', {
        idempotencyKey: 'key-hidden-prod',
        customerName: 'João',
        customerPhone: '11966665555',
        fulfillmentMode: 'PICKUP',
        items: [{ productId: 'prod-hid-tenant-a', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Preço adulterado no navegador é rejeitado com 409 PRICE_DIVERGENCE
    await expect(
      h.ordersService.createPublicOrder('loja-alfa', {
        idempotencyKey: 'key-tampered-price',
        customerName: 'João',
        customerPhone: '11966665555',
        fulfillmentMode: 'PICKUP',
        items: [
          {
            productId: 'prod-m-tenant-a',
            quantity: 1,
            expectedPriceUnit: 1.99,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PRICE_DIVERGENCE',
      }),
    });

    // Quantidade acima do saldo disponível (saldo = 2, solicitado = 3)
    await expect(
      h.ordersService.createPublicOrder('loja-alfa', {
        idempotencyKey: 'key-over-stock',
        customerName: 'João',
        customerPhone: '11966665555',
        fulfillmentMode: 'PICKUP',
        items: [{ productId: 'prod-m-tenant-a', quantity: 3 }],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INSUFFICIENT_STOCK',
      }),
    });

    // Criação de pedido válido (mesmo com caixa fechado!) e proteção por token de consulta
    const created = await h.ordersService.createPublicOrder('loja-alfa', {
      idempotencyKey: 'key-valid-token-test',
      customerName: 'João Silva',
      customerPhone: '11966665555',
      fulfillmentMode: 'PICKUP',
      items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
    });

    await expect(
      h.ordersService.getPublicOrderByReference(
        'loja-alfa',
        created.reference,
        'token-invalido-de-terceiro',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const fetchedWithValidToken =
      await h.ordersService.getPublicOrderByReference(
        'loja-alfa',
        created.reference,
        created.accessToken,
      );
    expect(fetchedWithValidToken.reference).toBe(created.reference);
  });

  it('8, 9, 11, 12 & 13. Reserva protege última unidade contra PDV, expiração devolve disponibilidade de forma idempotente, e idempotencyKey protege contra duplicação ou timeout', async () => {
    const h = createTestHarness();
    // Deixar apenas 1 unidade física de estoque
    h.storeA.products[0].stock = 1;
    h.storeA.stockLots[0].remaining = 1;

    const orderPayload = {
      idempotencyKey: 'idem-order-last-unit',
      customerName: 'Carla',
      customerPhone: '11955554444',
      fulfillmentMode: 'PICKUP' as const,
      items: [
        {
          productId: 'prod-m-tenant-a',
          quantity: 1,
          expectedPriceUnit: 79.9,
        },
      ],
    };

    const firstCall = await h.ordersService.createPublicOrder(
      'loja-alfa',
      orderPayload,
    );
    expect(firstCall.replayed).toBe(false);
    expect(h.storeA.products[0].stock).toBe(1); // Reserva NÃO subtrai Product.stock físico prematuramente

    // Replay idêntico (ex.: recuperação de queda de rede / timeout após commit)
    const replayCall = await h.ordersService.createPublicOrder(
      'loja-alfa',
      orderPayload,
    );
    expect(replayCall.replayed).toBe(true);
    expect(replayCall.reference).toBe(firstCall.reference);
    expect(replayCall.accessToken).toBe(firstCall.accessToken);
    expect(h.storeA.orders).toHaveLength(1);
    expect(h.storeA.reservations).toHaveLength(1);

    // Mesma idempotencyKey com payload diferente -> 409 IDEMPOTENCY_CONFLICT
    await expect(
      h.ordersService.createPublicOrder('loja-alfa', {
        ...orderPayload,
        items: [{ productId: 'prod-m-tenant-a', quantity: 2 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Segundo cliente tentando reservar a mesma última unidade enquanto a reserva está ativa -> 409 INSUFFICIENT_STOCK
    await expect(
      h.ordersService.createPublicOrder('loja-alfa', {
        idempotencyKey: 'second-customer-last-unit',
        customerName: 'Marcos',
        customerPhone: '11944443333',
        fulfillmentMode: 'PICKUP',
        items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Venda avulsa no PDV tentando vender a última unidade reservada na Loja Virtual -> bloqueada!
    h.storeA.cashRegisters.push({
      id: 'cr-1',
      status: 'open',
      expectedCash: 0,
    });
    await h.tenantContext.run(
      {
        tenantId: 'tenant-a',
        databaseUrl: 'postgresql://local/tenant_a',
        userId: 'op-1',
        role: 'admin',
      },
      async () => {
        await expect(
          h.salesService.checkout({
            idempotencyKey: 'pos-sale-blocked-by-reservation',
            operatorId: 'op-1',
            items: [
              {
                productId: 'prod-m-tenant-a',
                quantity: 1,
                priceUnit: 79.9,
              },
            ],
            payments: [{ method: 'pix', value: 79.9 }],
          }),
        ).rejects.toThrow(/Estoque reservado na Loja Virtual/);
      },
    );

    // Simular passagem do tempo além de reservationExpiresAt (funciona mesmo após reinício sem memória volátil)
    const futureNow = new Date(Date.now() + 60 * 60_000);
    const expiredFirstRun =
      await h.ordersService.expireOverdueReservationsForTenant(
        h.storeA.client,
        futureNow,
      );
    const expiredSecondReplicaRun =
      await h.ordersService.expireOverdueReservationsForTenant(
        h.storeA.client,
        futureNow,
      );
    expect(expiredFirstRun).toBe(1);
    expect(expiredSecondReplicaRun).toBe(0); // Idempotente em múltiplas réplicas!
    expect(h.storeA.orders[0].commercialStatus).toBe('EXPIRED');
    expect(h.storeA.reservations[0].status).toBe('EXPIRED');
    expect(h.storeA.products[0].stock).toBe(1); // Product.stock continua 1 intacto!
  });

  it('15, 16, 17 & 18. Converte pedido em venda com caixa aberto (baixa única de estoque), cancela pedido não convertido sem mexer no estoque físico e estorna apenas uma vez ao cancelar ou devolver venda convertida', async () => {
    const h = createTestHarness();
    // Saldo inicial = 2 unidades
    expect(h.storeA.products[0].stock).toBe(2);

    // Criar Pedido 1 (1 unidade) e cancelar antes de converter em venda
    await h.ordersService.createPublicOrder('loja-alfa', {
      idempotencyKey: 'ord-cancel-before-sale',
      customerName: 'Cliente 1',
      customerPhone: '11911112222',
      fulfillmentMode: 'PICKUP',
      items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
    });
    const order1Id = h.storeA.orders[0].id;

    await h.tenantContext.run(
      {
        tenantId: 'tenant-a',
        databaseUrl: 'postgresql://local/tenant_a',
        userId: 'admin-a',
        role: 'admin',
      },
      async () => {
        const cancelled = await h.ordersService.rejectOrCancelOrder(
          order1Id,
          'CANCELLED',
          { reason: 'Desistiu' },
          { userId: 'admin-a', name: 'Admin' },
        );
        expect(cancelled.commercialStatus).toBe('CANCELLED');
        expect(cancelled.reservationStatus).toBe('RELEASED');
        expect(h.storeA.products[0].stock).toBe(2); // Não mexeu no Product.stock!
      },
    );

    // Criar Pedido 2 (1 unidade) para converter em venda
    await h.ordersService.createPublicOrder('loja-alfa', {
      idempotencyKey: 'ord-convert-to-sale',
      customerName: 'Cliente 2',
      customerPhone: '11933334444',
      fulfillmentMode: 'PICKUP',
      items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
    });
    const order2Id = h.storeA.orders[1].id;

    await h.tenantContext.run(
      {
        tenantId: 'tenant-a',
        databaseUrl: 'postgresql://local/tenant_a',
        userId: 'admin-a',
        role: 'admin',
      },
      async () => {
        // Sem caixa aberto -> conversão falha de forma limpa sem consumir a reserva
        await expect(
          h.ordersService.convertOrderToSale(
            order2Id,
            {
              payments: [{ method: 'pix', value: 79.9 }],
            },
            { userId: 'admin-a', name: 'Admin' },
          ),
        ).rejects.toThrow(/caixa aberto/);
        expect(h.storeA.products[0].stock).toBe(2);
        expect(h.storeA.reservations[1].status).toBe('ACTIVE');

        // Abrir caixa e converter pedido em venda
        h.storeA.cashRegisters.push({
          id: 'cr-open-1',
          status: 'open',
          expectedCash: 100,
        });

        const converted = await h.ordersService.convertOrderToSale(
          order2Id,
          {
            idempotencyKey: 'conv-sale-order-2',
            payments: [{ method: 'pix', value: 79.9 }],
          },
          { userId: 'admin-a', name: 'Admin' },
        );

        expect(converted.sale.source).toBe('loja_virtual');
        expect(converted.order.commercialStatus).toBe('COMPLETED');
        expect(converted.order.reservationStatus).toBe('CONSUMED');
        expect(converted.order.paymentStatus).toBe('REGISTERED_IN_SALE');
        expect(converted.order.saleId).toBe(converted.sale.id);
        // Estoque baixado exatamente UMA vez (2 -> 1)
        expect(h.storeA.products[0].stock).toBe(1);
        expect(h.storeA.stockLots[0].remaining).toBe(1);

        // Repetir conversão é idempotente e não baixa estoque novamente
        const convertedReplay = await h.ordersService.convertOrderToSale(
          order2Id,
          {
            idempotencyKey: 'conv-sale-order-2',
            payments: [{ method: 'pix', value: 79.9 }],
          },
          { userId: 'admin-a', name: 'Admin' },
        );
        expect(convertedReplay.sale.id).toBe(converted.sale.id);
        expect(h.storeA.products[0].stock).toBe(1);

        // Devolução/troca no PDV devolve ao estoque 1 única vez e registra evento no pedido da loja virtual
        await h.returnsService.create({
          requestKey: 'ret-key-order-2',
          saleId: converted.sale.id,
          customerId: converted.order.customerId,
          reason: 'Tamanho ficou pequeno',
          items: [
            {
              saleItemId: converted.sale.items[0].id,
              quantity: 1,
              restock: true,
            },
          ],
        });
        expect(h.storeA.products[0].stock).toBe(2);
        const orderAfterReturn = await h.ordersService.getAdminOrderById(
          order2Id,
        );
        expect(
          orderAfterReturn.events.some(
            (e: any) => e.eventType === 'SALE_RETURN_CREATED',
          ),
        ).toBe(true);

        // Cancelar venda convertida: vamos criar Pedido 3, converter e cancelar a venda
        await h.ordersService.createPublicOrder('loja-alfa', {
          idempotencyKey: 'ord-convert-then-cancel-sale',
          customerName: 'Cliente 3',
          customerPhone: '11922223333',
          fulfillmentMode: 'PICKUP',
          items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
        });
        const order3Id = h.storeA.orders[2].id;
        const conv3 = await h.ordersService.convertOrderToSale(
          order3Id,
          {
            idempotencyKey: 'conv-sale-order-3',
            payments: [{ method: 'dinheiro', value: 79.9 }],
          },
          { userId: 'admin-a', name: 'Admin' },
        );
        expect(h.storeA.products[0].stock).toBe(1);

        await h.salesService.cancel(conv3.sale.id, 'Estorno solicitado');
        // Estoque voltou de 1 para 2 (apenas 1 incremento!) e o pedido vinculado foi marcado como CANCELLED
        expect(h.storeA.products[0].stock).toBe(2);
        const order3AfterCancel = await h.ordersService.getAdminOrderById(
          order3Id,
        );
        expect(order3AfterCancel.commercialStatus).toBe('CANCELLED');
        expect(order3AfterCancel.paymentStatus).toBe('REFUNDED');
        expect(order3AfterCancel.reservationStatus).toBe('CONSUMED');
      },
    );
  });

  it('8, 9 & 10. Concorrência simultânea (Promise.all): 5 reservas disputando última unidade, corrida Reserva Online vs Checkout PDV e sweep multi-réplica', async () => {
    const h = createTestHarness();
    // 1 única unidade no estoque da Loja Alfa
    h.storeA.products[0].stock = 1;
    h.storeA.stockLots[0].remaining = 1;

    // 1) 5 clientes simultâneos tentando reservar a última unidade via Promise.all
    const raceResults = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((idx) =>
        h.ordersService.createPublicOrder('loja-alfa', {
          idempotencyKey: `concurrent-race-order-${idx}`,
          customerName: `Concorrente ${idx}`,
          customerPhone: `1199000000${idx}`,
          fulfillmentMode: 'PICKUP',
          items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
        }),
      ),
    );

    const fulfilled = raceResults.filter((r) => r.status === 'fulfilled');
    const rejected = raceResults.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(h.storeA.orders).toHaveLength(1);
    expect(
      h.storeA.reservations.filter((r) => r.status === 'ACTIVE'),
    ).toHaveLength(1);

    // 2) 3 réplicas executando expiração simultaneamente via Promise.all
    const futureNow = new Date(Date.now() + 2 * 3600_000);
    const sweepCounts = await Promise.all([
      h.ordersService.expireOverdueReservationsForTenant(
        h.storeA.client,
        futureNow,
      ),
      h.ordersService.expireOverdueReservationsForTenant(
        h.storeA.client,
        futureNow,
      ),
      h.ordersService.expireOverdueReservationsForTenant(
        h.storeA.client,
        futureNow,
      ),
    ]);
    const totalExpiredAcrossReplicas = sweepCounts.reduce((a, b) => a + b, 0);
    expect(totalExpiredAcrossReplicas).toBe(1);

    // 3) Agora que a reserva anterior expirou e a última unidade voltou a ficar disponível,
    // disputar simultaneamente: Venda no PDV vs Novo Pedido Online na Loja Virtual!
    h.storeA.cashRegisters.push({
      id: 'cr-race',
      status: 'open',
      expectedCash: 0,
    });

    const pdvVsOnlineResults = await Promise.allSettled([
      h.tenantContext.run(
        {
          tenantId: 'tenant-a',
          databaseUrl: 'postgresql://local/tenant_a',
          userId: 'op-1',
          role: 'admin',
        },
        () =>
          h.salesService.checkout({
            idempotencyKey: 'race-pdv-checkout-last-unit',
            operatorId: 'op-1',
            items: [
              {
                productId: 'prod-m-tenant-a',
                quantity: 1,
                priceUnit: 79.9,
              },
            ],
            payments: [{ method: 'pix', value: 79.9 }],
          }),
      ),
      h.ordersService.createPublicOrder('loja-alfa', {
        idempotencyKey: 'race-online-order-last-unit',
        customerName: 'Cliente Online Simultâneo',
        customerPhone: '11981112222',
        fulfillmentMode: 'PICKUP',
        items: [{ productId: 'prod-m-tenant-a', quantity: 1 }],
      }),
    ]);

    const winners = pdvVsOnlineResults.filter((r) => r.status === 'fulfilled');
    const losers = pdvVsOnlineResults.filter((r) => r.status === 'rejected');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });
});
