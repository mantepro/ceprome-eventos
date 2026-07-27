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

  // Becas otorgadas — suma del descuento de registrations pagadas cuyo cupón
  // está marcado para contarse en este reporte. Se calcula aparte de `revenue`,
  // que refleja únicamente el dinero real recaudado.
  const { data: scholarshipCoupons } = await supabase
    .from('coupons')
    .select('id')
    .eq('organization_id', orgId)
    .eq('count_as_scholarship', true)

  const scholarshipCouponIds = (scholarshipCoupons ?? []).map((c) => c.id)

  let scholarshipsAwarded = 0
  if (scholarshipCouponIds.length > 0) {
    const { data: scholarshipRegs } = await supabase
      .from('registrations')
      .select('discount_amount')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .in('coupon_id', scholarshipCouponIds)
    scholarshipsAwarded = scholarshipRegs?.reduce((sum, r) => sum + r.discount_amount, 0) ?? 0
  }

  return {
    total: totalResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    paid: paidResult.data?.length ?? 0,
    revenue,
    scholarshipsAwarded,
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

export const getPendingPreregs = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('registrations')
    .select(`
      id, folio, total_amount, created_at,
      events(name),
      attendees(first_name, last_name, email),
      tickets(ticket_types(name, currency))
    `)
    .eq('organization_id', orgId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
  return data ?? []
})

export type PendingPrereg = Awaited<ReturnType<typeof getPendingPreregs>>[number]

export const getRegistrations = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('registrations')
    .select(`
      id, folio, status, payment_method, total_amount, created_at, event_id,
      events(id, name),
      attendees(id, first_name, last_name, email, phone, extra_data),
      tickets(id, status, checked_in_at, ticket_types(name, currency))
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return data ?? []
})

export type RegistrationRow = Awaited<ReturnType<typeof getRegistrations>>[number]

export const getEventRegistrations = cache(async (eventId: string, orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('registrations')
    .select(`
      id, folio, status, payment_method, total_amount, created_at,
      attendees(id, first_name, last_name, email, phone),
      tickets(id, status, checked_in_at, ticket_types(name, currency))
    `)
    .eq('organization_id', orgId)
    .eq('event_id', eventId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  return data ?? []
})

export type EventRegistrationRow = Awaited<ReturnType<typeof getEventRegistrations>>[number]

export const getCheckinStats = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const [checkedIn, totalPaid] = await Promise.all([
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'used'),
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'paid'),
  ])
  return { checkedIn: checkedIn.count ?? 0, totalPaid: totalPaid.count ?? 0 }
})

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
    .select('id, name, slug, description, location, starts_at, ends_at, modality, status, cover_url, allow_preregistration, invoice_instructions, transfer_instructions')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  return data ?? null
})

export type AdminEventDetail = Awaited<ReturnType<typeof getEventById>>

export const getOrganizationSlug = cache(async (orgId: string): Promise<string | null> => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()
  return data?.slug ?? null
})

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
    .select('id, event_id, label, field_type, options, helper_text, required, sort_order, scope, active, allow_other, section, pair_with_phone, created_at')
    .eq('event_id', eventId)
    .eq('organization_id', orgId)
    .order('sort_order', { ascending: true })
  return (data ?? []) as {
    id: string
    event_id: string
    label: string
    field_type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'country' | 'multiselect'
    options: string[] | null
    helper_text: string | null
    required: boolean
    sort_order: number
    scope: 'participant' | 'internal'
    active: boolean
    allow_other: boolean
    section: string | null
    pair_with_phone: boolean
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

export const getCoupons = cache(async (orgId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('coupons')
    .select('id, code, type, value, max_uses, used_count, active, count_as_scholarship, event_id, created_at, events(name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  return data ?? []
})

export type CouponRow = Awaited<ReturnType<typeof getCoupons>>[number]

export type UserRow = {
  id: string
  organization_id: string
  role: 'super_admin' | 'org_admin' | 'event_staff'
  first_name: string | null
  last_name: string | null
  email: string
  active: boolean
  created_at: string
  organizations: { name: string } | null
}

export async function getOrgUsers(orgId: string, isSuperAdmin: boolean): Promise<UserRow[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('users')
    .select('id, organization_id, role, first_name, last_name, email, active, created_at, organizations(name)')
    .order('created_at', { ascending: false })

  if (!isSuperAdmin) {
    query = query.eq('organization_id', orgId)
  }

  const { data } = await query
  return (data ?? []) as unknown as UserRow[]
}
