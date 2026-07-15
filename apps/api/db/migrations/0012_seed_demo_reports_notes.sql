-- 0012_seed_demo_reports_notes.sql — a ready prep report + clinical note per patient (GATED).
-- Parity with the SPA's data/reportContent.ts (intro/changes/open_topics/questions) and the
-- LetterPage default note. changes/open_topics/questions are identical across patients; only
-- the intro injects the patient name. Gated by app.seed_demo.

INSERT INTO patient_reports
    (patient_id, therapist_id, status, intro, changes, open_topics, questions, source_meeting_ids, generated_at, model)
SELECT
    v.patient_id::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    'ready',
    v.name || ' נמצא/ת במגמת שיפור כללית. בפגישה האחרונה הודגמה התקדמות משמעותית ביישום כלי הוויסות. להלן הנקודות המרכזיות לקראת הפגישה הבאה.',
    '["שיפור ניכר ביכולת השימוש העצמאי בטכניקות הרגעה ברגעי לחץ","דיווח על אירוע התמודדות מוצלח (הצגה בעבודה). חוויית מסוגלות ראשונה מסוגה","עלייה קלה בחשש מאירועים עתידיים שדורשת מעקב"]'::jsonb,
    '["עיבוד הפחד מ\"הפעם הבאה\" וביסוס תחושת המסוגלות","בחינת דפוסי שינה בתקופות לחץ","הרחבת רשת התמיכה החברתית"]'::jsonb,
    '["מאז שנפגשנו, היה רגע שבו הצלחת לעצור ולהשתמש באחד הכלים שתרגלנו?","כשאתה חושב על הפגישה הקרובה, מה הכי חשוב לך שנספיק לגעת בו?"]'::jsonb,
    '[]'::jsonb,
    now(),
    'demo'
FROM (VALUES
    ('00000000-0000-4000-8000-0000000000a1', 'דנה לוי'),
    ('00000000-0000-4000-8000-0000000000a2', 'יוסי מזרחי'),
    ('00000000-0000-4000-8000-0000000000a3', 'מיכל כהן'),
    ('00000000-0000-4000-8000-0000000000a4', 'אבי פרץ')
) AS v(patient_id, name)
WHERE current_setting('app.seed_demo', true) = 'true'
ON CONFLICT ON CONSTRAINT patient_reports_patient_therapist_key DO NOTHING;

INSERT INTO patient_notes (therapist_id, patient_id, body)
SELECT
    '00000000-0000-4000-8000-000000000001'::uuid,
    v.patient_id::uuid,
    'מטופל בטיפול. מוטיבציה גבוהה ושיתוף פעולה. הומלץ על המשך מעקב שבועי ועבודה על כלי ויסות.'
FROM (VALUES
    ('00000000-0000-4000-8000-0000000000a1'),
    ('00000000-0000-4000-8000-0000000000a2'),
    ('00000000-0000-4000-8000-0000000000a3'),
    ('00000000-0000-4000-8000-0000000000a4')
) AS v(patient_id)
WHERE current_setting('app.seed_demo', true) = 'true'
ON CONFLICT (therapist_id, patient_id) DO NOTHING;
