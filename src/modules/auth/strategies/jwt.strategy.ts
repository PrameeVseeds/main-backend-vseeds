import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  type: 'user' | 'admin';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('ACCESS_TOKEN_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.id || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.type === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { status: true },
      });
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Account is disabled');
      }
    } else if (payload.type === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.id },
        select: {
          status: true,
          role: { select: { name: true } },
        },
      });
      if (
        !admin ||
        (admin.role?.name?.toLowerCase() !== 'super admin' &&
          admin.status !== 'active')
      ) {
        throw new UnauthorizedException('Account is disabled');
      }
    }

    return payload;
  }
}
