import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Order ID to generate the invoice from' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({ description: 'Additional notes for the invoice' })
  @IsString()
  @IsOptional()
  notes?: string;
}
