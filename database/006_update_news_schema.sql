-- =========================================================================
-- COHAB LOS ANDES — ACTUALIZACIÓN DE ESQUEMA DE NOVEDADES E IMÁGENES
-- Instrucciones: Ejecuta este script en el SQL Editor de tu consola de Supabase
-- =========================================================================

-- 1. Agregar columnas a la tabla cohab_news para soportar contenido, autor e imágenes
ALTER TABLE public.cohab_news 
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'Cohab Los Andes',
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Crear bucket público de Storage para las imágenes si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('news', 'news', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar políticas de seguridad RLS para el almacenamiento del Tatami
-- Asegurar que las políticas no dupliquen nombres y se apliquen de forma limpia
DROP POLICY IF EXISTS "Permitir lectura pública de imágenes de noticias" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida de imágenes a admins" ON storage.objects;
DROP POLICY IF EXISTS "Permitir eliminación de imágenes a admins" ON storage.objects;

-- Política 3.1: Permitir lectura pública de cualquier imagen del bucket 'news'
CREATE POLICY "Permitir lectura pública de imágenes de noticias"
ON storage.objects FOR SELECT
USING (bucket_id = 'news');

-- Política 3.2: Permitir la subida de archivos al bucket 'news' a usuarios autenticados (Admin/Alumnos con cuenta)
CREATE POLICY "Permitir subida de imágenes a admins"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'news');

-- Política 3.3: Permitir la eliminación de archivos del bucket 'news' a usuarios autenticados
CREATE POLICY "Permitir eliminación de imágenes a admins"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'news');

-- 4. Actualizar las RLS de la tabla de novedades
-- Por seguridad, aseguramos que solo administradores autenticados puedan modificar la tabla
DROP POLICY IF EXISTS "news_insert" ON public.cohab_news;
DROP POLICY IF EXISTS "news_update" ON public.cohab_news;
DROP POLICY IF EXISTS "news_delete" ON public.cohab_news;

CREATE POLICY "news_insert" ON public.cohab_news FOR INSERT WITH CHECK (cohab_is_admin());
CREATE POLICY "news_update" ON public.cohab_news FOR UPDATE USING (cohab_is_admin());
CREATE POLICY "news_delete" ON public.cohab_news FOR DELETE USING (cohab_is_admin());

-- 5. Agregar una novedad de ejemplo moderna con imagen premium para poblar la vista
-- Nota: La imagen de ejemplo usa Unsplash con fotos premium de Jiu-Jitsu
INSERT INTO public.cohab_news (title, content, emoji, author, image_url)
VALUES (
  'Inauguración de Nuevas Planchas de Tatami',
  '¡Tenemos excelentes noticias para toda nuestra comunidad! Esta semana completamos la renovación completa de nuestras planchas de tatami de alta densidad. Ahora contamos con una superficie de entrenamiento de calidad olímpica, diseñada para absorber mejor los impactos y brindar la máxima adherencia durante los rollings y proyecciones. ¡Los esperamos hoy para estrenarlo!',
  '🥋',
  'Sensei Andrés',
  'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=800&auto=format&fit=crop'
)
ON CONFLICT (id) DO NOTHING;

-- Mensaje de éxito en la consola de Supabase
SELECT '✅ Esquema de novedades e imágenes configurado exitosamente!' AS status;
