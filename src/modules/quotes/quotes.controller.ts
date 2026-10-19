import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Submit a quote request' })
  create(@Body() dto: CreateQuoteDto) {
    return this.quotesService.create(dto);
  }

  @Get('user/:email')
  @ApiOperation({
    summary: 'Get quotes by user email (authenticated, ownership-checked)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findByUserEmail(
    @Param('email') email: string,
    @Query() query: { page?: number; limit?: number },
    @CurrentUser() user: { email: string; role: string; type: string },
  ) {
    if (user.type !== 'admin' && user.email !== email) {
      throw new ForbiddenException('You can only view your own quotes');
    }
    return this.quotesService.findByUserEmail(email, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quote by ID (authenticated, ownership-checked)' })
  findById(
    @Param('id') id: string,
    @CurrentUser() user: { email: string; role: string; type: string },
  ) {
    if (id.startsWith('QT-')) {
      return this.quotesService.findByQuoteNumber(id, user);
    }
    return this.quotesService.findById(id, user);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get()
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all quotes (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.quotesService.findAll(pagination);
  }

  @Put(':id/status')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update quote status (admin)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteStatusDto,
  ) {
    return this.quotesService.updateStatus(id, dto);
  }
}
