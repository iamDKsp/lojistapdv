import { Global, Module } from '@nestjs/common';
import { HeartPrismaService } from './heart-prisma.service';
import { TenantConnectionManager } from './tenant-prisma.service';
import { TenantContextService } from './tenant-context.service';
import { EntityPhotoResolverService } from './entity-photo-resolver.service';

@Global()
@Module({
  providers: [
    HeartPrismaService,
    TenantConnectionManager,
    TenantContextService,
    EntityPhotoResolverService,
  ],
  exports: [
    HeartPrismaService,
    TenantConnectionManager,
    TenantContextService,
    EntityPhotoResolverService,
  ],
})
export class PrismaModule {}
