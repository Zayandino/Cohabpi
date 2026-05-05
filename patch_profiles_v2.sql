-- 1. Añadir link_url a cohab_news
ALTER TABLE cohab_news 
ADD COLUMN IF NOT EXISTS link_url TEXT;

-- 2. Añadir campos de onboarding a cohab_profiles
ALTER TABLE cohab_profiles 
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS waiver_signed BOOLEAN DEFAULT false;
