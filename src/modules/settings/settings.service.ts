import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SettingResponseDto } from './dto/setting-response.dto';
import { Setting } from '@prisma/client';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponseDto(s: Setting): SettingResponseDto {
    return {
      id: s.id,
      key: s.key,
      value: s.value,
      valueType: s.valueType,
      group: s.group,
      description: s.description ?? undefined,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  async findAll(): Promise<SettingResponseDto[]> {
    const settings = await this.prisma.setting.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
    return settings.map((s) => this.toResponseDto(s));
  }

  async findByGroup(group: string): Promise<SettingResponseDto[]> {
    const settings = await this.prisma.setting.findMany({
      where: { group },
      orderBy: { key: 'asc' },
    });
    return settings.map((s) => this.toResponseDto(s));
  }

  async getGroups() {
    const result = await this.prisma.setting.findMany({
      select: {
        group: true,
      },
      distinct: ['group'],
    });
    return result.map((r) => r.group).filter(Boolean);
  }

  async getPricingSettings(): Promise<{
    shippingFee: number;
    taxEnabled: boolean;
    taxPercentage: number;
  }> {
    const [shippingFee, taxEnabled, taxPercentage] = await Promise.all([
      this.getTyped<number>('shippingFee', 0),
      this.getTyped<boolean>('taxEnabled', false),
      this.getTyped<number>('taxPercentage', 0),
    ]);
    return { shippingFee, taxEnabled, taxPercentage };
  }

  async getSettingsMap(): Promise<Record<string, unknown>> {
    const settings = await this.prisma.setting.findMany({
      select: {
        key: true,
        value: true,
        valueType: true,
      },
    });
    const map: Record<string, unknown> = {};
    for (const s of settings) {
      map[s.key] = this.castValue(s.value, s.valueType);
    }
    return map;
  }

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
      select: { value: true },
    });
    return setting?.value ?? null;
  }

  async getByKey(key: string): Promise<SettingResponseDto> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return this.toResponseDto(setting);
  }

  async getTyped<T>(key: string, defaultValue: T): Promise<T> {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
      select: {
        value: true,
        valueType: true,
      },
    });
    if (!setting) return defaultValue;
    return this.castValue(setting.value, setting.valueType) as T;
  }

  async upsert(dto: UpsertSettingDto): Promise<SettingResponseDto> {
    const existing = await this.prisma.setting.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      const updated = await this.prisma.setting.update({
        where: { key: dto.key },
        data: {
          value: dto.value,
          group: dto.group ?? existing.group,
          description: dto.description ?? existing.description,
          valueType: dto.valueType ?? existing.valueType,
        },
      });
      return this.toResponseDto(updated);
    }
    const saved = await this.prisma.setting.create({
      data: {
        key: dto.key,
        value: dto.value,
        valueType: dto.valueType,
        description: dto.description,
        group: dto.group ?? 'general',
      },
    });
    return this.toResponseDto(saved);
  }

  async bulkUpsert(dtos: UpsertSettingDto[]): Promise<SettingResponseDto[]> {
    const results = [];
    for (const dto of dtos) {
      results.push(await this.upsert(dto));
    }
    return results;
  }

  async remove(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException('Setting not found');
    await this.prisma.setting.delete({ where: { id: setting.id } });
    return { message: 'Setting deleted' };
  }

  private castValue(value: string | null, valueType: string): unknown {
    if (value === null || value === undefined) return null;
    switch (valueType) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'json':
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
}
