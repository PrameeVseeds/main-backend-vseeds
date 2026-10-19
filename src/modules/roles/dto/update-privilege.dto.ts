import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdatePrivilegeDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  privilegeId: string;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
