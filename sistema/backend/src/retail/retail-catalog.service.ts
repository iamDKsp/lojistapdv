import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { ProductsService } from '../products/products.service';
import { retryTransaction } from '../prisma/transaction-retry';
import { lockProducts } from '../prisma/lock-products';
import { retailLabel, retailNumber, variantIdentity } from './retail.rules';

@Injectable()
export class RetailCatalogService {
  constructor(
    private readonly manager: TenantConnectionManager,
    private readonly context: TenantContextService,
    private readonly products: ProductsService,
  ) {}
  private db() {
    const ctx = this.context.get();
    return this.manager.getTenantClient(ctx.tenantId, ctx.databaseUrl);
  }

  async ungrouped(search = '') {
    const db = await this.db();
    return db.product.findMany({
      where: {
        retailGroupId: null,
        active: true,
        ...(search.trim()
          ? {
              name: {
                contains: search.trim().slice(0, 120),
                mode: 'insensitive',
              },
            }
          : {}),
      },
      include: { category: true },
      take: 200,
      orderBy: { name: 'asc' },
    });
  }

  async list(query: {
    page?: string;
    limit?: string;
    search?: string;
    inactive?: string;
  }) {
    const db = await this.db();
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(
      200,
      Math.max(1, Math.floor(Number(query.limit) || 50)),
    );
    const search = (query.search || '').trim().slice(0, 150);
    const where: Prisma.RetailGroupWhereInput = {
      ...(query.inactive === 'true' ? {} : { active: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    OR: [
                      { barcode: { contains: search, mode: 'insensitive' } },
                      { size: { contains: search, mode: 'insensitive' } },
                      { color: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      db.retailGroup.findMany({
        where,
        include: {
          category: true,
          variants: { orderBy: [{ size: 'asc' }, { color: 'asc' }] },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.retailGroup.count({ where }),
    ]);
    return {
      data: data.map((group) => ({
        ...group,
        stock: group.variants
          .filter((v) => v.active)
          .reduce((sum, v) => sum + Number(v.stock), 0),
      })),
      meta: { page, total, lastPage: Math.ceil(total / limit) },
    };
  }

  async find(id: string) {
    const db = await this.db();
    const group = await db.retailGroup.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: [{ size: 'asc' }, { color: 'asc' }] },
      },
    });
    if (!group) throw new NotFoundException('Grupo não encontrado.');
    return group;
  }

  async save(id: string | null, body: any) {
    const name = retailLabel(body.name, 'Nome do grupo', 120);
    const categoryId = retailLabel(body.categoryId, 'Categoria', 80);
    const priceSell = new Prisma.Decimal(
      retailNumber(body.priceSell, 'Preço'),
    ).toDecimalPlaces(2);
    const priceCost = new Prisma.Decimal(
      retailNumber(body.priceCost ?? 0, 'Custo'),
    ).toDecimalPlaces(4);
    if (priceCost.gt('999999.9999'))
      throw new BadRequestException('Custo acima do limite permitido.');
    const imageUrl = retailLabel(body.imageUrl, 'Foto', 2000, true) || null;
    if (
      imageUrl &&
      !/^(\/api\/products\/uploads\/|\/uploads\/|https?:\/\/)/i.test(imageUrl)
    )
      throw new BadRequestException('Endereço da foto inválido.');
    const ncm = retailLabel(body.ncm, 'NCM', 8, true) || null;
    const cest = retailLabel(body.cest, 'CEST', 7, true) || null;
    if ((ncm && !/^\d{8}$/.test(ncm)) || (cest && !/^\d{7}$/.test(cest)))
      throw new BadRequestException('Confira NCM e CEST.');
    const origem = retailNumber(body.origem ?? 0, 'Origem', true);
    if (origem > 8) throw new BadRequestException('Origem inválida.');
    if (
      !Array.isArray(body.variants) ||
      !body.variants.length ||
      body.variants.length > 300
    )
      throw new BadRequestException('Cadastre de 1 a 300 variações.');
    const variants = body.variants.map((row: any) => {
      const size = retailLabel(row.size || 'Único', 'Tamanho', 40);
      const color = retailLabel(row.color || 'Sortida', 'Cor', 60);
      return {
        id: row.id ? retailLabel(row.id, 'Variação', 80) : undefined,
        existingProductId: row.existingProductId
          ? retailLabel(row.existingProductId, 'Item importado', 80)
          : undefined,
        size,
        color,
        variantKey: variantIdentity(size, color),
        barcode: retailLabel(row.barcode, 'Código de barras', 80, true) || null,
        stockToAdd: retailNumber(
          row.stockToAdd ?? 0,
          'Entrada de estoque',
          true,
        ),
        active: row.active !== false,
      };
    });
    if (new Set(variants.map((v) => v.variantKey)).size !== variants.length)
      throw new BadRequestException(
        'Cada combinação de tamanho e cor deve aparecer uma única vez.',
      );
    const ids = variants.map((v) => v.id).filter(Boolean);
    const importedIds = variants
      .map((v) => v.existingProductId)
      .filter((v): v is string => Boolean(v));
    if (
      new Set(importedIds).size !== importedIds.length ||
      variants.some((v) => v.id && v.existingProductId)
    )
      throw new BadRequestException(
        'Item importado repetido ou vínculo inválido.',
      );
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Variação repetida.');
    const db = await this.db();
    try {
      const savedId = await retryTransaction(() =>
        db.$transaction(
          async (tx) => {
            await tx.$executeRaw`INSERT INTO tenant_settings (id) VALUES ('singleton') ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id`;
            if (!(await tx.category.findUnique({ where: { id: categoryId } })))
              throw new BadRequestException(
                'Categoria não encontrada nesta loja.',
              );
            const grupoTributacaoId = body.grupoTributacaoId || null;
            if (
              grupoTributacaoId &&
              !(await tx.grupoTributacao.findUnique({
                where: { id: grupoTributacaoId },
              }))
            )
              throw new BadRequestException('Grupo tributário inválido.');
            let groupId = id;
            await lockProducts(tx, importedIds);
            for (const importedId of importedIds) {
              const imported = await tx.product.findUnique({
                where: { id: importedId },
              });
              if (!imported || imported.retailGroupId || !imported.active)
                throw new BadRequestException(
                  'O item importado não está disponível para organizar neste grupo.',
                );
              if (imported.ncm && ncm && imported.ncm !== ncm)
                throw new BadRequestException(
                  'Mercadorias com NCMs diferentes precisam de grupos separados.',
                );
            }
            const common = {
              name,
              categoryId,
              imageUrl,
              priceSell,
              priceCost,
              ncm,
              cest,
              origem,
              grupoTributacaoId,
              active: body.active !== false,
            };
            if (id) {
              const previous = await tx.retailGroup.findUnique({
                where: { id },
                include: { variants: true },
              });
              if (!previous)
                throw new NotFoundException('Grupo não encontrado.');
              if (body.version !== previous.version)
                throw new ConflictException(
                  'Este grupo foi alterado em outro terminal. Reabra antes de salvar.',
                );
              if (previous.variants.some((v) => !ids.includes(v.id)))
                throw new BadRequestException(
                  'Não remova variações existentes. Desative-as para preservar estoque e histórico.',
                );
              if (ids.some((v) => !previous.variants.some((p) => p.id === v)))
                throw new BadRequestException(
                  'A variação não pertence a este grupo.',
                );
              await lockProducts(
                tx,
                previous.variants.map((v) => v.id),
              );
              await tx.retailGroup.update({
                where: { id },
                data: { ...common, version: { increment: 1 } },
              });
            } else {
              if (ids.length)
                throw new BadRequestException(
                  'Um grupo novo não pode reutilizar IDs de variações.',
                );
              groupId = (await tx.retailGroup.create({ data: common })).id;
            }
            for (const row of variants) {
              const {
                id: variantId,
                existingProductId,
                stockToAdd,
                ...attributes
              } = row;
              const data = {
                ...attributes,
                retailGroupId: groupId!,
                name: `${name} · ${row.size} · ${row.color}`,
                categoryId,
                imageUrl,
                priceSell,
                priceCost,
                ncm,
                cest,
                origem,
                grupoTributacaoId,
                unit: 'UN',
                active: row.active,
              };
              const product =
                variantId || existingProductId
                  ? await tx.product.update({
                      where: { id: variantId || existingProductId },
                      data,
                    })
                  : await tx.product.create({ data });
              if (stockToAdd > 0) {
                await tx.stockLot.create({
                  data: {
                    productId: product.id,
                    quantity: stockToAdd,
                    remaining: stockToAdd,
                    costPrice: priceCost,
                  },
                });
                await tx.product.update({
                  where: { id: product.id },
                  data: { stock: { increment: stockToAdd } },
                });
                await tx.inventoryLog.create({
                  data: {
                    productId: product.id,
                    type: 'IN',
                    quantity: stockToAdd,
                    costPrice: Number(priceCost),
                    reason: 'Entrada na grade do grupo de mercadorias',
                  },
                });
              }
            }
            return groupId!;
          },
          { timeout: 30000 },
        ),
      );
      this.products.invalidateCache(this.context.get().tenantId);
      return this.find(savedId);
    } catch (error: any) {
      if (error?.code === 'P2002')
        throw new ConflictException(
          'Nome, código de barras ou combinação de tamanho e cor já cadastrados.',
        );
      throw error;
    }
  }
}
