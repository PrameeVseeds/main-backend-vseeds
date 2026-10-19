import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Order, Quote, Prisma } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Public ─────────────────────────────────────────────────────

  async getAverageRating(productId: string) {
    const aggregate = await this.prisma.productReview.aggregate({
      _avg: {
        rating: true,
      },
      _count: {
        _all: true,
      },
      where: {
        productId,
        isApproved: true,
      },
    });

    return {
      rating: aggregate._avg.rating ?? 0,
      count: aggregate._count._all ?? 0,
    };
  }

  async findByProduct(productId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where: { productId, isApproved: true },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.productReview.count({
        where: { productId, isApproved: true },
      }),
    ]);

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.user ? `${r.user.firstName} ${r.user.lastName}` : null,
        rating: r.rating,
        reviewText: r.reviewText,
        imageUrl: r.imageUrl,
        adminReply: r.adminReply,
        createdAt: r.createdAt,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async findById(reviewId: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
      include: { user: true, product: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    return {
      id: review.id,
      productId: review.productId,
      productName: review.product?.name,
      userId: review.userId,
      userEmail: review.user?.email,
      rating: review.rating,
      reviewText: review.reviewText ?? undefined,
      imageUrl: review.imageUrl ?? undefined,
      adminReply: review.adminReply ?? undefined,
      adminReplyAt: review.adminReplyAt?.toISOString(),
      isApproved: review.isApproved,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }

  // ─── User ───────────────────────────────────────────────────────

  /**
   * Check if a user is eligible to leave a review.
   * The user must have at least one delivered order or approved/paid quote.
   */
  async checkEligibility(userId: string, productId?: string) {
    let completedOrder: Order | null = null;
    let approvedQuote: Quote | null = null;

    if (productId) {
      completedOrder = await this.prisma.order.findFirst({
        where: {
          userId,
          status: 'delivered',
          items: {
            some: {
              productId,
            },
          },
          deletedAt: null,
        },
      });
    } else {
      completedOrder = await this.prisma.order.findFirst({
        where: {
          userId,
          status: 'delivered',
          deletedAt: null,
        },
      });
    }

    approvedQuote = await this.prisma.quote.findFirst({
      where: {
        userId,
        status: { in: ['approved', 'paid'] },
      },
    });

    const eligible = !!completedOrder || !!approvedQuote;

    return {
      eligible,
      completedOrderId: completedOrder?.id ?? null,
      approvedQuoteId: approvedQuote?.id ?? null,
      reason: eligible
        ? 'You have a completed order or approved quote'
        : productId
          ? 'You must have a delivered order containing this product to leave a review'
          : 'You must have a completed order or an approved quote to leave a review',
    };
  }

  async create(userId: string, dto: CreateReviewDto) {
    if (!dto.orderId && !dto.quoteId) {
      const eligibility = await this.checkEligibility(userId, dto.productId);
      if (!eligibility.eligible) {
        throw new ForbiddenException(
          'You can only submit a review after receiving a delivered order containing this product.',
        );
      }
      dto.orderId = eligibility.completedOrderId ?? undefined;
      dto.quoteId = eligibility.approvedQuoteId ?? undefined;
    }

    // If orderId is provided, validate it belongs to the user and is delivered
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
      });
      if (!order || order.userId !== userId) {
        throw new NotFoundException(
          'Order not found or does not belong to you',
        );
      }
      if (order.status !== 'delivered') {
        throw new ForbiddenException(
          `Order status is "${order.status}". Only delivered orders qualify for reviews.`,
        );
      }
    }

    // If quoteId is provided, validate it belongs to the user and is approved/paid
    if (dto.quoteId) {
      const quote = await this.prisma.quote.findUnique({
        where: { id: dto.quoteId },
      });
      if (!quote || quote.userId !== userId) {
        throw new NotFoundException(
          'Quote not found or does not belong to you',
        );
      }
      if (!['approved', 'paid'].includes(quote.status)) {
        throw new ForbiddenException(
          `Quote status is "${quote.status}". Only approved or paid quotes qualify for reviews.`,
        );
      }
    }

    // If neither orderId nor quoteId ended up being set, block
    if (!dto.orderId && !dto.quoteId) {
      throw new ForbiddenException(
        'You must have a completed order or an approved quote to submit a review.',
      );
    }

    // Check for duplicate review on the same order/quote + product
    const existingWhere: Prisma.ProductReviewWhereInput = {
      userId,
      productId: dto.productId,
    };
    if (dto.orderId) existingWhere.orderId = dto.orderId;
    if (dto.quoteId) existingWhere.quoteId = dto.quoteId;

    const existing = await this.prisma.productReview.findFirst({
      where: existingWhere,
    });
    if (existing) {
      throw new BadRequestException(
        'You have already submitted a review for this product on this order/quote.',
      );
    }

    return this.prisma.productReview.create({
      data: {
        userId,
        productId: dto.productId,
        reviewText: dto.reviewText,
        rating: dto.rating,
        imageUrl: dto.imageUrl,
        orderId: dto.orderId ?? null,
        quoteId: dto.quoteId ?? null,
        isApproved: false,
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.productReview.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserEmail(email: string) {
    return this.prisma.productReview.findMany({
      where: {
        user: {
          email,
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(userId: string, productId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.productReview.findFirst({
      where: { userId, productId },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.productReview.update({
      where: { id: review.id },
      data: {
        reviewText: dto.reviewText !== undefined ? dto.reviewText : undefined,
        rating: dto.rating !== undefined ? dto.rating : undefined,
        imageUrl: dto.imageUrl !== undefined ? dto.imageUrl : undefined,
      },
    });
  }

  // ─── Admin ──────────────────────────────────────────────────────

  async findAllAdmin(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;

    const [reviews, total] = await Promise.all([
      this.prisma.productReview.findMany({
        include: {
          user: true,
          product: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.productReview.count(),
    ]);

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        userId: r.userId,
        productId: r.productId,
        rating: r.rating,
        reviewText: r.reviewText,
        adminReply: r.adminReply,
        isApproved: r.isApproved,
        createdAt: r.createdAt,
        name: r.user ? `${r.user.firstName} ${r.user.lastName}` : null,
        productName: r.product?.name ?? null,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async adminReply(reviewId: string, adminReply: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        adminReply,
        adminReplyAt: new Date(),
      },
    });
  }

  async approve(reviewId: string, isApproved: boolean) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.productReview.update({
      where: { id: reviewId },
      data: { isApproved },
    });
  }

  async delete(reviewId: string) {
    await this.findById(reviewId);
    await this.prisma.productReview.delete({
      where: { id: reviewId },
    });
    return { message: 'Review deleted' };
  }
}
