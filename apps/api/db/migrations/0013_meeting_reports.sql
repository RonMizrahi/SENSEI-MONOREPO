-- 0013_meeting_reports.sql — per-meeting prep reports on patient_reports.
-- Adds a per-meeting prep report alongside the existing per-patient "next-meeting"
-- report WITHOUT breaking it: the next-meeting report is now the row with
-- meeting_id IS NULL, and each specific meeting gets its own row keyed by meeting_id.
-- The single composite UNIQUE(patient_id, therapist_id) can no longer hold (a patient
-- would then be limited to one report total), so it is replaced by two partial unique
-- indexes that let the next-meeting row and the per-meeting rows coexist.

ALTER TABLE patient_reports ADD COLUMN meeting_id uuid;

-- Drop the single composite key — replaced by the two partial unique indexes below.
ALTER TABLE patient_reports DROP CONSTRAINT patient_reports_patient_therapist_key;

-- Exactly one next-meeting (per-patient) report per (patient, therapist).
CREATE UNIQUE INDEX patient_reports_next_meeting_key
    ON patient_reports (patient_id, therapist_id)
    WHERE meeting_id IS NULL;

-- Exactly one report per specific meeting per (patient, therapist).
CREATE UNIQUE INDEX patient_reports_per_meeting_key
    ON patient_reports (patient_id, therapist_id, meeting_id)
    WHERE meeting_id IS NOT NULL;

CREATE INDEX ix_patient_reports_meeting_id ON patient_reports (meeting_id);
