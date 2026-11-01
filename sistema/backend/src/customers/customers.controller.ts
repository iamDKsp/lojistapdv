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
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function requireAdmin(req: any) {
  if (!['admin', 'superadmin'].includes(req?.user?.role)) {
    throw new ForbiddenException(
      'Seu perfil não tem permissão para esta operação.',
    );
  }
}

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get('insights')
  getInsights(@Request() req: any, @Query() query: any) {
    requireAdmin(req);
    return this.customersService.getInsights(query);
  }

  @Get('phone/:phone')
  findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Get(':id/profile')
  getProfile(@Request() req: any, @Param('id') id: string) {
    requireAdmin(req);
    return this.customersService.getProfile(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.customersService.create(body);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    requireAdmin(req);
    return this.customersService.update(id, body);
  }
}
