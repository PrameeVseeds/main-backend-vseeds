import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Encrypted } from '@common/decorators/encrypted.decorator';

@Entity('promo_codes')
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Encrypted()
  @Column({ length: 500 })
  code: string;

  @Index('idx_promo_code_lookup', { unique: true })
  @Column({ name: 'code_lookup', length: 64, unique: true })
  codeLookup: string;

  @Column({ length: 255, nullable: true })
  description: string;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: ['percentage', 'fixed'],
    default: 'percentage',
  })
  discountType: string;

  @Column({
    name: 'discount_value',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  discountValue: number;

  @Column({
    name: 'applicable_site',
    type: 'enum',
    enum: ['electronics', 'embedded', 'both'],
    default: 'both',
  })
  applicableSite: string;

  @Column({
    name: 'minimum_order_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  minimumOrderAmount: number;

  @Column({
    name: 'maximum_discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  maximumDiscountAmount: number;

  @Column({ name: 'usage_limit', default: 0 })
  usageLimit: number;

  @Column({ name: 'used_count', default: 0 })
  usedCount: number;

  @Column({ name: 'per_user_limit', default: 1 })
  perUserLimit: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  expiryDate: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
