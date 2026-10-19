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
import { BlogsService } from './blogs.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Blogs')
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Public()
  @Get('published')
  @ApiOperation({ summary: 'Get published blogs' })
  findPublished(@Query() pagination: PaginationDto) {
    return this.blogsService.findPublished(pagination);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get blog by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.blogsService.findBySlug(slug);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all blogs (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.blogsService.findAll(pagination);
  }

  @Get(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get blog by ID (admin)' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.blogsService.findById(id);
  }

  @Post('add')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Create blog' })
  create(@Body() dto: CreateBlogDto) {
    return this.blogsService.create(dto);
  }

  @Put('update/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update blog' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBlogDto) {
    return this.blogsService.update(id, dto);
  }

  @Delete('delete/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete blog (soft)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.blogsService.softDelete(id);
  }
}
