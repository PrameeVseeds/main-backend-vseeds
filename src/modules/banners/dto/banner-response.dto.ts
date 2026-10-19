import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for banner endpoints to reduce payload (see plan).
 */
export class BannerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty()
  imageUrl: string;

  @ApiProperty({ required: false })
  linkUrl?: string;

  @ApiProperty()
  deviceType: string;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  startsAt?: Date;

  @ApiProperty({ required: false })
  endsAt?: Date;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}
