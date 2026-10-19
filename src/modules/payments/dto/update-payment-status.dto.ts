import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: ['pending', 'completed', 'failed', 'refunded'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'completed', 'failed', 'refunded'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
