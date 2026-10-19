import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromoCodesService } from './promo-codes.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Promo Codes')
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate a promo code (authenticated user)' })
  validate(@CurrentUser() user: JwtPayload, @Body() dto: ValidatePromoCodeDto) {
    return this.promoCodesService.validate(dto, user.id);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Post('add')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Create promo code (admin)' })
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promoCodesService.create(dto);
  }

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all promo codes (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.promoCodesService.findAll(pagination);
  }

  @Get('count')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get promo code stats (admin)' })
  count() {
    return this.promoCodesService.count();
  }

  @Get(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get promo code by ID (admin)' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.promoCodesService.findById(id);
  }

  @Put(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update promo code (admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.promoCodesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete promo code (admin)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.promoCodesService.delete(id);
  }
}
