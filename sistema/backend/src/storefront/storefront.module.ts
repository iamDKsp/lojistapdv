import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesModule } from '../sales/sales.module';
import { StorefrontAdminController } from './storefront-admin.controller';
import { StorefrontAdminService } from './storefront-admin.service';
import { StorefrontDeliveryService } from './storefront-delivery.service';
import { StorefrontOrdersService } from './storefront-orders.service';
import { StorefrontPublicController } from './storefront-public.controller';
import { StorefrontPublicService } from './storefront-public.service';

@Module({
  imports: [PrismaModule, SalesModule],
  controllers: [StorefrontAdminController, StorefrontPublicController],
  providers: [
    StorefrontDeliveryService,
    StorefrontAdminService,
    StorefrontPublicService,
    StorefrontOrdersService,
  ],
  exports: [
    StorefrontDeliveryService,
    StorefrontAdminService,
    StorefrontPublicService,
    StorefrontOrdersService,
  ],
})
export class StorefrontModule {}
