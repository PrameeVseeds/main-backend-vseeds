import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class InvoiceQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['draft', 'generated', 'sent', 'paid', 'cancelled', 'all'],
    description: 'Filter by invoice status',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    enum: ['pending', 'completed', 'failed', 'refunded', 'all'],
    description: 'Filter by payment status',
  })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({
    description: 'Search by invoice number, order number, customer name, email or phone',
  })
  @IsString()
  @IsOptional()
  customer?: string;

  @ApiPropertyOptional({
    description: 'Start of createdAt date range (ISO 8601)',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End of createdAt date range (ISO 8601)',
  })
  @IsString()
  @IsOptional()
  endDate?: string;
}
