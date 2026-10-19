import { ApiProperty } from '@nestjs/swagger';

/**
 * OPT: Response DTO for wishlist by user (see plan).
 * Electronics uses: id, productId, product.name, product.slug, product.price, product.image, product.category.name.
 */
export class WishlistProductSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false })
  thumbnailUrl?: string;

  @ApiProperty({ required: false })
  price?: number;

  @ApiProperty({ required: false })
  categoryName?: string;
}

export class WishlistItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ required: false })
  createdAt?: Date;

  @ApiProperty({ type: WishlistProductSummaryDto })
  product: WishlistProductSummaryDto;
}
