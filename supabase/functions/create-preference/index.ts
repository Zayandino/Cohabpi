import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.0.8"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { checkout_session_id, payer_id, payer_email, total_amount, origin_url } = await req.json()

    if (!checkout_session_id || !payer_id || total_amount === undefined) {
      throw new Error("Missing required parameters for payment.")
    }

    if (total_amount === 0) {
      // Process free subscription directly
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      )
      
      const { data: session } = await supabaseAdmin
        .from('cohab_checkout_sessions')
        .select('*')
        .eq('id', checkout_session_id)
        .single()

      if (!session || session.status === 'completed') {
        throw new Error('Session already processed or not found')
      }

      const { payer_id: session_payer_id, cart_data } = session;
      const { months = 1, enrollments = {} } = cart_data;

      // 2. Marcar la sesión como completada
      await supabaseAdmin
        .from('cohab_checkout_sessions')
        .update({ status: 'completed' })
        .eq('id', checkout_session_id)

      // 3. Registrar el pago global como beca o free
      await supabaseAdmin
        .from('cohab_payments')
        .insert({
          profile_id: session_payer_id,
          amount: 0,
          status: 'approved',
          payment_method: 'beca_100',
        })

      // 4. Procesar el carrito (iterar sobre las personas y sus servicios)
      const activePeople = Object.keys(enrollments).filter(pId => (enrollments[pId] || []).length > 0);
      
      for (const personId of activePeople) {
        const actualPersonId = personId === 'main' ? session_payer_id : personId;
        const personServices = enrollments[personId] || [];

        // Activar el perfil
        await supabaseAdmin
          .from('cohab_profiles')
          .update({ status: 'activo' })
          .eq('id', actualPersonId);

        // Activar servicios
        for (const entry of personServices) {
          const serviceId = entry.serviceId || entry.id;
          
          // Buscar si ya tiene el servicio activo
          const { data: activeSub } = await supabaseAdmin
            .from('cohab_subscriptions')
            .select('*')
            .eq('profile_id', actualPersonId)
            .eq('service_id', serviceId)
            .eq('status', 'active')
            .order('end_date', { ascending: false })
            .limit(1)
            .single()

          let newStartDate = new Date()
          let newEndDate = new Date()

          if (activeSub && new Date(activeSub.end_date) > new Date()) {
            newStartDate = new Date(activeSub.end_date)
            newEndDate = new Date(activeSub.end_date)
          }

          newEndDate.setMonth(newEndDate.getMonth() + months)

          await supabaseAdmin
            .from('cohab_subscriptions')
            .insert({
              profile_id: actualPersonId,
              service_id: serviceId,
              status: 'active',
              start_date: newStartDate.toISOString().split('T')[0],
              end_date: newEndDate.toISOString().split('T')[0]
            })
        }
      }

      return new Response(JSON.stringify({ 
        free_success: true,
        init_point: `${origin_url}/beneficios?pago=aprobado`,
        sandbox_init_point: `${origin_url}/beneficios?pago=aprobado`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
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
          email: payer_email || `${payer_id}@cohab.app`
        },
        back_urls: {
          success: `${origin_url}/beneficios?pago=aprobado`,
          failure: `${origin_url}/beneficios?pago=rechazado`,
          pending: `${origin_url}/beneficios?pago=pendiente`,
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
