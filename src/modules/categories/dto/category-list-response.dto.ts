import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for category list/tree to reduce payload (see plan).
 * Electronics needs: id, name, slug, icon, children (id, name, slug).
 */
export class CategoryListResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false })
  icon?: string;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty({ required: false })
  displayOrder?: number;

  @ApiProperty({ required: false })
  parentId?: string | null;

  @ApiProperty({ required: false, type: () => [CategoryListResponseDto] })
  children?: CategoryListResponseDto[];

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
