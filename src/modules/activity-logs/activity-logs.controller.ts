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
import { ActivityLogsService } from './activity-logs.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

@ApiTags('Activity Logs')
@Controller('activity-logs')
@Roles('admin', 'super admin')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get activity logs (login, create, update, delete only)',
  })
  findAll(@Query() query: ActivityLogQueryDto) {
    return this.activityLogsService.findAll(query);
  }

  @Get('detail/:id')
  @ApiOperation({ summary: 'Get single activity log with full details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activityLogsService.findOne(id);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent activity logs' })
  findRecent(@Query('days') days?: number, @Query('limit') limit?: number) {
    return this.activityLogsService.findRecentRaw(days || 7, limit || 20);
  }

  @Get('notifications')
  @ApiOperation({
    summary:
      'Get notifications: recent orders (electronics-vseeds) and quotes (embedded-vseeds)',
  })
  getNotifications(
    @Query('days') days?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityLogsService.getNotifications(days || 7, limit || 30);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get activity log statistics' })
  getStatistics(@Query('days') days?: number) {
    return this.activityLogsService.getStatistics(days || 30);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get activity logs by user (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: { page?: number; limit?: number },
  ) {
    return this.activityLogsService.findByUser(userId, query);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get activity logs by entity (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Query() query: { page?: number; limit?: number },
  ) {
    return this.activityLogsService.findByEntity(entityType, entityId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create activity log entry' })
  create(@Body() dto: CreateActivityLogDto) {
    return this.activityLogsService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single activity log entry' })
  deleteOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activityLogsService.deleteOne(id);
  }

  @Delete('clean/old')
  @ApiOperation({ summary: 'Clean old activity logs' })
  clean(@Query('days') days?: number) {
    return this.activityLogsService.cleanOldLogs(days || 90);
  }
}
