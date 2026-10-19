import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { WishlistItemResponseDto } from './dto/wishlist-item-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class WishlistsService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, productId: string) {
    const existing = await this.prisma.wishlist.findUnique({
      where: {
        uq_wish: { userId, productId },
      },
    });
    if (existing) throw new BadRequestException('Product already in wishlist');

    return this.prisma.wishlist.create({
      data: { userId, productId },
    });
  }

  async remove(userId: string, productId: string) {
    const item = await this.prisma.wishlist.findUnique({
      where: {
        uq_wish: { userId, productId },
      },
    });
    if (!item) throw new BadRequestException('Product not in wishlist');

    await this.prisma.wishlist.delete({
      where: { id: item.id },
    });
    return { message: 'Removed from wishlist' };
  }

  // OPT: Selective load for product + category name only (see wishlist-item-response.dto.ts).
  async getByUser(userId: string): Promise<WishlistItemResponseDto[]> {
    return this.getWishlistItemsRaw(userId, 'id');
  }

  // OPT: Response DTO + raw query. Optional pagination: when page/limit provided return { items, total, totalPages, page }; else return full array for compatibility.
  async getByUserEmail(
    email: string,
    pagination?: { page?: number; limit?: number },
  ): Promise<
    | WishlistItemResponseDto[]
    | {
        items: WishlistItemResponseDto[];
        total: number;
        totalPages: number;
        page: number;
      }
  > {
    const all = await this.getWishlistItemsRaw(email, 'email');
    if (pagination?.page != null || pagination?.limit != null) {
      const page = Math.max(1, pagination.page ?? 1);
      const limit = Math.min(100, Math.max(1, pagination.limit ?? 20));
      const total = all.length;
      const start = (page - 1) * limit;
      const items = all.slice(start, start + limit);
      return { items, total, totalPages: Math.ceil(total / limit), page };
    }
    return all;
  }

  private async getWishlistItemsRaw(
    userIdOrEmail: string,
    by: 'id' | 'email',
  ): Promise<WishlistItemResponseDto[]> {
    const where: Prisma.WishlistWhereInput = {};
    if (by === 'id') {
      where.userId = userIdOrEmail;
    } else {
      where.user = { email: userIdOrEmail };
    }

    const items = await this.prisma.wishlist.findMany({
      where: {
        ...where,
        product: {
          deletedAt: null,
        },
      },
      include: {
        product: {
          include: {
            category: true,
            productMedia: {
              where: {
                isThumbnail: true,
              },
              include: {
                media: true,
              },
              take: 1,
            },
            priceTiers: {
              where: {
                minQuantity: 1,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return items.map((item) => {
      const p = item.product;
      const thumbnailMedia = p.productMedia[0]?.media;
      const thumbnailUrl = thumbnailMedia?.url;
      const priceTier = p.priceTiers[0];
      const price = priceTier ? Number(priceTier.price) : undefined;
      const categoryName = p.category?.name;

      return {
        id: item.id,
        productId: item.productId,
        createdAt: item.createdAt,
        product: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          thumbnailUrl: thumbnailUrl ?? undefined,
          image: thumbnailUrl ?? undefined,
          price: price,
          categoryName: categoryName ?? undefined,
          category: categoryName != null ? { name: categoryName } : undefined,
        },
      };
    });
  }

  async countForProduct(productId: string) {
    const count = await this.prisma.wishlist.count({ where: { productId } });
    return { count };
  }

  // ─── Admin ──────────────────────────────────────────────────────

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const results = await this.prisma.$queryRaw<
      {
        productId: string;
        productName: string;
        sku: string | null;
        quantityInHand: number | string | null;
        wishlistCount: bigint | number;
      }[]
    >`
      SELECT 
        w.product_id AS productId, 
        COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(p.slug), ''), 'Product unavailable') AS productName, 
        p.sku AS sku, 
        p.quantity_in_hand AS quantityInHand, 
        COUNT(*) AS wishlistCount 
      FROM wishlists w 
      LEFT JOIN products p ON TRIM(p.id) = TRIM(w.product_id) 
      GROUP BY w.product_id, p.name, p.slug, p.sku, p.quantity_in_hand 
      ORDER BY wishlistCount DESC 
      LIMIT ${limit} OFFSET ${offset}
    `;

    return results.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      quantityInHand: r.quantityInHand,
      wishlistCount: Number(r.wishlistCount),
    }));
  }

  async getUsersForProduct(productId: string) {
    const list = await this.prisma.wishlist.findMany({
      where: { productId },
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return list.map((w) => ({
      id: w.id,
      createdAt: w.createdAt,
      user: w.user
        ? {
            id: w.user.id,
            email: w.user.email,
            username: `${w.user.firstName} ${w.user.lastName}`.trim(),
          }
        : null,
    }));
  }
}
