import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_number', length: 30, unique: true })
  quoteNumber: string;

  @Index('idx_quote_user')
  @Column({ name: 'user_id', type: 'char', length: 36, nullable: true })
  userId: string | null;

  @Column({
    name: 'service_type',
    type: 'enum',
    enum: [
      'standard_pcb',
      'advanced_pcb',
      'fpc_rigid_flex',
      'pcb_assembly',
      'smd_stencil',
    ],
  })
  serviceType: string;

  @Column({ name: 'customer_name', length: 200 })
  customerName: string;

  @Index('idx_quote_email')
  @Column({ name: 'customer_email', length: 255 })
  customerEmail: string;

  @Column({ name: 'customer_phone', length: 20, nullable: true })
  customerPhone: string;

  @Column({ name: 'customer_company', length: 200, nullable: true })
  customerCompany: string;

  @Column({ type: 'json' })
  details: any;

  @Column({ name: 'service_level', length: 50, nullable: true })
  serviceLevel: string;

  @Column({ name: 'estimated_build_time', length: 50, nullable: true })
  estimatedBuildTime: string;

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalPrice: number;

  @Index('idx_quote_status')
  @Column({
    type: 'enum',
    enum: ['pending', 'quoted', 'approved', 'declined', 'paid', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
