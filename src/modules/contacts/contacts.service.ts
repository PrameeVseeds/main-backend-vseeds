import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ContactDetailResponseDto } from './dto/contact-detail-response.dto';
import { ContactSource, ContactStatus } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        subject: dto.subject || '',
        message: dto.message,
        source: dto.source as ContactSource,
        status: 'new',
      },
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [contacts, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contact.count(),
    ]);

    return { contacts, total, totalPages: Math.ceil(total / limit), page };
  }

  async search(query: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [contacts, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where: {
          OR: [{ name: { contains: query } }],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contact.count({
        where: {
          OR: [{ name: { contains: query } }],
        },
      }),
    ]);

    return { contacts, total, totalPages: Math.ceil(total / limit), page };
  }

  async findById(id: string): Promise<ContactDetailResponseDto> {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? undefined,
      subject: contact.subject,
      message: contact.message,
      source: contact.source,
      status: contact.status,
      createdAt: contact.createdAt,
      replies: contact.replies.map((r) => ({
        id: r.id,
        message: r.message,
        createdAt: r.createdAt,
      })),
    };
  }

  async updateStatus(id: string, status: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    const updated = await this.prisma.contact.update({
      where: { id },
      data: { status: status as ContactStatus },
    });
    return updated;
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.prisma.contact.delete({
      where: { id },
    });
    return { message: 'Contact deleted' };
  }

  async reply(id: string, message: string, adminId: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');

    const reply = await this.prisma.contactReply.create({
      data: {
        contactId: id,
        message,
        adminId,
      },
    });

    await this.prisma.contact.update({
      where: { id },
      data: { status: 'replied' },
    });

    return { message: 'Reply sent', reply };
  }
}
