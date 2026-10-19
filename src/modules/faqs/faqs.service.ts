import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqResponseDto } from './dto/faq-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { FAQSite, FAQ } from '@prisma/client';

@Injectable()
export class FaqsService {
  constructor(private readonly prisma: PrismaService) {}

  private siteFilter(site?: string): FAQSite[] {
    if (site === 'electronics') return ['electronics', 'both'];
    if (site === 'embedded') return ['embedded', 'both'];
    return ['electronics', 'embedded', 'both'];
  }

  private toResponseDto(faq: FAQ): FaqResponseDto {
    return {
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category ?? undefined,
      site: faq.site,
      displayOrder: faq.displayOrder,
      isActive: faq.isActive,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
    };
  }

  async findActive(site?: string): Promise<FaqResponseDto[]> {
    const faqs = await this.prisma.fAQ.findMany({
      where: {
        isActive: true,
        site: { in: this.siteFilter(site) },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return faqs.map((f) => this.toResponseDto(f));
  }

  async findByCategory(
    category: string,
    site?: string,
  ): Promise<FaqResponseDto[]> {
    const faqs = await this.prisma.fAQ.findMany({
      where: {
        category,
        isActive: true,
        site: { in: this.siteFilter(site) },
      },
      orderBy: { displayOrder: 'asc' },
    });
    return faqs.map((f) => this.toResponseDto(f));
  }

  async getCategories(site?: string) {
    const result = await this.prisma.fAQ.findMany({
      where: {
        category: { not: null },
        site: site ? { in: this.siteFilter(site) } : undefined,
      },
      select: {
        category: true,
      },
      distinct: ['category'],
    });
    return result.map((r) => r.category).filter(Boolean);
  }

  async findAll(pagination?: PaginationDto): Promise<{
    faqs: FaqResponseDto[];
    total: number;
    totalPages: number;
    page: number;
  }> {
    const page = pagination?.page ?? 1;
    const limit = Math.min(pagination?.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const [faqs, total] = await this.prisma.$transaction([
      this.prisma.fAQ.findMany({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.fAQ.count(),
    ]);

    return {
      faqs: faqs.map((f) => this.toResponseDto(f)),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async findById(id: string): Promise<FaqResponseDto> {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id },
    });
    if (!faq) throw new NotFoundException('FAQ not found');
    return this.toResponseDto(faq);
  }

  async create(dto: CreateFaqDto): Promise<FaqResponseDto> {
    const saved = await this.prisma.fAQ.create({
      data: dto,
    });
    return this.toResponseDto(saved);
  }

  async update(id: string, dto: UpdateFaqDto): Promise<FaqResponseDto> {
    await this.findById(id);
    const saved = await this.prisma.fAQ.update({
      where: { id },
      data: dto,
    });
    return this.toResponseDto(saved);
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.prisma.fAQ.delete({
      where: { id },
    });
    return { message: 'FAQ deleted' };
  }

  async reorder(ids: string[]) {
    for (let i = 0; i < ids.length; i++) {
      await this.prisma.fAQ.update({
        where: { id: ids[i] },
        data: { displayOrder: i },
      });
    }
    return { message: 'FAQs reordered' };
  }
}
