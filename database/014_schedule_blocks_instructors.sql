-- ==============================================================================
-- COHAB LOS ANDES — MIGRACIÓN 014: BLOQUES HORARIOS CON MÚLTIPLES INSTRUCTORES
-- Permite asignar un Profesor, Instructor o Maestro distinto a cada bloque de
-- días/horas dentro de una misma disciplina (ej. BJJ General mañana, tarde y jueves).
-- ==============================================================================

-- 1. Agregar columna estructurada schedule_blocks a cohab_services
ALTER TABLE public.cohab_services
  ADD COLUMN IF NOT EXISTS schedule_blocks JSONB DEFAULT '[]'::jsonb;

-- 2. Migrar horarios existentes (texto plano) a schedule_blocks si está vacío
DO $$
DECLARE
  r RECORD;
  v_blocks TEXT[];
  v_block TEXT;
  v_match TEXT[];
  v_json_blocks JSONB;
BEGIN
  FOR r IN
    SELECT id, schedule, instructor_id, instructor_name, schedule_blocks
    FROM public.cohab_services
    WHERE (schedule_blocks IS NULL OR schedule_blocks = '[]'::jsonb)
      AND schedule IS NOT NULL
      AND btrim(schedule) <> ''
  LOOP
    v_json_blocks := '[]'::jsonb;
    v_blocks := string_to_array(r.schedule, ' | ');

    FOREACH v_block IN ARRAY v_blocks LOOP
      v_match := regexp_match(v_block, '^(.*?) de (\d{2}:\d{2}) a (\d{2}:\d{2}) hrs$');
      IF v_match IS NOT NULL THEN
        v_json_blocks := v_json_blocks || jsonb_build_array(
          jsonb_build_object(
            'days', v_match[1],
            'start', v_match[2],
            'end', v_match[3],
            'instructor_id', r.instructor_id,
            'instructor_name', r.instructor_name
          )
        );
      ELSE
        v_json_blocks := v_json_blocks || jsonb_build_array(
          jsonb_build_object(
            'days', v_block,
            'start', '20:00',
            'end', '21:30',
            'instructor_id', r.instructor_id,
            'instructor_name', r.instructor_name
          )
        );
      END IF;
    END LOOP;

    UPDATE public.cohab_services
    SET schedule_blocks = v_json_blocks
    WHERE id = r.id;
  END LOOP;
END $$;

