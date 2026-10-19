import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersScheduler } from './orders.scheduler';
import { OrdersController } from './orders.controller';
import { EmailModule } from '../email/email.module';
import { BanksModule } from '../banks/banks.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

@Module({
  imports: [EmailModule, BanksModule, PromoCodesModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
