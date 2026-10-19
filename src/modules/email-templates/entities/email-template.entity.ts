import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity('email_templates')
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_et_slug')
  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ length: 300 })
  subject: string;

  @Column({ name: 'html_body', type: 'longtext', nullable: true })
  htmlBody: string;

  @Column({ name: 'text_body', type: 'text', nullable: true })
  textBody: string;

  @Column({ type: 'json', nullable: true })
  variables: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
