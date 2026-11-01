import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';

export type CustomerSegment = 'vip' | 'active' | 'inactive' | 'new';

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cash: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de crédito',
  credit: 'Cartão de crédito',
  debito: 'Cartão de débito',
  debit: 'Cartão de débito',
  credito_loja: 'Crédito na loja',
};

function sanitizeText(
  value: unknown,
  maxLength: number,
  fieldLabel?: string,
  required = false,
): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    if (required) {
      throw new BadRequestException(`Informe ${fieldLabel || 'o campo'}.`);
    }
    return null;
  }
  if (text.length > maxLength) {
    throw new BadRequestException(
      `${fieldLabel || 'O campo'} deve ter no máximo ${maxLength} caracteres.`,
    );
  }
  return text;
}

function sanitizePhone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 20) {
    throw new BadRequestException(
      'Informe um telefone válido com pelo menos 8 dígitos.',
    );
  }
  return digits;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}

function topEntries(map: Map<string, number>, limit = 6) {
  return [...map.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label))
    .slice(0, limit);
}

@Injectable()
export class CustomersService {
  constructor(
    private tenantManager: TenantConnectionManager,
    private tenantContext: TenantContextService,
  ) {}

  private async getPrisma() {
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.tenantManager.getTenantClient(tenantId, databaseUrl);
  }

  async findAll() {
    const prisma = await this.getPrisma();
    return prisma.customer.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findByPhone(phone: string) {
    const prisma = await this.getPrisma();
    const cleaned = String(phone ?? '').replace(/\D/g, '');
    return prisma.customer.findUnique({
      where: { phone: cleaned || phone },
    });
  }

  async create(data: any) {
    const prisma = await this.getPrisma();
    const name = sanitizeText(data?.name, 120, 'o nome do cliente', true)!;
    const phone = sanitizePhone(data?.phone);
    const cpfCnpj = sanitizeText(data?.cpfCnpj, 20, 'O CPF/CNPJ');
    const address = sanitizeText(data?.address, 255, 'O endereço');
    const reference = sanitizeText(
      data?.reference,
      500,
      'A observação do cliente',
    );

    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException(
        'Já existe um cliente cadastrado com este telefone.',
      );
    }

    return prisma.customer.create({
      data: {
        name,
        phone,
        cpfCnpj,
        address,
        reference,
      },
    });
  }

  async update(id: string, data: any) {
    const prisma = await this.getPrisma();
    const current = await prisma.customer.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Cliente não encontrado nesta loja.');
    }

    const name = sanitizeText(data?.name, 120, 'o nome do cliente', true)!;
    const phone = sanitizePhone(data?.phone);
    const cpfCnpj = sanitizeText(data?.cpfCnpj, 20, 'O CPF/CNPJ');
    const address = sanitizeText(data?.address, 255, 'O endereço');
    const reference = sanitizeText(
      data?.reference,
      500,
      'A observação do cliente',
    );

    if (phone !== current.phone) {
      const duplicate = await prisma.customer.findUnique({ where: { phone } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'Já existe outro cliente cadastrado com este telefone.',
        );
      }
    }

    return prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        cpfCnpj,
        address,
        reference,
      },
    });
  }

  async getInsights(
    query: {
      search?: string;
      segment?: string;
      sort?: string;
    } = {},
    now = new Date(),
  ) {
    const prisma = await this.getPrisma();
    const [customers, sales, returns, credits] = await Promise.all([
      prisma.customer.findMany({ orderBy: { name: 'asc' } }),
      prisma.sale.findMany({
        where: {
          status: 'completed',
          NOT: { source: 'ajuste_fiscal' },
        },
        select: {
          id: true,
          customerId: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              productId: true,
              quantity: true,
            },
          },
        },
      }),
      prisma.retailReturn.findMany({
        select: {
          id: true,
          customerId: true,
          total: true,
          createdAt: true,
        },
      }),
      prisma.storeCredit.findMany({
        where: { balance: { gt: 0 } },
        select: {
          id: true,
          customerId: true,
          amount: true,
          balance: true,
          createdAt: true,
        },
      }),
    ]);

    const productIds = new Set<string>();
    for (const sale of sales) {
      if (!sale.customerId) continue;
      for (const item of sale.items || []) {
        if (item.productId) productIds.add(item.productId);
      }
    }

    const products = productIds.size
      ? await prisma.product.findMany({
          where: { id: { in: [...productIds] } },
          select: { id: true, size: true, color: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    let identifiedSalesCount = 0;
    let unidentifiedSalesCount = 0;
    let identifiedRevenue = 0;
    let unidentifiedRevenue = 0;

    const salesByCustomer = new Map<
      string,
      {
        count: number;
        totalSpent: number;
        totalPieces: number;
        lastPurchaseAt: Date | null;
        sizes: Map<string, number>;
        colors: Map<string, number>;
      }
    >();

    for (const sale of sales) {
      const value = Number(sale.total || 0);
      if (!sale.customerId) {
        unidentifiedSalesCount += 1;
        unidentifiedRevenue += value;
        continue;
      }
      identifiedSalesCount += 1;
      identifiedRevenue += value;

      let entry = salesByCustomer.get(sale.customerId);
      if (!entry) {
        entry = {
          count: 0,
          totalSpent: 0,
          totalPieces: 0,
          lastPurchaseAt: null,
          sizes: new Map(),
          colors: new Map(),
        };
        salesByCustomer.set(sale.customerId, entry);
      }
      entry.count += 1;
      entry.totalSpent += value;
      const saleDate = new Date(sale.createdAt);
      if (!entry.lastPurchaseAt || saleDate > entry.lastPurchaseAt) {
        entry.lastPurchaseAt = saleDate;
      }

      for (const item of sale.items || []) {
        const qty = Number(item.quantity || 0);
        entry.totalPieces += qty;
        const prod = productMap.get(item.productId);
        if (prod?.size) {
          entry.sizes.set(prod.size, (entry.sizes.get(prod.size) || 0) + qty);
        }
        if (prod?.color) {
          entry.colors.set(
            prod.color,
            (entry.colors.get(prod.color) || 0) + qty,
          );
        }
      }
    }

    const returnsByCustomer = new Map<string, { count: number; total: number }>();
    for (const ret of returns) {
      const cur = returnsByCustomer.get(ret.customerId) || {
        count: 0,
        total: 0,
      };
      cur.count += 1;
      cur.total += Number(ret.total || 0);
      returnsByCustomer.set(ret.customerId, cur);
    }

    const creditsByCustomer = new Map<string, number>();
    let totalOutstandingCredit = 0;
    for (const credit of credits) {
      const bal = Number(credit.balance || 0);
      if (bal <= 0) continue;
      totalOutstandingCredit += bal;
      creditsByCustomer.set(
        credit.customerId,
        (creditsByCustomer.get(credit.customerId) || 0) + bal,
      );
    }

    const enriched = customers.map((customer) => {
      const s = salesByCustomer.get(customer.id);
      const r = returnsByCustomer.get(customer.id);
      const purchasesCount = s?.count || 0;
      const totalPieces = Number((s?.totalPieces || 0).toFixed(3));
      const totalSpent = Number((s?.totalSpent || 0).toFixed(2));
      const totalReturned = Number((r?.total || 0).toFixed(2));
      const netSpent = Math.max(
        0,
        Number((totalSpent - totalReturned).toFixed(2)),
      );
      const avgTicket =
        purchasesCount > 0
          ? Number((totalSpent / purchasesCount).toFixed(2))
          : 0;
      const lastPurchaseAt = s?.lastPurchaseAt
        ? s.lastPurchaseAt.toISOString()
        : null;
      const daysSinceLastPurchase = s?.lastPurchaseAt
        ? daysBetween(s.lastPurchaseAt, now)
        : null;
      const creditBalance = Number(
        (creditsByCustomer.get(customer.id) || 0).toFixed(2),
      );
      const favoriteSize = s ? topEntries(s.sizes, 1)[0]?.label || null : null;
      const favoriteColor = s
        ? topEntries(s.colors, 1)[0]?.label || null
        : null;

      const isVip = purchasesCount >= 3 || netSpent >= 500;
      const isInactive =
        purchasesCount > 0 &&
        daysSinceLastPurchase !== null &&
        daysSinceLastPurchase >= 60;
      const isActive30d =
        purchasesCount > 0 &&
        daysSinceLastPurchase !== null &&
        daysSinceLastPurchase <= 30;
      const createdDaysAgo = daysBetween(new Date(customer.createdAt), now);

      let segment: CustomerSegment = 'new';
      if (isInactive) {
        segment = 'inactive';
      } else if (isVip) {
        segment = 'vip';
      } else if (purchasesCount > 0) {
        segment = 'active';
      }

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        cpfCnpj: customer.cpfCnpj || null,
        address: customer.address || null,
        reference: customer.reference || null,
        createdAt: customer.createdAt,
        purchasesCount,
        totalPieces,
        totalSpent,
        totalReturned,
        netSpent,
        avgTicket,
        returnsCount: r?.count || 0,
        lastPurchaseAt,
        daysSinceLastPurchase,
        creditBalance,
        favoriteSize,
        favoriteColor,
        segment,
        isVip,
        isActive30d,
        isInactive,
        isNew30d: createdDaysAgo <= 30,
      };
    });

    const totalSalesCount = identifiedSalesCount + unidentifiedSalesCount;
    const summary = {
      totalCustomers: enriched.length,
      activeCustomers30d: enriched.filter((c) => c.isActive30d).length,
      inactiveCustomers60d: enriched.filter((c) => c.isInactive).length,
      vipCustomersCount: enriched.filter((c) => c.isVip).length,
      withoutPurchaseCount: enriched.filter((c) => c.purchasesCount === 0)
        .length,
      newCustomers30d: enriched.filter((c) => c.isNew30d).length,
      customersWithCreditCount: enriched.filter((c) => c.creditBalance > 0)
        .length,
      totalOutstandingCredit: Number(totalOutstandingCredit.toFixed(2)),
      identifiedSalesCount,
      unidentifiedSalesCount,
      identifiedSharePercent:
        totalSalesCount > 0
          ? Math.round((identifiedSalesCount / totalSalesCount) * 100)
          : 0,
      identifiedRevenue: Number(identifiedRevenue.toFixed(2)),
      unidentifiedRevenue: Number(unidentifiedRevenue.toFixed(2)),
      avgTicketIdentified:
        identifiedSalesCount > 0
          ? Number((identifiedRevenue / identifiedSalesCount).toFixed(2))
          : 0,
      avgTicketUnidentified:
        unidentifiedSalesCount > 0
          ? Number((unidentifiedRevenue / unidentifiedSalesCount).toFixed(2))
          : 0,
    };

    const topVips = [...enriched]
      .filter((c) => c.purchasesCount > 0)
      .sort((a, b) => b.netSpent - a.netSpent || b.purchasesCount - a.purchasesCount)
      .slice(0, 5);

    const reactivationCandidates = [...enriched]
      .filter((c) => c.isInactive || c.creditBalance > 0)
      .sort(
        (a, b) =>
          b.creditBalance - a.creditBalance ||
          b.netSpent - a.netSpent ||
          (b.daysSinceLastPurchase || 0) - (a.daysSinceLastPurchase || 0),
      )
      .slice(0, 6);

    const searchTerm = (query.search || '').trim().toLowerCase();
    const searchDigits = searchTerm.replace(/\D/g, '');
    const segmentFilter = (query.segment || 'all').toLowerCase();
    const sortBy = (query.sort || 'spent_desc').toLowerCase();

    const filtered = enriched.filter((c) => {
      if (segmentFilter === 'vip' && !c.isVip) return false;
      if (segmentFilter === 'active' && !c.isActive30d) return false;
      if (segmentFilter === 'inactive' && !c.isInactive) return false;
      if (segmentFilter === 'with_credit' && c.creditBalance <= 0) return false;
      if (segmentFilter === 'new' && c.purchasesCount > 0) return false;

      if (!searchTerm) return true;
      const matchName = c.name.toLowerCase().includes(searchTerm);
      const matchPhone =
        c.phone.toLowerCase().includes(searchTerm) ||
        (Boolean(searchDigits) && c.phone.includes(searchDigits));
      const matchCpf =
        Boolean(c.cpfCnpj) &&
        (c.cpfCnpj!.toLowerCase().includes(searchTerm) ||
          (Boolean(searchDigits) &&
            c.cpfCnpj!.replace(/\D/g, '').includes(searchDigits)));
      const matchAddress =
        Boolean(c.address) && c.address!.toLowerCase().includes(searchTerm);
      const matchRef =
        Boolean(c.reference) && c.reference!.toLowerCase().includes(searchTerm);

      return matchName || matchPhone || matchCpf || matchAddress || matchRef;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }
      if (sortBy === 'recent_desc') {
        const tA = a.lastPurchaseAt ? new Date(a.lastPurchaseAt).getTime() : 0;
        const tB = b.lastPurchaseAt ? new Date(b.lastPurchaseAt).getTime() : 0;
        return tB - tA || b.netSpent - a.netSpent;
      }
      if (sortBy === 'purchases_desc') {
        return (
          b.purchasesCount - a.purchasesCount ||
          b.netSpent - a.netSpent ||
          a.name.localeCompare(b.name, 'pt-BR')
        );
      }
      if (sortBy === 'credit_desc') {
        return (
          b.creditBalance - a.creditBalance ||
          b.netSpent - a.netSpent ||
          a.name.localeCompare(b.name, 'pt-BR')
        );
      }
      return (
        b.netSpent - a.netSpent ||
        b.purchasesCount - a.purchasesCount ||
        a.name.localeCompare(b.name, 'pt-BR')
      );
    });

    return {
      summary,
      highlights: {
        topVips,
        reactivationCandidates,
      },
      customers: filtered,
    };
  }

  async getProfile(customerId: string, now = new Date()) {
    const prisma = await this.getPrisma();
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado nesta loja.');
    }

    const [sales, returns, credits] = await Promise.all([
      prisma.sale.findMany({
        where: {
          customerId,
          NOT: { source: 'ajuste_fiscal' },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          operator: { select: { id: true, name: true } },
          payments: true,
          items: {
            include: {
              retailReturnItems: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  size: true,
                  color: true,
                  category: { select: { id: true, name: true } },
                  retailGroup: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.retailReturn.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          sale: { select: { id: true, code: true } },
          credit: true,
          items: {
            include: {
              saleItem: {
                select: { id: true, productName: true, priceUnit: true },
              },
            },
          },
        },
      }),
      prisma.storeCredit.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        include: {
          retailReturn: {
            select: {
              id: true,
              saleId: true,
              reason: true,
              sale: { select: { id: true, code: true } },
            },
          },
          uses: {
            include: {
              sale: { select: { id: true, code: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
    ]);

    const completedSales = sales.filter((s) => s.status === 'completed');
    const purchasesCount = completedSales.length;
    let totalSpent = 0;
    let totalPieces = 0;

    const sizesMap = new Map<string, number>();
    const colorsMap = new Map<string, number>();
    const categoriesMap = new Map<string, number>();
    const groupsMap = new Map<
      string,
      { id: string; name: string; categoryName: string | null; quantity: number; total: number }
    >();
    const paymentsMap = new Map<
      string,
      { method: string; label: string; count: number; total: number }
    >();
    const operatorsMap = new Map<
      string,
      { id: string; name: string; count: number }
    >();

    for (const sale of completedSales) {
      totalSpent += Number(sale.total || 0);

      if (sale.operator?.id && sale.operator?.name) {
        const curOp = operatorsMap.get(sale.operator.id) || {
          id: sale.operator.id,
          name: sale.operator.name,
          count: 0,
        };
        curOp.count += 1;
        operatorsMap.set(sale.operator.id, curOp);
      }

      for (const pay of sale.payments || []) {
        const methodKey = (pay.method || 'outros').toLowerCase();
        const label =
          pay.label || PAYMENT_LABELS[methodKey] || pay.method || 'Outros';
        const curPay = paymentsMap.get(label) || {
          method: methodKey,
          label,
          count: 0,
          total: 0,
        };
        curPay.count += 1;
        curPay.total = Number((curPay.total + Number(pay.value || 0)).toFixed(2));
        paymentsMap.set(label, curPay);
      }

      for (const item of sale.items || []) {
        const qty = Number(item.quantity || 0);
        const subtotal = Number(item.subtotal || 0);
        totalPieces += qty;

        const size = item.product?.size?.trim();
        const color = item.product?.color?.trim();
        const categoryName = item.product?.category?.name?.trim() || null;
        const groupId =
          item.product?.retailGroup?.id || item.productId || item.productName;
        const groupName =
          item.product?.retailGroup?.name ||
          item.product?.name ||
          item.productName;

        if (size) {
          sizesMap.set(size, (sizesMap.get(size) || 0) + qty);
        }
        if (color) {
          colorsMap.set(color, (colorsMap.get(color) || 0) + qty);
        }
        if (categoryName) {
          categoriesMap.set(
            categoryName,
            (categoriesMap.get(categoryName) || 0) + qty,
          );
        }
        if (groupName) {
          const curGroup = groupsMap.get(groupId) || {
            id: groupId,
            name: groupName,
            categoryName,
            quantity: 0,
            total: 0,
          };
          curGroup.quantity += qty;
          curGroup.total = Number((curGroup.total + subtotal).toFixed(2));
          groupsMap.set(groupId, curGroup);
        }
      }
    }

    const totalReturned = Number(
      returns.reduce((acc, r) => acc + Number(r.total || 0), 0).toFixed(2),
    );
    totalSpent = Number(totalSpent.toFixed(2));
    const netSpent = Math.max(0, Number((totalSpent - totalReturned).toFixed(2)));
    const avgTicket =
      purchasesCount > 0
        ? Number((totalSpent / purchasesCount).toFixed(2))
        : 0;

    const latestSaleDate = completedSales.length
      ? new Date(completedSales[0].createdAt)
      : null;
    const earliestSaleDate = completedSales.length
      ? new Date(completedSales[completedSales.length - 1].createdAt)
      : null;

    const daysSinceLastPurchase = latestSaleDate
      ? daysBetween(latestSaleDate, now)
      : null;

    const avgDaysBetweenPurchases =
      completedSales.length >= 2 && latestSaleDate && earliestSaleDate
        ? Math.max(
            1,
            Math.round(
              (latestSaleDate.getTime() - earliestSaleDate.getTime()) /
                (86400000 * (completedSales.length - 1)),
            ),
          )
        : null;

    const totalCreditIssued = Number(
      credits.reduce((acc, c) => acc + Number(c.amount || 0), 0).toFixed(2),
    );
    const creditBalance = Number(
      credits.reduce((acc, c) => acc + Number(c.balance || 0), 0).toFixed(2),
    );
    const totalCreditUsed = Math.max(
      0,
      Number((totalCreditIssued - creditBalance).toFixed(2)),
    );

    const isVip = purchasesCount >= 3 || netSpent >= 500;
    const isInactive =
      purchasesCount > 0 &&
      daysSinceLastPurchase !== null &&
      daysSinceLastPurchase >= 60;

    let segment: CustomerSegment = 'new';
    if (isInactive) {
      segment = 'inactive';
    } else if (isVip) {
      segment = 'vip';
    } else if (purchasesCount > 0) {
      segment = 'active';
    }

    const formattedSales = sales.map((sale) => {
      const items = (sale.items || []).map((item) => {
        const returnedQuantity = (item.retailReturnItems || []).reduce(
          (acc, r) => acc + Number(r.quantity || 0),
          0,
        );
        const qty = Number(item.quantity || 0);
        const remainingForReturn = Math.max(0, qty - returnedQuantity);
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName || item.product?.name || 'Mercadoria',
          size: item.product?.size || null,
          color: item.product?.color || null,
          quantity: qty,
          priceUnit: Number(item.priceUnit || 0),
          subtotal: Number(item.subtotal || 0),
          returnedQuantity,
          remainingForReturn,
        };
      });

      const canInitiateReturn =
        sale.status === 'completed' &&
        items.some(
          (i) => Number.isInteger(i.quantity) && i.remainingForReturn > 0,
        );

      return {
        id: sale.id,
        code: sale.code,
        createdAt: sale.createdAt,
        status: sale.status,
        subtotal: Number(sale.subtotal || 0),
        discount: Number(sale.discount || 0),
        total: Number(sale.total || 0),
        operatorName: sale.operator?.name || null,
        canInitiateReturn,
        payments: (sale.payments || []).map((p) => ({
          id: p.id,
          method: p.method,
          label:
            p.label ||
            PAYMENT_LABELS[(p.method || '').toLowerCase()] ||
            p.method,
          value: Number(p.value || 0),
          troco: Number(p.troco || 0),
        })),
        items,
      };
    });

    const formattedReturns = returns.map((ret) => ({
      id: ret.id,
      saleId: ret.saleId,
      saleCode: ret.sale?.code || null,
      reason: ret.reason,
      total: Number(ret.total || 0),
      creditBalance: Number(ret.credit?.balance || 0),
      createdAt: ret.createdAt,
      items: (ret.items || []).map((ri) => ({
        id: ri.id,
        saleItemId: ri.saleItemId,
        productName: ri.saleItem?.productName || 'Mercadoria',
        quantity: ri.quantity,
        restock: ri.restock,
        value: Number(ri.value || 0),
      })),
    }));

    const formattedCredits = credits.map((credit) => ({
      id: credit.id,
      returnId: credit.returnId,
      saleCode: credit.retailReturn?.sale?.code || null,
      saleId: credit.retailReturn?.saleId || null,
      reason: credit.retailReturn?.reason || null,
      amount: Number(credit.amount || 0),
      balance: Number(credit.balance || 0),
      createdAt: credit.createdAt,
      uses: (credit.uses || []).map((u) => ({
        id: u.id,
        saleId: u.saleId,
        saleCode: u.sale?.code || null,
        amount: Number(u.amount || 0),
        reversedAt: u.reversedAt,
        createdAt: u.createdAt,
      })),
    }));

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        cpfCnpj: customer.cpfCnpj || null,
        address: customer.address || null,
        reference: customer.reference || null,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      metrics: {
        purchasesCount,
        totalPieces: Number(totalPieces.toFixed(3)),
        totalSpent,
        totalReturned,
        netSpent,
        avgTicket,
        firstPurchaseAt: earliestSaleDate
          ? earliestSaleDate.toISOString()
          : null,
        lastPurchaseAt: latestSaleDate ? latestSaleDate.toISOString() : null,
        daysSinceLastPurchase,
        avgDaysBetweenPurchases,
        totalCreditIssued,
        creditBalance,
        totalCreditUsed,
        segment,
        isVip,
        isInactive,
      },
      dna: {
        topSizes: topEntries(sizesMap, 6),
        topColors: topEntries(colorsMap, 6),
        topCategories: topEntries(categoriesMap, 5),
        topGroups: [...groupsMap.values()]
          .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
          .slice(0, 6),
        paymentMethods: [...paymentsMap.values()].sort(
          (a, b) => b.total - a.total || b.count - a.count,
        ),
        operators: [...operatorsMap.values()].sort(
          (a, b) => b.count - a.count,
        ),
      },
      sales: formattedSales,
      returns: formattedReturns,
      credits: formattedCredits,
    };
  }
}
