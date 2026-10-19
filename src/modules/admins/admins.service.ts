import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { UpdateAdminStatusDto } from './dto/update-admin-status.dto';
import { UpdateAdminPasswordDto } from './dto/update-admin-password.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { EmailQueueService } from '../email/email-queue.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { AdminResponseDto } from './dto/admin-response.dto';
import { AdminStatus, Prisma } from '@prisma/client';
import {
  createLookupHash,
  isLikelyEmail,
} from '../../common/utils/lookup-hash.util';

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  async create(dto: CreateAdminDto) {
    const existing = await this.prisma.admin.findUnique({
      where: { emailLookup: createLookupHash(dto.email, 'email') },
    });
    if (existing)
      throw new BadRequestException('An admin with this email already exists');

    const existingUsername = await this.prisma.admin.findUnique({
      where: { usernameLookup: createLookupHash(dto.username, 'username') },
    });
    if (existingUsername) {
      throw new BadRequestException('An admin with this username already exists');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const saved = await this.prisma.admin.create({
      data: {
        username: dto.username,
        usernameLookup: createLookupHash(dto.username, 'username'),
        email: dto.email,
        emailLookup: createLookupHash(dto.email, 'email'),
        passwordHash: hashed,
        roleId: dto.roleId,
        phone: dto.phone,
      },
    });

    await this.emailQueueService.enqueue('admin-registration', saved.email, {
      username: saved.username,
      email: saved.email,
      password: dto.password,
    });

    return this.findById(saved.id);
  }

  async findAll(pagination: PaginationDto, type?: string) {
    const { page = 1, limit = 10 } = pagination;

    const where: Prisma.AdminWhereInput = {};
    if (type && type !== 'all') {
      where.role = { name: type };
    }

    const [admins, total] = await Promise.all([
      this.prisma.admin.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.admin.count({ where }),
    ]);

    return {
      admins: admins.map((a) => ({
        id: a.id,
        username: this.encryptionService.decrypt(a.username),
        email: this.encryptionService.decrypt(a.email),
        roleId: a.roleId,
        role: a.role?.name,
        status: a.status,
        phone: a.phone,
        avatarUrl: a.avatarUrl,
        twoFactorEnabled: a.twoFactorEnabled,
        lastLoginAt: a.lastLoginAt,
        createdAt: a.createdAt,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async count() {
    const total = await this.prisma.admin.count();
    return { count: total };
  }

  async search(query: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const or: Prisma.AdminWhereInput[] = [];
    if (isLikelyEmail(query)) {
      or.push({ emailLookup: createLookupHash(query, 'email') });
    } else {
      or.push({ usernameLookup: createLookupHash(query, 'username') });
    }
    const where: Prisma.AdminWhereInput = { OR: or };

    const [admins, total] = await Promise.all([
      this.prisma.admin.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.admin.count({ where }),
    ]);

    return {
      admins: admins.map((a) => ({
        id: a.id,
        username: this.encryptionService.decrypt(a.username),
        email: this.encryptionService.decrypt(a.email),
        role: a.role?.name,
        status: a.status,
        avatarUrl: a.avatarUrl,
        createdAt: a.createdAt,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  // OPT: Response DTO; map to AdminResponseDto to avoid exposing password hash (see admin-response.dto.ts).
  async findById(id: string): Promise<AdminResponseDto> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return {
      id: admin.id,
      username: this.encryptionService.decrypt(admin.username),
      email: this.encryptionService.decrypt(admin.email),
      roleId: admin.roleId ?? undefined,
      role: admin.role?.name,
      status: admin.status,
      phone: admin.phone ?? undefined,
      avatarUrl: admin.avatarUrl ?? undefined,
      twoFactorEnabled: admin.twoFactorEnabled,
      lastLoginAt: admin.lastLoginAt ?? undefined,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.admin.findUnique({
      where: { emailLookup: createLookupHash(email, 'email') },
    });
  }

  async update(id: string, dto: UpdateAdminDto) {
    await this.findById(id);
    const updateData: Prisma.AdminUpdateInput = {};

    if (dto.username) {
      updateData.username = this.encryptionService.encrypt(dto.username);
      updateData.usernameLookup = createLookupHash(dto.username, 'username');
    }
    if (dto.roleId) {
      updateData.role = { connect: { id: dto.roleId } };
    }
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.status) updateData.status = dto.status as AdminStatus;
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    await this.prisma.admin.update({
      where: { id },
      data: updateData,
    });
    return this.findById(id);
  }

  async updateStatus(id: string, dto: UpdateAdminStatusDto) {
    const admin = await this.findById(id);
    await this.prisma.admin.update({
      where: { id },
      data: { status: dto.status as AdminStatus },
    });

    const template =
      dto.status === 'active'
        ? 'admin-account-activated'
        : 'admin-account-deactivated';
    await this.emailQueueService.enqueue(template, admin.email, {
      username: admin.username,
    });

    return this.findById(id);
  }

  async delete(id: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    if (admin.role?.name === 'super admin') {
      throw new BadRequestException('Cannot delete a super admin');
    }

    const email = admin.email;
    const username = admin.username;

    await this.prisma.admin.delete({ where: { id } });

    await this.emailQueueService.enqueue('admin-account-deleted', email, {
      username,
    });

    return { message: 'Admin deleted' };
  }

  async updateOwnPassword(adminId: string, dto: UpdateAdminPasswordDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');

    const valid = await bcrypt.compare(dto.currentPassword, admin.passwordHash);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash: hashed },
    });
    return { message: 'Password updated successfully' };
  }

  async unlockAdmin(id: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');

    await this.prisma.admin.update({
      where: { id },
      data: {
        lockedUntil: null,
        failedLoginCount: 0,
      },
    });

    return { message: 'Admin account unlocked successfully' };
  }
}
