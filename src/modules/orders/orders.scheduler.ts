import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

/**
 * Cancels orders that remain unpaid (pending / waiting_for_payment) after a fixed window.
 * Runs daily; uses the same status transition as manual cancellation (inventory, emails, etc.).
 */
@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cancelStaleUnpaidOrders(): Promise<void> {
    try {
      const { cancelled, orderIds } =
        await this.ordersService.cancelStaleUnpaidOrders();
      if (cancelled > 0) {
        this.logger.log(
          `Auto-cancelled ${cancelled} unpaid order(s) (no completed payment within policy window): ${orderIds.join(', ')}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Unpaid order auto-cancellation job failed: ${message}`,
      );
    }
  }
}
