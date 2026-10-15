-- =========================================================================
-- COHAB LOS ANDES — LIMPIEZA DE SERVICIOS Y RESTRICCIÓN DE UNICIDAD
-- Instrucciones: Ejecuta este script en el SQL Editor de tu consola de Supabase
-- =========================================================================

-- 1. Eliminar duplicados físicos manteniendo solo la primera versión creada de cada servicio
-- Esto limpia selectivamente nombres idénticos (por ejemplo, los múltiples 'BJJ Kids')
DELETE FROM public.cohab_services a
USING public.cohab_services b
WHERE a.id > b.id 
  AND LOWER(TRIM(a.name)) = LOWER(TRIM(b.name));

-- 2. Eliminar servicios antiguos u obsoletos que ya no se comercializan para evitar ruido en el selector
-- Por ejemplo, si tenías 'BJJ KIDS (6-8 años)' o 'BJJ KIDS (8-12 años)' y ahora están unificados en 'BJJ Kids'
DELETE FROM public.cohab_services 
WHERE name IN ('BJJ KIDS (6-8 años)', 'BJJ KIDS (8-12 años)');

-- 3. Agregar una restricción UNIQUE en la columna name para impedir físicamente cualquier duplicación en el futuro
-- Si la restricción ya existía, primero la removemos para evitar errores al ejecutar el parche
ALTER TABLE public.cohab_services 
  DROP CONSTRAINT IF EXISTS cohab_services_name_unique;

ALTER TABLE public.cohab_services 
  ADD CONSTRAINT cohab_services_name_unique UNIQUE (name);

-- 4. Asegurar e insertar los 4 servicios oficiales y vigentes con sus datos y precios oficiales
-- Si el nombre ya existe, se actualizan sus valores (gracias a ON CONFLICT) en lugar de duplicarse
INSERT INTO public.cohab_services (name, description, price, pricing_tiers, schedule, is_active)
VALUES
  (
    'BJJ General', 
    'Jiu-Jitsu Brasileño para adultos. Entrenamiento técnico y sparring con cinturón reglamentario.', 
    45000, 
    '[{"name": "Mensual Libre", "price": 45000}]'::jsonb, 
    'LUN-MIE-VIE 19:30 | MAR-JUE 20:00', 
    true
  ),
  (
    'BJJ Kids', 
    'BJJ para niños y adolescentes. Clases adaptadas con énfasis en valores, disciplina y técnica.', 
    45000, 
    '[{"name": "Mensual Infantil", "price": 45000}]'::jsonb, 
    'LUN-MIE-VIE 18:30 | MAR-JUE 18:30', 
    true
  ),
  (
    'Funcional', 
    'Entrenamiento funcional de alta intensidad. Acondicionamiento físico y fuerza.', 
    45000, 
    '[{"name": "5 clases semanales", "price": 45000}, {"name": "4 clases semanales", "price": 40000}, {"name": "3 clases semanales", "price": 35000}, {"name": "2 clases semanales", "price": 30000}, {"name": "1 clase semanal", "price": 25000}]'::jsonb, 
    'LUN-MIE-VIE 07:00 | MAR-JUE 07:00', 
    true
  ),
  (
    'BJJ Seminarios', 
    'Seminarios especiales con instructores invitados. Se activan por temporada.', 
    20000, 
    '[{"name": "Entrada Seminario", "price": 20000}]'::jsonb, 
    'Sin programar', 
    false
  )
ON CONFLICT (name) 
DO UPDATE SET 
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  pricing_tiers = EXCLUDED.pricing_tiers,
  schedule = EXCLUDED.schedule,
  is_active = EXCLUDED.is_active;

-- Mensaje de confirmación final
SELECT '✅ Base de datos de servicios limpiada y blindada contra duplicados exitosamente!' AS status;
