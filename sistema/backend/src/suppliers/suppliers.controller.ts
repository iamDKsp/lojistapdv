import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { TenantsService } from '../tenants/tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly tenantsService: TenantsService,
  ) {}

  private async assertSetupPin(req: any, bodyPin?: string) {
    const pin = (req.headers['x-setup-pin'] || req.query?.['pin'] || bodyPin) as string;
    const valid = await this.tenantsService.validatePin(pin);
    if (!valid) {
      throw new UnauthorizedException('PIN administrativo do Sys-Init inválido.');
    }
  }

  // --- Sys-Init Admin Routes (Protected by Setup PIN) ---

  @Get('setup/sp-hub')
  async listSpHubAdmin(@Request() req: any) {
    await this.assertSetupPin(req);
    return this.suppliersService.ensureAndGetSpWholesaleHub(true);
  }

  @Post('setup/sp-hub/seed')
  async seedSpHubDefaults(@Request() req: any, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    return this.suppliersService.resetSpHubDefaults();
  }

  @Post('setup/sp-hub')
  async createSpHubSupplier(@Request() req: any, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    return this.suppliersService.createSpHubSupplier(body);
  }

  @Patch('setup/sp-hub/:id')
  async updateSpHubSupplier(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    return this.suppliersService.updateSpHubSupplier(id, body);
  }

  @Delete('setup/sp-hub/:id')
  async deleteSpHubSupplier(@Request() req: any, @Param('id') id: string) {
    await this.assertSetupPin(req);
    return this.suppliersService.deleteSpHubSupplier(id);
  }

  // --- Retailer Hub Atacado SP Routes (Protected by JWT) ---

  @UseGuards(JwtAuthGuard)
  @Get('sp-hub')
  getSpWholesaleHub() {
    return this.suppliersService.ensureAndGetSpWholesaleHub(false);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sp-hub/:id/import')
  importSpHubSupplier(@Param('id') hubSupplierId: string) {
    return this.suppliersService.importSpHubSupplierToTenant(hubSupplierId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sp-hub/:id/order-request')
  createSpHubOrderRequest(@Param('id') hubSupplierId: string, @Body() body: any) {
    return this.suppliersService.createSpHubOrderRequest(hubSupplierId, body);
  }

  // --- Local Tenant Suppliers CRUD ---

  @UseGuards(JwtAuthGuard)
  @Post()
  createSupplier(@Request() req: any, @Body() body: any) {
    return this.suppliersService.createSupplier(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getSuppliers(@Request() req: any) {
    return this.suppliersService.getSuppliers();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getSupplierById(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.getSupplierById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateSupplier(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.suppliersService.updateSupplier(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteSupplier(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.deleteSupplier(id);
  }

  // --- Supplier Catalog ---

  @UseGuards(JwtAuthGuard)
  @Post(':id/products')
  addSupplierProduct(
    @Request() req: any,
    @Param('id') supplierId: string,
    @Body() body: { productId: string; expectedCost?: number },
  ) {
    return this.suppliersService.addSupplierProduct(supplierId, body.productId, body.expectedCost);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/products/:productId')
  removeSupplierProduct(
    @Request() req: any,
    @Param('id') supplierId: string,
    @Param('productId') productId: string,
  ) {
    return this.suppliersService.removeSupplierProduct(supplierId, productId);
  }
}
