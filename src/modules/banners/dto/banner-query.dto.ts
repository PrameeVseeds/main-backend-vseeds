import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class BannerQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'desktop', 'mobile'] })
  @IsString()
  @IsOptional()
  @IsIn(['all', 'desktop', 'mobile'])
  device_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  is_active?: string;
}
