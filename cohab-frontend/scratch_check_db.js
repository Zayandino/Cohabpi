import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.cohablosandes.cloud';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQyMjA4NDksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.OM8ePDG-yZwyT-vcGxB2ECMsHngThAEELd0tq7TY7eg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfiles() {
  try {
    const { data, error } = await supabase
      .from('cohab_profiles')
      .select('*');

    if (error) {
      console.error("Error al leer cohab_profiles:", error);
    } else {
      console.log("Perfiles encontrados:", data.length);
      data.forEach(p => {
        console.log(`- ID: ${p.id}, Nombre: ${p.name}, Email: ${p.email}, Rol: ${p.role}, Cinturón: ${p.belt}, Graus: ${p.graus}`);
      });
    }
  } catch (err) {
    console.error("Error inesperado:", err);
  }
}

checkProfiles();
