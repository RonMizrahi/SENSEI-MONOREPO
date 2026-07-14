import { HealthService } from './health.service';

describe('HealthService', () => {
  const originalMockMode = process.env.MOCK_MODE;

  afterEach(() => {
    if (originalMockMode === undefined) delete process.env.MOCK_MODE;
    else process.env.MOCK_MODE = originalMockMode;
  });

  it('reports mock database in MOCK_MODE', async () => {
    process.env.MOCK_MODE = 'true';
    const service = new HealthService(undefined);
    await expect(service.readiness()).resolves.toEqual({ status: 'ready', database: 'mock' });
  });

  it('reports ok when the database answers SELECT 1', async () => {
    process.env.MOCK_MODE = 'false';
    const dataSource = { query: jest.fn(() => Promise.resolve([])) };
    const service = new HealthService(dataSource as never);
    await expect(service.readiness()).resolves.toEqual({ status: 'ready', database: 'ok' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports unavailable when the ping throws', async () => {
    process.env.MOCK_MODE = 'false';
    const dataSource = { query: jest.fn(() => Promise.reject(new Error('down'))) };
    const service = new HealthService(dataSource as never);
    await expect(service.readiness()).resolves.toEqual({
      status: 'not_ready',
      database: 'unavailable',
    });
  });

  it('reports unavailable when no DataSource is wired', async () => {
    process.env.MOCK_MODE = 'false';
    const service = new HealthService(undefined);
    await expect(service.readiness()).resolves.toEqual({
      status: 'not_ready',
      database: 'unavailable',
    });
  });
});
