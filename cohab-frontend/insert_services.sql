DELETE FROM public.cohab_services;

INSERT INTO public.cohab_services (name, description, price, pricing_tiers, schedule, is_active)
VALUES
  ('BJJ General', 'Jiu-Jitsu Brasileño para adultos. Entrenamiento técnico y sparring con cinturón reglamentario.', 45000, '[{"name": "Mensual Libre", "price": 45000}]'::jsonb, 'LUN-MIE-VIE 19:30 | MAR-JUE 20:00', true),
  ('BJJ Kids', 'BJJ para niños y adolescentes. Clases adaptadas con énfasis en valores, disciplina y técnica.', 45000, '[{"name": "Mensual Infantil", "price": 45000}]'::jsonb, 'LUN-MIE-VIE 18:30 | MAR-JUE 18:30', true),
  ('Funcional', 'Entrenamiento funcional de alta intensidad. Acondicionamiento físico y fuerza.', 45000, '[{"name": "5 clases semanales", "price": 45000}, {"name": "4 clases semanales", "price": 40000}, {"name": "3 clases semanales", "price": 35000}, {"name": "2 clases semanales", "price": 30000}, {"name": "1 clase semanal", "price": 25000}]'::jsonb, 'LUN-MIE-VIE 07:00 | MAR-JUE 07:00', true),
  ('BJJ Seminarios', 'Seminarios especiales con instructores invitados. Se activan por temporada.', 20000, '[{"name": "Entrada Seminario", "price": 20000}]'::jsonb, 'Sin programar', false);
