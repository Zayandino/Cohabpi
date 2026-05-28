import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Payment } from "npm:mercadopago@2.0.8"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const dataId = url.searchParams.get('data.id')
    const type = url.searchParams.get('type')
    
    const bodyText = await req.text()
    const notification = bodyText ? JSON.parse(bodyText) : {}

    if (notification.type !== 'payment' && type !== 'payment') {
      return new Response('ok', { status: 200 })
    }

    const paymentId = notification.data?.id || dataId

    if (!paymentId) {
      return new Response('no payment id', { status: 400 })
    }

    const client = new MercadoPagoConfig({ 
      accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    })
    const payment = new Payment(client)
    const paymentData = await payment.get({ id: paymentId })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const extRef = paymentData.external_reference // checkout_session_id
    const status = paymentData.status

    if (status === 'approved' && extRef) {
      
      // 1. Obtener la sesión del carrito
      const { data: session } = await supabaseAdmin
        .from('cohab_checkout_sessions')
        .select('*')
        .eq('id', extRef)
        .single()

      if (!session || session.status === 'completed') {
        return new Response(JSON.stringify({ ok: true, msg: 'Session already processed or not found' }), { status: 200 })
      }

      const { payer_id, total_amount, cart_data } = session;
      const { months = 1, enrollments = {} } = cart_data;

      // 2. Marcar la sesión como completada
      await supabaseAdmin
        .from('cohab_checkout_sessions')
        .update({ status: 'completed' })
        .eq('id', extRef)

      // 3. Registrar el pago global
      await supabaseAdmin
        .from('cohab_payments')
        .insert({
          profile_id: payer_id,
          amount: total_amount,
          status: 'approved',
          payment_method: 'mercadopago',
        })

      // 4. Procesar el carrito (iterar sobre las personas y sus servicios)
      const activePeople = Object.keys(enrollments).filter(pId => (enrollments[pId] || []).length > 0);
      
      for (const personId of activePeople) {
        const actualPersonId = personId === 'main' ? payer_id : personId;
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
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (error: any) {
    console.error("IPN Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
