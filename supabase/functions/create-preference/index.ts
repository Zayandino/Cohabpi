import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.0.8"
import { createAdminClient, getPublicSupabaseUrl } from "../_shared/supabase.ts"
import { fulfillCheckoutSession } from "../_shared/fulfillment.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const { checkout_session_id, payer_id, payer_email, total_amount, origin_url } = await req.json()

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

    const preference = new Preference(new MercadoPagoConfig({ accessToken }))

    const result = await preference.create({
      body: {
        items: [{
          id: 'suscripcion-cohab',
          title: 'Suscripciones Cohab Los Andes',
          quantity: 1,
          unit_price: Math.round(total_amount),
          currency_id: 'CLP',
        }],
        payer: {
          email: payer_email || `${payer_id}@cohab.app`
        },
        back_urls: {
          success: returnUrl('aprobado'),
          failure: returnUrl('rechazado'),
          pending: returnUrl('pendiente'),
        },
        // Valor documentado por Mercado Pago: retorno automático solo en pagos aprobados
        auto_return: 'approved',
        // Debe ser una URL pública: Mercado Pago no puede alcanzar la red interna de Docker
        notification_url: `${getPublicSupabaseUrl()}/functions/v1/mp-webhook`,
        // El external_reference es el ID de la sesión del carrito
        external_reference: checkout_session_id,
        statement_descriptor: 'Cohab Los Andes',
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
    })

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
