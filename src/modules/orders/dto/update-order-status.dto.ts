import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const ORDER_STATUSES = [
  'pending',
  'waiting_for_payment',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ORDER_STATUSES })
  @IsString()
  @IsNotEmpty()
  @IsIn(ORDER_STATUSES)
  status: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
