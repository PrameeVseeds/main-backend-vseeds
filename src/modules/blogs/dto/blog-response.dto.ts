import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for blog endpoints (see plan).
 */
export class BlogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false })
  excerpt?: string;

  @ApiProperty({ required: false })
  content?: string;

  @ApiProperty({ required: false })
  coverImageUrl?: string;

  @ApiProperty({ required: false })
  author?: string;

  @ApiProperty({ required: false, type: [String] })
  tags?: string[];

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  publishedAt?: Date;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
