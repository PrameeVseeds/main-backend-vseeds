import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for contact detail (see plan).
 */
export class ContactReplyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  createdAt?: Date;
}

export class ContactDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  subject?: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ type: [ContactReplyResponseDto] })
  replies: ContactReplyResponseDto[];
}
