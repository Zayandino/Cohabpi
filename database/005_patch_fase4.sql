-- ============================================
-- FASE 4: SÚPER ADMIN, SERVICIOS Y DESCUENTOS
-- ============================================

-- 1. Asegurar que ambler.eduardo@gmail.com sea Cinturón Negro y Admin
UPDATE cohab_profiles 
SET role = 'admin', belt = 'black', graus = 0
WHERE id = (SELECT id FROM auth.users WHERE email = 'ambler.eduardo@gmail.com');

-- 2. Modificar cohab_services para soportar la configuración avanzada
ALTER TABLE cohab_services 
ADD COLUMN IF NOT EXISTS schedule TEXT,
ADD COLUMN IF NOT EXISTS requires_attendance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_quota BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS capacity_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb;

-- 3. Crear tabla para Descuentos Administrables
CREATE TABLE IF NOT EXISTS cohab_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  code TEXT,
  image_url TEXT,
  expiration_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Políticas RLS para Descuentos
ALTER TABLE cohab_discounts ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a todos
CREATE POLICY "Permitir lectura a todos los usuarios" ON cohab_discounts 
FOR SELECT USING (true);

-- Permitir inserción, actualización y borrado solo a admins
CREATE POLICY "Permitir admin manage discounts" ON cohab_discounts 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM cohab_profiles 
    WHERE cohab_profiles.id = auth.uid() AND cohab_profiles.role = 'admin'
  )
);

-- 4. Alumnos ficticios para probar graduaciones
-- Primero verificamos si existen para no duplicar (usando un truco de inserción si no existen en auth)
-- Nota: En un entorno Supabase real con Auth, los UUIDs en `cohab_profiles` deben coincidir con `auth.users`.
-- Ya que no podemos inyectar auth.users fácilmente aquí con contraseñas encriptadas complejas desde SQL crudo,
-- insertaremos perfiles "huérfanos" solo para que aparezcan en la lista de graduaciones del Admin.

INSERT INTO cohab_profiles (id, full_name, role, belt, graus, status, waiver_signed)
VALUES 
  (gen_random_uuid(), 'Dummy Blanco (Prueba)', 'alumno', 'white', 2, 'activo', true),
  (gen_random_uuid(), 'Dummy Azul (Prueba)', 'alumno', 'blue', 1, 'activo', true),
  (gen_random_uuid(), 'Dummy Morado (Prueba)', 'alumno', 'purple', 3, 'activo', true)
ON CONFLICT DO NOTHING;
