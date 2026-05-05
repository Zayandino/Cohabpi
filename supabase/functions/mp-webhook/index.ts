import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { MercadoPagoConfig, Payment } from "npm:mercadopago@2.0.8"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const dataId = url.searchParams.get('data.id')
    const type = url.searchParams.get('type')
    
    // Mercado Pago envía notificaciones POST con un body JSON
    const bodyText = await req.text()
    const notification = bodyText ? JSON.parse(bodyText) : {}

    // Solo nos interesa procesar pagos (payments)
    if (notification.type !== 'payment' && type !== 'payment') {
      return new Response('ok', { status: 200 })
    }

    const paymentId = notification.data?.id || dataId

    if (!paymentId) {
      return new Response('no payment id', { status: 400 })
    }

    // 1. Instanciar MP SDK
    const client = new MercadoPagoConfig({ 
      accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''
    })
    const payment = new Payment(client)
    
    // Obtener los detalles reales del pago para evitar fraudes (Spoofing)
    const paymentData = await payment.get({ id: paymentId })

    // 2. Instanciar Supabase con Service Role Key (Bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const extRef = paymentData.external_reference
    const status = paymentData.status

    // Solo procesamos pagos correctamente aprobados
    if (status === 'approved' && extRef) {
      // El formato de la referencia es 'profileId_serviceId_months'
      const parts = extRef.split('_')
      if (parts.length === 3) {
        const profileId = parts[0]
        const serviceId = parts[1]
        const months = parseInt(parts[2], 10)
        const totalAmount = paymentData.transaction_amount

        // a) Registrar transacción en cohab_payments
        await supabaseAdmin
          .from('cohab_payments')
          .insert({
            profile_id: profileId,
            amount: totalAmount,
            status: 'approved',
            payment_method: 'mercadopago',
          })

        // b) Buscar suscripción existente (activa)
        const { data: activeSub } = await supabaseAdmin
          .from('cohab_subscriptions')
          .select('*')
          .eq('profile_id', profileId)
          .eq('service_id', serviceId)
          .eq('status', 'active')
          .order('end_date', { ascending: false })
          .limit(1)
          .single()
        
        let newStartDate = new Date()
        let newEndDate = new Date()
        
        // Si ya hay suscripción activa, sumar el tiempo al finalizar ésta
        if (activeSub && new Date(activeSub.end_date) > new Date()) {
          newStartDate = new Date(activeSub.end_date)
          newEndDate = new Date(activeSub.end_date)
        }
        
        newEndDate.setMonth(newEndDate.getMonth() + months)

        // Invalidar registros anteriores si es la misma suscripción (Opcional, o solo dejar la nueva como la más reciente)
        // Insertar nuevo periodo de suscripción
        await supabaseAdmin
          .from('cohab_subscriptions')
          .insert({
            profile_id: profileId,
            service_id: serviceId,
            status: 'active',
            start_date: newStartDate.toISOString().split('T')[0],
            end_date: newEndDate.toISOString().split('T')[0]
          })
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (error: any) {
    console.error("IPN Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
