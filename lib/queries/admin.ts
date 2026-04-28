import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getCurrentUserProfile() {
  const ssr = await createClient()
  const { data: { session } } = await ssr.auth.getSession()
  if (!session) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id, organization_id, role, first_name, last_name, email')
    .eq('id', session.user.id)
    .single()

  return data
}

export const getAdminStats = cache(async (orgId: string) => {
  const supabase = createAdminClient()

  const [totalResult, pendingResult, paidResult] = await Promise.all([
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .neq('status', 'cancelled'),
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'pending'),
    supabase
      .from('registrations')
      .select('total_amount')
      .eq('organization_id', orgId)
      .eq('status', 'paid'),
  ])

  const revenue = paidResult.data?.reduce((sum, r) => sum + r.total_amount, 0) ?? 0

  return {
    total: totalResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    paid: paidResult.data?.length ?? 0,
    revenue,
  }
})

export const getPendingPayments = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select(`
      id, amount, currency, created_at,
      registrations!inner(
        id, folio, status,
        events(name),
        attendees(first_name, last_name, email)
      )
    `)
    .eq('organization_id', orgId)
    .eq('method', 'manual')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return data ?? []
})

export type PendingPayment = Awaited<ReturnType<typeof getPendingPayments>>[number]

export const getRegistrations = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('registrations')
    .select(`
      id, folio, status, payment_method, total_amount, created_at, event_id,
      events(id, name),
      attendees(id, first_name, last_name, email, phone, extra_data),
      tickets(ticket_types(name, currency))
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return data ?? []
})

export type RegistrationRow = Awaited<ReturnType<typeof getRegistrations>>[number]

export const getRegistrationById = cache(async (id: string, orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('registrations')
    .select(`
      id, folio, status, payment_method, total_amount, notes, created_at,
      events(id, name, starts_at, location),
      attendees(id, first_name, last_name, email, phone),
      tickets(
        id, status, qr_url, kit_station_id, checked_in_at, created_at,
        ticket_types(name, price, currency)
      ),
      payments(id, method, status, amount, currency, external_ref, verified_at, created_at)
    `)
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  return data ?? null
})

export type RegistrationDetail = Awaited<ReturnType<typeof getRegistrationById>>

export const getAdminEvents = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('events')
    .select('id, name, starts_at, ends_at, status, modality, location')
    .eq('organization_id', orgId)
    .order('starts_at', { ascending: false })

  return data ?? []
})

export type AdminEvent = Awaited<ReturnType<typeof getAdminEvents>>[number]

export const getEventById = cache(async (id: string, orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('events')
    .select('id, name, description, location, starts_at, ends_at, modality, status, cover_url, allow_preregistration')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  return data ?? null
})

export type AdminEventDetail = Awaited<ReturnType<typeof getEventById>>

export const getEventTicketTypes = cache(async (eventId: string, orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ticket_types')
    .select('id, name, price, currency, capacity, sold_count, active, created_at')
    .eq('event_id', eventId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
  return data ?? []
})

export type TicketTypeRow = Awaited<ReturnType<typeof getEventTicketTypes>>[number]

export const getAdminEventFields = cache(async (eventId: string, orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('event_fields')
    .select('id, event_id, label, field_type, options, helper_text, required, sort_order, scope, active, created_at')
    .eq('event_id', eventId)
    .eq('organization_id', orgId)
    .order('sort_order', { ascending: true })
  return (data ?? []) as {
    id: string
    event_id: string
    label: string
    field_type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'country'
    options: string[] | null
    helper_text: string | null
    required: boolean
    sort_order: number
    scope: 'participant' | 'internal'
    active: boolean
    created_at: string
  }[]
})

export type AdminEventField = Awaited<ReturnType<typeof getAdminEventFields>>[number]

export const getOrgFields = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('event_fields')
    .select('id, event_id, label, field_type, scope, options')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as {
    id: string
    event_id: string
    label: string
    field_type: string
    scope: 'participant' | 'internal'
    options: string[] | null
  }[]
})

export type OrgField = Awaited<ReturnType<typeof getOrgFields>>[number]
