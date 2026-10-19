import { Global, Module } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLoggingInterceptor } from './activity-logging.interceptor';

@Global()
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService, ActivityLoggingInterceptor],
  exports: [ActivityLogsService, ActivityLoggingInterceptor],
})
export class ActivityLogsModule {}
