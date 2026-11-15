import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Optional,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { ProductsService } from '../products/products.service';
import { EntityPhotoResolverService } from '../prisma/entity-photo-resolver.service';
import { getActiveReservedQuantities } from '../prisma/stock-reservations.helper';
import { retryTransaction } from '../prisma/transaction-retry';
import { lockProducts } from '../prisma/lock-products';
import { variantIdentity } from '../retail/retail.rules';
import { DEMO_DATABASE_NAME } from '../tenants/demo-store.seed';

const VALID_RETAIL_UNITS = new Set(['UN', 'PAR', 'CX', 'PCT', 'KIT']);

function normalizeRetailUnit(unit?: string | null): string {
  const upper = String(unit || 'UN').trim().toUpperCase();
  return VALID_RETAIL_UNITS.has(upper) ? upper : 'UN';
}

function parseDimensionList(
  raw: string[] | string | undefined | null,
  fallback: string,
): string[] {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;|]+/)
      : [];
  const cleaned = items
    .map((v) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 40))
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of cleaned) {
    const key = item.toLocaleUpperCase('pt-BR');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.length > 0 ? unique.slice(0, 24) : [fallback];
}

function normalizeCatalogKey(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function classifyPaymentMethodLabel(
  rawMethod: string | null | undefined,
  customNames: Map<string, string>,
): string {
  const raw = String(rawMethod || 'outros').trim();
  if (customNames.has(raw)) {
    return customNames.get(raw)!;
  }
  const lower = raw.toLowerCase();
  if (lower.includes('crediario') || lower.includes('fiado')) {
    return 'Crediário (Fiado)';
  }
  if (lower === 'credito_loja' || lower.includes('vale') || lower.includes('troca')) {
    return 'Crédito da Loja';
  }
  if (lower === 'pix' || lower.includes('pix')) {
    return 'Pix';
  }
  if (lower === 'dinheiro' || lower === 'cash' || lower.includes('dinheiro')) {
    return 'Dinheiro';
  }
  if (lower === 'debito' || lower === 'debit' || lower.includes('deb')) {
    return 'Cartão de Débito';
  }
  if (lower === 'credito' || lower === 'credit' || lower.includes('cred')) {
    return 'Cartão de Crédito';
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private heartPrisma: HeartPrismaService,
    private productsService: ProductsService,
    @Optional() private tenantManager?: TenantConnectionManager,
    @Optional() private tenantContext?: TenantContextService,
    @Optional() private jwtService?: JwtService,
    @Optional() private photoResolver?: EntityPhotoResolverService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async withTenantClient<T>(
    tenantId: string,
    databaseUrl: string,
    fn: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    if (this.tenantManager?.getTenantClient) {
      const pooled = await this.tenantManager.getTenantClient(
        tenantId,
        databaseUrl,
      );
      return fn(pooled);
    }
    const ephemeral = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    try {
      return await fn(ephemeral);
    } finally {
      await ephemeral.$disconnect();
    }
  }

  private async safeLockProducts(
    tx: Prisma.TransactionClient,
    productIds: string[],
  ) {
    if (!productIds.length) return;
    if (typeof (tx as any).$queryRaw === 'function') {
      await lockProducts(tx, productIds);
    }
  }

  /** Fetches a group and validates it exists, includes members+tenant */
  private async getGroupWithMembers(groupId: string) {
    const group = await this.heartPrisma.tenantGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { tenant: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException(`Grupo ${groupId} não encontrado`);
    return group;
  }

  /**
   * Inicializa de forma idempotente um TenantGroup para uma loja cujo módulo
   * `multiEmpresa` esteja habilitado (ou seja a Loja Demonstração), evitando
   * falha 401/403 ao abrir "Rede Multi-Lojas" pela primeira vez.
   */
  private async ensureAutoGroupForTenantIfEligible(
    tenantId: string,
  ): Promise<string | null> {
    if (!tenantId || !this.heartPrisma?.tenant?.findUnique) return null;

    const tenant = await this.heartPrisma.tenant
      .findUnique({ where: { id: tenantId } })
      .catch(() => null);
    if (!tenant) return null;

    let modules: Record<string, any> = {};
    try {
      modules =
        typeof tenant.modulos === 'string'
          ? JSON.parse(tenant.modulos)
          : (tenant.modulos as any) || {};
    } catch {
      modules = {};
    }

    const isEligible =
      modules.multiEmpresa === true ||
      tenant.databaseName === DEMO_DATABASE_NAME;
    if (!isEligible) return null;

    if (
      typeof (this.heartPrisma as any).ensureHeartColumnsAndTables === 'function'
    ) {
      await (this.heartPrisma as any)
        .ensureHeartColumnsAndTables()
        .catch(() => {});
    }

    const existing = await this.heartPrisma.tenantGroupMember
      .findFirst({
        where: { tenantId: tenant.id },
        orderBy: { id: 'desc' },
        select: { groupId: true },
      })
      .catch(() => null);
    if (existing?.groupId) return existing.groupId;

    const storeLabel = (
      tenant.nomeFantasia ||
      tenant.name ||
      'Matriz'
    ).trim();
    const defaultGroupName = storeLabel.toLowerCase().startsWith('rede ')
      ? storeLabel
      : `Rede ${storeLabel}`;

    try {
      const created = await this.heartPrisma.tenantGroup.create({
        data: { name: defaultGroupName },
      });
      await this.heartPrisma.tenantGroupMember.upsert({
        where: {
          groupId_tenantId: { groupId: created.id, tenantId: tenant.id },
        },
        update: {},
        create: {
          groupId: created.id,
          tenantId: tenant.id,
          alias: storeLabel,
        },
      });
      return created.id;
    } catch (err: any) {
      this.logger.warn(
        `Aviso ao criar grupo automático para tenant ${tenant.id}: ${err.message}`,
      );
      const fallback = await this.heartPrisma.tenantGroupMember
        .findFirst({
          where: { tenantId: tenant.id },
          orderBy: { id: 'desc' },
          select: { groupId: true },
        })
        .catch(() => null);
      return fallback?.groupId ?? null;
    }
  }

  /**
   * Remove grupos órfãos sem lojas vinculadas nem proprietários dedicados.
   */
  private async cleanupEmptyOrphanGroup(groupId: string) {
    if (!groupId) return;
    try {
      const group = await this.heartPrisma.tenantGroup.findUnique({
        where: { id: groupId },
        include: {
          _count: { select: { members: true, users: true } },
        },
      });
      if (
        group &&
        (group as any)._count?.members === 0 &&
        (group as any)._count?.users === 0
      ) {
        await this.heartPrisma.tenantGroup.delete({ where: { id: groupId } });
      }
    } catch {
      // ignore cleanup failures
    }
  }

  /**
   * Resolve automaticamente o groupId a partir do vínculo ativo da loja
   * (`tenant_group_members`), do `groupId` do usuário ou inicializa sob demanda
   * quando `modulos.multiEmpresa` está ativo na loja.
   */
  async resolveUserGroupId(user: any): Promise<string> {
    if (!user || !['admin', 'superadmin', 'group_owner'].includes(user?.role)) {
      throw new ForbiddenException(
        'Apenas administradores da loja podem acessar o módulo Rede Multi-Lojas.',
      );
    }

    // 1. Prioriza o vínculo atual da loja no Heart (reflete mudanças imediatas no /sys-init ou vinculações)
    if (user?.tenantId && this.heartPrisma?.tenantGroupMember?.findFirst) {
      const membership = await this.heartPrisma.tenantGroupMember
        .findFirst({
          where: { tenantId: user.tenantId },
          orderBy: { id: 'desc' },
          select: { groupId: true },
        })
        .catch(() => null);
      if (membership?.groupId) {
        const exists = await this.heartPrisma.tenantGroup
          .findUnique({ where: { id: membership.groupId }, select: { id: true } })
          .catch(() => null);
        if (exists?.id) return exists.id;
      }
    }

    // 2. Fallback para groupId presente na sessão (ex.: group_owner)
    if (user?.groupId && this.heartPrisma?.tenantGroup?.findUnique) {
      const exists = await this.heartPrisma.tenantGroup
        .findUnique({ where: { id: user.groupId }, select: { id: true } })
        .catch(() => null);
      if (exists?.id) return exists.id;
    }

    // 3. Se a loja tem `modulos.multiEmpresa = true`, provisiona a rede inicial automaticamente
    if (user?.tenantId) {
      const autoGroupId = await this.ensureAutoGroupForTenantIfEligible(
        user.tenantId,
      );
      if (autoGroupId) return autoGroupId;
    }

    throw new ForbiddenException(
      'Esta loja ainda não está vinculada a uma rede multi-lojas. Ative o módulo Multi-Empresa ou vincule a loja no painel /sys-init.',
    );
  }

  /**
   * Retorna o contexto completo do grupo da loja/usuário logado.
   */
  async getMyGroupContext(user: any) {
    let groupId: string | null = null;
    try {
      groupId = await this.resolveUserGroupId(user);
    } catch {
      groupId = null;
    }

    if (!groupId) {
      return {
        hasGroup: false,
        groupId: null,
        groupName: null,
        currentTenantId: user?.tenantId ?? null,
        members: [],
      };
    }

    const group = await this.getGroupWithMembers(groupId);
    return {
      hasGroup: true,
      groupId: group.id,
      groupName: group.name,
      currentTenantId: user?.tenantId ?? null,
      members: group.members.map((m) => ({
        tenantId: m.tenantId,
        alias: m.alias || m.tenant.nomeFantasia || m.tenant.name,
        name: m.tenant.nomeFantasia || m.tenant.name,
        razaoSocial: m.tenant.razaoSocial || null,
        logoUrl: m.tenant.logoUrl || null,
        status: m.tenant.status,
        isCurrent: m.tenantId === user?.tenantId,
      })),
    };
  }

  /**
   * Troca instantaneamente a sessão ativa do administrador para outra loja do mesmo grupo,
   * sem exigir novo login ou senha.
   */
  async switchTenant(user: any, targetTenantId: string) {
    if (!targetTenantId?.trim()) {
      throw new BadRequestException('A loja de destino é obrigatória.');
    }
    if (!['admin', 'superadmin', 'group_owner'].includes(user?.role)) {
      throw new ForbiddenException(
        'Apenas administradores podem alternar entre lojas do grupo.',
      );
    }

    const groupId = await this.resolveUserGroupId(user);
    const group = await this.getGroupWithMembers(groupId);

    const targetMember = group.members.find(
      (m) => m.tenantId === targetTenantId,
    );
    if (!targetMember) {
      throw new ForbiddenException(
        'A loja selecionada não pertence ao seu grupo multiempresa.',
      );
    }

    if (
      targetMember.tenant.status === 'suspended' ||
      targetMember.tenant.status === 'inactive'
    ) {
      throw new BadRequestException(
        'O acesso da loja selecionada encontra-se suspenso ou inativo.',
      );
    }

    const targetAdmin = await this.heartPrisma.user
      .findFirst({
        where: { tenantId: targetTenantId, role: 'admin', active: true },
        orderBy: { createdAt: 'asc' },
      })
      .catch(() => null);

    const currentUser = user?.sub
      ? await this.heartPrisma.user
          .findUnique({ where: { id: user.sub } })
          .catch(() => null)
      : null;

    const effectiveUserId =
      targetAdmin?.id || currentUser?.id || user.sub || user.id;
    const effectiveEmail =
      targetAdmin?.email || currentUser?.email || user.email || '';
    const effectiveName =
      currentUser?.name || targetAdmin?.name || 'Gestor da Rede';
    const effectiveRole =
      user.role === 'superadmin' ? 'superadmin' : 'admin';

    if (!this.jwtService) {
      throw new BadRequestException('Serviço de autenticação indisponível.');
    }

    const payload = {
      sub: effectiveUserId,
      email: effectiveEmail,
      tenantId: targetMember.tenant.id,
      role: effectiveRole,
      groupId: group.id,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: effectiveUserId,
        email: effectiveEmail,
        name: effectiveName,
        imageUrl: currentUser?.imageUrl ?? targetAdmin?.imageUrl ?? null,
        role: effectiveRole,
        groupId: group.id,
        tenant: targetMember.tenant.id,
        tenantName:
          targetMember.alias ||
          targetMember.tenant.nomeFantasia ||
          targetMember.tenant.name,
        logoUrl: targetMember.tenant.logoUrl ?? null,
        termsAccepted: true,
      },
    };
  }

  /**
   * Permite ao proprietário vincular outra filial diretamente pelo painel Rede Multi-Lojas
   * autenticando o e-mail e senha de administrador da loja de destino.
   */
  async linkStoreByCredentials(
    user: any,
    body: { email: string; password: string; alias?: string },
  ) {
    if (!['admin', 'superadmin', 'group_owner'].includes(user?.role)) {
      throw new ForbiddenException(
        'Apenas administradores podem vincular filiais à rede.',
      );
    }

    const normalizedEmail = String(body?.email || '').trim().toLowerCase();
    const rawPassword = String(body?.password || '');
    if (!normalizedEmail || !rawPassword) {
      throw new BadRequestException(
        'Informe o e-mail e a senha de administrador da filial que deseja vincular.',
      );
    }

    const groupId = await this.resolveUserGroupId(user);
    const targetUser = await this.heartPrisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (
      !targetUser ||
      !(await bcrypt.compare(rawPassword, targetUser.password))
    ) {
      throw new BadRequestException(
        'Credenciais inválidas para a filial informada. Confira o e-mail e a senha do administrador.',
      );
    }

    if (!targetUser.active) {
      throw new BadRequestException(
        'O usuário informado está inativo na filial.',
      );
    }

    if (!['admin', 'superadmin', 'group_owner'].includes(targetUser.role)) {
      throw new ForbiddenException(
        'Use o login de um Administrador da filial para autorizar o vínculo com a rede.',
      );
    }

    if (
      !targetUser.tenant ||
      targetUser.tenant.status === 'suspended' ||
      targetUser.tenant.status === 'inactive'
    ) {
      throw new BadRequestException(
        'A filial informada encontra-se suspensa ou inativa.',
      );
    }

    await this.addMember(
      groupId,
      targetUser.tenantId,
      body?.alias?.trim() || undefined,
    );

    return this.getMyGroupContext(user);
  }

  /**
   * Atualiza o nome da rede e/ou os apelidos das unidades.
   */
  async updateMyGroupSettings(
    user: any,
    body: {
      name?: string;
      memberAliases?: { tenantId: string; alias: string }[];
    },
  ) {
    const groupId = await this.resolveUserGroupId(user);
    const group = await this.getGroupWithMembers(groupId);

    if (body?.name !== undefined) {
      const trimmed = String(body.name || '').trim();
      if (!trimmed || trimmed.length > 120) {
        throw new BadRequestException('Informe um nome válido para a rede.');
      }
      await this.heartPrisma.tenantGroup.update({
        where: { id: groupId },
        data: { name: trimmed },
      });
    }

    if (Array.isArray(body?.memberAliases)) {
      for (const item of body.memberAliases) {
        const exists = group.members.some((m) => m.tenantId === item.tenantId);
        if (!exists) continue;
        const cleanAlias = String(item.alias || '').trim().slice(0, 80) || null;
        await this.heartPrisma.tenantGroupMember.update({
          where: {
            groupId_tenantId: { groupId, tenantId: item.tenantId },
          },
          data: { alias: cleanAlias },
        });
      }
    }

    return this.getMyGroupContext(user);
  }

  /**
   * Desvincula uma filial da rede (protegendo a unidade ativa quando for a única).
   */
  async unlinkStoreFromMyGroup(user: any, targetTenantId: string) {
    const groupId = await this.resolveUserGroupId(user);
    const group = await this.getGroupWithMembers(groupId);

    if (!group.members.some((m) => m.tenantId === targetTenantId)) {
      throw new NotFoundException('Esta loja não faz parte da sua rede.');
    }

    if (group.members.length <= 1) {
      throw new BadRequestException(
        'A rede precisa manter pelo menos uma unidade vinculada.',
      );
    }

    if (targetTenantId === user?.tenantId) {
      throw new BadRequestException(
        'Alterne para outra loja da rede antes de desvincular a unidade em que você está conectado.',
      );
    }

    await this.removeMember(groupId, targetTenantId);
    return this.getMyGroupContext(user);
  }

  // ── Group CRUD (sys-init) ──────────────────────────────────────────────────

  async listGroups() {
    return this.heartPrisma.tenantGroup.findMany({
      include: {
        members: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                nomeFantasia: true,
                razaoSocial: true,
                status: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createGroup(name: string) {
    if (!name?.trim())
      throw new BadRequestException('Nome do grupo é obrigatório');
    return this.heartPrisma.tenantGroup.create({
      data: { name: name.trim().slice(0, 120) },
    });
  }

  async renameGroup(groupId: string, name: string) {
    if (!name?.trim()) {
      throw new BadRequestException('Nome do grupo é obrigatório');
    }
    await this.getGroupWithMembers(groupId);
    return this.heartPrisma.tenantGroup.update({
      where: { id: groupId },
      data: { name: name.trim().slice(0, 120) },
    });
  }

  async deleteGroup(groupId: string) {
    await this.getGroupWithMembers(groupId);
    await this.heartPrisma.tenantGroup.delete({ where: { id: groupId } });
    return { success: true };
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async addMember(groupId: string, tenantId: string, alias?: string) {
    await this.getGroupWithMembers(groupId);
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} não encontrado`);

    // Evita que um mesmo tenant fique duplicado em dois grupos distintos
    const previousMemberships = await this.heartPrisma.tenantGroupMember
      .findMany({
        where: { tenantId, groupId: { not: groupId } },
        select: { groupId: true },
      })
      .catch(() => []);

    if (previousMemberships.length > 0) {
      await this.heartPrisma.tenantGroupMember.deleteMany({
        where: { tenantId, groupId: { not: groupId } },
      });
      for (const prev of previousMemberships) {
        await this.cleanupEmptyOrphanGroup(prev.groupId);
      }
    }

    // Garante que o módulo multiEmpresa fique habilitado no tenant vinculado
    try {
      const currentMods =
        typeof tenant.modulos === 'string'
          ? JSON.parse(tenant.modulos)
          : (tenant.modulos as any) || {};
      if (!currentMods.multiEmpresa) {
        await this.heartPrisma.tenant.update({
          where: { id: tenantId },
          data: { modulos: { ...currentMods, multiEmpresa: true } },
        });
        this.tenantContext?.evictTenantCache(tenantId);
      }
    } catch {
      // ignore module sync failure
    }

    const cleanAlias = alias?.trim()
      ? alias.trim().slice(0, 80)
      : tenant.nomeFantasia || tenant.name || null;

    return this.heartPrisma.tenantGroupMember.upsert({
      where: { groupId_tenantId: { groupId, tenantId } },
      update: { ...(alias !== undefined ? { alias: cleanAlias } : {}) },
      create: { groupId, tenantId, alias: cleanAlias },
    });
  }

  async removeMember(groupId: string, tenantId: string) {
    await this.heartPrisma.tenantGroupMember.deleteMany({
      where: { groupId, tenantId },
    });
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

    const start = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    if (endDate && !endDate.includes('T')) {
      end.setHours(23, 59, 59, 999);
    }

    const DIAS_SEMANA = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ];
    const MESES = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    for (const member of group.members) {
      const aliasLabel =
        member.alias || member.tenant.nomeFantasia || member.tenant.name;
      try {
        await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            const [
              salesTodayAgg,
              salesPeriodAgg,
              salesPeriodCount,
              topProducts,
              dailySales,
              paymentsData,
              tenantPaymentMethods,
            ] = await Promise.all([
              client.sale.aggregate({
                where: {
                  createdAt: { gte: today },
                  NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
                },
                _sum: { total: true },
              }),
              client.sale.aggregate({
                where: {
                  createdAt: { gte: start, lte: end },
                  NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
                },
                _sum: { total: true },
              }),
              client.sale.count({
                where: {
                  createdAt: { gte: start, lte: end },
                  NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
                },
              }),
              client.saleItem.groupBy({
                by: ['productId'],
                where: {
                  sale: {
                    createdAt: { gte: start, lte: end },
                    NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
                  },
                },
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: 'desc' } },
                take: 25,
              }),
              client.sale.findMany({
                where: {
                  createdAt: { gte: start, lte: end },
                  NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
                },
                select: { createdAt: true, total: true },
              }),
              client.payment.groupBy({
                by: ['method'],
                where: {
                  sale: {
                    createdAt: { gte: start, lte: end },
                    NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
                  },
                },
                _sum: { value: true },
              }),
              client.tenantPaymentMethod
                .findMany({ select: { id: true, name: true } })
                .catch(() => []),
            ]);

            for (const sale of dailySales) {
              const dt = new Date(sale.createdAt);
              const dStr = dt.toISOString().split('T')[0];
              const hourStr = `${dt.getHours()}h`;
              const dayOfWeekStr = DIAS_SEMANA[dt.getDay()];
              const startOfWeek = new Date(dt);
              startOfWeek.setDate(dt.getDate() - dt.getDay());
              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(startOfWeek.getDate() + 6);
              const fmtDt = (d: Date) =>
                `${String(d.getDate()).padStart(2, '0')}/${String(
                  d.getMonth() + 1,
                ).padStart(2, '0')}`;
              const weekStr = `${fmtDt(startOfWeek)} a ${fmtDt(endOfWeek)}`;
              const monthStr = MESES[dt.getMonth()];

              const val = Number(sale.total);
              salesByDateMap.set(dStr, (salesByDateMap.get(dStr) || 0) + val);
              salesByHourMap.set(
                hourStr,
                (salesByHourMap.get(hourStr) || 0) + val,
              );
              salesByDayOfWeekMap.set(
                dayOfWeekStr,
                (salesByDayOfWeekMap.get(dayOfWeekStr) || 0) + val,
              );
              salesByWeekMap.set(
                weekStr,
                (salesByWeekMap.get(weekStr) || 0) + val,
              );
              salesByMonthMap.set(
                monthStr,
                (salesByMonthMap.get(monthStr) || 0) + val,
              );
            }

            const paymentMethodNames = new Map<string, string>(
              tenantPaymentMethods.map(
                (t: any): [string, string] => [String(t.id), String(t.name)],
              ),
            );
            for (const p of paymentsData) {
              const method = classifyPaymentMethodLabel(
                p.method,
                paymentMethodNames,
              );
              const val = Number(p._sum.value ?? 0);
              paymentsMap.set(method, (paymentsMap.get(method) || 0) + val);
            }

            const productIds = topProducts.map((p: any) => p.productId);
            const products = productIds.length
              ? await client.product.findMany({
                  where: { id: { in: productIds } },
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                    retailGroup: { select: { name: true, imageUrl: true } },
                  },
                })
              : [];
            const productMap = new Map<
              string,
              { name: string; imageUrl: string | null }
            >(
              products.map((p: any) => [
                p.id,
                {
                  name: p.retailGroup?.name || p.name,
                  imageUrl: p.imageUrl || p.retailGroup?.imageUrl || null,
                },
              ]),
            );

            // Consolida dentro da loja por nome do grupo/produto
            const storeTopMap = new Map<
              string,
              { name: string; imageUrl: string | null; totalQty: number }
            >();
            for (const tp of topProducts) {
              const info = productMap.get(tp.productId) || {
                name: 'Mercadoria',
                imageUrl: null,
              };
              const key = normalizeCatalogKey(info.name);
              const prev = storeTopMap.get(key) || {
                name: info.name,
                imageUrl: info.imageUrl,
                totalQty: 0,
              };
              prev.totalQty += Number(tp._sum.quantity ?? 0);
              if (!prev.imageUrl && info.imageUrl) prev.imageUrl = info.imageUrl;
              storeTopMap.set(key, prev);
            }

            results.push({
              tenantId: member.tenantId,
              alias: aliasLabel,
              logoUrl: member.tenant.logoUrl || null,
              salesToday: Number(salesTodayAgg._sum.total ?? 0),
              salesMonth: Number(salesPeriodAgg._sum.total ?? 0),
              countToday: salesPeriodCount,
              topProducts: Array.from(storeTopMap.entries())
                .map(([key, v]) => ({
                  productId: key,
                  name: v.name,
                  imageUrl: v.imageUrl,
                  totalQty: v.totalQty,
                }))
                .sort((a, b) => b.totalQty - a.totalQty)
                .slice(0, 15),
            });
          },
        );
      } catch (err: any) {
        this.logger.warn(
          `Dashboard erro tenant ${member.tenantId}: ${err.message}`,
        );
        results.push({
          tenantId: member.tenantId,
          alias: aliasLabel,
          logoUrl: member.tenant.logoUrl || null,
          error: err.message,
          salesToday: 0,
          salesMonth: 0,
          countToday: 0,
          topProducts: [],
        });
      }
    }

    const salesByDate = Array.from(salesByDateMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const sortedHours = Array.from(salesByHourMap.keys()).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    );
    const salesByHour = sortedHours.map((h) => ({
      hour: h,
      total: salesByHourMap.get(h)!,
    }));

    const sortedDaysOfWeek = Array.from(salesByDayOfWeekMap.keys()).sort(
      (a, b) => DIAS_SEMANA.indexOf(a) - DIAS_SEMANA.indexOf(b),
    );
    const salesByDayOfWeek = sortedDaysOfWeek.map((d) => ({
      name: d,
      total: salesByDayOfWeekMap.get(d)!,
    }));

    const sortedWeeks = Array.from(salesByWeekMap.keys()).sort();
    const salesByWeek = sortedWeeks.map((w) => ({
      name: w,
      total: salesByWeekMap.get(w)!,
    }));

    const sortedMonths = Array.from(salesByMonthMap.keys()).sort(
      (a, b) => MESES.indexOf(a) - MESES.indexOf(b),
    );
    const salesByMonth = sortedMonths.map((m) => ({
      name: m,
      total: salesByMonthMap.get(m)!,
    }));

    const payments = Array.from(paymentsMap.keys()).map((m) => ({
      method: m,
      total: paymentsMap.get(m)!,
    }));

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

  // ── Stock (cada variação tamanho/cor tem estoque próprio por loja) ─────────

  async getConsolidatedStock(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const stockMap = new Map<
      string,
      {
        name: string;
        groupName: string | null;
        size: string | null;
        color: string | null;
        categoryName: string | null;
        imageUrl: string | null;
        tenants: Record<string, any>;
      }
    >();
    const tenantLabels: Record<string, string> = {};

    for (const member of group.members) {
      const label =
        member.alias || member.tenant.nomeFantasia || member.tenant.name;
      tenantLabels[member.tenantId] = label;
      try {
        await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            const products = await client.product.findMany({
              where: {
                active: true,
                OR: [{ retailGroupId: null }, { retailGroup: { active: true } }],
              },
              select: {
                id: true,
                name: true,
                size: true,
                color: true,
                barcode: true,
                stock: true,
                unit: true,
                imageUrl: true,
                category: { select: { name: true } },
                retailGroup: { select: { name: true, imageUrl: true } },
              },
              orderBy: { name: 'asc' },
            });

            const reservedMap = await getActiveReservedQuantities(
              client,
              products.map((p) => p.id),
            ).catch(() => new Map());

            for (const p of products) {
              const displayName = p.name;
              const key = normalizeCatalogKey(displayName);
              const existing = stockMap.get(key) || {
                name: displayName,
                groupName: p.retailGroup?.name || null,
                size: p.size || null,
                color: p.color || null,
                categoryName: p.category?.name || null,
                imageUrl: p.imageUrl || p.retailGroup?.imageUrl || null,
                tenants: {},
              };
              if (!existing.imageUrl && (p.imageUrl || p.retailGroup?.imageUrl)) {
                existing.imageUrl = p.imageUrl || p.retailGroup?.imageUrl || null;
              }
              const qty = Number(p.stock ?? 0);
              const reservedQty = reservedMap.get(p.id)?.quantity ?? 0;
              existing.tenants[member.tenantId] = {
                qty,
                reservedQty,
                availableQty: Math.max(0, qty - reservedQty),
                productId: p.id,
                unit: p.unit || 'UN',
                barcode: p.barcode || null,
              };
              stockMap.set(key, existing);
            }
          },
        );
      } catch (err: any) {
        this.logger.warn(
          `Stock erro tenant ${member.tenantId}: ${err.message}`,
        );
      }
    }

    const rows = Array.from(stockMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    return { groupId, groupName: group.name, tenantLabels, rows };
  }

  async stockEntry(
    groupId: string,
    body: {
      tenantId: string;
      productId: string;
      quantity: number;
      costPrice?: number;
    },
  ) {
    const qtyToAdd = Number(body?.quantity);
    if (!Number.isFinite(qtyToAdd) || qtyToAdd <= 0) {
      throw new BadRequestException('Informe uma quantidade positiva.');
    }

    const group = await this.getGroupWithMembers(groupId);
    const member = group.members.find((m) => m.tenantId === body.tenantId);
    if (!member)
      throw new NotFoundException('Esta loja não faz parte do grupo.');

    const result = await this.withTenantClient(
      member.tenantId,
      member.tenant.databaseUrl,
      async (client) => {
        return retryTransaction(() =>
          client.$transaction(async (tx) => {
            await this.safeLockProducts(tx, [body.productId]);
            const product = await tx.product.findUnique({
              where: { id: body.productId },
            });
            if (!product) {
              throw new NotFoundException('Mercadoria não encontrada na loja.');
            }

            const effectiveCost =
              body.costPrice !== undefined && Number(body.costPrice) >= 0
                ? new Prisma.Decimal(Number(body.costPrice)).toDecimalPlaces(4)
                : product.priceCost;
            const newStock = Number(product.stock ?? 0) + qtyToAdd;

            await tx.stockLot.create({
              data: {
                productId: product.id,
                quantity: qtyToAdd,
                remaining: qtyToAdd,
                costPrice: effectiveCost,
                lotNumber: `REDE-ENT-${new Date().toISOString().slice(0, 10)}`,
              },
            });

            await tx.product.update({
              where: { id: product.id },
              data: { stock: newStock },
            });

            await tx.inventoryLog.create({
              data: {
                productId: product.id,
                type: 'IN',
                quantity: qtyToAdd,
                costPrice: effectiveCost,
                origin: 'MANUAL',
                reason: 'Entrada de estoque via Rede Multi-Lojas',
              },
            });

            return { success: true, newStock };
          }),
        );
      },
    );

    this.productsService.invalidateCache(body.tenantId);
    return result;
  }

  async stockAdjust(
    groupId: string,
    body: { tenantId: string; productId: string; newStock: number },
  ) {
    const targetStock = Number(body?.newStock);
    if (!Number.isFinite(targetStock) || targetStock < 0) {
      throw new BadRequestException(
        'O novo saldo de estoque deve ser zero ou positivo.',
      );
    }

    const group = await this.getGroupWithMembers(groupId);
    const member = group.members.find((m) => m.tenantId === body.tenantId);
    if (!member)
      throw new NotFoundException('Esta loja não faz parte do grupo.');

    const result = await this.withTenantClient(
      member.tenantId,
      member.tenant.databaseUrl,
      async (client) => {
        return retryTransaction(() =>
          client.$transaction(async (tx) => {
            await this.safeLockProducts(tx, [body.productId]);
            const product = await tx.product.findUnique({
              where: { id: body.productId },
            });
            if (!product)
              throw new NotFoundException('Mercadoria não encontrada na loja.');

            const reservedMap = await getActiveReservedQuantities(
              tx as any,
              [body.productId],
            ).catch(() => new Map());
            const reservedQty = reservedMap.get(body.productId)?.quantity ?? 0;
            if (targetStock < reservedQty) {
              throw new BadRequestException(
                `Não é possível ajustar abaixo de ${reservedQty} un. reservadas em pedidos da Loja Virtual.`,
              );
            }

            const currentStock = Number(product.stock ?? 0);
            const diff = Number((targetStock - currentStock).toFixed(3));
            if (Math.abs(diff) < 0.0005) {
              return { success: true, newStock: currentStock };
            }

            if (diff > 0) {
              await tx.stockLot.create({
                data: {
                  productId: product.id,
                  quantity: diff,
                  remaining: diff,
                  costPrice: product.priceCost,
                  lotNumber: `AJUSTE-REDE-${new Date().toISOString().slice(0, 10)}`,
                },
              });
            } else {
              let toDeduct = Math.abs(diff);
              const openLots = await tx.stockLot.findMany({
                where: { productId: product.id, remaining: { gt: 0 } },
                orderBy: { createdAt: 'asc' },
              });
              for (const lot of openLots) {
                if (toDeduct <= 0) break;
                const lotRem = Number(lot.remaining);
                const take = Math.min(lotRem, toDeduct);
                await tx.stockLot.update({
                  where: { id: lot.id },
                  data: { remaining: Number((lotRem - take).toFixed(3)) },
                });
                toDeduct = Number((toDeduct - take).toFixed(3));
              }
            }

            await tx.product.update({
              where: { id: product.id },
              data: { stock: targetStock },
            });

            await tx.inventoryLog.create({
              data: {
                productId: product.id,
                type: diff >= 0 ? 'IN' : 'OUT',
                quantity: Math.abs(diff),
                costPrice: product.priceCost,
                origin: 'AJUSTE',
                reason: 'Ajuste de saldo via Rede Multi-Lojas',
              },
            });

            return { success: true, newStock: targetStock };
          }),
        );
      },
    );

    this.productsService.invalidateCache(body.tenantId);
    return result;
  }

  /**
   * Transfere estoque entre duas filiais da rede com baixa FIFO na origem,
   * criação automática do grupo/variação no destino (caso ainda não exista),
   * idempotência via `requestKey` e compensação automática em caso de falha no destino.
   */
  async stockTransfer(
    groupId: string,
    body: {
      fromTenantId: string;
      toTenantId: string;
      productId: string;
      quantity: number;
      requestKey?: string;
    },
  ) {
    const qty = Number(body?.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException(
        'Informe uma quantidade válida para transferir.',
      );
    }
    if (!body?.fromTenantId || !body?.toTenantId) {
      throw new BadRequestException('Selecione as lojas de origem e destino.');
    }
    if (body.fromTenantId === body.toTenantId) {
      throw new BadRequestException(
        'A loja de origem e a loja de destino devem ser diferentes.',
      );
    }

    const group = await this.getGroupWithMembers(groupId);
    const fromMember = group.members.find(
      (m) => m.tenantId === body.fromTenantId,
    );
    const toMember = group.members.find((m) => m.tenantId === body.toTenantId);
    if (!fromMember)
      throw new NotFoundException('A loja de origem não pertence a esta rede.');
    if (!toMember)
      throw new NotFoundException('A loja de destino não pertence a esta rede.');

    const fromLabel =
      fromMember.alias ||
      fromMember.tenant.nomeFantasia ||
      fromMember.tenant.name;
    const toLabel =
      toMember.alias || toMember.tenant.nomeFantasia || toMember.tenant.name;
    const effectiveKey = body.requestKey?.trim()
      ? `TRF:${body.requestKey.trim().slice(0, 64)}`
      : `TRF:${randomUUID()}`;

    // 1. Baixa transacional com lock na loja de origem
    const originSnapshot = await this.withTenantClient(
      fromMember.tenantId,
      fromMember.tenant.databaseUrl,
      async (fromClient) => {
        return retryTransaction(() =>
          fromClient.$transaction(async (tx) => {
            await this.safeLockProducts(tx, [body.productId]);

            if (body.requestKey?.trim()) {
              const duplicateLog = await tx.inventoryLog.findFirst({
                where: { referenceKey: effectiveKey, type: 'OUT' },
              });
              if (duplicateLog) {
                const current = await tx.product.findUnique({
                  where: { id: body.productId },
                  include: { category: true, retailGroup: true },
                });
                return {
                  alreadyProcessed: true,
                  fromNewStock: Number(current?.stock ?? 0),
                  product: current!,
                  lotDeductions: [] as { id: string; deducted: number }[],
                  outLogId: duplicateLog.id,
                };
              }
            }

            const fromProduct = await tx.product.findUnique({
              where: { id: body.productId },
              include: { category: true, retailGroup: true },
            });
            if (!fromProduct) {
              throw new NotFoundException(
                'Mercadoria não encontrada na loja de origem.',
              );
            }

            const reservedMap = await getActiveReservedQuantities(
              tx as any,
              [body.productId],
            ).catch(() => new Map());
            const reservedQty = reservedMap.get(body.productId)?.quantity ?? 0;
            const currentStock = Number(fromProduct.stock ?? 0);
            if (currentStock - reservedQty < qty) {
              throw new BadRequestException(
                reservedQty > 0
                  ? `Estoque disponível insuficiente na origem (${reservedQty} un. reservadas na Loja Virtual).`
                  : 'Estoque insuficiente na loja de origem para realizar a transferência.',
              );
            }

            const fromLots = await tx.stockLot.findMany({
              where: { productId: body.productId, remaining: { gt: 0 } },
              orderBy: { createdAt: 'asc' },
            });

            let remainingToConsume = qty;
            const lotDeductions: { id: string; deducted: number }[] = [];
            for (const lot of fromLots) {
              if (remainingToConsume <= 0) break;
              const lotRemaining = Number(lot.remaining);
              const deduct = Math.min(lotRemaining, remainingToConsume);
              await tx.stockLot.update({
                where: { id: lot.id },
                data: { remaining: Number((lotRemaining - deduct).toFixed(3)) },
              });
              lotDeductions.push({ id: lot.id, deducted: deduct });
              remainingToConsume = Number(
                (remainingToConsume - deduct).toFixed(3),
              );
            }

            const fromNewStock = Number((currentStock - qty).toFixed(3));
            await tx.product.update({
              where: { id: body.productId },
              data: { stock: fromNewStock },
            });

            const outLog = await tx.inventoryLog.create({
              data: {
                productId: body.productId,
                type: 'OUT',
                quantity: qty,
                costPrice: fromProduct.priceCost,
                origin: 'AJUSTE',
                referenceKey: effectiveKey,
                reason: `Transferência enviada para ${toLabel}`,
              },
            });

            return {
              alreadyProcessed: false,
              fromNewStock,
              product: fromProduct,
              lotDeductions,
              outLogId: outLog.id,
            };
          }),
        );
      },
    );

    if (originSnapshot.alreadyProcessed) {
      return {
        success: true,
        idempotent: true,
        fromNewStock: originSnapshot.fromNewStock,
      };
    }

    // 2. Crédito transacional na loja de destino (com compensação na origem se falhar)
    try {
      const destResult = await this.withTenantClient(
        toMember.tenantId,
        toMember.tenant.databaseUrl,
        async (toClient) => {
          return retryTransaction(() =>
            toClient.$transaction(async (tx) => {
              const duplicateIn = await tx.inventoryLog.findFirst({
                where: { referenceKey: effectiveKey, type: 'IN' },
              });
              if (duplicateIn) {
                return { toProductId: duplicateIn.productId };
              }

              const src = originSnapshot.product;
              const categoryName = src.category?.name || 'Geral';
              let toCategory = await tx.category.findFirst({
                where: { name: { equals: categoryName, mode: 'insensitive' } },
              });
              if (!toCategory) {
                toCategory = await tx.category.create({
                  data: {
                    name: categoryName,
                    icon: src.category?.icon || null,
                    active: true,
                  },
                });
              }

              let toRetailGroupId: string | null = null;
              if (src.retailGroup) {
                let toGroup = await tx.retailGroup.findFirst({
                  where: {
                    name: {
                      equals: src.retailGroup.name,
                      mode: 'insensitive',
                    },
                  },
                });
                if (!toGroup) {
                  toGroup = await tx.retailGroup.create({
                    data: {
                      name: src.retailGroup.name,
                      categoryId: toCategory.id,
                      imageUrl: src.retailGroup.imageUrl || src.imageUrl || null,
                      priceSell: src.retailGroup.priceSell,
                      priceCost: src.retailGroup.priceCost,
                      ncm: src.retailGroup.ncm || src.ncm || null,
                      cest: src.retailGroup.cest || src.cest || null,
                      origem: src.retailGroup.origem ?? src.origem ?? 0,
                      active: true,
                    },
                  });
                }
                toRetailGroupId = toGroup.id;
              }

              const size = src.size || (toRetailGroupId ? 'Único' : null);
              const color = src.color || (toRetailGroupId ? 'Padrão' : null);
              const computedVariantKey =
                src.variantKey ||
                (size && color ? variantIdentity(size, color) : null);

              let toProduct = null as any;
              if (toRetailGroupId && computedVariantKey) {
                toProduct = await tx.product.findFirst({
                  where: {
                    retailGroupId: toRetailGroupId,
                    variantKey: computedVariantKey,
                  },
                });
              }
              if (!toProduct) {
                toProduct = await tx.product.findFirst({
                  where: { name: { equals: src.name, mode: 'insensitive' } },
                });
              }

              if (!toProduct) {
                let safeBarcode = src.barcode || null;
                if (safeBarcode) {
                  const barcodeCollision = await tx.product.findFirst({
                    where: { barcode: safeBarcode },
                    select: { id: true },
                  });
                  if (barcodeCollision) safeBarcode = null;
                }

                toProduct = await tx.product.create({
                  data: {
                    retailGroupId: toRetailGroupId,
                    categoryId: toCategory.id,
                    name: src.name,
                    size,
                    color,
                    variantKey: computedVariantKey,
                    barcode: safeBarcode,
                    unit: normalizeRetailUnit(src.unit),
                    imageUrl: src.imageUrl || src.retailGroup?.imageUrl || null,
                    priceCost: src.priceCost,
                    priceSell: src.retailGroup?.priceSell ?? src.priceSell,
                    ncm: src.ncm || src.retailGroup?.ncm || null,
                    cest: src.cest || src.retailGroup?.cest || null,
                    origem: src.origem ?? 0,
                    stock: 0,
                    active: true,
                  },
                });
              } else {
                await this.safeLockProducts(tx, [toProduct.id]);
                toProduct = await tx.product.findUnique({
                  where: { id: toProduct.id },
                });
              }

              const toNewStock = Number(
                (Number(toProduct.stock ?? 0) + qty).toFixed(3),
              );

              await tx.stockLot.create({
                data: {
                  productId: toProduct.id,
                  costPrice: src.priceCost,
                  quantity: qty,
                  remaining: qty,
                  lotNumber: `TRANSF-${new Date().toISOString().slice(0, 10)}`,
                },
              });

              await tx.product.update({
                where: { id: toProduct.id },
                data: { stock: toNewStock, active: true },
              });

              await tx.inventoryLog.create({
                data: {
                  productId: toProduct.id,
                  type: 'IN',
                  quantity: qty,
                  costPrice: src.priceCost,
                  origin: 'AJUSTE',
                  referenceKey: effectiveKey,
                  reason: `Transferência recebida de ${fromLabel}`,
                },
              });

              return { toProductId: toProduct.id, toNewStock };
            }),
          );
        },
      );

      this.productsService.invalidateCache(body.fromTenantId);
      this.productsService.invalidateCache(body.toTenantId);

      return {
        success: true,
        fromNewStock: originSnapshot.fromNewStock,
        toNewStock: destResult.toNewStock,
      };
    } catch (destErr: any) {
      // Compensação atômica na origem para nunca perder saldo
      this.logger.error(
        `Falha ao creditar transferência no destino ${body.toTenantId}; estornando origem ${body.fromTenantId}: ${destErr.message}`,
      );
      await this.withTenantClient(
        fromMember.tenantId,
        fromMember.tenant.databaseUrl,
        async (fromClient) => {
          await fromClient.$transaction(async (tx) => {
            await this.safeLockProducts(tx, [body.productId]);
            for (const d of originSnapshot.lotDeductions) {
              await tx.stockLot.update({
                where: { id: d.id },
                data: { remaining: { increment: d.deducted } },
              });
            }
            await tx.product.update({
              where: { id: body.productId },
              data: { stock: { increment: qty } },
            });
            await tx.inventoryLog
              .delete({ where: { id: originSnapshot.outLogId } })
              .catch(() => {});
          });
        },
      ).catch((compErr) => {
        this.logger.error(
          `Erro crítico ao compensar origem ${body.fromTenantId}: ${compErr.message}`,
        );
      });

      throw new BadRequestException(
        `Não foi possível concluir a transferência para ${toLabel}: ${destErr.message}`,
      );
    }
  }

  // ── Products & RetailGroups ────────────────────────────────────────────────

  async getGroupProducts(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const allProducts: any[] = [];

    for (const member of group.members) {
      const alias =
        member.alias || member.tenant.nomeFantasia || member.tenant.name;
      try {
        await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            const products = await client.product.findMany({
              where: {
                active: true,
                OR: [{ retailGroupId: null }, { retailGroup: { active: true } }],
              },
              select: {
                id: true,
                name: true,
                size: true,
                color: true,
                priceSell: true,
                priceCost: true,
                unit: true,
                stock: true,
                imageUrl: true,
                retailGroupId: true,
                retailGroup: { select: { imageUrl: true } },
              },
            });
            for (const p of products) {
              const { retailGroup, ...rest } = p as any;
              allProducts.push({
                ...rest,
                imageUrl: p.imageUrl || retailGroup?.imageUrl || null,
                priceSell: Number(p.priceSell ?? 0),
                priceCost: Number(p.priceCost ?? 0),
                stock: Number(p.stock ?? 0),
                tenantId: member.tenantId,
                tenantAlias: alias,
              });
            }
          },
        );
      } catch (err: any) {
        this.logger.warn(
          `Products erro tenant ${member.tenantId}: ${err.message}`,
        );
      }
    }

    return { groupId, groupName: group.name, products: allProducts };
  }

  /**
   * Cria ou atualiza um Grupo de Mercadoria (`RetailGroup`) com sua grade de
   * tamanhos e cores em uma loja específica, mantendo preço e foto compartilhados.
   */
  private async upsertCatalogGroupInTenant(
    client: PrismaClient,
    params: {
      name: string;
      categoryName: string;
      categoryIcon?: string | null;
      unit?: string;
      barcode?: string;
      ncm?: string;
      cest?: string;
      origem?: number;
      imageUrl?: string | null;
      priceSell: number;
      priceCost: number;
      sizes?: string[];
      colors?: string[];
      exactVariants?: {
        size: string;
        color: string;
        barcode?: string | null;
        unit?: string;
      }[];
    },
  ) {
    const groupName = String(params.name || '').trim().slice(0, 120);
    if (!groupName) {
      throw new BadRequestException('O nome da mercadoria é obrigatório.');
    }
    const catName = String(params.categoryName || 'Geral').trim().slice(0, 120) || 'Geral';
    const defaultUnit = normalizeRetailUnit(params.unit);
    const priceSellDec = new Prisma.Decimal(
      Math.max(0, Number(params.priceSell) || 0),
    ).toDecimalPlaces(2);
    const priceCostDec = new Prisma.Decimal(
      Math.max(0, Number(params.priceCost) || 0),
    ).toDecimalPlaces(4);
    const cleanNcm =
      params.ncm && /^\d{8}$/.test(String(params.ncm).replace(/\D/g, ''))
        ? String(params.ncm).replace(/\D/g, '')
        : null;
    const cleanCest =
      params.cest && /^\d{7}$/.test(String(params.cest).replace(/\D/g, ''))
        ? String(params.cest).replace(/\D/g, '')
        : null;

    const targetVariants: {
      size: string;
      color: string;
      barcode?: string | null;
      unit: string;
    }[] = [];

    if (Array.isArray(params.exactVariants) && params.exactVariants.length > 0) {
      const seenKeys = new Set<string>();
      for (const item of params.exactVariants) {
        const s = String(item.size || 'Único').trim().slice(0, 40) || 'Único';
        const c = String(item.color || 'Padrão').trim().slice(0, 40) || 'Padrão';
        const k = variantIdentity(s, c);
        if (seenKeys.has(k)) continue;
        seenKeys.add(k);
        targetVariants.push({
          size: s,
          color: c,
          barcode: item.barcode || null,
          unit: normalizeRetailUnit(item.unit || defaultUnit),
        });
      }
    } else {
      const sizes = parseDimensionList(params.sizes, 'Único');
      const colors = parseDimensionList(params.colors, 'Padrão');
      const isSingle = sizes.length === 1 && colors.length === 1;
      for (const size of sizes) {
        for (const color of colors) {
          targetVariants.push({
            size,
            color,
            barcode:
              isSingle && params.barcode?.trim()
                ? params.barcode.trim().slice(0, 80)
                : null,
            unit: defaultUnit,
          });
        }
      }
    }

    return retryTransaction(() =>
      client.$transaction(async (tx) => {
        let category = await tx.category.findFirst({
          where: { name: { equals: catName, mode: 'insensitive' } },
        });
        if (!category) {
          category = await tx.category.create({
            data: {
              name: catName,
              icon: params.categoryIcon || null,
              active: true,
            },
          });
        }

        let retailGroup = await tx.retailGroup.findFirst({
          where: { name: { equals: groupName, mode: 'insensitive' } },
          include: { variants: true },
        });

        if (retailGroup) {
          await this.safeLockProducts(
            tx,
            retailGroup.variants.map((v) => v.id),
          );
          retailGroup = await tx.retailGroup.update({
            where: { id: retailGroup.id },
            data: {
              categoryId: category.id,
              priceSell: priceSellDec,
              priceCost: priceCostDec,
              ...(cleanNcm ? { ncm: cleanNcm } : {}),
              ...(cleanCest ? { cest: cleanCest } : {}),
              ...(params.imageUrl ? { imageUrl: params.imageUrl } : {}),
              active: true,
              version: { increment: 1 },
            },
            include: { variants: true },
          });
          // Sincroniza o preço compartilhado em todas as variações existentes do grupo
          await tx.product.updateMany({
            where: { retailGroupId: retailGroup.id },
            data: {
              priceSell: priceSellDec,
              priceCost: priceCostDec,
              categoryId: category.id,
              ...(cleanNcm ? { ncm: cleanNcm } : {}),
              ...(params.imageUrl ? { imageUrl: params.imageUrl } : {}),
            },
          });
        } else {
          retailGroup = await tx.retailGroup.create({
            data: {
              name: groupName,
              categoryId: category.id,
              imageUrl: params.imageUrl || null,
              priceSell: priceSellDec,
              priceCost: priceCostDec,
              ncm: cleanNcm,
              cest: cleanCest,
              origem: params.origem ?? 0,
              active: true,
            },
            include: { variants: true },
          });
        }

        let firstProductId = retailGroup.variants[0]?.id || '';

        for (const variantSpec of targetVariants) {
          const { size, color } = variantSpec;
          const vKey = variantIdentity(size, color);
          const existingVariant = await tx.product.findFirst({
            where: { retailGroupId: retailGroup.id, variantKey: vKey },
          });

          if (existingVariant) {
            if (!firstProductId) firstProductId = existingVariant.id;
            await tx.product.update({
              where: { id: existingVariant.id },
              data: {
                priceSell: priceSellDec,
                priceCost: priceCostDec,
                unit: variantSpec.unit,
                active: true,
              },
            });
          } else {
            let candidateBarcode = variantSpec.barcode?.trim()
              ? variantSpec.barcode.trim().slice(0, 80)
              : null;
            if (candidateBarcode) {
              const collision = await tx.product.findFirst({
                where: { barcode: candidateBarcode },
                select: { id: true },
              });
              if (collision) candidateBarcode = null;
            }

            const createdVar = await tx.product.create({
              data: {
                retailGroupId: retailGroup.id,
                categoryId: category.id,
                name: `${retailGroup.name} · ${size} · ${color}`,
                size,
                color,
                variantKey: vKey,
                barcode: candidateBarcode,
                unit: variantSpec.unit,
                imageUrl: retailGroup.imageUrl,
                priceSell: priceSellDec,
                priceCost: priceCostDec,
                ncm: cleanNcm,
                cest: cleanCest,
                origem: params.origem ?? 0,
                stock: 0,
                active: true,
              },
            });
            if (!firstProductId) firstProductId = createdVar.id;
          }
        }

        return {
          retailGroupId: retailGroup.id,
          productId: firstProductId,
        };
      }),
    );
  }

  async createProductAllTenants(
    groupId: string,
    body: {
      name: string;
      priceSell: number;
      priceCost: number;
      unit: string;
      categoryName: string;
      sizes?: string[];
      colors?: string[];
    },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    return this.createProductInTenants(groupId, {
      name: body.name,
      unit: body.unit,
      categoryName: body.categoryName,
      priceCost: body.priceCost,
      sizes: body.sizes,
      colors: body.colors,
      tenantPrices: group.members.map((m) => ({
        tenantId: m.tenantId,
        priceSell: body.priceSell,
      })),
    });
  }

  async updatePriceAllTenants(
    groupId: string,
    body: { productName: string; priceSell: number },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    return this.updatePricePerTenant(groupId, {
      productName: body.productName,
      updates: group.members.map((m) => ({
        tenantId: m.tenantId,
        priceSell: body.priceSell,
      })),
    });
  }

  // ── Group Owner User Management ────────────────────────────────────────────

  async createGroupOwnerUser(
    groupId: string,
    body: {
      name: string;
      email: string;
      password: string;
      imageUrl?: string | null;
    },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    if (!group.members.length)
      throw new BadRequestException('Grupo sem empresas vinculadas');

    const hostTenantId = group.members[0].tenantId;
    const hashedPassword = await bcrypt.hash(body.password, 10);

    return this.heartPrisma.user.create({
      data: {
        name: body.name,
        email: body.email.trim().toLowerCase(),
        password: hashedPassword,
        imageUrl: body.imageUrl || null,
        role: 'group_owner',
        tenantId: hostTenantId,
        groupId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        role: true,
        groupId: true,
        createdAt: true,
      },
    });
  }

  async getGroupUsers(groupId: string) {
    await this.getGroupWithMembers(groupId);
    return this.heartPrisma.user.findMany({
      where: { groupId },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async deleteGroupUser(groupId: string, userId: string) {
    const user = await this.heartPrisma.user.findFirst({
      where: { id: userId, groupId },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado neste grupo');
    await this.heartPrisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  // ── Forecast (consolidado por mercadoria/variação em toda a rede) ──────────

  async getPurchaseForecast(groupId: string, daysToForecast: number = 15) {
    const safeDays = Math.min(180, Math.max(1, Number(daysToForecast) || 15));
    const group = await this.getGroupWithMembers(groupId);
    const productAgg = new Map<
      string,
      {
        productId: string;
        name: string;
        imageUrl: string | null;
        totalStock: number;
        totalSold30d: number;
      }
    >();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const member of group.members) {
      try {
        await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            const [products, sales30d] = await Promise.all([
              client.product.findMany({
                select: {
                  id: true,
                  name: true,
                  stock: true,
                  imageUrl: true,
                  retailGroup: { select: { imageUrl: true } },
                },
                where: {
                  active: true,
                  OR: [
                    { retailGroupId: null },
                    { retailGroup: { active: true } },
                  ],
                },
              }),
              client.saleItem.groupBy({
                by: ['productId'],
                where: {
                  sale: {
                    createdAt: { gte: thirtyDaysAgo },
                    NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
                  },
                },
                _sum: { quantity: true },
              }),
            ]);

            const salesMap = new Map<string, number>(
              sales30d.map((s: any) => [
                s.productId,
                Number(s._sum.quantity ?? 0),
              ]),
            );

            for (const p of products) {
              const currentStock = Number(p.stock ?? 0);
              const sold = salesMap.get(p.id) ?? 0;
              const key = normalizeCatalogKey(p.name);
              const resolvedImg =
                (p as any).imageUrl ||
                (p as any).retailGroup?.imageUrl ||
                null;

              if (!productAgg.has(key)) {
                productAgg.set(key, {
                  productId: p.id,
                  name: p.name,
                  imageUrl: resolvedImg,
                  totalStock: 0,
                  totalSold30d: 0,
                });
              }
              const agg = productAgg.get(key)!;
              if (!agg.imageUrl && resolvedImg) {
                agg.imageUrl = resolvedImg;
              }
              agg.totalStock += currentStock;
              agg.totalSold30d += sold;
            }
          },
        );
      } catch (err: any) {
        this.logger.warn(
          `Forecast erro tenant ${member.tenantId}: ${err.message}`,
        );
      }
    }

    const forecast = Array.from(productAgg.values()).map((data) => {
      const avgDailySales = data.totalSold30d / 30;
      const autonomyDays =
        avgDailySales > 0 ? data.totalStock / avgDailySales : 999;
      const targetStock = avgDailySales * safeDays;
      const suggestion = targetStock - data.totalStock;

      return {
        productId: data.productId,
        name: data.name,
        imageUrl: data.imageUrl,
        totalStock: Number(data.totalStock.toFixed(3)),
        avgDailySales: Number(avgDailySales.toFixed(2)),
        autonomyDays: Number(autonomyDays.toFixed(1)),
        suggestion: suggestion > 0 ? Math.ceil(suggestion) : 0,
      };
    });

    forecast.sort(
      (a, b) => b.suggestion - a.suggestion || a.autonomyDays - b.autonomyDays,
    );

    return forecast;
  }

  // ── Tenant Detail (recent sales + critical stock) ─────────────────────────

  async getTenantDetail(groupId: string, tenantId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const member = group.members.find((m) => m.tenantId === tenantId);
    if (!member)
      throw new NotFoundException('Esta loja não faz parte deste grupo.');

    return this.withTenantClient(
      member.tenantId,
      member.tenant.databaseUrl,
      async (client) => {
        const [recentSales, criticalStock, actors] = await Promise.all([
          client.sale.findMany({
            where: {
              NOT: [{ status: 'cancelled' }, { source: 'ajuste_fiscal' }],
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
            include: {
              operator: { select: { id: true, name: true } },
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      imageUrl: true,
                      retailGroup: { select: { imageUrl: true } },
                    },
                  },
                },
                take: 4,
              },
              payments: { select: { method: true, label: true, value: true } },
            },
          }),
          client.product.findMany({
            where: {
              active: true,
              stock: { lt: 3 },
              OR: [{ retailGroupId: null }, { retailGroup: { active: true } }],
            },
            select: {
              id: true,
              name: true,
              stock: true,
              unit: true,
              imageUrl: true,
              retailGroup: { select: { imageUrl: true } },
            },
            orderBy: { stock: 'asc' },
            take: 12,
          }),
          this.photoResolver
            ? this.photoResolver
                .loadTenantActors(member.tenantId, client)
                .catch(() => null)
            : Promise.resolve(null),
        ]);

        return {
          tenantId,
          alias:
            member.alias || member.tenant.nomeFantasia || member.tenant.name,
          recentSales: recentSales.map((s) => {
            const opActor = actors
              ? actors.resolveActor(
                  s.operatorId || s.operator?.id,
                  s.operator?.name || null,
                )
              : { name: s.operator?.name || null, imageUrl: null };
            return {
              id: s.id,
              total: Number(s.total),
              createdAt: s.createdAt,
              operatorId: s.operatorId || s.operator?.id || null,
              operatorName: opActor.name,
              operatorImageUrl: opActor.imageUrl,
              itemsCount: s.items.length,
              firstItems: s.items
                .slice(0, 3)
                .map((i) => i.product?.name ?? 'Mercadoria'),
              itemsPreview: s.items.slice(0, 4).map((i) => ({
                productId: i.productId,
                name: i.product?.name ?? 'Mercadoria',
                quantity: Number(i.quantity ?? 1),
                imageUrl:
                  (i.product as any)?.imageUrl ||
                  (i.product as any)?.retailGroup?.imageUrl ||
                  null,
              })),
              payments: s.payments.map((p) => ({
                method: p.method,
                label: p.label,
                value: Number(p.value),
              })),
            };
          }),
          criticalStock: criticalStock.map((p) => ({
            id: p.id,
            name: p.name,
            stock: Number(p.stock),
            unit: p.unit,
            imageUrl:
              (p as any).imageUrl || (p as any).retailGroup?.imageUrl || null,
          })),
        };
      },
    );
  }

  // ── Products Catalog (consolidado por RetailGroup — foto e preço compartilhados) ──

  async getProductsCatalog(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const catalogMap = new Map<
      string,
      {
        name: string;
        imageUrl: string | null;
        categoryName: string | null;
        tenants: Record<string, any>;
      }
    >();
    const tenantLabels: Record<string, string> = {};

    for (const member of group.members) {
      const label =
        member.alias || member.tenant.nomeFantasia || member.tenant.name;
      tenantLabels[member.tenantId] = label;

      try {
        await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            const [retailGroups, standaloneProducts] = await Promise.all([
              client.retailGroup.findMany({
                where: { active: true },
                include: {
                  category: { select: { name: true } },
                  variants: {
                    where: { active: true },
                    select: {
                      id: true,
                      stock: true,
                      unit: true,
                      barcode: true,
                      size: true,
                      color: true,
                      imageUrl: true,
                    },
                  },
                },
                orderBy: { name: 'asc' },
              }),
              client.product.findMany({
                where: { active: true, retailGroupId: null },
                include: { category: { select: { name: true } } },
                orderBy: { name: 'asc' },
              }),
            ]);

            for (const rg of retailGroups) {
              const key = normalizeCatalogKey(rg.name);
              const resolvedRgImg =
                rg.imageUrl ||
                rg.variants.find((v: any) => v.imageUrl)?.imageUrl ||
                null;
              const entry = catalogMap.get(key) || {
                name: rg.name,
                imageUrl: resolvedRgImg,
                categoryName: rg.category?.name || null,
                tenants: {},
              };
              if (!entry.imageUrl && resolvedRgImg) {
                entry.imageUrl = resolvedRgImg;
              }
              if (!entry.categoryName && rg.category?.name) {
                entry.categoryName = rg.category.name;
              }
              const totalStock = rg.variants.reduce(
                (s, v) => s + Number(v.stock ?? 0),
                0,
              );
              const sizes = Array.from(
                new Set(rg.variants.map((v) => v.size).filter(Boolean)),
              );
              const colors = Array.from(
                new Set(rg.variants.map((v) => v.color).filter(Boolean)),
              );

              entry.tenants[member.tenantId] = {
                id: rg.id,
                isRetailGroup: true,
                priceSell: Number(rg.priceSell ?? 0),
                priceCost: Number(rg.priceCost ?? 0),
                stock: totalStock,
                variantsCount: rg.variants.length,
                gradeSummary:
                  sizes.length || colors.length
                    ? `${sizes.join(', ') || 'Único'} · ${
                        colors.join(', ') || 'Padrão'
                      }`
                    : null,
                unit: rg.variants[0]?.unit || 'UN',
                barcode: rg.variants[0]?.barcode || null,
                ncm: rg.ncm || null,
                categoryName: rg.category?.name || null,
                imageUrl: resolvedRgImg,
              };
              catalogMap.set(key, entry);
            }

            for (const p of standaloneProducts) {
              const key = normalizeCatalogKey(p.name);
              const entry = catalogMap.get(key) || {
                name: p.name,
                imageUrl: p.imageUrl || null,
                categoryName: p.category?.name || null,
                tenants: {},
              };
              if (!entry.imageUrl && p.imageUrl) {
                entry.imageUrl = p.imageUrl;
              }
              if (!entry.categoryName && p.category?.name) {
                entry.categoryName = p.category.name;
              }
              if (entry.tenants[member.tenantId]) continue;
              entry.tenants[member.tenantId] = {
                id: p.id,
                isRetailGroup: false,
                priceSell: Number(p.priceSell ?? 0),
                priceCost: Number(p.priceCost ?? 0),
                stock: Number(p.stock ?? 0),
                variantsCount: 1,
                gradeSummary: null,
                unit: p.unit || 'UN',
                barcode: p.barcode || null,
                ncm: p.ncm || null,
                categoryName: p.category?.name || null,
                imageUrl: p.imageUrl || null,
              };
              catalogMap.set(key, entry);
            }
          },
        );
      } catch (err: any) {
        this.logger.warn(
          `Catalog erro tenant ${member.tenantId}: ${err.message}`,
        );
      }
    }

    const rows = Array.from(catalogMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
    return { groupId, groupName: group.name, tenantLabels, rows };
  }

  /**
   * Atualiza preço por loja mantendo consistência total entre `RetailGroup` e todas as suas variações.
   */
  async updatePricePerTenant(
    groupId: string,
    body: {
      productName: string;
      updates: { tenantId: string; priceSell: number; priceCost?: number }[];
    },
  ) {
    const targetName = String(body?.productName || '').trim();
    if (!targetName) {
      throw new BadRequestException('Informe o nome da mercadoria.');
    }

    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];

    for (const update of body.updates || []) {
      const member = group.members.find((m) => m.tenantId === update.tenantId);
      if (!member) {
        results.push({
          tenantId: update.tenantId,
          success: false,
          error: 'Loja não pertence ao grupo',
        });
        continue;
      }

      const nextPriceSell = Number(update.priceSell);
      if (!Number.isFinite(nextPriceSell) || nextPriceSell < 0) {
        results.push({
          tenantId: update.tenantId,
          success: false,
          error: 'Preço de venda inválido',
        });
        continue;
      }

      try {
        const updatedCount = await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            return retryTransaction(() =>
              client.$transaction(async (tx) => {
                const priceSellDec = new Prisma.Decimal(
                  nextPriceSell,
                ).toDecimalPlaces(2);
                const priceCostDec =
                  update.priceCost !== undefined &&
                  Number.isFinite(Number(update.priceCost))
                    ? new Prisma.Decimal(
                        Number(update.priceCost),
                      ).toDecimalPlaces(4)
                    : undefined;

                let count = 0;
                const rg = await tx.retailGroup.findFirst({
                  where: { name: { equals: targetName, mode: 'insensitive' } },
                  include: { variants: { select: { id: true } } },
                });

                if (rg) {
                  await this.safeLockProducts(
                    tx,
                    rg.variants.map((v) => v.id),
                  );
                  await tx.retailGroup.update({
                    where: { id: rg.id },
                    data: {
                      priceSell: priceSellDec,
                      ...(priceCostDec !== undefined
                        ? { priceCost: priceCostDec }
                        : {}),
                      version: { increment: 1 },
                    },
                  });
                  const updVars = await tx.product.updateMany({
                    where: { retailGroupId: rg.id },
                    data: {
                      priceSell: priceSellDec,
                      ...(priceCostDec !== undefined
                        ? { priceCost: priceCostDec }
                        : {}),
                    },
                  });
                  count += Math.max(1, updVars.count);
                }

                const standalone = await tx.product.updateMany({
                  where: {
                    retailGroupId: null,
                    name: { equals: targetName, mode: 'insensitive' },
                  },
                  data: {
                    priceSell: priceSellDec,
                    ...(priceCostDec !== undefined
                      ? { priceCost: priceCostDec }
                      : {}),
                  },
                });
                count += standalone.count;

                return count;
              }),
            );
          },
        );

        this.productsService.invalidateCache(update.tenantId);
        results.push({
          tenantId: update.tenantId,
          success: true,
          updatedCount,
        });
      } catch (err: any) {
        results.push({
          tenantId: update.tenantId,
          success: false,
          error: err.message,
        });
      }
    }

    return { groupId, results };
  }

  // ── Create product / RetailGroup in selected tenants ──────────────────────

  async createProductInTenants(
    groupId: string,
    body: {
      name: string;
      barcode?: string;
      ncm?: string;
      unit: string;
      categoryName: string;
      priceCost: number;
      sizes?: string[] | string;
      colors?: string[] | string;
      imageUrl?: string;
      tenantPrices: { tenantId: string; priceSell: number }[];
    },
  ) {
    if (!body?.name?.trim()) {
      throw new BadRequestException('O nome da mercadoria é obrigatório.');
    }
    if (!Array.isArray(body?.tenantPrices) || body.tenantPrices.length === 0) {
      throw new BadRequestException('Selecione pelo menos uma loja da rede.');
    }

    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];
    const parsedSizes = parseDimensionList(body.sizes, 'Único');
    const parsedColors = parseDimensionList(body.colors, 'Padrão');

    for (const tp of body.tenantPrices) {
      const member = group.members.find((m) => m.tenantId === tp.tenantId);
      if (!member) {
        results.push({
          tenantId: tp.tenantId,
          success: false,
          error: 'Loja não pertence ao grupo',
        });
        continue;
      }

      try {
        const created = await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            return this.upsertCatalogGroupInTenant(client, {
              name: body.name,
              categoryName: body.categoryName || 'Geral',
              unit: body.unit,
              barcode: body.barcode,
              ncm: body.ncm,
              imageUrl: body.imageUrl,
              priceSell: Number(tp.priceSell) || 0,
              priceCost: Number(body.priceCost) || 0,
              sizes: parsedSizes,
              colors: parsedColors,
            });
          },
        );

        this.productsService.invalidateCache(tp.tenantId);
        results.push({
          tenantId: tp.tenantId,
          success: true,
          retailGroupId: created.retailGroupId,
          productId: created.productId,
        });
      } catch (err: any) {
        this.logger.warn(
          `CreateProductInTenants erro tenant ${tp.tenantId}: ${err.message}`,
        );
        results.push({
          tenantId: tp.tenantId,
          success: false,
          error: err.message,
        });
      }
    }

    return { groupId, results };
  }

  // ── Sync Check & Sync Catalog (grupos + grade completa entre filiais) ─────

  async getSyncStatus(groupId: string) {
    const group = await this.getGroupWithMembers(groupId);
    const tenantLabels: Record<string, string> = {};
    const allTenantIds = group.members.map((m) => m.tenantId);

    // key -> { displayName, presentIn: Set<tenantId>, sampleData }
    const catalogPresence = new Map<
      string,
      {
        name: string;
        presentIn: Set<string>;
        productData: any;
      }
    >();

    for (const member of group.members) {
      const label =
        member.alias || member.tenant.nomeFantasia || member.tenant.name;
      tenantLabels[member.tenantId] = label;

      try {
        await this.withTenantClient(
          member.tenantId,
          member.tenant.databaseUrl,
          async (client) => {
            const [retailGroups, standalone] = await Promise.all([
              client.retailGroup.findMany({
                where: { active: true },
                include: {
                  category: { select: { name: true } },
                  variants: {
                    where: { active: true },
                    select: {
                      size: true,
                      color: true,
                      unit: true,
                      imageUrl: true,
                    },
                  },
                },
              }),
              client.product.findMany({
                where: { active: true, retailGroupId: null },
                include: { category: { select: { name: true } } },
              }),
            ]);

            for (const rg of retailGroups) {
              const key = normalizeCatalogKey(rg.name);
              const resolvedRgImg =
                rg.imageUrl ||
                rg.variants.find((v: any) => v.imageUrl)?.imageUrl ||
                null;
              const entry = catalogPresence.get(key) || {
                name: rg.name,
                presentIn: new Set<string>(),
                productData: {
                  name: rg.name,
                  isRetailGroup: true,
                  priceSell: Number(rg.priceSell),
                  priceCost: Number(rg.priceCost),
                  categoryName: rg.category?.name || 'Geral',
                  ncm: rg.ncm,
                  imageUrl: resolvedRgImg,
                  variantsCount: rg.variants.length,
                },
              };
              if (!entry.productData.imageUrl && resolvedRgImg) {
                entry.productData.imageUrl = resolvedRgImg;
              }
              entry.presentIn.add(member.tenantId);
              catalogPresence.set(key, entry);
            }

            for (const p of standalone) {
              const key = normalizeCatalogKey(p.name);
              const entry = catalogPresence.get(key) || {
                name: p.name,
                presentIn: new Set<string>(),
                productData: {
                  name: p.name,
                  isRetailGroup: false,
                  priceSell: Number(p.priceSell),
                  priceCost: Number(p.priceCost),
                  categoryName: p.category?.name || 'Geral',
                  ncm: p.ncm,
                  imageUrl: p.imageUrl,
                  variantsCount: 1,
                },
              };
              entry.presentIn.add(member.tenantId);
              catalogPresence.set(key, entry);
            }
          },
        );
      } catch (err: any) {
        this.logger.warn(
          `SyncCheck erro tenant ${member.tenantId}: ${err.message}`,
        );
      }
    }

    const missingProducts: any[] = [];
    for (const entry of catalogPresence.values()) {
      const presentIn = allTenantIds.filter((tid) => entry.presentIn.has(tid));
      const missingIn = allTenantIds.filter((tid) => !entry.presentIn.has(tid));
      if (presentIn.length > 0 && missingIn.length > 0) {
        missingProducts.push({
          name: entry.name,
          presentIn,
          missingIn,
          productData: entry.productData,
        });
      }
    }

    missingProducts.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return {
      groupId,
      tenantLabels,
      hasDifferences: missingProducts.length > 0,
      missingProducts,
    };
  }

  async syncProductsToTenants(
    groupId: string,
    body: { products: { name: string; targetTenantIds: string[] }[] },
  ) {
    const group = await this.getGroupWithMembers(groupId);
    const results: any[] = [];

    for (const item of body.products || []) {
      let sourcePayload: {
        name: string;
        categoryName: string;
        categoryIcon?: string | null;
        unit: string;
        barcode?: string;
        ncm?: string;
        cest?: string;
        origem?: number;
        imageUrl?: string | null;
        priceSell: number;
        priceCost: number;
        sizes: string[];
        colors: string[];
        exactVariants?: {
          size: string;
          color: string;
          barcode?: string | null;
          unit?: string;
        }[];
      } | null = null;

      for (const member of group.members) {
        if (item.targetTenantIds.includes(member.tenantId)) continue;
        try {
          await this.withTenantClient(
            member.tenantId,
            member.tenant.databaseUrl,
            async (client) => {
              const rg = await client.retailGroup.findFirst({
                where: { name: { equals: item.name, mode: 'insensitive' } },
                include: {
                  category: { select: { name: true, icon: true } },
                  variants: { where: { active: true } },
                },
              });
              if (rg) {
                sourcePayload = {
                  name: rg.name,
                  categoryName: rg.category?.name || 'Geral',
                  categoryIcon: rg.category?.icon || null,
                  unit: rg.variants[0]?.unit || 'UN',
                  barcode:
                    rg.variants.length === 1
                      ? rg.variants[0]?.barcode || undefined
                      : undefined,
                  ncm: rg.ncm || undefined,
                  cest: rg.cest || undefined,
                  origem: rg.origem ?? 0,
                  imageUrl: rg.imageUrl || null,
                  priceSell: Number(rg.priceSell),
                  priceCost: Number(rg.priceCost),
                  sizes: rg.variants.map((v) => v.size || 'Único'),
                  colors: rg.variants.map((v) => v.color || 'Padrão'),
                  exactVariants:
                    rg.variants.length > 0
                      ? rg.variants.map((v) => ({
                          size: v.size || 'Único',
                          color: v.color || 'Padrão',
                          barcode: v.barcode || null,
                          unit: v.unit || 'UN',
                        }))
                      : undefined,
                };
                return;
              }

              const sp = await client.product.findFirst({
                where: {
                  name: { equals: item.name, mode: 'insensitive' },
                  retailGroupId: null,
                },
                include: { category: { select: { name: true, icon: true } } },
              });
              if (sp) {
                sourcePayload = {
                  name: sp.name,
                  categoryName: sp.category?.name || 'Geral',
                  categoryIcon: sp.category?.icon || null,
                  unit: sp.unit || 'UN',
                  barcode: sp.barcode || undefined,
                  ncm: sp.ncm || undefined,
                  cest: sp.cest || undefined,
                  origem: sp.origem ?? 0,
                  imageUrl: sp.imageUrl || null,
                  priceSell: Number(sp.priceSell),
                  priceCost: Number(sp.priceCost),
                  sizes: [sp.size || 'Único'],
                  colors: [sp.color || 'Padrão'],
                };
              }
            },
          );
          if (sourcePayload) break;
        } catch {
          // try next member
        }
      }

      if (!sourcePayload) {
        results.push({
          name: item.name,
          success: false,
          error: 'Mercadoria não encontrada em nenhuma loja de origem',
        });
        continue;
      }

      for (const targetTenantId of item.targetTenantIds) {
        const member = group.members.find((m) => m.tenantId === targetTenantId);
        if (!member) continue;
        try {
          await this.withTenantClient(
            member.tenantId,
            member.tenant.databaseUrl,
            async (client) => {
              await this.upsertCatalogGroupInTenant(client, sourcePayload!);
            },
          );
          this.productsService.invalidateCache(targetTenantId);
          results.push({
            name: item.name,
            tenantId: targetTenantId,
            success: true,
          });
        } catch (err: any) {
          results.push({
            name: item.name,
            tenantId: targetTenantId,
            success: false,
            error: err.message,
          });
        }
      }
    }

    return { groupId, results };
  }
}
