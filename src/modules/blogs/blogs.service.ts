import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BlogResponseDto } from './dto/blog-response.dto';
import { Blog, BlogStatus, Prisma } from '@prisma/client';

@Injectable()
export class BlogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get defaultIcon(): string {
    const icon = this.configService.get<string>('DEFAULT_BLOG_IMAGE');
    if (!icon) return '';
    // If icon is already a full URL, return it as-is
    if (icon.startsWith('http://') || icon.startsWith('https://')) {
      return icon;
    }
    // Otherwise, construct URL with CDN URL
    const cdnUrl = this.configService.get<string>('CDN_URL');
    return icon && cdnUrl ? `${cdnUrl}/${icon}` : '';
  }

  private mapBlog(blog: Blog): Blog {
    if (!blog) return blog;
    if (!blog.coverImageUrl) {
      blog.coverImageUrl = this.defaultIcon;
    }
    return blog;
  }

  private toResponseDto(blog: Blog): BlogResponseDto {
    return {
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt ?? undefined,
      content: blog.content,
      coverImageUrl: blog.coverImageUrl ?? undefined,
      author: blog.author,
      tags: blog.tags as string[],
      status: blog.status,
      publishedAt: blog.publishedAt ?? undefined,
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };
  }

  async findPublished(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [blogs, total] = await this.prisma.$transaction([
      this.prisma.blog.findMany({
        where: { status: 'published' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.blog.count({
        where: { status: 'published' },
      }),
    ]);

    return {
      blogs: blogs.map((b) => this.toResponseDto(this.mapBlog(b))),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async findBySlug(slug: string): Promise<BlogResponseDto> {
    const blog = await this.prisma.blog.findUnique({
      where: { slug },
    });
    if (!blog) throw new NotFoundException('Blog not found');
    return this.toResponseDto(this.mapBlog(blog));
  }

  async findById(id: string): Promise<BlogResponseDto> {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
    });
    if (!blog) throw new NotFoundException('Blog not found');
    return this.toResponseDto(this.mapBlog(blog));
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [blogs, total] = await this.prisma.$transaction([
      this.prisma.blog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.blog.count(),
    ]);

    return {
      blogs: blogs.map((b) => this.toResponseDto(this.mapBlog(b))),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async create(dto: CreateBlogDto) {
    const slug = this.generateSlug(dto.title);
    const existing = await this.prisma.blog.findUnique({ where: { slug } });
    if (existing)
      throw new BadRequestException(
        'A blog with a similar title already exists',
      );

    const saved = await this.prisma.blog.create({
      data: {
        title: dto.title,
        content: dto.content || '',
        author: dto.author || '',
        excerpt: dto.excerpt,
        status: dto.status as BlogStatus,
        slug,
        coverImageUrl: dto.coverImageUrl,
        publishedAt: dto.status === 'published' ? new Date() : undefined,
        tags: dto.tags ? (dto.tags as Prisma.InputJsonValue) : undefined,
      },
    });
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateBlogDto) {
    const existing = await this.findById(id);
    const data: Prisma.BlogUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = this.generateSlug(dto.title);
    }
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.author !== undefined) data.author = dto.author;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.status !== undefined) {
      data.status = dto.status as BlogStatus;
      if (dto.status === 'published' && existing.status !== 'published') {
        data.publishedAt = new Date();
      }
    }
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.tags !== undefined) {
      data.tags = dto.tags ? dto.tags : Prisma.DbNull;
    }

    await this.prisma.blog.update({
      where: { id },
      data,
    });
    return this.findById(id);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.prisma.blog.delete({
      where: { id },
    });
    return { message: 'Blog deleted' };
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
