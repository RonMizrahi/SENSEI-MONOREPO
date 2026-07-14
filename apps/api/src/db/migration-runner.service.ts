import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DataSource, type QueryRunner } from 'typeorm';

/** Default location of the versioned SQL scripts (apps/api/db/migrations) — valid from src/ and dist/. */
export const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');

const MIGRATIONS_TABLE = '_migrations';
const SQL_EXTENSION = '.sql';
/** App-wide advisory-lock key serializing migration runs across concurrent processes. */
const MIGRATIONS_LOCK_KEY = 815589001;

/** Formats an unknown thrown value into a readable message. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Applies the versioned SQL scripts in db/migrations on application boot.
 * Each pending file runs with its _migrations record in ONE transaction; a
 * failing file rolls back fully and aborts boot with a clear error.
 * Migration files must not contain their own BEGIN/COMMIT.
 */
@Injectable()
export class MigrationRunnerService implements OnModuleInit {
  private readonly logger = new Logger(MigrationRunnerService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Boot hook — applies all pending migrations before the app starts serving. */
  async onModuleInit(): Promise<void> {
    await this.run();
  }

  /**
   * Applies every not-yet-recorded migration file in filename order,
   * serialized across processes by a Postgres advisory lock.
   * @returns Filenames applied by this call, in order. @throws Error when a file fails.
   */
  async run(migrationsDir: string = DEFAULT_MIGRATIONS_DIR): Promise<string[]> {
    const files = await this.listMigrationFiles(migrationsDir);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // session lock: concurrent boots wait here and then see the winner's rows
      await queryRunner.query(`SELECT pg_advisory_lock($1)`, [MIGRATIONS_LOCK_KEY]);
      try {
        return await this.applyPending(queryRunner, migrationsDir, files);
      } finally {
        await queryRunner.query(`SELECT pg_advisory_unlock($1)`, [MIGRATIONS_LOCK_KEY]);
      }
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Applies the pending subset of `files` while the advisory lock is held.
   * @returns Filenames applied, in order.
   */
  private async applyPending(
    queryRunner: QueryRunner,
    migrationsDir: string,
    files: string[],
  ): Promise<string[]> {
    await this.ensureMigrationsTable(queryRunner);
    const alreadyApplied = await this.appliedMigrationNames();
    const pending = files.filter((file) => !alreadyApplied.has(file));
    for (const file of pending) {
      await this.applyMigration(queryRunner, migrationsDir, file);
    }
    return pending;
  }

  /** Creates the _migrations bookkeeping table when it does not exist yet. */
  private async ensureMigrationsTable(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        name varchar PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
  }

  /**
   * Lists the .sql files of the migrations directory sorted by filename.
   * @throws Error when the directory cannot be read.
   */
  private async listMigrationFiles(migrationsDir: string): Promise<string[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(migrationsDir);
    } catch (error) {
      throw new Error(
        `Cannot read migrations directory ${migrationsDir}: ${describeError(error)}`,
        { cause: error },
      );
    }
    return entries.filter((name) => name.endsWith(SQL_EXTENSION)).sort();
  }

  /** Reads the migration names already recorded in _migrations. */
  private async appliedMigrationNames(): Promise<Set<string>> {
    const rows = await this.dataSource.query<{ name: string }[]>(
      `SELECT name FROM ${MIGRATIONS_TABLE}`,
    );
    return new Set(rows.map((row) => row.name));
  }

  /**
   * Runs one migration file's SQL plus its _migrations INSERT in a single transaction.
   * @throws Error naming the file when its SQL fails (the transaction is rolled back).
   */
  private async applyMigration(
    queryRunner: QueryRunner,
    migrationsDir: string,
    file: string,
  ): Promise<void> {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(sql);
      await queryRunner.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [file]);
      await queryRunner.commitTransaction();
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {
        // connection-level failure — the original migration error below wins
      }
      throw new Error(`Migration ${file} failed and was rolled back: ${describeError(error)}`, {
        cause: error,
      });
    }
    this.logger.log(`Applied migration ${file}`);
  }
}
