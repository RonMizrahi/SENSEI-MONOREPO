-- 0001_init.sql — Sensei initial schema (port of senseiAPI + patient_reports).
-- Applied by the boot-time SQL runner (src/db) inside a transaction and recorded
-- in _migrations. Idempotence comes from the runner, not from IF NOT EXISTS.

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_type     varchar(64)  NOT NULL,
    role          varchar(64)  NOT NULL,
    email         varchar(255) NOT NULL UNIQUE,
    full_name     varchar(255),
    password_hash varchar(512) NOT NULL,
    token_version integer      NOT NULL DEFAULT 0,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE patients (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       varchar(255) NOT NULL,
    phone      varchar(32)  NOT NULL,
    email      varchar(255),
    archived   boolean      NOT NULL DEFAULT false,
    created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE calendar_events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title        varchar(255)  NOT NULL,
    description  varchar(2000),
    start_at     timestamptz   NOT NULL,
    end_at       timestamptz   NOT NULL,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    therapist_id uuid          NOT NULL REFERENCES users (id),
    patient_id   uuid          REFERENCES patients (id)
);

CREATE INDEX ix_calendar_events_therapist_start_at ON calendar_events (therapist_id, start_at);
CREATE INDEX ix_calendar_events_therapist_end_at ON calendar_events (therapist_id, end_at);

CREATE TABLE transcripts (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id         uuid        NOT NULL UNIQUE REFERENCES calendar_events (id) ON DELETE CASCADE,
    raw_text           text        NOT NULL,
    diarized_segments  jsonb       NOT NULL DEFAULT '[]',
    language           varchar(16) NOT NULL DEFAULT 'he',
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meeting_summaries (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid        NOT NULL UNIQUE REFERENCES calendar_events (id) ON DELETE CASCADE,
    status     varchar(16) NOT NULL DEFAULT 'pending',
    text       text,
    model      varchar(64) NOT NULL DEFAULT '',
    error      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patient_reports (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id           uuid        NOT NULL UNIQUE REFERENCES patients (id) ON DELETE CASCADE,
    status               varchar(16) NOT NULL DEFAULT 'pending',
    intro                text,
    changes              jsonb       NOT NULL DEFAULT '[]',
    open_topics          jsonb       NOT NULL DEFAULT '[]',
    source_meeting_ids   jsonb       NOT NULL DEFAULT '[]',
    last_summary_excerpt text,
    generated_at         timestamptz,
    model                varchar(64) NOT NULL DEFAULT '',
    error                text,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);
