import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DeliveriesService } from './deliveries.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Deliveries')
@Controller('delivery')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get('tracking')
  @ApiOperation({ summary: 'Get delivery by tracking number' })
  @ApiQuery({ name: 'number', required: true })
  findByTracking(@Query('number') trackingNumber: string) {
    return this.deliveriesService.findByTracking(trackingNumber);
  }

  @Get('order_id/:orderId')
  @ApiOperation({ summary: 'Get delivery by order ID' })
  findByOrderId(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deliveriesService.findByOrderId(orderId, user.id);
  }

  @Get('address/:orderId')
  @ApiOperation({ summary: 'Get delivery address for order' })
  getDeliveryAddress(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.deliveriesService.getDeliveryAddress(orderId);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all deliveries (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.deliveriesService.findAll(pagination);
  }

  @Get('orders')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get orders ready for shipping (admin)' })
  getOrdersReadyForShipping(@Query() pagination: PaginationDto) {
    return this.deliveriesService.getOrdersReadyForShipping(pagination);
  }
}
