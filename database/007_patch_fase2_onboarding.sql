ALTER TABLE cohab_profiles ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE cohab_profiles ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE cohab_family_members ADD COLUMN IF NOT EXISTS birthdate DATE;
