import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { HeartPrismaService } from './heart-prisma.service';

export interface TenantContext {
  tenantId: string;
  databaseUrl: string;
  userId: string;
}

@Injectable()
export class TenantContextService {
  private static readonly storage = new AsyncLocalStorage<TenantContext>();
  private static readonly urlCache = new Map<string, { url: string; status: string; expiresAt: number }>();

  run<R>(context: TenantContext, callback: () => R): R {
    return TenantContextService.storage.run(context, callback);
  }

  get(): TenantContext {
    const context = TenantContextService.storage.getStore();
    if (!context) {
      throw new Error('TenantContext não inicializado para este request.');
    }
    return context;
  }

  getCachedEntry(tenantId: string) {
    const cached = TenantContextService.urlCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
    return null;
  }

  setCachedEntry(tenantId: string, url: string, status: string, ttlMs: number) {
    TenantContextService.urlCache.set(tenantId, {
      url,
      status,
      expiresAt: Date.now() + ttlMs,
    });
  }

  evictTenantCache(tenantId: string) {
    TenantContextService.urlCache.delete(tenantId);
  }
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly CACHE_TTL = 1000 * 60 * 5; // 5 minutos de cache (com invalidação imediata ao editar/suspender)

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly heartPrisma: HeartPrismaService
  ) {}

  private async getDatabaseUrl(tenantId: string): Promise<string> {
    if (tenantId === 'demo-tenant-001') {
      if (process.env.APP_MODE !== 'demo' || !process.env.DATABASE_URL_TENANT) {
        throw new UnauthorizedException('Tenant de demonstração indisponível.');
      }
      return process.env.DATABASE_URL_TENANT;
    }

    const cached = this.tenantContext.getCachedEntry(tenantId);
    if (cached) {
      if (cached.status === 'suspended' || cached.status === 'inactive') {
        throw new UnauthorizedException('O acesso desta loja encontra-se suspenso. Entre em contato com o suporte.');
      }
      return cached.url;
    }

    const tenant = await this.heartPrisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException('Acesso negado: Loja não encontrada.');
    }

    this.tenantContext.setCachedEntry(tenantId, tenant.databaseUrl, tenant.status, this.CACHE_TTL);

    if (tenant.status === 'suspended' || tenant.status === 'inactive') {
      throw new UnauthorizedException('O acesso desta loja encontra-se suspenso. Entre em contato com o suporte.');
    }

    return tenant.databaseUrl;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return next.handle();

    return from(this.getDatabaseUrl(user.tenantId)).pipe(
      switchMap((databaseUrl) => {
        const tenantContext: TenantContext = {
          tenantId: user.tenantId,
          databaseUrl,
          userId: user.id || user.sub,
        };

        return new Observable((observer) => {
          this.tenantContext.run(tenantContext, () => {
            next.handle().subscribe(observer);
          });
        });
      })
    );
  }
}
