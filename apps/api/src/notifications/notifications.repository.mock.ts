import { Injectable } from '@nestjs/common';
import { SEED_PATIENTS, SEED_USER } from '../mock/seed';
import { Notification, type NotificationKind } from './entities/notification.entity';
import {
  notificationTimestampPatch,
  type NotificationsRepositoryContract,
  type UpdateNotificationFields,
} from './notifications.repository';

/** Seed row shape (mirrors db/migrations/0008 for MOCK_MODE parity). */
interface SeedNotification {
  id: string;
  kind: NotificationKind;
  patientIndex: number | null;
  title: string;
  body: string;
  groupLabel: string;
  displayTime: string;
  read: boolean;
  archived: boolean;
}

/** The 9 demo notifications — parity with the SPA's data/catalogs.ts NOTIFS. */
const SEED_NOTIFICATIONS: SeedNotification[] = [
  { id: '00000000-0000-4000-8000-0000000000c1', kind: 'summary', patientIndex: 2, title: 'סיכום AI מוכן', body: 'ניתוח הפגישה של מיכל כהן הושלם וזמין לצפייה', groupLabel: 'היום', displayTime: 'לפני 8 דק׳', read: false, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c2', kind: 'risk', patientIndex: null, title: 'דגל סיכון חדש', body: 'זוהו סימני אזהרה בפגישה של נועה שפירא', groupLabel: 'היום', displayTime: 'לפני 40 דק׳', read: false, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c3', kind: 'reminder', patientIndex: 0, title: 'פגישה מתקרבת', body: 'דנה לוי · פגישה שבועית בשעה 09:00', groupLabel: 'היום', displayTime: 'היום 09:00', read: false, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c4', kind: 'summary', patientIndex: 1, title: 'סיכום AI מוכן', body: 'ניתוח הפגישה של יוסי מזרחי הושלם', groupLabel: 'היום', displayTime: 'לפני 3 שעות', read: false, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c5', kind: 'reminder', patientIndex: 3, title: 'תזכורת מסמך', body: 'טופס הסכמה מדעת ממתין לחתימת אבי פרץ', groupLabel: 'אתמול', displayTime: 'אתמול 11:05', read: false, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c6', kind: 'risk', patientIndex: 2, title: 'רמת סיכון עודכנה', body: 'רמת הסיכון של מיכל כהן עלתה לרמה גבוהה', groupLabel: 'אתמול', displayTime: 'אתמול 09:30', read: false, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c7', kind: 'system', patientIndex: null, title: 'עדכון מערכת', body: 'גרסה 2.4: שיפורי תמלול ודוחות חדשים זמינים', groupLabel: 'קודם', displayTime: 'לפני יומיים', read: true, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c8', kind: 'summary', patientIndex: 0, title: 'סיכום AI מוכן', body: 'ניתוח הפגישה של דנה לוי הושלם', groupLabel: 'קודם', displayTime: 'לפני 4 ימים', read: true, archived: false },
  { id: '00000000-0000-4000-8000-0000000000c9', kind: 'reminder', patientIndex: 1, title: 'פגישה בוטלה', body: 'הפגישה עם יוסי מזרחי בתאריך 20.06 בוטלה', groupLabel: 'קודם', displayTime: 'לפני שבוע', read: true, archived: true },
];

/** MOCK_MODE notifications store — in-memory, pre-seeded for the demo therapist. */
@Injectable()
export class MockNotificationsRepository implements NotificationsRepositoryContract {
  private readonly rows: Notification[] = SEED_NOTIFICATIONS.map((seed, index) => {
    const row = new Notification();
    row.id = seed.id;
    row.therapistId = SEED_USER.id;
    row.kind = seed.kind;
    row.patientId = seed.patientIndex === null ? null : SEED_PATIENTS[seed.patientIndex].id;
    row.title = seed.title;
    row.body = seed.body;
    row.groupLabel = seed.groupLabel;
    row.displayTime = seed.displayTime;
    row.readAt = seed.read ? new Date() : null;
    row.archivedAt = seed.archived ? new Date() : null;
    // Newest first: earlier seed entries are more recent.
    row.createdAt = new Date(Date.now() - index * 60_000);
    return row;
  });

  /** Lists the therapist's notifications, newest first. */
  findAllForTherapist(therapistId: string): Promise<Notification[]> {
    const owned = this.rows.filter((row) => row.therapistId === therapistId);
    return Promise.resolve([...owned].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }

  /** Applies read/archived toggles for a therapist-owned notification (null when not found). */
  update(
    therapistId: string,
    id: string,
    fields: UpdateNotificationFields,
  ): Promise<Notification | null> {
    const row = this.rows.find((item) => item.id === id && item.therapistId === therapistId);
    if (!row) return Promise.resolve(null);
    const patch = notificationTimestampPatch(fields, new Date());
    if (patch.readAt !== undefined) row.readAt = patch.readAt;
    if (patch.archivedAt !== undefined) row.archivedAt = patch.archivedAt;
    return Promise.resolve(row);
  }
}
