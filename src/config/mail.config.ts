import { ConfigService } from '@nestjs/config';

export const getMailConfig = (configService: ConfigService) => ({
  host: configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
  port: configService.get<number>('MAIL_PORT', 587),
  username: configService.get<string>('MAIL_USERNAME'),
  password: configService.get<string>('MAIL_PASSWORD'),
  fromAddress: configService.get<string>('MAIL_FROM_ADDRESS'),
  bccSystem: configService.get<string>('MAIL_BCC_SYSTEM'),
  bccSales: configService.get<string>('MAIL_BCC_SALES'),
  bccAll: configService.get<string>('MAIL_BCC_ALL'),
});
