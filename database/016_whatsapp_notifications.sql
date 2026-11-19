-- Migration: 016_whatsapp_notifications.sql
-- Description: Configuración de teléfono de notificación y registro de WhatsApp

SET ROLE supabase_admin;

-- 1. Agregar columna whatsapp_notification_phone a cohab_bank_settings si no existe
ALTER TABLE public.cohab_bank_settings
ADD COLUMN IF NOT EXISTS whatsapp_notification_phone text DEFAULT '+56957394280';

UPDATE public.cohab_bank_settings
SET whatsapp_notification_phone = '+56957394280'
WHERE id = 1 AND (whatsapp_notification_phone IS NULL OR whatsapp_notification_phone = '');

-- 2. Tabla para bitácora y auditoría de mensajes WhatsApp
CREATE TABLE IF NOT EXISTS public.cohab_whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'TRANSFER_REPORTED', 'PAYMENT_APPROVED', etc.
  recipient_phone text NOT NULL,
  recipient_name text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'sent', 'failed'
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS para logs de WhatsApp
ALTER TABLE public.cohab_whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo admins pueden ver logs de WhatsApp"
ON public.cohab_whatsapp_logs
FOR SELECT
TO authenticated
USING (public.cohab_is_admin());

CREATE POLICY "Edge functions y service role pueden insertar logs"
ON public.cohab_whatsapp_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Otorgar permisos
GRANT ALL ON TABLE public.cohab_whatsapp_logs TO authenticated;
GRANT ALL ON TABLE public.cohab_whatsapp_logs TO service_role;
