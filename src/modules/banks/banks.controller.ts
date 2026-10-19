import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BanksService } from './banks.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Banks')
@Controller('banks')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Post()
  @Roles('admin', 'super admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new bank account (Admin only)' })
  create(@Body() createBankDto: CreateBankDto) {
    return this.banksService.create(createBankDto);
  }

  @Get()
  @Roles('admin', 'super admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all bank accounts (Admin only)' })
  findAll() {
    return this.banksService.findAll();
  }

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get all active bank accounts (Public)' })
  findActive() {
    return this.banksService.findActive();
  }

  @Get(':id')
  @Roles('admin', 'super admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a specific bank account by ID (Admin only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.banksService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'super admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a bank account (Admin only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBankDto: UpdateBankDto,
  ) {
    return this.banksService.update(id, updateBankDto);
  }

  @Delete(':id')
  @Roles('admin', 'super admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a bank account (Admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.banksService.remove(id);
  }
}
