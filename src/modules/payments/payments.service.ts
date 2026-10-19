import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentDetailResponseDto } from './dto/payment-detail-response.dto';
import {
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';

/** Payment records for orders; findById returns PaymentDetailResponseDto with order/user summary for auth and display. */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreatePaymentDto) {
    const paymentNumber = await this.generatePaymentNumber();
    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod as PaymentMethod,
        paymentNumber,
        referenceNumber: dto.referenceNumber ?? null,
        receiptUrl: dto.receiptUrl ?? null,
        status: 'pending',
      },
    });
    return {
      ...payment,
      amount: Number(payment.amount),
      referenceNumber: payment.referenceNumber ?? undefined,
      receiptUrl: payment.receiptUrl ?? undefined,
      paidAt: payment.paidAt ?? undefined,
    };
  }

  // OPT: Response DTO; map to PaymentDetailResponseDto to avoid exposing full order/user entities (see payment-detail-response.dto.ts).
  async findById(paymentId: string): Promise<PaymentDetailResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paymentNumber: payment.paymentNumber,
      referenceNumber: payment.referenceNumber ?? undefined,
      paidAt: payment.paidAt ?? undefined,
      createdAt: payment.createdAt,
      orderNumber: payment.order?.orderNumber,
      orderTotal:
        payment.order?.totalAmount != null
          ? Number(payment.order.totalAmount)
          : undefined,
      userEmail: payment.order?.user?.email ? this.encryptionService.decrypt(payment.order.user.email) : undefined,
      firstName: payment.order?.user?.firstName,
      lastName: payment.order?.user?.lastName,
      userId: payment.order?.userId,
    };
  }

  async findByUser(userId: string, query: PaymentQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const where: Prisma.PaymentWhereInput = {
      order: {
        userId,
      },
    };

    if (status && status !== 'all') {
      where.status = status as PaymentStatus;
    }

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          order: true,
        },
        orderBy: {
          id: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const mappedPayments = payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      referenceNumber: p.referenceNumber ?? undefined,
      receiptUrl: p.receiptUrl ?? undefined,
      paidAt: p.paidAt ?? undefined,
      order: p.order
        ? {
            ...p.order,
            subtotal: Number(p.order.subtotal),
            shippingFee: Number(p.order.shippingFee),
            discountAmount: Number(p.order.discountAmount),
            totalAmount: Number(p.order.totalAmount),
          }
        : undefined,
    }));

    return {
      payments: mappedPayments,
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async deletePayment(paymentId: string) {
    await this.findById(paymentId);
    await this.prisma.payment.delete({ where: { id: paymentId } });
    return { message: 'Payment deleted' };
  }

  // ─── Admin ──────────────────────────────────────────────────────

  async findAll(query: PaymentQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const where: Prisma.PaymentWhereInput = {};
    if (status && status !== 'all') {
      where.status = status as PaymentStatus;
    }

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          order: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const mapped = payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      amount: Number(p.amount),
      status: p.status,
      paymentMethod: p.paymentMethod,
      paymentNumber: p.paymentNumber,
      referenceNumber: p.referenceNumber ?? undefined,
      paidAt: p.paidAt ?? undefined,
      createdAt: p.createdAt,
      orderNumber: p.order?.orderNumber || '',
      orderTotal: p.order?.totalAmount ? Number(p.order.totalAmount) : 0,
      userEmail: p.order?.user?.email ? this.encryptionService.decrypt(p.order.user.email) : '',
      firstName: p.order?.user?.firstName || '',
      lastName: p.order?.user?.lastName || '',
    }));

    return {
      payments: mapped,
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async count() {
    const [total, pending, completed, failed, refunded] =
      await this.prisma.$transaction([
        this.prisma.payment.count(),
        this.prisma.payment.count({ where: { status: 'pending' } }),
        this.prisma.payment.count({ where: { status: 'completed' } }),
        this.prisma.payment.count({ where: { status: 'failed' } }),
        this.prisma.payment.count({ where: { status: 'refunded' } }),
      ]);
    return { total, pending, completed, failed, refunded };
  }

  async countByType() {
    const results = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      _count: {
        _all: true,
      },
    });
    return results.map((r) => ({
      paymentMethod: r.paymentMethod,
      count: r._count._all,
    }));
  }

  async updateStatus(orderId: string, dto: UpdatePaymentStatusDto) {
    const payment = await this.prisma.payment.findFirst({ where: { orderId } });
    if (!payment)
      throw new NotFoundException('Payment not found for this order');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const terminalOrderStatuses = ['cancelled', 'refunded', 'delivered'];
    if (terminalOrderStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot update payment for an order that is already ${order.status}`,
      );
    }

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.PaymentUpdateInput = {
        status: dto.status as PaymentStatus,
      };
      if (dto.status === 'completed') {
        updateData.paidAt = new Date();
      }
      if (dto.referenceNumber) {
        updateData.referenceNumber = dto.referenceNumber;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: updateData,
      });

      let newOrderStatus: string | null = null;
      if (dto.status === 'completed' && order.status !== 'processing') {
        newOrderStatus = 'processing';
      } else if (dto.status === 'failed') {
        newOrderStatus = 'cancelled';
      }

      if (newOrderStatus) {
        const fromStatus = order.status;
        await tx.order.update({
          where: { id: orderId },
          data: { status: newOrderStatus as OrderStatus },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus,
            toStatus: newOrderStatus,
            note: `Auto-updated: payment marked as ${dto.status}`,
          },
        });
      }

      return tx.payment.findUnique({ where: { id: payment.id } });
    });

    if (!updatedPayment)
      throw new NotFoundException('Payment not found after update');

    return {
      ...updatedPayment,
      amount: Number(updatedPayment.amount),
      referenceNumber: updatedPayment.referenceNumber ?? undefined,
      receiptUrl: updatedPayment.receiptUrl ?? undefined,
      paidAt: updatedPayment.paidAt ?? undefined,
    };
  }

  private async generatePaymentNumber(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const count = await this.prisma.payment.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    });
    return `PAY-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
}
