import { ConfigService } from '@nestjs/config';

export const getAppConfig = (configService: ConfigService) => ({
  port: configService.get<number>('PORT', 3000),
  nodeEnv: configService.get<string>('NODE_ENV', 'development'),
  apiPrefix: configService.get<string>('API_PREFIX', 'api'),
  adminOrigin: configService.get<string>(
    'ADMIN_ORIGIN',
    'http://localhost:4200',
  ),
  electronicsOrigin: configService.get<string>(
    'ELECTRONICS_ORIGIN',
    'http://localhost:4201',
  ),
  embeddedOrigin: configService.get<string>(
    'EMBEDDED_ORIGIN',
    'http://localhost:4202',
  ),
  throttleTtl: configService.get<number>('THROTTLE_TTL', 60000),
  throttleLimit: configService.get<number>('THROTTLE_LIMIT', 100),
  twoFactorAppName: configService.get<string>('TWO_FACTOR_APP_NAME', 'VSEEDS'),
});
