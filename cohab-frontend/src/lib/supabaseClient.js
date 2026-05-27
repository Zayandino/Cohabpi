import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => {
  if (import.meta.env.VITE_SUPABASE_URL) return import.meta.env.VITE_SUPABASE_URL;
  if (typeof window !== 'undefined') {
    if (window.CONFIG && window.CONFIG.SUPABASE_URL) return window.CONFIG.SUPABASE_URL;
    if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) return CONFIG.SUPABASE_URL;
  }
  return 'https://api.cohablosandes.cloud';
};

const getSupabaseAnonKey = () => {
  if (import.meta.env.VITE_SUPABASE_ANON_KEY) return import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof window !== 'undefined') {
    if (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) return window.CONFIG.SUPABASE_ANON_KEY;
    if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_ANON_KEY) return CONFIG.SUPABASE_ANON_KEY;
  }
  return '';
};

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
