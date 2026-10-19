import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for bank endpoints to reduce payload and avoid exposing full entity.
 * Used by admin-vseeds and electronics-vseeds (bank details for checkout).
 */
export class BankResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  bankName: string;

  @ApiProperty()
  branch: string;

  @ApiProperty()
  accountNumber: string;

  @ApiProperty()
  accountName: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
