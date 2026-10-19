import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shippingAddressId?: string;

  @ApiPropertyOptional({ enum: ['product', 'service'] })
  @IsString()
  @IsOptional()
  @IsIn(['product', 'service'])
  orderType?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  quoteId?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  promoCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  site?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerNotes?: string;
}
