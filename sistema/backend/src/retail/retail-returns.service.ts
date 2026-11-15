import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { EntityPhotoResolverService } from '../prisma/entity-photo-resolver.service';
import { ProductsService } from '../products/products.service';
import { retryTransaction } from '../prisma/transaction-retry';
import { lockProducts } from '../prisma/lock-products';
import {
  allocateReturnCents,
  partialReturnCents,
  retailLabel,
  retailNumber,
} from './retail.rules';

@Injectable()
export class RetailReturnsService {
  constructor(
    private readonly manager: TenantConnectionManager,
    private readonly context: TenantContextService,
    private readonly products: ProductsService,
    @Optional() private readonly photoResolver?: EntityPhotoResolverService,
  ) {}
  private db() {
    const ctx = this.context.get();
    return this.manager.getTenantClient(ctx.tenantId, ctx.databaseUrl);
  }
  async credits(customerId: string) {
    const db = await this.db();
    return db.storeCredit.findMany({
      where: { customerId, balance: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
  }
  async list() {
    const db = await this.db();
    const rows = await db.retailReturn.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: true,
        credit: true,
        sale: {
          select: {
            id: true,
            code: true,
            operatorId: true,
            operator: {
              select: {
                id: true,
                name: true,
                isManager: true,
                jobTitle: true,
              },
            },
          },
        },
        items: {
          include: {
            saleItem: {
              include: {
                product: {
                  select: {
                    id: true,
                    imageUrl: true,
                    size: true,
                    color: true,
                    retailGroup: { select: { imageUrl: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const ctx = this.context.get();
    const actors = this.photoResolver
      ? await this.photoResolver.loadTenantActors(ctx.tenantId, db)
      : null;

    return rows.map((ret: any) => {
      const opActor = actors
        ? actors.resolveActor({ id: ret.operatorId })
        : { id: ret.operatorId || null, name: null, imageUrl: null };
      const saleOpActor = ret.sale
        ? actors
          ? actors.resolveActor({
              operatorId: ret.sale.operator?.id || ret.sale.operatorId,
              id: ret.sale.operatorId,
              name: ret.sale.operator?.name || null,
            })
          : {
              id: ret.sale.operator?.id || ret.sale.operatorId || null,
              name: ret.sale.operator?.name || null,
              imageUrl: null,
            }
        : null;

      return {
        ...ret,
        operatorName: opActor.name,
        operatorImageUrl: opActor.imageUrl,
        sale: ret.sale
          ? {
              ...ret.sale,
              operator: ret.sale.operator
                ? actors
                  ? actors.hydrateOperator(ret.sale.operator)
                  : EntityPhotoResolverService.stripOperatorSecret(
                      ret.sale.operator,
                    )
                : saleOpActor?.name
                  ? {
                      id: saleOpActor.id,
                      name: saleOpActor.name,
                      imageUrl: saleOpActor.imageUrl,
                    }
                  : null,
              operatorName: saleOpActor?.name || null,
              operatorImageUrl: saleOpActor?.imageUrl || null,
            }
          : null,
        items: (ret.items || []).map((ri: any) => {
          const imageUrl = EntityPhotoResolverService.resolveProductImageUrl(
            ri.saleItem?.product,
          );
          return {
            ...ri,
            imageUrl,
            saleItem: ri.saleItem
              ? {
                  ...ri.saleItem,
                  imageUrl,
                  product: ri.saleItem.product
                    ? EntityPhotoResolverService.withResolvedProductImage(
                        ri.saleItem.product,
                      )
                    : null,
                }
              : ri.saleItem,
          };
        }),
      };
    });
  }
  async sale(reference: string) {
    const db = await this.db();
    const where = /^\d+$/.test(reference)
      ? { code: Number(reference) }
      : { id: reference };
    const sale = await db.sale.findFirst({
      where,
      include: {
        customer: true,
        operator: {
          select: { id: true, name: true, isManager: true, jobTitle: true },
        },
        items: {
          include: {
            retailReturnItems: true,
            product: {
              select: {
                id: true,
                imageUrl: true,
                size: true,
                color: true,
                retailGroup: { select: { imageUrl: true } },
              },
            },
          },
        },
        retailReturns: true,
      },
    });
    if (!sale) throw new NotFoundException('Venda não encontrada nesta loja.');

    const ctx = this.context.get();
    const actors = this.photoResolver
      ? await this.photoResolver.loadTenantActors(ctx.tenantId, db)
      : null;
    const saleOpActor = actors
      ? actors.resolveActor({
          operatorId: (sale as any).operator?.id || sale.operatorId,
          id: sale.operatorId,
          name: (sale as any).operator?.name || null,
        })
      : {
          id: (sale as any).operator?.id || sale.operatorId || null,
          name: (sale as any).operator?.name || null,
          imageUrl: null,
        };

    return {
      ...sale,
      operator: (sale as any).operator
        ? actors
          ? actors.hydrateOperator((sale as any).operator)
          : EntityPhotoResolverService.stripOperatorSecret(
              (sale as any).operator,
            )
        : saleOpActor.name
          ? {
              id: saleOpActor.id,
              name: saleOpActor.name,
              imageUrl: saleOpActor.imageUrl,
            }
          : null,
      operatorName: saleOpActor.name,
      operatorImageUrl: saleOpActor.imageUrl,
      items: (sale.items || []).map((item: any) => {
        const imageUrl = EntityPhotoResolverService.resolveProductImageUrl(
          item.product,
        );
        return {
          ...item,
          imageUrl,
          product: item.product
            ? EntityPhotoResolverService.withResolvedProductImage(item.product)
            : null,
        };
      }),
      retailReturns: ((sale as any).retailReturns || []).map((r: any) => {
        const rActor = actors
          ? actors.resolveActor({ id: r.operatorId })
          : { id: r.operatorId || null, name: null, imageUrl: null };
        return {
          ...r,
          operatorName: rActor.name,
          operatorImageUrl: rActor.imageUrl,
        };
      }),
    };
  }
  async create(body: any) {
    const requestKey = retailLabel(
      body.requestKey,
      'Identificação da troca',
      80,
    );
    const saleId = retailLabel(body.saleId, 'Venda', 80);
    const customerId = retailLabel(body.customerId, 'Cliente', 80);
    const reason = retailLabel(body.reason, 'Motivo', 500);
    if (
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.length > 200
    )
      throw new BadRequestException('Selecione os itens da troca.');
    const rows = body.items
      .map((row: any) => ({
        saleItemId: retailLabel(row.saleItemId, 'Item da venda', 80),
        quantity: retailNumber(row.quantity, 'Quantidade', true),
        restock: row.restock === true,
      }))
      .sort((a, b) => a.saleItemId.localeCompare(b.saleItemId));
    if (
      rows.some((row) => !row.quantity) ||
      new Set(rows.map((row) => row.saleItemId)).size !== rows.length
    )
      throw new BadRequestException('Itens ou quantidades inválidos.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ saleId, customerId, reason, rows }))
      .digest('hex');
    const db = await this.db();
    const ctx = this.context.get();
    const actors = this.photoResolver
      ? await this.photoResolver.loadTenantActors(ctx.tenantId, db)
      : null;
    const executorActor = actors
      ? actors.resolveActor({ id: ctx.userId })
      : null;
    const result = await retryTransaction(() =>
      db.$transaction(
        async (tx) => {
          await tx.$executeRaw`INSERT INTO tenant_settings (id) VALUES ('singleton') ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id`;
          const existing = await tx.retailReturn.findUnique({
            where: { requestKey },
            include: { credit: true, items: true },
          });
          if (existing) {
            if (existing.requestFingerprint !== fingerprint)
              throw new ConflictException(
                'Esta troca já existe com outros dados.',
              );
            return existing;
          }
          await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId} FOR UPDATE`;
          const sale = await tx.sale.findUnique({
            where: { id: saleId },
            include: { items: { include: { retailReturnItems: true } } },
          });
          if (!sale || sale.status !== 'completed')
            throw new BadRequestException(
              'A venda precisa existir e estar concluída.',
            );
          if (sale.customerId && sale.customerId !== customerId)
            throw new BadRequestException(
              'A troca deve pertencer ao cliente da venda.',
            );
          if (!(await tx.customer.findUnique({ where: { id: customerId } })))
            throw new BadRequestException('Cliente não encontrado nesta loja.');
          if (
            sale.source === 'ajuste_fiscal' ||
            sale.items.some((item) => !Number.isInteger(Number(item.quantity)))
          )
            throw new BadRequestException(
              'Esta operação não é elegível para troca de mercadorias.',
            );
          const allocations = allocateReturnCents(sale.items, sale.total);
          await lockProducts(
            tx,
            sale.items.map((item) => item.productId),
          );
          let totalCents = 0;
          const itemData = [] as {
            saleItemId: string;
            quantity: number;
            restock: boolean;
            value: Prisma.Decimal;
          }[];
          for (const row of rows) {
            const item = sale.items.find((item) => item.id === row.saleItemId);
            if (!item)
              throw new BadRequestException(
                'Item não pertence à venda informada.',
              );
            const previous = item.retailReturnItems.reduce(
              (n, entry) => n + entry.quantity,
              0,
            );
            const cents = partialReturnCents(
              allocations.get(item.id)!,
              Number(item.quantity),
              previous,
              row.quantity,
            );
            totalCents += cents;
            itemData.push({
              ...row,
              value: new Prisma.Decimal(cents).div(100),
            });
            if (row.restock) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: row.quantity } },
              });
              await tx.stockLot.create({
                data: {
                  productId: item.productId,
                  quantity: row.quantity,
                  remaining: row.quantity,
                  costPrice: item.priceCost,
                },
              });
              await tx.inventoryLog.create({
                data: {
                  productId: item.productId,
                  type: 'IN',
                  quantity: row.quantity,
                  costPrice: Number(item.priceCost),
                  reason: `Troca referente à venda ${sale.code || sale.id}: ${reason}`,
                },
              });
            }
          }
          if (!totalCents)
            throw new BadRequestException(
              'Os itens selecionados não geram crédito.',
            );
          const amount = new Prisma.Decimal(totalCents).div(100);
          const createdReturn = await tx.retailReturn.create({
            data: {
              requestKey,
              requestFingerprint: fingerprint,
              saleId,
              customerId,
              reason,
              operatorId: this.context.get().userId,
              total: amount,
              items: { create: itemData },
              credit: { create: { customerId, amount, balance: amount } },
            },
            include: { credit: true, items: true },
          });

          if ((tx as any).storefrontOrder?.findUnique) {
            try {
              const linkedOrder = await (tx as any).storefrontOrder.findUnique({
                where: { saleId },
              });
              if (linkedOrder && (tx as any).storefrontOrderEvent?.create) {
                await (tx as any).storefrontOrderEvent.create({
                  data: {
                    orderId: linkedOrder.id,
                    eventType: 'SALE_RETURN_CREATED',
                    actorType: 'ADMIN',
                    actorId: this.context.get().userId || null,
                    actorName: executorActor?.name || null,
                    reason: `Devolução/troca registrada na venda vinculada: ${reason}`,
                    metadataJson: {
                      returnId: createdReturn.id,
                      saleId,
                      totalCredit: Number(amount),
                    },
                  },
                });
              }
            } catch {
              // Ignora caso a tabela storefront_orders ainda não exista no tenant
            }
          }

          return createdReturn;
        },
        { timeout: 30000 },
      ),
    );
    this.products.invalidateCache(this.context.get().tenantId);
    if (executorActor && result && typeof result === 'object') {
      return {
        ...result,
        operatorName: executorActor.name,
        operatorImageUrl: executorActor.imageUrl,
      };
    }
    return result;
  }
}
