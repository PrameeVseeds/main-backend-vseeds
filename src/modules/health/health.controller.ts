import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { SettingsService } from '../settings/settings.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  @Public()
  @Get('live')
  @ApiOperation({
    summary: 'Liveness: process is running (e.g. K8s liveness probe)',
  })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness: DB connected (e.g. K8s readiness probe)',
  })
  async ready() {
    let dbStatus = 'disconnected';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbStatus = 'disconnected';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    const maintenanceMode = await this.settingsService.getTyped(
      'maintenanceMode',
      false,
    );
    const maintenanceMessage =
      await this.settingsService.get('maintenanceMessage');

    return {
      status: 'ok',
      database: dbStatus,
      maintenanceMode,
      maintenanceMessage: maintenanceMessage || '',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
