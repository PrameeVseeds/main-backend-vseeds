import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { RequestUnlockDto } from './dto/request-unlock.dto';
import { UnlockTokenDto } from './dto/unlock-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from './strategies/jwt.strategy';

/** Stricter rate limit (10/min) on auth routes to reduce brute-force risk. */
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('user-login')
  @ApiOperation({ summary: 'Customer login' })
  userLogin(@Body() dto: LoginDto) {
    return this.authService.userLogin(dto);
  }

  @Public()
  @Post('user-signup')
  @ApiOperation({ summary: 'Customer registration' })
  userSignup(@Body() dto: RegisterDto) {
    return this.authService.userSignup(dto);
  }

  @Public()
  @Post('admin-login')
  @ApiOperation({ summary: 'Admin login' })
  adminLogin(@Body() dto: LoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Public()
  @Post('admin-login/2fa')
  @ApiOperation({ summary: 'Verify 2FA code to complete admin login' })
  verifyLoginOtp(@Body() body: { tempToken: string; code: string }) {
    return this.authService.verifyLoginOtp(body.tempToken, body.code);
  }

  @Public()
  @Post('admin-unlock/request')
  @ApiOperation({ summary: 'Request unlock link for locked admin account' })
  requestAdminUnlock(@Body() dto: RequestUnlockDto) {
    return this.authService.requestAdminUnlock(dto.email);
  }

  @Public()
  @Post('admin-unlock/verify')
  @ApiOperation({ summary: 'Unlock admin account using email token' })
  unlockAdmin(@Body() dto: UnlockTokenDto) {
    return this.authService.unlockAdminByToken(dto.token);
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token' })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user/admin profile' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user);
  }

  @Put('update-profile')
  @ApiOperation({ summary: 'Update own admin profile' })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateAdminProfile(user, dto);
  }

  @Post('2fa/setup')
  @ApiOperation({ summary: 'Generate 2FA secret and QR code' })
  setup2fa(@CurrentUser() user: JwtPayload) {
    return this.authService.setup2fa(user);
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify OTP and enable 2FA' })
  verify2fa(@CurrentUser() user: JwtPayload, @Body() dto: Verify2faDto) {
    return this.authService.verify2fa(user, dto.token);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA with OTP verification' })
  disable2fa(@CurrentUser() user: JwtPayload, @Body() dto: Verify2faDto) {
    return this.authService.disable2fa(user, dto.token);
  }
}
