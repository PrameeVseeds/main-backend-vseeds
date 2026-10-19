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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateSubcategoryStatusDto } from './dto/update-subcategory-status.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get('all')
  @ApiOperation({ summary: 'Get all root categories with children' })
  findAll(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.categoriesService.findAll(status, limit ? parseInt(limit) : 5);
  }

  @Public()
  @Get('search/:search')
  @ApiOperation({ summary: 'Search categories' })
  search(@Param('search') search: string) {
    return this.categoriesService.search(search);
  }

  @Public()
  @Get('tree')
  @ApiOperation({ summary: 'Get full category tree' })
  getAllWithChildren() {
    return this.categoriesService.getAllWithChildren();
  }

  @Public()
  @Get('children/:id')
  @ApiOperation({
    summary: 'Get children by parent category ID (optional ?status=active)',
  })
  getChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
  ) {
    return this.categoriesService.getChildren(id, status);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get('count')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get category count' })
  count() {
    return this.categoriesService.count();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findById(id);
  }

  @Post('add')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Create category' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put('update/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update category' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Put('status/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update category status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.categoriesService.updateStatus(id, dto);
  }

  @Put('children-status')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update children categories status' })
  updateChildrenStatus(@Body() dto: UpdateSubcategoryStatusDto) {
    return this.categoriesService.updateChildrenStatus(
      dto.parentId,
      dto.status,
    );
  }

  @Delete('delete/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete category (soft)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.softDelete(id);
  }
}
