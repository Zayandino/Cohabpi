-- ==============================================================================
-- COHAB LOS ANDES — MIGRACIÓN 013: GESTIÓN DE STAFF, MAESTRÍAS Y ASISTENCIA QR
-- ==============================================================================

-- 1. EXTENSIÓN DE PERFILES (cohab_profiles) PARA TÍTULO DE STAFF / MAESTRÍA
ALTER TABLE public.cohab_profiles
  ADD COLUMN IF NOT EXISTS staff_title TEXT DEFAULT 'Instructor',
  ADD COLUMN IF NOT EXISTS staff_order INT DEFAULT 99;

-- Asegurar que los perfiles existentes de admin/instructor tengan título apropiado
UPDATE public.cohab_profiles
SET staff_title = 'Profesor', is_instructor = true
WHERE email = 'ambler.eduardo@gmail.com' AND (staff_title IS NULL OR staff_title = 'Instructor');

UPDATE public.cohab_profiles
SET staff_title = 'Profesor', is_instructor = true
WHERE email = 'instructor_test@cohab.cl' AND (staff_title IS NULL OR staff_title = 'Instructor');

UPDATE public.cohab_profiles
SET staff_title = 'Instructor', is_instructor = true
WHERE email = 'claudio.aguilera.d@gmail.com';

-- 2. EXTENSIÓN DE SERVICIOS / CLASES (cohab_services)
ALTER TABLE public.cohab_services
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.cohab_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instructor_name TEXT;

-- 3. EXTENSIÓN DE ASISTENCIAS (cohab_attendance)
ALTER TABLE public.cohab_attendance
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.cohab_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.cohab_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'manual';

-- Actualizar constraint de method si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_attendance_method'
  ) THEN
    ALTER TABLE public.cohab_attendance
      ADD CONSTRAINT ck_attendance_method CHECK (method IN ('qr', 'manual'));
  END IF;
END $$;

-- 4. POLÍTICAS RLS PARA ASISTENCIA
ALTER TABLE public.cohab_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_select_policy ON public.cohab_attendance;
CREATE POLICY attendance_select_policy ON public.cohab_attendance
  FOR SELECT USING (
    profile_id = auth.uid()
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_instructor()
    OR public.cohab_is_admin()
  );

DROP POLICY IF EXISTS attendance_insert_policy ON public.cohab_attendance;
CREATE POLICY attendance_insert_policy ON public.cohab_attendance
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR public.cohab_is_instructor()
    OR public.cohab_is_admin()
  );

-- 5. FUNCIÓN SEGURA PARA MARCAR ASISTENCIA POR CÓDIGO QR
-- Permite al alumno registrar su asistencia escaneando el código QR generado por el instructor a cargo
CREATE OR REPLACE FUNCTION public.cohab_mark_attendance_qr(
  p_service_id UUID,
  p_qr_date DATE,
  p_instructor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_student_name TEXT;
  v_service_name TEXT;
  v_instructor_name TEXT;
  v_trial_used INT;
  v_trial_max INT;
  v_has_active_sub BOOLEAN := false;
  v_already_checked BOOLEAN := false;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Validar que el usuario esté autenticado
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Debes iniciar sesión para marcar asistencia.');
  END IF;

  -- Validar que la fecha del QR sea la de hoy
  IF p_qr_date IS NULL OR p_qr_date <> v_today THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este código QR ha expirado o corresponde a otra fecha.');
  END IF;

  -- Obtener datos del alumno
  SELECT name, trial_classes_used, max_trial_classes
  INTO v_student_name, v_trial_used, v_trial_max
  FROM public.cohab_profiles
  WHERE id = v_student_id;

  IF v_student_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil de alumno no encontrado.');
  END IF;

  -- Obtener datos del servicio / clase
  SELECT name INTO v_service_name
  FROM public.cohab_services
  WHERE id = p_service_id;

  IF v_service_name IS NULL THEN
    v_service_name := 'Clase de Brazilian Jiu-Jitsu';
  END IF;

  -- Obtener nombre del instructor si viene
  IF p_instructor_id IS NOT NULL THEN
    SELECT name INTO v_instructor_name
    FROM public.cohab_profiles
    WHERE id = p_instructor_id;
  END IF;

  -- Verificar si ya marcó asistencia hoy para esta misma clase o servicio
  SELECT EXISTS (
    SELECT 1 FROM public.cohab_attendance
    WHERE profile_id = v_student_id
    AND checked_at::date = v_today
    AND (service_id = p_service_id OR class_type = v_service_name)
  ) INTO v_already_checked;

  IF v_already_checked THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_registered', true,
      'message', 'Ya habías registrado tu asistencia para esta clase el día de hoy.',
      'student_name', v_student_name,
      'class_name', v_service_name
    );
  END IF;

  -- Verificar si tiene suscripción activa
  SELECT EXISTS (
    SELECT 1 FROM public.cohab_subscriptions
    WHERE profile_id = v_student_id
    AND status = 'active'
    AND (end_date IS NULL OR end_date >= v_today)
  ) INTO v_has_active_sub;

  -- Si no tiene suscripción activa, verificar si tiene clases de prueba disponibles
  IF NOT v_has_active_sub THEN
    IF COALESCE(v_trial_used, 0) < COALESCE(v_trial_max, 2) THEN
      -- Descontar una clase de prueba
      UPDATE public.cohab_profiles
      SET trial_classes_used = COALESCE(trial_classes_used, 0) + 1
      WHERE id = v_student_id;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Has utilizado tus 2 clases de prueba. Para continuar entrenando, formaliza tu matrícula y membresía.'
      );
    END IF;
  END IF;

  -- Insertar asistencia
  INSERT INTO public.cohab_attendance (
    profile_id,
    service_id,
    class_type,
    checked_at,
    verified_by,
    method
  ) VALUES (
    v_student_id,
    p_service_id,
    v_service_name,
    now(),
    p_instructor_id,
    'qr'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_registered', false,
    'message', '¡Asistencia registrada con éxito!',
    'student_name', v_student_name,
    'class_name', v_service_name,
    'instructor_name', COALESCE(v_instructor_name, 'Instructor COHAB')
  );
END;
$$;
