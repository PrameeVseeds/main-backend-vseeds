import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductPriceTier } from './product-price-tier.entity';
import { ProductMedia } from '../../images/entities/product-image.entity';

@Entity('products')
@Index('idx_prod_cat_status', ['categoryId', 'status'])
@Index('idx_prod_deleted_at', ['deletedAt'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_prod_category')
  @Column({ name: 'category_id', type: 'char', length: 36, nullable: true })
  categoryId: string;

  @Column({ length: 100, unique: true, nullable: true })
  sku: string;

  @Column({ length: 300 })
  name: string;

  @Index('idx_prod_slug')
  @Column({ length: 300, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  specifications: Record<string, string>[];

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ name: 'datasheet_url', length: 500, nullable: true })
  datasheetUrl: string;

  @Column({ name: 'model_3d_url', length: 500, nullable: true })
  model3dUrl: string;

  @Column({ name: 'product_link', length: 500, nullable: true })
  productLink: string;

  @Column({ name: 'sub_category', length: 200, nullable: true })
  subCategory: string;

  @Column({ name: 'store_id', length: 100, nullable: true })
  storeId: string;

  @Column({ name: 'quantity_in_hand', default: 0 })
  quantityInHand: number;

  @Column({ name: 'quantity_ordered', default: 0 })
  quantityOrdered: number;

  @Column({
    name: 'purchased_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  purchasedPrice: number;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate: Date;

  @Index('idx_prod_status')
  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'out_of_stock', 'discontinued'],
    default: 'active',
  })
  status: string;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Category, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => ProductPriceTier, (tier) => tier.product, { cascade: true })
  priceTiers: ProductPriceTier[];

  @OneToMany(() => ProductMedia, (pm) => pm.product)
  productMedia: ProductMedia[];
}
