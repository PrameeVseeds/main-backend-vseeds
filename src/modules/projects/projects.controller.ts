import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { imageFileFilter } from '../../common/utils/image-file-filter';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Get public (active) projects' })
  findPublic() {
    return this.projectsService.findPublic();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findById(id);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get()
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all projects (admin)' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Post('upload')
  @Roles('admin', 'super admin')
  @UseInterceptors(FileInterceptor('image', { fileFilter: imageFileFilter }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload project image (admin)' })
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file is required');
    const url = await this.projectsService.uploadImage(file);
    return { url };
  }

  @Post()
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Create project (admin)' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update project (admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete project (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.remove(id);
  }
}
