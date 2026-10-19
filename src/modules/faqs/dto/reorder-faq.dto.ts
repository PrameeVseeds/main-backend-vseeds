import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderFaqDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}
