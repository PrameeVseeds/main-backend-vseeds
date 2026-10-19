import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Encrypted } from '@common/decorators/encrypted.decorator';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Encrypted()
  @Column({ length: 500 })
  username: string;

  @Index('idx_admin_username_lookup', { unique: true })
  @Column({ name: 'username_lookup', length: 64, unique: true })
  usernameLookup: string;

  @Encrypted()
  @Column({ length: 500 })
  email: string;

  @Index('idx_admin_email_lookup', { unique: true })
  @Column({ name: 'email_lookup', length: 64, unique: true })
  emailLookup: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'role_id', type: 'char', length: 36, nullable: true })
  roleId: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 500, nullable: true })
  address: string;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl: string;

  @Index('idx_admin_status')
  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  })
  status: string;

  @Column({
    name: 'two_factor_secret',
    length: 255,
    nullable: true,
    select: false,
  })
  twoFactorSecret: string;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Column({
    name: 'failed_login_count',
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  failedLoginCount: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ name: 'refresh_token', length: 500, nullable: true, select: false })
  refreshToken: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Role, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
