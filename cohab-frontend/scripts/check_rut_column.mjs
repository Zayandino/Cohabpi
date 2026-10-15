import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

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
