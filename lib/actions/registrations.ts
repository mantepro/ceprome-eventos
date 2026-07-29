'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'
import { confirmPayment } from '@/lib/actions/payments'
import type { Json } from '@/types/database'

type RegistrationStatus = 'draft' | 'pending' | 'paid' | 'cancelled' | 'refunded'

export async function updateRegistrationStatus(
  registrationId: string,
  newStatus: RegistrationStatus
): Promise<{ error?: string }> {
  // All payment confirmation logic lives in confirmPayment
  if (newStatus === 'paid') {
    return confirmPayment(registrationId)
  }

  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()

  if (newStatus === 'cancelled') {
    const { data: current } = await supabase
      .from('registrations')
      .select('status')
      .eq('id', registrationId)
      .single()

    if (current && current.status !== 'cancelled') {
      const { data: ticket } = await supabase
        .from('tickets')
        .select('ticket_type_id')
        .eq('registration_id', registrationId)
        .maybeSingle()

      if (ticket?.ticket_type_id) {
        const { data: ttRow } = await supabase
          .from('ticket_types')
          .select('sold_count')
          .eq('id', ticket.ticket_type_id)
          .single()
        if (ttRow) {
          await supabase
            .from('ticket_types')
            .update({ sold_count: Math.max(0, ttRow.sold_count - 1) })
            .eq('id', ticket.ticket_type_id)
        }
      }
    }
  }

  const { error } = await supabase
    .from('registrations')
    .update({ status: newStatus as 'draft' | 'pending' | 'paid' | 'cancelled' })
    .eq('id', registrationId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al actualizar el estado.' }

  revalidatePath('/admin/inscritos')
  return {}
}

export async function deleteRegistration(registrationId: string): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('status')
    .eq('id', registrationId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!reg) return { error: 'Registro no encontrado.' }
  if (reg.status !== 'cancelled') {
    return { error: 'Solo se pueden eliminar inscripciones canceladas.' }
  }

  await supabase.from('payments').delete().eq('registration_id', registrationId)
  await supabase.from('tickets').delete().eq('registration_id', registrationId)

  const { error } = await supabase
    .from('registrations')
    .delete()
    .eq('id', registrationId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'No se pudo eliminar la inscripción.' }

  revalidatePath('/admin/inscritos')
  revalidatePath('/admin')
  return {}
}

export async function updateAttendeeExtraData(
  attendeeId: string,
  updates: Record<string, string | boolean>
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()

  const { data: attendee } = await supabase
    .from('attendees')
    .select('extra_data')
    .eq('id', attendeeId)
    .eq('organization_id', profile.organization_id)
    .single()

  const current = (attendee?.extra_data as Record<string, string | boolean>) ?? {}
  const merged: Json = { ...current, ...updates }

  const { error } = await supabase
    .from('attendees')
    .update({ extra_data: merged })
    .eq('id', attendeeId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al actualizar los campos.' }

  revalidatePath('/admin/inscritos')
  return {}
}
