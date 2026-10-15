import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Payment } from "npm:mercadopago@2.0.8"
import { createAdminClient } from "../_shared/supabase.ts"
import { fulfillCheckoutSession } from "../_shared/fulfillment.ts"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const bodyText = await req.text()
    const notification = bodyText ? JSON.parse(bodyText) : {}

    if (notification.type !== 'payment' && url.searchParams.get('type') !== 'payment') {
      return new Response('ok', { status: 200 })
    }

    const paymentId = notification.data?.id || url.searchParams.get('data.id')
    if (!paymentId) {
      return new Response('no payment id', { status: 400 })
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado')

    // Siempre se consulta el pago a Mercado Pago (no se confía en el body recibido)
    const paymentData = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: paymentId })
    const sessionId = paymentData.external_reference

    if (paymentData.status !== 'approved' || !sessionId) {
      return json({ ok: true, status: paymentData.status })
    }

    const result = await fulfillCheckoutSession(createAdminClient(), sessionId, {
      amount: paymentData.transaction_amount ?? 0,
      method: 'mercadopago',
    })

    return json({ ok: true, result })
  } catch (error: any) {
    console.error("IPN Error:", error)
    // 500 para que Mercado Pago reintente la notificación
    return json({ error: error.message }, 500)
  }
})
