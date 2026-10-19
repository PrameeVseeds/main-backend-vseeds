import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'customer',
    required: false,
    enum: ['customer', 'admin', 'embedded'],
  })
  @IsOptional()
  @IsIn(['customer', 'admin', 'embedded'])
  portal?: 'customer' | 'admin' | 'embedded';
}
