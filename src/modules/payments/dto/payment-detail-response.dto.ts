import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for payment detail (see plan).
 */
export class PaymentDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  paymentMethod?: string;

  @ApiProperty({ required: false })
  paymentNumber?: string;

  @ApiProperty({ required: false })
  referenceNumber?: string;

  @ApiProperty({ required: false })
  paidAt?: Date;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  orderNumber?: string;

  @ApiProperty({ required: false })
  orderTotal?: number;

  @ApiProperty({ required: false })
  userEmail?: string;

  @ApiProperty({ required: false })
  firstName?: string;

  @ApiProperty({ required: false })
  lastName?: string;

  /** Set when loaded with order; used for auth (own payment check). */
  @ApiProperty({ required: false })
  userId?: string;
}
