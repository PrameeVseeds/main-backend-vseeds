import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceTemplateDto } from './dto/create-invoice-template.dto';
import { UpdateInvoiceTemplateDto } from './dto/update-invoice-template.dto';
import { InvoiceTemplateResponseDto } from './dto/invoice-template-response.dto';

@Injectable()
export class InvoiceTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(t: any): InvoiceTemplateResponseDto {
    return {
      id: t.id,
      name: t.name,
      settings: t.settings as any,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private get client() {
    return (this.prisma as any).invoiceTemplate;
  }

  async findAll(): Promise<InvoiceTemplateResponseDto[]> {
    const list = await this.client.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((t: any) => this.toResponse(t));
  }

  async findActive(): Promise<InvoiceTemplateResponseDto | null> {
    const active = await this.client.findFirst({
      where: { isActive: true, deletedAt: null },
    });
    if (active) return this.toResponse(active);

    const first = await this.client.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return first ? this.toResponse(first) : null;
  }

  async findById(id: string): Promise<InvoiceTemplateResponseDto> {
    const t = await this.client.findUnique({ where: { id } });
    if (!t || t.deletedAt) {
      throw new NotFoundException('Invoice template not found');
    }
    return this.toResponse(t);
  }

  async create(dto: CreateInvoiceTemplateDto): Promise<InvoiceTemplateResponseDto> {
    if (dto.isActive) {
      await this.client.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const created = await this.client.create({
      data: {
        name: dto.name,
        settings: dto.settings as any,
        isActive: dto.isActive ?? false,
      },
    });
    return this.toResponse(created);
  }

  async update(
    id: string,
    dto: UpdateInvoiceTemplateDto,
  ): Promise<InvoiceTemplateResponseDto> {
    await this.findById(id);

    if (dto.isActive) {
      await this.client.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const updated = await this.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.settings !== undefined && { settings: dto.settings as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.toResponse(updated);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findById(id);
    await this.client.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'Invoice template deleted' };
  }

  async activate(id: string): Promise<InvoiceTemplateResponseDto> {
    await this.client.updateMany({ data: { isActive: false } });
    const updated = await this.client.update({
      where: { id },
      data: { isActive: true },
    });
    return this.toResponse(updated);
  }

  async deactivate(id: string): Promise<InvoiceTemplateResponseDto> {
    const updated = await this.client.update({
      where: { id },
      data: { isActive: false },
    });
    return this.toResponse(updated);
  }
}
