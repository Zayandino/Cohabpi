import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.cohablosandes.cloud';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQyMjA4NDksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.OM8ePDG-yZwyT-vcGxB2ECMsHngThAEELd0tq7TY7eg';

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
