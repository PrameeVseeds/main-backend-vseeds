import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GalleryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['all', 'used', 'orphaned', 'thumbnail'] })
  @IsString()
  @IsOptional()
  @IsIn(['all', 'used', 'orphaned', 'thumbnail'])
  filter?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;
}
