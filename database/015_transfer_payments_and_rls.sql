-- ==============================================================================
-- COHAB LOS ANDES — MIGRACIÓN 015:
-- 1. FLUJO DE PAGO POR TRANSFERENCIA BANCARIA Y HABILITACIÓN ADMIN (1 CLIC)
-- 2. CORRECCIÓN DE POLÍTICAS RLS EN PAGOS, SUSCRIPCIONES Y SESIONES DE CHECKOUT
-- 3. RESTRICCIÓN DE ASISTENCIA MANUAL EXCLUSIVA PARA EL STAFF (SOLO QR ALUMNOS)
-- ==============================================================================

SET ROLE supabase_admin;

-- 1. EXTENSIÓN DE TABLA cohab_payments PARA TRAZABILIDAD Y TRANSFERENCIAS
ALTER TABLE public.cohab_payments
  ADD COLUMN IF NOT EXISTS checkout_session_id UUID REFERENCES public.cohab_checkout_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS status_detail TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.cohab_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cohab_payments_status ON public.cohab_payments(status);
CREATE INDEX IF NOT EXISTS idx_cohab_payments_profile_id ON public.cohab_payments(profile_id);
CREATE INDEX IF NOT EXISTS idx_cohab_payments_checkout_session_id ON public.cohab_payments(checkout_session_id);

-- 2. TABLA DE CONFIGURACIÓN BANCARIA PARA TRANSFERENCIAS (EDITABLE POR ADMIN)
CREATE TABLE IF NOT EXISTS public.cohab_bank_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name TEXT NOT NULL DEFAULT 'Banco de Chile / BancoEstado',
  account_type TEXT NOT NULL DEFAULT 'Cuenta Vista / Corriente',
  account_number TEXT NOT NULL DEFAULT 'Solicitar o verificar en recepción',
  holder_name TEXT NOT NULL DEFAULT 'Eduardo Javier Ambler Ríos (COHAB Los Andes)',
  holder_rut TEXT NOT NULL DEFAULT '',
  confirmation_email TEXT NOT NULL DEFAULT 'ambler.eduardo@gmail.com',
  instructions TEXT DEFAULT 'Transfiere el monto exacto e indica el nombre del alumno en el comentario. Luego presiona "Informar Transferencia" para que el administrador habilite tu membresía.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cohab_bank_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_settings_select ON public.cohab_bank_settings;
CREATE POLICY bank_settings_select ON public.cohab_bank_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS bank_settings_admin_all ON public.cohab_bank_settings;
CREATE POLICY bank_settings_admin_all ON public.cohab_bank_settings
  FOR ALL USING (public.cohab_is_admin())
  WITH CHECK (public.cohab_is_admin());

-- Insertar fila inicial usando los datos del perfil admin si existen
INSERT INTO public.cohab_bank_settings (id, holder_name, holder_rut, confirmation_email)
SELECT
  1,
  COALESCE(NULLIF(name, ''), 'Eduardo Javier Ambler Ríos'),
  COALESCE(rut, ''),
  COALESCE(email, 'ambler.eduardo@gmail.com')
FROM public.cohab_profiles
WHERE email = 'ambler.eduardo@gmail.com'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cohab_bank_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.cohab_bank_settings TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.cohab_bank_settings TO authenticated, service_role;

-- 3. CORRECCIÓN DE POLÍTICAS RLS Y CONSTRAINTS EN cohab_checkout_sessions, cohab_payments Y cohab_subscriptions
ALTER TABLE public.cohab_checkout_sessions
  DROP CONSTRAINT IF EXISTS cohab_checkout_sessions_status_check;

ALTER TABLE public.cohab_checkout_sessions
  ADD CONSTRAINT cohab_checkout_sessions_status_check
  CHECK (status IN ('pending', 'transfer_pending', 'completed', 'failed', 'rejected'));

ALTER TABLE public.cohab_checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own checkout sessions" ON public.cohab_checkout_sessions;
DROP POLICY IF EXISTS "Users can view their own checkout sessions" ON public.cohab_checkout_sessions;
DROP POLICY IF EXISTS checkout_sessions_select ON public.cohab_checkout_sessions;
DROP POLICY IF EXISTS checkout_sessions_insert ON public.cohab_checkout_sessions;
DROP POLICY IF EXISTS checkout_sessions_update ON public.cohab_checkout_sessions;

CREATE POLICY checkout_sessions_select ON public.cohab_checkout_sessions
  FOR SELECT USING (
    auth.uid() = payer_id
    OR public.cohab_is_admin()
  );

CREATE POLICY checkout_sessions_insert ON public.cohab_checkout_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = payer_id
    OR public.cohab_is_admin()
  );

CREATE POLICY checkout_sessions_update ON public.cohab_checkout_sessions
  FOR UPDATE USING (
    auth.uid() = payer_id
    OR public.cohab_is_admin()
  );

-- Políticas de cohab_payments
ALTER TABLE public.cohab_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select ON public.cohab_payments;
DROP POLICY IF EXISTS payments_insert ON public.cohab_payments;
DROP POLICY IF EXISTS payments_update ON public.cohab_payments;
DROP POLICY IF EXISTS payments_delete ON public.cohab_payments;

CREATE POLICY payments_select ON public.cohab_payments
  FOR SELECT USING (
    profile_id = auth.uid()
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

CREATE POLICY payments_insert ON public.cohab_payments
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

CREATE POLICY payments_update ON public.cohab_payments
  FOR UPDATE USING (public.cohab_is_admin());

CREATE POLICY payments_delete ON public.cohab_payments
  FOR DELETE USING (public.cohab_is_admin());

-- Políticas de cohab_subscriptions
ALTER TABLE public.cohab_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select ON public.cohab_subscriptions;
DROP POLICY IF EXISTS subscriptions_insert ON public.cohab_subscriptions;
DROP POLICY IF EXISTS subscriptions_update ON public.cohab_subscriptions;
DROP POLICY IF EXISTS subscriptions_delete ON public.cohab_subscriptions;

CREATE POLICY subscriptions_select ON public.cohab_subscriptions
  FOR SELECT USING (
    profile_id = auth.uid()
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_instructor()
    OR public.cohab_is_admin()
  );

CREATE POLICY subscriptions_insert ON public.cohab_subscriptions
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

CREATE POLICY subscriptions_update ON public.cohab_subscriptions
  FOR UPDATE USING (public.cohab_is_admin());

CREATE POLICY subscriptions_delete ON public.cohab_subscriptions
  FOR DELETE USING (public.cohab_is_admin());

-- 4. RESTRICCIÓN DE ASISTENCIA MANUAL: SOLO STAFF (INSTRUCTOR / ADMIN)
-- Los alumnos regulares solo pueden registrar asistencia mediante el RPC cohab_mark_attendance_qr (SECURITY DEFINER)
ALTER TABLE public.cohab_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_select_policy ON public.cohab_attendance;
DROP POLICY IF EXISTS attendance_insert_policy ON public.cohab_attendance;
DROP POLICY IF EXISTS attendance_update_policy ON public.cohab_attendance;
DROP POLICY IF EXISTS attendance_delete_policy ON public.cohab_attendance;

CREATE POLICY attendance_select_policy ON public.cohab_attendance
  FOR SELECT USING (
    profile_id = auth.uid()
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_instructor()
    OR public.cohab_is_admin()
  );

CREATE POLICY attendance_insert_policy ON public.cohab_attendance
  FOR INSERT WITH CHECK (
    public.cohab_is_instructor()
    OR public.cohab_is_admin()
  );

CREATE POLICY attendance_update_policy ON public.cohab_attendance
  FOR UPDATE USING (
    public.cohab_is_instructor()
    OR public.cohab_is_admin()
  );

CREATE POLICY attendance_delete_policy ON public.cohab_attendance
  FOR DELETE USING (
    public.cohab_is_instructor()
    OR public.cohab_is_admin()
  );

-- 5. FUNCIÓN RPC: INFORMAR PAGO POR TRANSFERENCIA BANCARIA (ALUMNO -> ADMIN)
CREATE OR REPLACE FUNCTION public.cohab_submit_transfer_payment(
  p_checkout_session_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_session RECORD;
  v_existing_payment_id UUID;
  v_payment_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Debes iniciar sesión para informar un pago.');
  END IF;

  SELECT * INTO v_session
  FROM public.cohab_checkout_sessions
  WHERE id = p_checkout_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesión de pago no encontrada.');
  END IF;

  IF v_session.payer_id <> v_caller_id AND NOT public.cohab_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para modificar esta sesión de pago.');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Esta sesión de pago ya fue procesada y aprobada.');
  END IF;

  -- Verificar si ya existe un pago pendiente para esta misma sesión
  SELECT id INTO v_existing_payment_id
  FROM public.cohab_payments
  WHERE checkout_session_id = p_checkout_session_id
    AND status = 'pending'
  LIMIT 1;

  IF v_existing_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'payment_id', v_existing_payment_id,
      'already_reported', true,
      'message', 'Este pago por transferencia ya fue informado y está pendiente de validación.'
    );
  END IF;

  -- Marcar la sesión como transfer_pending
  UPDATE public.cohab_checkout_sessions
  SET status = 'transfer_pending',
      updated_at = now()
  WHERE id = p_checkout_session_id;

  -- Registrar el pago pendiente de aprobación
  INSERT INTO public.cohab_payments (
    profile_id,
    checkout_session_id,
    amount,
    status,
    payment_method,
    status_detail,
    notes,
    payment_date
  ) VALUES (
    v_session.payer_id,
    p_checkout_session_id,
    v_session.total_amount,
    'pending',
    'transferencia',
    'pending_admin_approval',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    now()
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'already_reported', false,
    'message', 'Transferencia informada con éxito. El administrador validará y habilitará tu membresía.'
  );
END;
$$;

-- 6. FUNCIÓN RPC: HABILITAR ALUMNO / APROBAR PAGO PENDIENTE (EXCLUSIVO ADMIN)
CREATE OR REPLACE FUNCTION public.cohab_approve_pending_payment(
  p_payment_id UUID,
  p_override_months INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment RECORD;
  v_session RECORD;
  v_months INT := 1;
  v_enrollments JSONB := '{}'::jsonb;
  v_person_key TEXT;
  v_person_id UUID;
  v_services_arr JSONB;
  v_srv_item JSONB;
  v_service_id UUID;
  v_active_end DATE;
  v_start_date DATE;
  v_end_date DATE;
  v_activated_count INT := 0;
  v_default_service_id UUID;
BEGIN
  IF NOT public.cohab_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo un administrador puede habilitar pagos pendientes.');
  END IF;

  SELECT * INTO v_payment
  FROM public.cohab_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro de pago no encontrado.');
  END IF;

  IF v_payment.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este pago ya fue aprobado anteriormente.');
  END IF;

  -- Cargar sesión de checkout vinculada si existe
  IF v_payment.checkout_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.cohab_checkout_sessions
    WHERE id = v_payment.checkout_session_id;

    IF FOUND AND v_session.cart_data IS NOT NULL THEN
      v_months := COALESCE(p_override_months, NULLIF((v_session.cart_data->>'months')::int, 0), 1);
      v_enrollments := COALESCE(v_session.cart_data->'enrollments', '{}'::jsonb);
    END IF;
  END IF;

  IF p_override_months IS NOT NULL AND p_override_months > 0 THEN
    v_months := p_override_months;
  END IF;

  -- 1. Marcar pago como aprobado
  UPDATE public.cohab_payments
  SET status = 'approved',
      status_detail = 'approved_by_admin',
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      payment_date = now()
  WHERE id = p_payment_id;

  -- 2. Marcar sesión de checkout como completada
  IF v_payment.checkout_session_id IS NOT NULL THEN
    UPDATE public.cohab_checkout_sessions
    SET status = 'completed',
        updated_at = now()
    WHERE id = v_payment.checkout_session_id;
  END IF;

  -- 3. Activar suscripciones para cada persona e inscripción en el carrito
  IF jsonb_typeof(v_enrollments) = 'object' AND v_enrollments <> '{}'::jsonb THEN
    FOR v_person_key, v_services_arr IN SELECT * FROM jsonb_each(v_enrollments)
    LOOP
      IF v_person_key = 'main' THEN
        v_person_id := v_payment.profile_id;
      ELSE
        BEGIN
          v_person_id := v_person_key::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_person_id := v_payment.profile_id;
        END;
      END IF;

      -- Activar perfil y marcar waiver_signed
      UPDATE public.cohab_profiles
      SET status = 'activo'
      WHERE id = v_person_id;

      IF jsonb_typeof(v_services_arr) = 'array' THEN
        FOR v_srv_item IN SELECT * FROM jsonb_array_elements(v_services_arr)
        LOOP
          v_service_id := COALESCE(
            NULLIF(v_srv_item->>'serviceId', '')::uuid,
            NULLIF(v_srv_item->>'id', '')::uuid
          );

          IF v_service_id IS NOT NULL THEN
            SELECT end_date INTO v_active_end
            FROM public.cohab_subscriptions
            WHERE profile_id = v_person_id
              AND service_id = v_service_id
              AND status = 'active'
            ORDER BY end_date DESC NULLS LAST
            LIMIT 1;

            IF v_active_end IS NOT NULL AND v_active_end > CURRENT_DATE THEN
              v_start_date := v_active_end;
            ELSE
              v_start_date := CURRENT_DATE;
            END IF;

            v_end_date := (v_start_date + (v_months || ' months')::interval)::date;

            INSERT INTO public.cohab_subscriptions (
              profile_id,
              service_id,
              status,
              start_date,
              end_date
            ) VALUES (
              v_person_id,
              v_service_id,
              'active',
              v_start_date,
              v_end_date
            );

            v_activated_count := v_activated_count + 1;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- Fallback: si el pago no tenía carrito detallado, activar al perfil titular en el servicio principal por v_months
  IF v_activated_count = 0 THEN
    UPDATE public.cohab_profiles
    SET status = 'activo'
    WHERE id = v_payment.profile_id;

    SELECT id INTO v_default_service_id
    FROM public.cohab_services
    WHERE is_active = true
    ORDER BY name ASC
    LIMIT 1;

    SELECT end_date INTO v_active_end
    FROM public.cohab_subscriptions
    WHERE profile_id = v_payment.profile_id
      AND (v_default_service_id IS NULL OR service_id = v_default_service_id)
      AND status = 'active'
    ORDER BY end_date DESC NULLS LAST
    LIMIT 1;

    IF v_active_end IS NOT NULL AND v_active_end > CURRENT_DATE THEN
      v_start_date := v_active_end;
    ELSE
      v_start_date := CURRENT_DATE;
    END IF;

    v_end_date := (v_start_date + (v_months || ' months')::interval)::date;

    INSERT INTO public.cohab_subscriptions (
      profile_id,
      service_id,
      status,
      start_date,
      end_date
    ) VALUES (
      v_payment.profile_id,
      v_default_service_id,
      'active',
      v_start_date,
      v_end_date
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'months', v_months,
    'end_date', v_end_date,
    'message', 'Pago aprobado y membresía habilitada exitosamente.'
  );
END;
$$;

-- 7. FUNCIÓN RPC: RECHAZAR / ANULAR PAGO PENDIENTE (EXCLUSIVO ADMIN)
CREATE OR REPLACE FUNCTION public.cohab_reject_pending_payment(
  p_payment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_payment RECORD;
BEGIN
  IF NOT public.cohab_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo un administrador puede rechazar pagos pendientes.');
  END IF;

  SELECT * INTO v_payment
  FROM public.cohab_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registro de pago no encontrado.');
  END IF;

  UPDATE public.cohab_payments
  SET status = 'rejected',
      status_detail = COALESCE(NULLIF(btrim(p_reason), ''), 'rejected_by_admin'),
      reviewed_by = v_admin_id,
      reviewed_at = now()
  WHERE id = p_payment_id;

  IF v_payment.checkout_session_id IS NOT NULL THEN
    UPDATE public.cohab_checkout_sessions
    SET status = 'rejected',
        updated_at = now()
    WHERE id = v_payment.checkout_session_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'message', 'Solicitud de pago marcada como rechazada.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cohab_submit_transfer_payment(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cohab_approve_pending_payment(UUID, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cohab_reject_pending_payment(UUID, TEXT) TO authenticated, service_role;

