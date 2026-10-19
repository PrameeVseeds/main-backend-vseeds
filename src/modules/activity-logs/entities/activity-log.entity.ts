import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'char', length: 36, nullable: true })
  actorId: string | null;

  @Index('idx_al_actor')
  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: ['admin', 'user', 'system'],
  })
  actorType: string;

  @Index('idx_al_action')
  @Column({ length: 50 })
  action: string;

  @Column({ name: 'entity_type', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'char', length: 36, nullable: true })
  entityId: string | null;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', length: 500, nullable: true })
  userAgent: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Index('idx_al_created')
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
