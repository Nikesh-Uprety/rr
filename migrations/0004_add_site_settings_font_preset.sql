ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS font_preset varchar(50) DEFAULT 'inter';

UPDATE site_settings
SET font_preset = 'inter'
WHERE font_preset IS NULL;
