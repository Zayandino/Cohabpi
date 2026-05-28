import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.0.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { checkout_session_id, payer_id, total_amount, origin_url } = await req.json()

    if (!checkout_session_id || !payer_id || !total_amount) {
      throw new Error("Missing required parameters for payment.")
    }

    const client = new MercadoPagoConfig({ 
      accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    })
    const preference = new Preference(client)

    // El external_reference será el ID de la sesión del carrito
    const externalReference = checkout_session_id

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
          email: `${payer_id}@cohab.app` 
        },
        back_urls: {
          success: `${origin_url}/payments`,
          failure: `${origin_url}/payments`,
          pending: `${origin_url}/payments`,
        },
        auto_return: 'approved',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
        external_reference: externalReference,
        statement_descriptor: 'Cohab Los Andes',
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
    })

    return new Response(JSON.stringify({ 
      preference_id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
