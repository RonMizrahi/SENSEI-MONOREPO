import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Therapist account — mirrors senseiAPI's `users` table (foundation-frozen). */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Authentication mechanism — always 'password' today. */
  @Column({ name: 'auth_type', type: 'varchar', length: 64 })
  authType!: string;

  /** Coarse role — always 'therapist' today. */
  @Column({ type: 'varchar', length: 64 })
  role!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName!: string | null;

  /** Never serialized — stripped by the global ClassSerializerInterceptor. */
  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 512 })
  passwordHash!: string;

  /** Bumped on logout/password change — invalidates all previously issued tokens. */
  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
