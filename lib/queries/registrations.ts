import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type RegistrationDetail = {
  id: string
  folio: string
  status: 'draft' | 'pending' | 'paid' | 'cancelled'
  payment_method: 'online' | 'manual' | null
  total_amount: number
  discount_amount: number
  created_at: string
  organizations: { name: string; email: string | null; whatsapp_contact: string | null } | null
  events: { name: string; starts_at: string; location: string | null; transfer_instructions: string | null } | null
  attendees: { first_name: string; last_name: string; email: string; phone: string | null }[]
  tickets: {
    id: string
    status: string
    qr_url: string | null
    kit_station_id: string | null
    ticket_types: { name: string; price: number; currency: string } | null
  }[]
  payments: {
    id: string
    method: 'paypal' | 'manual'
    status: 'pending' | 'completed' | 'failed' | 'refunded'
    amount: number
    currency: string
  }[]
}

export const getRegistrationByFolio = cache(
  async (folio: string): Promise<RegistrationDetail> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('registrations')
      .select(`
        id, folio, status, payment_method, total_amount, discount_amount, created_at,
        organizations(name, email, whatsapp_contact),
        events(name, starts_at, location, transfer_instructions),
        attendees(first_name, last_name, email, phone),
        tickets(id, status, qr_url, kit_station_id, ticket_types(name, price, currency)),
        payments(id, method, status, amount, currency)
      `)
      .eq('folio', folio)
      .single()

    if (!data) notFound()
    return data as unknown as RegistrationDetail
  }
)
