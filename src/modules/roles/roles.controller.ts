import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdatePrivilegeDto } from './dto/update-privilege.dto';

@ApiTags('Roles')
@Controller('roles')
@Roles('admin', 'super admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('all')
  @ApiOperation({ summary: 'Get all roles' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('privilege/all')
  @ApiOperation({ summary: 'Get all privileges' })
  getAllPrivileges() {
    return this.rolesService.getAllPrivileges();
  }

  @Get('privilege/:roleId')
  @ApiOperation({ summary: 'Get privileges for a role' })
  getPrivilegesForRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.rolesService.getPrivilegesForRole(roleId);
  }

  @Put('privilege/:roleId')
  @ApiOperation({ summary: 'Update privilege for a role' })
  updatePrivilegeForRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdatePrivilegeDto,
  ) {
    return this.rolesService.updatePrivilegeForRole(roleId, dto);
  }

  @Put('privilege/bulk/:roleId')
  @ApiOperation({ summary: 'Bulk-set privileges for a role' })
  bulkSetPrivileges(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() body: { privilegeIds: string[] },
  ) {
    return this.rolesService.bulkSetPrivileges(roleId, body.privilegeIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findById(id);
  }

  @Post('add')
  @ApiOperation({ summary: 'Create role' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put('update/:id')
  @ApiOperation({ summary: 'Update role' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Delete role' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.delete(id);
  }
}
