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
      .in('status', ['draft', 'pending']),
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
    .select('id, code, approved_by, description')
    .eq('organization_id', orgId)
    .eq('count_as_scholarship', true)

  const couponById = new Map((scholarshipCoupons ?? []).map((c) => [c.id, c]))
  const scholarshipCouponIds = [...couponById.keys()]

  let scholarshipsAwarded = 0
  const scholarshipBreakdown: {
    couponCode: string
    approvedBy: string | null
    description: string | null
    totalAmount: number
  }[] = []

  if (scholarshipCouponIds.length > 0) {
    const { data: scholarshipRegs } = await supabase
      .from('registrations')
      .select('coupon_id, discount_amount')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .in('coupon_id', scholarshipCouponIds)

    const totalsByCoupon = new Map<string, number>()
    for (const reg of scholarshipRegs ?? []) {
      if (!reg.coupon_id) continue
      totalsByCoupon.set(reg.coupon_id, (totalsByCoupon.get(reg.coupon_id) ?? 0) + reg.discount_amount)
    }

    for (const [couponId, totalAmount] of totalsByCoupon) {
      const coupon = couponById.get(couponId)
      if (!coupon) continue
      scholarshipBreakdown.push({
        couponCode: coupon.code,
        approvedBy: coupon.approved_by,
        description: coupon.description,
        totalAmount,
      })
    }

    scholarshipBreakdown.sort((a, b) => b.totalAmount - a.totalAmount)
    scholarshipsAwarded = scholarshipBreakdown.reduce((sum, b) => sum + b.totalAmount, 0)
  }

  return {
    total: totalResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    paid: paidResult.data?.length ?? 0,
    revenue,
    scholarshipsAwarded,
    scholarshipBreakdown,
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
      id, folio, status, payment_method, total_amount, created_at, event_id, coupon_id, archived,
      events(id, name),
      attendees(id, first_name, last_name, email, phone, extra_data),
      tickets(id, status, checked_in_at, ticket_types(name, currency))
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  const rows = data ?? []

  // No se embebe coupons(code) directamente: no hay una relación FK
  // registrada entre registrations y coupons en el esquema tipado, así que
  // se resuelve el código del cupón por separado (mismo patrón que
  // scholarshipsAwarded más abajo).
  const couponIds = [...new Set(rows.map((r) => r.coupon_id).filter((id): id is string => !!id))]
  let couponCodeById = new Map<string, string>()
  if (couponIds.length > 0) {
    const { data: coupons } = await supabase
      .from('coupons')
      .select('id, code')
      .in('id', couponIds)
    couponCodeById = new Map((coupons ?? []).map((c) => [c.id, c.code]))
  }

  return rows.map((r) => ({
    ...r,
    coupon_code: r.coupon_id ? couponCodeById.get(r.coupon_id) ?? null : null,
  }))
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
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('id, name, price, currency, capacity, sold_count, active, created_at')
    .eq('event_id', eventId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (!ticketTypes || ticketTypes.length === 0) return []

  // sold_count en vivo, calculado de tickets/registrations reales — la
  // columna almacenada se ha desincronizado más de una vez, así que para
  // lo que se muestra en el admin ya no confiamos en ella.
  const { data: tickets } = await supabase
    .from('tickets')
    .select('ticket_type_id, registrations(status)')
    .in('ticket_type_id', ticketTypes.map((t) => t.id))

  const liveCounts = new Map<string, number>()
  for (const t of tickets ?? []) {
    const status = (t.registrations as { status: string } | null)?.status
    if (status && status !== 'cancelled') {
      liveCounts.set(t.ticket_type_id, (liveCounts.get(t.ticket_type_id) ?? 0) + 1)
    }
  }

  return ticketTypes.map((tt) => ({ ...tt, sold_count: liveCounts.get(tt.id) ?? 0 }))
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
    .select('id, code, type, value, max_uses, used_count, active, archived, count_as_scholarship, approved_by, description, event_id, created_at, events(name)')
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
