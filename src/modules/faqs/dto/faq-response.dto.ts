import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for FAQ endpoints to reduce payload (see plan).
 */
export class FaqResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  answer: string;

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty()
  site: string;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
