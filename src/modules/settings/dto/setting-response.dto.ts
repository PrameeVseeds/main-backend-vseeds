import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for settings endpoints to reduce payload (see plan).
 */
export class SettingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty({ required: false })
  value?: string;

  @ApiProperty()
  valueType: string;

  @ApiProperty()
  group: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
