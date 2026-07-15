import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Opaque client-owned preference blob (a11y / notifPrefs / appearance / security). */
export type Preferences = Record<string, unknown>;

/** Per-therapist UI preferences — one row per user, shape owned by the SPA. */
@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  preferences!: Preferences;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
