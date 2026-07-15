/* eslint-disable @typescript-eslint/unbound-method -- jest.Mocked method references in expect() are never invoked */
import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ResourceNotFoundException } from '../common/exceptions/app.exception';
import type { CalendarRepository } from './calendar.repository';
import {
  assertOrderedInterval,
  CalendarService,
  parseInstant,
  resolveListWindow,
  resolveTimeZone,
  toResponseDto,
} from './calendar.service';
import { CalendarEvent } from './entities/calendar-event.entity';

const IL = 'Asia/Jerusalem';

const utc = (iso: string): Date => new Date(iso);

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const event = new CalendarEvent();
  event.id = randomUUID();
  event.title = 'פגישה';
  event.description = null;
  event.startAt = utc('2026-07-15T07:00:00Z');
  event.endAt = utc('2026-07-15T07:50:00Z');
  event.createdAt = utc('2026-07-14T05:00:00Z');
  event.therapistId = randomUUID();
  event.patientId = null;
  return Object.assign(event, overrides);
}

describe('resolveTimeZone', () => {
  it('defaults to Asia/Jerusalem when omitted', () => {
    expect(resolveTimeZone(undefined)).toBe(IL);
  });

  it.each([IL, 'UTC', 'America/New_York', 'Europe/London'])('accepts %s', (zone) => {
    expect(resolveTimeZone(zone)).toBe(zone);
  });

  it.each(['Not/AZone', 'UTC+3', 'Jerusalem', ''])('rejects %j with 400', (zone) => {
    expect(() => resolveTimeZone(zone)).toThrow(BadRequestException);
  });
});

describe('parseInstant', () => {
  it('reads naive values in the requested zone (summer, +03:00)', () => {
    expect(parseInstant('2026-07-15T10:00:00', IL, 'start_at')).toEqual(
      utc('2026-07-15T07:00:00Z'),
    );
  });

  it('reads naive values in the requested zone (winter, +02:00)', () => {
    expect(parseInstant('2026-01-15T10:00:00', IL, 'start_at')).toEqual(
      utc('2026-01-15T08:00:00Z'),
    );
  });

  it('keeps the instant of offset-carrying values', () => {
    expect(parseInstant('2026-07-15T10:00:00+05:00', IL, 'start_at')).toEqual(
      utc('2026-07-15T05:00:00Z'),
    );
    expect(parseInstant('2026-07-15T10:00:00Z', IL, 'start_at')).toEqual(
      utc('2026-07-15T10:00:00Z'),
    );
  });

  it('applies the DST offset in force at the local time (spring forward 2026-03-27)', () => {
    expect(parseInstant('2026-03-26T12:00:00', IL, 'start_at')).toEqual(
      utc('2026-03-26T10:00:00Z'),
    );
    expect(parseInstant('2026-03-28T12:00:00', IL, 'start_at')).toEqual(
      utc('2026-03-28T09:00:00Z'),
    );
  });

  it('rejects impossible timestamps with 400', () => {
    expect(() => parseInstant('2026-02-30T10:00:00', IL, 'start_at')).toThrow(BadRequestException);
    expect(() => parseInstant('not-a-date', IL, 'end_at')).toThrow(BadRequestException);
  });
});

describe('resolveListWindow', () => {
  const wednesday = DateTime.fromISO('2026-07-15T12:00:00', { zone: IL });

  it('defaults to the current Sun–Sat week in the zone', () => {
    const window = resolveListWindow(IL, undefined, undefined, wednesday);
    expect(window.fromAt).toEqual(utc('2026-07-11T21:00:00Z')); // Sun 2026-07-12 00:00 +03:00
    expect(window.toAtExclusive).toEqual(utc('2026-07-18T21:00:00Z')); // Sun 2026-07-19 00:00 +03:00
  });

  it('starts the default week on today when today is Sunday', () => {
    const sunday = DateTime.fromISO('2026-07-12T08:00:00', { zone: IL });
    const window = resolveListWindow(IL, undefined, undefined, sunday);
    expect(window.fromAt).toEqual(utc('2026-07-11T21:00:00Z'));
  });

  it('keeps a Saturday inside the week that began the previous Sunday', () => {
    const saturday = DateTime.fromISO('2026-07-18T08:00:00', { zone: IL });
    const window = resolveListWindow(IL, undefined, undefined, saturday);
    expect(window.fromAt).toEqual(utc('2026-07-11T21:00:00Z'));
  });

  it('resolves the default week from "today" in the requested zone', () => {
    const instant = DateTime.fromISO('2026-07-11T22:00:00Z');
    // Jerusalem is already Sunday 2026-07-12; New York is still Saturday 2026-07-11
    const israelWindow = resolveListWindow(IL, undefined, undefined, instant);
    expect(israelWindow.fromAt).toEqual(utc('2026-07-11T21:00:00Z'));
    const nyWindow = resolveListWindow('America/New_York', undefined, undefined, instant);
    expect(nyWindow.fromAt).toEqual(utc('2026-07-05T04:00:00Z')); // Sun 2026-07-05 00:00 -04:00
  });

  it('derives `to` as from+6d when only `from` is given', () => {
    const window = resolveListWindow(IL, '2026-01-01', undefined);
    expect(window.fromAt).toEqual(utc('2025-12-31T22:00:00Z'));
    expect(window.toAtExclusive).toEqual(utc('2026-01-07T22:00:00Z')); // 2026-01-08 00:00 +02:00
  });

  it('derives `from` as to-6d when only `to` is given', () => {
    const window = resolveListWindow(IL, undefined, '2026-01-07');
    expect(window.fromAt).toEqual(utc('2025-12-31T22:00:00Z'));
    expect(window.toAtExclusive).toEqual(utc('2026-01-07T22:00:00Z'));
  });

  it('treats the window as [from 00:00, day-after-to 00:00) in the zone', () => {
    const window = resolveListWindow('UTC', '2026-05-10', '2026-05-10');
    expect(window.fromAt).toEqual(utc('2026-05-10T00:00:00Z'));
    expect(window.toAtExclusive).toEqual(utc('2026-05-11T00:00:00Z'));
  });

  it('accepts a range of exactly 365 days', () => {
    const window = resolveListWindow(IL, '2026-01-01', '2027-01-01');
    expect(window.toAtExclusive).toEqual(utc('2027-01-01T22:00:00Z'));
  });

  it('rejects a range longer than 365 days with 400', () => {
    expect(() => resolveListWindow(IL, '2026-01-01', '2027-01-02')).toThrow(BadRequestException);
  });

  it('rejects from > to with 400', () => {
    expect(() => resolveListWindow(IL, '2026-07-02', '2026-07-01')).toThrow(BadRequestException);
  });

  it.each([
    ['2026-13-01', undefined],
    [undefined, '2026-02-30'],
    ['26-01-01', undefined],
    ['not-a-date', '2026-07-01'],
  ])('rejects malformed dates (from=%j, to=%j) with 400', (from, to) => {
    expect(() => resolveListWindow(IL, from, to)).toThrow(BadRequestException);
  });

  it('spans the spring DST transition correctly (2026-03-27 02:00 → +03:00)', () => {
    const window = resolveListWindow(IL, '2026-03-26', '2026-03-28');
    expect(window.fromAt).toEqual(utc('2026-03-25T22:00:00Z')); // 00:00 +02:00
    expect(window.toAtExclusive).toEqual(utc('2026-03-28T21:00:00Z')); // 00:00 +03:00
  });

  it('spans the autumn DST transition correctly (2026-10-25 02:00 → +02:00)', () => {
    const window = resolveListWindow(IL, '2026-10-24', '2026-10-26');
    expect(window.fromAt).toEqual(utc('2026-10-23T21:00:00Z')); // 00:00 +03:00
    expect(window.toAtExclusive).toEqual(utc('2026-10-26T22:00:00Z')); // 00:00 +02:00
  });
});

describe('assertOrderedInterval', () => {
  it('accepts a strictly ordered interval', () => {
    expect(() =>
      assertOrderedInterval(new Date('2026-07-15T10:00:00Z'), new Date('2026-07-15T10:50:00Z')),
    ).not.toThrow();
  });

  it('rejects an inverted interval with 400', () => {
    expect(() =>
      assertOrderedInterval(new Date('2026-07-15T10:50:00Z'), new Date('2026-07-15T10:00:00Z')),
    ).toThrow(BadRequestException);
  });

  it('rejects a zero-length interval (end equals start) with 400', () => {
    const instant = new Date('2026-07-15T10:00:00Z');
    expect(() => assertOrderedInterval(instant, new Date(instant))).toThrow(BadRequestException);
  });
});

describe('toResponseDto', () => {
  it('renders snake_case fields with the zone offset', () => {
    const event = makeEvent({ description: 'תיאור', patientId: randomUUID() });
    const dto = toResponseDto(event, IL);
    expect(dto).toEqual({
      id: event.id,
      title: event.title,
      description: 'תיאור',
      start_at: '2026-07-15T10:00:00.000+03:00',
      end_at: '2026-07-15T10:50:00.000+03:00',
      created_at: '2026-07-14T08:00:00.000+03:00',
      therapist_id: event.therapistId,
      patient_id: event.patientId,
    });
  });

  it('renders winter instants with the +02:00 offset', () => {
    const event = makeEvent({ startAt: utc('2026-01-15T08:00:00Z') });
    expect(toResponseDto(event, IL).start_at).toBe('2026-01-15T10:00:00.000+02:00');
  });
});

describe('CalendarService', () => {
  const user: AuthenticatedUser = {
    userId: randomUUID(),
    email: 'a@b.c',
    fullName: null,
    role: 'therapist',
  };

  let repository: jest.Mocked<CalendarRepository>;
  let service: CalendarService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findOverlapping: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new CalendarService(repository);
  });

  describe('create', () => {
    it('stores UTC instants owned by the caller and echoes the zone', async () => {
      const stored = makeEvent({ therapistId: user.userId });
      repository.create.mockResolvedValue(stored);
      const dto = await service.create(user, IL, {
        title: 'פגישה',
        start_at: '2026-07-15T10:00:00',
        end_at: '2026-07-15T10:50:00',
      });
      expect(repository.create).toHaveBeenCalledWith({
        title: 'פגישה',
        description: null,
        startAt: utc('2026-07-15T07:00:00Z'),
        endAt: utc('2026-07-15T07:50:00Z'),
        therapistId: user.userId,
        patientId: null,
      });
      expect(dto.therapist_id).toBe(user.userId);
      expect(dto.start_at).toBe('2026-07-15T10:00:00.000+03:00');
    });

    it('rejects an invalid time_zone before touching the repository', async () => {
      await expect(
        service.create(user, 'Nope/Zone', {
          title: 'x',
          start_at: '2026-07-15T10:00:00',
          end_at: '2026-07-15T10:50:00',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an inverted interval (end before start) with 400', async () => {
      await expect(
        service.create(user, IL, {
          title: 'פגישה',
          start_at: '2026-07-15T10:50:00',
          end_at: '2026-07-15T10:00:00',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('queries the caller-scoped window and maps every event', async () => {
      repository.findOverlapping.mockResolvedValue([makeEvent(), makeEvent()]);
      const result = await service.list(user, { from: '2026-07-12', to: '2026-07-18' });
      expect(repository.findOverlapping).toHaveBeenCalledWith(
        user.userId,
        utc('2026-07-11T21:00:00Z'),
        utc('2026-07-18T21:00:00Z'),
      );
      expect(result).toHaveLength(2);
      expect(result[0].start_at).toBe('2026-07-15T10:00:00.000+03:00');
    });

    it('propagates range errors as 400', async () => {
      await expect(service.list(user, { from: '2026-07-02', to: '2026-07-01' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getById', () => {
    it('returns the mapped event', async () => {
      const stored = makeEvent({ therapistId: user.userId });
      repository.findById.mockResolvedValue(stored);
      const dto = await service.getById(user, stored.id, undefined);
      expect(repository.findById).toHaveBeenCalledWith(user.userId, stored.id);
      expect(dto.id).toBe(stored.id);
    });

    it('maps a missing event to 404', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getById(user, randomUUID(), undefined)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('rejects a body with no updatable field as 400', async () => {
      await expect(service.update(user, randomUUID(), IL, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('converts provided times and passes explicit nulls through', async () => {
      // stored end (12:00 UTC) stays after the new 11:00 local (08:00 UTC) start
      const stored = makeEvent({ therapistId: user.userId, endAt: utc('2026-07-15T12:00:00Z') });
      repository.findById.mockResolvedValue(stored);
      repository.update.mockResolvedValue(stored);
      await service.update(user, stored.id, IL, {
        start_at: '2026-07-15T11:00:00',
        description: null,
        patient_id: null,
      });
      expect(repository.update).toHaveBeenCalledWith(user.userId, stored.id, {
        startAt: utc('2026-07-15T08:00:00Z'),
        description: null,
        patientId: null,
      });
    });

    it('maps a missing event to 404', async () => {
      repository.update.mockResolvedValue(null);
      await expect(service.update(user, randomUUID(), IL, { title: 'חדש' })).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('rejects an inverted interval when both bounds are supplied (400)', async () => {
      const stored = makeEvent({ therapistId: user.userId });
      repository.findById.mockResolvedValue(stored);
      await expect(
        service.update(user, stored.id, IL, {
          start_at: '2026-07-15T11:00:00',
          end_at: '2026-07-15T10:00:00',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects a single-bound update that inverts against the stored event (400)', async () => {
      // stored: 07:00–07:50 UTC; new end 06:00 local (03:00 UTC) precedes the stored start
      const stored = makeEvent({ therapistId: user.userId });
      repository.findById.mockResolvedValue(stored);
      await expect(
        service.update(user, stored.id, IL, { end_at: '2026-07-15T06:00:00' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('accepts a single-bound update that keeps the interval ordered', async () => {
      const stored = makeEvent({ therapistId: user.userId });
      repository.findById.mockResolvedValue(stored);
      repository.update.mockResolvedValue(stored);
      await expect(
        service.update(user, stored.id, IL, { end_at: '2026-07-15T12:00:00' }),
      ).resolves.toBeDefined();
      expect(repository.update).toHaveBeenCalled();
    });

    it('404s a time-changing update when the event is absent', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.update(user, randomUUID(), IL, { start_at: '2026-07-15T11:00:00' }),
      ).rejects.toThrow(ResourceNotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the caller-scoped event', async () => {
      repository.delete.mockResolvedValue(true);
      const id = randomUUID();
      await expect(service.remove(user, id, undefined)).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith(user.userId, id);
    });

    it('maps a missing event to 404', async () => {
      repository.delete.mockResolvedValue(false);
      await expect(service.remove(user, randomUUID(), undefined)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('rejects an invalid time_zone even on delete', async () => {
      await expect(service.remove(user, randomUUID(), 'Bad/Zone')).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
