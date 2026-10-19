import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for role-privilege list (see plan).
 */
export class RolePrivilegeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  roleId: string;

  @ApiProperty()
  privilegeId: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  privilegeName?: string;

  @ApiProperty({ required: false })
  privilegeModule?: string;
}
