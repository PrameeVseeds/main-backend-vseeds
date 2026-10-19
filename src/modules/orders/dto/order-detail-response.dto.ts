import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderDetailItemDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  productId: string | null;
  @ApiProperty()
  productName: string;
  @ApiPropertyOptional()
  productSku?: string;
  @ApiPropertyOptional()
  productImage?: string;
  @ApiProperty()
  quantity: number;
  @ApiProperty()
  unitPrice: number;
  @ApiProperty()
  totalPrice: number;
}

export class OrderDetailAddressDto {
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
}

export class OrderDetailStatusHistoryDto {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional()
  fromStatus?: string;
  @ApiProperty()
  toStatus: string;
  @ApiPropertyOptional()
  note?: string;
  @ApiProperty()
  createdAt: string;
}

export class OrderDetailShipmentDto {
  @ApiProperty()
  id: string;
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
  createdAt: string;
}

export class OrderDetailPaymentDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  paymentNumber: string;
  @ApiProperty()
  amount: number;
  @ApiProperty()
  paymentMethod: string;
  @ApiProperty()
  status: string;
  @ApiPropertyOptional()
  paidAt?: string;
}

export class OrderDetailResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  orderNumber: string;
  @ApiProperty()
  userId: string;
  @ApiPropertyOptional()
  userEmail?: string;
  @ApiPropertyOptional()
  shippingAddressId?: string;
  @ApiPropertyOptional()
  shippingAddress?: OrderDetailAddressDto;
  @ApiProperty()
  orderType: string;
  @ApiPropertyOptional()
  quoteId?: string;
  @ApiProperty()
  subtotal: number;
  @ApiProperty()
  shippingFee: number;
  @ApiProperty()
  taxAmount: number;
  @ApiProperty()
  discountAmount: number;
  @ApiPropertyOptional()
  promoCode?: string;
  @ApiProperty()
  totalAmount: number;
  @ApiProperty()
  status: string;
  @ApiPropertyOptional()
  customerNotes?: string;
  @ApiPropertyOptional()
  adminNotes?: string;
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;
  @ApiProperty({ type: [OrderDetailItemDto] })
  items: OrderDetailItemDto[];
  @ApiProperty({ type: [OrderDetailStatusHistoryDto] })
  statusHistory: OrderDetailStatusHistoryDto[];
  @ApiProperty({ type: [OrderDetailShipmentDto] })
  shipments: OrderDetailShipmentDto[];
  @ApiProperty({ type: [OrderDetailPaymentDto] })
  payments: OrderDetailPaymentDto[];
}
