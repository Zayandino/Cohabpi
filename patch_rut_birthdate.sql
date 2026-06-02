-- 1. Agregar la columna 'rut' a la tabla 'cohab_profiles' si no existe
ALTER TABLE public.cohab_profiles 
  ADD COLUMN IF NOT EXISTS rut text;

-- 2. Agregar la columna 'birthdate' a la tabla 'cohab_profiles' si no existe
ALTER TABLE public.cohab_profiles 
  ADD COLUMN IF NOT EXISTS birthdate date;

-- 3. Recargar la caché del esquema de Supabase para que reconozca las nuevas columnas
NOTIFY pgrst, 'reload schema';
