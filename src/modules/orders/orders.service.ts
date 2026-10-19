import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { Prisma, OrderType, OrderStatus } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const orderEntityInclude = Prisma.validator<Prisma.OrderInclude>()({
  user: {
    include: {
      addresses: true,
    },
  },
  items: {
    include: {
      product: {
        include: {
          productMedia: {
            include: {
              media: true,
            },
          },
        },
      },
    },
  },
  shippingAddress: true,
  statusHistory: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  shipments: true,
  payments: true,
});

export type OrderEntity = Prisma.OrderGetPayload<{
  include: typeof orderEntityInclude;
}>;

type ProductWithPriceTiers = Prisma.ProductGetPayload<{
  include: { priceTiers: true };
}>;
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  OrderDetailResponseDto,
  OrderDetailItemDto,
} from './dto/order-detail-response.dto';
import { EmailQueueService } from '../email/email-queue.service';
import { BanksService } from '../banks/banks.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { SettingsService } from '../settings/settings.service';

const TERMINAL_STATUSES = ['cancelled', 'refunded', 'delivered'];

/** Orders in these statuses with no completed payment are auto-cancelled after this many days. */
export const UNPAID_AUTO_CANCEL_DAYS = 10;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['waiting_for_payment', 'processing', 'cancelled'],
  waiting_for_payment: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'cancelled', 'refunded'],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueueService: EmailQueueService,
    private readonly banksService: BanksService,
    private readonly promoCodesService: PromoCodesService,
    private readonly encryptionService: EncryptionService,
    private readonly settingsService: SettingsService,
  ) {}

  /** Creates order in a transaction: items, optional promo, status history; sends confirmation email. */
  async create(userId: string, dto: CreateOrderDto) {
    const pricingSettings = await this.settingsService.getPricingSettings();
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { priceTiers: true },
    });

    const productMap = new Map<string, ProductWithPriceTiers>(
      products.map((p) => [p.id, p]),
    );
    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }
      if (
        ['inactive', 'out_of_stock', 'discontinued'].includes(product.status)
      ) {
        throw new BadRequestException(
          `Product "${product.name}" is currently ${product.status.replace('_', ' ')} and cannot be ordered`,
        );
      }
      if (product.quantityInHand < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}": requested ${item.quantity}, available ${product.quantityInHand}`,
        );
      }
    }

    let promoResult: {
      promoCodeId: string;
      code: string;
      discountAmount: number;
    } | null = null;
    if (dto.promoCode) {
      const validated = await this.promoCodesService.validate(
        {
          code: dto.promoCode,
          subtotal: 0,
          site: dto.site,
        },
        userId,
      );
      promoResult = {
        promoCodeId: validated.promoCodeId,
        code: validated.code,
        discountAmount: 0,
      };
    }

    const savedOrder = await this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const resolvedItems = dto.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const unitPrice = this.resolveUnitPrice(product, item.quantity);
        const totalPrice = +(unitPrice * item.quantity).toFixed(2);
        subtotal += totalPrice;
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        };
      });

      if (promoResult) {
        const revalidated = await this.promoCodesService.validate(
          {
            code: promoResult.code,
            subtotal,
            site: dto.site,
          },
          userId,
        );
        promoResult.discountAmount = revalidated.discountAmount;
      }

      const discountAmount =
        promoResult?.discountAmount ?? dto.discountAmount ?? 0;
      const shippingFee =
        dto.shippingFee ?? pricingSettings.shippingFee ?? 0;
      const taxAmount = pricingSettings.taxEnabled
        ? +((subtotal * (pricingSettings.taxPercentage || 0)) / 100).toFixed(2)
        : 0;
      const totalAmount = +(
        subtotal -
        discountAmount +
        shippingFee +
        taxAmount
      ).toFixed(2);
      const orderNumber = await this.generateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          userId,
          orderNumber,
          totalAmount,
          subtotal,
          discountAmount,
          shippingFee,
          taxAmount,
          shippingAddressId: dto.shippingAddressId ?? null,
          orderType: dto.orderType as OrderType,
          quoteId: dto.quoteId ?? null,
          customerNotes: dto.customerNotes ?? null,
          adminNotes: null,
          promoCode: promoResult?.code ?? null,
          promoCodeId: promoResult?.promoCodeId ?? null,
          status: 'pending',
        },
      });

      await tx.orderItem.createMany({
        data: resolvedItems.map((ri) => ({
          orderId: order.id,
          ...ri,
        })),
      });

      if (dto.customerNotes || dto.shippingAddressId) {
        await tx.orderComment.create({
          data: {
            orderId: order.id,
            comments: dto.customerNotes ?? null,
            addressId: dto.shippingAddressId ?? null,
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'pending',
        },
      });

      const paymentNumber = await this.generatePaymentNumber(tx);
      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: totalAmount,
          paymentMethod: 'bank_transfer',
          paymentNumber,
          status: 'pending',
        },
      });

      return order;
    });

    if (promoResult) {
      await this.promoCodesService.incrementUsage(promoResult.promoCodeId);
    }

    const orderWithUser = await this.getOrderEntity(savedOrder.id);
    try {
      void this.emailQueueService.enqueue(
        'order-confirmation',
        orderWithUser.user.email,
        {
          username:
            `${orderWithUser.user.firstName} ${orderWithUser.user.lastName}`.trim(),
          orderId: orderWithUser.orderNumber,
          orderDate: orderWithUser.createdAt.toLocaleDateString(),
        },
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Order confirmation email failed: ${errMsg}`);
    }

    return this.mapOrderToDetailDto(orderWithUser);
  }

  /** Loads full Order entity with relations for internal use (emails, inventory, etc.). */
  private async getOrderEntity(orderId: string): Promise<OrderEntity> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          include: {
            addresses: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                productMedia: {
                  include: {
                    media: true,
                  },
                },
              },
            },
          },
        },
        shippingAddress: true,
        statusHistory: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        shipments: true,
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findById(orderId: string): Promise<OrderDetailResponseDto> {
    const order = await this.getOrderEntity(orderId);
    return this.mapOrderToDetailDto(order);
  }

  /** Maps Order entity to OrderDetailResponseDto for consistent API response. */
  private mapOrderToDetailDto(order: OrderEntity): OrderDetailResponseDto {
    const items: OrderDetailItemDto[] = (order.items || []).map((item) => {
      const media = (item.product?.productMedia || []).sort(
        (a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
      );
      const productImage =
        media.find((pm: any) => pm.isThumbnail)?.media?.url ||
        media[0]?.media?.url ||
        undefined;
      return {
        id: item.id,
        productId: item.productId ?? null,
        productName: item.productName,
        productSku: item.product?.sku ?? undefined,
        productImage,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      };
    });
    const shippingAddress = order.shippingAddress
      ? {
          id: order.shippingAddress.id,
          label: order.shippingAddress.label ?? undefined,
          fullName: this.decryptField(order.shippingAddress.fullName),
          email: order.shippingAddress.email ? this.decryptField(order.shippingAddress.email) : undefined,
          phone: this.decryptField(order.shippingAddress.phone),
          addressLine1: this.decryptField(order.shippingAddress.addressLine1),
          addressLine2: order.shippingAddress.addressLine2 ? this.decryptField(order.shippingAddress.addressLine2) : undefined,
          city: order.shippingAddress.city ? this.decryptField(order.shippingAddress.city) : undefined,
          district: this.decryptField(order.shippingAddress.district),
          province: this.decryptField(order.shippingAddress.province),
          postalCode: this.decryptField(order.shippingAddress.postalCode),
        }
      : undefined;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userEmail: order.user?.email ? this.decryptField(order.user.email) : undefined,
      shippingAddressId: order.shippingAddressId ?? undefined,
      shippingAddress,
      orderType: order.orderType,
      quoteId: order.quoteId ?? undefined,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      taxAmount: Number(order.taxAmount),
      discountAmount: Number(order.discountAmount),
      promoCode: order.promoCode ?? undefined,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      customerNotes: order.customerNotes ?? undefined,
      adminNotes: order.adminNotes ?? undefined,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items,
      statusHistory: (order.statusHistory || []).map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus ?? undefined,
        toStatus: h.toStatus,
        note: h.note ?? undefined,
        createdAt: h.createdAt.toISOString(),
      })),
      shipments: (order.shipments || []).map((s) => ({
        id: s.id,
        trackingNumber: s.trackingNumber ?? undefined,
        carrier: s.carrier ?? undefined,
        shippedAt: s.shippedAt?.toISOString(),
        expectedDeliveryAt: s.expectedDeliveryAt?.toISOString(),
        deliveredAt: s.deliveredAt?.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      payments: (order.payments || []).map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        status: p.status,
        paidAt: p.paidAt?.toISOString(),
      })),
    };
  }

  async findByUser(userId: string, query: OrderQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const where: Prisma.OrderWhereInput = { userId };
    if (status && status !== 'all') {
      where.status = status as OrderStatus;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: {
                  productMedia: {
                    include: {
                      media: true,
                    },
                  },
                },
              },
            },
          },
          shippingAddress: true,
          statusHistory: {
            orderBy: {
              createdAt: 'asc',
            },
          },
          shipments: true,
          payments: true,
        },
        orderBy: [{ createdAt: 'desc' }, { orderNumber: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders: this.decryptOrderAddresses(orders), total, totalPages: Math.ceil(total / limit), page };
  }

  async findByUserEmail(email: string, query: OrderQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const where: Prisma.OrderWhereInput = {
      user: {
        email,
      },
    };
    if (status && status !== 'all') {
      where.status = status as OrderStatus;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: {
                  productMedia: {
                    include: {
                      media: true,
                    },
                  },
                },
              },
            },
          },
          shippingAddress: true,
          statusHistory: {
            orderBy: {
              createdAt: 'asc',
            },
          },
          shipments: true,
          payments: true,
        },
        orderBy: [{ createdAt: 'desc' }, { orderNumber: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders: this.decryptOrderAddresses(orders), total, totalPages: Math.ceil(total / limit), page };
  }

  // ─── Admin ──────────────────────────────────────────────────────

  async findAll(query: OrderQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const where: Prisma.OrderWhereInput = {};
    if (status && status !== 'all') {
      where.status = status as OrderStatus;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: true,
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { orderNumber: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        email: o.user?.email ? this.encryptionService.decrypt(o.user.email) : null,
        createdAt: o.createdAt,
        totalAmount: Number(o.totalAmount),
        status: o.status,
        itemCount: o._count.items,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async count() {
    const total = await this.prisma.order.count();
    const pending = await this.prisma.order.count({
      where: { status: 'pending' },
    });
    const waitingForPayment = await this.prisma.order.count({
      where: { status: 'waiting_for_payment' },
    });
    const processing = await this.prisma.order.count({
      where: { status: 'processing' },
    });
    const shipped = await this.prisma.order.count({
      where: { status: 'shipped' },
    });
    const delivered = await this.prisma.order.count({
      where: { status: 'delivered' },
    });
    const cancelled = await this.prisma.order.count({
      where: { status: 'cancelled' },
    });
    const refunded = await this.prisma.order.count({
      where: { status: 'refunded' },
    });
    return { total, pending, waitingForPayment, processing, shipped, delivered, cancelled, refunded };
  }

  /**
   * Cancels orders that are still `pending` or `waiting_for_payment`, were created more than
   * {@link UNPAID_AUTO_CANCEL_DAYS} days ago, and have no `completed` payment. Invoked by cron.
   */
  async cancelStaleUnpaidOrders(): Promise<{
    cancelled: number;
    orderIds: string[];
  }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - UNPAID_AUTO_CANCEL_DAYS);

    const stale = await this.prisma.order.findMany({
      where: {
        status: { in: ['pending', 'waiting_for_payment'] },
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true },
    });

    const staleIds = stale.map((r) => r.id);
    if (!staleIds.length) {
      return { cancelled: 0, orderIds: [] };
    }

    const completedPayments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        orderId: { in: staleIds },
      },
      select: { orderId: true },
    });

    const paidOrderIds = new Set(completedPayments.map((p) => p.orderId));
    const toCancel = staleIds.filter((id) => !paidOrderIds.has(id));
    const orderIds: string[] = [];

    for (const orderId of toCancel) {
      try {
        await this.updateStatus(
          orderId,
          {
            status: 'cancelled',
            note: `Automatically cancelled: no payment received within ${UNPAID_AUTO_CANCEL_DAYS} days`,
          },
          undefined,
        );
        orderIds.push(orderId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Could not auto-cancel order ${orderId}: ${msg}`);
      }
    }

    return { cancelled: orderIds.length, orderIds };
  }

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    changedBy?: string,
  ) {
    const order = await this.getOrderEntity(orderId);
    const fromStatus = order.status;

    if (TERMINAL_STATUSES.includes(fromStatus)) {
      throw new BadRequestException(
        `Cannot change status of an order that is already ${fromStatus}`,
      );
    }

    const allowed = VALID_TRANSITIONS[fromStatus];
    if (allowed && !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from "${fromStatus}" to "${dto.status}". Allowed: ${allowed.join(', ')}`,
      );
    }

    if (dto.status === 'refunded') {
      const hasCompletedPayment = order.payments?.some(
        (p) => p.status === 'completed',
      );
      if (!hasCompletedPayment) {
        throw new BadRequestException(
          'Cannot refund an order that has no completed payment',
        );
      }
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: dto.status as OrderStatus },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus,
          toStatus: dto.status,
          changedBy: changedBy ?? null,
          note: dto.note ?? null,
        },
      });

      await this.handleInventoryOnStatusChange(
        order,
        fromStatus,
        dto.status as OrderStatus,
        tx,
      );
      await this.handlePaymentOnStatusChange(
        orderId,
        dto.status as OrderStatus,
        tx,
      );
    });

    const updatedOrder = await this.getOrderEntity(orderId);
    try {
      const template =
        updatedOrder.status === 'cancelled'
          ? 'order-cancellation'
          : 'order-status-update';
      void this.emailQueueService.enqueue(template, updatedOrder.user.email, {
        username:
          `${updatedOrder.user.firstName} ${updatedOrder.user.lastName}`.trim(),
        orderId: updatedOrder.orderNumber,
        status:
          updatedOrder.status.charAt(0).toUpperCase() +
          updatedOrder.status.slice(1),
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Order status update email failed: ${errMsg}`);
    }

    return this.mapOrderToDetailDto(updatedOrder);
  }

  async createShipment(orderId: string, dto: CreateShipmentDto) {
    const order = await this.getOrderEntity(orderId);

    if (TERMINAL_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot create shipment for an order that is ${order.status}`,
      );
    }
    if (!['processing', 'waiting_for_payment'].includes(order.status)) {
      throw new BadRequestException(
        `Order must be in "processing" state to ship, current: "${order.status}"`,
      );
    }

    const saved = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const shipment = await tx.shipment.create({
          data: {
            orderId,
            trackingNumber: dto.trackingNumber ?? null,
            carrier: dto.carrier ?? null,
            shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : null,
            expectedDeliveryAt: dto.expectedDeliveryAt
              ? new Date(dto.expectedDeliveryAt)
              : null,
            shippingFee: dto.shippingFee ?? 0,
          },
        });

        const fromStatus = order.status;
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'shipped' },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus,
            toStatus: 'shipped',
          },
        });
        return shipment;
      },
    );

    const updatedOrder = await this.getOrderEntity(orderId);
    try {
      void this.emailQueueService.enqueue(
        'order-shipped',
        updatedOrder.user.email,
        {
          username:
            `${updatedOrder.user.firstName} ${updatedOrder.user.lastName}`.trim(),
          orderId: updatedOrder.orderNumber,
          trackingNumber: dto.trackingNumber || '',
          carrier: dto.carrier || '',
        },
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`Order shipped email failed: ${errMsg}`);
    }

    return saved;
  }

  async sendPaymentRequest(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          include: {
            addresses: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const addr =
      order.shippingAddress ??
      order.user?.addresses?.find((a) => a.isDefault) ??
      order.user?.addresses?.[0] ??
      null;

    let shippingAddress = '';
    if (addr) {
      shippingAddress = [
        addr.fullName,
        addr.addressLine1,
        addr.addressLine2,
        addr.city,
        [addr.district, addr.province].filter(Boolean).join(', '),
        addr.postalCode,
        addr.country,
        addr.phone ? `Phone: ${addr.phone}` : null,
      ]
        .filter(Boolean)
        .join('<br>');
    }

    const banks = await this.banksService.findActive();
    if (!banks.length)
      throw new NotFoundException('No active bank account configured');

    const fmtCurrency = (v: number) =>
      (+v || 0).toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const itemRowsHtml = order.items
      .map(
        (item) =>
          `<tr>` +
          `<td style="padding:8px 12px;color:#374151;border-bottom:1px solid #f1f3f5;">${item.productName}</td>` +
          `<td style="padding:8px 12px;text-align:center;color:#374151;border-bottom:1px solid #f1f3f5;">${item.quantity}</td>` +
          `<td style="padding:8px 12px;text-align:right;color:#374151;border-bottom:1px solid #f1f3f5;">${fmtCurrency(Number(item.unitPrice))}</td>` +
          `<td style="padding:8px 12px;text-align:right;color:#374151;border-bottom:1px solid #f1f3f5;">${fmtCurrency(Number(item.totalPrice))}</td>` +
          `</tr>`,
      )
      .join('');

    const bankDetailsHtml = banks
      .map(
        (b) =>
          `<div style="background:#f8fafc;border:1px solid #e8ecf1;border-radius:10px;padding:16px;margin-bottom:12px;">` +
          `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">` +
          `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Bank:</td><td style="padding:4px 0;font-size:13px;text-align:right;"><strong style="color:#1a1d21;">${b.bankName}</strong></td></tr>` +
          `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Branch:</td><td style="padding:4px 0;font-size:13px;text-align:right;"><strong style="color:#1a1d21;">${b.branch}</strong></td></tr>` +
          `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Account Name:</td><td style="padding:4px 0;font-size:13px;text-align:right;"><strong style="color:#1a1d21;">${b.accountName}</strong></td></tr>` +
          `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Account Number:</td><td style="padding:4px 0;font-size:13px;text-align:right;"><strong style="color:#ea580c;">${b.accountNumber}</strong></td></tr>` +
          `</table></div>`,
      )
      .join('');

    const variables: Record<string, string> = {
      username: `${order.user.firstName} ${order.user.lastName}`.trim(),
      orderId: order.orderNumber,
      orderDate: order.createdAt.toISOString().slice(0, 10),
      itemRows: itemRowsHtml,
      subtotal: fmtCurrency(Number(order.subtotal)),
      shippingCost: fmtCurrency(Number(order.shippingFee)),
      orderTotal: fmtCurrency(Number(order.totalAmount)),
      shippingAddress: shippingAddress || 'N/A',
      bankDetails: bankDetailsHtml,
      orderTotal2: fmtCurrency(Number(order.totalAmount)),
    };

    void this.emailQueueService.enqueue(
      'payment-request',
      order.user.email,
      variables,
    );

    if (order.status === 'pending') {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'waiting_for_payment' },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: 'pending',
            toStatus: 'waiting_for_payment',
            note: 'Payment request sent',
          },
        });
      });
    }

    return {
      success: true,
      message: `Payment request sent to ${order.user.email}`,
    };
  }

  async updateOrder(orderId: string, dto: UpdateOrderDto) {
    const order = await this.getOrderEntity(orderId);

    if (TERMINAL_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot modify an order that is already ${order.status}`,
      );
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.orderItem.deleteMany({ where: { orderId } });

      const itemsData = dto.lineItems.map((li) => ({
        orderId,
        productId: li.productId || null,
        productName: li.product,
        quantity: li.qty,
        unitPrice: li.unitPrice,
        totalPrice: +(li.qty * li.unitPrice).toFixed(2),
      }));

      await tx.orderItem.createMany({
        data: itemsData,
      });

      const subtotal = itemsData.reduce((sum, i) => sum + i.totalPrice, 0);
      const shippingFee = dto.shippingFee ?? Number(order.shippingFee);
      const totalAmount = +(
        subtotal +
        shippingFee -
        Number(order.discountAmount)
      ).toFixed(2);

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal,
          shippingFee,
          totalAmount,
        },
      });

      await tx.payment.updateMany({
        where: {
          orderId,
          status: 'pending',
        },
        data: {
          amount: totalAmount,
        },
      });
    });

    return this.findById(orderId);
  }

  async deleteOrder(orderId: string) {
    const order = await this.findById(orderId);

    if (
      TERMINAL_STATUSES.includes(order.status) &&
      order.status !== 'cancelled'
    ) {
      throw new BadRequestException(
        `Cannot delete an order that is ${order.status}`,
      );
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.orderComment.deleteMany({ where: { orderId } });
      await tx.orderStatusHistory.deleteMany({ where: { orderId } });
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.shipment.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });
    });
    return { message: 'Order deleted' };
  }

  // ─── Inventory helpers ────────────────────────────────────────

  private async handleInventoryOnStatusChange(
    order: OrderEntity,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    tx: Prisma.TransactionClient,
  ) {
    const shouldDecrement =
      toStatus === 'processing' && fromStatus !== 'processing';
    const shouldRestore =
      (toStatus === 'cancelled' || toStatus === 'refunded') &&
      ['processing', 'shipped'].includes(fromStatus);

    if (!shouldDecrement && !shouldRestore) return;

    for (const item of order.items || []) {
      if (!item.productId) continue;
      const delta = shouldDecrement ? -item.quantity : item.quantity;

      await tx.product.update({
        where: { id: item.productId },
        data: {
          quantityInHand: {
            increment: delta,
          },
        },
      });

      if (shouldDecrement) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, quantityInHand: true, status: true },
        });
        if (
          product &&
          product.quantityInHand <= 0 &&
          product.status === 'active'
        ) {
          await tx.product.update({
            where: { id: item.productId },
            data: { status: 'out_of_stock' },
          });
        }
      }
    }
  }

  private async handlePaymentOnStatusChange(
    orderId: string,
    toStatus: OrderStatus,
    tx: Prisma.TransactionClient,
  ) {
    if (toStatus === 'refunded') {
      await tx.payment.updateMany({
        where: {
          orderId,
          status: 'completed',
        },
        data: {
          status: 'refunded',
        },
      });
    } else if (toStatus === 'cancelled') {
      await tx.payment.updateMany({
        where: {
          orderId,
          status: 'pending',
        },
        data: {
          status: 'failed',
        },
      });
    }
  }

  // ─── Number generators (retry on collision) ───────────────────

  private async generateOrderNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const count = await tx.order.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      });
      const candidate = `ORD-${dateStr}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await tx.order.findUnique({
        where: { orderNumber: candidate },
      });
      if (!exists) return candidate;
    }
    return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private async generatePaymentNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const count = await tx.payment.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      });
      const candidate = `PAY-${dateStr}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await tx.payment.findUnique({
        where: { paymentNumber: candidate },
      });
      if (!exists) return candidate;
    }
    return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private resolveUnitPrice(
    product: ProductWithPriceTiers,
    quantity: number,
  ): number {
    const tiers = (product.priceTiers || [])
      .filter((t) => quantity >= t.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    return +(tiers[0]?.price ?? product.purchasedPrice ?? 0);
  }

  /** Safely decrypt a field value. Returns the original value if not encrypted or decryption fails. */
  private decryptField(value: string): string {
    if (!value) return value;
    try {
      return this.encryptionService.decrypt(value);
    } catch {
      return value;
    }
  }

  /** Decrypt shipping address fields in a list of order entities. */
  private decryptOrderAddresses(orders: any[]): any[] {
    return orders.map((o) => {
      if (!o.shippingAddress) return o;
      return {
        ...o,
        shippingAddress: {
          ...o.shippingAddress,
          fullName: this.decryptField(o.shippingAddress.fullName),
          email: o.shippingAddress.email ? this.decryptField(o.shippingAddress.email) : null,
          phone: this.decryptField(o.shippingAddress.phone),
          addressLine1: this.decryptField(o.shippingAddress.addressLine1),
          addressLine2: o.shippingAddress.addressLine2 ? this.decryptField(o.shippingAddress.addressLine2) : null,
          city: o.shippingAddress.city ? this.decryptField(o.shippingAddress.city) : null,
          district: this.decryptField(o.shippingAddress.district),
          province: this.decryptField(o.shippingAddress.province),
          postalCode: this.decryptField(o.shippingAddress.postalCode),
        },
      };
    });
  }
}
