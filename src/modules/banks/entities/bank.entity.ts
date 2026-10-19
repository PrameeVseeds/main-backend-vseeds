import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Encrypted } from '@common/decorators/encrypted.decorator';

@Entity('banks')
export class Bank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Encrypted()
  @Column({ name: 'bank_name', length: 500 })
  bankName: string;

  @Encrypted()
  @Column({ length: 500 })
  branch: string;

  @Encrypted()
  @Column({ name: 'account_number', length: 500 })
  accountNumber: string;

  @Encrypted()
  @Column({ name: 'account_name', length: 500 })
  accountName: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'display_order', type: 'smallint', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
