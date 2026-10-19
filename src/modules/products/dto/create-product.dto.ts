import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

const toNumber = ({ value }: { value: unknown }): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
};

export const toBool = ({
  value,
  obj,
  key,
}: TransformFnParams): boolean | undefined => {
  // enableImplicitConversion coerces 'false' → Boolean('false') === true on
  // `value` before this runs — read the raw source value from obj[key] so
  // 'false'/'0' map to false correctly.
  const raw =
    obj && typeof key === 'string'
      ? (obj as Record<string, unknown>)[key]
      : undefined;
  const v = raw !== undefined ? raw : value;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
};

const safeStringify = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return '';
  }
};

export class ProductAttributeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attributeId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional()
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isSimilarFilter?: boolean;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({
    description: 'Minimum purchase quantity (unit count)',
  })
  @Transform(toNumber)
  @IsInt()
  @IsOptional()
  minPurchaseValue?: number;

  @ApiPropertyOptional({
    description: 'Product specifications (HTML string)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | null => {
    if (value === null || value === undefined || value === '') return null;
    let result: unknown = value;
    for (let i = 0; i < 10; i++) {
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result);
          continue;
        } catch {
          break;
        }
      }
      if (Array.isArray(result) && result.length === 1) {
        result = result[0];
        continue;
      }
      break;
    }
    return typeof result === 'string' ? result : safeStringify(value);
  })
  specifications?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] => {
    if (value === null || value === undefined || value === '') return [];
    if (Array.isArray(value)) return value.map(safeStringify);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed)
          ? parsed.map(safeStringify)
          : [safeStringify(parsed)];
      } catch {
        return [value];
      }
    }
    return [safeStringify(value)];
  })
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  datasheetUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model3dUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  storeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturerProductNumber?: string;

  @ApiPropertyOptional()
  @Transform(toNumber)
  @IsNumber()
  @IsOptional()
  quantityInHand?: number;

  @ApiPropertyOptional()
  @Transform(toNumber)
  @IsNumber()
  @IsOptional()
  quantityOrdered?: number;

  @ApiPropertyOptional()
  @Transform(toNumber)
  @IsNumber()
  @IsOptional()
  purchasedPrice?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expectedDate?: string;

  @ApiPropertyOptional()
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @Transform(toNumber)
  @IsNumber()
  @IsOptional()
  price1?: number;

  @ApiPropertyOptional()
  @Transform(toNumber)
  @IsNumber()
  @IsOptional()
  price10?: number;

  @ApiPropertyOptional()
  @Transform(toNumber)
  @IsNumber()
  @IsOptional()
  price100?: number;

  @ApiPropertyOptional({
    enum: ['active', 'inactive', 'out_of_stock', 'discontinued'],
  })
  @IsEnum(['active', 'inactive', 'out_of_stock', 'discontinued'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: [ProductAttributeDto] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }: { value: unknown }): ProductAttributeDto[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value as ProductAttributeDto[];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? (parsed as ProductAttributeDto[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  })
  attributes?: ProductAttributeDto[];
}
