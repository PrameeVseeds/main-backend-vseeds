import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateInvoiceTemplateDto {
  @ApiProperty({ description: 'Template version name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Template settings JSON object' })
  @IsObject()
  settings: Record<string, any>;

  @ApiPropertyOptional({ description: 'Whether this is the active template' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
