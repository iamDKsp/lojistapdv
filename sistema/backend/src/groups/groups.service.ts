import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { ProductsService } from '../products/products.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client');

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private heartPrisma: HeartPrismaService,
    private productsService: ProductsService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Creates a Prisma client connected to a specific tenant database */
  private createTenantClient(databaseUrl: string) {
    return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  }

  /** Fetches a group and validates it exists, includes members+tenant */
  private async getGroupWithMembers(groupId: string) {
    const group = await this.heartPrisma.tenantGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { tenant: true },
        },
      },
    });
    if (!group) throw new NotFoundException(`Grupo ${groupId} não encontrado`);
    return group;
  }

  // ── Group CRUD ─────────────────────────────────────────────────────────────

  async listGroups() {
    return this.heartPrisma.tenantGroup.findMany({
      include: {
        members: {
          include: { tenant: { select: { id: true, name: true, nomeFantasia: true, razaoSocial: true, status: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createGroup(name: string) {
    if (!name?.trim()) throw new BadRequestException('Nome do grupo é obrigatório');
    return this.heartPrisma.tenantGroup.create({ data: { name: name.trim() } });
  }

  async deleteGroup(groupId: string) {
    await this.getGroupWithMembers(groupId);
    await this.heartPrisma.tenantGroup.delete({ where: { id: groupId } });
    return { success: true };
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async addMember(groupId: string, tenantId: string, alias?: string) {
    await this.getGroupWithMembers(groupId);
    const tenant = await this.heartPrisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    return this.heartPrisma.tenantGroupMember.upsert({
      where: { groupId_tenantId: { groupId, tenantId } },
      update: { alias: alias ?? null },
      create: { groupId, tenantId, alias: alias ?? null },
    });
  }

  async removeMember(groupId: string, tenantId: string) {
    await this.heartPrisma.tenantGroupMember.deleteMany({ where: { groupId, tenantId } });
    return { success: true };
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(groupId: string, startDate?: string, endDate?: string) {
    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];
    const salesByDateMap = new Map<string, number>();
    const salesByHourMap = new Map<string, number>();
    const salesByDayOfWeekMap = new Map<string, number>();
    const salesByWeekMap = new Map<string, number>();
    const salesByMonthMap = new Map<string, number>();
    const paymentsMap = new Map<string, number>();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    if (endDate) {
      end.setHours(23, 59, 59, 999);
    }

    for (const member of group.members) {
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const [salesTodayAgg, salesPeriodAgg, salesPeriodCount, topProducts, dailySales, paymentsData] = await Promise.all([
          client.sale.aggregate({
            where: { createdAt: { gte: today }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
            _sum: { total: true },
          }),
          client.sale.aggregate({
            where: { createdAt: { gte: start, lte: end }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
            _sum: { total: true },
          }),
          client.sale.count({
            where: { createdAt: { gte: start, lte: end }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
          }),
          client.saleItem.groupBy({
            by: ['productId'],
            where: { sale: { createdAt: { gte: start, lte: end }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] } },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 15,
          }),
          client.sale.findMany({
            where: { createdAt: { gte: start, lte: end }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] },
            select: { createdAt: true, total: true },
          }),
          client.payment.groupBy({
            by: ['method'],
            where: { sale: { createdAt: { gte: start, lte: end }, NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }] } },
            _sum: { value: true },
          }),
        ]);

        // Aggregate daily and hourly sales
        const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        for (const sale of dailySales) {
          const dt = sale.createdAt;
          const dStr = dt.toISOString().split('T')[0];
          const hourStr = dt.getHours().toString() + 'h';
          const dayOfWeekStr = DIAS_SEMANA[dt.getDay()];
          const startOfWeek = new Date(dt);
          startOfWeek.setDate(dt.getDate() - dt.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          const fmtDt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}`;
          const weekStr = `${fmtDt(startOfWeek)} a ${fmtDt(endOfWeek)}`;
          const monthStr = MESES[dt.getMonth()];
          
          const val = Number(sale.total);
          salesByDateMap.set(dStr, (salesByDateMap.get(dStr) || 0) + val);
          salesByHourMap.set(hourStr, (salesByHourMap.get(hourStr) || 0) + val);
          salesByDayOfWeekMap.set(dayOfWeekStr, (salesByDayOfWeekMap.get(dayOfWeekStr) || 0) + val);
          salesByWeekMap.set(weekStr, (salesByWeekMap.get(weekStr) || 0) + val);
          salesByMonthMap.set(monthStr, (salesByMonthMap.get(monthStr) || 0) + val);
        }

        // Aggregate payments
        const tenantPaymentMethods = await client.tenantPaymentMethod.findMany({
          select: { id: true, name: true }
        });
        const paymentMethodNames = new Map(tenantPaymentMethods.map((t: any) => [t.id, t.name]));

        for (const p of paymentsData) {
          let method = p.method || 'outros';
          
          if (paymentMethodNames.has(method)) {
            method = paymentMethodNames.get(method)!;
          } else {
            // map common types
            if (method === 'credit') method = 'Cartão de Crédito';
            else if (method === 'debit') method = 'Cartão de Débito';
            else if (method === 'pix') method = 'Pix';
            else if (method === 'cash') method = 'Dinheiro';
            else method = method.charAt(0).toUpperCase() + method.slice(1);
          }
          
          const val = Number(p._sum.value ?? 0);
          paymentsMap.set(method, (paymentsMap.get(method) || 0) + val);
        }

        const productIds = topProducts.map((p: any) => p.productId);
        const products = await client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, imageUrl: true },
        });
        const productMap = new Map<string, { name: string; imageUrl: string | null }>(products.map((p: any) => [p.id, { name: p.name, imageUrl: p.imageUrl }]));

        results.push({
          tenantId: member.tenantId,
          alias: member.alias ?? member.tenant.nomeFantasia ?? member.tenant.name,
          salesToday: Number(salesTodayAgg._sum.total ?? 0),
          salesMonth: Number(salesPeriodAgg._sum.total ?? 0),
          countToday: salesPeriodCount,
          topProducts: topProducts.map((p: any) => {
            const prodData = productMap.get(p.productId) || { name: 'Desconhecido', imageUrl: null };
            return {
              productId: p.productId,
              name: prodData.name,
              imageUrl: prodData.imageUrl,
              totalQty: Number(p._sum.quantity ?? 0),
            };
          }),
        });
      } catch (err: any) {
        this.logger.warn(`Dashboard erro tenant ${member.tenantId}: ${err.message}`);
        results.push({
          tenantId: member.tenantId,
          alias: member.alias ?? member.tenant.nomeFantasia ?? member.tenant.name,
          error: err.message,
          salesToday: 0,
          salesMonth: 0,
          countToday: 0,
          topProducts: [],
        });
      } finally {
        await client.$disconnect();
      }
    }

    const salesByDate = Array.from(salesByDateMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Sort Hours numerically: 0h, 1h, ... 23h
    const sortedHours = Array.from(salesByHourMap.keys()).sort((a, b) => parseInt(a) - parseInt(b));
    const salesByHour = sortedHours.map(h => ({ hour: h, total: salesByHourMap.get(h)! }));

    // Sort Days of Week naturally
    const orderDay = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const sortedDaysOfWeek = Array.from(salesByDayOfWeekMap.keys()).sort((a, b) => orderDay.indexOf(a) - orderDay.indexOf(b));
    const salesByDayOfWeek = sortedDaysOfWeek.map(d => ({ name: d, total: salesByDayOfWeekMap.get(d)! }));

    // Sort Weeks naturally
    const sortedWeeks = Array.from(salesByWeekMap.keys()).sort();
    const salesByWeek = sortedWeeks.map(w => ({ name: w, total: salesByWeekMap.get(w)! }));

    // Sort Months naturally
    const orderMonth = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const sortedMonths = Array.from(salesByMonthMap.keys()).sort((a, b) => orderMonth.indexOf(a) - orderMonth.indexOf(b));
    const salesByMonth = sortedMonths.map(m => ({ name: m, total: salesByMonthMap.get(m)! }));

    const payments = Array.from(paymentsMap.keys()).map(m => ({ method: m, total: paymentsMap.get(m)! }));

    return {
      groupId,
      groupName: group.name,
      tenants: results,
      salesByDate,
      salesByHour,
      salesByDayOfWeek,
      salesByWeek,
      salesByMonth,
      payments,
    };
  }

  // ── Stock ──────────────────────────────────────────────────────────────────

  async getConsolidatedStock(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    // Map: productName -> { tenantId -> qty }
    const stockMap: Record<string, Record<string, any>> = {};
    const tenantLabels: Record<string, string> = {};

    for (const member of group.members) {
      const label = member.alias ?? member.tenant.nomeFantasia ?? member.tenant.name;
      tenantLabels[member.tenantId] = label;
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const products = await client.product.findMany({
          select: { id: true, name: true, stock: true, unit: true },
          where: { active: true },
        });
        for (const p of products) {
          if (!stockMap[p.name]) stockMap[p.name] = {};
          stockMap[p.name][member.tenantId] = { qty: Number(p.stock ?? 0), productId: p.id, unit: p.unit };
        }
      } catch (err: any) {
        this.logger.warn(`Stock erro tenant ${member.tenantId}: ${err.message}`);
      } finally {
        await client.$disconnect();
      }
    }

    const rows = Object.entries(stockMap).map(([name, tenants]) => ({ name, tenants }));
    return { groupId, groupName: group.name, tenantLabels, rows };
  }

  async stockEntry(
    groupId: string,
    body: { tenantId: string; productId: string; quantity: number; costPrice?: number },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const member = group.members.find((m) => m.tenantId === body.tenantId);
    if (!member) throw new NotFoundException('Tenant não faz parte deste grupo');

    const client = this.createTenantClient(member.tenant.databaseUrl);
    try {
      const product = await client.product.findUnique({ where: { id: body.productId } });
      if (!product) throw new NotFoundException('Produto não encontrado no tenant');

      const newStock = Number(product.stock ?? 0) + Number(body.quantity);
      await client.product.update({
        where: { id: body.productId },
        data: { stock: newStock },
      });
      await client.inventoryLog.create({
        data: {
          productId: body.productId,
          type: 'entry',
          quantity: Number(body.quantity),
          costPrice: body.costPrice ? Number(body.costPrice) : null,
          notes: 'Entrada via portal grupo multiempresa',
        },
      });
      return { success: true, newStock };
    } finally {
      await client.$disconnect();
    }
  }

  async stockTransfer(
    groupId: string,
    body: { fromTenantId: string; toTenantId: string; productId: string; quantity: number },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const fromMember = group.members.find((m) => m.tenantId === body.fromTenantId);
    const toMember = group.members.find((m) => m.tenantId === body.toTenantId);
    if (!fromMember) throw new NotFoundException('Tenant de origem não faz parte deste grupo');
    if (!toMember) throw new NotFoundException('Tenant de destino não faz parte deste grupo');

    const fromClient = this.createTenantClient(fromMember.tenant.databaseUrl);
    const toClient = this.createTenantClient(toMember.tenant.databaseUrl);

    try {
      const fromProduct = await fromClient.product.findUnique({ where: { id: body.productId } });
      if (!fromProduct) throw new NotFoundException('Produto não encontrado no tenant de origem');
      if (Number(fromProduct.stock ?? 0) < body.quantity) {
        throw new BadRequestException('Estoque insuficiente para transferência');
      }

      // ── ORIGEM: consumir lotes FIFO ──────────────────────────────────────
      const fromLots = await fromClient.stockLot.findMany({
        where: { productId: body.productId, remaining: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      });

      let remaining = body.quantity;
      for (const lot of fromLots) {
        if (remaining <= 0) break;
        const lotRemaining = Number(lot.remaining);
        const deduct = Math.min(lotRemaining, remaining);
        await fromClient.stockLot.update({
          where: { id: lot.id },
          data: { remaining: lotRemaining - deduct },
        });
        remaining -= deduct;
      }

      // Recalcular stock do produto de origem pela soma dos lotes
      const updatedFromLots = await fromClient.stockLot.findMany({
        where: { productId: body.productId },
      });
      const fromTotal = updatedFromLots.reduce(
        (s: number, l: any) => s + Math.max(0, Number(l.remaining)), 0,
      );
      await fromClient.product.update({
        where: { id: body.productId },
        data: { stock: fromTotal },
      });

      await fromClient.inventoryLog.create({
        data: {
          productId: body.productId,
          type: 'transfer_out',
          quantity: -body.quantity,
          notes: `Transferência para tenant ${body.toTenantId}`,
        },
      });

      // ── DESTINO: criar lote + sync ───────────────────────────────────────
      const toProduct = await toClient.product.findFirst({ where: { name: fromProduct.name } });
      if (toProduct) {
        await toClient.stockLot.create({
          data: {
            productId: toProduct.id,
            costPrice: fromProduct.priceCost,
            quantity: body.quantity,
            remaining: body.quantity,
            lotNumber: `TRANSF-${new Date().toISOString().slice(0, 10)}`,
          },
        });

        // Recalcular stock do produto destino pela soma dos lotes
        const updatedToLots = await toClient.stockLot.findMany({
          where: { productId: toProduct.id },
        });
        const toTotal = updatedToLots.reduce(
          (s: number, l: any) => s + Math.max(0, Number(l.remaining)), 0,
        );
        await toClient.product.update({
          where: { id: toProduct.id },
          data: { stock: toTotal },
        });

        await toClient.inventoryLog.create({
          data: {
            productId: toProduct.id,
            type: 'transfer_in',
            quantity: body.quantity,
            notes: `Recebimento de transferência do tenant ${body.fromTenantId}`,
          },
        });
      }

      return { success: true, fromNewStock: fromTotal };
    } finally {
      await fromClient.$disconnect();
      await toClient.$disconnect();
    }
  }

  // ── Products ───────────────────────────────────────────────────────────────

  async getGroupProducts(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const allProducts: any[] = [];

    for (const member of group.members) {
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const products = await client.product.findMany({
          where: { active: true },
          select: { id: true, name: true, priceSell: true, priceCost: true, unit: true, stock: true },
        });
        for (const p of products) {
          allProducts.push({
            ...p,
            priceSell: Number(p.priceSell ?? 0),
            priceCost: Number(p.priceCost ?? 0),
            stock: Number(p.stock ?? 0),
            tenantId: member.tenantId,
            tenantAlias: member.alias ?? member.tenant.nomeFantasia ?? member.tenant.name,
          });
        }
      } catch (err: any) {
        this.logger.warn(`Products erro tenant ${member.tenantId}: ${err.message}`);
      } finally {
        await client.$disconnect();
      }
    }

    return { groupId, groupName: group.name, products: allProducts };
  }

  async createProductAllTenants(
    groupId: string,
    body: { name: string; priceSell: number; priceCost: number; unit: string; categoryName: string },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];

    for (const member of group.members) {
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        // Find or create category
        let category = await client.category.findFirst({ where: { name: body.categoryName } });
        if (!category) {
          category = await client.category.create({ data: { name: body.categoryName } });
        }

        const product = await client.product.upsert({
          where: { name: body.name } as any,
          update: { priceSell: body.priceSell, priceCost: body.priceCost, unit: body.unit },
          create: {
            name: body.name,
            priceSell: body.priceSell,
            priceCost: body.priceCost,
            unit: body.unit,
            categoryId: category.id,
            stock: 0,
          },
        });

        results.push({ tenantId: member.tenantId, success: true, productId: product.id });
      } catch (err: any) {
        this.logger.warn(`CreateProduct erro tenant ${member.tenantId}: ${err.message}`);
        results.push({ tenantId: member.tenantId, success: false, error: err.message });
      } finally {
        await client.$disconnect();
      }
    }

    return { groupId, results };
  }

  async updatePriceAllTenants(
    groupId: string,
    body: { productName: string; priceSell: number },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];

    for (const member of group.members) {
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const updated = await client.product.updateMany({
          where: { name: body.productName },
          data: { priceSell: body.priceSell },
        });
        results.push({ tenantId: member.tenantId, success: true, updatedCount: updated.count });
      } catch (err: any) {
        this.logger.warn(`UpdatePrice erro tenant ${member.tenantId}: ${err.message}`);
        results.push({ tenantId: member.tenantId, success: false, error: err.message });
      } finally {
        await client.$disconnect();
      }
    }

    return { groupId, results };
  }

  // ── Group Owner User Management ────────────────────────────────────────────

  async createGroupOwnerUser(
    groupId: string,
    body: { name: string; email: string; password: string },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    if (!group.members.length) throw new BadRequestException('Grupo sem empresas vinculadas');

    // Usa o primeiro tenant do grupo como "tenant de hospedagem" do usuário
    const hostTenantId = group.members[0].tenantId;

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await this.heartPrisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: 'group_owner',
        tenantId: hostTenantId,
        groupId,
      },
      select: { id: true, name: true, email: true, role: true, groupId: true, createdAt: true },
    });

    return user;
  }

  async getGroupUsers(groupId: string) {
    await this.getGroupWithMembers(groupId);
    return this.heartPrisma.user.findMany({
      where: { groupId },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
  }

  async deleteGroupUser(groupId: string, userId: string) {
    const user = await this.heartPrisma.user.findFirst({ where: { id: userId, groupId } });
    if (!user) throw new NotFoundException('Usuário não encontrado neste grupo');
    await this.heartPrisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  // ── Forecast ───────────────────────────────────────────────────────────────

  async getPurchaseForecast(groupId: string, daysToForecast: number = 15) {
    const group = await this.getGroupWithMembers(groupId);
    const productAgg = new Map<string, { name: string, totalStock: number, totalSold30d: number }>();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const member of group.members) {
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const [products, sales30d] = await Promise.all([
          client.product.findMany({ select: { id: true, name: true, stock: true }, where: { active: true } }),
          client.saleItem.groupBy({
            by: ['productId'],
            where: { sale: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'cancelled' } } },
            _sum: { quantity: true },
          })
        ]);

        const salesMap = new Map<string, number>(sales30d.map((s: any) => [s.productId, Number(s._sum.quantity ?? 0)]));

        for (const p of products) {
          const currentStock = Number(p.stock);
          const sold = salesMap.has(p.id) ? salesMap.get(p.id)! : 0;
          
          if (!productAgg.has(p.id)) {
            productAgg.set(p.id, { name: p.name, totalStock: 0, totalSold30d: 0 });
          }
          const agg = productAgg.get(p.id)!;
          agg.totalStock += currentStock;
          agg.totalSold30d += sold;
        }

      } catch (err: any) {
        this.logger.warn(`Forecast erro tenant ${member.tenantId}: ${err.message}`);
      } finally {
        await client.$disconnect();
      }
    }

    const forecast = Array.from(productAgg.entries()).map(([productId, data]) => {
      const avgDailySales = data.totalSold30d / 30;
      const autonomyDays = avgDailySales > 0 ? data.totalStock / avgDailySales : 999;
      
      const targetStock = avgDailySales * daysToForecast;
      const suggestion = targetStock - data.totalStock;

      return {
        productId,
        name: data.name,
        totalStock: data.totalStock,
        avgDailySales: Number(avgDailySales.toFixed(2)),
        autonomyDays: Number(autonomyDays.toFixed(1)),
        suggestion: suggestion > 0 ? Math.ceil(suggestion) : 0,
      };
    });

    forecast.sort((a, b) => b.suggestion - a.suggestion || a.autonomyDays - b.autonomyDays);

    return forecast;
  }

  // ── Tenant Detail (recent sales + critical stock) ─────────────────────────

  async getTenantDetail(groupId: string, tenantId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const member = group.members.find((m) => m.tenantId === tenantId);
    if (!member) throw new NotFoundException('Tenant não faz parte deste grupo');

    const client = this.createTenantClient(member.tenant.databaseUrl);
    try {
      const [recentSales, criticalStock] = await Promise.all([
        client.sale.findMany({
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            items: { include: { product: { select: { name: true } } }, take: 3 },
            payments: { select: { method: true, label: true, value: true } },
          },
        }),
        client.product.findMany({
          where: { active: true, stock: { lt: 3 } },
          select: { id: true, name: true, stock: true, unit: true },
          orderBy: { stock: 'asc' },
          take: 10,
        }),
      ]);

      return {
        tenantId,
        alias: member.alias ?? member.tenant.nomeFantasia ?? member.tenant.name,
        recentSales: recentSales.map((s) => ({
          id: s.id,
          total: Number(s.total),
          createdAt: s.createdAt,
          itemsCount: s.items.length,
          firstItems: s.items.slice(0, 3).map((i) => i.product?.name ?? 'Produto'),
          payments: s.payments.map((p) => ({
            method: p.method,
            label: p.label,
            value: Number(p.value),
          })),
        })),
        criticalStock: criticalStock.map((p) => ({
          id: p.id,
          name: p.name,
          stock: Number(p.stock),
          unit: p.unit,
        })),
      };
    } finally {
      await client.$disconnect();
    }
  }

  // ── Stock Adjust (direct quantity set) ───────────────────────────────────

  async stockAdjust(
    groupId: string,
    body: { tenantId: string; productId: string; newStock: number },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const member = group.members.find((m) => m.tenantId === body.tenantId);
    if (!member) throw new NotFoundException('Tenant não faz parte deste grupo');

    const client = this.createTenantClient(member.tenant.databaseUrl);
    try {
      const product = await client.product.findUnique({ where: { id: body.productId } });
      if (!product) throw new NotFoundException('Produto não encontrado');

      const diff = body.newStock - Number(product.stock ?? 0);
      await client.product.update({
        where: { id: body.productId },
        data: { stock: body.newStock },
      });

      // Registra no log de inventário
      try {
        await client.inventoryLog.create({
          data: {
            productId: body.productId,
            type: diff >= 0 ? 'IN' : 'OUT',
            quantity: Math.abs(diff),
            notes: 'Ajuste via Portal Grupo',
          },
        });
      } catch (logErr) {
        // Log silencioso — o ajuste de estoque já foi salvo
        this.logger.warn(`inventoryLog falhou para produto ${body.productId}: ${logErr}`);
      }

      // Invalida o cache do catálogo deste tenant para que a tela de estoque
      // mostre o valor atualizado imediatamente sem esperar os 10 min de TTL
      this.productsService.invalidateCache(body.tenantId);

      return { success: true, newStock: body.newStock };
    } finally {
      await client.$disconnect();
    }
  }

  // ── Products Catalog (consolidated with prices per tenant) ────────────────

  async getProductsCatalog(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    // Map: productName -> { tenantId -> { id, priceSell, priceCost, stock, unit, barcode, ncm } }
    const catalogMap: Record<string, Record<string, any>> = {};
    const tenantLabels: Record<string, string> = {};

    for (const member of group.members) {
      const label = member.alias ?? member.tenant.nomeFantasia ?? member.tenant.name;
      tenantLabels[member.tenantId] = label;
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const products = await client.product.findMany({
          where: { active: true },
          select: { id: true, name: true, priceSell: true, priceCost: true, stock: true, unit: true, barcode: true, ncm: true, imageUrl: true },
        });
        for (const p of products) {
          if (!catalogMap[p.name]) catalogMap[p.name] = {};
          catalogMap[p.name][member.tenantId] = {
            id: p.id,
            priceSell: Number(p.priceSell ?? 0),
            priceCost: Number(p.priceCost ?? 0),
            stock: Number(p.stock ?? 0),
            unit: p.unit,
            barcode: p.barcode,
            ncm: p.ncm,
            imageUrl: p.imageUrl,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Catalog erro tenant ${member.tenantId}: ${err.message}`);
      } finally {
        await client.$disconnect();
      }
    }

    const rows = Object.entries(catalogMap).map(([name, tenants]) => ({ name, tenants }));
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { groupId, groupName: group.name, tenantLabels, rows };
  }

  // ── Update price per tenant (individual or all) ───────────────────────────

  async updatePricePerTenant(
    groupId: string,
    body: { productName: string; updates: { tenantId: string; priceSell: number; priceCost?: number }[] },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];

    for (const update of body.updates) {
      const member = group.members.find((m) => m.tenantId === update.tenantId);
      if (!member) { results.push({ tenantId: update.tenantId, success: false, error: 'Tenant não no grupo' }); continue; }

      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const data: any = { priceSell: update.priceSell };
        if (update.priceCost !== undefined) data.priceCost = update.priceCost;
        const updated = await client.product.updateMany({ where: { name: body.productName }, data });
        results.push({ tenantId: update.tenantId, success: true, updatedCount: updated.count });
      } catch (err: any) {
        results.push({ tenantId: update.tenantId, success: false, error: err.message });
      } finally {
        await client.$disconnect();
      }
    }
    return { groupId, results };
  }

  // ── Create product in selected tenants ────────────────────────────────────

  async createProductInTenants(
    groupId: string,
    body: {
      name: string;
      barcode?: string;
      ncm?: string;
      unit: string;
      categoryName: string;
      priceCost: number;
      tenantPrices: { tenantId: string; priceSell: number }[];
    },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];

    for (const tp of body.tenantPrices) {
      const member = group.members.find((m) => m.tenantId === tp.tenantId);
      if (!member) { results.push({ tenantId: tp.tenantId, success: false, error: 'Tenant não no grupo' }); continue; }

      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        let category = await client.category.findFirst({ where: { name: body.categoryName } });
        if (!category) category = await client.category.create({ data: { name: body.categoryName } });

        const product = await client.product.upsert({
          where: { name: body.name } as any,
          update: { priceSell: tp.priceSell, priceCost: body.priceCost, unit: body.unit, ...(body.barcode ? { barcode: body.barcode } : {}), ...(body.ncm ? { ncm: body.ncm } : {}) },
          create: {
            name: body.name,
            priceSell: tp.priceSell,
            priceCost: body.priceCost,
            unit: body.unit,
            categoryId: category.id,
            stock: 0,
            ...(body.barcode ? { barcode: body.barcode } : {}),
            ...(body.ncm ? { ncm: body.ncm } : {}),
          },
        });
        results.push({ tenantId: tp.tenantId, success: true, productId: product.id });
      } catch (err: any) {
        results.push({ tenantId: tp.tenantId, success: false, error: err.message });
      } finally {
        await client.$disconnect();
      }
    }
    return { groupId, results };
  }

  // ── Sync Check: products present in some tenants but not others ───────────

  async getSyncStatus(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const tenantProductNames: Record<string, Set<string>> = {};
    const tenantLabels: Record<string, string> = {};
    const tenantData: Record<string, any[]> = {};
    const allTenantIds = group.members.map((m) => m.tenantId);

    for (const member of group.members) {
      const label = member.alias ?? member.tenant.nomeFantasia ?? member.tenant.name;
      tenantLabels[member.tenantId] = label;
      tenantProductNames[member.tenantId] = new Set();
      tenantData[member.tenantId] = [];
      const client = this.createTenantClient(member.tenant.databaseUrl);
      try {
        const products = await client.product.findMany({
          where: { active: true },
          select: { id: true, name: true, priceSell: true, priceCost: true, unit: true, barcode: true, ncm: true, imageUrl: true },
        });
        for (const p of products) {
          tenantProductNames[member.tenantId].add(p.name);
          tenantData[member.tenantId].push({ ...p, priceSell: Number(p.priceSell), priceCost: Number(p.priceCost) });
        }
      } catch (err: any) {
        this.logger.warn(`SyncCheck erro tenant ${member.tenantId}: ${err.message}`);
      } finally {
        await client.$disconnect();
      }
    }

    // Find products missing from at least one tenant
    const allNames = new Set<string>();
    for (const names of Object.values(tenantProductNames)) {
      for (const n of names) allNames.add(n);
    }

    const missingProducts: any[] = [];
    for (const name of allNames) {
      const presentIn: string[] = [];
      const missingIn: string[] = [];
      for (const tid of allTenantIds) {
        if (tenantProductNames[tid]?.has(name)) presentIn.push(tid);
        else missingIn.push(tid);
      }
      if (missingIn.length > 0) {
        // Get product data from the first tenant that has it
        const sourceTenantId = presentIn[0];
        const productData = tenantData[sourceTenantId]?.find((p) => p.name === name);
        missingProducts.push({ name, presentIn, missingIn, productData });
      }
    }

    return {
      groupId,
      tenantLabels,
      hasDifferences: missingProducts.length > 0,
      missingProducts,
    };
  }

  // ── Sync Products to missing tenants ─────────────────────────────────────

  async syncProductsToTenants(
    groupId: string,
    body: { products: { name: string; targetTenantIds: string[] }[] },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];

    for (const item of body.products) {
      // Find source data (from any tenant that has the product)
      let sourceData: any = null;
      let sourceCategoryName = 'Geral';

      for (const member of group.members) {
        if (item.targetTenantIds.includes(member.tenantId)) continue; // skip targets
        const client = this.createTenantClient(member.tenant.databaseUrl);
        try {
          const p = await client.product.findFirst({
            where: { name: item.name },
            include: { category: { select: { name: true } } },
          });
          if (p) {
            sourceData = p;
            sourceCategoryName = (p as any).category?.name ?? 'Geral';
            break;
          }
        } catch { } finally { await client.$disconnect(); }
      }

      if (!sourceData) { results.push({ name: item.name, success: false, error: 'Produto não encontrado em nenhuma loja origem' }); continue; }

      // Create in target tenants
      for (const targetTenantId of item.targetTenantIds) {
        const member = group.members.find((m) => m.tenantId === targetTenantId);
        if (!member) continue;
        const client = this.createTenantClient(member.tenant.databaseUrl);
        try {
          let category = await client.category.findFirst({ where: { name: sourceCategoryName } });
          if (!category) category = await client.category.create({ data: { name: sourceCategoryName } });
          await client.product.upsert({
            where: { name: item.name } as any,
            update: { priceSell: sourceData.priceSell, priceCost: sourceData.priceCost, unit: sourceData.unit },
            create: {
              name: item.name,
              priceSell: sourceData.priceSell,
              priceCost: sourceData.priceCost,
              unit: sourceData.unit,
              categoryId: category.id,
              stock: 0,
              ...(sourceData.barcode ? { barcode: sourceData.barcode } : {}),
              ...(sourceData.ncm ? { ncm: sourceData.ncm } : {}),
            },
          });
          results.push({ name: item.name, tenantId: targetTenantId, success: true });
        } catch (err: any) {
          results.push({ name: item.name, tenantId: targetTenantId, success: false, error: err.message });
        } finally {
          await client.$disconnect();
        }
      }
    }
    return { groupId, results };
  }
}
