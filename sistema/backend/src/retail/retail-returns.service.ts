import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
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
    return db.retailReturn.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: true,
        credit: true,
        sale: { select: { id: true, code: true } },
        items: { include: { saleItem: true } },
      },
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
        items: { include: { retailReturnItems: true } },
        retailReturns: true,
      },
    });
    if (!sale) throw new NotFoundException('Venda não encontrada nesta loja.');
    return sale;
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
    return result;
  }
}
