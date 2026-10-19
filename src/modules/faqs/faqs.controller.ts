import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FaqsService } from './faqs.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { ReorderFaqDto } from './dto/reorder-faq.dto';

@ApiTags('FAQs')
@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Get active FAQs (public)' })
  @ApiQuery({
    name: 'site',
    required: false,
    enum: ['electronics', 'embedded'],
  })
  findActive(@Query('site') site?: string) {
    return this.faqsService.findActive(site);
  }

  @Public()
  @Get('category/:category')
  @ApiOperation({ summary: 'Get FAQs by category (public)' })
  @ApiQuery({
    name: 'site',
    required: false,
    enum: ['electronics', 'embedded'],
  })
  findByCategory(
    @Param('category') category: string,
    @Query('site') site?: string,
  ) {
    return this.faqsService.findByCategory(category, site);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get FAQ categories (public)' })
  @ApiQuery({
    name: 'site',
    required: false,
    enum: ['electronics', 'embedded'],
  })
  getCategories(@Query('site') site?: string) {
    return this.faqsService.getCategories(site);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all FAQs (admin) with optional pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: { page?: number; limit?: number }) {
    return this.faqsService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get FAQ by ID (admin)' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqsService.findById(id);
  }

  @Post('add')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Create FAQ' })
  create(@Body() dto: CreateFaqDto) {
    return this.faqsService.create(dto);
  }

  @Put('update/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update FAQ' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFaqDto) {
    return this.faqsService.update(id, dto);
  }

  @Delete('delete/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete FAQ (soft)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.faqsService.softDelete(id);
  }

  @Put('reorder')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Reorder FAQs' })
  reorder(@Body() dto: ReorderFaqDto) {
    return this.faqsService.reorder(dto.ids);
  }
}
