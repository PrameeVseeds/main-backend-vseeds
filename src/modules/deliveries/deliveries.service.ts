import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ShipmentResponseDto } from './dto/shipment-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class DeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTracking(trackingNumber: string): Promise<ShipmentResponseDto> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber },
      include: { order: true },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      orderNumber: shipment.order?.orderNumber,
      trackingNumber: shipment.trackingNumber ?? undefined,
      carrier: shipment.carrier ?? undefined,
      shippedAt: shipment.shippedAt?.toISOString(),
      expectedDeliveryAt: shipment.expectedDeliveryAt?.toISOString(),
      deliveredAt: shipment.deliveredAt?.toISOString(),
      shippingFee: Number(shipment.shippingFee),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }

  async findByOrderId(orderId: string, userId?: string) {
    const where: Prisma.ShipmentWhereInput = { orderId };
    if (userId) {
      where.order = { userId };
    }

    const shipment = await this.prisma.shipment.findFirst({
      where,
      include: { order: true },
    });
    if (!shipment)
      throw new NotFoundException('Shipment not found for this order');
    return shipment;
  }

  async getDeliveryAddress(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        shippingAddress: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const addr = order.shippingAddress;
    if (!addr) throw new NotFoundException('Delivery address not found');

    return {
      address_line1: addr.addressLine1,
      address_line2: addr.addressLine2,
      city: addr.city,
      district: addr.district,
      province: addr.province,
      postal_code: addr.postalCode,
      country: addr.country,
      phone: addr.phone,
      email: order.user?.email,
      firstName: order.user?.firstName,
      lastName: order.user?.lastName,
    };
  }

  // ─── Admin ──────────────────────────────────────────────────────

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        include: {
          order: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          shippedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shipment.count(),
    ]);

    return {
      shipments: shipments.map((s) => ({
        id: s.id,
        orderId: s.orderId,
        orderNumber: s.order?.orderNumber,
        trackingNumber: s.trackingNumber,
        carrier: s.carrier,
        shippedAt: s.shippedAt,
        expectedDeliveryAt: s.expectedDeliveryAt,
        deliveredAt: s.deliveredAt,
        shippingFee: s.shippingFee,
        orderStatus: s.order?.status,
        userEmail: s.order?.user?.email,
        firstName: s.order?.user?.firstName,
        lastName: s.order?.user?.lastName,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }

  async getOrdersReadyForShipping(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: 'processing',
          payments: {
            some: {
              status: 'completed',
            },
          },
          deletedAt: null,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({
        where: {
          status: 'processing',
          payments: {
            some: {
              status: 'completed',
            },
          },
          deletedAt: null,
        },
      }),
    ]);

    return {
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        status: o.status,
        userEmail: o.user?.email,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    };
  }
}
