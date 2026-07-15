-- 0010_seed_demo_profile.sql — demo therapist profile + preferences (GATED).
-- Parity with the SPA seed.ts `profile` + a11y/notifPrefs/appearance/security blobs.
-- Guarded by app.seed_demo, so production writes nothing.

UPDATE users SET
    phone          = '050-123-4567',
    gender         = 'f',
    title          = 'פסיכולוגית קלינית',
    license_number = '27-104882',
    org            = 'מרפאת סנסיי · תל אביב',
    bio            = '',
    avatar_color   = '#1F63D6'
WHERE id = '00000000-0000-4000-8000-000000000001'
  AND current_setting('app.seed_demo', true) = 'true';

INSERT INTO user_settings (user_id, preferences)
SELECT
    '00000000-0000-4000-8000-000000000001'::uuid,
    '{
      "a11y": {"textSize":"default","contrast":"normal","reduceMotion":false,"strongFocus":false,"reading":"default","underlineLinks":false},
      "notifPrefs": {"channels":{"inapp":true,"email":true,"sms":false,"push":true},"frequency":"instant","digestTime":"18:00","quiet":true,"quietFrom":"21:00","quietTo":"07:00"},
      "appearance": {"theme":"light","themePref":"system"},
      "security": {"twoFA":false,"sessionTimeout":"30","retainAudio":false}
    }'::jsonb
WHERE current_setting('app.seed_demo', true) = 'true'
ON CONFLICT (user_id) DO NOTHING;
