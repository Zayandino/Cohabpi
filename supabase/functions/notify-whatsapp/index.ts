import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createAdminClient } from "../_shared/supabase.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'http://evolution-api:8080'
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'Garage2115Secr3tToken!'
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') || 'cohab'

/**
 * Limpia y normaliza el número de teléfono para WhatsApp Chile (569XXXXXXXX)
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('56') && cleaned.length === 11) {
    return cleaned
  }
  if (cleaned.startsWith('9') && cleaned.length === 9) {
    return `56${cleaned}`
  }
  if (cleaned.length === 8) {
    return `569${cleaned}`
  }
  return cleaned
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, event_type, to_phone, to_name, message } = body

    // 1. Consultar estado o QR de la instancia WhatsApp
    if (action === 'get_status') {
      try {
        const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
          headers: { apikey: EVOLUTION_API_KEY },
          signal: AbortSignal.timeout(4000)
        })
        const stateData = await stateRes.json()
        const currentState = stateData?.instance?.state || stateData?.state || 'close'
        const isConnected = currentState === 'open'

        let qrcode = null
        if (!isConnected) {
          try {
            const qrRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}`, {
              headers: { apikey: EVOLUTION_API_KEY },
              signal: AbortSignal.timeout(4000)
            })
            const qrData = await qrRes.json()
            qrcode = qrData?.base64 || qrData?.qrcode?.base64 || null
          } catch (qrErr) {
            console.error('Error fetching QR:', qrErr)
          }
        }

        return jsonResponse({
          success: true,
          connected: isConnected,
          status: currentState,
          qrcode
        })
      } catch (err: any) {
        return jsonResponse({
          success: false,
          connected: false,
          error: err.message
        })
      }
    }

    // 2. Enviar mensaje de WhatsApp
    if (!to_phone || !message) {
      return jsonResponse({ error: 'to_phone and message are required' }, 400)
    }

    const cleanNumber = normalizePhone(to_phone)
    if (cleanNumber.length < 10) {
      return jsonResponse({ error: `Invalid phone number: ${to_phone}` }, 400)
    }

    // A. Verificar primero si la instancia está abierta antes de intentar enviar
    let isConnected = false
    try {
      const checkRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`, {
        headers: { apikey: EVOLUTION_API_KEY },
        signal: AbortSignal.timeout(3000)
      })
      const checkData = await checkRes.json()
      const st = checkData?.instance?.state || checkData?.state
      if (st === 'open') {
        isConnected = true
      }
    } catch (checkErr) {
      console.warn('Could not verify evolution instance state:', checkErr)
    }

    let sent = false
    let evolutionResponse: any = null
    let errorMsg: string | null = null

    if (isConnected) {
      try {
        const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: cleanNumber,
            text: message,
          }),
          signal: AbortSignal.timeout(6000)
        })

        evolutionResponse = await sendRes.json()
        if (sendRes.ok && (evolutionResponse?.key || evolutionResponse?.status === 'PENDING' || evolutionResponse?.messageTimestamp)) {
          sent = true
        } else {
          errorMsg = evolutionResponse?.message || evolutionResponse?.error || JSON.stringify(evolutionResponse)
        }
      } catch (sendErr: any) {
        errorMsg = sendErr.message
      }
    } else {
      errorMsg = 'Instancia de WhatsApp desconectada (close). Escanea el código QR para vincular el número.'
    }

    // B. Registrar en cohab_whatsapp_logs (sin bloquear si la BD tarda)
    try {
      const supabase = createAdminClient()
      await supabase.from('cohab_whatsapp_logs').insert({
        event_type: event_type || 'CUSTOM',
        recipient_phone: cleanNumber,
        recipient_name: to_name || null,
        message,
        status: sent ? 'sent' : 'failed',
        error_message: errorMsg,
      })
    } catch (logErr) {
      console.error('Error logging whatsapp message to db:', logErr)
    }

    return jsonResponse({
      success: sent,
      recipient: cleanNumber,
      status: sent ? 'sent' : 'failed',
      warning: sent ? null : errorMsg,
      evolutionResponse,
    })

  } catch (err: any) {
    console.error('Fatal error in notify-whatsapp:', err)
    return jsonResponse({ error: err.message }, 500)
  }
})
