import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { EncryptionService } from '../../common/services/encryption.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressResponseDto } from './dto/address-response.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Prisma, UserAddress, UserStatus } from '@prisma/client';
import {
  createLookupHash,
  isLikelyEmail,
} from '../../common/utils/lookup-hash.util';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ─── Admin: List all users ──────────────────────────────────────

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);

    // Fetch order stats for all users in a single query
    const userIds = users.map((u) => u.id);
    let orderStatsMap: Record<
      string,
      { orderCount: number; totalSpent: number }
    > = {};

    if (userIds.length > 0) {
      const orderStats = await this.prisma.order.groupBy({
        by: ['userId'],
        _count: { _all: true },
        _sum: { totalAmount: true },
        where: {
          userId: { in: userIds },
          deletedAt: null,
        },
      });

      orderStatsMap = orderStats.reduce(
        (acc, row) => {
          acc[row.userId ?? ''] = {
            orderCount: row._count._all || 0,
            totalSpent: Number(row._sum.totalAmount) || 0,
          };
          return acc;
        },
        {} as Record<string, { orderCount: number; totalSpent: number }>,
      );
    }

    return {
      users: users.map((u) => {
        const stats = orderStatsMap[u.id] || { orderCount: 0, totalSpent: 0 };
        return {
          id: u.id,
          email: this.encryptionService.decrypt(u.email),
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          status: u.status,
          isActive: u.status === 'active',
          createdAt: u.createdAt,
          orderCount: stats.orderCount,
          totalSpent: stats.totalSpent,
        };
      }),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async count() {
    const [total, active, inactive] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { status: 'inactive' } }),
    ]);
    return { total, active, inactive };
  }

  // ─── Admin: Search users ────────────────────────────────────────

  async search(query: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const or: Prisma.UserWhereInput[] = [
      { firstName: { contains: query } },
      { lastName: { contains: query } },
    ];
    if (isLikelyEmail(query)) {
      or.push({ emailLookup: createLookupHash(query, 'email') });
    }

    const where: Prisma.UserWhereInput = { OR: or };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: this.encryptionService.decrypt(u.email),
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  // ─── Profile ────────────────────────────────────────────────────

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { addresses: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { emailLookup: createLookupHash(email, 'email') },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { addresses: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      twoFactorEnabled: user.twoFactorEnabled,
      status: user.status,
      isActive: user.status === 'active',
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    return this.getProfile(userId);
  }

  // ─── Admin: Update Status ────────────────────────────────────────

  async updateStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status as UserStatus },
    });

    return {
      message: `User status successfully updated to ${dto.status}`,
      status: dto.status,
    };
  }

  // ─── Password ───────────────────────────────────────────────────

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed },
    });

    return { message: 'Password updated successfully' };
  }

  // ─── Addresses ──────────────────────────────────────────────────

  async getAddresses(userId: string): Promise<AddressResponseDto[]> {
    const list = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
    });
    return list.map((a) => this.toAddressResponseDto(a));
  }

  private toAddressResponseDto(a: UserAddress): AddressResponseDto {
    return {
      id: a.id,
      label: a.label ? this.encryptionService.decrypt(a.label) : undefined,
      fullName: this.encryptionService.decrypt(a.fullName ?? ''),
      email: a.email ? this.encryptionService.decrypt(a.email) : undefined,
      phone: this.encryptionService.decrypt(a.phone ?? ''),
      addressLine1: this.encryptionService.decrypt(a.addressLine1 ?? ''),
      addressLine2: a.addressLine2 ? this.encryptionService.decrypt(a.addressLine2) : undefined,
      city: a.city ? this.encryptionService.decrypt(a.city) : undefined,
      district: this.encryptionService.decrypt(a.district ?? ''),
      province: this.encryptionService.decrypt(a.province ?? ''),
      postalCode: this.encryptionService.decrypt(a.postalCode ?? ''),
      isDefault: a.isDefault,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  async createAddress(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    const saved = await this.prisma.userAddress.create({
      data: { userId, ...dto },
    });
    return this.toAddressResponseDto(saved);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');

    const saved = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: dto,
    });
    return this.toAddressResponseDto(saved);
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');

    await this.prisma.userAddress.delete({
      where: { id: addressId },
    });
    return { message: 'Address deleted' };
  }
}
