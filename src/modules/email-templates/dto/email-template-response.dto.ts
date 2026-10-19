import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for email template endpoints to reduce payload (see plan).
 */
export class EmailTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  subject: string;

  @ApiProperty({ required: false })
  htmlBody?: string;

  @ApiProperty({ required: false })
  textBody?: string;

  @ApiProperty({ required: false })
  variables?: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
