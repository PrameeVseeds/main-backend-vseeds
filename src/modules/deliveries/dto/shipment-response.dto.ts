import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShipmentResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  orderId: string;
  @ApiPropertyOptional()
  orderNumber?: string;
  @ApiPropertyOptional()
  trackingNumber?: string;
  @ApiPropertyOptional()
  carrier?: string;
  @ApiPropertyOptional()
  shippedAt?: string;
  @ApiPropertyOptional()
  expectedDeliveryAt?: string;
  @ApiPropertyOptional()
  deliveredAt?: string;
  @ApiProperty()
  shippingFee: number;
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;
}
