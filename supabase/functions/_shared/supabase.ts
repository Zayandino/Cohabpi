import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Devuelve la URL pública de Supabase.
 * En self-hosted, SUPABASE_URL apunta a la red interna de Docker (http://kong:8000),
 * que no es alcanzable desde fuera (ej. webhooks de Mercado Pago) y provoca
 * cuelgues en Deno. Por eso se prioriza SUPABASE_PUBLIC_URL.
 */
export function getPublicSupabaseUrl(env: (key: string) => string | undefined = Deno.env.get): string {
  const publicUrl = env('SUPABASE_PUBLIC_URL')
  if (publicUrl) return publicUrl.replace(/\/+$/, '')

  const internalUrl = env('SUPABASE_URL')
  if (internalUrl && !isInternalDockerUrl(internalUrl)) return internalUrl.replace(/\/+$/, '')

  throw new Error('SUPABASE_PUBLIC_URL no está configurada en el entorno de Edge Functions')
}

export function isInternalDockerUrl(url: string): boolean {
  return /\/\/(kong|localhost|127\.0\.0\.1)(:\d+)?/i.test(url)
}

/** Cliente con service role (solo uso en servidor). */
export function createAdminClient(): SupabaseClient {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada')
  return createClient(getPublicSupabaseUrl(), serviceKey)
}
