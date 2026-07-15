import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { Preferences } from './entities/user-settings.entity';
import type { SettingsRepositoryContract } from './settings.repository';
import { SettingsService } from './settings.service';

const USER: AuthenticatedUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 't@x.co',
  fullName: 'T',
  role: 'therapist',
};

function createRepo(): {
  repo: SettingsRepositoryContract;
  getForUser: jest.Mock;
  replace: jest.Mock;
} {
  const getForUser = jest.fn();
  const replace = jest.fn();
  return { repo: { getForUser, replace }, getForUser, replace };
}

describe('SettingsService', () => {
  it('returns the caller’s preferences wrapped in the response shape', async () => {
    const prefs: Preferences = { appearance: { theme: 'light' } };
    const { repo, getForUser } = createRepo();
    getForUser.mockResolvedValue(prefs);
    const service = new SettingsService(repo);

    const result = await service.get(USER);

    expect(getForUser).toHaveBeenCalledWith(USER.userId);
    expect(result.preferences).toEqual(prefs);
  });

  it('replaces the caller’s preferences and echoes the stored blob', async () => {
    const prefs: Preferences = { appearance: { theme: 'dark' }, security: { twoFA: true } };
    const { repo, replace } = createRepo();
    replace.mockResolvedValue(prefs);
    const service = new SettingsService(repo);

    const result = await service.replace(USER, { preferences: prefs });

    expect(replace).toHaveBeenCalledWith(USER.userId, prefs);
    expect(result.preferences).toEqual(prefs);
  });
});
