import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class OrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: [
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'waiting for payment',
      'all',
    ],
  })
  @IsString()
  @IsOptional()
  status?: string;
}
