import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsNumber()
  @IsOptional()
  DB_PORT: number = 3306;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsOptional()
  DB_PASSWORD: string = '';

  @IsString()
  @IsNotEmpty()
  DATABASE: string;

  @IsString()
  @IsNotEmpty()
  ACCESS_TOKEN_SECRET: string;

  @IsString()
  @IsNotEmpty()
  REFRESH_TOKEN_SECRET: string;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsString()
  @IsOptional()
  MAIL_HOST: string;

  @IsNumber()
  @IsOptional()
  MAIL_PORT: number = 587;

  @IsString()
  @IsOptional()
  MAIL_USERNAME: string;

  @IsString()
  @IsOptional()
  MAIL_PASSWORD: string;

  @IsString()
  @IsOptional()
  MAIL_FROM_ADDRESS: string;

  @IsString()
  @IsOptional()
  MAIL_SECURE: string;

  @IsString()
  @IsOptional()
  ADMIN_ORIGIN: string = 'http://localhost:4203';

  @IsString()
  @IsOptional()
  ELECTRONICS_ORIGIN: string = 'http://localhost:4201';

  @IsString()
  @IsOptional()
  EMBEDDED_ORIGIN: string = 'http://localhost:4202';

  @IsString()
  @IsOptional()
  UPLOAD_DIR: string = './storage/uploads';

  @IsString()
  @IsOptional()
  CDN_URL: string = 'https://cdn.vseeds.lk';

  @IsString()
  @IsOptional()
  DISABLE_ACTIVITY_LOGGING: string = 'false';

  @IsString()
  @IsOptional()
  ENCRYPTION_KEY: string;

  @IsString()
  @IsOptional()
  ENCRYPTION_KEY_ID: string = 'v1';
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}
