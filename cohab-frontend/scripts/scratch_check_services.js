import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkServices() {
  try {
    const { data, error } = await supabase
      .from('cohab_services')
      .select('id, name, price, created_at')
      .order('name', { ascending: true });

    if (error) {
      console.error("Error al leer cohab_services:", error.message);
    } else {
      console.log("\nServicios en cohab_services (Total: " + data.length + "):");
      data.forEach(s => {
        console.log(`- ID: ${s.id}\n  Nombre: "${s.name}"\n  Precio: ${s.price}\n  Creado: ${s.created_at}\n`);
      });
    }
  } catch (err) {
    console.error("Error inesperado:", err);
  }
}

checkServices();
