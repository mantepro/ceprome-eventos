import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Organization, Event, TicketType, EventField } from '@/types/database'

export const getOrgBySlug = cache(async (slug: string): Promise<Organization> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!data) notFound()
  return data
})

export async function getPublishedEvents(orgId: string): Promise<Event[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .order('starts_at', { ascending: true })

  return data ?? []
}

export async function getPublishedEvent(orgId: string, eventId: string): Promise<Event> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .single()

  if (!data) notFound()
  return data
}

export async function getActiveTicketTypes(eventId: string): Promise<TicketType[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', eventId)
    .eq('active', true)
    .order('price', { ascending: true })

  return data ?? []
}

export async function getEventFields(eventId: string): Promise<EventField[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_fields')
    .select('*')
    .eq('event_id', eventId)
    .eq('active', true)
    .eq('scope', 'participant')
    .order('sort_order', { ascending: true })

  return (data ?? []) as EventField[]
}
