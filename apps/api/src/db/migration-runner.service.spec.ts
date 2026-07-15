import type { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { DataSource, QueryRunner } from 'typeorm';
import type { Env } from '../config/env.schema';
import { MigrationRunnerService } from './migration-runner.service';

/** A ConfigService stub returning the given SEED_DEMO_DATA value. */
function createConfigMock(seedDemo = false): ConfigService<Env, true> {
  return { get: jest.fn(() => seedDemo) } as unknown as ConfigService<Env, true>;
}

interface DataSourceMock {
  dataSource: DataSource;
  queryRunner: QueryRunner;
  createQueryRunner: jest.Mock;
  /** High-level event log across the QueryRunner and the DataSource, in call order. */
  events: string[];
}

/** Builds a DataSource + QueryRunner mock with a canned _migrations state and optional failing SQL marker. */
function createDataSourceMock(
  alreadyApplied: string[] = [],
  failOnSqlContaining?: string,
): DataSourceMock {
  const events: string[] = [];
  const queryRunner = {
    connect: jest.fn(() => Promise.resolve()),
    release: jest.fn(() => {
      events.push('RELEASE');
      return Promise.resolve();
    }),
    startTransaction: jest.fn(() => {
      events.push('BEGIN');
      return Promise.resolve();
    }),
    commitTransaction: jest.fn(() => {
      events.push('COMMIT');
      return Promise.resolve();
    }),
    rollbackTransaction: jest.fn(() => {
      events.push('ROLLBACK');
      return Promise.resolve();
    }),
    query: jest.fn((sql: string, params?: unknown[]): Promise<unknown[]> => {
      if (sql.includes('pg_advisory_lock')) {
        events.push('LOCK');
        return Promise.resolve([]);
      }
      if (sql.includes('pg_advisory_unlock')) {
        events.push('UNLOCK');
        return Promise.resolve([]);
      }
      if (sql.includes('set_config')) {
        events.push(`SEED_GUC ${String(params?.[1])}`);
        return Promise.resolve([]);
      }
      if (failOnSqlContaining !== undefined && sql.includes(failOnSqlContaining)) {
        return Promise.reject(new Error('syntax error at or near "BOOM"'));
      }
      if (sql.startsWith('INSERT INTO _migrations')) {
        events.push(`INSERT ${String(params?.[0])}`);
        return Promise.resolve([]);
      }
      if (sql.includes('CREATE TABLE IF NOT EXISTS _migrations')) {
        events.push('ENSURE_TABLE');
        return Promise.resolve([]);
      }
      events.push(sql);
      return Promise.resolve([]);
    }),
  } as unknown as QueryRunner;
  const createQueryRunner = jest.fn(() => queryRunner);
  const dataSource = {
    createQueryRunner,
    query: jest.fn((): Promise<{ name: string }[]> => {
      events.push('SELECT_APPLIED');
      return Promise.resolve(alreadyApplied.map((name) => ({ name })));
    }),
  } as unknown as DataSource;
  return { dataSource, queryRunner, createQueryRunner, events };
}

describe('MigrationRunnerService', () => {
  let migrationsDir: string;

  beforeEach(() => {
    migrationsDir = mkdtempSync(path.join(tmpdir(), 'sensei-migrations-'));
  });

  afterEach(() => {
    rmSync(migrationsDir, { recursive: true, force: true });
  });

  /** Writes one migration file into the temp migrations directory. */
  function writeMigration(name: string, sql: string): void {
    writeFileSync(path.join(migrationsDir, name), sql);
  }

  it('applies pending files sorted by filename, each with its record in ONE transaction', async () => {
    writeMigration('0002_second.sql', 'CREATE TABLE two (id int);');
    writeMigration('0001_first.sql', 'CREATE TABLE one (id int);');
    writeMigration('0010_tenth.sql', 'CREATE TABLE ten (id int);');
    const mock = createDataSourceMock();
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    const applied = await service.run(migrationsDir);

    expect(applied).toEqual(['0001_first.sql', '0002_second.sql', '0010_tenth.sql']);
    expect(mock.events).toEqual([
      'LOCK',
      'ENSURE_TABLE',
      'SELECT_APPLIED',
      'BEGIN',
      'SEED_GUC false',
      'CREATE TABLE one (id int);',
      'INSERT 0001_first.sql',
      'COMMIT',
      'BEGIN',
      'SEED_GUC false',
      'CREATE TABLE two (id int);',
      'INSERT 0002_second.sql',
      'COMMIT',
      'BEGIN',
      'SEED_GUC false',
      'CREATE TABLE ten (id int);',
      'INSERT 0010_tenth.sql',
      'COMMIT',
      'UNLOCK',
      'RELEASE',
    ]);
  });

  it('skips files already recorded in _migrations', async () => {
    writeMigration('0001_first.sql', 'CREATE TABLE one (id int);');
    writeMigration('0002_second.sql', 'CREATE TABLE two (id int);');
    const mock = createDataSourceMock(['0001_first.sql']);
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    const applied = await service.run(migrationsDir);

    expect(applied).toEqual(['0002_second.sql']);
    expect(mock.events.filter((event) => event.startsWith('INSERT'))).toEqual([
      'INSERT 0002_second.sql',
    ]);
  });

  it('applies nothing when everything is already recorded', async () => {
    writeMigration('0001_first.sql', 'CREATE TABLE one (id int);');
    const mock = createDataSourceMock(['0001_first.sql']);
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    await expect(service.run(migrationsDir)).resolves.toEqual([]);
    expect(mock.events).not.toContain('BEGIN');
  });

  it('rolls back a failing file, aborts, and still releases the lock and connection', async () => {
    writeMigration('0001_bad.sql', 'BOOM;');
    writeMigration('0002_never.sql', 'CREATE TABLE never (id int);');
    const mock = createDataSourceMock([], 'BOOM');
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    await expect(service.run(migrationsDir)).rejects.toThrow(
      /Migration 0001_bad\.sql failed and was rolled back/,
    );
    // the failed file rolled back without recording, the next file never started,
    // and the advisory lock + connection were released on the failure path
    expect(mock.events).toEqual([
      'LOCK',
      'ENSURE_TABLE',
      'SELECT_APPLIED',
      'BEGIN',
      'SEED_GUC false',
      'ROLLBACK',
      'UNLOCK',
      'RELEASE',
    ]);
  });

  it('sets the seed-demo GUC to true for each migration when SEED_DEMO_DATA is on', async () => {
    writeMigration('0001_first.sql', 'CREATE TABLE one (id int);');
    const mock = createDataSourceMock();
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock(true));

    await service.run(migrationsDir);

    expect(mock.events).toContain('SEED_GUC true');
    expect(mock.events).not.toContain('SEED_GUC false');
  });

  it('propagates the failure from onModuleInit so boot aborts', async () => {
    const mock = createDataSourceMock();
    (mock.dataSource.query as jest.Mock).mockRejectedValue(new Error('connection refused'));
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    await expect(service.onModuleInit()).rejects.toThrow('connection refused');
  });

  it('returns an empty list for an empty migrations directory', async () => {
    const mock = createDataSourceMock();
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    await expect(service.run(migrationsDir)).resolves.toEqual([]);
    expect(mock.events).not.toContain('BEGIN');
  });

  it('ignores non-.sql files', async () => {
    writeMigration('README.md', 'not sql');
    writeMigration('0001_first.sql', 'CREATE TABLE one (id int);');
    const mock = createDataSourceMock();
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    await expect(service.run(migrationsDir)).resolves.toEqual(['0001_first.sql']);
  });

  it('rejects with a clear error before touching the database when the directory is unreadable', async () => {
    const missingDir = path.join(migrationsDir, 'does-not-exist');
    const mock = createDataSourceMock();
    const service = new MigrationRunnerService(mock.dataSource, createConfigMock());

    await expect(service.run(missingDir)).rejects.toThrow(
      /Cannot read migrations directory .*does-not-exist/,
    );
    expect(mock.createQueryRunner).not.toHaveBeenCalled();
  });
});
