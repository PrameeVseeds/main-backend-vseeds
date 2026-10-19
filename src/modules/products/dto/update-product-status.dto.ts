import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { toBool } from './create-product.dto';

export class UpdateProductStatusDto {
  @ApiPropertyOptional({
    enum: ['active', 'inactive', 'out_of_stock', 'discontinued'],
  })
  @IsString()
  @IsIn(['active', 'inactive', 'out_of_stock', 'discontinued'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  quantityInHand?: number;

  @ApiPropertyOptional()
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
