ALTER TABLE media_assets
  ADD COLUMN folder_path text,
  ADD COLUMN asset_type text NOT NULL DEFAULT 'file',
  ADD COLUMN expires_at timestamp with time zone,
  ALTER COLUMN url DROP NOT NULL;
