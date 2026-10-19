import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ActivityLogQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  actor_id?: string;

  @ApiPropertyOptional({ enum: ['admin', 'user', 'system'] })
  @IsString()
  @IsOptional()
  actor_type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entity_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  start_date?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}
