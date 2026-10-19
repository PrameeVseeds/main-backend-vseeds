import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WishlistsService } from './wishlists.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AddWishlistDto } from './dto/add-wishlist.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Wishlists')
@Controller('wishlist')
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add product to wishlist' })
  add(@CurrentUser() user: JwtPayload, @Body() dto: AddWishlistDto) {
    return this.wishlistsService.add(user.id, dto.productId);
  }

  @Delete('delete')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  @ApiQuery({ name: 'productId', required: true })
  remove(
    @CurrentUser() user: JwtPayload,
    @Query('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.wishlistsService.remove(user.id, productId);
  }

  @Get('user/:email')
  @ApiOperation({
    summary: 'Get wishlist by user email (optional pagination: page, limit)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getByUserEmail(
    @Param('email') email: string,
    @Query() query: { page?: number; limit?: number },
  ) {
    return this.wishlistsService.getByUserEmail(email, query);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get wishlist count for a product' })
  @ApiQuery({ name: 'product_id', required: true })
  countForProduct(@Query('product_id', ParseUUIDPipe) productId: string) {
    return this.wishlistsService.countForProduct(productId);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all wishlists aggregated by product (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.wishlistsService.findAll(pagination);
  }

  @Get('users/:productId')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get users who wishlisted a product (admin)' })
  getUsersForProduct(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.wishlistsService.getUsersForProduct(productId);
  }
}
