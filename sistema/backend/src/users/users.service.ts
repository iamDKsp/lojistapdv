import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { TenantConnectionManager } from '../prisma/tenant-prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private heartPrisma: HeartPrismaService,
    private tenantManager: TenantConnectionManager,
    private tenantContext: TenantContextService,
  ) {}

  private async syncOperatorInTenantDb(
    tenantId: string,
    opts: { previousName?: string; name: string; role: string; rawPin?: string; active?: boolean; imageUrl?: string | null }
  ) {
    try {
      const { databaseUrl } = this.tenantContext.get();
      if (!databaseUrl) return;
      const prisma = await this.tenantManager.getTenantClient(tenantId, databaseUrl);
      const searchNames = [opts.previousName, opts.name]
        .filter(Boolean)
        .map((n) => String(n).trim());

      const existing = await prisma.operator.findFirst({
        where: { name: { in: searchNames } },
      });

      const isAdminRole = opts.role === 'admin' || opts.role === 'superadmin' || opts.role === 'manager';
      const defaultJobTitle = isAdminRole ? 'Gerente' : 'Caixa';
      let targetOpId: string | null = null;

      if (existing) {
        const updateOp: any = {
          name: opts.name.trim(),
          isManager: isAdminRole,
        };
        if (opts.active !== undefined) updateOp.active = opts.active;
        if (opts.rawPin && /^\d{4,6}$/.test(opts.rawPin.trim())) {
          updateOp.pin = await bcrypt.hash(opts.rawPin.trim(), 10);
        }
        await prisma.operator.update({
          where: { id: existing.id },
          data: updateOp,
        });
        targetOpId = existing.id;
      } else if (opts.role !== 'stockist') {
        const pinToHash = opts.rawPin && /^\d{4,6}$/.test(opts.rawPin.trim()) ? opts.rawPin.trim() : '1234';
        const hashedPin = await bcrypt.hash(pinToHash, 10);
        const createdOp = await prisma.operator.create({
          data: {
            name: opts.name.trim(),
            pin: hashedPin,
            jobTitle: defaultJobTitle,
            active: opts.active ?? true,
            isManager: isAdminRole,
          },
        });
        targetOpId = createdOp.id;
      }

      if (targetOpId && opts.imageUrl !== undefined) {
        await this.heartPrisma.$executeRawUnsafe(
          `INSERT INTO "operator_profiles" ("tenant_id", "operator_id", "image_url", "updated_at")
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT ("tenant_id", "operator_id")
           DO UPDATE SET "image_url" = EXCLUDED."image_url", "updated_at" = CURRENT_TIMESTAMP`,
          tenantId,
          targetOpId,
          opts.imageUrl ? String(opts.imageUrl).trim() : null,
        ).catch(() => {});
      }
    } catch {
      // Silencioso para não bloquear o fluxo principal
    }
  }

  async findAll(tenantId: string) {
    return this.heartPrisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        imageUrl: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async create(tenantId: string, data: any) {
    if (data.role === 'admin') {
      const adminCount = await this.heartPrisma.user.count({
        where: { tenantId, role: 'admin' }
      });
      if (adminCount >= 1) {
        throw new BadRequestException('Limite atingido: Já existe 1 Administrador neste sistema.');
      }
    }

    const existingUser = await this.heartPrisma.user.findUnique({
      where: { email: data.email }
    });
    if (existingUser) {
      throw new BadRequestException('Já existe um usuário cadastrado com este e-mail.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const rawPin = data.pin && /^\d{4,6}$/.test(String(data.pin).trim()) ? String(data.pin).trim() : '1234';
    const hashedPin = await bcrypt.hash(rawPin, 10);
    const cleanImageUrl = data.imageUrl ? String(data.imageUrl).trim() : null;

    const created = await this.heartPrisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role || 'operator',
        pin: hashedPin,
        imageUrl: cleanImageUrl,
        tenantId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        imageUrl: true,
        active: true,
      }
    });

    await this.syncOperatorInTenantDb(tenantId, {
      name: created.name,
      role: created.role,
      rawPin,
      active: true,
      imageUrl: cleanImageUrl,
    });

    return created;
  }

  async toggleStatus(tenantId: string, id: string) {
    const user = await this.heartPrisma.user.findFirst({
      where: { id, tenantId }
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.role === 'admin') throw new BadRequestException('Não é possível inativar o Administrador principal.');

    const updated = await this.heartPrisma.user.update({
      where: { id },
      data: { active: !user.active },
      select: { id: true, active: true }
    });

    await this.syncOperatorInTenantDb(tenantId, {
      name: user.name,
      role: user.role,
      active: updated.active,
    });

    return updated;
  }

  async update(tenantId: string, id: string, data: any) {
    const user = await this.heartPrisma.user.findFirst({
      where: { id, tenantId }
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // 1. Impedir alteração de role de admin para outra coisa
    if (user.role === 'admin' && data.role && data.role !== 'admin') {
      throw new BadRequestException('Não é possível alterar a função do Administrador principal.');
    }

    // 2. Impedir promoção de outro usuário para admin se já houver um admin
    if (data.role === 'admin' && user.role !== 'admin') {
      const adminCount = await this.heartPrisma.user.count({
        where: { tenantId, role: 'admin' }
      });
      if (adminCount >= 1) {
        throw new BadRequestException('Limite atingido: Já existe 1 Administrador neste sistema.');
      }
    }

    // 3. Impedir e-mail duplicado
    if (data.email && data.email !== user.email) {
      const existingUser = await this.heartPrisma.user.findUnique({
        where: { email: data.email }
      });
      if (existingUser) {
        throw new BadRequestException('Já existe um usuário cadastrado com este e-mail.');
      }
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.role) updateData.role = data.role;
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl ? String(data.imageUrl).trim() : null;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    
    if (data.pin) {
      updateData.pin = await bcrypt.hash(data.pin, 10);
    }

    const updated = await this.heartPrisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        imageUrl: true,
        active: true,
      }
    });

    await this.syncOperatorInTenantDb(tenantId, {
      previousName: user.name,
      name: updated.name,
      role: updated.role,
      rawPin: data.pin,
      active: updated.active,
      imageUrl: data.imageUrl !== undefined ? updated.imageUrl : undefined,
    });

    return updated;
  }
}
