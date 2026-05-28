-- Crear tabla para manejar el carrito de compras multi-servicio
CREATE TABLE IF NOT EXISTS public.cohab_checkout_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payer_id UUID REFERENCES public.cohab_profiles(id) ON DELETE CASCADE,
  cart_data JSONB NOT NULL,
  total_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.cohab_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Politica: Los usuarios solo pueden ver y editar sus propias sesiones
CREATE POLICY "Users can insert their own checkout sessions" 
ON public.cohab_checkout_sessions FOR INSERT 
WITH CHECK (auth.uid() = payer_id);

CREATE POLICY "Users can view their own checkout sessions" 
ON public.cohab_checkout_sessions FOR SELECT 
USING (auth.uid() = payer_id);
