-- 0008_seed_demo_notifications.sql — the 9 demo notifications (GATED).
-- Parity with the SPA's data/catalogs.ts NOTIFS. Gated by app.seed_demo (0 rows in
-- production). read/archived state mirrors the mock's notifRead/notifArchived. p5
-- (נועה שפירא) has no patient row, so patient_id is NULL (the name lives in body).
-- created_at is spaced so the list orders newest-first; the bucket + relative time
-- shown in the UI come from group_label / display_time.

INSERT INTO notifications
    (id, therapist_id, kind, patient_id, title, body, group_label, display_time, read_at, archived_at, created_at)
SELECT
    v.id::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    v.kind,
    v.patient_id::uuid,
    v.title,
    v.body,
    v.group_label,
    v.display_time,
    CASE WHEN v.is_read THEN now() ELSE NULL END,
    CASE WHEN v.is_archived THEN now() ELSE NULL END,
    now() - (v.seq || ' hours')::interval
FROM (VALUES
    ('00000000-0000-4000-8000-0000000000c1', 'summary',  '00000000-0000-4000-8000-0000000000a3', 'סיכום AI מוכן',    'ניתוח הפגישה של מיכל כהן הושלם וזמין לצפייה',       'היום',  'לפני 8 דק׳',    false, false, 0),
    ('00000000-0000-4000-8000-0000000000c2', 'risk',     NULL,                                   'דגל סיכון חדש',    'זוהו סימני אזהרה בפגישה של נועה שפירא',              'היום',  'לפני 40 דק׳',   false, false, 1),
    ('00000000-0000-4000-8000-0000000000c3', 'reminder', '00000000-0000-4000-8000-0000000000a1', 'פגישה מתקרבת',     'דנה לוי · פגישה שבועית בשעה 09:00',                  'היום',  'היום 09:00',    false, false, 2),
    ('00000000-0000-4000-8000-0000000000c4', 'summary',  '00000000-0000-4000-8000-0000000000a2', 'סיכום AI מוכן',    'ניתוח הפגישה של יוסי מזרחי הושלם',                   'היום',  'לפני 3 שעות',   false, false, 3),
    ('00000000-0000-4000-8000-0000000000c5', 'reminder', '00000000-0000-4000-8000-0000000000a4', 'תזכורת מסמך',      'טופס הסכמה מדעת ממתין לחתימת אבי פרץ',               'אתמול', 'אתמול 11:05',   false, false, 24),
    ('00000000-0000-4000-8000-0000000000c6', 'risk',     '00000000-0000-4000-8000-0000000000a3', 'רמת סיכון עודכנה', 'רמת הסיכון של מיכל כהן עלתה לרמה גבוהה',             'אתמול', 'אתמול 09:30',   false, false, 27),
    ('00000000-0000-4000-8000-0000000000c7', 'system',   NULL,                                   'עדכון מערכת',      'גרסה 2.4: שיפורי תמלול ודוחות חדשים זמינים',        'קודם',  'לפני יומיים',   true,  false, 48),
    ('00000000-0000-4000-8000-0000000000c8', 'summary',  '00000000-0000-4000-8000-0000000000a1', 'סיכום AI מוכן',    'ניתוח הפגישה של דנה לוי הושלם',                      'קודם',  'לפני 4 ימים',   true,  false, 96),
    ('00000000-0000-4000-8000-0000000000c9', 'reminder', '00000000-0000-4000-8000-0000000000a2', 'פגישה בוטלה',      'הפגישה עם יוסי מזרחי בתאריך 20.06 בוטלה',            'קודם',  'לפני שבוע',     true,  true,  168)
) AS v(id, kind, patient_id, title, body, group_label, display_time, is_read, is_archived, seq)
WHERE current_setting('app.seed_demo', true) = 'true'
ON CONFLICT (id) DO NOTHING;
