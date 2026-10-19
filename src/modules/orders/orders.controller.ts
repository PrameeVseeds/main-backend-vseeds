import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { OrderQueryDto } from './dto/order-query.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('add')
  @ApiOperation({ summary: 'Create a new order' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get orders for current user' })
  findMyOrders(@CurrentUser() user: JwtPayload, @Query() query: OrderQueryDto) {
    return this.ordersService.findByUser(user.id, query);
  }

  @Get('user/:email')
  @ApiOperation({ summary: 'Get orders by user email (own or admin)' })
  findByUserEmail(
    @CurrentUser() user: JwtPayload,
    @Param('email') email: string,
    @Query() query: OrderQueryDto,
  ) {
    const normalizedUserEmail = user.email?.toLowerCase().trim();
    const normalizedParamEmail = email?.toLowerCase().trim();
    const isAdmin = user.type === 'admin' || user.role === 'admin' || user.role === 'super admin';
    if (!isAdmin && normalizedUserEmail !== normalizedParamEmail) {
      throw new ForbiddenException('You can only access your own orders');
    }
    return this.ordersService.findByUserEmail(email, query);
  }

  @Get('order_id/:orderId')
  @ApiOperation({ summary: 'Get order by ID (own or admin)' })
  async findUserOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const order = await this.ordersService.findById(orderId);
    if (user.type !== 'admin' && order.userId !== user.id) {
      throw new ForbiddenException('You can only access your own orders');
    }
    return order;
  }

  @Get('order-by-id/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get order by ID (admin)' })
  findOne(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.findById(orderId);
  }

  @Delete('delete/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete order (admin)' })
  delete(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.deleteOrder(orderId);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all orders (admin)' })
  findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('get')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get orders with filters (admin)' })
  findFiltered(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('count')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get order count by status' })
  count() {
    return this.ordersService.count();
  }

  @Put('status/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(orderId, dto);
  }

  @Post('shipping/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Create shipment for order' })
  createShipment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.ordersService.createShipment(orderId, dto);
  }

  @Put('update/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update order items and shipping fee' })
  updateOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(orderId, dto);
  }

  @Post('send-payment-request/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Send payment request email to customer' })
  sendPaymentRequest(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.sendPaymentRequest(orderId);
  }
}
