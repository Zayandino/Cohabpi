import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

export interface PaymentInfo {
  amount: number
  method: 'mercadopago' | 'beca_100'
}

export type FulfillResult = 'fulfilled' | 'already_processed'

/**
 * Calcula el periodo de una suscripción. Si existe una vigente,
 * la nueva comienza cuando termina la actual (renovación encadenada).
 */
export function computeSubscriptionPeriod(
  activeEndDate: string | null | undefined,
  months: number,
  now: Date = new Date(),
): { start_date: string; end_date: string } {
  const activeEnd = activeEndDate ? new Date(activeEndDate) : null
  const start = activeEnd && activeEnd > now ? new Date(activeEnd) : new Date(now)
  const end = new Date(start)
  // Se usa UTC para evitar desfases de un día por cambios de horario de verano
  end.setUTCMonth(end.getUTCMonth() + months)
  return { start_date: toDateString(start), end_date: toDateString(end) }
}

/** Devuelve las personas del carrito con al menos un servicio, resolviendo 'main' al pagador. */
export function resolveEnrollments(
  enrollments: Record<string, Array<{ serviceId?: string; id?: string }>>,
  payerId: string,
): Array<{ personId: string; serviceIds: string[] }> {
  return Object.entries(enrollments || {})
    .filter(([, services]) => (services || []).length > 0)
    .map(([key, services]) => ({
      personId: key === 'main' ? payerId : key,
      serviceIds: services.map((s) => (s.serviceId || s.id) as string).filter(Boolean),
    }))
}

/** Marca la sesión como completada, registra el pago y activa perfiles/suscripciones. */
export async function fulfillCheckoutSession(
  admin: SupabaseClient,
  sessionId: string,
  payment: PaymentInfo,
): Promise<FulfillResult> {
  const { data: session, error } = await admin
    .from('cohab_checkout_sessions').select('*').eq('id', sessionId).maybeSingle()
  if (error) throw new Error(`Error leyendo sesión ${sessionId}: ${error.message}`)
  if (!session || session.status === 'completed') return 'already_processed'

  // Bloqueo optimista: solo una ejecución puede pasar de pending -> completed
  const { data: locked, error: lockError } = await admin
    .from('cohab_checkout_sessions').update({ status: 'completed' })
    .eq('id', sessionId).neq('status', 'completed').select('id')
  if (lockError) throw new Error(`Error completando sesión: ${lockError.message}`)
  if (!locked || locked.length === 0) return 'already_processed'

  await check(admin.from('cohab_payments').insert({
    profile_id: session.payer_id,
    amount: payment.amount,
    status: 'approved',
    payment_method: payment.method,
  }), 'registrar pago')

  const { months = 1, enrollments = {} } = session.cart_data || {}
  for (const person of resolveEnrollments(enrollments, session.payer_id)) {
    await activatePerson(admin, person.personId, person.serviceIds, months)
  }
  return 'fulfilled'
}

async function activatePerson(admin: SupabaseClient, personId: string, serviceIds: string[], months: number) {
  await check(admin.from('cohab_profiles').update({ status: 'activo' }).eq('id', personId), 'activar perfil')

  for (const serviceId of serviceIds) {
    const { data: activeSub, error } = await admin
      .from('cohab_subscriptions').select('end_date')
      .eq('profile_id', personId).eq('service_id', serviceId).eq('status', 'active')
      .order('end_date', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error(`Error buscando suscripción: ${error.message}`)

    const period = computeSubscriptionPeriod(activeSub?.end_date, months)
    await check(admin.from('cohab_subscriptions').insert({
      profile_id: personId, service_id: serviceId, status: 'active', ...period,
    }), 'crear suscripción')
  }
}

async function check(query: PromiseLike<{ error: { message: string } | null }>, action: string) {
  const { error } = await query
  if (error) throw new Error(`Error al ${action}: ${error.message}`)
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}
