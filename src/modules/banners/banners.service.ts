import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { BannerResponseDto } from './dto/banner-response.dto';
import { DeviceType, Prisma, Banner } from '@prisma/client';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  async deleteBannerImage(imageUrl: string) {
    if (!imageUrl) return;

    // Delete from server storage
    const fs = require('fs');
    const path = require('path');
    const uploadDir = process.env.UPLOAD_DIR || './uploads/images';
    const filename = imageUrl.split('/').pop();
    const filepath = path.join(uploadDir, filename);
    
    if (fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (err: any) {
        console.error('Failed to delete banner from server:', err);
      }
    }
  }

  private toResponseDto(banner: Banner): BannerResponseDto {
    return {
      id: banner.id,
      title: banner.title ?? undefined,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl ?? undefined,
      deviceType: banner.deviceType,
      displayOrder: banner.displayOrder,
      isActive: banner.isActive,
      startsAt: banner.startsAt ?? undefined,
      endsAt: banner.endsAt ?? undefined,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    };
  }

  async findAll(query: BannerQueryDto): Promise<BannerResponseDto[]> {
    const where: Prisma.BannerWhereInput = {};
    if (query.device_type) {
      where.deviceType = query.device_type as DeviceType;
    }
    if (query.is_active !== undefined) {
      where.isActive = query.is_active === 'true';
    }

    const banners = await this.prisma.banner.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return banners.map((b) => this.toResponseDto(b));
  }

  async findById(id: string): Promise<BannerResponseDto> {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });
    if (!banner) throw new NotFoundException('Banner not found');
    return this.toResponseDto(banner);
  }

  async create(
    imageUrl: string,
    deviceType: DeviceType,
    isActive: boolean = true,
    title?: string,
    linkUrl?: string,
    displayOrder?: number,
    startsAt?: Date,
    endsAt?: Date,
  ) {
    const saved = await this.prisma.banner.create({
      data: {
        imageUrl,
        deviceType: deviceType,
        isActive,
        title: title || '',
        linkUrl,
        displayOrder: displayOrder ?? 0,
        startsAt,
        endsAt,
      },
    });
    return this.toResponseDto(saved);
  }

  async updateStatus(
    id: string,
    isActive: boolean,
  ): Promise<BannerResponseDto> {
    await this.findById(id);
    const updated = await this.prisma.banner.update({
      where: { id },
      data: { isActive },
    });
    return this.toResponseDto(updated);
  }

  async update(
    id: string,
    data: Prisma.BannerUpdateInput,
  ): Promise<BannerResponseDto> {
    await this.findById(id);
    const updated = await this.prisma.banner.update({
      where: { id },
      data,
    });
    return this.toResponseDto(updated);
  }

  async remove(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    if (banner.imageUrl) {
      await this.deleteBannerImage(banner.imageUrl);
    }

    await this.prisma.banner.delete({
      where: { id },
    });
    return { message: 'Banner deleted' };
  }
}
