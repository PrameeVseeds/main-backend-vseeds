import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Encrypted } from '@common/decorators/encrypted.decorator';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Encrypted()
  @Column({ length: 500 })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 300, nullable: true })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: ['electronics', 'embedded', 'general'],
    default: 'general',
  })
  source: string;

  @Index('idx_contact_status')
  @Column({
    type: 'enum',
    enum: ['new', 'read', 'replied', 'archived'],
    default: 'new',
  })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
