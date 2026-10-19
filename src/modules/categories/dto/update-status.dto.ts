import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ enum: ['active', 'inactive'] })
  @IsString()
  @IsIn(['active', 'inactive'])
  status: string;
}
