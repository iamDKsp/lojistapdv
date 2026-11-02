import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { ProductsService } from '../products/products.service';
import { variantIdentity } from '../retail/retail.rules';
import { SHOWCASE_CATEGORIES_CATALOG } from './showcase-catalog.data';

@Injectable()
export class CategoriesService {
  constructor(
    private tenantManager: TenantConnectionManager,
    private tenantContext: TenantContextService,
    private products: ProductsService,
  ) {}

  private async getPrisma() {
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.tenantManager.getTenantClient(tenantId, databaseUrl);
  }

  private flushProductCache() {
    try {
      const { tenantId } = this.tenantContext.get();
      this.products.invalidateCache(tenantId);
    } catch {
      this.products.invalidateCache();
    }
  }

  async findAll() {
    const prisma = await this.getPrisma();
    try {
      const list = await (prisma.category as any).findMany({
        include: {
          grupoTributacao: true,
          _count: { select: { retailGroups: true, products: true } },
        },
        orderBy: { name: 'asc' },
      });
      return list.map((cat: any) => ({
        ...cat,
        active: cat.active !== false,
      }));
    } catch {
      const list = await prisma.category.findMany({
        include: { grupoTributacao: true },
        orderBy: { name: 'asc' },
      });
      return list.map((cat: any) => ({
        ...cat,
        active: cat.active !== false,
      }));
    }
  }

  async create(data: any) {
    const prisma = await this.getPrisma();
    const name = String(data?.name || '').trim();
    if (!name) {
      throw new BadRequestException('Informe o nome da categoria.');
    }
    const active = data?.active !== undefined ? Boolean(data.active) : true;
    const icon = data?.icon !== undefined ? data.icon || null : null;
    const grupoTributacaoId = data?.grupoTributacaoId || null;

    let created: any;
    try {
      created = await (prisma.category as any).create({
        data: {
          name,
          icon,
          active,
          grupoTributacaoId,
        },
        include: {
          grupoTributacao: true,
          _count: { select: { retailGroups: true, products: true } },
        },
      });
    } catch {
      created = await prisma.category.create({
        data: {
          name,
          ...(icon ? { icon } : {}),
          grupoTributacaoId,
        },
        include: { grupoTributacao: true },
      });
    }
    this.flushProductCache();
    return { ...created, active: created.active !== false };
  }

  async update(id: string, data: any) {
    const prisma = await this.getPrisma();
    const updatePayload: Record<string, any> = {};
    if (data?.name !== undefined) {
      const trimmed = String(data.name).trim();
      if (!trimmed) {
        throw new BadRequestException('O nome da categoria não pode ficar vazio.');
      }
      updatePayload.name = trimmed;
    }
    if (data?.icon !== undefined) {
      updatePayload.icon = data.icon || null;
    }
    if (data?.active !== undefined) {
      updatePayload.active = Boolean(data.active);
    }
    if (data?.grupoTributacaoId !== undefined) {
      updatePayload.grupoTributacaoId = data.grupoTributacaoId || null;
    }

    let updated: any;
    try {
      updated = await (prisma.category as any).update({
        where: { id },
        data: updatePayload,
        include: {
          grupoTributacao: true,
          _count: { select: { retailGroups: true, products: true } },
        },
      });
    } catch {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.active;
      updated = await prisma.category.update({
        where: { id },
        data: fallbackPayload,
        include: { grupoTributacao: true },
      });
    }
    this.flushProductCache();
    return {
      ...updated,
      active:
        data?.active !== undefined
          ? Boolean(data.active)
          : updated.active !== false,
    };
  }

  async bulkUpdateStatus(body: { ids?: string[]; active: boolean }) {
    const prisma = await this.getPrisma();
    const active = Boolean(body?.active);
    const ids = Array.isArray(body?.ids)
      ? body.ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const where = ids.length > 0 ? { id: { in: ids } } : {};
    const result = await (prisma.category as any).updateMany({
      where,
      data: { active },
    });
    this.flushProductCache();
    return { updatedCount: result?.count ?? 0, active };
  }

  async populateShowcaseCatalog(body?: { minPerCategory?: number }) {
    const prisma = await this.getPrisma();
    const minPerCategory = Math.min(
      20,
      Math.max(1, Number(body?.minPerCategory) || 10),
    );

    const existingCategories = await prisma.category.findMany();
    const byLowerName = new Map<string, any>();
    for (const cat of existingCategories) {
      byLowerName.set(cat.name.trim().toLowerCase(), cat);
    }

    let categoriesCreated = 0;
    let categoriesUpdated = 0;
    let groupsCreated = 0;
    let variantsCreated = 0;

    for (const templateCat of SHOWCASE_CATEGORIES_CATALOG) {
      const key = templateCat.name.trim().toLowerCase();
      let category: any =
        byLowerName.get(key) ||
        templateCat.aliasNames
          .map((alias) => byLowerName.get(alias.trim().toLowerCase()))
          .find(Boolean);

      if (!category) {
        try {
          category = await (prisma.category as any).create({
            data: {
              name: templateCat.name,
              icon: templateCat.icon,
              active: true,
            },
          });
        } catch {
          category = await prisma.category.create({
            data: {
              name: templateCat.name,
              icon: templateCat.icon,
            },
          });
        }
        byLowerName.set(key, category);
        categoriesCreated += 1;
      } else if (category.icon !== templateCat.icon) {
        category = await prisma.category.update({
          where: { id: category.id },
          data: { icon: templateCat.icon },
        });
        byLowerName.set(key, category);
        categoriesUpdated += 1;
      }

      const existingGroups = await prisma.retailGroup.findMany({
        where: { categoryId: category.id },
        select: { id: true, name: true },
      });

      const currentCount = existingGroups.length;
      if (currentCount >= minPerCategory) {
        continue;
      }

      const needed = minPerCategory - currentCount;
      let createdForThisCat = 0;

      for (
        let idx = 0;
        idx < templateCat.items.length && createdForThisCat < needed;
        idx += 1
      ) {
        const item = templateCat.items[idx];
        const existingByName = await prisma.retailGroup.findFirst({
          where: {
            name: { equals: item.name, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (existingByName) {
          continue;
        }

        const priceSell = new Prisma.Decimal(item.priceSell).toDecimalPlaces(2);
        const priceCost = new Prisma.Decimal(item.priceCost).toDecimalPlaces(4);

        await prisma.$transaction(async (tx) => {
          const group = await tx.retailGroup.create({
            data: {
              name: item.name,
              categoryId: category.id,
              priceSell,
              priceCost,
              ncm: '61091000',
              origem: 0,
              active: true,
            },
          });

          for (let sIdx = 0; sIdx < item.sizes.length; sIdx += 1) {
            const size = item.sizes[sIdx];
            for (let cIdx = 0; cIdx < item.colors.length; cIdx += 1) {
              const color = item.colors[cIdx] || 'Padrão';
              const stockQty = Number(item.stockPerVariant ?? 8);
              const rawBarcode = `${item.codePrefix}-${String(idx + 1).padStart(2, '0')}${String(sIdx + 1).padStart(2, '0')}${String(cIdx + 1)}`;

              const barcodeInUse = await tx.product.findFirst({
                where: { barcode: rawBarcode },
                select: { id: true },
              });
              const finalBarcode = barcodeInUse
                ? `${rawBarcode}-${Math.floor(10 + Math.random() * 89)}`
                : rawBarcode;

              const product = await tx.product.create({
                data: {
                  retailGroupId: group.id,
                  name: `${item.name} · ${size} · ${color}`,
                  size,
                  color,
                  variantKey: variantIdentity(size, color),
                  barcode: finalBarcode,
                  categoryId: category.id,
                  priceSell,
                  priceCost,
                  ncm: '61091000',
                  origem: 0,
                  unit: 'UN',
                  stock: stockQty,
                  active: true,
                },
              });

              if (stockQty > 0) {
                await tx.stockLot.create({
                  data: {
                    productId: product.id,
                    quantity: stockQty,
                    remaining: stockQty,
                    costPrice: priceCost,
                  },
                });
                await tx.inventoryLog.create({
                  data: {
                    productId: product.id,
                    type: 'IN',
                    quantity: stockQty,
                    costPrice: Number(priceCost),
                    reason: 'Carga de catálogo mostruário por categoria',
                  },
                });
              }
              variantsCreated += 1;
            }
          }
          groupsCreated += 1;
          createdForThisCat += 1;
        });
      }
    }

    this.flushProductCache();
    return {
      categoriesTotal: SHOWCASE_CATEGORIES_CATALOG.length,
      categoriesCreated,
      categoriesUpdated,
      groupsCreated,
      variantsCreated,
    };
  }

  async remove(id: string) {
    const prisma = await this.getPrisma();
    const products = await prisma.product.findFirst({
      where: { categoryId: id },
    });
    if (products) {
      throw new BadRequestException(
        'Não é possível excluir uma categoria que possui produtos vinculados. Desative a categoria caso queira ocultá-la no PDV.',
      );
    }
    const deleted = await prisma.category.delete({ where: { id } });
    this.flushProductCache();
    return deleted;
  }
}
