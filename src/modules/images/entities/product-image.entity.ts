import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Media } from './image-detail.entity';

@Entity('product_media')
@Unique('uq_prod_media', ['productId', 'mediaId'])
export class ProductMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_pm_product')
  @Column({ name: 'product_id', type: 'char', length: 36 })
  productId: string;

  @Column({ name: 'media_id', type: 'char', length: 36 })
  mediaId: string;

  @Column({ name: 'is_thumbnail', default: false })
  isThumbnail: boolean;

  @Column({ name: 'display_order', type: 'smallint', default: 0 })
  displayOrder: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'media_id' })
  media: Media;
}

export { ProductMedia as ProductImage };
