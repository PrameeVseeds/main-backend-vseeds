import { Module } from '@nestjs/common';
import { InvoiceTemplatesService } from './invoice-templates.service';
import { InvoiceTemplatesController } from './invoice-templates.controller';

@Module({
  providers: [InvoiceTemplatesService],
  controllers: [InvoiceTemplatesController],
})
export class InvoiceTemplatesModule {}
