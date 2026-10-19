import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { BulkUpsertSettingsDto } from './dto/bulk-upsert.dto';

const PUBLIC_GROUPS = ['bank-details'];

@ApiTags('Settings')
@Controller('settings')
@Roles('admin', 'super admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings (admin)' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Get('map')
  @ApiOperation({ summary: 'Get all settings as key-value map (admin)' })
  getSettingsMap() {
    return this.settingsService.getSettingsMap();
  }

  @Get('groups')
  @ApiOperation({ summary: 'Get setting groups' })
  getGroups() {
    return this.settingsService.getGroups();
  }

  @Get('pricing')
  @Public()
  @ApiOperation({
    summary: 'Get public pricing settings (shipping fee, tax) for storefronts',
  })
  getPricingSettings() {
    return this.settingsService.getPricingSettings();
  }

  @Get('group/:group')
  @Public()
  @ApiOperation({
    summary:
      'Get settings by group (bank-details is public, rest require admin)',
  })
  findByGroup(
    @Param('group') group: string,
    @Req() req: { user?: { role?: string } },
  ) {
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'super admin';

    if (!PUBLIC_GROUPS.includes(group) && !isAdmin) {
      throw new ForbiddenException('This settings group requires admin access');
    }

    return this.settingsService.findByGroup(group);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get single setting by key (admin)' })
  getByKey(@Param('key') key: string) {
    return this.settingsService.getByKey(key);
  }

  @Put()
  @ApiOperation({ summary: 'Upsert a setting' })
  upsert(@Body() dto: UpsertSettingDto) {
    return this.settingsService.upsert(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk upsert settings' })
  bulkUpsert(@Body() dto: BulkUpsertSettingsDto) {
    return this.settingsService.bulkUpsert(dto.settings);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a setting' })
  remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}
