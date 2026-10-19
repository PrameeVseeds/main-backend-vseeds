import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: ['all', 'active', 'inactive', 'out_of_stock', 'discontinued'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['all', 'active', 'inactive', 'out_of_stock', 'discontinued'])
  status?: string;

  @ApiPropertyOptional({
    enum: [
      'new',
      'price_low_to_high',
      'price_high_to_low',
      'name_a_to_z',
      'name_z_to_a',
    ],
  })
  @IsString()
  @IsOptional()
  filter?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subcategory?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  excludeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated attribute IDs used for similar product matching',
  })
  @IsString()
  @IsOptional()
  attributeIds?: string;

  @ApiPropertyOptional({
    description: 'Attribute filters in key:value,key2:value2 format',
  })
  @IsString()
  @IsOptional()
  attributes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional({
    enum: ['admin', 'catalog'],
    description: 'Response detail level',
  })
  @IsString()
  @IsOptional()
  @IsIn(['admin', 'catalog'])
  view?: 'admin' | 'catalog';
}
