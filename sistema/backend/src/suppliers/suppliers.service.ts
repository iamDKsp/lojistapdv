import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { ProductsService } from '../products/products.service';
import { DEFAULT_SP_WHOLESALE_SUPPLIERS, SeedWholesaleSupplier } from './sp-wholesale.seed';

@Injectable()
export class SuppliersService {
  private seedingPromise: Promise<void> | null = null;

  constructor(
    private readonly tenantManager: TenantConnectionManager,
    private readonly tenantContext: TenantContextService,
    private readonly heartPrisma: HeartPrismaService,
    private readonly productsService: ProductsService,
  ) {}

  private async getPrisma() {
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.tenantManager.getTenantClient(tenantId, databaseUrl);
  }

  private normalizeHubSupplier(raw: any) {
    return {
      id: raw.id,
      name: raw.name,
      region: raw.region || 'BRAS',
      address: raw.address,
      galleryName: raw.galleryName ?? null,
      lat: Number(raw.lat ?? -23.5365),
      lng: Number(raw.lng ?? -46.6182),
      whatsapp: raw.whatsapp,
      coverImageUrl: raw.coverImageUrl ?? '/demo-catalogo/fotos/camiseta-preta.png',
      logoUrl: raw.logoUrl ?? raw.coverImageUrl ?? '/demo-catalogo/fotos/camiseta-preta.png',
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      minOrderValue: Number(raw.minOrderValue ?? 300),
      minOrderPieces: Number(raw.minOrderPieces ?? 6),
      verified: Boolean(raw.verified ?? true),
      guaranteedDelivery: Boolean(raw.guaranteedDelivery ?? true),
      shippingMethods:
        raw.shippingMethods ?? 'Ônibus de Excursão (Brás), Correios Sedex, Transportadora e Motoboy SP',
      description: raw.description ?? null,
      openingHours: raw.openingHours ?? 'Seg a Sáb · 05h30 às 16h00',
      active: Boolean(raw.active ?? true),
      featuredOrder: Number(raw.featuredOrder ?? 100),
      items: Array.isArray(raw.items)
        ? raw.items.map((item: any, idx: number) => ({
            id: item.id || `${raw.id}-item-${idx + 1}`,
            supplierId: item.supplierId || raw.id,
            name: item.name,
            category: item.category || 'Camisetas',
            imageUrl: item.imageUrl || '/demo-catalogo/fotos/camiseta-preta.png',
            wholesalePrice: Number(item.wholesalePrice ?? 0),
            suggestedRetailPrice: Number(item.suggestedRetailPrice ?? 0),
            sizesLabel: item.sizesLabel ?? 'P · M · G · GG',
            colorsLabel: item.colorsLabel ?? 'Cores sortidas',
            minPackQty: Number(item.minPackQty ?? 6),
            isPreviewSix: Boolean(item.isPreviewSix ?? idx < 6),
            sortOrder: Number(item.sortOrder ?? idx + 1),
            active: Boolean(item.active ?? true),
          }))
        : [],
    };
  }

  private async ensureDefaultSpHubSeeded(): Promise<void> {
    if (this.seedingPromise) {
      return this.seedingPromise;
    }

    this.seedingPromise = (async () => {
      try {
        const count = await this.heartPrisma.wholesaleSupplier.count();
        if (count > 0) return;

        for (const seed of DEFAULT_SP_WHOLESALE_SUPPLIERS) {
          await this.upsertSeedSupplier(seed);
        }
      } catch {
        // Fallback silencioso caso o banco central não esteja acessível em ambiente isolado
      } finally {
        this.seedingPromise = null;
      }
    })();

    return this.seedingPromise;
  }

  private async upsertSeedSupplier(seed: SeedWholesaleSupplier) {
    const existing = await this.heartPrisma.wholesaleSupplier.findUnique({
      where: { id: seed.id },
    });

    if (existing) {
      return existing;
    }

    return this.heartPrisma.wholesaleSupplier.create({
      data: {
        id: seed.id,
        name: seed.name,
        region: seed.region,
        address: seed.address,
        galleryName: seed.galleryName ?? null,
        lat: seed.lat,
        lng: seed.lng,
        whatsapp: seed.whatsapp,
        coverImageUrl: seed.coverImageUrl,
        logoUrl: seed.logoUrl,
        categories: seed.categories,
        minOrderValue: seed.minOrderValue,
        minOrderPieces: seed.minOrderPieces,
        verified: seed.verified,
        guaranteedDelivery: seed.guaranteedDelivery,
        shippingMethods: seed.shippingMethods,
        description: seed.description,
        openingHours: seed.openingHours,
        active: true,
        featuredOrder: seed.featuredOrder,
        items: {
          create: seed.items.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            imageUrl: item.imageUrl,
            wholesalePrice: item.wholesalePrice,
            suggestedRetailPrice: item.suggestedRetailPrice,
            sizesLabel: item.sizesLabel,
            colorsLabel: item.colorsLabel,
            minPackQty: item.minPackQty,
            isPreviewSix: item.isPreviewSix,
            sortOrder: item.sortOrder,
            active: true,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async ensureAndGetSpWholesaleHub(includeInactive = false) {
    await this.ensureDefaultSpHubSeeded();

    try {
      const suppliers = await this.heartPrisma.wholesaleSupplier.findMany({
        where: includeInactive ? {} : { active: true },
        include: {
          items: {
            where: includeInactive ? {} : { active: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ featuredOrder: 'asc' }, { createdAt: 'asc' }],
      });

      if (suppliers.length > 0) {
        return suppliers.map((s) => this.normalizeHubSupplier(s));
      }
    } catch {
      // Fallback em memória caso o banco central esteja offline
    }

    return DEFAULT_SP_WHOLESALE_SUPPLIERS.map((s) =>
      this.normalizeHubSupplier({
        ...s,
        active: true,
      }),
    );
  }

  async resetSpHubDefaults() {
    for (const seed of DEFAULT_SP_WHOLESALE_SUPPLIERS) {
      await this.upsertSeedSupplier(seed);
    }
    return this.ensureAndGetSpWholesaleHub(true);
  }

  async createSpHubSupplier(data: any) {
    if (!data?.name || !data?.whatsapp || !data?.address) {
      throw new BadRequestException('Nome da loja, endereço e WhatsApp são obrigatórios.');
    }

    const rawItems = Array.isArray(data.items) ? data.items : [];
    const created = await this.heartPrisma.wholesaleSupplier.create({
      data: {
        name: String(data.name).trim(),
        region: String(data.region || 'BRAS').trim(),
        address: String(data.address).trim(),
        galleryName: data.galleryName ? String(data.galleryName).trim() : null,
        lat: Number(data.lat ?? -23.5365),
        lng: Number(data.lng ?? -46.6182),
        whatsapp: String(data.whatsapp).replace(/\D/g, ''),
        coverImageUrl: String(data.coverImageUrl || '/demo-catalogo/fotos/camiseta-preta.png').trim(),
        logoUrl: String(data.logoUrl || data.coverImageUrl || '/demo-catalogo/fotos/camiseta-preta.png').trim(),
        categories: Array.isArray(data.categories)
          ? data.categories.map((c: any) => String(c).trim()).filter(Boolean)
          : ['Camisetas'],
        minOrderValue: Number(data.minOrderValue ?? 300),
        minOrderPieces: Number(data.minOrderPieces ?? 6),
        verified: data.verified !== undefined ? Boolean(data.verified) : true,
        guaranteedDelivery: data.guaranteedDelivery !== undefined ? Boolean(data.guaranteedDelivery) : true,
        shippingMethods: String(
          data.shippingMethods || 'Ônibus de Excursão (Brás), Correios Sedex, Transportadora e Motoboy SP',
        ),
        description: data.description ? String(data.description).trim() : null,
        openingHours: String(data.openingHours || 'Seg a Sáb · 05h30 às 16h00'),
        active: data.active !== undefined ? Boolean(data.active) : true,
        featuredOrder: Number(data.featuredOrder ?? 50),
        items: {
          create: rawItems.map((item: any, idx: number) => ({
            name: String(item.name || `Peça Atacado #${idx + 1}`).trim(),
            category: String(item.category || 'Camisetas').trim(),
            imageUrl: String(item.imageUrl || '/demo-catalogo/fotos/camiseta-preta.png').trim(),
            wholesalePrice: Number(item.wholesalePrice ?? 29.9),
            suggestedRetailPrice: Number(item.suggestedRetailPrice ?? Number(item.wholesalePrice ?? 29.9) * 2.2),
            sizesLabel: String(item.sizesLabel || 'P · M · G · GG'),
            colorsLabel: String(item.colorsLabel || 'Cores sortidas'),
            minPackQty: Number(item.minPackQty ?? 6),
            isPreviewSix: item.isPreviewSix !== undefined ? Boolean(item.isPreviewSix) : idx < 6,
            sortOrder: Number(item.sortOrder ?? idx + 1),
            active: item.active !== undefined ? Boolean(item.active) : true,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return this.normalizeHubSupplier(created);
  }

  async updateSpHubSupplier(id: string, data: any) {
    const existing = await this.heartPrisma.wholesaleSupplier.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Fornecedor do Hub Atacado SP não encontrado.');
    }

    const updatePayload: any = {};
    if (data.name !== undefined) updatePayload.name = String(data.name).trim();
    if (data.region !== undefined) updatePayload.region = String(data.region).trim();
    if (data.address !== undefined) updatePayload.address = String(data.address).trim();
    if (data.galleryName !== undefined) updatePayload.galleryName = data.galleryName ? String(data.galleryName).trim() : null;
    if (data.lat !== undefined) updatePayload.lat = Number(data.lat);
    if (data.lng !== undefined) updatePayload.lng = Number(data.lng);
    if (data.whatsapp !== undefined) updatePayload.whatsapp = String(data.whatsapp).replace(/\D/g, '');
    if (data.coverImageUrl !== undefined) updatePayload.coverImageUrl = String(data.coverImageUrl).trim();
    if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl ? String(data.logoUrl).trim() : null;
    if (Array.isArray(data.categories)) {
      updatePayload.categories = data.categories.map((c: any) => String(c).trim()).filter(Boolean);
    }
    if (data.minOrderValue !== undefined) updatePayload.minOrderValue = Number(data.minOrderValue);
    if (data.minOrderPieces !== undefined) updatePayload.minOrderPieces = Number(data.minOrderPieces);
    if (data.verified !== undefined) updatePayload.verified = Boolean(data.verified);
    if (data.guaranteedDelivery !== undefined) updatePayload.guaranteedDelivery = Boolean(data.guaranteedDelivery);
    if (data.shippingMethods !== undefined) updatePayload.shippingMethods = String(data.shippingMethods);
    if (data.description !== undefined) updatePayload.description = data.description ? String(data.description).trim() : null;
    if (data.openingHours !== undefined) updatePayload.openingHours = String(data.openingHours);
    if (data.active !== undefined) updatePayload.active = Boolean(data.active);
    if (data.featuredOrder !== undefined) updatePayload.featuredOrder = Number(data.featuredOrder);

    const updated = await this.heartPrisma.$transaction(async (tx) => {
      if (Array.isArray(data.items)) {
        await tx.wholesaleSupplierItem.deleteMany({
          where: { supplierId: id },
        });

        if (data.items.length > 0) {
          await tx.wholesaleSupplierItem.createMany({
            data: data.items.map((item: any, idx: number) => ({
              supplierId: id,
              name: String(item.name || `Peça Atacado #${idx + 1}`).trim(),
              category: String(item.category || 'Camisetas').trim(),
              imageUrl: String(item.imageUrl || '/demo-catalogo/fotos/camiseta-preta.png').trim(),
              wholesalePrice: Number(item.wholesalePrice ?? 29.9),
              suggestedRetailPrice: Number(item.suggestedRetailPrice ?? Number(item.wholesalePrice ?? 29.9) * 2.2),
              sizesLabel: String(item.sizesLabel || 'P · M · G · GG'),
              colorsLabel: String(item.colorsLabel || 'Cores sortidas'),
              minPackQty: Number(item.minPackQty ?? 6),
              isPreviewSix: item.isPreviewSix !== undefined ? Boolean(item.isPreviewSix) : idx < 6,
              sortOrder: Number(item.sortOrder ?? idx + 1),
              active: item.active !== undefined ? Boolean(item.active) : true,
            })),
          });
        }
      }

      return tx.wholesaleSupplier.update({
        where: { id },
        data: updatePayload,
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });

    return this.normalizeHubSupplier(updated);
  }

  async deleteSpHubSupplier(id: string) {
    const existing = await this.heartPrisma.wholesaleSupplier.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Fornecedor do Hub Atacado SP não encontrado.');
    }

    await this.heartPrisma.wholesaleSupplier.delete({
      where: { id },
    });

    return { deleted: true, id };
  }

  async importSpHubSupplierToTenant(hubSupplierId: string) {
    const hubList = await this.ensureAndGetSpWholesaleHub(true);
    const hubSupplier = hubList.find((s) => s.id === hubSupplierId);
    if (!hubSupplier) {
      throw new NotFoundException('Fornecedor do Hub Atacado SP não encontrado.');
    }

    const prisma = await this.getPrisma();
    const existingLocal = await prisma.supplier.findFirst({
      where: {
        name: hubSupplier.name,
      },
    });

    const neighborhoodLabel =
      hubSupplier.region === 'VINTE_CINCO_MARCO'
        ? '25 de Março / Centro'
        : hubSupplier.region === 'BOM_RETIRO'
          ? 'Bom Retiro'
          : hubSupplier.region === 'FEIRINHA_MADRUGADA'
            ? 'Feirinha da Madrugada / Brás'
            : 'Brás';

    if (existingLocal) {
      const updated = await prisma.supplier.update({
        where: { id: existingLocal.id },
        data: {
          whatsapp: hubSupplier.whatsapp,
          logradouro: hubSupplier.address,
          numero: hubSupplier.galleryName || existingLocal.numero || 'S/N',
          bairro: neighborhoodLabel,
          municipio: 'São Paulo',
          uf: 'SP',
        },
      });
      return {
        imported: true,
        alreadyExisted: true,
        supplier: updated,
      };
    }

    const created = await prisma.supplier.create({
      data: {
        name: hubSupplier.name,
        whatsapp: hubSupplier.whatsapp,
        logradouro: hubSupplier.address,
        numero: hubSupplier.galleryName || 'S/N',
        bairro: neighborhoodLabel,
        municipio: 'São Paulo',
        uf: 'SP',
      },
    });

    return {
      imported: true,
      alreadyExisted: false,
      supplier: created,
    };
  }

  async createSpHubOrderRequest(
    hubSupplierId: string,
    body: {
      items: Array<{ itemId: string; quantity: number }>;
      deliveryMode?: 'GUARANTEED_DELIVERY' | 'EXCURSION_BUS' | 'PICKUP_STORE';
      notes?: string;
    },
  ) {
    const hubList = await this.ensureAndGetSpWholesaleHub(true);
    const hubSupplier = hubList.find((s) => s.id === hubSupplierId);
    if (!hubSupplier) {
      throw new NotFoundException('Fornecedor do Hub Atacado SP não encontrado.');
    }

    const requestedItems = Array.isArray(body?.items)
      ? body.items.filter((i) => Number(i.quantity) > 0)
      : [];

    if (requestedItems.length === 0) {
      throw new BadRequestException('Selecione ao menos 1 peça/grade do catálogo para gerar a solicitação de pedido.');
    }

    const detailedLines = requestedItems.map((reqItem) => {
      const catalogItem = hubSupplier.items.find((it: any) => it.id === reqItem.itemId);
      if (!catalogItem) {
        throw new BadRequestException(`Item de catálogo não encontrado (${reqItem.itemId}).`);
      }
      const qty = Math.max(Number(reqItem.quantity) || catalogItem.minPackQty, catalogItem.minPackQty);
      const lineWholesaleTotal = Number((qty * catalogItem.wholesalePrice).toFixed(2));
      const lineSuggestedRevenue = catalogItem.suggestedRetailPrice
        ? Number((qty * catalogItem.suggestedRetailPrice).toFixed(2))
        : Number((qty * catalogItem.wholesalePrice * 2.2).toFixed(2));

      return {
        itemId: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        quantity: qty,
        wholesalePrice: catalogItem.wholesalePrice,
        suggestedRetailPrice: catalogItem.suggestedRetailPrice,
        minPackQty: catalogItem.minPackQty,
        sizesLabel: catalogItem.sizesLabel,
        lineWholesaleTotal,
        lineSuggestedRevenue,
      };
    });

    const totalWholesale = Number(
      detailedLines.reduce((acc, line) => acc + line.lineWholesaleTotal, 0).toFixed(2),
    );
    const totalSuggestedRevenue = Number(
      detailedLines.reduce((acc, line) => acc + line.lineSuggestedRevenue, 0).toFixed(2),
    );
    const estimatedProfit = Number((totalSuggestedRevenue - totalWholesale).toFixed(2));

    const { supplier: localSupplier } = await this.importSpHubSupplierToTenant(hubSupplierId);

    const prisma = await this.getPrisma();
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        supplierId: localSupplier.id,
        status: 'SENT',
        totalEstimated: totalWholesale,
        totalReal: 0,
      },
    });

    const protocolCode = `ATK-SP-${purchaseOrder.id.slice(0, 6).toUpperCase()}`;
    const deliveryLabel =
      body.deliveryMode === 'EXCURSION_BUS'
        ? 'Ônibus de Excursão (Brás / Feirinha)'
        : body.deliveryMode === 'PICKUP_STORE'
          ? 'Retirada Presencial na Loja / Galeria'
          : 'Entrega Garantida PDV Lojista (Transportadora Segurada)';

    const whatsappLines = [
      `Olá *${hubSupplier.name}*! Pedido via *Hub Atacado SP - PDV Lojista*`,
      `Protocolo: *${protocolCode}*`,
      `Modalidade: *${deliveryLabel}*`,
      '',
      '*Itens Solicitados no Atacado:*',
      ...detailedLines.map(
        (l) =>
          `- ${l.quantity} un. ${l.name} (${l.sizesLabel}) • R$ ${l.wholesalePrice.toFixed(2)}/un = *R$ ${l.lineWholesaleTotal.toFixed(2)}*`,
      ),
      '',
      `*Total Atacado Estimado:* R$ ${totalWholesale.toFixed(2)}`,
      ...(body.notes ? [`*Observações:* ${body.notes}`] : []),
    ];

    const cleanPhone = String(hubSupplier.whatsapp || '').replace(/\D/g, '');
    const whatsappPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappLines.join('\n'))}`;

    return {
      protocolCode,
      purchaseOrderId: purchaseOrder.id,
      supplierId: localSupplier.id,
      supplierName: hubSupplier.name,
      deliveryMode: body.deliveryMode || 'GUARANTEED_DELIVERY',
      deliveryLabel,
      totalWholesale,
      totalSuggestedRevenue,
      estimatedProfit,
      items: detailedLines,
      whatsappUrl,
    };
  }

  async createSupplier(data: any) {
    const prisma = await this.getPrisma();
    const { id, createdAt, updatedAt, products, purchaseOrders, ...createData } = data;
    return prisma.supplier.create({
      data: createData,
    });
  }

  async getSuppliers() {
    const prisma = await this.getPrisma();
    return prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async getSupplierById(supplierId: string) {
    const prisma = await this.getPrisma();
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
    return supplier;
  }

  async updateSupplier(supplierId: string, data: any) {
    const prisma = await this.getPrisma();
    const { id, createdAt, updatedAt, products, purchaseOrders, ...updateData } = data;
    return prisma.supplier.update({
      where: { id: supplierId },
      data: updateData,
    });
  }

  async deleteSupplier(supplierId: string) {
    const prisma = await this.getPrisma();
    try {
      return await prisma.supplier.delete({
        where: { id: supplierId },
      });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Não é possível excluir o fornecedor pois ele possui histórico de produtos ou pedidos vinculados.');
      }
      throw error;
    }
  }

  // --- Supplier Products ---

  async addSupplierProduct(supplierId: string, productId: string, expectedCost?: number) {
    const prisma = await this.getPrisma();
    const result = await prisma.supplierProduct.upsert({
      where: {
        supplierId_productId: {
          supplierId,
          productId,
        },
      },
      create: {
        supplierId,
        productId,
        expectedCost: expectedCost ? expectedCost : null,
      },
      update: {
        expectedCost: expectedCost ? expectedCost : null,
      },
    });
    this.productsService.clearCache();
    return result;
  }

  async removeSupplierProduct(supplierId: string, productId: string) {
    const prisma = await this.getPrisma();
    const result = await prisma.supplierProduct.delete({
      where: {
        supplierId_productId: {
          supplierId,
          productId,
        },
      },
    });
    this.productsService.clearCache();
    return result;
  }
}
