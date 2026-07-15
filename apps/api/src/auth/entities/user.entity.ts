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

  // --- profile (SPA settings/ProfileTab); all nullable, added in 0009 ---
  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  /** 'f' | 'm' | null — drives gendered Hebrew microcopy in the SPA. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  gender!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'license_number', type: 'varchar', length: 64, nullable: true })
  licenseNumber!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  org!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ name: 'avatar_color', type: 'varchar', length: 16, nullable: true })
  avatarColor!: string | null;

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
