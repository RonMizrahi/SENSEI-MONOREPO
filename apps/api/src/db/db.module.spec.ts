import { DbModule } from './db.module';
import { MigrationRunnerService } from './migration-runner.service';

describe('DbModule.forRoot', () => {
  const originalMockMode = process.env.MOCK_MODE;

  afterEach(() => {
    if (originalMockMode === undefined) {
      delete process.env.MOCK_MODE;
    } else {
      process.env.MOCK_MODE = originalMockMode;
    }
  });

  it('skips the database AND the migration runner entirely in MOCK_MODE', () => {
    process.env.MOCK_MODE = 'true';

    const dynamicModule = DbModule.forRoot();

    expect(dynamicModule.module).toBe(DbModule);
    expect(dynamicModule.imports).toEqual([]);
    expect(dynamicModule.providers).toBeUndefined();
  });

  it('wires TypeORM plus the boot-time migration runner outside MOCK_MODE', () => {
    process.env.MOCK_MODE = 'false';

    const dynamicModule = DbModule.forRoot();

    expect(dynamicModule.module).toBe(DbModule);
    expect(dynamicModule.imports).toHaveLength(1);
    expect(dynamicModule.providers).toEqual([MigrationRunnerService]);
  });
});
