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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Reviews')
@Controller('review')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ─── Public routes ──────────────────────────────────────────────

  @Public()
  @Get('rating')
  @ApiOperation({ summary: 'Get average rating for a product' })
  @ApiQuery({ name: 'product_id', required: true })
  getAverageRating(@Query('product_id', ParseUUIDPipe) productId: string) {
    return this.reviewsService.getAverageRating(productId);
  }

  @Public()
  @Get('all')
  @ApiOperation({ summary: 'Get reviews for a product' })
  @ApiQuery({ name: 'product_id', required: true })
  findByProduct(
    @Query('product_id', ParseUUIDPipe) productId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.findByProduct(productId, pagination);
  }

  @Public()
  @Get('product/:id')
  @ApiOperation({ summary: 'Get reviews by product ID' })
  findByProductId(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.findByProduct(id, pagination);
  }

  // ─── User routes ────────────────────────────────────────────────

  @Get('eligibility')
  @ApiOperation({
    summary: 'Check if current user is eligible to submit a review',
  })
  @ApiQuery({ name: 'product_id', required: false })
  checkEligibility(
    @CurrentUser() user: JwtPayload,
    @Query('product_id') productId?: string,
  ) {
    return this.reviewsService.checkEligibility(user.id, productId);
  }

  @Post('add')
  @ApiOperation({
    summary: 'Add a review (requires completed order or approved quote)',
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.id, dto);
  }

  @Get('user/:email')
  @ApiOperation({ summary: 'Get reviews by user email' })
  findByUserEmail(@Param('email') email: string) {
    return this.reviewsService.findByUserEmail(email);
  }

  @Put('update')
  @ApiOperation({ summary: 'Update own review' })
  @ApiQuery({ name: 'product_id', required: true })
  update(
    @CurrentUser() user: JwtPayload,
    @Query('product_id', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(user.id, productId, dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get review by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.findById(id);
  }

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('admin/all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all reviews (admin)' })
  findAllAdmin(@Query() pagination: PaginationDto) {
    return this.reviewsService.findAllAdmin(pagination);
  }

  @Put('admin-reply/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Add admin reply to review' })
  adminReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReplyDto,
  ) {
    return this.reviewsService.adminReply(id, dto.adminReply);
  }

  @Delete('delete/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete review' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.delete(id);
  }
}
