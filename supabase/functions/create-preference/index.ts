import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.0.8"
import { createAdminClient, getPublicSupabaseUrl } from "../_shared/supabase.ts"
import { fulfillCheckoutSession } from "../_shared/fulfillment.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email de la cuenta recaudadora de Mercado Pago (para evitar bloqueo de auto-pago en pruebas del Admin)
const MP_COLLECTOR_EMAIL = 'ambler.eduardo@gmail.com'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      checkout_session_id,
      payer_id,
      payer_email,
      payer_name,
      total_amount,
      origin_url,
      installments,
      description,
    } = await req.json()

    if (!checkout_session_id || !payer_id || total_amount === undefined || !origin_url) {
      throw new Error("Missing required parameters for payment.")
    }

    const returnUrl = (status: string) => `${origin_url}/dashboard?pago=${status}`

    // Monto cero (beca 100%): se activa directamente sin pasar por Mercado Pago
    if (total_amount === 0) {
      const result = await fulfillCheckoutSession(createAdminClient(), checkout_session_id, {
        amount: 0,
        method: 'beca_100',
      })
      if (result === 'already_processed') throw new Error('Session already processed or not found')

      return jsonResponse({
        free_success: true,
        init_point: returnUrl('aprobado'),
        sandbox_init_point: returnUrl('aprobado'),
      })
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado')

    // Si el comprador tiene el mismo correo que la cuenta vendedora de Mercado Pago,
    // usamos un correo alias para que Checkout Pro no bloquee la pantalla por auto-pago.
    const rawEmail = (payer_email || '').trim().toLowerCase()
    const safePayerEmail = (!rawEmail || rawEmail === MP_COLLECTOR_EMAIL)
      ? `alumno.${String(payer_id).slice(0, 8)}@cohablosandes.cloud`
      : rawEmail

    const preference = new Preference(new MercadoPagoConfig({ accessToken }))

    const prefBody: Record<string, unknown> = {
      items: [{
        id: 'suscripcion-cohab',
        title: description || 'Membresía COHAB Los Andes',
        description: 'Suscripción de entrenamiento COHAB BJJ Los Andes',
        category_id: 'services',
        quantity: 1,
        unit_price: Math.round(Number(total_amount)),
        currency_id: 'CLP',
      }],
      payer: {
        email: safePayerEmail,
        ...(payer_name ? { name: String(payer_name).trim() } : {}),
      },
      back_urls: {
        success: returnUrl('aprobado'),
        failure: returnUrl('rechazado'),
        pending: returnUrl('pendiente'),
      },
      auto_return: 'approved',
      binary_mode: false,
      notification_url: `${getPublicSupabaseUrl()}/functions/v1/mp-webhook`,
      external_reference: checkout_session_id,
      statement_descriptor: 'COHAB LOS ANDES',
      expires: true,
      expiration_date_to: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    }

    if (installments && Number(installments) > 0) {
      prefBody.payment_methods = {
        default_installments: Number(installments),
      }
    }

    const result = await preference.create({ body: prefBody as any })

    return jsonResponse({
      preference_id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point
    })
  } catch (error: any) {
    console.error('create-preference error:', error)
    return jsonResponse({ error: error.message }, 400)
  }
})
