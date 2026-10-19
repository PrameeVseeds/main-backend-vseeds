import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Generate an invoice from an order' })
  generateFromOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.invoicesService.generateFromOrder(orderId);
  }

  @Post('generate-all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Generate invoices for all orders without one' })
  generateAll() {
    return this.invoicesService.generateAll();
  }

  @Get()
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all invoices with filters' })
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get('order/:orderId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get invoice by order ID' })
  findByOrderId(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.invoicesService.findByOrderId(orderId);
  }

  @Get(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findById(id);
  }

  @Put(':id/send')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Mark invoice as sent' })
  sendInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.sendInvoice(id);
  }
}
