import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RetailCatalogService } from './retail-catalog.service';
import { RetailReturnsService } from './retail-returns.service';
import { RetailOverviewService } from './retail-overview.service';
import { RetailIntelligenceService } from './retail-intelligence.service';

function requireRole(req: any, roles: string[]) {
  if (!roles.includes(req.user?.role))
    throw new ForbiddenException(
      'Seu perfil não tem permissão para esta operação.',
    );
}

@Controller('retail')
@UseGuards(JwtAuthGuard)
export class RetailController {
  constructor(
    private readonly catalog: RetailCatalogService,
    private readonly returns: RetailReturnsService,
    private readonly overview: RetailOverviewService,
    private readonly intelligence: RetailIntelligenceService,
  ) {}
  @Get('overview') getOverview(
    @Request() req: any,
    @Query('startDate') start: string,
    @Query('endDate') end: string,
  ) {
    requireRole(req, ['admin', 'superadmin']);
    return this.overview.overview(start, end);
  }
  @Get('intelligence') getIntelligence(
    @Request() req: any,
    @Query('startDate') start: string,
    @Query('endDate') end: string,
  ) {
    requireRole(req, ['admin', 'superadmin']);
    return this.intelligence.getIntelligence(start, end);
  }
  @Put('intelligence/goals') updateIntelligenceGoals(
    @Request() req: any,
    @Body() body: any,
  ) {
    requireRole(req, ['admin', 'superadmin']);
    return this.intelligence.updateGoals(body);
  }
  @Get('groups') list(@Query() query: any) {
    return this.catalog.list(query);
  }
  @Get('ungrouped') ungrouped(@Query('search') search?: string) {
    return this.catalog.ungrouped(search);
  }
  @Get('groups/:id') group(@Param('id') id: string) {
    return this.catalog.find(id);
  }
  @Post('groups') create(@Request() req: any, @Body() body: any) {
    requireRole(req, ['admin', 'superadmin', 'stockist']);
    return this.catalog.save(null, body);
  }
  @Put('groups/:id') update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    requireRole(req, ['admin', 'superadmin', 'stockist']);
    return this.catalog.save(id, body);
  }
  @Get('credits/:customerId') credits(@Param('customerId') id: string) {
    return this.returns.credits(id);
  }
  @Get('returns') listReturns(@Request() req: any) {
    requireRole(req, ['admin', 'superadmin']);
    return this.returns.list();
  }
  @Get('returns/sale/:reference') returnSale(
    @Request() req: any,
    @Param('reference') reference: string,
  ) {
    requireRole(req, ['admin', 'superadmin']);
    return this.returns.sale(reference);
  }
  @Post('returns') createReturn(@Request() req: any, @Body() body: any) {
    requireRole(req, ['admin', 'superadmin']);
    return this.returns.create(body);
  }
}
