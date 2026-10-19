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
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { Order } from '../../orders/entities/order.entity';
import { Quote } from '../../quotes/entities/quote.entity';

@Entity('product_reviews')
export class ProductReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_rev_product')
  @Column({ name: 'product_id', type: 'char', length: 36 })
  productId: string;

  @Index('idx_rev_user')
  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ type: 'tinyint', unsigned: true })
  rating: number;

  @Column({ name: 'review_text', type: 'text', nullable: true })
  reviewText: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string;

  @Column({ name: 'admin_reply', type: 'text', nullable: true })
  adminReply: string;

  @Column({ name: 'admin_reply_at', type: 'timestamp', nullable: true })
  adminReplyAt: Date;

  @Column({ name: 'is_approved', default: false })
  isApproved: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'order_id', type: 'char', length: 36, nullable: true })
  orderId: string | null;

  @Column({ name: 'quote_id', type: 'char', length: 36, nullable: true })
  quoteId: string | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Quote, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;
}
