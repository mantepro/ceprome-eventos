'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'

export async function checkInTicket(
  ticketId: string
): Promise<{ error?: string; checked_in_at: string | null }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado', checked_in_at: null }

  const now = new Date().toISOString()
  const { error } = await createAdminClient()
    .from('tickets')
    .update({ status: 'used', checked_in_at: now })
    .eq('id', ticketId)
    .eq('organization_id', profile.organization_id)
    .eq('status', 'active')

  if (error) return { error: error.message, checked_in_at: null }
  return { checked_in_at: now }
}

export async function revertCheckIn(
  ticketId: string
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado' }

  const { error } = await createAdminClient()
    .from('tickets')
    .update({ status: 'active', checked_in_at: null })
    .eq('id', ticketId)
    .eq('organization_id', profile.organization_id)
    .eq('status', 'used')

  return error ? { error: error.message } : {}
}
