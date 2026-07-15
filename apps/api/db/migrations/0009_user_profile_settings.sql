-- 0009_user_profile_settings.sql — therapist profile columns + preferences table.
-- The SPA settings/ProfileTab edits phone/gender/title/license/org/bio/avatar colour
-- (localStorage today); user_settings stores the a11y/notif/appearance/security prefs
-- as one opaque JSON blob the SPA owns the shape of.

ALTER TABLE users
    ADD COLUMN phone          varchar(64),
    ADD COLUMN gender         varchar(8),
    ADD COLUMN title          varchar(255),
    ADD COLUMN license_number varchar(64),
    ADD COLUMN org            varchar(255),
    ADD COLUMN bio            text,
    ADD COLUMN avatar_color   varchar(16);

CREATE TABLE user_settings (
    user_id     uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    preferences jsonb       NOT NULL DEFAULT '{}',
    updated_at  timestamptz NOT NULL DEFAULT now()
);
