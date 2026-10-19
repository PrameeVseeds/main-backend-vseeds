import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateAdminStatusDto {
  @ApiProperty({ enum: ['active', 'inactive', 'suspended'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['active', 'inactive', 'suspended'])
  status: string;
}
