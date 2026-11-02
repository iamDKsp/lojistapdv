import { isStorefrontSchemaMissingError } from '../tenants/tenant-schema-upgrade';

export interface ActiveReservationSummary {
  quantity: number;
  orderIds: string[];
}

/**
 * Calcula as quantidades reservadas ativas e não expiradas por produto.
 * Ignora automaticamente reservas vencidas (expiresAt <= now) mesmo antes da limpeza periódica.
 * Em bancos de tenants ainda não atualizados via Sys-Init ou mocks parciais de teste,
 * retorna mapa vazio sem interromper o funcionamento do PDV.
 */
export async function getActiveReservedQuantities(
  txOrPrisma: any,
  productIds: string[],
  options?: { excludeOrderId?: string; now?: Date },
): Promise<Map<string, ActiveReservationSummary>> {
  const result = new Map<string, ActiveReservationSummary>();
  const uniqueIds = Array.from(new Set((productIds || []).filter(Boolean)));
  if (!uniqueIds.length || !txOrPrisma?.stockReservation?.findMany) {
    return result;
  }

  const now = options?.now ?? new Date();
  try {
    const rows = await txOrPrisma.stockReservation.findMany({
      where: {
        productId: { in: uniqueIds },
        status: 'ACTIVE',
        expiresAt: { gt: now },
        ...(options?.excludeOrderId
          ? { orderId: { not: options.excludeOrderId } }
          : {}),
      },
      select: {
        productId: true,
        quantity: true,
        orderId: true,
      },
    });

    for (const row of rows || []) {
      const qty = Number(row.quantity || 0);
      if (qty <= 0) continue;
      const existing = result.get(row.productId) || {
        quantity: 0,
        orderIds: [],
      };
      existing.quantity += qty;
      if (row.orderId && !existing.orderIds.includes(row.orderId)) {
        existing.orderIds.push(row.orderId);
      }
      result.set(row.productId, existing);
    }
  } catch (err) {
    if (isStorefrontSchemaMissingError(err)) {
      return result;
    }
    throw err;
  }

  return result;
}

/**
 * Registra alerta de conflito de estoque em pedidos ativos quando uma venda offline
 * sincronizada ou operação com estoque negativo consome unidades reservadas.
 */
export async function flagOrdersWithStockConflict(
  tx: any,
  orderIds: string[],
  note: string,
): Promise<void> {
  const uniqueOrderIds = Array.from(new Set((orderIds || []).filter(Boolean)));
  if (!uniqueOrderIds.length || !tx?.storefrontOrder?.updateMany) {
    return;
  }

  try {
    await tx.storefrontOrder.updateMany({
      where: {
        id: { in: uniqueOrderIds },
        commercialStatus: { in: ['AWAITING_CONFIRMATION', 'CONFIRMED'] },
      },
      data: {
        offlineConflictDetected: true,
        offlineConflictNote: note,
      },
    });

    if (tx?.storefrontOrderEvent?.create) {
      for (const orderId of uniqueOrderIds) {
        await tx.storefrontOrderEvent.create({
          data: {
            orderId,
            eventType: 'OFFLINE_STOCK_CONFLICT',
            actorType: 'SYSTEM',
            reason: note,
          },
        });
      }
    }
  } catch (err) {
    if (isStorefrontSchemaMissingError(err)) {
      return;
    }
    throw err;
  }
}
