import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromoCodeResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  code: string;
  @ApiPropertyOptional()
  description?: string;
  @ApiProperty()
  discountType: string;
  @ApiProperty()
  discountValue: number;
  @ApiProperty()
  applicableSite: string;
  @ApiProperty()
  minimumOrderAmount: number;
  @ApiPropertyOptional()
  maximumDiscountAmount?: number;
  @ApiProperty()
  usageLimit: number;
  @ApiProperty()
  usedCount: number;
  @ApiProperty()
  perUserLimit: number;
  @ApiPropertyOptional()
  startDate?: string;
  @ApiPropertyOptional()
  expiryDate?: string;
  @ApiProperty()
  isActive: boolean;
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;
}
