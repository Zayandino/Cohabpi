import { supabase } from '../lib/supabaseClient';

/**
 * Notifica al Administrador (Eduardo Ambler) que un alumno informó una transferencia.
 */
export async function notifyAdminTransferReported({ studentName, studentEmail, studentPhone, amount, notes, bankPhone }) {
  try {
    const formattedAmount = Number(amount || 0).toLocaleString('es-CL');
    const message = [
      '🥋 *COHAB BJJ - Transferencia Informada*',
      '',
      `El alumno *${studentName || 'Alumno'}* (${studentEmail || 'Sin email'}) ha informado una transferencia bancaria de *$${formattedAmount} CLP*.`,
      studentPhone ? `📱 Teléfono: ${studentPhone}` : '',
      notes ? `📝 *Nota:* ${notes}` : '',
      '',
      '👉 Ingresa al panel de administración para validar el pago y habilitar el acceso.'
    ].filter(Boolean).join('\n');

    const targetPhone = bankPhone || '+56957394280';

    await supabase.functions.invoke('notify-whatsapp', {
      body: {
        to_phone: targetPhone,
        to_name: 'Eduardo Ambler',
        message,
        event_type: 'TRANSFER_REPORTED'
      }
    });
  } catch (err) {
    console.warn('No se pudo enviar notificación de WhatsApp al admin (no crítico):', err);
  }
}

/**
 * Notifica al Alumno que su pago fue aprobado y su membresía está activa.
 */
export async function notifyStudentPaymentApproved({ studentName, studentPhone, amount, validUntil }) {
  try {
    if (!studentPhone) {
      console.warn('El alumno no tiene teléfono registrado para WhatsApp');
      return;
    }

    const formattedAmount = amount ? Number(amount).toLocaleString('es-CL') : null;
    const message = [
      '🥋 *COHAB BJJ - Membresía Habilitada*',
      '',
      `¡Hola *${studentName || 'Estimado(a)'}*! Tu pago de membresía${formattedAmount ? ` por *$${formattedAmount} CLP*` : ''} ha sido validado exitosamente.`,
      '',
      `📅 Tu acceso al tatami se encuentra habilitado hasta el *${validUntil || 'próximo mes'}*.`,
      '',
      '¡Nos vemos en el tatami! *Oss.*'
    ].filter(Boolean).join('\n');

    await supabase.functions.invoke('notify-whatsapp', {
      body: {
        to_phone: studentPhone,
        to_name: studentName,
        message,
        event_type: 'PAYMENT_APPROVED'
      }
    });
  } catch (err) {
    console.warn('No se pudo enviar notificación de WhatsApp al alumno (no crítico):', err);
  }
}

/**
 * Consulta el estado de conexión de la instancia de WhatsApp en Evolution API.
 */
export async function getWhatsAppStatus() {
  try {
    const { data, error } = await supabase.functions.invoke('notify-whatsapp', {
      body: { action: 'get_status' }
    });
    if (error) throw error;
    return data || { connected: false, status: 'close' };
  } catch (err) {
    console.error('Error al consultar estado de WhatsApp:', err);
    return { connected: false, status: 'error', error: err.message };
  }
}
