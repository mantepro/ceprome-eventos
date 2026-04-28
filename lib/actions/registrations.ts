'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'
import type { Json } from '@/types/database'

type RegistrationStatus = 'draft' | 'pending' | 'paid' | 'cancelled'

export async function updateRegistrationStatus(
  registrationId: string,
  newStatus: RegistrationStatus
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('registrations')
    .update({ status: newStatus })
    .eq('id', registrationId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al actualizar el estado.' }

  revalidatePath('/admin/inscritos')
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
