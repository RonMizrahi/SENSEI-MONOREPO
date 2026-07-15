-- 0011_report_questions_and_notes.sql — prep-report questions + clinical notes.
-- Adds the SPA's prep-report "suggested questions" to patient_reports, and a
-- per-therapist-per-patient free-text clinical note (the SPA notesOverrides home,
-- also the source text the generated clinical letter uses).

ALTER TABLE patient_reports ADD COLUMN questions jsonb NOT NULL DEFAULT '[]';

CREATE TABLE patient_notes (
    therapist_id uuid        NOT NULL REFERENCES users (id),
    patient_id   uuid        NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    body         text        NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (therapist_id, patient_id)
);
