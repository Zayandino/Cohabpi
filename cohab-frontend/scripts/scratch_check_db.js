import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

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
