import { Injectable } from '@nestjs/common';
import { isMockMode, provideMockSwappable } from './mock-mode';

@Injectable()
class RealImpl {}

@Injectable()
class MockImpl {}

describe('mock-mode', () => {
  const originalMockMode = process.env.MOCK_MODE;

  afterEach(() => {
    if (originalMockMode === undefined) delete process.env.MOCK_MODE;
    else process.env.MOCK_MODE = originalMockMode;
  });

  it('isMockMode is true only for the literal "true"', () => {
    process.env.MOCK_MODE = 'true';
    expect(isMockMode()).toBe(true);
    process.env.MOCK_MODE = 'false';
    expect(isMockMode()).toBe(false);
    delete process.env.MOCK_MODE;
    expect(isMockMode()).toBe(false);
  });

  it('provideMockSwappable binds the real class outside MOCK_MODE', () => {
    process.env.MOCK_MODE = 'false';
    const token = Symbol('SWAP_TEST');
    expect(provideMockSwappable(token, RealImpl, MockImpl)).toEqual({
      provide: token,
      useClass: RealImpl,
    });
  });

  it('provideMockSwappable binds the mock class in MOCK_MODE', () => {
    process.env.MOCK_MODE = 'true';
    const token = Symbol('SWAP_TEST');
    expect(provideMockSwappable(token, RealImpl, MockImpl)).toEqual({
      provide: token,
      useClass: MockImpl,
    });
  });
});
