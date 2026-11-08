import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { LeadgerWebhookService, LeadgerPaymentMethod } from './leadger-webhook.service';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { upgradeTenantSchema, checkStorefrontSchemaCompatibility } from './tenant-schema-upgrade';
import { ProvisionTenantDto } from './provision-tenant.dto';
import { seedDefaultGruposStatic } from '../tributacao/tributacao.service';
import {
  DEMO_DATABASE_NAME,
  DEMO_LEGACY_DB_NAMES,
  DEMO_OPERATOR_PIN,
  DEMO_USER_EMAIL,
  DEMO_USER_PASSWORD,
  isValidWhatsapp,
  normalizeWhatsapp,
  resetDemoDatabaseState,
} from './demo-store.seed';

const execAsync = promisify(exec);

/** Gera um ID público único de 8 caracteres para a Vitrine Digital (ex: "4J9XQ2KM") */
function generateTvPublicId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem ambiguidades (0/O, 1/I)
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private demoResetChain: Promise<any> = Promise.resolve();

  constructor(
    private heartPrisma: HeartPrismaService,
    private tenantManager: TenantConnectionManager,
    private tenantContext: TenantContextService,
    private jwtService: JwtService,
    private leadgerService: LeadgerWebhookService,
  ) {}

  async findAll() {
    const tenants = await this.heartPrisma.tenant.findMany({
      where: {
        databaseName: { notIn: DEMO_LEGACY_DB_NAMES },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            pin: true,
          },
        },
        tenantIntegrations: true,
        _count: {
          select: {
            users: true,
            paymentLogs: true,
            invoices: true,
          },
        },
      },
    });

    return tenants.map(({ certPfx, certSenha, ...safe }: any) => safe);
  }

  create(data: any) {
    return this.heartPrisma.tenant.create({ data });
  }

  async findById(tenantId: string) {
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant && tenantId === 'demo-tenant-001') {
      return {
        id: 'demo-tenant-001',
        name: 'Loja Modelo',
        nomeFantasia: 'Loja Modelo',
        razaoSocial: 'Loja Modelo Demonstração LTDA',
        cnpj: '00.000.000/0001-99',
        databaseName: 'demo_lojista',
        status: 'active',
        tvPublicId: 'DEMOLOJA',
        modulos: {
          nfce: true,
          importacaoXml: true,
          estoque: true,
          crediario: true,
          vitrineDigital: true,
          lojaVirtual: true,
          entregaLojaVirtual: true,
          fornecedores: true,
          vendedores: true,
          inteligenciaComercial: true,
          multiEmpresa: true,
          dashboardMobile: true,
          comandas: false,
          kds: false,
          restaurante: false,
          carvoaria: false,
        },
        nfceAtivo: false,
        proximaNota: 1,
      };
    }

    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    if (!tenant.tvPublicId && tenantId !== 'demo-tenant-001') {
      const newTvId = generateTvPublicId();
      await this.heartPrisma.tenant.update({
        where: { id: tenantId },
        data: { tvPublicId: newTvId },
      }).catch(err => this.logger.warn(`Não foi possível gerar tvPublicId para ${tenantId}: ${err.message}`));
      (tenant as any).tvPublicId = newTvId;
    }

    const { certPfx, certSenha, databaseUrl, ...safeTenant } = tenant as any;
    const modules = typeof safeTenant.modulos === 'string' ? JSON.parse(safeTenant.modulos) : (safeTenant.modulos || {});
    safeTenant.modulos = { lojaVirtual: false, ...modules, comandas: false, kds: false, restaurante: false, carvoaria: false };

    if (this.heartPrisma?.tenantGroupMember?.findFirst) {
      const membership = await this.heartPrisma.tenantGroupMember
        .findFirst({
          where: { tenantId },
          include: {
            group: {
              include: {
                members: {
                  include: {
                    tenant: {
                      select: {
                        id: true,
                        name: true,
                        nomeFantasia: true,
                        razaoSocial: true,
                        logoUrl: true,
                        status: true,
                      },
                    },
                  },
                  orderBy: { id: 'asc' },
                },
              },
            },
          },
        })
        .catch(() => null);

      if (membership?.group) {
        safeTenant.groupId = membership.group.id;
        safeTenant.groupName = membership.group.name;
        safeTenant.groupMembers = membership.group.members.map((m: any) => ({
          tenantId: m.tenantId,
          alias: m.alias || m.tenant?.nomeFantasia || m.tenant?.name || 'Loja',
          name: m.tenant?.nomeFantasia || m.tenant?.name || 'Loja',
          logoUrl: m.tenant?.logoUrl ?? null,
          status: m.tenant?.status ?? 'active',
        }));
      }
    }

    try {
      const tenantPrisma = await this.tenantManager.getTenantClient(tenantId, tenant.databaseUrl);
      const numeracao = await tenantPrisma.numeracaoNfce.findUnique({
        where: { serie: tenant.nfceSerie || 1 }
      });
      safeTenant.proximaNota = (numeracao?.ultimo ?? 0) + 1;
    } catch (e: any) {
      this.logger.warn(`Não foi possível carregar a numeração da NFC-e para o tenant ${tenantId}: ${e.message}`);
      safeTenant.proximaNota = 1;
    }

    return safeTenant;
  }

  async updateTenant(tenantId: string, data: any) {
    if (data.modulos !== undefined) {
      let modules: any;
      try { modules = typeof data.modulos === 'string' ? JSON.parse(data.modulos) : data.modulos; } catch { throw new BadRequestException('Módulos inválidos.'); }
      data = { ...data, modulos: { lojaVirtual: false, ...modules, comandas: false, restaurante: false, kds: false, carvoaria: false } };

      if (data.modulos.lojaVirtual === true && this.heartPrisma?.tenant?.findUnique && this.tenantManager?.getTenantClient) {
        const targetTenant = await this.heartPrisma.tenant.findUnique({ where: { id: tenantId } });
        if (targetTenant?.databaseUrl) {
          if (typeof (this.heartPrisma as any).ensureHeartColumnsAndTables === 'function') {
            await (this.heartPrisma as any).ensureHeartColumnsAndTables();
          }
          const tenantPrisma = await this.tenantManager.getTenantClient(tenantId, targetTenant.databaseUrl);
          if (typeof (this.tenantManager as any).ensureTenantRuntimeSchema === 'function') {
            await (this.tenantManager as any).ensureTenantRuntimeSchema(tenantPrisma, tenantId);
          }
          const compat = await checkStorefrontSchemaCompatibility(this.heartPrisma, tenantPrisma);
          if (!compat.compatible) {
            throw new BadRequestException(
              `${compat.message || 'Schema incompatível para a Loja Virtual.'} Tabelas pendentes: ${compat.missingTables.join(', ')}`,
            );
          }
        }
      }
    }

    const allowed = [
      'name', 'razaoSocial', 'nomeFantasia', 'cnpj', 'ie', 'im', 'crt',
      'logradouro', 'numero', 'complemento', 'bairro',
      'municipio', 'codMunicipio', 'uf', 'cep', 'telefone',
      'nfceAtivo', 'nfceAutoSync', 'nfceSerie', 'nfceAmbiente', 'nfceCsc', 'nfceIdCsc',
      'modulos', 'status', 'emailContador', 'mensalidadeValor', 'mensalidadeVencimento',
      'tvPublicId', 'cosmosApiKey',
      'telefoneContato', 'emailContato', 'observacoes',
      'clientExternalId', 'baseExternalId', 'leadgerSyncEnabled',
      'logoUrl',
    ];

    const safeData: Record<string, any> = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    );

    if (safeData.crt != null)          safeData.crt          = Number(safeData.crt);
    if (safeData.nfceSerie != null)    safeData.nfceSerie    = Number(safeData.nfceSerie);
    if (safeData.nfceAmbiente != null) safeData.nfceAmbiente = Number(safeData.nfceAmbiente);
    if (safeData.mensalidadeValor !== undefined) {
      safeData.mensalidadeValor = safeData.mensalidadeValor !== '' && safeData.mensalidadeValor !== null
        ? Number(safeData.mensalidadeValor)
        : 0;
    }
    if (safeData.mensalidadeVencimento !== undefined) {
      safeData.mensalidadeVencimento = safeData.mensalidadeVencimento ? new Date(safeData.mensalidadeVencimento) : null;
    }
    if (safeData.leadgerSyncEnabled !== undefined) {
      safeData.leadgerSyncEnabled = Boolean(safeData.leadgerSyncEnabled);
    }

    if (safeData.cnpj !== undefined) {
      const cleanCnpj = String(safeData.cnpj || '').replace(/\D/g, '');
      if (!cleanCnpj) {
        safeData.cnpj = null;
      } else {
        const duplicate = await this.heartPrisma.tenant.findFirst({
          where: { cnpj: cleanCnpj, id: { not: tenantId } }
        });

        if (duplicate) {
          this.logger.warn(
            `CNPJ ${data.cnpj} já pertence à empresa "${duplicate.razaoSocial || duplicate.name}". CNPJ não atualizado.`
          );
          delete safeData.cnpj;
        } else {
          safeData.cnpj = cleanCnpj;
        }
      }
    }

    if (data.proximaNota !== undefined) {
      const proxima = Number(data.proximaNota);
      if (!isNaN(proxima) && proxima > 0) {
        try {
          const tenant = await this.heartPrisma.tenant.findUnique({
            where: { id: tenantId },
          });
          if (tenant) {
            const serie = safeData.nfceSerie !== undefined ? Number(safeData.nfceSerie) : (tenant.nfceSerie || 1);
            const tenantPrisma = await this.tenantManager.getTenantClient(tenantId, tenant.databaseUrl);
            await tenantPrisma.numeracaoNfce.upsert({
              where: { serie },
              update: { ultimo: proxima - 1 },
              create: { serie, ultimo: proxima - 1 }
            });
          }
        } catch (dbErr: any) {
          this.logger.error(`Erro ao atualizar proximaNota para tenant ${tenantId}: ${dbErr.message}`);
        }
      }
    }

    const clientFieldsChanged = [
      'name', 'nomeFantasia', 'razaoSocial', 'cnpj', 'telefone',
      'telefoneContato', 'emailContato', 'emailContador', 'logradouro',
      'municipio', 'uf', 'observacoes', 'status',
    ].some((f) => safeData[f] !== undefined);

    const baseFieldsChanged = [
      'name', 'nomeFantasia', 'mensalidadeValor', 'mensalidadeVencimento', 'status',
    ].some((f) => safeData[f] !== undefined);

    try {
      const updated = await this.heartPrisma.tenant.update({
        where: { id: tenantId },
        data: safeData,
      });

      // Invalidar cache de URL/status imediatamente
      this.tenantContext.evictTenantCache(tenantId);
      if (safeData.status === 'suspended' || safeData.status === 'inactive') {
        await this.tenantManager.disconnectTenant(tenantId);
      }

      // Sincronizar estado de habilitação no StorefrontRegistry do Heart quando módulos ou status mudarem
      if (this.heartPrisma?.storefrontRegistry?.updateMany && (safeData.modulos !== undefined || safeData.status !== undefined)) {
        const updatedModules = typeof updated.modulos === 'string' ? JSON.parse(updated.modulos) : (updated.modulos || {});
        const shouldEnableRegistry = updated.status === 'active' && Boolean(updatedModules?.lojaVirtual);
        await this.heartPrisma.storefrontRegistry
          .updateMany({
            where: { tenantId },
            data: { enabled: shouldEnableRegistry },
          })
          .catch(() => {});
      }

      // Sincronizar com Teltech Leadger se ativo
      let leadgerResult: any = null;
      if (updated.leadgerSyncEnabled !== false && (clientFieldsChanged || baseFieldsChanged || data.forceLeadgerSync)) {
        try {
          const hasAmount = this.leadgerService.toBrlCents(updated.mensalidadeValor) > 0;
          if (hasAmount && updated.mensalidadeVencimento) {
            await this.leadgerService.ensureCurrentInvoiceForTenant(updated.id);
          }
          const eventType = hasAmount ? 'base.upsert' : 'client.upsert';
          leadgerResult = await this.leadgerService.enqueueAndDeliverLeadgerEvent({
            eventType,
            tenantId: updated.id,
            bumpClientVersion: clientFieldsChanged,
            bumpBaseVersion: baseFieldsChanged && hasAmount,
            awaitDelivery: false,
          });
        } catch (lErr: any) {
          this.logger.warn(`Aviso Leadger ao atualizar tenant ${tenantId}: ${lErr.message}`);
        }
      }

      const { certPfx, certSenha, ...safeUpdated } = updated as any;
      return { ...safeUpdated, leadger: leadgerResult };
    } catch (err: any) {
      this.logger.error(`Erro ao atualizar tenant ${tenantId}: ${err.message}`, err.stack);
      throw new BadRequestException(`Erro ao salvar dados no banco: ${err.message}`);
    }
  }

  /**
   * Acesso direto 1-clique (Impersonate) pelo /sys-init sem exigir senha do cliente.
   */
  async impersonateTenant(tenantId: string, userId?: string) {
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    if (!tenant.users || tenant.users.length === 0) {
      throw new BadRequestException('Esta empresa não possui usuários cadastrados.');
    }

    const targetUser = userId
      ? tenant.users.find((u) => u.id === userId)
      : tenant.users.find((u) => u.role === 'admin' && u.active) ||
        tenant.users.find((u) => u.active) ||
        tenant.users[0];

    if (!targetUser) {
      throw new NotFoundException('Usuário solicitado não encontrado nesta empresa.');
    }

    let effectiveGroupId: string | null = targetUser.groupId ?? null;
    if (
      !effectiveGroupId &&
      ['admin', 'superadmin', 'group_owner'].includes(targetUser.role) &&
      this.heartPrisma?.tenantGroupMember?.findFirst
    ) {
      const membership = await this.heartPrisma.tenantGroupMember
        .findFirst({
          where: { tenantId: tenant.id },
          select: { groupId: true },
        })
        .catch(() => null);
      if (membership?.groupId) {
        effectiveGroupId = membership.groupId;
      }
    }

    const effectiveRole = targetUser.role === 'group_owner' ? 'admin' : targetUser.role;

    const payload = {
      sub: targetUser.id,
      email: targetUser.email,
      tenantId: tenant.id,
      role: effectiveRole,
      groupId: effectiveGroupId,
      impersonatedBy: 'sys-init',
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: effectiveRole,
        groupId: effectiveGroupId,
        tenant: tenant.id,
        tenantName: tenant.nomeFantasia || tenant.name,
        logoUrl: tenant.logoUrl ?? null,
        termsAccepted: true,
      },
    };
  }

  /**
   * Raio-X operacional em tempo real do banco PostgreSQL do tenant.
   */
  async getTenantStats(tenantId: string) {
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');

    let dbSizeBytes = 0;
    try {
      const sizeRows = await this.heartPrisma.$queryRawUnsafe<Array<{ size_bytes: bigint | number }>>(
        `SELECT pg_database_size($1) AS size_bytes`,
        tenant.databaseName
      );
      if (sizeRows?.[0]?.size_bytes != null) {
        dbSizeBytes = Number(sizeRows[0].size_bytes);
      }
    } catch (e: any) {
      this.logger.warn(`Não foi possível consultar tamanho do banco ${tenant.databaseName}: ${e.message}`);
    }

    const prisma = await this.tenantManager.getTenantClient(tenantId, tenant.databaseUrl);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      totalRetailGroups,
      totalCategories,
      totalCustomers,
      totalSuppliers,
      totalOperators,
      openRegisters,
      totalSales,
      totalSalesToday,
      revenueAgg,
      revenueTodayAgg,
      totalNfceEmitidas,
      lastSale,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }).catch(() => 0),
      (prisma as any).retailGroup ? (prisma as any).retailGroup.count({ where: { active: true } }).catch(() => 0) : Promise.resolve(0),
      prisma.category.count().catch(() => 0),
      prisma.customer.count().catch(() => 0),
      prisma.supplier.count().catch(() => 0),
      prisma.operator.count({ where: { active: true } }).catch(() => 0),
      prisma.cashRegister.count({ where: { status: 'OPEN' } }).catch(() => 0),
      prisma.sale.count({ where: { status: { not: 'CANCELED' } } }).catch(() => 0),
      prisma.sale.count({ where: { status: { not: 'CANCELED' }, createdAt: { gte: startOfToday } } }).catch(() => 0),
      prisma.sale.aggregate({ where: { status: { not: 'CANCELED' } }, _sum: { total: true } }).catch(() => ({ _sum: { total: 0 } })),
      prisma.sale.aggregate({ where: { status: { not: 'CANCELED' }, createdAt: { gte: startOfToday } }, _sum: { total: true } }).catch(() => ({ _sum: { total: 0 } })),
      prisma.sale.count({ where: { nfceStatus: 'AUTORIZADA' } }).catch(() => 0),
      prisma.sale.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, total: true } }).catch(() => null),
    ]);

    return {
      tenantId: tenant.id,
      databaseName: tenant.databaseName,
      dbSizeBytes,
      totalProducts,
      totalRetailGroups,
      totalCategories,
      totalCustomers,
      totalSuppliers,
      totalOperators,
      openRegisters,
      totalSales,
      totalSalesToday,
      totalRevenue: Number(revenueAgg?._sum?.total || 0),
      revenueToday: Number(revenueTodayAgg?._sum?.total || 0),
      totalNfceEmitidas,
      lastSaleAt: lastSale?.createdAt || null,
      lastSaleTotal: lastSale?.total ? Number(lastSale.total) : null,
      checkedAt: new Date().toISOString(),
    };
  }

  async getLogoImage(id: string) {
    return this.heartPrisma.image.findUnique({ where: { id } });
  }

  async uploadLogo(tenantId: string, file: Express.Multer.File) {
    const image = await this.heartPrisma.image.create({
      data: {
        data: Buffer.from(file.buffer),
        mimeType: file.mimetype,
      }
    });
    
    const logoUrl = `/api/tenants/uploads/logos/${image.id}`;
    
    const updated = await this.heartPrisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl, clientVersion: { increment: 1 } },
    });

    this.tenantContext.evictTenantCache(tenantId);

    if (updated.leadgerSyncEnabled !== false) {
      this.leadgerService.enqueueAndDeliverLeadgerEvent({
        eventType: 'client.upsert',
        tenantId,
        awaitDelivery: false,
      }).catch(() => {});
    }

    return { message: 'Logo atualizado com sucesso.', logoUrl };
  }

  async uploadCertificado(tenantId: string, pfxBuffer: Buffer, senha: string) {
    return this.heartPrisma.tenant.update({
      where: { id: tenantId },
      data: {
        certPfx: Buffer.from(pfxBuffer),
        certSenha: senha,
        certValidade: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      },
    }).then(() => ({ message: 'Certificado armazenado com sucesso.' }));
  }

  async validatePin(pin: string): Promise<boolean> {
    const setupPin = process.env.SETUP_PIN || 'teltech352';
    const sqlPin = process.env.SQL_PIN;
    if (!pin) return false;
    return Boolean((setupPin && pin === setupPin) || (sqlPin && pin === sqlPin));
  }

  async migrateTenants(tenantIds: string[], includeHeart = false): Promise<any[]> {
    const results: any[] = [];

    if (includeHeart) {
      const heartSchemaPath = path.resolve(process.cwd(), 'prisma', 'heart.schema.prisma');
      const heartDbUrl = process.env.DATABASE_URL_HEART;

      this.logger.log('[Migracao] Iniciando atualização do banco Heart (master)...');

      if (!heartDbUrl) {
        results.push({
          tenantId: '__heart__',
          name: 'Banco Heart (master)',
          databaseName: 'heart',
          status: 'error',
          output: 'Variável de ambiente DATABASE_URL_HEART não encontrada no servidor.',
        });
      } else {
        try {
          await this.heartPrisma.ensureHeartColumnsAndTables();
          const { stdout } = await execAsync(
            `npx prisma db push --schema="${heartSchemaPath}" --skip-generate`,
            {
              env: { ...process.env, DATABASE_URL_HEART: heartDbUrl },
              timeout: 120000,
            }
          );

          results.push({
            tenantId: '__heart__',
            name: 'Banco Heart (master)',
            databaseName: 'heart',
            status: 'success',
            output: stdout || 'Schema Heart atualizado com sucesso.',
          });
          this.logger.log('[Migracao] Banco Heart atualizado com sucesso.');
        } catch (err: any) {
          this.logger.error(`[Migracao] Erro ao atualizar banco Heart: ${err.message}`);
          results.push({
            tenantId: '__heart__',
            name: 'Banco Heart (master)',
            databaseName: 'heart',
            status: 'error',
            output: `Erro na migração Heart:\n${err.stderr || err.message}\n${err.stdout || ''}`,
          });
        }
      }
    }

    const tenants = await this.heartPrisma.tenant.findMany({
      where: { id: { in: tenantIds } }
    });

    for (const tenant of tenants) {
      this.logger.log(`[Migracao] Iniciando atualizacao de schema do tenant: ${tenant.name} (${tenant.databaseName})`);
      try {
        const prismaSchemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
        const { stdout } = await upgradeTenantSchema(tenant.databaseUrl, () => execAsync(`npx prisma db push --schema="${prismaSchemaPath}" --skip-generate`, {
          env: {
            ...process.env,
            DATABASE_URL_TENANT: tenant.databaseUrl,
          },
          timeout: 60000,
        }));

        let seedResult = { criados: 0, existentes: 0 };
        try {
          const tenantClient = new PrismaClient({
            datasources: { db: { url: tenant.databaseUrl } },
          });
          await tenantClient.$connect();
          seedResult = await seedDefaultGruposStatic(tenantClient);

          const unnumberedSales = await (tenantClient.sale as any).findMany({
            where: { code: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true }
          });
          if (unnumberedSales.length > 0) {
            const maxSale = await (tenantClient.sale as any).findFirst({
              where: { code: { not: null } },
              orderBy: { code: 'desc' },
              select: { code: true }
            });
            let currentSaleCode = maxSale?.code || 0;
            for (const s of unnumberedSales) {
              currentSaleCode++;
              await (tenantClient.sale as any).update({
                where: { id: s.id },
                data: { code: currentSaleCode }
              });
            }
          }

          const unnumberedRegisters = await (tenantClient.cashRegister as any).findMany({
            where: { code: null },
            orderBy: { openingTime: 'asc' },
            select: { id: true }
          });
          if (unnumberedRegisters.length > 0) {
            const maxRegister = await (tenantClient.cashRegister as any).findFirst({
              where: { code: { not: null } },
              orderBy: { code: 'desc' },
              select: { code: true }
            });
            let currentRegCode = maxRegister?.code || 0;
            for (const r of unnumberedRegisters) {
              currentRegCode++;
              await (tenantClient.cashRegister as any).update({
                where: { id: r.id },
                data: { code: currentRegCode }
              });
            }
          }

          await tenantClient.$disconnect();
        } catch (seedErr: any) {
          this.logger.warn(`Pós-migração (seed/backfill) falhou para ${tenant.name}: ${seedErr.message}`);
        }

        results.push({
          tenantId: tenant.id,
          name: tenant.name,
          databaseName: tenant.databaseName,
          status: 'success',
          output: stdout || 'Schema atualizado com sucesso.',
          gruposSeed: seedResult,
        });
      } catch (err: any) {
        this.logger.error(`Erro ao rodar migracao em ${tenant.name}: ${err.message}`);
        results.push({
          tenantId: tenant.id,
          name: tenant.name,
          databaseName: tenant.databaseName,
          status: 'error',
          output: `Erro na migracao:\n${err.stderr || err.message}\n${err.stdout || ''}`
        });
      }
    }

    return results;
  }

  async getTenantCategories(tenantId: string) {
    const tenant = await this.heartPrisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.databaseUrl) return [];
    
    try {
      const tenantPrisma = await this.tenantManager.getTenantClient(tenantId, tenant.databaseUrl);
      return await tenantPrisma.category.findMany({ orderBy: { name: 'asc' } });
    } catch (e: any) {
      this.logger.error(`Erro ao buscar categorias do tenant ${tenantId}: ${e.message}`);
      return [];
    }
  }

  async provisionTenant(dto: ProvisionTenantDto) {
    const {
      pin, tenantName, dbName, adminName, adminEmail, adminPassword,
      seedProducts, mensalidadeValor, mensalidadeVencimento,
      cnpj, telefone, telefoneContato, emailContato, syncLeadger, syncWithLeadger,
    } = dto;

    const resolvedTelefone = (telefone || telefoneContato || '').trim() || null;
    const resolvedSyncLeadger =
      syncLeadger !== undefined
        ? syncLeadger !== false
        : syncWithLeadger !== undefined
        ? syncWithLeadger !== false
        : true;

    const pinValid = await this.validatePin(pin);
    if (!pinValid) {
      throw new UnauthorizedException('PIN inválido. Acesso negado.');
    }

    const rawSanitized = dbName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
    const sanitizedDbName = /^[0-9]/.test(rawSanitized)
      ? `t_${rawSanitized}`.slice(0, 63)
      : rawSanitized.slice(0, 63);

    if (
      !sanitizedDbName ||
      !(/^[a-z][a-z0-9_]{0,62}$/.test(sanitizedDbName)) ||
      ['postgres', 'template0', 'template1', 'heart', 'railway'].includes(sanitizedDbName)
    ) {
      throw new BadRequestException('Nome do banco inválido ou reservado após sanitização.');
    }

    const existingTenant = await this.heartPrisma.tenant.findFirst({
      where: { databaseName: sanitizedDbName },
    });
    if (existingTenant) {
      throw new BadRequestException(`Já existe um tenant com o banco "${sanitizedDbName}".`);
    }

    const existingUser = await this.heartPrisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new BadRequestException(`Já existe um usuário com o email "${adminEmail}".`);
    }

    const existingPgDb = await this.heartPrisma.$queryRaw<Array<{ exists: number }>>`
      SELECT 1 AS exists FROM pg_database WHERE datname = ${sanitizedDbName}
    `;
    if (!existingPgDb.length) {
      await this.heartPrisma.$executeRawUnsafe(
        `CREATE DATABASE "${sanitizedDbName}" ENCODING 'UTF8'`,
      );
    }

    const baseUrl = process.env.DATABASE_URL_HEART || '';
    const parsedUrl = new URL(baseUrl);
    parsedUrl.pathname = `/${sanitizedDbName}`;
    const tenantDbUrl = parsedUrl.toString();

    try {
      const prismaSchemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
      await execAsync(`npx prisma migrate deploy --schema="${prismaSchemaPath}"`, {
        env: {
          ...process.env,
          DATABASE_URL_TENANT: tenantDbUrl,
        },
        timeout: 60000,
      });
      await execAsync(`npx prisma db push --schema="${prismaSchemaPath}" --skip-generate`, {
        env: {
          ...process.env,
          DATABASE_URL_TENANT: tenantDbUrl,
        },
        timeout: 60000,
      });
    } catch (err: any) {
      try {
        await this.heartPrisma.$queryRaw`
          SELECT pg_terminate_backend(pid) FROM pg_stat_activity
          WHERE datname = ${sanitizedDbName} AND pid <> pg_backend_pid()
        `;
        await this.heartPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${sanitizedDbName}"`);
      } catch {}
      this.logger.error(`Erro no provisionamento do tenant ${tenantName}: ${err.stdout} ${err.stderr}`);
      throw new BadRequestException('Erro ao criar tabelas no novo banco. Detalhe: ' + (err.stderr || err.message));
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') || null : null;
    const rawModulos = dto.modulos && typeof dto.modulos === 'object' ? dto.modulos : {};
    const sanitizedModulos = {
      estoque: true,
      dashboardMobile: true,
      nfce: false,
      importacaoXml: false,
      lojaVirtual: false,
      entregaLojaVirtual: false,
      crediario: false,
      fornecedores: false,
      vendedores: false,
      inteligenciaComercial: false,
      vitrineDigital: false,
      multiEmpresa: false,
      filialMultiEmpresa: false,
      ...rawModulos,
      comandas: false,
      kds: false,
      restaurante: false,
      carvoaria: false,
    };

    const tenant = await this.heartPrisma.tenant.create({
      data: {
        name: tenantName,
        nomeFantasia: tenantName,
        databaseName: sanitizedDbName,
        databaseUrl: tenantDbUrl,
        status: 'active',
        tvPublicId: generateTvPublicId(),
        cnpj: cleanCnpj,
        telefone: resolvedTelefone,
        telefoneContato: resolvedTelefone,
        emailContato: emailContato || adminEmail || null,
        modulos: sanitizedModulos,
        mensalidadeValor: mensalidadeValor != null ? Number(mensalidadeValor) : 149.9,
        mensalidadeVencimento: mensalidadeVencimento ? new Date(mensalidadeVencimento) : null,
        leadgerSyncEnabled: resolvedSyncLeadger,
        users: {
          create: {
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            pin: '1234',
          },
        },
      },
      include: { users: true },
    });

    // Garantir IDs externos permanentes
    await this.leadgerService.ensureTenantExternalIds(tenant.id);

    try {
      await this.seedTenantProducts(tenantDbUrl, adminName, seedProducts !== false);
    } catch (err: any) {
      this.logger.warn(`Aviso: seed inicial para ${tenantName} falhou: ${err.message}`);
    }

    try {
      const tenantClient = new PrismaClient({
        datasources: { db: { url: tenantDbUrl } },
      });
      await tenantClient.$connect();
      const gruposResult = await seedDefaultGruposStatic(tenantClient);
      await tenantClient.$disconnect();
      this.logger.log(`Grupos tributários padrão criados para ${tenantName}: ${gruposResult.criados} criados.`);
    } catch (err: any) {
      this.logger.warn(`Aviso: seed de grupos tributários para ${tenantName} falhou: ${err.message}`);
    }

    // Criar fatura inicial e sincronizar com Leadger se aplicável
    let leadgerSync: any = null;
    if (resolvedSyncLeadger) {
      try {
        const hasAmount = this.leadgerService.toBrlCents(tenant.mensalidadeValor) > 0;
        let invoice: any = null;
        if (hasAmount && tenant.mensalidadeVencimento) {
          invoice = await this.leadgerService.ensureCurrentInvoiceForTenant(tenant.id);
        }
        leadgerSync = await this.leadgerService.enqueueAndDeliverLeadgerEvent({
          eventType: hasAmount ? 'base.upsert' : 'client.upsert',
          tenantId: tenant.id,
          invoiceId: invoice?.id,
          awaitDelivery: false,
        });
      } catch (lErr: any) {
        this.logger.warn(`Aviso Leadger no provisionamento de ${tenantName}: ${lErr.message}`);
      }
    }

    const adminPayload = {
      name: tenant.users[0]?.name,
      email: tenant.users[0]?.email,
      role: tenant.users[0]?.role,
    };

    return {
      message: `Tenant "${tenantName}" provisionado com sucesso!`,
      admin: adminPayload,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        databaseName: tenant.databaseName,
        admin: adminPayload,
      },
      leadgerSync,
    };
  }

  private async seedTenantProducts(databaseUrl: string, adminName = 'Administrador', includeCategories = true) {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const defaultPinHash = await bcrypt.hash('1234', 10);

      // Configurar PIN padrão do caixa e desconto (1234)
      await client.tenantSettings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: {
          id: 'singleton',
          cashierPin: defaultPinHash,
          discountPin: defaultPinHash,
        },
      });

      // Criar colaborador/operador gerente inicial (PIN 1234) se ainda não houver nenhum
      const existingOp = await client.operator.count();
      if (existingOp === 0) {
        await client.operator.create({
          data: {
            name: adminName || 'Administrador',
            pin: defaultPinHash,
            jobTitle: 'Gerente',
            active: true,
            isManager: true,
          },
        });
      }

      if (includeCategories) {
        for (const name of ['Camisetas', 'Calçados', 'Bonés', 'Relógios', 'Acessórios']) {
          await client.category.upsert({ where: { name }, create: { name }, update: {} });
        }
      }
    } finally {
      await client.$disconnect();
    }
  }

  async setDiscountPin(tenantId: string, pin: string) {
    const { databaseUrl } = this.tenantContext.get();
    const prisma = await this.tenantManager.getTenantClient(tenantId, databaseUrl);
    const hashed = await bcrypt.hash(pin, 10);
    await prisma.tenantSettings.upsert({
      where: { id: 'singleton' },
      update: { discountPin: hashed },
      create: { id: 'singleton', discountPin: hashed },
    });
    return { message: 'PIN de desconto configurado com sucesso.' };
  }

  async verifyDiscountPin(tenantId: string, pin: string): Promise<boolean> {
    const { databaseUrl } = this.tenantContext.get();
    const prisma = await this.tenantManager.getTenantClient(tenantId, databaseUrl);
    const settings = await prisma.tenantSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.discountPin) return false;
    return bcrypt.compare(pin, settings.discountPin);
  }

  async setCashierPin(tenantId: string, pin: string) {
    const { databaseUrl } = this.tenantContext.get();
    const prisma = await this.tenantManager.getTenantClient(tenantId, databaseUrl);
    const hashed = await bcrypt.hash(pin, 10);
    try {
      await prisma.tenantSettings.upsert({
        where: { id: 'singleton' },
        update: { cashierPin: hashed },
        create: { id: 'singleton', cashierPin: hashed },
      });
    } catch (err: any) {
      if (err?.code === 'P2022' || err?.message?.includes('cashierPin') || err?.message?.includes('Unknown column')) {
        try {
          await prisma.$executeRawUnsafe('ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "cashierPin" VARCHAR(191) NULL');
          await prisma.tenantSettings.upsert({
            where: { id: 'singleton' },
            update: { cashierPin: hashed },
            create: { id: 'singleton', cashierPin: hashed },
          });
        } catch (alterErr: any) {
          this.logger.error(`Erro ao criar coluna cashierPin dinamicamente: ${alterErr.message}`);
          throw err;
        }
      } else {
        throw err;
      }
    }
    return { message: 'PIN do Caixa configurado com sucesso.' };
  }

  async verifyCashierPin(tenantId: string, pin: string): Promise<{
    authorized: boolean;
    authType: 'cashier_pin' | 'manager_pin';
    managerOpId?: string;
    managerName?: string;
  }> {
    const { databaseUrl } = this.tenantContext.get();
    const prisma = await this.tenantManager.getTenantClient(tenantId, databaseUrl);
    
    try {
      const settings = await prisma.tenantSettings.findUnique({ where: { id: 'singleton' } });
      if (settings?.cashierPin && (await bcrypt.compare(pin, settings.cashierPin))) {
        return { authorized: true, authType: 'cashier_pin' };
      }
    } catch {}

    try {
      const managers = await prisma.operator.findMany({
        where: { isManager: true, active: true },
      });
      for (const mgr of managers) {
        if (mgr.pin && (await bcrypt.compare(pin, mgr.pin))) {
          return {
            authorized: true,
            authType: 'manager_pin',
            managerOpId: mgr.id,
            managerName: mgr.name,
          };
        }
      }
    } catch {}

    return { authorized: false, authType: 'cashier_pin' };
  }

  async deleteTenant(tenantId: string) {
    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    try {
      this.logger.log(`Excluindo banco de dados: ${tenant.databaseName}`);
      this.tenantContext.evictTenantCache(tenantId);
      await this.tenantManager.disconnectTenant(tenantId);
      await this.heartPrisma.$queryRaw`
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = ${tenant.databaseName} AND pid <> pg_backend_pid()
      `;
      if (/^[a-z0-9_]+$/i.test(tenant.databaseName)) {
        await this.heartPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${tenant.databaseName}"`);
      }
      this.logger.log(`Banco de dados ${tenant.databaseName} excluído com sucesso.`);
    } catch (e: any) {
      this.logger.error(`Falha ao excluir o banco de dados ${tenant.databaseName}: ${e.message}`);
    }

    await this.heartPrisma.tenant.delete({
      where: { id: tenantId }
    });

    return { success: true };
  }

  private addOneMonthSafe(date: Date): Date {
    const originalDay = date.getUTCDate();
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12, 0, 0));
    d.setUTCMonth(d.getUTCMonth() + 1);
    const lastDayOfNextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(originalDay, lastDayOfNextMonth));
    return d;
  }

  /**
   * Registra pagamento (+1 mês) ou estorno (refund) de mensalidade, com gestão de faturas e Leadger.
   */
  async registrarPagamento(tenantId: string, body?: any) {
    const payload = typeof body === 'string' ? { observacao: body } : (body || {});
    const action = payload.action || 'pay';

    const tenant = await this.leadgerService.ensureTenantExternalIds(tenantId);
    if (!tenant) throw new NotFoundException('Empresa não encontrada');

    // FLUXO A: ESTORNO DE PAGAMENTO (REFUND)
    if (action === 'refund') {
      const paymentLogId = payload.paymentLogId;
      const motivo = payload.observacao || payload.motivo || 'Estorno manual no /sys-init';
      if (!paymentLogId) throw new BadRequestException('paymentLogId é obrigatório para estornar.');

      const logItem = await this.heartPrisma.paymentLog.findFirst({
        where: { id: paymentLogId, tenantId },
      });
      if (!logItem) throw new NotFoundException('Registro de pagamento não encontrado.');
      if (logItem.estornado) throw new BadRequestException('Este pagamento já foi estornado.');

      await this.heartPrisma.paymentLog.update({
        where: { id: logItem.id },
        data: { estornado: true, estornadoEm: new Date() },
      });

      const rollbackDue = logItem.vencimentoAntes || tenant.mensalidadeVencimento || new Date();
      const updatedTenant = await this.heartPrisma.tenant.update({
        where: { id: tenantId },
        data: {
          mensalidadeVencimento: rollbackDue,
          baseVersion: { increment: 1 },
        },
      });

      await this.heartPrisma.paymentLog.create({
        data: {
          tenantId,
          invoiceId: logItem.invoiceId || null,
          valor: -Math.abs(Number(logItem.valor || 0)),
          paymentMethod: logItem.paymentMethod || 'pix',
          tipo: 'refund',
          vencimentoAntes: logItem.vencimentoApos || rollbackDue,
          vencimentoApos: rollbackDue,
          observacao: `ESTORNO: ${motivo}`,
          registradoPor: 'Admin (/sys-init)',
        },
      });

      let revertedInvoice: any = null;
      if (logItem.invoiceId) {
        revertedInvoice = await this.heartPrisma.tenantInvoice.update({
          where: { id: logItem.invoiceId },
          data: {
            status: 'pending',
            paidAt: null,
            notes: `Pagamento estornado em ${new Date().toLocaleDateString('pt-BR')}: ${motivo}`,
            version: { increment: 1 },
          },
        }).catch(() => null);
      }

      if (updatedTenant.leadgerSyncEnabled !== false) {
        if (revertedInvoice) {
          this.leadgerService.enqueueAndDeliverLeadgerEvent({
            eventType: 'invoice.upsert',
            tenantId,
            invoiceId: revertedInvoice.id,
            awaitDelivery: false,
          }).catch(() => {});
        }
        this.leadgerService.enqueueAndDeliverLeadgerEvent({
          eventType: 'base.upsert',
          tenantId,
          awaitDelivery: false,
        }).catch(() => {});
      }

      return updatedTenant;
    }

    // FLUXO B: PAGAMENTO NORMAL (+1 MÊS)
    const paymentMethod = this.leadgerService.mapPaymentMethodToLeadger(payload.paymentMethod || 'pix') || 'pix';
    const valorNum = payload.valorPago !== undefined
      ? Number(payload.valorPago)
      : Number(tenant.mensalidadeValor || 0);
    const amountCents = this.leadgerService.toBrlCents(valorNum);

    const vencimentoAntes = tenant.mensalidadeVencimento ? new Date(tenant.mensalidadeVencimento) : new Date();
    const vencimentoApos = this.addOneMonthSafe(vencimentoAntes);
    const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();
    const targetRefMonth = payload.referenceMonth || this.leadgerService.toReferenceMonth(vencimentoAntes);

    let paidInvoice: any = null;
    if (payload.invoiceId) {
      paidInvoice = await this.heartPrisma.tenantInvoice.update({
        where: { id: payload.invoiceId },
        data: {
          status: 'paid',
          paidAt,
          paymentMethod,
          amount: amountCents > 0 ? amountCents : undefined,
          notes: payload.observacao || undefined,
          version: { increment: 1 },
        },
      });
    } else if (amountCents > 0) {
      paidInvoice = await this.leadgerService.ensureCurrentInvoiceForTenant(tenantId, {
        referenceMonth: targetRefMonth,
        dueDate: vencimentoAntes,
        amountCents,
        status: 'paid',
        paidAt,
        paymentMethod,
        description: `Mensalidade ${targetRefMonth}`,
        notes: payload.observacao || undefined,
      });
    }

    const updatedTenant = await this.heartPrisma.tenant.update({
      where: { id: tenantId },
      data: {
        mensalidadeVencimento: vencimentoApos,
        status: 'active',
        baseVersion: { increment: 1 },
      },
    });
    this.tenantContext.evictTenantCache(tenantId);

    const nextRefMonth = this.leadgerService.toReferenceMonth(vencimentoApos);
    if (amountCents > 0 && nextRefMonth !== targetRefMonth) {
      const existingNext = await this.heartPrisma.tenantInvoice.findUnique({
        where: {
          tenantId_referenceMonth: {
            tenantId,
            referenceMonth: nextRefMonth,
          },
        },
      });
      if (!existingNext) {
        await this.leadgerService.ensureCurrentInvoiceForTenant(tenantId, {
          referenceMonth: nextRefMonth,
          dueDate: vencimentoApos,
          amountCents: this.leadgerService.toBrlCents(updatedTenant.mensalidadeValor) || amountCents,
          status: 'pending',
          description: `Mensalidade ${nextRefMonth}`,
        });
      }
    }

    await this.heartPrisma.paymentLog.create({
      data: {
        tenantId,
        invoiceId: paidInvoice?.id || null,
        valor: valorNum,
        paymentMethod,
        tipo: 'payment',
        vencimentoAntes,
        vencimentoApos,
        observacao: payload.observacao || `Pagamento confirmado (${paymentMethod.toUpperCase()})`,
        registradoPor: 'Admin (/sys-init)',
      },
    });

    if (updatedTenant.leadgerSyncEnabled !== false && paidInvoice) {
      this.leadgerService.enqueueAndDeliverLeadgerEvent({
        eventType: 'invoice.upsert',
        tenantId,
        invoiceId: paidInvoice.id,
        awaitDelivery: false,
      }).catch(() => {});
      this.leadgerService.enqueueAndDeliverLeadgerEvent({
        eventType: 'base.upsert',
        tenantId,
        awaitDelivery: false,
      }).catch(() => {});
    }

    return updatedTenant;
  }

  async getPaymentHistory(tenantId: string) {
    return this.heartPrisma.paymentLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getTenantInvoicesAndHistory(tenantId: string) {
    const [invoices, paymentHistory, tenant] = await Promise.all([
      this.heartPrisma.tenantInvoice.findMany({
        where: { tenantId },
        orderBy: { referenceMonth: 'desc' },
        take: 60,
      }),
      this.heartPrisma.paymentLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.heartPrisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          mensalidadeValor: true,
          mensalidadeVencimento: true,
          leadgerSyncEnabled: true,
          clientExternalId: true,
          baseExternalId: true,
        },
      }),
    ]);
    return {
      invoices,
      paymentHistory,
      paymentLogs: paymentHistory,
      tenant,
    };
  }

  async createOrUpsertTenantInvoice(tenantId: string, body: any) {
    const tenant = await this.leadgerService.ensureTenantExternalIds(tenantId);
    const dueDate = body.dueDate
      ? new Date(`${String(body.dueDate).slice(0, 10)}T12:00:00.000Z`)
      : tenant.mensalidadeVencimento
      ? new Date(tenant.mensalidadeVencimento)
      : new Date();

    const referenceMonth = body.referenceMonth || this.leadgerService.toReferenceMonth(dueDate);
    if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
      throw new BadRequestException('Competência deve estar no formato YYYY-MM.');
    }

    const amountCents = body.amountCents !== undefined
      ? Number(body.amountCents)
      : body.amountReais !== undefined
      ? this.leadgerService.toBrlCents(body.amountReais)
      : this.leadgerService.toBrlCents(tenant.mensalidadeValor);

    if (amountCents <= 0) {
      throw new BadRequestException('Valor da fatura deve ser maior que zero.');
    }

    const status = (body.status || 'pending') as 'pending' | 'paid' | 'cancelled';
    const paymentMethod = status === 'paid'
      ? this.leadgerService.mapPaymentMethodToLeadger(body.paymentMethod || 'pix') || 'pix'
      : null;

    const invoice = await this.leadgerService.ensureCurrentInvoiceForTenant(tenantId, {
      referenceMonth,
      dueDate,
      amountCents,
      status,
      paidAt: status === 'paid' ? new Date() : null,
      paymentMethod,
      description: body.description || `Mensalidade ${referenceMonth}`,
      notes: body.notes || undefined,
    });

    let leadgerResult: any = null;
    if (tenant.leadgerSyncEnabled !== false && body.syncLeadger !== false) {
      leadgerResult = await this.leadgerService.enqueueAndDeliverLeadgerEvent({
        eventType: 'invoice.upsert',
        tenantId,
        invoiceId: invoice.id,
        awaitDelivery: false,
      });
    }

    return { invoice, leadger: leadgerResult };
  }

  async updateTenantInvoice(tenantId: string, body: any) {
    const { invoiceId, action } = body;
    if (!invoiceId) throw new BadRequestException('invoiceId é obrigatório.');

    const existing = await this.heartPrisma.tenantInvoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!existing) throw new NotFoundException('Fatura não encontrada.');

    const updateData: Record<string, any> = {
      version: { increment: 1 },
    };

    if (action === 'cancel') {
      updateData.status = 'cancelled';
      updateData.notes = body.notes || existing.notes || 'Fatura cancelada no /sys-init';
    } else if (action === 'reopen') {
      updateData.status = 'pending';
      updateData.paidAt = null;
      updateData.notes = body.notes || 'Fatura reaberta para cobrança';
    } else if (action === 'mark_paid') {
      updateData.status = 'paid';
      updateData.paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
      updateData.paymentMethod = this.leadgerService.mapPaymentMethodToLeadger(body.paymentMethod || 'pix') || 'pix';
      if (body.notes !== undefined) updateData.notes = body.notes;
    } else {
      if (body.dueDate) {
        updateData.dueDate = new Date(`${String(body.dueDate).slice(0, 10)}T12:00:00.000Z`);
      }
      if (body.amountReais !== undefined) {
        const cents = this.leadgerService.toBrlCents(body.amountReais);
        if (cents <= 0) throw new BadRequestException('O valor deve ser maior que zero.');
        updateData.amount = cents;
      }
      if (body.description !== undefined) updateData.description = body.description;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.status && ['pending', 'paid', 'cancelled'].includes(body.status)) {
        updateData.status = body.status;
        if (body.status === 'paid' && !existing.paidAt) {
          updateData.paidAt = new Date();
          updateData.paymentMethod = this.leadgerService.mapPaymentMethodToLeadger(body.paymentMethod || existing.paymentMethod || 'pix');
        }
      }
    }

    const updated = await this.heartPrisma.tenantInvoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    if (action === 'edit' || (!action && (body.amountReais !== undefined || body.dueDate !== undefined))) {
      await this.heartPrisma.paymentLog.create({
        data: {
          tenantId,
          invoiceId: updated.id,
          valor: updated.amount / 100,
          paymentMethod: updated.paymentMethod || 'pix',
          tipo: 'correction',
          vencimentoAntes: existing.dueDate,
          vencimentoApos: updated.dueDate,
          observacao: `Correção de fatura (${updated.referenceMonth}): R$ ${(existing.amount / 100).toFixed(2)} -> R$ ${(updated.amount / 100).toFixed(2)}`,
          registradoPor: 'Admin (/sys-init)',
        },
      });
    }

    const tenant = await this.heartPrisma.tenant.findUnique({ where: { id: tenantId } });
    let leadgerResult: any = null;
    if (tenant?.leadgerSyncEnabled !== false && body.syncLeadger !== false) {
      leadgerResult = await this.leadgerService.enqueueAndDeliverLeadgerEvent({
        eventType: 'invoice.upsert',
        tenantId,
        invoiceId: updated.id,
        awaitDelivery: false,
      });
    }

    return { invoice: updated, leadger: leadgerResult };
  }

  async getTenantUsers(tenantId: string) {
    return this.heartPrisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pin: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async createTenantUser(tenantId: string, data: { name: string; email: string; password: string; role: string; pin?: string }) {
    const tenant = await this.heartPrisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const existing = await this.heartPrisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException(`Já existe um usuário com o email ${data.email}.`);

    const normalizedRole = String(data.role || 'operator').toLowerCase();
    const allowedRoles = ['admin', 'operator', 'stockist', 'manager'];
    const finalRole = allowedRoles.includes(normalizedRole) ? normalizedRole : 'operator';

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.heartPrisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: finalRole,
        pin: data.pin?.trim() || null,
        tenantId,
        active: true,
      },
      select: { id: true, name: true, email: true, role: true, pin: true, active: true, createdAt: true },
    });

    this.logger.log(`[Users] Usuário criado: ${user.name} (${user.role}) para tenant ${tenant.name}`);
    return user;
  }

  async updateTenantUser(
    tenantId: string,
    userId: string,
    data: { name?: string; email?: string; role?: string; active?: boolean; password?: string; pin?: string | null }
  ) {
    const user = await this.heartPrisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado nesta empresa.');

    const updateData: Record<string, any> = {};
    if (data.name !== undefined && data.name.trim()) updateData.name = data.name.trim();
    if (data.email !== undefined && data.email.trim() && data.email.trim() !== user.email) {
      const dup = await this.heartPrisma.user.findUnique({ where: { email: data.email.trim() } });
      if (dup && dup.id !== userId) {
        throw new BadRequestException(`O e-mail ${data.email} já está em uso.`);
      }
      updateData.email = data.email.trim();
    }
    if (data.role !== undefined) {
      const r = String(data.role).toLowerCase();
      if (['admin', 'operator', 'stockist', 'manager'].includes(r)) {
        updateData.role = r;
      }
    }
    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
    }
    if (data.password !== undefined && String(data.password).trim()) {
      updateData.password = await bcrypt.hash(String(data.password).trim(), 10);
    }
    if (data.pin !== undefined) {
      updateData.pin = data.pin ? String(data.pin).trim() : null;
    }

    return this.heartPrisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, pin: true, active: true, createdAt: true },
    });
  }

  async deleteTenantUser(tenantId: string, userId: string) {
    const user = await this.heartPrisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado nesta empresa.');

    const count = await this.heartPrisma.user.count({ where: { tenantId } });
    if (count <= 1) {
      throw new BadRequestException('Não é possível excluir o único usuário da empresa.');
    }

    await this.heartPrisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async resetUserPassword(tenantId: string, userId: string, newPasswordRaw: string) {
    return this.updateTenantUser(tenantId, userId, { password: newPasswordRaw });
  }

  async resetUserPin(tenantId: string, userId: string, newPin: string) {
    return this.updateTenantUser(tenantId, userId, { pin: newPin });
  }

  async syncMasterCatalogFromTenants(): Promise<{ synced: number; tenants: number; errors: string[] }> {
    const allTenants = await this.heartPrisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, databaseUrl: true },
    });

    let synced = 0;
    let tenantsProcessed = 0;
    const errors: string[] = [];

    for (const tenant of allTenants) {
      if (!tenant.databaseUrl) continue;
      const client = new PrismaClient({
        datasources: { db: { url: tenant.databaseUrl } },
      });

      try {
        await client.$connect();

        const products = await client.product.findMany({
          where: {
            barcode: { not: null },
            OR: [
              { imageUrl: { not: null } },
              { ncm: { not: null } },
            ],
          },
          select: {
            barcode: true,
            name: true,
            imageUrl: true,
            ncm: true,
            cest: true,
          },
        });

        for (const p of products) {
          if (!p.barcode) continue;

          const existing = await this.heartPrisma.masterProduct.findUnique({
            where: { ean: p.barcode },
          });

          if (!existing) {
            await this.heartPrisma.masterProduct.create({
              data: {
                ean: p.barcode,
                name: p.name,
                imageUrl: p.imageUrl || null,
                ncm: p.ncm || null,
                cest: (p.cest || null) as string | null,
                source: `tenant:${tenant.name}`,
              },
            });
            synced++;
          } else {
            const needsUpdate =
              (!existing.imageUrl && p.imageUrl) ||
              (!existing.ncm && p.ncm);

            if (needsUpdate) {
              await this.heartPrisma.masterProduct.update({
                where: { ean: p.barcode },
                data: {
                  imageUrl: existing.imageUrl || p.imageUrl || null,
                  ncm: existing.ncm || p.ncm || null,
                  cest: existing.cest || (p.cest as string | null) || null,
                },
              });
              synced++;
            }
          }
        }

        tenantsProcessed++;
      } catch (err: any) {
        const msg = `Erro ao processar tenant "${tenant.name}": ${err.message}`;
        this.logger.warn(msg);
        errors.push(msg);
      } finally {
        await client.$disconnect();
      }
    }

    return { synced, tenants: tenantsProcessed, errors };
  }

  async executeSqlQuery(sql: string, tenantId?: string, useHeart?: boolean): Promise<any> {
    const start = Date.now();
    const rawTrimmed = sql.trim().replace(/;\s*$/, '');
    const trimmed = /^SHOW\s+TABLES$/i.test(rawTrimmed)
      ? "SELECT tablename AS table_name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
      : rawTrimmed;

    const isSelect = /^SELECT\b/i.test(trimmed);
    const isShowOrDescribe = /^(SHOW|DESCRIBE|DESC|EXPLAIN)/i.test(trimmed);
    const isQuery = isSelect || isShowOrDescribe;
    const SQL_LIMIT = 500;

    let prisma: any;
    let dbLabel: string;

    if (useHeart || !tenantId) {
      prisma = this.heartPrisma;
      dbLabel = 'heart';
    } else {
      const tenant = await this.heartPrisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new BadRequestException('Tenant não encontrado.');
      prisma = await this.tenantManager.getTenantClient(tenantId, tenant.databaseUrl);
      dbLabel = tenant.databaseName;
    }

    this.logger.log(`[SQL Client] Executando no banco "${dbLabel}": ${trimmed.substring(0, 120)}...`);

    try {
      if (isQuery) {
        let finalSql = trimmed;
        if (isSelect && !/\bLIMIT\s+\d+/i.test(trimmed)) {
          finalSql = `${trimmed} LIMIT ${SQL_LIMIT}`;
        }

        const rows: any[] = await prisma.$queryRawUnsafe(finalSql);
        const durationMs = Date.now() - start;

        if (!rows || rows.length === 0) {
          return { type: 'query', columns: [], rows: [], rowCount: 0, durationMs };
        }

        const columns = Object.keys(rows[0]);
        const data = rows.map((row: any) =>
          columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return null;
            if (val instanceof Date) return val.toISOString();
            if (val instanceof Buffer) return `[Binary ${val.length}b]`;
            if (typeof val === 'bigint') return val.toString();
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
          })
        );

        return { type: 'query', columns, rows: data, rowCount: rows.length, durationMs, limited: isSelect && rows.length >= SQL_LIMIT };
      } else {
        const affected = await prisma.$executeRawUnsafe(trimmed);
        return { type: 'exec', rowsAffected: Number(affected), durationMs: Date.now() - start };
      }
    } catch (err: any) {
      this.logger.error(`[SQL Client] Erro no banco "${dbLabel}": ${err.message}`);
      throw new BadRequestException(err.message || 'Erro ao executar query SQL.');
    }
  }

  // ============================================================
  //  GESTÃO DE LEADS E CONTA DE DEMONSTRAÇÃO ISOLADA
  // ============================================================

  async captureDemoLead(rawName: string, rawWhatsapp: string) {
    const name = String(rawName || '').trim();
    if (name.length < 2) {
      throw new BadRequestException('Por favor, informe seu nome completo ou apelido.');
    }

    const whatsapp = normalizeWhatsapp(rawWhatsapp);
    if (!isValidWhatsapp(whatsapp)) {
      throw new BadRequestException('Informe um número de WhatsApp válido com DDD (10 ou 11 dígitos).');
    }

    const now = new Date();
    const existing = await this.heartPrisma.lead.findFirst({
      where: { whatsapp },
    });

    if (existing) {
      return this.heartPrisma.lead.update({
        where: { id: existing.id },
        data: {
          name,
          accessCount: { increment: 1 },
          lastAccessAt: now,
        },
      });
    }

    return this.heartPrisma.lead.create({
      data: {
        name,
        whatsapp,
        status: 'NOVO',
        source: 'demo',
        accessCount: 1,
        lastAccessAt: now,
      },
    });
  }

  async listLeads(statusFilter?: string, search?: string) {
    const where: any = {};
    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter;
    }
    if (search && search.trim()) {
      const term = search.trim();
      const digits = term.replace(/\D/g, '');
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
        ...(digits ? [{ whatsapp: { contains: digits } }] : [{ whatsapp: { contains: term } }]),
      ];
    }

    const [leads, allLeads] = await Promise.all([
      this.heartPrisma.lead.findMany({
        where,
        orderBy: [{ lastAccessAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.heartPrisma.lead.findMany({
        select: { status: true, accessCount: true, createdAt: true, lastAccessAt: true },
      }),
    ]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const summary = {
      total: allLeads.length,
      today: allLeads.filter(
        (l) => new Date(l.lastAccessAt || l.createdAt) >= startOfToday
      ).length,
      recurring: allLeads.filter((l) => (l.accessCount || 1) > 1).length,
      byStatus: {
        NOVO: allLeads.filter((l) => l.status === 'NOVO').length,
        EM_DEMO: allLeads.filter((l) => l.status === 'EM_DEMO').length,
        CONTATADO: allLeads.filter((l) => l.status === 'CONTATADO').length,
        CONVERTIDO: allLeads.filter((l) => l.status === 'CONVERTIDO').length,
        DESCARTADO: allLeads.filter((l) => l.status === 'DESCARTADO').length,
      },
    };

    return { leads, summary };
  }

  async updateLead(
    id: string,
    data: { name?: string; whatsapp?: string; status?: string; notes?: string | null },
  ) {
    const existing = await this.heartPrisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado.');

    const updateData: Record<string, any> = {};
    if (data.name !== undefined && data.name.trim()) {
      updateData.name = data.name.trim();
    }
    if (data.whatsapp !== undefined && data.whatsapp.trim()) {
      const clean = normalizeWhatsapp(data.whatsapp);
      if (!isValidWhatsapp(clean)) {
        throw new BadRequestException('Número de WhatsApp inválido.');
      }
      const dup = await this.heartPrisma.lead.findFirst({
        where: { whatsapp: clean, id: { not: id } },
      });
      if (dup) {
        throw new BadRequestException('Já existe outro lead cadastrado com este WhatsApp.');
      }
      updateData.whatsapp = clean;
    }
    if (data.status !== undefined) {
      const allowed = ['NOVO', 'EM_DEMO', 'CONTATADO', 'CONVERTIDO', 'DESCARTADO'];
      const upper = String(data.status).toUpperCase();
      if (!allowed.includes(upper)) {
        throw new BadRequestException('Status de lead inválido.');
      }
      updateData.status = upper;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes === null ? null : String(data.notes);
    }

    return this.heartPrisma.lead.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteLead(id: string) {
    const existing = await this.heartPrisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead não encontrado.');
    await this.heartPrisma.lead.delete({ where: { id } });
    return { success: true };
  }

  private enqueueDemoOperation<T>(task: () => Promise<T>): Promise<T> {
    const next = this.demoResetChain.then(task, task);
    this.demoResetChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  /**
   * Garante que o banco e o tenant isolado da Loja Demonstração existam,
   * estejam com todos os módulos liberados e reseta os dados para o estado habitual.
   */
  async ensureAndResetDemoStore(visitorName?: string) {
    return this.enqueueDemoOperation(async () => {
      const baseUrl = process.env.DATABASE_URL_HEART || process.env.DATABASE_URL_TENANT || '';
      if (!baseUrl) {
        throw new BadRequestException('URL de banco de dados não configurada no servidor.');
      }

      const parsedUrl = new URL(baseUrl);
      parsedUrl.pathname = `/${DEMO_DATABASE_NAME}`;
      const demoDbUrl = parsedUrl.toString();

      // 1. Garantir banco físico PostgreSQL para a demonstração
      const existingPgDb = await this.heartPrisma.$queryRaw<Array<{ exists: number }>>`
        SELECT 1 AS exists FROM pg_database WHERE datname = ${DEMO_DATABASE_NAME}
      `;
      if (!existingPgDb.length) {
        await this.heartPrisma.$executeRawUnsafe(
          `CREATE DATABASE "${DEMO_DATABASE_NAME}" ENCODING 'UTF8'`,
        );
      }

      // 2. Garantir registro do Tenant isolado no Heart (leadgerSyncEnabled = false)
      const demoModules = {
        nfce: true,
        estoque: true,
        crediario: true,
        dashboardMobile: true,
        importacaoXml: true,
        vitrineDigital: true,
        digitalSignage: true,
        lojaVirtual: true,
        entregaLojaVirtual: true,
        fornecedores: true,
        vendedores: true,
        inteligenciaComercial: true,
        multiEmpresa: true,
        comandas: false,
        kds: false,
        restaurante: false,
        carvoaria: false,
      };

      let tenant = await this.heartPrisma.tenant.findUnique({
        where: { databaseName: DEMO_DATABASE_NAME },
        include: { users: true },
      });

      const hashedPassword = await bcrypt.hash(DEMO_USER_PASSWORD, 10);

      if (!tenant) {
        tenant = await this.heartPrisma.tenant.create({
          data: {
            name: 'Loja Modelo Demonstração',
            nomeFantasia: 'Boutique & Calçados Modelo',
            razaoSocial: 'Comércio Varejista Modelo Demonstração LTDA',
            databaseName: DEMO_DATABASE_NAME,
            databaseUrl: demoDbUrl,
            status: 'active',
            tvPublicId: 'DEMOLOJA',
            crt: 1,
            logradouro: 'Av. Paulista',
            numero: '1000',
            bairro: 'Bela Vista',
            municipio: 'São Paulo',
            codMunicipio: '3550308',
            uf: 'SP',
            cep: '01310100',
            telefone: '11999990000',
            telefoneContato: '11999990000',
            emailContato: DEMO_USER_EMAIL,
            nfceAtivo: true,
            nfceAmbiente: 2,
            nfceSerie: 1,
            modulos: demoModules,
            mensalidadeValor: 0,
            mensalidadeVencimento: null,
            leadgerSyncEnabled: false,
            termsAcceptedAt: new Date(),
          },
          include: { users: true },
        });
      } else {
        tenant = await this.heartPrisma.tenant.update({
          where: { id: tenant.id },
          data: {
            databaseUrl: demoDbUrl,
            status: 'active',
            modulos: demoModules,
            nfceAtivo: true,
            nfceAmbiente: 2,
            leadgerSyncEnabled: false,
            termsAcceptedAt: tenant.termsAcceptedAt || new Date(),
          },
          include: { users: true },
        });
      }

      this.tenantContext.evictTenantCache(tenant.id);

      // 3. Garantir usuário administrador demo@lojista.local e equipe demonstrativa
      let adminUser = await this.heartPrisma.user.findUnique({
        where: { email: DEMO_USER_EMAIL },
      });

      if (!adminUser) {
        adminUser = await this.heartPrisma.user.create({
          data: {
            tenantId: tenant.id,
            name: visitorName ? `${visitorName} (Demonstração)` : 'Administrador Demonstração',
            email: DEMO_USER_EMAIL,
            password: hashedPassword,
            role: 'admin',
            pin: DEMO_OPERATOR_PIN,
            active: true,
          },
        });
      } else {
        adminUser = await this.heartPrisma.user.update({
          where: { id: adminUser.id },
          data: {
            tenantId: tenant.id,
            name: visitorName ? `${visitorName} (Demonstração)` : 'Administrador Demonstração',
            password: hashedPassword,
            role: 'admin',
            pin: DEMO_OPERATOR_PIN,
            active: true,
          },
        });
      }

      // Garantir usuários extras de equipe (Caixa e Estoquista) para a aba Equipe
      const extraStaff = [
        { email: 'caixa.demo@lojista.local', name: 'Lucas Atendimento (Caixa)', role: 'operator' },
        { email: 'estoque.demo@lojista.local', name: 'Mariana Grade (Estoquista)', role: 'stockist' },
      ];
      for (const staff of extraStaff) {
        const existingStaff = await this.heartPrisma.user.findUnique({
          where: { email: staff.email },
        });
        if (!existingStaff) {
          await this.heartPrisma.user.create({
            data: {
              tenantId: tenant.id,
              name: staff.name,
              email: staff.email,
              password: hashedPassword,
              role: staff.role,
              pin: DEMO_OPERATOR_PIN,
              active: true,
            },
          });
        } else if (existingStaff.tenantId !== tenant.id || !existingStaff.active) {
          await this.heartPrisma.user.update({
            where: { id: existingStaff.id },
            data: { tenantId: tenant.id, active: true, role: staff.role },
          });
        }
      }

      // 4. Conectar ao banco da demonstração e garantir que o schema existe
      const client = await this.tenantManager.getTenantClient(tenant.id, demoDbUrl);
      const tableCheck = await client.$queryRaw<Array<{ exists: number }>>`
        SELECT 1 AS exists FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'retail_groups'
      `.catch(() => []);

      if (!tableCheck.length) {
        const prismaSchemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
        await upgradeTenantSchema(demoDbUrl, () =>
          execAsync(`npx prisma migrate deploy --schema="${prismaSchemaPath}"`, {
            env: {
              ...process.env,
              DATABASE_URL_TENANT: demoDbUrl,
            },
            timeout: 60000,
          }),
        );
      }

      // 5. Resetar estado habitual completo da demonstração
      const seeded = await resetDemoDatabaseState(client, visitorName);

      return {
        tenant,
        adminUser,
        primaryOperator: seeded.primaryOperator,
        openRegister: seeded.openRegister,
      };
    });
  }

  /**
   * Reseta a conta de demonstração ao estado habitual quando o usuário fecha/sai da loja.
   */
  async resetExistingDemoStore() {
    return this.enqueueDemoOperation(async () => {
      const tenant = await this.heartPrisma.tenant.findUnique({
        where: { databaseName: DEMO_DATABASE_NAME },
      });
      if (!tenant || !tenant.databaseUrl) {
        return { reset: false, reason: 'demo_not_initialized' };
      }

      const client = await this.tenantManager.getTenantClient(tenant.id, tenant.databaseUrl);
      await resetDemoDatabaseState(client);
      return { reset: true, tenantId: tenant.id, resetAt: new Date().toISOString() };
    });
  }
}
