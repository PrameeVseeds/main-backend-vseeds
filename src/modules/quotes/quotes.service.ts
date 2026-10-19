import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmailQueueService } from '../email/email-queue.service';
import { Prisma } from '@prisma/client';

const TERMINAL_QUOTE_STATUSES = ['completed', 'rejected', 'expired'];

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueueService: EmailQueueService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateQuoteDto, userId?: string) {
    const quoteNumber = await this.generateQuoteNumber();
    return this.prisma.quote.create({
      data: {
        ...dto,
        details: (dto.details ?? {}) as Prisma.InputJsonValue,
        quoteNumber,
        userId: userId || null,
        status: 'pending',
      },
    });
  }

  async findByQuoteNumber(
    quoteNumber: string,
    user?: { email: string; role: string; type: string },
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { quoteNumber },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (user && user.type !== 'admin' && quote.customerEmail !== user.email) {
      throw new ForbiddenException('You can only view your own quotes');
    }
    return quote;
  }

  async findById(
    id: string,
    user?: { email: string; role: string; type: string },
  ) {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (user && user.type !== 'admin' && quote.customerEmail !== user.email) {
      throw new ForbiddenException('You can only view your own quotes');
    }
    return quote;
  }

  // OPT: Pagination added; response shape { quotes, total, totalPages, page } for compatibility (see plan).
  async findByUserEmail(
    email: string,
    pagination?: PaginationDto,
  ): Promise<{
    quotes: any[];
    total: number;
    totalPages: number;
    page: number;
  }> {
    const page = pagination?.page ?? 1;
    const limit = Math.min(pagination?.limit ?? 50, 100);
    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        where: { customerEmail: email },
        select: {
          id: true,
          quoteNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          customerCompany: true,
          serviceType: true,
          totalPrice: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count({
        where: { customerEmail: email },
      }),
    ]);
    
    const decryptedQuotes = quotes.map(quote => ({
      ...quote,
      customerEmail: this.encryptionService.decrypt(quote.customerEmail),
    }));
    
    return { quotes: decryptedQuotes, total, totalPages: Math.ceil(total / limit), page };
  }

  // ─── Admin ──────────────────────────────────────────────────────

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const [quotes, total] = await Promise.all([
      this.prisma.quote.findMany({
        select: {
          id: true,
          quoteNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          customerCompany: true,
          serviceType: true,
          totalPrice: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count(),
    ]);
    
    const decryptedQuotes = quotes.map(quote => ({
      ...quote,
      customerEmail: this.encryptionService.decrypt(quote.customerEmail),
    }));
    
    return { quotes: decryptedQuotes, total, totalPages: Math.ceil(total / limit), page };
  }

  async updateStatus(id: string, dto: UpdateQuoteStatusDto) {
    const quote = await this.findById(id);

    if (TERMINAL_QUOTE_STATUSES.includes(quote.status)) {
      throw new BadRequestException(
        `Cannot change status of a quote that is already ${quote.status}`,
      );
    }

    const update: Prisma.QuoteUpdateInput = { status: dto.status };
    if (dto.totalPrice !== undefined) update.totalPrice = dto.totalPrice;
    if (dto.serviceLevel !== undefined) update.serviceLevel = dto.serviceLevel;
    if (dto.estimatedBuildTime !== undefined)
      update.estimatedBuildTime = dto.estimatedBuildTime;
    if (dto.adminNotes !== undefined) update.adminNotes = dto.adminNotes;

    await this.prisma.quote.update({
      where: { id },
      data: update,
    });

    const updated = await this.findById(id);

    const statusLabel =
      dto.status.charAt(0).toUpperCase() + dto.status.slice(1);
    await this.emailQueueService.enqueue(
      'quote-status-update',
      quote.customerEmail,
      {
        username: quote.customerName || 'Customer',
        quoteNumber: quote.quoteNumber,
        status: statusLabel,
        adminNotes: dto.adminNotes || '',
      },
    );

    return updated;
  }

  private async generateQuoteNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const count = await this.prisma.quote.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      });
      const candidate = `QT-${dateStr}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.prisma.quote.findUnique({
        where: { quoteNumber: candidate },
      });
      if (!exists) return candidate;
    }
    return `QT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
}
