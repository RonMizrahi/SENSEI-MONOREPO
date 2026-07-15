-- 0003_seed_demo_prototype.sql — demo/prototype seed (credential-free).
-- Ports the patient roster from the MOCK_MODE world (src/mock/seed.ts) into the
-- real `patients` table so a real-DB deployment carries the familiar demo roster.
--
-- Deliberately seeds NO user and NO calendar events:
--   * No user  → this migration contains no credentials (the demo login is unused;
--                the SPA runs on its own demo data, and the API's auth isn't wired
--                into this prototype).
--   * No events → calendar_events.therapist_id is a NOT NULL FK to users, so events
--                 cannot exist without a seeded owner, and would be unviewable
--                 anyway (every data route is JWT-guarded).
-- patients are not therapist-scoped, so they need no owner and carry no secret.
--
-- DATA seed, not a schema change. Idempotent via ON CONFLICT — re-applying is a no-op.

INSERT INTO patients (id, name, phone, email, archived, created_at) VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'דנה לוי',   '054-1234567', 'dana.l@mail.com',   false, '2025-01-15T10:00:00Z'),
    ('00000000-0000-4000-8000-0000000000a2', 'יוסי מזרחי', '052-7654321', 'yossi.m@mail.com',  false, '2024-09-01T10:00:00Z'),
    ('00000000-0000-4000-8000-0000000000a3', 'מיכל כהן',   '053-9988776', 'michal.c@mail.com', false, '2026-02-01T10:00:00Z'),
    ('00000000-0000-4000-8000-0000000000a4', 'אבי פרץ',    '054-3322110', 'avi.p@mail.com',    false, '2024-06-01T10:00:00Z')
ON CONFLICT (id) DO NOTHING;
