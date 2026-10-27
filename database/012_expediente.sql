-- ==============================================================================
-- COHAB LOS ANDES — MIGRACIÓN 012: EXPEDIENTE ÚNICO DEL ALUMNO Y MODO TATAMI
-- Temporada Enero - Diciembre | Salud con Semáforo | Visado Inteligente
-- ==============================================================================

-- 1. EXTENSIÓN DE PERFILES (cohab_profiles)
ALTER TABLE public.cohab_profiles
  ADD COLUMN IF NOT EXISTS is_instructor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_classes_used INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_trial_classes INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS blood_type TEXT,
  ADD COLUMN IF NOT EXISTS health_system TEXT,
  ADD COLUMN IF NOT EXISTS has_school_insurance BOOLEAN DEFAULT false;

-- 2. FUNCIÓN DE SEGURIDAD: Verificar si el usuario es Instructor o Admin
CREATE OR REPLACE FUNCTION public.cohab_is_instructor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cohab_profiles
    WHERE id = auth.uid()
    AND (is_instructor = true OR role = 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. TEMPORADAS ANUALES (cohab_seasons)
CREATE TABLE IF NOT EXISTS public.cohab_seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cohab_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_select" ON public.cohab_seasons
  FOR SELECT USING (true);

CREATE POLICY "seasons_admin" ON public.cohab_seasons
  FOR ALL USING (public.cohab_is_admin());

-- 4. FICHAS DE SALUD VERSIONADAS (cohab_health_records)
CREATE TABLE IF NOT EXISTS public.cohab_health_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.cohab_profiles(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.cohab_seasons(id) ON DELETE SET NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('green', 'yellow', 'red')),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_summary TEXT, -- Resumen visible en tatami: ej. "Asma (inhalador en bolso)"
  medical_certificate_url TEXT,
  certificate_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES public.cohab_profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cohab_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_select_owner_or_admin" ON public.cohab_health_records
  FOR SELECT USING (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

CREATE POLICY "health_insert_owner_or_admin" ON public.cohab_health_records
  FOR INSERT WITH CHECK (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

CREATE POLICY "health_update_owner_or_admin" ON public.cohab_health_records
  FOR UPDATE USING (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

-- 5. CONTACTOS DE EMERGENCIA (cohab_emergency_contacts)
CREATE TABLE IF NOT EXISTS public.cohab_emergency_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.cohab_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cohab_emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emergency_select_owner_instructor_admin" ON public.cohab_emergency_contacts
  FOR SELECT USING (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_instructor()
  );

CREATE POLICY "emergency_insert_owner_or_admin" ON public.cohab_emergency_contacts
  FOR INSERT WITH CHECK (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

CREATE POLICY "emergency_update_owner_or_admin" ON public.cohab_emergency_contacts
  FOR UPDATE USING (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

CREATE POLICY "emergency_delete_owner_or_admin" ON public.cohab_emergency_contacts
  FOR DELETE USING (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_admin()
  );

-- 6. DOCUMENTOS Y PROTOCOLOS (cohab_documents)
CREATE TABLE IF NOT EXISTS public.cohab_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL, -- 'protocolo_v5', 'riesgos_prueba'
  title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  stage INT NOT NULL CHECK (stage IN (1, 2)), -- 1 = prueba, 2 = ingreso formal
  target_audience TEXT NOT NULL CHECK (target_audience IN ('sub8', 'infantil', 'adolescente', 'adulto', 'todos')),
  content_md TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_document_version_audience UNIQUE (code, version, target_audience)
);

ALTER TABLE public.cohab_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_all" ON public.cohab_documents
  FOR SELECT USING (is_active = true OR public.cohab_is_admin());

CREATE POLICY "documents_admin" ON public.cohab_documents
  FOR ALL USING (public.cohab_is_admin());

-- 7. CONSENTIMIENTOS Y VISADOS INSTITUCIONALES (cohab_consents)
-- El alumno o apoderado firma digitalmente; la administración autoriza de forma inteligente.
CREATE TABLE IF NOT EXISTS public.cohab_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.cohab_profiles(id) ON DELETE CASCADE,
  signed_by UUID NOT NULL REFERENCES public.cohab_profiles(id),
  document_id UUID NOT NULL REFERENCES public.cohab_documents(id) ON DELETE RESTRICT,
  season_id UUID REFERENCES public.cohab_seasons(id) ON DELETE SET NULL,
  signature_url TEXT NOT NULL, -- Imagen o trazo de firma táctil del firmante
  signer_name TEXT NOT NULL,
  signer_rut TEXT NOT NULL,
  signer_relationship TEXT DEFAULT 'titular', -- 'titular', 'padre', 'madre', 'apoderado'
  signer_ip TEXT,
  signed_at TIMESTAMPTZ DEFAULT now(),
  -- Visado y aprobación institucional (sin firma manual repetitiva del profesor)
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_type TEXT DEFAULT 'automatic' CHECK (approval_type IN ('automatic', 'manual')),
  approved_by UUID REFERENCES public.cohab_profiles(id), -- Admin que autorizó manualmente
  approved_at TIMESTAMPTZ,
  approval_notes TEXT
);

ALTER TABLE public.cohab_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents_select_owner_or_admin" ON public.cohab_consents
  FOR SELECT USING (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR signed_by = auth.uid()
    OR public.cohab_is_admin()
  );

CREATE POLICY "consents_insert_owner_or_admin" ON public.cohab_consents
  FOR INSERT WITH CHECK (
    signed_by = auth.uid() 
    OR public.cohab_is_admin()
  );

CREATE POLICY "consents_update_admin" ON public.cohab_consents
  FOR UPDATE USING (public.cohab_is_admin());

-- 8. INCIDENTES Y LESIONES EN TATAMI (cohab_incidents)
CREATE TABLE IF NOT EXISTS public.cohab_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.cohab_profiles(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.cohab_profiles(id) ON DELETE SET NULL,
  body_part TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('leve', 'moderada', 'grave')),
  description TEXT NOT NULL,
  parent_notified BOOLEAN DEFAULT false,
  parent_notified_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cohab_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_select" ON public.cohab_incidents
  FOR SELECT USING (
    profile_id = auth.uid() 
    OR profile_id IN (SELECT id FROM public.cohab_profiles WHERE parent_id = auth.uid())
    OR public.cohab_is_instructor()
  );

CREATE POLICY "incidents_insert_instructor" ON public.cohab_incidents
  FOR INSERT WITH CHECK (public.cohab_is_instructor());

CREATE POLICY "incidents_update_admin" ON public.cohab_incidents
  FOR UPDATE USING (public.cohab_is_admin());

-- 9. HISTÓRICO Y MIGRACIÓN FORMS (cohab_legacy_forms)
CREATE TABLE IF NOT EXISTS public.cohab_legacy_forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_type TEXT NOT NULL, -- 'menor', 'adulto'
  raw_data JSONB NOT NULL,
  student_name TEXT,
  student_rut TEXT,
  student_email TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  matched_profile_id UUID REFERENCES public.cohab_profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cohab_legacy_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legacy_forms_admin_only" ON public.cohab_legacy_forms
  FOR ALL USING (public.cohab_is_admin());

-- 10. VISTA DE ESTADO DEL ALUMNO (cohab_student_status)
CREATE OR REPLACE VIEW public.cohab_student_status AS
WITH active_season AS (
  SELECT id, year, ends_on FROM public.cohab_seasons WHERE is_active = true LIMIT 1
),
latest_health AS (
  SELECT DISTINCT ON (profile_id)
    profile_id,
    risk_level,
    alert_summary,
    certificate_verified,
    medical_certificate_url
  FROM public.cohab_health_records
  ORDER BY profile_id, created_at DESC
),
stage1_consent AS (
  SELECT DISTINCT ON (c.profile_id)
    c.profile_id,
    c.id AS consent_id
  FROM public.cohab_consents c
  JOIN public.cohab_documents d ON c.document_id = d.id
  WHERE d.stage = 1
  ORDER BY c.profile_id, c.signed_at DESC
),
stage2_consent AS (
  SELECT DISTINCT ON (c.profile_id)
    c.profile_id,
    c.approval_status
  FROM public.cohab_consents c
  JOIN public.cohab_documents d ON c.document_id = d.id
  WHERE d.stage = 2
  ORDER BY c.profile_id, c.signed_at DESC
),
active_subscription AS (
  SELECT DISTINCT ON (profile_id)
    profile_id,
    status,
    end_date
  FROM public.cohab_subscriptions
  WHERE status = 'active'
  ORDER BY profile_id, end_date DESC NULLS LAST
),
recent_incident AS (
  SELECT DISTINCT ON (profile_id)
    profile_id,
    severity,
    body_part,
    description
  FROM public.cohab_incidents
  WHERE occurred_at >= (now() - INTERVAL '7 days')
  ORDER BY profile_id, occurred_at DESC
)
SELECT
  p.id AS profile_id,
  p.name,
  p.email,
  p.rut,
  p.parent_id,
  p.birthdate,
  p.belt,
  p.graus,
  p.trial_classes_used,
  p.max_trial_classes,
  -- Grupo etario automático
  CASE
    WHEN p.birthdate IS NULL THEN 'desconocido'
    WHEN (CURRENT_DATE - p.birthdate) / 365 < 8 THEN 'sub8'
    WHEN (CURRENT_DATE - p.birthdate) / 365 BETWEEN 8 AND 13 THEN 'infantil'
    WHEN (CURRENT_DATE - p.birthdate) / 365 BETWEEN 14 AND 17 THEN 'adolescente'
    ELSE 'adulto'
  END AS age_group,
  -- Salud y Alertas
  COALESCE(h.risk_level, 'green') AS risk_level,
  h.alert_summary,
  h.certificate_verified,
  -- Incidentes activos
  (inc.profile_id IS NOT NULL) AS has_active_incident,
  inc.body_part AS incident_body_part,
  -- Estado consolidado
  CASE
    -- 1. Restringido por lesión reciente
    WHEN inc.profile_id IS NOT NULL THEN 'restringido'
    -- 2. Alerta médica roja sin certificado validado ni visado
    WHEN h.risk_level = 'red' AND (h.certificate_verified IS NOT TRUE) THEN 'revision'
    -- 3. Etapa 2 formalizada con suscripción activa y aprobada
    WHEN s2.approval_status = 'approved' AND (sub.status = 'active' AND (sub.end_date IS NULL OR sub.end_date >= CURRENT_DATE)) THEN 'vigente'
    -- 4. Etapa 2 con cuota por vencer en menos de 5 días
    WHEN s2.approval_status = 'approved' AND sub.end_date IS NOT NULL AND sub.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '5 days') THEN 'por_vencer'
    -- 5. Etapa 2 firmada pero con cuota vencida
    WHEN s2.profile_id IS NOT NULL AND (sub.status IS NULL OR sub.end_date < CURRENT_DATE) THEN 'vencido'
    -- 6. En período de prueba (Etapa 1 firmada con clases disponibles)
    WHEN s1.profile_id IS NOT NULL AND COALESCE(p.trial_classes_used, 0) < COALESCE(p.max_trial_classes, 2) THEN 'prueba'
    -- 7. Clases de prueba agotadas sin pasar a Etapa 2
    WHEN s1.profile_id IS NOT NULL AND COALESCE(p.trial_classes_used, 0) >= COALESCE(p.max_trial_classes, 2) AND s2.profile_id IS NULL THEN 'vencido'
    -- 8. Incompleto
    ELSE 'incompleto'
  END AS student_status
FROM public.cohab_profiles p
LEFT JOIN latest_health h ON p.id = h.profile_id
LEFT JOIN stage1_consent s1 ON p.id = s1.profile_id
LEFT JOIN stage2_consent s2 ON p.id = s2.profile_id
LEFT JOIN active_subscription sub ON p.id = sub.profile_id
LEFT JOIN recent_incident inc ON p.id = inc.profile_id;

-- 11. FUNCIÓN RÁPIDA PARA EL MODO TATAMI (Instructor)
-- Retorna sólo los datos necesarios para la clase: salud preventiva y emergencias, sin datos financieros.
CREATE OR REPLACE FUNCTION public.cohab_get_tatami_roster(p_group TEXT DEFAULT NULL)
RETURNS TABLE (
  profile_id UUID,
  name TEXT,
  belt TEXT,
  graus INT,
  age_group TEXT,
  student_status TEXT,
  risk_level TEXT,
  alert_summary TEXT,
  has_active_incident BOOLEAN,
  primary_emergency_name TEXT,
  primary_emergency_phone TEXT
) SECURITY DEFINER STABLE AS $$
BEGIN
  -- Verificar que sea instructor o admin
  IF NOT (public.cohab_is_instructor()) THEN
    RAISE EXCEPTION 'Acceso restringido al cuerpo de instructores.';
  END IF;

  RETURN QUERY
  SELECT
    s.profile_id,
    s.name,
    s.belt,
    s.graus,
    s.age_group,
    s.student_status,
    s.risk_level,
    s.alert_summary,
    s.has_active_incident,
    ec.name AS primary_emergency_name,
    ec.phone AS primary_emergency_phone
  FROM public.cohab_student_status s
  LEFT JOIN LATERAL (
    SELECT name, phone FROM public.cohab_emergency_contacts
    WHERE profile_id = s.profile_id
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1
  ) ec ON true
  WHERE (p_group IS NULL OR s.age_group = p_group)
  ORDER BY s.name ASC;
END;
$$ LANGUAGE plpgsql;

-- 12. TRIGGER DE VISADO INTELIGENTE AUTOMÁTICO AL REGISTRAR CONSENTIMIENTO
-- Si el alumno no tiene riesgo rojo, queda automáticamente aprobado.
CREATE OR REPLACE FUNCTION public.trg_auto_approve_consent()
RETURNS TRIGGER AS $$
DECLARE
  v_risk_level TEXT;
BEGIN
  -- Consultar último nivel de riesgo del alumno
  SELECT risk_level INTO v_risk_level
  FROM public.cohab_health_records
  WHERE profile_id = NEW.profile_id
  ORDER BY created_at DESC LIMIT 1;

  -- Si es verde o amarillo, se auto-aprueba
  IF v_risk_level IS NULL OR v_risk_level IN ('green', 'yellow') THEN
    NEW.approval_status := 'approved';
    NEW.approval_type := 'automatic';
    NEW.approved_at := now();
    NEW.approval_notes := 'Visado automático inteligente institucional COHAB BJJ.';
  ELSE
    -- Si es rojo, requiere aprobación manual de administración
    NEW.approval_status := 'pending';
    NEW.approval_type := 'manual';
    NEW.approval_notes := 'Pendiente de validación de certificado médico por Administración.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_consent_inserted_auto_approve ON public.cohab_consents;
CREATE TRIGGER on_consent_inserted_auto_approve
  BEFORE INSERT ON public.cohab_consents
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_auto_approve_consent();

-- ==============================================================================
-- 13. SEED INICIAL: TEMPORADA 2026 Y DOCUMENTOS OFICIALES
-- ==============================================================================
INSERT INTO public.cohab_seasons (year, name, starts_on, ends_on, is_active)
VALUES (2026, 'Temporada 2026', '2026-01-01', '2026-12-31', true)
ON CONFLICT (year) DO UPDATE SET is_active = true;

-- Carga de Protocolo v5 (Etapa 2) para cada grupo
INSERT INTO public.cohab_documents (code, title, version, stage, target_audience, content_md)
VALUES 
(
  'protocolo_v5', 
  'Protocolo de Compromiso del Alumno - Sub-8 (Apoderado)', 
  5, 
  2, 
  'sub8',
  '# PROTOCOLO DE COMPROMISO DEL ALUMNO — SUB-8\n\n**COHAB Los Andes · Sección Brazilian Jiu-Jitsu**\n\n### I. DEBERES DEL APODERADO\n1. **Puntualidad:** Traigo a mi hijo/a a tiempo y lo retiro puntualmente. Aviso si no podrá asistir.\n2. **Respeto:** Refuerzo en casa el respeto hacia instructores y compañeros. No hablo negativamente del club frente a mi hijo/a.\n3. **No agredir:** Monitoreo su comportamiento fuera del dojo. Informo al instructor cualquier incidente en menos de 24 horas.\n4. **Higiene:** Ropa limpia, kimono lavado regularmente y uñas cortas.\n5. **Actitud:** Fomento una actitud positiva, sin presiones excesivas de rendimiento.\n6. **Sparring:** El sparring es aprendizaje y cuidado mutuo, no fuerza. Converso sobre el respeto al tap.\n7. **Valores:** Soy el principal modelo de conducta para mi hijo/a.\n8. **Comunicación:** Informo dificultades físicas o emocionales.\n9. **Mensualidad:** Pago los primeros 5 días de cada mes.\n10. **Espacio:** Aguardo fuera del tatami sin interrumpir. No ingreso sin autorización.\n11. **Reuniones:** Asisto a las 4 reuniones bimestrales de apoderados (Junio, Agosto, Octubre, Diciembre).'
),
(
  'protocolo_v5', 
  'Protocolo de Compromiso del Alumno - Infantil 8-13 años (Apoderado)', 
  5, 
  2, 
  'infantil',
  '# PROTOCOLO DE COMPROMISO DEL ALUMNO — 8 A 13 AÑOS\n\n**COHAB Los Andes · Sección Brazilian Jiu-Jitsu**\n\n### I. DEBERES DEL APODERADO\n1. **Puntualidad:** Llegada y retiro puntual. Aviso con anticipación si no podrá asistir.\n2. **Respeto:** Los valores de respeto en casa influyen directamente en el menor.\n3. **No agredir:** Converso con él/ella sobre el uso responsable del BJJ como arte de defensa y nunca de agresión.\n4. **Higiene:** Fomento que desde los 10 años asuma la responsabilidad de su propio aseo y kimono.\n5. **Actitud:** Fomento la constancia y la humildad personal.\n6. **Sparring:** Evito transmitir expectativas de ganar por encima del cuidado del compañero.\n7. **Valores:** Refuerzo los valores del BJJ en familia y comunidad.\n8. **Comunicación:** Comunicación activa con el profesor para su bienestar.\n9. **Mensualidad:** Pago en los primeros 5 días del mes.\n10. **Espacio:** Aguardo fuera del tatami sin interrumpir la clase.\n11. **Reuniones:** Asisto a las 4 reuniones bimestrales obligatorias (Junio, Agosto, Octubre, Diciembre).'
),
(
  'protocolo_v5', 
  'Protocolo de Compromiso del Alumno - Adolescente 14-17 años (Apoderado)', 
  5, 
  2, 
  'adolescente',
  '# PROTOCOLO DE COMPROMISO DEL ALUMNO — 14 A 17 AÑOS\n\n**COHAB Los Andes · Sección Brazilian Jiu-Jitsu**\n\n### I. DEBERES DEL APODERADO Y DEL ALUMNO\n1. **Puntualidad:** La clase de adultos exige la misma disciplina horaria.\n2. **Respeto:** Exijo respeto mutuo dentro y fuera del dojo al entrenar con adultos.\n3. **No agredir:** Monitoreo estricto del uso del BJJ fuera del dojo.\n4. **Higiene:** Autonomía completa en la higiene personal y del kimono.\n5. **Actitud:** Apoyo en su proceso de aprendizaje gradual en entorno adulto.\n6. **Sparring:** Entrena bajo supervisión del instructor respetando incondicionalmente el tap.\n7. **Valores:** El BJJ es un ancla positiva fundamental durante la adolescencia.\n8. **Comunicación:** Comunicación constante con el profesor.\n9. **Mensualidad:** Pago en los primeros 5 días del mes.\n10. **Espacio:** Respeto al silencio y concentración en la clase de adultos.\n11. **Reuniones:** Asisto a las 4 reuniones bimestrales obligatorias.'
),
(
  'protocolo_v5', 
  'Protocolo de Compromiso del Alumno - Adulto 18+', 
  5, 
  2, 
  'adulto',
  '# PROTOCOLO DE COMPROMISO DEL ALUMNO — ADULTO 18+\n\n**COHAB Los Andes · Sección Brazilian Jiu-Jitsu**\n\n### I. DEBERES DEL PRACTICANTE\n1. **Puntualidad:** Llego a tiempo. Si llego tarde, espero en la entrada hasta que el instructor autorice el ingreso.\n2. **Respeto:** Respeto total a instructores, compañeros y visitas. Prohibida toda agresión verbal.\n3. **No agredir fuera del dojo:** El BJJ es para defensa personal y deporte. Usarlo para agredir es causa de expulsión inmediata.\n4. **Higiene:** Kimono o rashguard limpia, uñas cortadas, higiene rigurosa.\n5. **Actitud:** Humildad, escucha activa y disposición a aprender.\n6. **Sparring:** Control técnico absoluto. **Cuando alguien toca (tap), suelto de inmediato. Siempre.**\n7. **Conducta:** Represento a COHAB con honestidad, integridad y solidaridad.\n8. **Comunicación:** Informo oportunamente cualquier lesión o problema físico.\n9. **Mensualidad:** Pago oportuno los primeros 5 días de cada mes.\n10. **Espacio sagrado:** No comer ni usar celular durante la clase. Cuidado de las instalaciones.'
),
(
  'riesgos_prueba',
  'Declaración de Salud y Aceptación de Riesgos (Clase de Prueba)',
  1,
  1,
  'todos',
  '# DECLARACIÓN DE SALUD Y ACEPTACIÓN DE RIESGOS PARA CLASE DE PRUEBA\n\nDeclaro que la información de salud entregada es fidedigna y que no padezco afecciones cardíacas o lesiones que impidan la práctica de actividad física moderada a intensa sin autorización médica.\n\nComprendo y acepto que el Brazilian Jiu-Jitsu es un deporte de contacto que implica caídas, llaves y desplazamientos en tatami, asumiendo la responsabilidad de seguir en todo momento las instrucciones del cuerpo técnico para prevenir lesiones.'
)
ON CONFLICT (code, version, target_audience) DO NOTHING;
