import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for role endpoints to reduce payload (see plan).
 */
export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty({ required: false })
  members?: number;

  @ApiProperty({ required: false, type: [String] })
  privileges?: string[];

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
