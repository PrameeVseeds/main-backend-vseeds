import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShipmentDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  carrier?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  shippedAt: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expectedDeliveryAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  shippingFee?: number;
}
