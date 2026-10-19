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
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Admin routes ───────────────────────────────────────────────

  @Get('admin/all')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get all users (admin)' })
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Get('admin/search')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Search users (admin)' })
  search(@Query('q') query: string, @Query() pagination: PaginationDto) {
    return this.usersService.search(query || '', pagination);
  }

  @Put('admin/update-status/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update user status (admin)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(id, dto);
  }

  @Get('count')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get user count by status' })
  count() {
    return this.usersService.count();
  }

  // ─── Profile routes ─────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: 'Get own profile' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update own profile' })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Put('profile/password')
  @ApiOperation({ summary: 'Update own password' })
  updatePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user.id, dto);
  }

  // ─── Address routes ─────────────────────────────────────────────

  @Get('address')
  @ApiOperation({ summary: 'Get user addresses' })
  getAddresses(@CurrentUser() user: JwtPayload) {
    return this.usersService.getAddresses(user.id);
  }

  @Post('address')
  @ApiOperation({ summary: 'Add new address' })
  createAddress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(user.id, dto);
  }

  @Put('address/:id')
  @ApiOperation({ summary: 'Update address' })
  updateAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(user.id, id, dto);
  }

  @Delete('address/:id')
  @ApiOperation({ summary: 'Delete address (soft)' })
  deleteAddress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.deleteAddress(user.id, id);
  }
}
