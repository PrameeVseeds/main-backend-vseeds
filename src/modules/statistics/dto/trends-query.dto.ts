import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class TrendsQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '1y'] })
  @IsString()
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '1y'])
  period?: string;
}
