import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyContactDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;
}
