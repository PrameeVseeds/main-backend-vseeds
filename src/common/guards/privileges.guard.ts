import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PRIVILEGES_KEY } from '../decorators/privileges.decorator';

@Injectable()
export class PrivilegesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PRIVILEGES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    const user = request.user;
    if (!user?.role) return false;

    const role = await this.prisma.role.findUnique({
      where: { name: user.role },
    });
    if (!role) return false;

    const rolePrivileges = await this.prisma.rolePrivilege.findMany({
      where: { roleId: role.id, isActive: true },
      include: { privilege: true },
    });

    const userPrivileges = rolePrivileges.map((rp) => rp.privilege.name);
    return required.some((p) => userPrivileges.includes(p));
  }
}
