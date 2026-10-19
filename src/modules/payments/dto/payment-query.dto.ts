import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PaymentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['pending', 'completed', 'cancelled', 'all'] })
  @IsString()
  @IsOptional()
  status?: string;
}
