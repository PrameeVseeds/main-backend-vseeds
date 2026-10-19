import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserAddress } from '../../users/entities/user-address.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { Shipment } from '../../deliveries/entities/shipment.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('orders')
@Index('idx_order_deleted_at', ['deletedAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_order_number')
  @Column({ name: 'order_number', length: 30, unique: true })
  orderNumber: string;

  @Index('idx_order_user')
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({
    name: 'shipping_address_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  shippingAddressId: string;

  @Column({
    name: 'order_type',
    type: 'enum',
    enum: ['product', 'service'],
    default: 'product',
  })
  orderType: string;

  @Column({ name: 'quote_id', type: 'char', length: 36, nullable: true })
  quoteId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({
    name: 'shipping_fee',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  shippingFee: number;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @Column({ name: 'promo_code', length: 50, nullable: true })
  promoCode: string;

  @Column({ name: 'promo_code_id', type: 'char', length: 36, nullable: true })
  promoCodeId: string;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Index('idx_order_status')
  @Column({
    type: 'enum',
    enum: [
      'pending',
      'waiting_for_payment',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ],
    default: 'pending',
  })
  status: string;

  @Column({ name: 'customer_notes', type: 'text', nullable: true })
  customerNotes: string;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  @Index('idx_order_created')
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @VersionColumn()
  version: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => UserAddress, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shipping_address_id' })
  shippingAddress: UserAddress;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (h) => h.order)
  statusHistory: OrderStatusHistory[];

  @OneToMany(() => Shipment, (s) => s.order)
  shipments: Shipment[];

  @OneToMany(() => Payment, (p) => p.order)
  payments: Payment[];
}
