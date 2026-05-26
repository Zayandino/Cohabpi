/**
 * Migración: Agregar columnas faltantes a cohab_profiles
 * - scholarship_percent: descuento de beca (0-100)
 * - age: edad del miembro (si no existe)
 * 
 * Ejecutar: node add_missing_columns.mjs
 */
import { createClient } from '@supabase/supabase-js';

// Usar la service role key del archivo .env.local si está disponible
const SUPABASE_URL = 'https://api.cohablosandes.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQyMjA4NDksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.OM8ePDG-yZwyT-vcGxB2ECMsHngThAEELd0tq7TY7eg';

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
