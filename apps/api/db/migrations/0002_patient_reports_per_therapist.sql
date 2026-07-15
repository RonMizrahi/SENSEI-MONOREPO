-- 0002_patient_reports_per_therapist.sql — scope each prep report to a therapist.
-- patient_reports was UNIQUE(patient_id): one row per patient, so two therapists
-- sharing a patient collided on it (cross-therapist IDOR). Add therapist_id, key
-- the row on (patient_id, therapist_id), and drop the patient-only unique index.

ALTER TABLE patient_reports ADD COLUMN therapist_id uuid;

-- Backfill existing rows from the patient's earliest owning meeting, then drop any
-- report we cannot attribute to a therapist before enforcing NOT NULL.
UPDATE patient_reports pr
SET therapist_id = (
    SELECT ce.therapist_id
    FROM calendar_events ce
    WHERE ce.patient_id = pr.patient_id
    ORDER BY ce.start_at
    LIMIT 1
)
WHERE therapist_id IS NULL;

DELETE FROM patient_reports WHERE therapist_id IS NULL;

ALTER TABLE patient_reports ALTER COLUMN therapist_id SET NOT NULL;

-- Replace the patient-only unique constraint with the composite one.
ALTER TABLE patient_reports DROP CONSTRAINT patient_reports_patient_id_key;
ALTER TABLE patient_reports
    ADD CONSTRAINT patient_reports_patient_therapist_key UNIQUE (patient_id, therapist_id);

ALTER TABLE patient_reports
    ADD CONSTRAINT patient_reports_therapist_fk FOREIGN KEY (therapist_id) REFERENCES users (id);
