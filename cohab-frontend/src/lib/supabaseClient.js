import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (window.CONFIG && window.CONFIG.SUPABASE_URL) || 'https://api.cohablosandes.cloud';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
