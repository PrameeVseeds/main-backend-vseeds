import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { EmailTemplateResponseDto } from './dto/email-template-response.dto';
import { EmailTemplate, Prisma } from '@prisma/client';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponseDto(t: EmailTemplate): EmailTemplateResponseDto {
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      category: t.category,
      description: t.description ?? undefined,
      subject: t.subject,
      htmlBody: t.htmlBody,
      textBody: t.textBody ?? undefined,
      variables: t.variables ? (t.variables as string[]) : undefined,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async findAll(pagination?: { page?: number; limit?: number }): Promise<
    | EmailTemplateResponseDto[]
    | {
        templates: EmailTemplateResponseDto[];
        total: number;
        totalPages: number;
        page: number;
      }
  > {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit;
    if (limit == null || limit <= 0) {
      const templates = await this.prisma.emailTemplate.findMany({
        orderBy: { name: 'asc' },
      });
      return templates.map((t) => this.toResponseDto(t));
    }
    const skip = (page - 1) * limit;

    const [templates, total] = await this.prisma.$transaction([
      this.prisma.emailTemplate.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.emailTemplate.count(),
    ]);

    return {
      templates: templates.map((t) => this.toResponseDto(t)),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async findById(id: string): Promise<EmailTemplateResponseDto> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Email template not found');
    return this.toResponseDto(template);
  }

  async findBySlug(slug: string): Promise<EmailTemplate> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { slug, isActive: true },
    });
    if (!template)
      throw new NotFoundException(`Email template '${slug}' not found`);
    return template;
  }

  async create(dto: CreateEmailTemplateDto): Promise<EmailTemplateResponseDto> {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new BadRequestException('Template slug already exists');
    const saved = await this.prisma.emailTemplate.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        category: dto.category || 'general',
        description: dto.description,
        subject: dto.subject,
        htmlBody: dto.htmlBody,
        textBody: dto.textBody,
        variables: dto.variables
          ? (dto.variables as Prisma.InputJsonValue)
          : undefined,
        isActive: dto.isActive,
      },
    });
    return this.toResponseDto(saved);
  }

  async update(
    id: string,
    dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplateResponseDto> {
    await this.findById(id);
    const data: Prisma.EmailTemplateUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.htmlBody !== undefined) data.htmlBody = dto.htmlBody;
    if (dto.textBody !== undefined) data.textBody = dto.textBody;
    if (dto.variables !== undefined) {
      data.variables = dto.variables ? dto.variables : Prisma.DbNull;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data,
    });
    return this.toResponseDto(updated);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.prisma.emailTemplate.delete({
      where: { id },
    });
    return { message: 'Email template deleted' };
  }

  async render(
    slug: string,
    data: Record<string, string>,
  ): Promise<{ subject: string; html: string; text: string | null }> {
    const template = await this.findBySlug(slug);
    const subject = this.replacePlaceholders(template.subject, data);
    const html = this.replacePlaceholders(template.htmlBody, data);
    const text = template.textBody
      ? this.replacePlaceholders(template.textBody, data)
      : null;
    return { subject, html, text };
  }

  private replacePlaceholders(
    content: string,
    data: Record<string, string>,
  ): string {
    return content.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => data[key] ?? '',
    );
  }
}
