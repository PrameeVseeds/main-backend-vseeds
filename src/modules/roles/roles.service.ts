import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdatePrivilegeDto } from './dto/update-privilege.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { PrivilegeResponseDto } from './dto/privilege-response.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // OPT: Batch-load members count and privileges to avoid N+1 (single count query + single role-privilege query).
  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { id: 'asc' },
    });
    if (roles.length === 0) return [];

    const roleIds = roles.map((r) => r.id);
    const [memberCounts, rps] = await Promise.all([
      this.prisma.admin.groupBy({
        by: ['roleId'],
        _count: { _all: true },
        where: { roleId: { in: roleIds } },
      }),
      this.prisma.rolePrivilege.findMany({
        where: { roleId: { in: roleIds }, isActive: true },
        include: { privilege: true },
      }),
    ]);

    const membersByRole = new Map<string, number>(
      memberCounts.map((r) => [r.roleId ?? '', r._count._all]),
    );

    const privilegesByRole = new Map<string, string[]>();
    for (const rp of rps) {
      if (!rp.privilege?.name) continue;
      const arr = privilegesByRole.get(rp.roleId) ?? [];
      arr.push(rp.privilege.name);
      privilegesByRole.set(rp.roleId, arr);
    }

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description ?? undefined,
      isSystem: role.isSystem,
      members: membersByRole.get(role.id) ?? 0,
      privileges: privilegesByRole.get(role.id) ?? [],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  // OPT: Response DTO + selective select.
  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) throw new NotFoundException('Role not found');
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? undefined,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async findByName(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new BadRequestException('Role name already exists');
    const saved = await this.prisma.role.create({ data: dto });
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    const updateData = { ...dto };
    if (role.isSystem) delete (updateData as { name?: string }).name;
    await this.prisma.role.update({
      where: { id },
      data: updateData,
    });
    return this.findById(id);
  }

  async delete(id: string) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new BadRequestException(`Cannot delete system role "${role.name}"`);
    }
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  }

  // ─── Privileges ─────────────────────────────────────────────────

  // OPT: Response DTO + selective select (see privilege-response.dto.ts).
  async getAllPrivileges(): Promise<PrivilegeResponseDto[]> {
    const privileges = await this.prisma.privilege.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
    return privileges.map((p) => ({
      id: p.id,
      name: p.name,
      module: p.module,
      description: p.description ?? undefined,
    }));
  }

  async getPrivilegesByModule(module: string) {
    return this.prisma.privilege.findMany({
      where: { module },
      orderBy: { name: 'asc' },
    });
  }

  async getPrivilegesForRole(roleId: string) {
    await this.findById(roleId);
    return this.prisma.rolePrivilege.findMany({
      where: { roleId },
      include: { privilege: true },
      orderBy: { privilegeId: 'asc' },
    });
  }

  async updatePrivilegeForRole(roleId: string, dto: UpdatePrivilegeDto) {
    await this.findById(roleId);

    const rp = await this.prisma.rolePrivilege.findFirst({
      where: { roleId, privilegeId: dto.privilegeId },
    });

    if (rp) {
      return this.prisma.rolePrivilege.update({
        where: { id: rp.id },
        data: { isActive: dto.isActive },
      });
    }

    return this.prisma.rolePrivilege.create({
      data: {
        roleId,
        privilegeId: dto.privilegeId,
        isActive: dto.isActive,
      },
    });
  }

  async bulkSetPrivileges(roleId: string, privilegeIds: string[]) {
    await this.findById(roleId);

    await this.prisma.rolePrivilege.deleteMany({ where: { roleId } });

    if (privilegeIds.length === 0) return [];

    await this.prisma.rolePrivilege.createMany({
      data: privilegeIds.map((privilegeId) => ({
        roleId,
        privilegeId,
        isActive: true,
      })),
    });

    return this.getPrivilegesForRole(roleId);
  }
}
