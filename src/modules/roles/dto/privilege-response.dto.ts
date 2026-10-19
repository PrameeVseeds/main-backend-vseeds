import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for privilege endpoints (see plan).
 */
export class PrivilegeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  module: string;

  @ApiProperty({ required: false })
  description?: string;
}
