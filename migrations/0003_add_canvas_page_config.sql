CREATE TABLE IF NOT EXISTS page_templates (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  slug varchar(100) NOT NULL UNIQUE,
  description text,
  thumbnail_url text,
  tier varchar(20) NOT NULL DEFAULT 'free',
  price_npr integer NOT NULL DEFAULT 0,
  is_purchased boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_sections (
  id serial PRIMARY KEY,
  template_id integer NOT NULL,
  section_type varchar(50) NOT NULL,
  label varchar(100),
  order_index integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'page_sections_template_id_page_templates_id_fk'
  ) THEN
    ALTER TABLE page_sections
      ADD CONSTRAINT page_sections_template_id_page_templates_id_fk
      FOREIGN KEY (template_id)
      REFERENCES page_templates(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS site_settings (
  id serial PRIMARY KEY,
  active_template_id integer,
  published_at timestamp,
  published_by varchar,
  updated_at timestamp DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_settings_published_by_users_id_fk'
  ) THEN
    ALTER TABLE site_settings
      DROP CONSTRAINT site_settings_published_by_users_id_fk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'site_settings'
      AND column_name = 'published_by'
      AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE site_settings
      ALTER COLUMN published_by TYPE varchar
      USING published_by::varchar;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_settings_active_template_id_page_templates_id_fk'
  ) THEN
    ALTER TABLE site_settings
      ADD CONSTRAINT site_settings_active_template_id_page_templates_id_fk
      FOREIGN KEY (active_template_id)
      REFERENCES page_templates(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_settings_published_by_users_id_fk'
  ) THEN
    ALTER TABLE site_settings
      ADD CONSTRAINT site_settings_published_by_users_id_fk
      FOREIGN KEY (published_by)
      REFERENCES users(id);
  END IF;
END $$;
