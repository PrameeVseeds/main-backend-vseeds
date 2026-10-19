import { ConfigService } from '@nestjs/config';

export const getStorageConfig = (configService: ConfigService) => ({
  uploadDir: configService.get<string>('UPLOAD_DIR', './storage/uploads'),
  maxFileSize: configService.get<number>('MAX_FILE_SIZE', 2 * 1024 * 1024),
});
