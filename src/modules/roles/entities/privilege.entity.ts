import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('privileges')
export class Privilege {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ length: 50 })
  module: string;

  @Column({ length: 255, nullable: true })
  description: string;
}
