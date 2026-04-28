'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/queries/admin'

export type EventFieldFormState = { error?: string; errors?: Record<string, string> }

const fieldSchema = z.object({
  label: z.string().min(2, 'Mínimo 2 caracteres'),
  field_type: z.enum(['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date'], { message: 'Tipo requerido' }),
  options: z.string().optional(),
  required: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
  scope: z.enum(['participant', 'internal']).default('participant'),
})

function parseOptions(type: string, raw: string | undefined): string[] | null {
  if (!['select', 'radio'].includes(type) || !raw?.trim()) return null
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

function parseFieldForm(formData: FormData) {
  return {
    label: formData.get('label') as string,
    field_type: formData.get('field_type') as string,
    options: (formData.get('options') as string) || undefined,
    required: formData.get('required') === 'on',
    sort_order: (formData.get('sort_order') as string) || '0',
    scope: (formData.get('scope') as string) || 'participant',
  }
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

  const { label, field_type, options, required, sort_order, scope } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('event_fields').insert({
    event_id: eventId,
    organization_id: profile.organization_id,
    label,
    field_type,
    options: parseOptions(field_type, options),
    required,
    sort_order,
    scope,
  })

  if (error) return { error: 'Error al crear el campo.' }

  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return {}
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

  const { label, field_type, options, required, sort_order, scope } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('event_fields')
    .update({
      label,
      field_type,
      options: parseOptions(field_type, options),
      required,
      sort_order,
      scope,
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
