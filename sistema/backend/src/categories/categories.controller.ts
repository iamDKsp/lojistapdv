import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.categoriesService.create(body);
  }

  @Post('bulk-status')
  bulkUpdateStatus(@Body() body: { ids?: string[]; active: boolean }) {
    return this.categoriesService.bulkUpdateStatus(body);
  }

  @Post('populate-showcase')
  populateShowcase(@Body() body?: { minPerCategory?: number }) {
    return this.categoriesService.populateShowcaseCatalog(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.categoriesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
