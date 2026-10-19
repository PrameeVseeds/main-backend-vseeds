import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  productId: string;
  @ApiPropertyOptional()
  productName?: string;
  @ApiProperty()
  userId: string;
  @ApiPropertyOptional()
  userEmail?: string;
  @ApiProperty()
  rating: number;
  @ApiPropertyOptional()
  reviewText?: string;
  @ApiPropertyOptional()
  imageUrl?: string;
  @ApiPropertyOptional()
  adminReply?: string;
  @ApiPropertyOptional()
  adminReplyAt?: string;
  @ApiProperty()
  isApproved: boolean;
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;
}
