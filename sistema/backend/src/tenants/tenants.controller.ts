import {
  Controller, Get, Post, Patch, Delete, Body, UseGuards, Param, Res,
  UnauthorizedException, ForbiddenException, Request, UseInterceptors,
  UploadedFile, BadRequestException, Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantsService } from './tenants.service';
import { LeadgerWebhookService } from './leadger-webhook.service';
import { ProvisionTenantDto } from './provision-tenant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly leadgerService: LeadgerWebhookService,
    private readonly jwtService: JwtService,
  ) {}

  private async assertSetupPin(req: any, bodyPin?: string) {
    const pin = (req.headers['x-setup-pin'] || req.query?.['pin'] || bodyPin) as string;
    const valid = await this.tenantsService.validatePin(pin);
    if (!valid) throw new UnauthorizedException('PIN inválido.');
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: any) {
    if (req.user.role !== 'superadmin') {
      throw new UnauthorizedException('Somente admins podem listar empresas SaaS');
    }
    return this.tenantsService.findAll();
  }

  /** Lista tenants protegida por PIN — usada pelo sys-init sem JWT */
  @Get('setup/list')
  async listByPin(@Request() req: any) {
    await this.assertSetupPin(req);
    return this.tenantsService.findAll();
  }

  /** Executa migração de banco de dados para os tenants selecionados (protegido por PIN) */
  @Post('setup/migrate')
  async migrateTenants(@Request() req: any, @Body() body: { tenantIds: string[]; includeHeart?: boolean }) {
    await this.assertSetupPin(req);

    const hasIds = body.tenantIds && Array.isArray(body.tenantIds) && body.tenantIds.length > 0;
    if (!hasIds && !body.includeHeart) {
      throw new BadRequestException('Nenhum banco selecionado para migração.');
    }

    return this.tenantsService.migrateTenants(body.tenantIds || [], body.includeHeart ?? false);
  }

  /** Painel Teltech Leadger Webhook Outbox (GET status) */
  @Get('setup/leadger')
  async getLeadgerStatus(
    @Request() req: any,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    await this.assertSetupPin(req);
    return this.leadgerService.getLeadgerPanelStatus(
      tenantId,
      status,
      limit ? Number(limit) : 50,
    );
  }

  /** Painel Teltech Leadger Webhook Outbox (POST ações) */
  @Post('setup/leadger')
  async handleLeadgerAction(@Request() req: any, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    try {
      return await this.leadgerService.handleLeadgerPanelAction(body);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Erro ao processar ação do Leadger.');
    }
  }

  /** Painel de Leads da Demonstração (/sys-init) */
  @Get('setup/leads')
  async listLeads(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    await this.assertSetupPin(req);
    return this.tenantsService.listLeads(status, search);
  }

  @Patch('setup/leads/:leadId')
  async updateLead(
    @Request() req: any,
    @Param('leadId') leadId: string,
    @Body() body: { name?: string; whatsapp?: string; status?: string; notes?: string | null; pin?: string },
  ) {
    await this.assertSetupPin(req, body?.pin);
    return this.tenantsService.updateLead(leadId, body);
  }

  @Delete('setup/leads/:leadId')
  async deleteLead(@Request() req: any, @Param('leadId') leadId: string) {
    await this.assertSetupPin(req);
    return this.tenantsService.deleteLead(leadId);
  }

  /** Reset manual da Loja Demonstração pelo /sys-init */
  @Post('setup/demo-reset')
  async resetDemoSetup(@Request() req: any, @Body() body?: { pin?: string }) {
    await this.assertSetupPin(req, body?.pin);
    return this.tenantsService.ensureAndResetDemoStore();
  }

  /** Executa query SQL diretamente em qualquer banco (protegido por PIN do sys-init + PIN exclusivo SQL) */
  @Post('setup/sql')
  async executeSql(
    @Request() req: any,
    @Body() body: { sql: string; tenantId?: string; useHeart?: boolean }
  ) {
    await this.assertSetupPin(req);

    const sqlPin = req.headers['x-sql-pin'] as string;
    const expectedSqlPin = process.env.SQL_PIN || process.env.SETUP_PIN || 'teltech352';
    if (!expectedSqlPin || !sqlPin || sqlPin !== expectedSqlPin) {
      throw new UnauthorizedException('PIN do SQL editor inválido.');
    }

    if (!body.sql?.trim()) throw new BadRequestException('Query SQL vazia.');

    return this.tenantsService.executeSqlQuery(body.sql, body.tenantId, body.useHeart);
  }

  @Post('setup/validate-pin')
  async validatePin(@Body() body: { pin: string }) {
    const valid = await this.tenantsService.validatePin(body.pin);
    if (!valid) throw new UnauthorizedException('PIN inválido.');
    return { valid: true };
  }

  /** Endpoint público — protegido por PIN via variável de ambiente */
  @Post('setup')
  async setup(@Body() body: ProvisionTenantDto) {
    return this.tenantsService.provisionTenant(body);
  }

  /** Acesso 1-clique (Impersonate) na loja pelo sys-init */
  @Post('setup/:id/impersonate')
  async impersonateSetup(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body?: { userId?: string },
  ) {
    await this.assertSetupPin(req);
    return this.tenantsService.impersonateTenant(id, body?.userId);
  }

  /** Raio-X operacional em tempo real do banco do tenant */
  @Get('setup/:id/stats')
  async getTenantStats(@Request() req: any, @Param('id') id: string) {
    await this.assertSetupPin(req);
    return this.tenantsService.getTenantStats(id);
  }

  /** Faturas / Competências mensais + histórico de pagamentos */
  @Get('setup/:id/invoices')
  async getTenantInvoices(@Request() req: any, @Param('id') id: string) {
    await this.assertSetupPin(req);
    return this.tenantsService.getTenantInvoicesAndHistory(id);
  }

  @Post('setup/:id/invoices')
  async createTenantInvoice(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    return this.tenantsService.createOrUpsertTenantInvoice(id, body);
  }

  @Patch('setup/:id/invoices')
  async updateTenantInvoice(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    return this.tenantsService.updateTenantInvoice(id, body);
  }

  /**
   * Retorna dados completos do tenant do usuário logado (para tela de configurações)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    return this.tenantsService.findById(req.user.tenantId);
  }

  /**
   * Atualiza dados textuais da empresa (dados, endereço, NFC-e config)
   */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'admin') {
      throw new UnauthorizedException('Somente Gerentes podem alterar configurações da empresa.');
    }
    return this.tenantsService.updateTenant(req.user.tenantId, body);
  }

  /** Atualiza dados do tenant via sys-init (protegido por PIN) */
  @Patch('setup/:id')
  async updateTenantSetup(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    return this.tenantsService.updateTenant(id, body);
  }

  /**
   * Atualiza dados textuais de qualquer empresa (para painel sys-init)
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateTenant(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    if (req.user.role !== 'superadmin' && !(req.user.role === 'admin' && req.user.tenantId === id)) {
      throw new UnauthorizedException('Permissão negada.');
    }
    return this.tenantsService.updateTenant(id, body);
  }

  /**
   * Upload do certificado A1 (.pfx) — salvo como BLOB
   */
  @UseGuards(JwtAuthGuard)
  @Post('me/certificado')
  @UseInterceptors(FileInterceptor('certPfx'))
  async uploadCertificado(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      throw new UnauthorizedException('Permissão negada.');
    }
    if (!file) throw new BadRequestException('Arquivo .pfx não enviado.');
    if (!body.certSenha) throw new BadRequestException('Senha do certificado não informada.');

    return this.tenantsService.uploadCertificado(req.user.tenantId, file.buffer, body.certSenha);
  }

  /** Upload de logotipo para White Label via sys-init (protegido por PIN) */
  @Post('setup/:id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogoSetup(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.assertSetupPin(req);
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    return this.tenantsService.uploadLogo(id, file);
  }

  /**
   * Upload de logotipo para White Label
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (req.user.role !== 'superadmin' && !(req.user.role === 'admin' && req.user.tenantId === id)) {
      throw new UnauthorizedException('Permissão negada.');
    }
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    return this.tenantsService.uploadLogo(id, file);
  }

  @Get('uploads/logos/:filename')
  async serveLogo(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const image = await this.tenantsService.getLogoImage(filename);
      if (image) {
        res.setHeader('Content-Type', image.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(Buffer.from(image.data));
        return;
      }
    } catch {}

    const filePath = join(process.cwd(), 'uploads/logos', filename);
    if (!existsSync(filePath)) {
      res.status(404).send('Logo not found');
      return;
    }
    const file = createReadStream(filePath);
    file.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'superadmin') {
      throw new UnauthorizedException('Somente superadmins podem criar empresas SaaS');
    }
    return this.tenantsService.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/discount-pin')
  async setDiscountPin(@Request() req: any, @Body() body: { pin: string }) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      throw new UnauthorizedException('Apenas admins podem configurar o PIN de desconto.');
    }
    if (!body.pin || body.pin.length < 4) {
      throw new BadRequestException('O PIN deve ter no mínimo 4 caracteres.');
    }
    return this.tenantsService.setDiscountPin(req.user.tenantId, body.pin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/verify-discount-pin')
  async verifyDiscountPin(@Request() req: any, @Body() body: { pin: string }) {
    const valid = await this.tenantsService.verifyDiscountPin(req.user.tenantId, body.pin);
    if (!valid) throw new UnauthorizedException('PIN de desconto inválido.');
    return { valid: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/cashier-pin')
  async setCashierPin(@Request() req: any, @Body() body: { pin: string }) {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      throw new UnauthorizedException('Apenas admins podem configurar o PIN do Caixa.');
    }
    if (!body.pin || body.pin.length < 4) {
      throw new BadRequestException('O PIN deve ter no mínimo 4 caracteres.');
    }
    return this.tenantsService.setCashierPin(req.user.tenantId, body.pin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/verify-cashier-pin')
  async verifyCashierPin(@Request() req: any, @Body() body: { pin: string; registerId: string }) {
    if (!body.registerId || typeof body.registerId !== 'string' || !body.registerId.trim()) {
      throw new BadRequestException('registerId é obrigatório para validação de PIN do Caixa.');
    }

    const result = await this.tenantsService.verifyCashierPin(req.user.tenantId, body.pin);
    if (!result.authorized) {
      throw new ForbiddenException('PIN do Caixa incorreto.');
    }

    const pinAuthToken = this.jwtService.sign(
      {
        type: 'pin_auth',
        authType: result.authType,
        managerOpId: result.managerOpId,
        managerName: result.managerName,
        registerId: body.registerId,
        tenantId: req.user.tenantId,
      },
      { expiresIn: '30m' }
    );

    return { valid: true, pinAuthToken };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteTenant(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'superadmin') {
      throw new UnauthorizedException('Permissão negada.');
    }
    return this.tenantsService.deleteTenant(id);
  }

  /** Exclui tenant via sys-init (protegido por PIN) */
  @Delete('setup/:id')
  async deleteTenantSetup(@Request() req: any, @Param('id') id: string) {
    await this.assertSetupPin(req);
    return this.tenantsService.deleteTenant(id);
  }

  // --- CONTROLE DE USUÁRIOS (SYS-INIT) ---
  @Get('setup/:id/users')
  async getTenantUsers(@Request() req: any, @Param('id') id: string) {
    await this.assertSetupPin(req);
    return this.tenantsService.getTenantUsers(id);
  }

  @Post('setup/:id/users')
  async createTenantUser(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name: string; email: string; password: string; role: string; pin?: string }
  ) {
    await this.assertSetupPin(req);
    if (!body.name || !body.email || !body.password || !body.role) {
      throw new BadRequestException('Nome, email, senha e perfil são obrigatórios.');
    }
    return this.tenantsService.createTenantUser(id, body);
  }

  @Patch('setup/:id/users/:userId')
  async updateTenantUser(
    @Request() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { name?: string; email?: string; role?: string; active?: boolean; password?: string; pin?: string | null },
  ) {
    await this.assertSetupPin(req);
    return this.tenantsService.updateTenantUser(id, userId, body);
  }

  @Delete('setup/:id/users/:userId')
  async deleteTenantUser(
    @Request() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.assertSetupPin(req);
    return this.tenantsService.deleteTenantUser(id, userId);
  }

  @Patch('setup/:id/users/:userId/password')
  async resetUserPassword(@Request() req: any, @Param('id') id: string, @Param('userId') userId: string, @Body() body: { password: string }) {
    await this.assertSetupPin(req);
    if (!body.password) throw new BadRequestException('A nova senha é obrigatória.');
    return this.tenantsService.resetUserPassword(id, userId, body.password);
  }

  @Patch('setup/:id/users/:userId/pin')
  async resetUserPin(@Request() req: any, @Param('id') id: string, @Param('userId') userId: string, @Body() body: { pin: string }) {
    await this.assertSetupPin(req);
    if (!body.pin) throw new BadRequestException('O novo PIN é obrigatório.');
    return this.tenantsService.resetUserPin(id, userId, body.pin);
  }

  /** Registra pagamento ou estorno de mensalidade via sys-init (protegido por PIN) */
  @Post('setup/:id/registrar-pagamento')
  async registrarPagamentoSetup(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    await this.assertSetupPin(req, body?.pin);
    return this.tenantsService.registrarPagamento(id, body);
  }

  /** Retorna histórico de pagamentos do tenant via sys-init (protegido por PIN) */
  @Get('setup/:id/payment-history')
  async getPaymentHistory(@Request() req: any, @Param('id') id: string) {
    await this.assertSetupPin(req);
    return this.tenantsService.getPaymentHistory(id);
  }

  @Get('setup/:id/categories')
  async getTenantCategories(@Request() req: any, @Param('id') id: string) {
    await this.assertSetupPin(req);
    return this.tenantsService.getTenantCategories(id);
  }

  @Post('trigger-sync')
  async triggerSync(@Request() req: any) {
    await this.assertSetupPin(req);
    return this.tenantsService.syncMasterCatalogFromTenants();
  }
}
