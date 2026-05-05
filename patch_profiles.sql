-- =====================================================
-- PARCHE DE BASE DE DATOS: FAMILIARES COMO PERFILES
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Eliminar Constraint estricta de auth.users si existe (dependiendo del nombre del constraint)
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'cohab_profiles' AND column_name = 'id'
      AND position_in_unique_constraint IS NOT NULL
      AND constraint_catalog = current_database();

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.cohab_profiles DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

-- 2. Modificar la columna ID para que tenga default gen_random_uuid()
ALTER TABLE public.cohab_profiles
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Añadir columnas parent_id y relationship
ALTER TABLE public.cohab_profiles
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.cohab_profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS relationship TEXT;

-- 4. Modificar RLS de cohab_profiles para permitir acceso de los "padres" (titulares)
DROP POLICY IF EXISTS "profiles_select" ON public.cohab_profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.cohab_profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.cohab_profiles;

CREATE POLICY "profiles_select" ON public.cohab_profiles
  FOR SELECT USING (id = auth.uid() OR parent_id = auth.uid() OR public.cohab_is_admin());

CREATE POLICY "profiles_insert" ON public.cohab_profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR parent_id = auth.uid());

CREATE POLICY "profiles_update" ON public.cohab_profiles
  FOR UPDATE USING (id = auth.uid() OR parent_id = auth.uid() OR public.cohab_is_admin());

-- 5. Las referencias (Foreign Keys) en cohab_payments, cohab_subscriptions, y cohab_attendance siguen funcionando igual
-- pues apuntan a cohab_profiles(id).
