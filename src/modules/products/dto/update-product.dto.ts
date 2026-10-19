import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProductDto, toBool } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  // Redeclared so the boolean transform definitely runs on update —
  // enableImplicitConversion would otherwise coerce 'false' → true.
  @ApiPropertyOptional()
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
