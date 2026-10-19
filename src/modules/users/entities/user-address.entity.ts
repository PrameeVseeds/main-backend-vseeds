import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Encrypted } from '@common/decorators/encrypted.decorator';

@Entity('user_addresses')
export class UserAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_addr_user')
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ length: 50, nullable: true })
  label: string;

  @Encrypted()
  @Column({ name: 'full_name', length: 500 })
  fullName: string;

  @Encrypted()
  @Column({ length: 500, nullable: true })
  email: string;

  @Encrypted()
  @Column({ length: 500 })
  phone: string;

  @Encrypted()
  @Column({ name: 'address_line1', length: 1000 })
  addressLine1: string;

  @Encrypted()
  @Column({ name: 'address_line2', length: 1000, nullable: true })
  addressLine2: string;

  @Encrypted()
  @Column({ length: 500, nullable: true })
  city: string;

  @Encrypted()
  @Column({ length: 500 })
  district: string;

  @Encrypted()
  @Column({ length: 500 })
  province: string;

  @Encrypted()
  @Column({ name: 'postal_code', length: 500 })
  postalCode: string;

  @Column({ length: 100, default: 'Sri Lanka' })
  country: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
