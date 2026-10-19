import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsUUID, IsString } from 'class-validator';

export class UpdateSubcategoryStatusDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  parentId: string;

  @ApiProperty({ enum: ['active', 'inactive'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['active', 'inactive'])
  status: string;
}
