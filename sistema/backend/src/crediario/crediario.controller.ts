import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContextService } from '../prisma/tenant-context.service';
import { CrediarioService } from './crediario.service';
import { CrediarioCronService } from './crediario-cron.service';

function requireRole(req: any, roles: string[]) {
  const userRole = String(req.user?.role || '').toLowerCase();
  const normalizedAllowed = roles.map((r) => r.toLowerCase());
  if (!normalizedAllowed.includes(userRole)) {
    throw new ForbiddenException(
      'Seu perfil não tem permissão para esta operação.',
    );
  }
}

@Controller('crediario')
@UseGuards(JwtAuthGuard)
export class CrediarioController {
  constructor(
    private readonly crediarioService: CrediarioService,
    private readonly crediarioCron: CrediarioCronService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('overview')
  getOverview(@Request() req: any) {
    requireRole(req, ['admin', 'superadmin', 'manager', 'operator']);
    return this.crediarioService.getOverview();
  }

  @Get('settings')
  getSettings(@Request() req: any) {
    requireRole(req, ['admin', 'superadmin', 'manager', 'operator']);
    return this.crediarioService.getSettings();
  }

  @Put('settings')
  updateSettings(@Request() req: any, @Body() body: any) {
    requireRole(req, ['admin', 'superadmin']);
    return this.crediarioService.updateSettings(body);
  }

  @Get('customers')
  listCustomers(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
  ) {
    requireRole(req, ['admin', 'superadmin', 'manager', 'operator']);
    return this.crediarioService.listCustomers({ search, filter });
  }

  @Get('customers/:customerId')
  getCustomerAccount(@Param('customerId') customerId: string) {
    // Acessível também pelo operador no PDV para consultar limite e saldo ao vender no fiado
    return this.crediarioService.getCustomerAccount(customerId);
  }

  @Put('customers/:customerId/credit')
  updateCustomerCredit(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Body() body: any,
  ) {
    requireRole(req, ['admin', 'superadmin', 'manager']);
    return this.crediarioService.updateCustomerCredit(customerId, body);
  }

  @Get('receivables')
  listReceivables(
    @Request() req: any,
    @Query('filter') filter?: string,
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
  ) {
    requireRole(req, ['admin', 'superadmin', 'manager', 'operator']);
    return this.crediarioService.listReceivables({
      filter,
      customerId,
      search,
    });
  }

  @Post('receivables/manual')
  createManualReceivable(@Request() req: any, @Body() body: any) {
    requireRole(req, ['admin', 'superadmin', 'manager']);
    return this.crediarioService.createManualReceivable(body);
  }

  @Post('payments')
  registerPayment(@Request() req: any, @Body() body: any) {
    requireRole(req, ['admin', 'superadmin', 'manager', 'operator']);
    return this.crediarioService.registerPayment(body);
  }

  @Post('receivables/:id/remind')
  sendManualReminder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body?: { message?: string },
  ) {
    requireRole(req, ['admin', 'superadmin', 'manager']);
    return this.crediarioService.sendManualReminder(id, body?.message);
  }

  @Post('run-billing')
  async runBillingNow(@Request() req: any) {
    requireRole(req, ['admin', 'superadmin']);
    const { storeName } = await this.crediarioService.requireModuleEnabled();
    const { tenantId, databaseUrl } = this.tenantContext.get();
    return this.crediarioCron.processTenantBilling(
      tenantId,
      databaseUrl,
      storeName,
      undefined,
      undefined,
      true,
    );
  }

  @Get('logs')
  getLogs(@Request() req: any, @Query('limit') limit?: string) {
    requireRole(req, ['admin', 'superadmin', 'manager']);
    return this.crediarioService.getLogs(limit ? Number(limit) : 50);
  }

  @Get('whatsapp/status')
  getWhatsappStatus(@Request() req: any) {
    requireRole(req, ['admin', 'superadmin', 'manager']);
    return this.crediarioService.getWhatsappStatus();
  }

  @Post('whatsapp/connect')
  connectWhatsapp(
    @Request() req: any,
    @Body() body?: { resetSession?: boolean },
  ) {
    requireRole(req, ['admin', 'superadmin']);
    return this.crediarioService.connectWhatsapp(Boolean(body?.resetSession));
  }

  @Post('whatsapp/disconnect')
  disconnectWhatsapp(@Request() req: any) {
    requireRole(req, ['admin', 'superadmin']);
    return this.crediarioService.disconnectWhatsapp();
  }

  @Post('whatsapp/test')
  sendTestWhatsapp(
    @Request() req: any,
    @Body() body: { phone: string; message?: string },
  ) {
    requireRole(req, ['admin', 'superadmin']);
    return this.crediarioService.sendTestWhatsapp(body?.phone, body?.message);
  }
}
