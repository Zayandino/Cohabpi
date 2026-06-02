import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://api.cohablosandes.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQyMjA4NDksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.OM8ePDG-yZwyT-vcGxB2ECMsHngThAEELd0tq7TY7eg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
  const { data, error } = await supabase
    .from('cohab_profiles')
    .select('id, rut, birthdate')
    .limit(1);
  
  if (error) {
    console.error('Error fetching columns:', error.message);
    console.log('\nPlease run the following SQL in Supabase SQL editor:');
    console.log(`
ALTER TABLE public.cohab_profiles ADD COLUMN IF NOT EXISTS rut text;
ALTER TABLE public.cohab_profiles ADD COLUMN IF NOT EXISTS birthdate date;
NOTIFY pgrst, 'reload schema';
    `);
  } else {
    console.log('Columns exist:', data);
  }
}

checkColumns();
