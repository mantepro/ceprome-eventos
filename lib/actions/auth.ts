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
