import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.cohablosandes.cloud';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQyMjA4NDksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.OM8ePDG-yZwyT-vcGxB2ECMsHngThAEELd0tq7TY7eg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const desiredServices = [
  { name: 'BJJ General', price: 40000, billing_cycle: 'monthly', features: JSON.stringify(['Acceso a todas las clases de adultos', 'Tatami libre', 'Mentorías']) },
  { name: 'BJJ KIDS', price: 30000, billing_cycle: 'monthly', features: JSON.stringify(['Clases formativas para niños', 'Psicomotricidad', 'Valores']) },
  { name: 'BJJ Seminarios', price: 15000, billing_cycle: 'one-time', features: JSON.stringify(['Acceso a seminarios especiales', 'Profesores invitados']) },
  { name: 'Funcional', price: 25000, billing_cycle: 'monthly', features: JSON.stringify(['Entrenamiento funcional', 'Acondicionamiento físico', 'Preparación']) }
];

async function updateServices() {
  try {
    // 1. Fetch current services
    const { data: existing, error: fetchErr } = await supabase
      .from('cohab_services')
      .select('*');

    if (fetchErr) throw fetchErr;

    console.log("Servicios actuales:", existing);

    // 2. Insert new services that are missing, or keep track of them
    for (const desired of desiredServices) {
      const match = existing.find(s => s.name.toLowerCase() === desired.name.toLowerCase());
      if (match) {
        console.log(`El servicio "${desired.name}" ya existe con ID ${match.id}. Actualizando precio/detalles...`);
        const { error: updateErr } = await supabase
          .from('cohab_services')
          .update({
            price: desired.price,
            billing_cycle: desired.billing_cycle,
            features: JSON.parse(desired.features)
          })
          .eq('id', match.id);
        if (updateErr) console.error("Error al actualizar:", updateErr);
      } else {
        console.log(`El servicio "${desired.name}" no existe. Insertando...`);
        const { error: insertErr } = await supabase
          .from('cohab_services')
          .insert([{
            name: desired.name,
            price: desired.price,
            billing_cycle: desired.billing_cycle,
            features: JSON.parse(desired.features)
          }]);
        if (insertErr) console.error("Error al insertar:", insertErr);
      }
    }

    // Print final list of services
    const { data: finalData } = await supabase
      .from('cohab_services')
      .select('*');
    console.log("Servicios finales en la base de datos:");
    finalData.forEach(s => console.log(`- ID: ${s.id} | Nombre: ${s.name} | Precio: ${s.price}`));

  } catch (err) {
    console.error("Error general:", err);
  }
}

updateServices();
