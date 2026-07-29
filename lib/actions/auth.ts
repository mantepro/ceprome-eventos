'use server'

import { createClient } from '@/lib/supabase/server'

export async function verifyInviteOtp(
  tokenHash: string,
  type: string
): Promise<{ error: string }> {
  if (!tokenHash || !type) return { error: 'Parámetros de invitación inválidos.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'invite',
  })

  return { error: error?.message ?? '' }
}

export async function completeProfile(
  firstName: string,
  lastName: string
): Promise<{ error: string }> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Sesión inválida.' }

  const { error } = await supabase
    .from('users')
    .update({ first_name: firstName.trim(), last_name: lastName.trim() })
    .eq('id', session.user.id)

  return { error: error?.message ?? '' }
}
