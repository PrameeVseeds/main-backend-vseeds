import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { generateSecret, verifySync, generateURI } from 'otplib';
import * as QRCode from 'qrcode';
import { EmailQueueService } from '../email/email-queue.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { Prisma, User, Admin } from '@prisma/client';
import { createLookupHash } from '../../common/utils/lookup-hash.util';

type AdminWithRole = Prisma.AdminGetPayload<{
  include: { role: true };
}>;

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Handles user and admin authentication: login, signup, refresh token,
 * forgot/reset password, and 2FA. Sends emails for welcome and password reset.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailQueueService: EmailQueueService,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ─── User (Customer) Login ──────────────────────────────────────

  /** Validates credentials and returns JWT tokens; updates refresh token and lastLoginAt. */
  async userLogin(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { emailLookup: createLookupHash(dto.email, 'email') },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is disabled');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const plainEmail = this.decryptField(user.email);
    const plainFirstName = this.decryptField(user.firstName);
    const plainLastName = this.decryptField(user.lastName);

    const tokens = this.generateTokens({
      id: user.id,
      email: plainEmail,
      role: 'user',
      type: 'user',
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: tokens.refreshToken,
        lastLoginAt: new Date(),
      },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: plainEmail,
        firstName: plainFirstName,
        lastName: plainLastName,
        role: 'user',
      },
    };
  }

  // ─── User (Customer) Registration ──────────────────────────────

  async userSignup(dto: RegisterDto) {
    const emailLookup = createLookupHash(dto.email, 'email');

    const existing = await this.prisma.user.findUnique({
      where: { emailLookup },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const deletedUser = await this.prisma.user.findFirst({
      where: {
        emailLookup,
        deletedAt: { not: null },
      },
    });

    let savedUser: User;

    if (deletedUser) {
      savedUser = await this.prisma.user.update({
        where: { id: deletedUser.id },
        data: {
          deletedAt: null,
          status: 'active',
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          passwordHash: hashedPassword,
        },
      });
    } else {
      try {
        savedUser = await this.prisma.user.create({
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            emailLookup,
            passwordHash: hashedPassword,
            phone: dto.phone,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('email_lookup')) {
          throw new BadRequestException('Email already registered');
        }
        throw err;
      }
    }

    const tokens = this.generateTokens({
      id: savedUser.id,
      email: savedUser.email,
      role: 'user',
      type: 'user',
    });

    await this.prisma.user.update({
      where: { id: savedUser.id },
      data: {
        refreshToken: tokens.refreshToken,
      },
    });

    try {
      void this.emailQueueService.enqueue('welcome-email', savedUser.email, {
        username: `${savedUser.firstName} ${savedUser.lastName}`.trim(),
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Welcome email failed: ${errMsg}`);
    }

    return {
      ...tokens,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        role: 'user',
      },
    };
  }

  // ─── Admin Login ────────────────────────────────────────────────

  async adminLogin(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { emailLookup: createLookupHash(dto.email, 'email') },
      include: { role: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (
      admin.status !== 'active' &&
      admin.role?.name?.toLowerCase() !== 'super admin'
    ) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Auto-clear expired lockouts
    if (admin.lockedUntil) {
      if (new Date() < new Date(admin.lockedUntil)) {
        const remainMs = new Date(admin.lockedUntil).getTime() - Date.now();
        const remainMin = Math.ceil(remainMs / 60_000);
        throw new UnauthorizedException(
          `Account is locked. Try again in ${remainMin} minute(s), or use the unlock link sent to your email.`,
        );
      }
      // Lock expired — clear it
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: {
          lockedUntil: null,
          failedLoginCount: 0,
        },
      });
      admin.failedLoginCount = 0;
      admin.lockedUntil = null;
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!passwordValid) {
      const newFailCount = admin.failedLoginCount + 1;
      const updateData: Prisma.AdminUpdateInput = {
        failedLoginCount: newFailCount,
      };

      if (newFailCount >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
        updateData.lockedUntil = lockUntil;
        this.logger.warn(
          `Admin ${admin.email} locked until ${lockUntil.toISOString()} after ${newFailCount} failed attempts`,
        );

        // Send lockout notification email
        try {
          void this.emailQueueService.enqueue(
            'admin-account-locked',
            admin.email,
            {
              username: admin.username,
              lockoutMinutes: String(LOCKOUT_MINUTES),
            },
          );
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(`Lockout notification email failed: ${errMsg}`);
        }
      }

      await this.prisma.admin.update({
        where: { id: admin.id },
        data: updateData,
      });

      if (newFailCount >= MAX_LOGIN_ATTEMPTS) {
        throw new UnauthorizedException(
          `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts. Check your email for an unlock link.`,
        );
      }

      throw new UnauthorizedException('Invalid email or password');
    }

    // Successful login — reset counters
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    if (admin.twoFactorEnabled && admin.twoFactorSecret) {
      const tempToken = this.jwtService.sign(
        { id: admin.id, email: admin.email, purpose: '2fa-login' },
        {
          secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
          expiresIn: '5m',
        },
      );
      return { requires2fa: true, tempToken };
    }

    return this.completeAdminLogin(admin);
  }

  async verifyLoginOtp(tempToken: string, otpCode: string) {
    let payload: { id: string; email: string; purpose: string };
    try {
      payload = this.jwtService.verify(tempToken, {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    if (payload.purpose !== '2fa-login') {
      throw new UnauthorizedException('Invalid token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });

    if (!admin || !admin.twoFactorSecret) {
      throw new UnauthorizedException('Account not found');
    }

    const result = verifySync({
      token: otpCode,
      secret: admin.twoFactorSecret,
    });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    return this.completeAdminLogin(admin);
  }

  private async completeAdminLogin(admin: AdminWithRole) {
    const tokens = this.generateTokens({
      id: admin.id,
      email: admin.email,
      role: admin.role?.name || 'admin',
      type: 'admin',
    });

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        refreshToken: tokens.refreshToken,
        lastLoginAt: new Date(),
      },
    });

    return {
      requires2fa: false,
      ...tokens,
      user: {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        role: admin.role?.name,
      },
    };
  }

  // ─── Admin Account Unlock ───────────────────────────────────────

  /** Sends an unlock token to the admin's email if the account is locked. */
  async requestAdminUnlock(email: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { emailLookup: createLookupHash(email, 'email') },
    });

    // Always return a generic message to prevent email enumeration
    const genericMsg =
      'If the account is locked, an unlock link has been sent to the email.';

    if (
      !admin ||
      !admin.lockedUntil ||
      new Date() >= new Date(admin.lockedUntil)
    ) {
      return { message: genericMsg };
    }

    const unlockToken = this.jwtService.sign(
      { id: admin.id, email: admin.email, purpose: 'admin-unlock' },
      {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
        expiresIn: '30m',
      },
    );

    try {
      void this.emailQueueService.enqueue('admin-account-unlock', admin.email, {
        username: admin.username,
        token: unlockToken,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Unlock email failed: ${errMsg}`);
    }

    return { message: genericMsg };
  }

  /** Verifies the unlock token and clears the lockout. */
  async unlockAdminByToken(token: string) {
    let payload: { id: string; email: string; purpose: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired unlock token');
    }

    if (payload.purpose !== 'admin-unlock') {
      throw new BadRequestException('Invalid token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.id },
    });
    if (!admin) {
      throw new BadRequestException('Account not found');
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        lockedUntil: null,
        failedLoginCount: 0,
      },
    });

    return { message: 'Account unlocked successfully. You can now log in.' };
  }

  // ─── Refresh Token ──────────────────────────────────────────────

  async refreshToken(dto: RefreshTokenDto) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
      });
      if (!user || user.refreshToken !== dto.refreshToken) {
        throw new UnauthorizedException('Refresh token revoked');
      }
      const tokens = this.generateTokens({
        id: user.id,
        email: user.email,
        role: 'user',
        type: 'user',
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          refreshToken: tokens.refreshToken,
        },
      });
      return tokens;
    }

    if (payload.type === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.id },
        include: { role: true },
      });
      if (!admin || admin.refreshToken !== dto.refreshToken) {
        throw new UnauthorizedException('Refresh token revoked');
      }
      const tokens = this.generateTokens({
        id: admin.id,
        email: admin.email,
        role: admin.role?.name || 'admin',
        type: 'admin',
      });
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: {
          refreshToken: tokens.refreshToken,
        },
      });
      return tokens;
    }

    throw new UnauthorizedException('Invalid token type');
  }

  // ─── Forgot Password ───────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    let user: User | null = null;
    let admin: Admin | null = null;
    let accountType: 'user' | 'admin';

    if (dto.portal === 'admin') {
      admin = await this.prisma.admin.findUnique({
        where: { emailLookup: createLookupHash(dto.email, 'email') },
      });
      if (!admin) {
        return {
          message:
            'If an account exists with this email, a reset link has been sent.',
        };
      }
      accountType = 'admin';
    } else if (dto.portal === 'customer' || dto.portal === 'embedded') {
      user = await this.prisma.user.findUnique({
        where: { emailLookup: createLookupHash(dto.email, 'email') },
      });
      if (!user) {
        return {
          message:
            'If an account exists with this email, a reset link has been sent.',
        };
      }
      accountType = 'user';
    } else {
      user = await this.prisma.user.findUnique({
        where: { emailLookup: createLookupHash(dto.email, 'email') },
      });
      admin = await this.prisma.admin.findUnique({
        where: { emailLookup: createLookupHash(dto.email, 'email') },
      });

      if (!user && !admin) {
        return {
          message:
            'If an account exists with this email, a reset link has been sent.',
        };
      }

      accountType = user ? 'user' : 'admin';
    }

    const username = user
      ? `${user.firstName} ${user.lastName}`.trim()
      : this.encryptionService.decrypt(admin?.username || '');

    const resetToken = this.jwtService.sign(
      { email: dto.email, type: accountType },
      {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
        expiresIn: '1h',
      },
    );

    if (accountType === 'user' && user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken },
      });
    } else if (admin) {
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { resetToken },
      });
    }

    const template =
      accountType === 'user'
        ? 'customer-password-reset'
        : 'admin-password-reset';

    const resetOrigin =
      accountType === 'admin'
        ? this.configService.get<string>('ADMIN_ORIGIN')
        : dto.portal === 'embedded'
          ? this.configService.get<string>('EMBEDDED_ORIGIN')
          : this.configService.get<string>('ELECTRONICS_ORIGIN');

    const defaultOrigin =
      accountType === 'admin'
        ? 'https://www.admin-portal.vseeds.lk'
        : 'https://www.vseeds.lk';
    const resetPath =
      accountType === 'admin' ? '/auth/reset-password' : '/reset-password';
    const resetUrl = `${resetOrigin ?? defaultOrigin}${resetPath}`;

    try {
      void this.emailQueueService.enqueue(template, dto.email, {
        username,
        token: resetToken,
        resetUrl,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Password reset email failed: ${errMsg}`);
    }

    this.logger.log(`Password reset token generated for ${dto.email}`);

    return {
      message:
        'If an account exists with this email, a reset link has been sent.',
    };
  }

  // ─── Reset Password ────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    let payload: { email: string; type: string };
    try {
      payload = this.jwtService.verify(dto.token, {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    if (payload.type === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { emailLookup: createLookupHash(payload.email, 'email') },
      });
      if (!user || user.resetToken !== dto.token) {
        throw new BadRequestException('Reset token already used or invalid');
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          resetToken: null,
        },
      });
    } else {
      const admin = await this.prisma.admin.findUnique({
        where: { emailLookup: createLookupHash(payload.email, 'email') },
      });
      if (!admin || admin.resetToken !== dto.token) {
        throw new BadRequestException('Reset token already used or invalid');
      }
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: {
          passwordHash: hashedPassword,
          resetToken: null,
        },
      });
    }

    return { message: 'Password reset successfully' };
  }

  // ─── Get Profile ────────────────────────────────────────────────

  async getProfile(payload: JwtPayload) {
    if (payload.type === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        include: { addresses: true },
      });
      if (!user) throw new UnauthorizedException('User not found');
      return {
        id: user.id,
        email: this.encryptionService.decrypt(user.email),
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: 'user',
        type: 'user',
        twoFactorEnabled: user.twoFactorEnabled,
      };
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');

    // Decrypt sensitive fields
    const decryptedEmail = this.encryptionService.decrypt(admin.email);
    const decryptedUsername = this.encryptionService.decrypt(admin.username);

    return {
      id: admin.id,
      email: decryptedEmail,
      username: decryptedUsername,
      role: admin.role?.name,
      type: 'admin',
      phone: admin.phone,
      address: admin.address,
      avatarUrl: admin.avatarUrl,
      createdAt: admin.createdAt,
      twoFactorEnabled: admin.twoFactorEnabled,
    };
  }

  // ─── Update Profile ────────────────────────────────────────────

  async updateAdminProfile(
    payload: JwtPayload,
    dto: { username?: string; phone?: string; address?: string },
  ) {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Only admins can update profile here');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.id },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');

    const updateData: Prisma.AdminUpdateInput = {};
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.address !== undefined) updateData.address = dto.address;

    await this.prisma.admin.update({
      where: { id: payload.id },
      data: updateData,
    });
    return this.getProfile(payload);
  }

  // ─── Two-Factor Authentication ────────────────────────────────

  private async get2faEntity(payload: JwtPayload) {
    if (payload.type === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.id },
      });
      if (!admin) throw new UnauthorizedException('Admin not found');
      return { entity: admin, type: 'admin', issuer: 'VSEEDS Admin' };
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return { entity: user, type: 'user', issuer: 'VSEEDS' };
  }

  async setup2fa(payload: JwtPayload) {
    const { entity, type, issuer } = await this.get2faEntity(payload);

    if (entity.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const secret = generateSecret();
    if (type === 'admin') {
      await this.prisma.admin.update({
        where: { id: entity.id },
        data: { twoFactorSecret: secret },
      });
    } else {
      await this.prisma.user.update({
        where: { id: entity.id },
        data: { twoFactorSecret: secret },
      });
    }

    const otpAuthUrl = generateURI({ issuer, label: entity.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    return { secret, qrCode: qrCodeDataUrl };
  }

  async verify2fa(payload: JwtPayload, token: string) {
    const { entity, type } = await this.get2faEntity(payload);

    if (entity.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }
    if (!entity.twoFactorSecret) {
      throw new BadRequestException('Run 2FA setup first');
    }

    const result = verifySync({ token, secret: entity.twoFactorSecret });
    if (!result.valid) {
      throw new BadRequestException('Invalid verification code');
    }

    if (type === 'admin') {
      await this.prisma.admin.update({
        where: { id: entity.id },
        data: { twoFactorEnabled: true },
      });
    } else {
      await this.prisma.user.update({
        where: { id: entity.id },
        data: { twoFactorEnabled: true },
      });
    }

    return { message: 'Two-factor authentication enabled successfully' };
  }

  async disable2fa(payload: JwtPayload, token: string) {
    const { entity, type } = await this.get2faEntity(payload);

    if (!entity.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const result = verifySync({ token, secret: entity.twoFactorSecret ?? '' });
    if (!result.valid) {
      throw new BadRequestException('Invalid verification code');
    }

    if (type === 'admin') {
      await this.prisma.admin.update({
        where: { id: entity.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: entity.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
    }

    return { message: 'Two-factor authentication disabled successfully' };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private generateTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
      expiresIn: '3h',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: '15d',
    });
    return { accessToken, refreshToken };
  }

  /** Safely decrypt a field value. Returns original value if not encrypted or decryption fails. */
  private decryptField(value: string | null | undefined): string {
    if (!value) return '';
    try {
      return this.encryptionService.decrypt(value);
    } catch {
      return value;
    }
  }
}
