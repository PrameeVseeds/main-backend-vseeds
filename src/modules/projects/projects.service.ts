import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  validateImageUpload,
  FILE_UPLOAD_LIMITS,
} from '../../common/utils/file-upload-validation';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get uploadDir(): string {
    const dir = this.configService.get<string>('UPLOAD_DIR');
    if (dir) {
      if (dir.startsWith('./') || dir.startsWith('../')) {
        return path.resolve(dir);
      }
      return dir;
    }
    const fallback = path.resolve(
      __dirname,
      '../../../../public_html/upload_vseeds/images',
    );
    this.logger.warn(
      `UPLOAD_DIR not set. Falling back to: ${fallback}. Set UPLOAD_DIR in your .env file.`,
    );
    return fallback;
  }

  private get baseUrl(): string {
    return this.configService.get<string>('CDN_URL') || 'https://cdn.vseeds.lk';
  }

  async findPublic() {
    const projects = await this.prisma.project.findMany({
      where: { isPublic: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return projects.map((p) => this.mapToFrontend(p));
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.mapToFrontend(project);
  }

  // ─── Admin ──────────────────────────────────────────────────────

  async findAll() {
    const projects = await this.prisma.project.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return projects.map((p) => this.mapToFrontend(p));
  }

  private mapToFrontend(p: Project) {
    const defaultImg = 'uploads/general/default-project-img.png';
    return {
      id: p.id,
      title: p.title,
      category: p.category,
      description: p.description,
      imageUrl: p.imageUrl || defaultImg,
      image: p.imageUrl || defaultImg,
      technologies: p.technologies as string[],
      displayOrder: p.displayOrder,
      isActive: p.isPublic,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        title: dto.title,
        category: dto.category || 'general',
        description: dto.description,
        imageUrl: dto.imageUrl,
        technologies: dto.technologies ? dto.technologies : undefined,
        displayOrder: dto.displayOrder,
        isPublic: dto.isPublic,
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findById(id);
    const data: Prisma.ProjectUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.technologies !== undefined) {
      data.technologies = dto.technologies ? dto.technologies : Prisma.JsonNull;
    }
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;

    await this.prisma.project.update({
      where: { id },
      data,
    });
    return this.findById(id);
  }

  async remove(id: string) {
    const project = await this.findById(id);
    if (project.imageUrl?.startsWith(`${this.baseUrl}/`)) {
      const relativePath = project.imageUrl.replace(`${this.baseUrl}/`, '');
      const filepath = path.join(this.uploadDir, relativePath);
      try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error('Failed to delete project image from disk:', errMsg);
      }
    }
    await this.prisma.project.delete({
      where: { id },
    });
    return { message: 'Project deleted' };
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    const validation = validateImageUpload(file.buffer, file.mimetype, {
      maxSize: FILE_UPLOAD_LIMITS.image,
    });
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }
    if (validation.detectedMime && file.mimetype !== validation.detectedMime) {
      file.mimetype = validation.detectedMime;
    }

    const filename = `vseeds-projects-${randomUUID()}${path.extname(file.originalname)}`;
    const target = path.join(this.uploadDir, filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.buffer);

    return `${this.baseUrl}/${filename}`;
  }
}
