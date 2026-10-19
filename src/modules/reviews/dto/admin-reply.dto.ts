import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminReplyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  adminReply: string;
}
