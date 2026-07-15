import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import type { NotificationsRepositoryContract } from './notifications.repository';

const USER: AuthenticatedUser = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 't@x.co',
  fullName: 'T',
  role: 'therapist',
};

function buildRow(overrides: Partial<Notification> = {}): Notification {
  const row = new Notification();
  row.id = '00000000-0000-4000-8000-0000000000c1';
  row.therapistId = USER.userId;
  row.kind = 'summary';
  row.patientId = '00000000-0000-4000-8000-0000000000a1';
  row.title = 'סיכום AI מוכן';
  row.body = 'ניתוח הפגישה הושלם';
  row.groupLabel = 'היום';
  row.displayTime = 'לפני 8 דק׳';
  row.readAt = null;
  row.archivedAt = null;
  row.createdAt = new Date('2026-07-15T09:00:00Z');
  return Object.assign(row, overrides);
}

function createRepo(): {
  repo: NotificationsRepositoryContract;
  findAllForTherapist: jest.Mock;
  update: jest.Mock;
} {
  const findAllForTherapist = jest.fn();
  const update = jest.fn();
  return { repo: { findAllForTherapist, update }, findAllForTherapist, update };
}

describe('NotificationsService', () => {
  it('lists the caller’s notifications as wire DTOs (timestamps → booleans)', async () => {
    const { repo, findAllForTherapist } = createRepo();
    findAllForTherapist.mockResolvedValue([buildRow({ readAt: new Date(), archivedAt: null })]);
    const service = new NotificationsService(repo);

    const list = await service.list(USER);

    expect(findAllForTherapist).toHaveBeenCalledWith(USER.userId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: '00000000-0000-4000-8000-0000000000c1',
      kind: 'summary',
      patient_id: '00000000-0000-4000-8000-0000000000a1',
      group_label: 'היום',
      display_time: 'לפני 8 דק׳',
      read: true,
      archived: false,
    });
  });

  it('updates a caller-owned notification and returns the mapped row', async () => {
    const { repo, update } = createRepo();
    update.mockResolvedValue(buildRow({ archivedAt: new Date() }));
    const service = new NotificationsService(repo);

    const result = await service.update(USER, buildRow().id, { archived: true });

    expect(update).toHaveBeenCalledWith(USER.userId, buildRow().id, { archived: true });
    expect(result.archived).toBe(true);
  });

  it('404s when updating an unknown or non-owned notification', async () => {
    const { repo, update } = createRepo();
    update.mockResolvedValue(null);
    const service = new NotificationsService(repo);

    await expect(service.update(USER, buildRow().id, { read: true })).rejects.toBeInstanceOf(
      ResourceNotFoundException,
    );
  });
});
