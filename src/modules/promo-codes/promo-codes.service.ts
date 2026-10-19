import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';
import { PromoCodeResponseDto } from './dto/promo-code-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PromoCode, PromoCodeSite, DiscountType, Prisma } from '@prisma/client';
import { createLookupHash } from '../../common/utils/lookup-hash.util';

@Injectable()
export class PromoCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreatePromoCodeDto) {
    const existing = await this.prisma.promoCode.findUnique({
      where: { codeLookup: createLookupHash(dto.code, 'promo_code') },
    });
    if (existing) {
      throw new BadRequestException(`Promo code "${dto.code}" already exists`);
    }

    return this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase(),
        codeLookup: createLookupHash(dto.code, 'promo_code'),
        description: dto.description,
        discountType: dto.discountType as DiscountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        applicableSite: (dto.applicableSite || 'both') as PromoCodeSite,
        minimumOrderAmount:
          dto.minimumOrderAmount != null
            ? new Prisma.Decimal(dto.minimumOrderAmount)
            : undefined,
        maximumDiscountAmount:
          dto.maximumDiscountAmount != null
            ? new Prisma.Decimal(dto.maximumDiscountAmount)
            : undefined,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [promoCodes, total] = await this.prisma.$transaction([
      this.prisma.promoCode.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.promoCode.count(),
    ]);

    const decryptedPromoCodes = promoCodes.map(promo => ({
      ...promo,
      code: this.encryptionService.decrypt(promo.code),
    }));

    return { promoCodes: decryptedPromoCodes, total, totalPages: Math.ceil(total / limit), page };
  }

  async findById(id: string): Promise<PromoCodeResponseDto> {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo code not found');
    return this.toPromoCodeResponseDto(promo);
  }

  private toPromoCodeResponseDto(p: PromoCode): PromoCodeResponseDto {
    return {
      id: p.id,
      code: this.encryptionService.decrypt(p.code),
      description: p.description ?? undefined,
      discountType: p.discountType,
      discountValue: Number(p.discountValue),
      applicableSite: p.applicableSite,
      minimumOrderAmount: Number(p.minimumOrderAmount),
      maximumDiscountAmount:
        p.maximumDiscountAmount != null
          ? Number(p.maximumDiscountAmount)
          : undefined,
      usageLimit: p.usageLimit,
      usedCount: p.usedCount,
      perUserLimit: p.perUserLimit,
      startDate: p.startDate?.toISOString(),
      expiryDate: p.expiryDate?.toISOString(),
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async update(id: string, dto: UpdatePromoCodeDto) {
    await this.findById(id);
    const data: Prisma.PromoCodeUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code.toUpperCase();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.discountType !== undefined) {
      data.discountType = dto.discountType as DiscountType;
    }
    if (dto.discountValue !== undefined) {
      data.discountValue = new Prisma.Decimal(dto.discountValue);
    }
    if (dto.applicableSite !== undefined) {
      data.applicableSite = dto.applicableSite as PromoCodeSite;
    }
    if (dto.minimumOrderAmount !== undefined) {
      data.minimumOrderAmount = new Prisma.Decimal(dto.minimumOrderAmount);
    }
    if (dto.maximumDiscountAmount !== undefined) {
      data.maximumDiscountAmount =
        dto.maximumDiscountAmount != null
          ? new Prisma.Decimal(dto.maximumDiscountAmount)
          : null;
    }
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.perUserLimit !== undefined) data.perUserLimit = dto.perUserLimit;
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.promoCode.update({
      where: { id },
      data,
    });
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.promoCode.delete({
      where: { id },
    });
    return { message: 'Promo code deleted' };
  }

  async validate(dto: ValidatePromoCodeDto, userId?: string) {
    if (userId) {
      // reserved for user-specific checks (e.g. usage count per user)
    }
    const promo = await this.prisma.promoCode.findUnique({
      where: { codeLookup: createLookupHash(dto.code, 'promo_code') },
    });

    if (!promo) {
      throw new BadRequestException('Invalid promo code');
    }

    if (!promo.isActive) {
      throw new BadRequestException('This promo code is no longer active');
    }

    const now = new Date();
    if (promo.startDate && now < new Date(promo.startDate)) {
      throw new BadRequestException('This promo code is not yet valid');
    }
    if (promo.expiryDate && now > new Date(promo.expiryDate)) {
      throw new BadRequestException('This promo code has expired');
    }

    if (promo.usageLimit > 0 && promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException(
        'This promo code has reached its usage limit',
      );
    }

    const site = dto.site || 'electronics';
    if (promo.applicableSite !== 'both' && promo.applicableSite !== site) {
      const siteLabel =
        promo.applicableSite === 'electronics'
          ? 'Electronics store'
          : 'Embedded / PCB store';
      throw new BadRequestException(
        `This promo code is only valid for the ${siteLabel}`,
      );
    }

    if (
      +promo.minimumOrderAmount > 0 &&
      dto.subtotal < +promo.minimumOrderAmount
    ) {
      throw new BadRequestException(
        `Minimum order amount of Rs. ${(+promo.minimumOrderAmount).toFixed(2)} required`,
      );
    }

    let discountAmount: number;
    if (promo.discountType === 'percentage') {
      discountAmount = +(dto.subtotal * (+promo.discountValue / 100)).toFixed(
        2,
      );
      if (
        promo.maximumDiscountAmount &&
        discountAmount > +promo.maximumDiscountAmount
      ) {
        discountAmount = +promo.maximumDiscountAmount;
      }
    } else {
      discountAmount = +promo.discountValue;
    }

    if (discountAmount > dto.subtotal) {
      discountAmount = dto.subtotal;
    }

    return {
      valid: true,
      promoCodeId: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: +promo.discountValue,
      discountAmount,
      applicableSite: promo.applicableSite,
      description: promo.description,
    };
  }

  async incrementUsage(promoCodeId: string) {
    await this.prisma.promoCode.update({
      where: { id: promoCodeId },
      data: {
        usedCount: { increment: 1 },
      },
    });
  }

  async count() {
    const total = await this.prisma.promoCode.count();
    const active = await this.prisma.promoCode.count({
      where: { isActive: true },
    });
    const expired = await this.prisma.promoCode.count({
      where: {
        expiryDate: {
          not: null,
          lt: new Date(),
        },
      },
    });
    return { total, active, inactive: total - active, expired };
  }
}
