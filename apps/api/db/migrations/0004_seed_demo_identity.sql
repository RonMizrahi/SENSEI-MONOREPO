-- 0004_seed_demo_identity.sql — demo therapist + upcoming appointments (GATED).
-- Materializes the SPA mock's identity + `buildMockScheduledAppts` (8 upcoming
-- meetings) so the app renders real backend data. Every insert is guarded by the
-- transaction-local `app.seed_demo` GUC (set by MigrationRunnerService from
-- SEED_DEMO_DATA): when off, this file applies and is tracked but inserts 0 rows,
-- keeping production clean. Idempotent via ON CONFLICT.

-- Demo therapist — login rotem@clinic.co.il / demo1234 (argon2id, OWASP params).
-- Fixed UUID so the SPA's auto-login owns every therapist-scoped seed row.
INSERT INTO users (id, auth_type, role, email, full_name, password_hash, token_version)
SELECT
    '00000000-0000-4000-8000-000000000001',
    'password',
    'therapist',
    'rotem@clinic.co.il',
    'ד״ר רותם שגב',
    '$argon2id$v=19$m=19456,t=2,p=1$/nerikj2vEFLs06ML4VpGw$JcWoRTHnyHxCGefwEB8BTxKpDlbDhvWh7rYtz6hRRJY',
    0
WHERE current_setting('app.seed_demo', true) = 'true'
ON CONFLICT (id) DO NOTHING;

-- 8 upcoming appointments (parity with buildMockScheduledAppts). title carries the
-- category phrase the SPA's categoryOf() keys on (שבועית→weekly, מעקב→followup,
-- וידאו→video). Times are Israel wall-clock, anchored to the apply date + day offset.
INSERT INTO calendar_events (id, title, description, start_at, end_at, therapist_id, patient_id)
SELECT
    v.id::uuid,
    v.title,
    NULL,
    (CURRENT_DATE + (v.day_offset || ' days')::interval + v.at::interval)
        AT TIME ZONE 'Asia/Jerusalem',
    (CURRENT_DATE + (v.day_offset || ' days')::interval + v.at::interval + interval '50 minutes')
        AT TIME ZONE 'Asia/Jerusalem',
    '00000000-0000-4000-8000-000000000001'::uuid,
    v.patient_id::uuid
FROM (VALUES
    ('00000000-0000-4000-8000-0000000000f1', 'פגישה שבועית', 1,  '09:00', '00000000-0000-4000-8000-0000000000a1'),
    ('00000000-0000-4000-8000-0000000000f2', 'פגישת מעקב',   8,  '13:00', '00000000-0000-4000-8000-0000000000a1'),
    ('00000000-0000-4000-8000-0000000000f3', 'פגישה שבועית', 2,  '10:00', '00000000-0000-4000-8000-0000000000a2'),
    ('00000000-0000-4000-8000-0000000000f4', 'פגישת מעקב',   9,  '15:00', '00000000-0000-4000-8000-0000000000a2'),
    ('00000000-0000-4000-8000-0000000000f5', 'פגישה שבועית', 3,  '11:00', '00000000-0000-4000-8000-0000000000a3'),
    ('00000000-0000-4000-8000-0000000000f6', 'פגישת וידאו',  10, '09:30', '00000000-0000-4000-8000-0000000000a3'),
    ('00000000-0000-4000-8000-0000000000f7', 'פגישת מעקב',   4,  '12:00', '00000000-0000-4000-8000-0000000000a4'),
    ('00000000-0000-4000-8000-0000000000f8', 'פגישה שבועית', 11, '16:00', '00000000-0000-4000-8000-0000000000a4')
) AS v(id, title, day_offset, at, patient_id)
WHERE current_setting('app.seed_demo', true) = 'true'
ON CONFLICT (id) DO NOTHING;
