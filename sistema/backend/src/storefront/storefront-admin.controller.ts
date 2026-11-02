import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { productImageOptimizer } from '../images/product-image.optimizer';
import { HeartPrismaService } from '../prisma/heart-prisma.service';
import { StorefrontAdminService } from './storefront-admin.service';
import { StorefrontOrdersService } from './storefront-orders.service';
import {
  assertStorefrontAdminRole,
  assertStorefrontCatalogRole,
  assertStorefrontFulfillmentRole,
  assertStorefrontOrderManageRole,
  assertStorefrontOrderViewRole,
} from './storefront.rules';

@Controller('storefront/admin')
@UseGuards(JwtAuthGuard)
export class StorefrontAdminController {
  constructor(
    private readonly adminService: StorefrontAdminService,
    private readonly ordersService: StorefrontOrdersService,
    private readonly heartPrisma: HeartPrismaService,
  ) {}

  @Get('overview')
  async getOverview(@Req() req: any) {
    assertStorefrontOrderViewRole(req);
    return this.adminService.getOverview();
  }

  @Get('settings')
  async getSettings(@Req() req: any) {
    assertStorefrontOrderViewRole(req);
    return this.adminService.getSettings();
  }

  @Put('settings')
  async updateSettings(@Req() req: any, @Body() body: any) {
    assertStorefrontAdminRole(req);
    return this.adminService.updateSettings(body);
  }

  @Put('appearance/draft')
  async saveAppearanceDraft(@Req() req: any, @Body() body: any) {
    assertStorefrontAdminRole(req);
    return this.adminService.saveAppearanceDraft(body);
  }

  @Post('appearance/publish')
  async publishStorefront(@Req() req: any) {
    assertStorefrontAdminRole(req);
    return this.adminService.publishStorefront({
      userId: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.email,
    });
  }

  @Post('appearance/unpublish')
  async unpublishStorefront(@Req() req: any) {
    assertStorefrontAdminRole(req);
    return this.adminService.unpublishStorefront();
  }

  @Post('media/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadStorefrontMedia(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertStorefrontCatalogRole(req);
    if (!file || !file.buffer) {
      throw new BadRequestException('Envie um arquivo de imagem válido.');
    }
    const optimized = await productImageOptimizer.optimize(file.buffer);
    const created = await this.heartPrisma.image.create({
      data: {
        data: Buffer.from(optimized.data),
        mimeType: optimized.mimeType,
      },
    });
    return {
      imageUrl: `/api/products/uploads/images/${created.id}`,
      width: optimized.width,
      height: optimized.height,
      bytes: optimized.data.length,
    };
  }

  @Get('categories')
  async getCategories(@Req() req: any) {
    assertStorefrontOrderViewRole(req);
    return this.adminService.getCategories();
  }

  @Put('categories')
  async updateCategories(@Req() req: any, @Body() body: { categories: any[] }) {
    assertStorefrontCatalogRole(req);
    const list = Array.isArray(body?.categories)
      ? body.categories
      : Array.isArray(body)
        ? body
        : [];
    return this.adminService.updateCategories(list);
  }

  @Post('categories')
  async createCategory(@Req() req: any, @Body() body: any) {
    assertStorefrontCatalogRole(req);
    return this.adminService.createCategory(body);
  }

  @Get('products')
  async getProducts(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('visibility') visibility?: 'all' | 'visible' | 'hidden',
    @Query('featured') featured?: string,
  ) {
    assertStorefrontOrderViewRole(req);
    return this.adminService.getProducts({
      search,
      categoryId,
      visibility: visibility || 'all',
      featured: featured === 'true' ? true : undefined,
    });
  }

  @Put('products/:retailGroupId')
  async updateProduct(
    @Req() req: any,
    @Param('retailGroupId') retailGroupId: string,
    @Body() body: any,
  ) {
    assertStorefrontCatalogRole(req);
    return this.adminService.updateProduct(retailGroupId, body);
  }

  @Post('products/batch')
  async batchUpdateProducts(@Req() req: any, @Body() body: any) {
    assertStorefrontCatalogRole(req);
    return this.adminService.batchUpdateProducts(body);
  }

  @Get('orders')
  async listOrders(
    @Req() req: any,
    @Query('commercialStatus') commercialStatus?: string,
    @Query('fulfillmentStatus') fulfillmentStatus?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    assertStorefrontOrderViewRole(req);
    return this.ordersService.listAdminOrders({
      commercialStatus,
      fulfillmentStatus,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Get('orders/:id')
  async getOrderById(@Req() req: any, @Param('id') id: string) {
    assertStorefrontOrderViewRole(req);
    return this.ordersService.getAdminOrderById(id);
  }

  @Post('orders/:id/confirm')
  async confirmOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    assertStorefrontOrderManageRole(req);
    return this.ordersService.confirmOrder(id, body || {}, {
      userId: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.email,
    });
  }

  @Post('orders/:id/reject')
  async rejectOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    assertStorefrontOrderManageRole(req);
    return this.ordersService.rejectOrCancelOrder(id, 'REJECTED', body || {}, {
      userId: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.email,
    });
  }

  @Post('orders/:id/cancel')
  async cancelOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    assertStorefrontOrderManageRole(req);
    return this.ordersService.rejectOrCancelOrder(id, 'CANCELLED', body || {}, {
      userId: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.email,
    });
  }

  @Put('orders/:id/fulfillment')
  async updateFulfillment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    assertStorefrontFulfillmentRole(req);
    return this.ordersService.updateFulfillmentStatus(id, body || {}, {
      userId: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.email,
    });
  }

  @Post('orders/:id/convert-to-sale')
  async convertToSale(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    assertStorefrontOrderManageRole(req);
    return this.ordersService.convertOrderToSale(id, body || {}, {
      userId: req.user?.userId || req.user?.id,
      name: req.user?.name || req.user?.email,
    });
  }
}
