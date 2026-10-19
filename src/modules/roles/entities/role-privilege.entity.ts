import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';
import { Privilege } from './privilege.entity';

@Entity('role_privileges')
@Unique('uq_role_priv', ['roleId', 'privilegeId'])
export class RolePrivilege {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'role_id', type: 'char', length: 36 })
  roleId: string;

  @Column({ name: 'privilege_id', type: 'char', length: 36 })
  privilegeId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Privilege, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'privilege_id' })
  privilege: Privilege;
}
