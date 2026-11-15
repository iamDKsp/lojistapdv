import { Injectable, Optional } from '@nestjs/common';
import { HeartPrismaService } from './heart-prisma.service';

export interface ActorRefInput {
  id?: string | null;
  operatorId?: string | null;
  userId?: string | null;
  name?: string | null;
  imageUrl?: string | null;
}

export interface ResolvedActorInfo {
  id: string | null;
  name: string | null;
  imageUrl: string | null;
}

export class TenantActorPhotoLookup {
  private readonly byOperatorId = new Map<string, string>();
  private readonly userById = new Map<
    string,
    { id: string; name: string; imageUrl: string | null; role?: string | null }
  >();
  private readonly opById = new Map<
    string,
    {
      id: string;
      name: string;
      jobTitle?: string | null;
      isManager?: boolean;
      active?: boolean;
    }
  >();
  private readonly imageByNormName = new Map<string, string>();

  constructor(params: {
    profiles?: Array<{ operatorId: string; imageUrl?: string | null }>;
    users?: Array<{
      id: string;
      name?: string | null;
      imageUrl?: string | null;
      role?: string | null;
    }>;
    operators?: Array<{
      id: string;
      name?: string | null;
      jobTitle?: string | null;
      isManager?: boolean;
      active?: boolean;
    }>;
  }) {
    for (const p of params.profiles || []) {
      if (p?.operatorId && p?.imageUrl) {
        this.byOperatorId.set(p.operatorId, p.imageUrl);
      }
    }

    for (const op of params.operators || []) {
      if (!op?.id) continue;
      this.opById.set(op.id, {
        id: op.id,
        name: op.name || 'Operador',
        jobTitle: op.jobTitle ?? null,
        isManager: op.isManager,
        active: op.active,
      });
      const opImg = this.byOperatorId.get(op.id);
      if (opImg && op.name) {
        this.registerNameImage(op.name, opImg);
      }
    }

    for (const u of params.users || []) {
      if (!u?.id) continue;
      this.userById.set(u.id, {
        id: u.id,
        name: u.name || 'Usuário',
        imageUrl: u.imageUrl ?? null,
        role: u.role ?? null,
      });
      if (u.imageUrl && u.name) {
        this.registerNameImage(u.name, u.imageUrl);
      }
    }
  }

  private registerNameImage(rawName: string, imageUrl: string) {
    const exact = EntityPhotoResolverService.normalizeName(rawName);
    if (exact && !this.imageByNormName.has(exact)) {
      this.imageByNormName.set(exact, imageUrl);
    }
    const stripped = EntityPhotoResolverService.normalizeBaseName(rawName);
    if (stripped && !this.imageByNormName.has(stripped)) {
      this.imageByNormName.set(stripped, imageUrl);
    }
  }

  private lookupImageByName(rawName?: string | null): string | null {
    if (!rawName) return null;
    const exact = EntityPhotoResolverService.normalizeName(rawName);
    if (exact && this.imageByNormName.has(exact)) {
      return this.imageByNormName.get(exact) || null;
    }
    const stripped = EntityPhotoResolverService.normalizeBaseName(rawName);
    if (stripped && this.imageByNormName.has(stripped)) {
      return this.imageByNormName.get(stripped) || null;
    }
    return null;
  }

  private normalizeRef(
    refOrId?: ActorRefInput | string | null,
  ): ActorRefInput | null {
    if (!refOrId) return null;
    if (typeof refOrId === 'string') {
      return { id: refOrId };
    }
    return refOrId;
  }

  resolveImageUrl(refOrId?: ActorRefInput | string | null): string | null {
    const ref = this.normalizeRef(refOrId);
    if (!ref) return null;
    if (typeof ref.imageUrl === 'string' && ref.imageUrl.trim()) {
      return ref.imageUrl.trim();
    }

    const candidateOpIds = [ref.operatorId, ref.id].filter(Boolean) as string[];
    for (const opId of candidateOpIds) {
      const direct = this.byOperatorId.get(opId);
      if (direct) return direct;
    }

    const candidateUserIds = [ref.userId, ref.id, ref.operatorId].filter(
      Boolean,
    ) as string[];
    for (const uid of candidateUserIds) {
      const u = this.userById.get(uid);
      if (u?.imageUrl) return u.imageUrl;
    }

    for (const opId of candidateOpIds) {
      const op = this.opById.get(opId);
      if (op?.name) {
        const byOpName = this.lookupImageByName(op.name);
        if (byOpName) return byOpName;
      }
    }

    for (const uid of candidateUserIds) {
      const u = this.userById.get(uid);
      if (u?.name) {
        const byUserName = this.lookupImageByName(u.name);
        if (byUserName) return byUserName;
      }
    }

    if (ref.name) {
      const byName = this.lookupImageByName(ref.name);
      if (byName) return byName;
    }

    return null;
  }

  resolveName(
    refOrId?: ActorRefInput | string | null,
    fallback: string | null = null,
  ): string | null {
    const ref = this.normalizeRef(refOrId);
    if (!ref) return fallback;
    if (typeof ref.name === 'string' && ref.name.trim()) {
      return ref.name.trim();
    }

    const candidateOpIds = [ref.operatorId, ref.id].filter(Boolean) as string[];
    for (const opId of candidateOpIds) {
      const op = this.opById.get(opId);
      if (op?.name) return op.name;
    }

    const candidateUserIds = [ref.userId, ref.id, ref.operatorId].filter(
      Boolean,
    ) as string[];
    for (const uid of candidateUserIds) {
      const u = this.userById.get(uid);
      if (u?.name) return u.name;
    }

    return fallback;
  }

  resolveActor(
    refOrId?: ActorRefInput | string | null,
    fallbackName: string | null = null,
  ): ResolvedActorInfo {
    const ref = this.normalizeRef(refOrId);
    const id = ref?.operatorId || ref?.userId || ref?.id || null;
    const name = this.resolveName(ref, fallbackName);
    const imageUrl = this.resolveImageUrl({ ...(ref || {}), name });
    return { id, name, imageUrl };
  }

  hydrateOperator<T extends Record<string, any> | null | undefined>(
    operator: T,
  ): any {
    if (!operator) return null;
    const imageUrl = this.resolveImageUrl({
      operatorId: operator.id,
      name: operator.name,
      imageUrl: operator.imageUrl,
    });
    return EntityPhotoResolverService.stripOperatorSecret(operator, imageUrl);
  }
}

@Injectable()
export class EntityPhotoResolverService {
  constructor(
    @Optional() private readonly heartPrisma?: HeartPrismaService,
  ) {}

  static normalizeName(name?: string | null): string {
    return String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  static normalizeBaseName(name?: string | null): string {
    return EntityPhotoResolverService.normalizeName(
      String(name || '').replace(/\s*\([^)]*\)\s*/g, ' '),
    );
  }

  static resolveProductImageUrl(
    product: any,
    fallbackGroupImageUrl?: string | null,
  ): string | null {
    if (!product) return fallbackGroupImageUrl || null;
    const direct =
      typeof product.imageUrl === 'string' && product.imageUrl.trim()
        ? product.imageUrl.trim()
        : null;
    if (direct) return direct;

    const groupImg =
      typeof product.retailGroup?.imageUrl === 'string' &&
      product.retailGroup.imageUrl.trim()
        ? product.retailGroup.imageUrl.trim()
        : null;
    if (groupImg) return groupImg;

    if (typeof fallbackGroupImageUrl === 'string' && fallbackGroupImageUrl.trim()) {
      return fallbackGroupImageUrl.trim();
    }
    return null;
  }

  static withResolvedProductImage<
    T extends Record<string, any> | null | undefined,
  >(product: T, fallbackGroupImageUrl?: string | null): T {
    if (!product) return product;
    return {
      ...product,
      imageUrl: EntityPhotoResolverService.resolveProductImageUrl(
        product,
        fallbackGroupImageUrl,
      ),
    };
  }

  static resolveGroupImageUrl(group: any): string | null {
    if (!group) return null;
    if (typeof group.imageUrl === 'string' && group.imageUrl.trim()) {
      return group.imageUrl.trim();
    }
    const candidates = Array.isArray(group.variants)
      ? group.variants
      : Array.isArray(group.products)
        ? group.products
        : [];
    for (const v of candidates) {
      if (typeof v?.imageUrl === 'string' && v.imageUrl.trim()) {
        return v.imageUrl.trim();
      }
    }
    return null;
  }

  static stripOperatorSecret(
    operator: Record<string, any> | null | undefined,
    imageUrl?: string | null,
  ): any {
    if (!operator) return null;
    const { pin: _pin, password: _password, ...safe } = operator as any;
    return {
      ...safe,
      imageUrl: imageUrl ?? safe.imageUrl ?? null,
    };
  }

  async loadTenantActors(
    tenantId?: string | null,
    tenantPrisma?: any,
  ): Promise<TenantActorPhotoLookup> {
    if (!tenantId) {
      return new TenantActorPhotoLookup({});
    }

    const profilesPromise = this.heartPrisma?.operatorProfile?.findMany
      ? this.heartPrisma.operatorProfile
          .findMany({
            where: { tenantId },
            select: { operatorId: true, imageUrl: true },
          })
          .catch(() => [])
      : Promise.resolve([]);

    const usersPromise = this.heartPrisma?.user?.findMany
      ? this.heartPrisma.user
          .findMany({
            where: { tenantId },
            select: { id: true, name: true, imageUrl: true, role: true },
          })
          .catch(() => [])
      : Promise.resolve([]);

    const operatorsPromise = tenantPrisma?.operator?.findMany
      ? tenantPrisma.operator
          .findMany({
            select: {
              id: true,
              name: true,
              jobTitle: true,
              isManager: true,
              active: true,
            },
          })
          .catch(() => [])
      : Promise.resolve([]);

    const [profiles, users, operators] = await Promise.all([
      profilesPromise,
      usersPromise,
      operatorsPromise,
    ]);

    return new TenantActorPhotoLookup({ profiles, users, operators });
  }

  async resolveSingleActorImage(
    tenantId: string | null | undefined,
    ref: ActorRefInput,
    tenantPrisma?: any,
  ): Promise<string | null> {
    const lookup = await this.loadTenantActors(tenantId, tenantPrisma);
    return lookup.resolveImageUrl(ref);
  }
}
