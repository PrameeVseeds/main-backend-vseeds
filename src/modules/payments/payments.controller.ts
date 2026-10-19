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
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('add')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Add payment (admin)' })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Delete('delete/:paymentId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete payment (admin)' })
  delete(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.paymentsService.deletePayment(paymentId);
  }

  @Get('user')
  @ApiOperation({ summary: 'Get payments by current user' })
  findByUser(@CurrentUser() user: JwtPayload, @Query() query: PaymentQueryDto) {
    return this.paymentsService.findByUser(user.id, query);
  }

  @Get('payment-by-id/:paymentId')
  @ApiOperation({ summary: 'Get payment by ID (own or admin)' })
  async findById(
    @CurrentUser() user: JwtPayload,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    const payment = await this.paymentsService.findById(paymentId);
    if (user.type !== 'admin' && payment.userId !== user.id) {
      throw new ForbiddenException('You can only access your own payments');
    }
    return payment;
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all payments (admin)' })
  findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query);
  }

  @Get('count')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get payment count by status' })
  count() {
    return this.paymentsService.count();
  }

  @Get('payment_type')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get payment count by type' })
  countByType() {
    return this.paymentsService.countByType();
  }

  @Put('update/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update payment status by order ID' })
  updateStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.updateStatus(orderId, dto);
  }
}
