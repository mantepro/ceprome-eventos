'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile, getOrganizationSlug } from '@/lib/queries/admin'
import { slugify } from '@/lib/slugify'

const slugSchema = z
  .string()
  .min(1, 'Requerido.')
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones.')

async function uniqueEventSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  baseSlug: string
): Promise<string> {
  let candidate = baseSlug
  let suffix = 2
  for (;;) {
    const { data } = await supabase
      .from('events')
      .select('id')
      .eq('organization_id', orgId)
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix++
  }
}

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
  allow_preregistration: z.boolean().default(false),
  invoice_instructions: z.string().optional(),
  transfer_instructions: z.string().optional(),
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
    allow_preregistration: formData.get('allow_preregistration') === 'on',
    invoice_instructions: (formData.get('invoice_instructions') as string) || undefined,
    transfer_instructions: (formData.get('transfer_instructions') as string) || undefined,
  }
}

async function uploadCover(
  file: File,
  orgId: string,
  eventId: string
): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default
    const input = Buffer.from(await file.arrayBuffer())
    const isPng = file.type === 'image/png'
    const isWebp = file.type === 'image/webp'

    const pipeline = sharp(input).resize(1920, null, { withoutEnlargement: true })
    const output = isPng
      ? await pipeline.png({ quality: 85 }).toBuffer()
      : isWebp
      ? await pipeline.webp({ quality: 85 }).toBuffer()
      : await pipeline.jpeg({ quality: 85 }).toBuffer()

    const ext = isPng ? 'png' : isWebp ? 'webp' : 'jpg'
    const contentType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg'
    const path = `${orgId}/${eventId}/cover-${Date.now()}.${ext}`
    const admin = createAdminClient()

    const { data: existing } = await admin.storage.from('covers').list(`${orgId}/${eventId}`)
    if (existing?.length) {
      await admin.storage
        .from('covers')
        .remove(existing.map((f) => `${orgId}/${eventId}/${f.name}`))
    }

    const { error } = await admin.storage
      .from('covers')
      .upload(path, output, { contentType, upsert: true })

    if (error) {
      console.error('[uploadCover] storage error:', error.message)
      return null
    }

    const { data } = admin.storage.from('covers').getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.error('[uploadCover] unexpected error:', err)
    return null
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

  const { name, description, location, starts_at, ends_at, modality, status, allow_preregistration, invoice_instructions, transfer_instructions } = parsed.data
  const supabase = await createClient()
  const eventId = crypto.randomUUID()
  const slug = await uniqueEventSlug(supabase, profile.organization_id, slugify(name) || 'evento')

  const { error } = await supabase
    .from('events')
    .insert({
      id: eventId,
      organization_id: profile.organization_id,
      name,
      slug,
      description: description ?? null,
      location: location ?? null,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: ends_at ? new Date(ends_at).toISOString() : null,
      modality,
      status,
      allow_preregistration,
      invoice_instructions: invoice_instructions ?? null,
      transfer_instructions: transfer_instructions ?? null,
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
  const slugRaw = ((formData.get('slug') as string) ?? '').trim().toLowerCase()
  const slugParsed = slugSchema.safeParse(slugRaw)

  if (!parsed.success || !slugParsed.success) {
    const errors: Record<string, string> = parsed.success
      ? {}
      : Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
        )
    if (!slugParsed.success) {
      errors.slug = slugParsed.error.issues[0]?.message ?? 'URL inválida.'
    }
    return { errors }
  }

  const slug = slugParsed.data
  const { name, description, location, starts_at, ends_at, modality, status, allow_preregistration, invoice_instructions, transfer_instructions } = parsed.data

  const supabase = await createClient()

  const { data: slugCollision } = await supabase
    .from('events')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('slug', slug)
    .neq('id', eventId)
    .maybeSingle()

  if (slugCollision) {
    return { errors: { slug: 'Esta URL ya está en uso por otro evento.' } }
  }

  // Handle cover image upload
  const coverFile = formData.get('cover')
  let coverUrl: string | undefined
  if (coverFile instanceof File && coverFile.size > 0) {
    if (coverFile.size > 10 * 1024 * 1024) {
      return { error: 'La imagen supera el límite de 10 MB.' }
    }
    const url = await uploadCover(coverFile, profile.organization_id, eventId)
    if (!url) return { error: 'No se pudo subir la imagen. Verifica que el bucket "covers" existe en Supabase Storage.' }
    coverUrl = url
  }

  const { error } = await supabase
    .from('events')
    .update({
      name,
      slug,
      description: description ?? null,
      location: location ?? null,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: ends_at ? new Date(ends_at).toISOString() : null,
      modality,
      status,
      allow_preregistration,
      invoice_instructions: invoice_instructions ?? null,
      transfer_instructions: transfer_instructions ?? null,
      ...(coverUrl !== undefined && { cover_url: coverUrl }),
    })
    .eq('id', eventId)
    .eq('organization_id', profile.organization_id)

  if (error) {
    if (error.code === '23505') {
      return { errors: { slug: 'Esta URL ya está en uso por otro evento.' } }
    }
    return { error: 'Error al guardar los cambios.' }
  }

  revalidatePath('/admin/eventos')
  revalidatePath(`/admin/eventos/${eventId}/editar`)

  const orgSlug = await getOrganizationSlug(profile.organization_id)
  if (orgSlug) {
    revalidatePath(`/${orgSlug}/eventos`)
    revalidatePath(`/${orgSlug}/eventos/${slug}`)
    revalidatePath(`/${orgSlug}/registro/${slug}`)
  }

  return { success: true }
}

// --- Ticket types ---

const ticketTypeSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  currency: z.string().min(1),
  capacity: z.union([z.coerce.number().int().positive(), z.literal('').transform(() => null)]).optional(),
  countryScope: z.enum(['any', 'match', 'exclude']).default('any'),
  countryValue: z.string().optional(),
}).refine(
  (data) => data.countryScope === 'any' || !!data.countryValue?.trim(),
  { message: 'Selecciona un país para esta restricción.', path: ['countryValue'] }
)

export type TicketTypeFormState = { error?: string; errors?: Record<string, string> }

function parseTicketTypeFormData(formData: FormData) {
  return {
    name: formData.get('name') as string,
    price: formData.get('price') as string,
    currency: (formData.get('currency') as string) || 'USD',
    capacity: (formData.get('capacity') as string) || '',
    countryScope: (formData.get('country_scope') as string) || 'any',
    countryValue: (formData.get('country_value') as string) || '',
  }
}

export async function createTicketType(
  eventId: string,
  _prev: TicketTypeFormState,
  formData: FormData
): Promise<TicketTypeFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const parsed = ticketTypeSchema.safeParse(parseTicketTypeFormData(formData))
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { name, price, currency, capacity, countryScope, countryValue } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('ticket_types').insert({
    event_id: eventId,
    organization_id: profile.organization_id,
    name,
    price,
    currency,
    capacity: capacity ?? null,
    country_scope: countryScope,
    country_value: countryScope === 'any' ? null : countryValue,
  })

  if (error) return { error: 'Error al crear el tipo de acceso.' }

  revalidatePath(`/admin/eventos/${eventId}/editar`)
  return {}
}

export async function updateTicketType(
  ticketTypeId: string,
  eventId: string,
  _prev: TicketTypeFormState,
  formData: FormData
): Promise<TicketTypeFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const parsed = ticketTypeSchema.safeParse(parseTicketTypeFormData(formData))
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { name, price, currency, capacity, countryScope, countryValue } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_types')
    .update({
      name,
      price,
      currency,
      capacity: capacity ?? null,
      country_scope: countryScope,
      country_value: countryScope === 'any' ? null : countryValue,
    })
    .eq('id', ticketTypeId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'Error al actualizar el tipo de acceso.' }

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
