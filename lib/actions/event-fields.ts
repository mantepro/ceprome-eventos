'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/queries/admin'

export type EventFieldFormState = { error?: string; errors?: Record<string, string>; success?: boolean }

const fieldSchema = z.object({
  label: z.string().min(2, 'Mínimo 2 caracteres'),
  field_type: z.enum(['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date', 'country', 'multiselect'], { message: 'Tipo requerido' }),
  options: z.string().optional(),
  helper_text: z.string().optional(),
  required: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
  scope: z.enum(['participant', 'internal']).default('participant'),
  allow_other: z.boolean().default(false),
  section: z.string().optional(),
  pair_with_phone: z.boolean().default(false),
})

const TYPES_REQUIRING_OPTIONS = ['select', 'radio', 'multiselect']

function parseOptions(type: string, raw: string | undefined): string[] | null {
  if (!TYPES_REQUIRING_OPTIONS.includes(type) || !raw?.trim()) return null
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

function parseFieldForm(formData: FormData) {
  return {
    label: formData.get('label') as string,
    field_type: formData.get('field_type') as string,
    options: (formData.get('options') as string) || undefined,
    helper_text: (formData.get('helper_text') as string) || undefined,
    required: formData.get('required') === 'on',
    sort_order: (formData.get('sort_order') as string) || '0',
    scope: (formData.get('scope') as string) || 'participant',
    allow_other: formData.get('allow_other') === 'on',
    section: (formData.get('section') as string) || undefined,
    pair_with_phone: formData.get('pair_with_phone') === 'on',
  }
}

async function clearOtherPairWithPhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  orgId: string,
  excludeFieldId?: string
) {
  let query = supabase
    .from('event_fields')
    .update({ pair_with_phone: false })
    .eq('event_id', eventId)
    .eq('organization_id', orgId)
  if (excludeFieldId) query = query.neq('id', excludeFieldId)
  await query
}

export async function createEventField(
  eventId: string,
  _prev: EventFieldFormState,
  formData: FormData
): Promise<EventFieldFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const parsed = fieldSchema.safeParse(parseFieldForm(formData))
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { label, field_type, options, helper_text, required, sort_order, scope, allow_other, section, pair_with_phone } = parsed.data
  const supabase = await createClient()

  if (pair_with_phone) {
    await clearOtherPairWithPhone(supabase, eventId, profile.organization_id)
  }

  const { error } = await supabase.from('event_fields').insert({
    event_id: eventId,
    organization_id: profile.organization_id,
    label,
    field_type,
    options: parseOptions(field_type, options),
    helper_text: helper_text || null,
    required,
    sort_order,
    scope,
    allow_other,
    section: section || null,
    pair_with_phone,
  })

  if (error) return { error: 'Error al crear el campo.' }

  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return { success: true }
}

export async function updateEventField(
  fieldId: string,
  eventId: string,
  _prev: EventFieldFormState,
  formData: FormData
): Promise<EventFieldFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const parsed = fieldSchema.safeParse(parseFieldForm(formData))
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { label, field_type, options, helper_text, required, sort_order, scope, allow_other, section, pair_with_phone } = parsed.data
  const supabase = await createClient()

  if (pair_with_phone) {
    await clearOtherPairWithPhone(supabase, eventId, profile.organization_id, fieldId)
  }

  const { error } = await supabase
    .from('event_fields')
    .update({
      label,
      field_type,
      options: parseOptions(field_type, options),
      helper_text: helper_text || null,
      required,
      sort_order,
      scope,
      allow_other,
      section: section || null,
      pair_with_phone,
    })
    .eq('id', fieldId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al actualizar el campo.' }

  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return {}
}

export async function reorderEventFields(
  eventId: string,
  orderedIds: string[]
): Promise<void> {
  const profile = await getCurrentUserProfile()
  if (!profile) return

  const supabase = await createClient()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('event_fields')
        .update({ sort_order: index * 10 })
        .eq('id', id)
        .eq('organization_id', profile.organization_id)
    )
  )

  revalidatePath(`/admin/eventos/${eventId}/editar`)
}

export async function deleteEventField(
  fieldId: string,
  eventId: string
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('event_fields')
    .delete()
    .eq('id', fieldId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al eliminar el campo.' }

  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return {}
}
