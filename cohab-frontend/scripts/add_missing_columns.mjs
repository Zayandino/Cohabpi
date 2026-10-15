/**
 * Migración: Agregar columnas faltantes a cohab_profiles
 * - scholarship_percent: descuento de beca (0-100)
 * - age: edad del miembro (si no existe)
 * 
 * Ejecutar: node add_missing_columns.mjs
 */
import { createClient } from '@supabase/supabase-js';

// Usar la service role key del archivo .env.local si está disponible
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
  // Intentar leer scholarship_percent
  const { data, error } = await supabase
    .from('cohab_profiles')
    .select('id, scholarship_percent, age')
    .limit(1);
  
  console.log('Prueba de columnas:');
  if (error) {
    console.error('Error:', error.message);
    console.log('\n⚠️  Columnas faltantes detectadas.');
    console.log('Por favor ejecuta el siguiente SQL en el panel SQL de tu Supabase:\n');
    console.log(`
-- Agregar columna scholarship_percent si no existe
ALTER TABLE public.cohab_profiles
  ADD COLUMN IF NOT EXISTS scholarship_percent integer DEFAULT 0;

-- Agregar columna age si no existe  
ALTER TABLE public.cohab_profiles
  ADD COLUMN IF NOT EXISTS age integer;

-- Verificar
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cohab_profiles' 
ORDER BY ordinal_position;
    `);
  } else {
    console.log('✅ Columnas scholarship_percent y age existen correctamente.');
    console.log('Datos de prueba:', data);
  }
}

checkColumns();
