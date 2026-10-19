import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressResponseDto {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional()
  label?: string;
  @ApiProperty()
  fullName: string;
  @ApiPropertyOptional()
  email?: string;
  @ApiProperty()
  phone: string;
  @ApiProperty()
  addressLine1: string;
  @ApiPropertyOptional()
  addressLine2?: string;
  @ApiPropertyOptional()
  city?: string;
  @ApiProperty()
  district: string;
  @ApiProperty()
  province: string;
  @ApiProperty()
  postalCode: string;
  @ApiPropertyOptional()
  isDefault?: boolean;
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;
}
