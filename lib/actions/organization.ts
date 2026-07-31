'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'

export type OrgSettingsState = {
  error?: string
  success?: boolean
}

export async function updateOrgSettings(
  _prev: OrgSettingsState,
  formData: FormData
): Promise<OrgSettingsState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const whatsapp = (formData.get('whatsapp_contact') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('organizations')
    .update({ whatsapp_contact: whatsapp, email, phone })
    .eq('id', profile.organization_id)

  if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' }

  revalidatePath('/admin/configuracion')
  revalidatePath('/[slug]', 'layout')
  return { success: true }
}
