import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VitrineService } from './vitrine.service';

function requireAdminRole(req: any) {
  const role = req?.user?.role;
  if (!['admin', 'superadmin'].includes(role)) {
    throw new ForbiddenException(
      'Apenas administradores podem gerenciar a Vitrine Digital e TV.',
    );
  }
}

@Controller('vitrine')
export class VitrineController {
  constructor(private readonly vitrineService: VitrineService) {}

  // ─────────────────────────────────────────────────────────────────
  //  ENDPOINTS PÚBLICOS — Sem JWT — Consumidos pela Smart TV
  // ─────────────────────────────────────────────────────────────────

  @Get('public/:tvPublicId')
  async getPublicPlaylist(
    @Param('tvPublicId') tvPublicId: string,
    @Res() res: Response,
  ) {
    const data = await this.vitrineService.getPublicPlaylist(tvPublicId);

    if (!data.active) {
      return res
        .status(HttpStatus.OK)
        .setHeader('Cache-Control', 'no-cache')
        .json(data);
    }

    const etag = `"v${(data as any).version}"`;
    const clientEtag = res.req?.headers?.['if-none-match'];

    if (clientEtag === etag) {
      return res
        .status(HttpStatus.NOT_MODIFIED)
        .setHeader('ETag', etag)
        .setHeader('Cache-Control', 'no-cache')
        .send();
    }

    return res
      .status(HttpStatus.OK)
      .setHeader('ETag', etag)
      .setHeader('Cache-Control', 'no-cache')
      .json(data);
  }

  @Get('themes')
  getThemes() {
    return this.vitrineService.getThemes();
  }

  // ─────────────────────────────────────────────────────────────────
  //  ENDPOINTS AUTENTICADOS — Painel Administrativo (/vitrine)
  // ─────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('config')
  getConfig(@Request() req: any) {
    requireAdminRole(req);
    return this.vitrineService.getConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Get('catalog')
  getCatalog(@Request() req: any, @Query('search') search?: string) {
    requireAdminRole(req);
    return this.vitrineService.getCatalog(search);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('draft')
  @HttpCode(HttpStatus.OK)
  saveDraft(@Request() req: any, @Body() body: any) {
    requireAdminRole(req);
    return this.vitrineService.saveDraft(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('publish')
  @HttpCode(HttpStatus.OK)
  publish(@Request() req: any) {
    requireAdminRole(req);
    return this.vitrineService.publish({
      userId: req.user?.id || req.user?.sub || 'system',
      userName: req.user?.name || req.user?.email || 'Administrador',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('active')
  @HttpCode(HttpStatus.OK)
  setActive(@Request() req: any, @Body() body: { active: boolean }) {
    requireAdminRole(req);
    return this.vitrineService.setActive(Boolean(body?.active));
  }
}
