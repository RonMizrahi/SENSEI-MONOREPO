import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { SEED_EVENTS, SEED_USER } from '../mock/seed';
import { DEFAULT_TIME_ZONE } from './calendar.constants';
import { MockCalendarRepository } from './calendar.repository';

const FAR_PAST = new Date('2000-01-01T00:00:00Z');
const FAR_FUTURE = new Date('2100-01-01T00:00:00Z');

describe('MockCalendarRepository', () => {
  let repository: MockCalendarRepository;

  beforeEach(() => {
    repository = new MockCalendarRepository();
  });

  it('materializes every seed event for the seeded therapist, sorted by start', async () => {
    const events = await repository.findOverlapping(SEED_USER.id, FAR_PAST, FAR_FUTURE);
    expect(events).toHaveLength(SEED_EVENTS.length);
    expect(events.every((event) => event.therapistId === SEED_USER.id)).toBe(true);
    const starts = events.map((event) => event.startAt.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('places seed events at their local hour with the seeded duration', async () => {
    const first = await repository.findById(SEED_USER.id, SEED_EVENTS[0].id);
    expect(first).not.toBeNull();
    if (!first) return;
    const local = DateTime.fromJSDate(first.startAt).setZone(DEFAULT_TIME_ZONE);
    const today = DateTime.now().setZone(DEFAULT_TIME_ZONE).startOf('day');
    expect(local.hour).toBe(SEED_EVENTS[0].startHour);
    expect(local.startOf('day').toISODate()).toBe(
      today.plus({ days: SEED_EVENTS[0].dayOffset }).toISODate(),
    );
    expect(first.endAt.getTime() - first.startAt.getTime()).toBe(
      SEED_EVENTS[0].durationMinutes * 60 * 1000,
    );
  });

  it('creates events retrievable by the owner only', async () => {
    const therapistId = randomUUID();
    const created = await repository.create({
      title: 'בדיקה',
      description: null,
      startAt: new Date('2026-07-15T07:00:00Z'),
      endAt: new Date('2026-07-15T07:50:00Z'),
      therapistId,
      patientId: null,
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(repository.findById(therapistId, created.id)).resolves.toMatchObject({
      title: 'בדיקה',
    });
    await expect(repository.findById(randomUUID(), created.id)).resolves.toBeNull();
  });

  it('applies half-open [from, toExclusive) overlap boundaries', async () => {
    const therapistId = randomUUID();
    const startAt = new Date('2026-07-15T10:00:00Z');
    const endAt = new Date('2026-07-15T11:00:00Z');
    await repository.create({
      title: 'גבולות',
      description: null,
      startAt,
      endAt,
      therapistId,
      patientId: null,
    });
    // window ends exactly at the event start → excluded
    await expect(repository.findOverlapping(therapistId, FAR_PAST, startAt)).resolves.toHaveLength(
      0,
    );
    // window starts exactly at the event end → excluded
    await expect(repository.findOverlapping(therapistId, endAt, FAR_FUTURE)).resolves.toHaveLength(
      0,
    );
    // window starts exactly at the event start → included
    await expect(
      repository.findOverlapping(therapistId, startAt, FAR_FUTURE),
    ).resolves.toHaveLength(1);
    // partial overlap on each side → included
    await expect(
      repository.findOverlapping(therapistId, new Date('2026-07-15T10:30:00Z'), FAR_FUTURE),
    ).resolves.toHaveLength(1);
    await expect(
      repository.findOverlapping(therapistId, FAR_PAST, new Date('2026-07-15T10:30:00Z')),
    ).resolves.toHaveLength(1);
  });

  it('scopes update and delete to the owning therapist', async () => {
    const therapistId = randomUUID();
    const created = await repository.create({
      title: 'שלי',
      description: null,
      startAt: new Date('2026-07-15T07:00:00Z'),
      endAt: new Date('2026-07-15T07:50:00Z'),
      therapistId,
      patientId: null,
    });
    await expect(repository.update(randomUUID(), created.id, { title: 'גנוב' })).resolves.toBeNull();
    await expect(repository.delete(randomUUID(), created.id)).resolves.toBe(false);
    const updated = await repository.update(therapistId, created.id, {
      title: 'עודכן',
      description: 'חדש',
    });
    expect(updated).toMatchObject({ title: 'עודכן', description: 'חדש' });
    await expect(repository.delete(therapistId, created.id)).resolves.toBe(true);
    await expect(repository.findById(therapistId, created.id)).resolves.toBeNull();
  });

  it('returns null/false for unknown ids', async () => {
    await expect(repository.findById(SEED_USER.id, randomUUID())).resolves.toBeNull();
    await expect(repository.update(SEED_USER.id, randomUUID(), { title: 'x' })).resolves.toBeNull();
    await expect(repository.delete(SEED_USER.id, randomUUID())).resolves.toBe(false);
  });
});
