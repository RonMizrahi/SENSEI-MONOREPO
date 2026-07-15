-- 0007_notifications.sql — therapist-scoped notification center (new table).
-- Backs the SPA notifications page: summary/risk/reminder/system items with a
-- display bucket + relative time string, and read/archived state as timestamps.

CREATE TABLE notifications (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id uuid         NOT NULL REFERENCES users (id),
    kind         varchar(32)  NOT NULL,
    patient_id   uuid         REFERENCES patients (id),
    title        varchar(255) NOT NULL,
    body         text         NOT NULL,
    group_label  varchar(32)  NOT NULL,
    display_time varchar(64)  NOT NULL,
    read_at      timestamptz,
    archived_at  timestamptz,
    created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX ix_notifications_therapist_created ON notifications (therapist_id, created_at DESC);
