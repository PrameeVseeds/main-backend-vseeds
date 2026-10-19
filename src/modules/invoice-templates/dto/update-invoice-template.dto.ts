import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsString,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class UpdateInvoiceTemplateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
