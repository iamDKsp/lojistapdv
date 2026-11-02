import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { StorefrontOrdersService } from './storefront-orders.service';
import { StorefrontPublicService } from './storefront-public.service';

@Controller('storefront/public')
export class StorefrontPublicController {
  private readonly rateBuckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly publicService: StorefrontPublicService,
    private readonly ordersService: StorefrontOrdersService,
  ) {}

  private assertRateLimit(
    req: any,
    bucketName: string,
    maxPerMinute: number,
  ): void {
    const ip =
      String(
        req?.headers?.['x-forwarded-for'] ||
          req?.ip ||
          req?.socket?.remoteAddress ||
          'anon',
      )
        .split(',')[0]
        .trim() || 'anon';
    const key = `${bucketName}:${ip}`;
    const now = Date.now();
    const entry = this.rateBuckets.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.rateBuckets.size > 5000) {
        for (const [k, v] of this.rateBuckets.entries()) {
          if (v.resetAt <= now) this.rateBuckets.delete(k);
        }
      }
      this.rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }
    entry.count += 1;
    if (entry.count > maxPerMinute) {
      throw new HttpException(
        'Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getOriginUrl(req: any): string | undefined {
    const proto =
      req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http';
    const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
    if (!host) return undefined;
    return `${String(proto).split(',')[0].trim()}://${String(host).split(',')[0].trim()}`;
  }

  @Get(':slug')
  async getStorefrontHome(
    @Param('slug') slug: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertRateLimit(req, 'store-home', 120);
    res.setHeader(
      'Cache-Control',
      'public, max-age=5, stale-while-revalidate=15',
    );
    return this.publicService.getStorefrontHome(slug);
  }

  @Get(':slug/products')
  async listProducts(
    @Param('slug') slug: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('size') size?: string,
    @Query('color') color?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('featured') featured?: string,
    @Query('inStockOnly') inStockOnly?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertRateLimit(req, 'store-products', 120);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return this.publicService.listProducts(slug, {
      search,
      categoryId,
      categorySlug,
      size,
      color,
      minPrice: minPrice !== undefined && minPrice !== '' ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : undefined,
      featured: featured === 'true' ? true : undefined,
      inStockOnly: inStockOnly === 'true',
      sort,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 24,
    });
  }

  @Get(':slug/products/:productSlug')
  async getProductDetail(
    @Param('slug') slug: string,
    @Param('productSlug') productSlug: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertRateLimit(req, 'store-product-detail', 120);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return this.publicService.getProductBySlug(slug, productSlug);
  }

  @Post(':slug/cart/validate')
  async validateCart(
    @Param('slug') slug: string,
    @Body() body: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertRateLimit(req, 'cart-validate', 60);
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    return this.publicService.validateCart(slug, body);
  }

  @Post(':slug/orders')
  async createOrder(
    @Param('slug') slug: string,
    @Body() body: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertRateLimit(req, 'create-order', 20);
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    return this.ordersService.createPublicOrder(
      slug,
      body,
      this.getOriginUrl(req),
    );
  }

  @Get(':slug/orders/:reference')
  async getOrderStatus(
    @Param('slug') slug: string,
    @Param('reference') reference: string,
    @Query('token') queryToken: string,
    @Headers('x-order-token') headerToken: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertRateLimit(req, 'order-lookup', 45);
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    const token = String(headerToken || queryToken || '').trim();
    return this.ordersService.getPublicOrderByReference(
      slug,
      reference,
      token,
      this.getOriginUrl(req),
    );
  }

  @Get(':slug/share-meta')
  async getShareMeta(
    @Param('slug') slug: string,
    @Query('productSlug') productSlug?: string,
  ) {
    return this.publicService.getShareMetadata(slug, productSlug);
  }
}
