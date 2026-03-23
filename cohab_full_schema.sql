-- =====================================================
-- COHAB LOS ANDES — ESQUEMA COMPLETO DE BASE DE DATOS
-- Ejecutar en Supabase SQL Editor de la nueva instancia
-- =====================================================

-- =====================================================
-- 1. CREACIÓN DE TABLAS PRINCIPALES
-- =====================================================

-- Tabla de Perfiles (Usuarios)
CREATE TABLE IF NOT EXISTS cohab_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  belt TEXT DEFAULT 'No Belt',
  status TEXT DEFAULT 'activo',
  role TEXT DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Servicios/Planes
CREATE TABLE IF NOT EXISTS cohab_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly',
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Suscripciones
CREATE TABLE IF NOT EXISTS cohab_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES cohab_profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES cohab_services(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Pagos
CREATE TABLE IF NOT EXISTS cohab_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES cohab_profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Familiares
CREATE TABLE IF NOT EXISTS cohab_family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES cohab_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  birthdate DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de Asistencia / Check-in
CREATE TABLE IF NOT EXISTS cohab_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES cohab_profiles(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ DEFAULT now(),
  class_type TEXT DEFAULT 'BJJ'
);

-- Tabla de Novedades
CREATE TABLE IF NOT EXISTS cohab_news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  emoji TEXT DEFAULT '📢',
  created_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true
);

-- Tabla de Videos
CREATE TABLE IF NOT EXISTS cohab_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  instructor TEXT DEFAULT 'Prof. Andrés',
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 2. HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

ALTER TABLE cohab_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohab_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohab_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohab_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohab_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohab_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohab_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohab_videos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. FUNCIÓN HELPER: Verificar si el usuario es admin
-- =====================================================

CREATE OR REPLACE FUNCTION cohab_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM cohab_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- 4. POLÍTICAS RLS POR TABLA
-- =====================================================

-- ----- cohab_profiles -----
CREATE POLICY "profiles_select" ON cohab_profiles
  FOR SELECT USING (id = auth.uid() OR cohab_is_admin());

CREATE POLICY "profiles_insert" ON cohab_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON cohab_profiles
  FOR UPDATE USING (id = auth.uid());

-- ----- cohab_services -----
CREATE POLICY "services_select" ON cohab_services
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "services_insert" ON cohab_services FOR INSERT WITH CHECK (cohab_is_admin());
CREATE POLICY "services_update" ON cohab_services FOR UPDATE USING (cohab_is_admin());
CREATE POLICY "services_delete" ON cohab_services FOR DELETE USING (cohab_is_admin());

-- ----- cohab_payments -----
CREATE POLICY "payments_select" ON cohab_payments
  FOR SELECT USING (profile_id = auth.uid() OR cohab_is_admin());

CREATE POLICY "payments_insert" ON cohab_payments
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "payments_update" ON cohab_payments
  FOR UPDATE USING (cohab_is_admin());

-- ----- cohab_subscriptions -----
CREATE POLICY "subscriptions_select" ON cohab_subscriptions
  FOR SELECT USING (profile_id = auth.uid() OR cohab_is_admin());

CREATE POLICY "subscriptions_insert" ON cohab_subscriptions
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "subscriptions_update" ON cohab_subscriptions
  FOR UPDATE USING (cohab_is_admin());

-- ----- cohab_family_members -----
CREATE POLICY "family_select" ON cohab_family_members FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "family_insert" ON cohab_family_members FOR INSERT WITH CHECK (parent_id = auth.uid());
CREATE POLICY "family_update" ON cohab_family_members FOR UPDATE USING (parent_id = auth.uid());
CREATE POLICY "family_delete" ON cohab_family_members FOR DELETE USING (parent_id = auth.uid());

-- ----- cohab_attendance -----
CREATE POLICY "attendance_select" ON cohab_attendance
  FOR SELECT USING (profile_id = auth.uid() OR cohab_is_admin());

CREATE POLICY "attendance_insert" ON cohab_attendance
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ----- cohab_news -----
CREATE POLICY "news_select" ON cohab_news FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "news_insert" ON cohab_news FOR INSERT WITH CHECK (cohab_is_admin());
CREATE POLICY "news_update" ON cohab_news FOR UPDATE USING (cohab_is_admin());
CREATE POLICY "news_delete" ON cohab_news FOR DELETE USING (cohab_is_admin());

-- ----- cohab_videos -----
CREATE POLICY "videos_select" ON cohab_videos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "videos_insert" ON cohab_videos FOR INSERT WITH CHECK (cohab_is_admin());
CREATE POLICY "videos_update" ON cohab_videos FOR UPDATE USING (cohab_is_admin());
CREATE POLICY "videos_delete" ON cohab_videos FOR DELETE USING (cohab_is_admin());

-- =====================================================
-- 5. DATOS INICIALES Y TRIGGERS
-- =====================================================

-- Trigger para crear perfil automáticamente al registrarse en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.cohab_profiles (id, name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Novedades de ejemplo
INSERT INTO cohab_news (title, subtitle, emoji) VALUES
  ('Ceremonia de Graduación', '28 de Febrero', '🥋'),
  ('Rifa Aire Acondicionado', 'Sorteo próximamente', '🎫'),
  ('Técnica de la Semana', 'Nuevo video disponible', '⚡');

-- Videos de ejemplo
INSERT INTO cohab_videos (title, description, duration, thumbnail_url, instructor, featured) VALUES
  ('Pasaje de Media Guardia', 'Control avanzado de cadera y presión lateral para estabilizar la posición y evitar raspas. Fundamentos de control.', '4:20 min', 'assets/thumb-1.png', 'Prof. Andrés', true),
  ('Triángulo Invertido', 'Técnica de sumisión desde guardia cerrada con control de cabeza.', '3:15 min', 'assets/thumb-2.png', 'Prof. Andrés', false),
  ('Escape de Montada', 'Movimiento de cadera para escapar de la posición de montada.', '5:40 min', 'assets/thumb-3.png', 'Prof. Andrés', false),
  ('Armbar Cerrado', 'Palanca de brazo desde guardia cerrada con control de postura.', '4:05 min', 'assets/thumb-4.png', 'Prof. Andrés', false);
