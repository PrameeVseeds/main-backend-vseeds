import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateQuoteStatusDto {
  @ApiProperty({
    enum: ['pending', 'quoted', 'approved', 'declined', 'paid', 'cancelled'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'quoted', 'approved', 'declined', 'paid', 'cancelled'])
  status: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  totalPrice?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  serviceLevel?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  estimatedBuildTime?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  adminNotes?: string;
}
