import { ConfigService } from '@nestjs/config';

export const getJwtConfig = (configService: ConfigService) => ({
  accessTokenSecret: configService.get<string>('ACCESS_TOKEN_SECRET'),
  accessTokenExpiry: configService.get<string>('ACCESS_TOKEN_EXPIRY', '15m'),
  refreshTokenSecret: configService.get<string>('REFRESH_TOKEN_SECRET'),
  refreshTokenExpiry: configService.get<string>('REFRESH_TOKEN_EXPIRY', '7d'),
});
