import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.0.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS para peticiones del frontend
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { items, profile_id, service_id, months, origin_url } = await req.json()

    if (!items || !profile_id || !service_id || !months) {
      throw new Error("Missing required parameters for payment.")
    }

    // 1. Instanciar SDK MercadoPago con el token secreto
    const client = new MercadoPagoConfig({ 
      accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    })
    const preference = new Preference(client)

    // external_reference nos sirve para saber qué acreditar cuando llega el Webhook
    const externalReference = `${profile_id}_${service_id}_${months}`

    // 2. Crear Preferencia de Pago
    const result = await preference.create({
      body: {
        items: items.map((item: any) => ({
          id: item.id || service_id,
          title: item.title,
          quantity: item.quantity,
          unit_price: Math.round(item.unit_price), // MP exige enteros
          currency_id: 'CLP',
        })),
        payer: {
          email: `${profile_id}@cohab.app` // Email ficticio o puedes pasar el real
        },
        back_urls: {
          success: `${origin_url}/feedback.html?status=success`,
          failure: `${origin_url}/feedback.html?status=failure`,
          pending: `${origin_url}/feedback.html?status=pending`,
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
