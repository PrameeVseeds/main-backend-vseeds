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
import { AdminsService } from './admins.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { UpdateAdminStatusDto } from './dto/update-admin-status.dto';
import { UpdateAdminPasswordDto } from './dto/update-admin-password.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Admins')
@Controller('admins')
@Roles('admin', 'super admin')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post('add')
  @ApiOperation({ summary: 'Create new admin' })
  create(@Body() dto: CreateAdminDto) {
    return this.adminsService.create(dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all admins' })
  @ApiQuery({ name: 'type', required: false })
  findAll(@Query() pagination: PaginationDto, @Query('type') type?: string) {
    return this.adminsService.findAll(pagination, type);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get admin count' })
  count() {
    return this.adminsService.count();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search admins' })
  search(@Query('q') query: string, @Query() pagination: PaginationDto) {
    return this.adminsService.search(query || '', pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminsService.findById(id);
  }

  @Put('update/:id')
  @ApiOperation({ summary: 'Update admin' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminDto) {
    return this.adminsService.update(id, dto);
  }

  @Put('update-status/:id')
  @ApiOperation({ summary: 'Update admin status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminStatusDto,
  ) {
    return this.adminsService.updateStatus(id, dto);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Delete admin' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminsService.delete(id);
  }

  @Put('password/update')
  @ApiOperation({ summary: 'Update own password' })
  updateOwnPassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAdminPasswordDto,
  ) {
    return this.adminsService.updateOwnPassword(user.id, dto);
  }

  @Put('unlock/:id')
  @Roles('super admin')
  @ApiOperation({ summary: 'Unlock a locked admin account (Super Admin only)' })
  unlockAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminsService.unlockAdmin(id);
  }
}
