import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for project endpoints (see plan).
 */
export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  imageUrl?: string;

  @ApiProperty({ required: false })
  image?: string;

  @ApiProperty({ required: false })
  isActive?: boolean;

  @ApiProperty({ required: false })
  isPublic?: boolean;

  @ApiProperty({ required: false, type: [String] })
  technologies?: string[];

  @ApiProperty({ required: false })
  displayOrder?: number;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
