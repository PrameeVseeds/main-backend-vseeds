import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: T;

  @ApiProperty()
  timestamp: string;
}

export class ApiErrorResponseDto {
  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ type: [String] })
  errors?: string[];

  @ApiProperty()
  timestamp: string;
}
