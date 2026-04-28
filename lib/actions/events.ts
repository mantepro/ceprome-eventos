'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserProfile } from '@/lib/queries/admin'

export type EventFormState = {
  error?: string
  errors?: Record<string, string>
  success?: boolean
}

const eventSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().optional(),
  location: z.string().optional(),
  starts_at: z.string().min(1, 'Fecha de inicio requerida'),
  ends_at: z.string().optional(),
  modality: z.enum(['presencial', 'virtual', 'hibrido'], {
    message: 'Modalidad requerida',
  }),
  status: z.enum(['draft', 'published', 'closed', 'cancelled'], {
    message: 'Estado requerido',
  }),
})

function parseFormData(formData: FormData) {
  return {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    location: (formData.get('location') as string) || undefined,
    starts_at: formData.get('starts_at') as string,
    ends_at: (formData.get('ends_at') as string) || undefined,
    modality: formData.get('modality') as string,
    status: formData.get('status') as string,
  }
}

export async function createEvent(
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const parsed = eventSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { name, description, location, starts_at, ends_at, modality, status } = parsed.data
  const supabase = await createClient()

  const eventId = crypto.randomUUID()
  const { error } = await supabase
    .from('events')
    .insert({
      id: eventId,
      organization_id: profile.organization_id,
      name,
      description: description ?? null,
      location: location ?? null,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: ends_at ? new Date(ends_at).toISOString() : null,
      modality,
      status,
    })

  if (error) return { error: 'Error al crear el evento.' }

  revalidatePath('/admin/eventos')
  redirect(`/admin/eventos/${eventId}/editar`)
}

export async function updateEvent(
  eventId: string,
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const parsed = eventSchema.safeParse(parseFormData(formData))
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { name, description, location, starts_at, ends_at, modality, status } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('events')
    .update({
      name,
      description: description ?? null,
      location: location ?? null,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: ends_at ? new Date(ends_at).toISOString() : null,
      modality,
      status,
    })
    .eq('id', eventId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al guardar los cambios.' }

  revalidatePath('/admin/eventos')
  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return { success: true }
}

// --- Ticket types ---

const ticketTypeSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  currency: z.string().min(1),
  capacity: z.union([z.coerce.number().int().positive(), z.literal('').transform(() => null)]).optional(),
})

export type TicketTypeFormState = { error?: string; errors?: Record<string, string> }

export async function createTicketType(
  eventId: string,
  _prev: TicketTypeFormState,
  formData: FormData
): Promise<TicketTypeFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const raw = {
    name: formData.get('name') as string,
    price: formData.get('price') as string,
    currency: (formData.get('currency') as string) || 'USD',
    capacity: (formData.get('capacity') as string) || '',
  }

  const parsed = ticketTypeSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { name, price, currency, capacity } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('ticket_types').insert({
    event_id: eventId,
    organization_id: profile.organization_id,
    name,
    price,
    currency,
    capacity: capacity ?? null,
  })

  if (error) return { error: 'Error al crear el tipo de acceso.' }

  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return {}
}

export async function toggleTicketTypeActive(
  ticketTypeId: string,
  currentActive: boolean,
  eventId: string
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('ticket_types')
    .update({ active: !currentActive })
    .eq('id', ticketTypeId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al actualizar.' }

  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return {}
}
