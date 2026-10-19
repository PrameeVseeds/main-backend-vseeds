import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddWishlistDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId: string;
}
