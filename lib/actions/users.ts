'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'

type Role = 'org_admin' | 'event_staff'

export async function inviteUser(
  email: string,
  role: Role
): Promise<{ error: string; success: boolean }> {
  const profile = await getCurrentUserProfile()
  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'org_admin')) {
    return { error: 'No autorizado.', success: false }
  }

  if (profile.role === 'org_admin' && role !== 'event_staff') {
    return { error: 'Solo puedes invitar usuarios con rol de personal de evento.', success: false }
  }

  const orgId = profile.organization_id
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .eq('organization_id', orgId)
    .maybeSingle()

  if (existing) return { error: 'Este correo ya está registrado en la organización.', success: false }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase()
  )
  if (inviteError) {
    const msg = inviteError.message ?? ''
    if (msg.toLowerCase().includes('already')) {
      return { error: 'Este correo ya tiene una cuenta en el sistema.', success: false }
    }
    return { error: `Error al enviar invitación: ${msg}`, success: false }
  }

  const { error: insertError } = await admin.from('users').insert({
    id: inviteData.user.id,
    organization_id: orgId,
    role,
    email: email.trim().toLowerCase(),
    active: true,
  })

  if (insertError) return { error: 'Error al registrar el usuario.', success: false }

  revalidatePath('/admin/usuarios')
  return { error: '', success: true }
}

export async function toggleUserActive(
  userId: string,
  currentActive: boolean
): Promise<{ error: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'org_admin')) {
    return { error: 'No autorizado.' }
  }
  if (userId === profile.id) return { error: 'No puedes desactivarte a ti mismo.' }

  const admin = createAdminClient()

  if (profile.role === 'org_admin') {
    const { data: target } = await admin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()
    if (!target || target.organization_id !== profile.organization_id) {
      return { error: 'Sin permisos sobre este usuario.' }
    }
  }

  const { error } = await admin
    .from('users')
    .update({ active: !currentActive })
    .eq('id', userId)

  if (error) return { error: 'Error al actualizar el usuario.' }

  revalidatePath('/admin/usuarios')
  return { error: '' }
}
