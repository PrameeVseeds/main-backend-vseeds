import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for admin detail (see plan).
 */
export class AdminResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  roleId?: string;

  @ApiProperty({ required: false })
  role?: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  avatarUrl?: string;

  @ApiProperty({ required: false })
  twoFactorEnabled?: boolean;

  @ApiProperty({ required: false })
  lastLoginAt?: Date;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
