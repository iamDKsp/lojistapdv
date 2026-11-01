import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { RetailCatalogService } from './retail-catalog.service';
import { RetailReturnsService } from './retail-returns.service';
import { RetailController } from './retail.controller';
import { RetailOverviewService } from './retail-overview.service';

@Module({
  imports: [ProductsModule],
  providers: [
    RetailCatalogService,
    RetailReturnsService,
    RetailOverviewService,
  ],
  controllers: [RetailController],
})
export class RetailModule {}
