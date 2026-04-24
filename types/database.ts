export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          email: string | null
          phone: string | null
          logo_url: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          email?: string | null
          phone?: string | null
          logo_url?: string | null
          active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      events: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          location: string | null
          starts_at: string
          ends_at: string | null
          modality: 'presencial' | 'virtual' | 'hibrido'
          status: 'draft' | 'published' | 'closed' | 'cancelled'
          cover_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          location?: string | null
          starts_at: string
          ends_at?: string | null
          modality: 'presencial' | 'virtual' | 'hibrido'
          status?: 'draft' | 'published' | 'closed' | 'cancelled'
          cover_url?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      ticket_types: {
        Row: {
          id: string
          event_id: string
          organization_id: string
          name: string
          price: number
          currency: string
          capacity: number | null
          sold_count: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          organization_id: string
          name: string
          price?: number
          currency?: string
          capacity?: number | null
          sold_count?: number
          active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['ticket_types']['Insert']>
      }
      registrations: {
        Row: {
          id: string
          organization_id: string
          event_id: string
          folio: string
          status: 'draft' | 'pending' | 'paid' | 'cancelled'
          payment_method: 'online' | 'manual' | null
          total_amount: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          event_id: string
          folio: string
          status?: 'draft' | 'pending' | 'paid' | 'cancelled'
          payment_method?: 'online' | 'manual' | null
          total_amount?: number
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['registrations']['Insert']>
      }
      attendees: {
        Row: {
          id: string
          registration_id: string
          organization_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          extra_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          registration_id: string
          organization_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          extra_data?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['attendees']['Insert']>
      }
      tickets: {
        Row: {
          id: string
          registration_id: string
          attendee_id: string
          ticket_type_id: string
          organization_id: string
          event_id: string
          token: string
          qr_url: string | null
          status: 'pending' | 'active' | 'used' | 'cancelled'
          checked_in_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          registration_id: string
          attendee_id: string
          ticket_type_id: string
          organization_id: string
          event_id: string
          token: string
          qr_url?: string | null
          status?: 'pending' | 'active' | 'used' | 'cancelled'
          checked_in_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>
      }
      payments: {
        Row: {
          id: string
          registration_id: string
          organization_id: string
          amount: number
          currency: string
          method: 'paypal' | 'manual'
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          external_ref: string | null
          verified_by: string | null
          verified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          registration_id: string
          organization_id: string
          amount: number
          currency?: string
          method: 'paypal' | 'manual'
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          external_ref?: string | null
          verified_by?: string | null
          verified_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      scan_logs: {
        Row: {
          id: string
          ticket_id: string
          organization_id: string
          event_id: string
          scanned_by: string
          result: 'valid' | 'already_used' | 'pending_payment' | 'cancelled' | 'not_found'
          scanned_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          organization_id: string
          event_id: string
          scanned_by: string
          result: 'valid' | 'already_used' | 'pending_payment' | 'cancelled' | 'not_found'
          scanned_at?: string
        }
        Update: Partial<Database['public']['Tables']['scan_logs']['Insert']>
      }
      users: {
        Row: {
          id: string
          organization_id: string
          role: 'super_admin' | 'org_admin' | 'event_staff'
          first_name: string | null
          last_name: string | null
          email: string
          active: boolean
          created_at: string
        }
        Insert: {
          id: string
          organization_id: string
          role: 'super_admin' | 'org_admin' | 'event_staff'
          first_name?: string | null
          last_name?: string | null
          email: string
          active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Tipos derivados convenientes
export type Organization = Database['public']['Tables']['organizations']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type TicketType = Database['public']['Tables']['ticket_types']['Row']
export type Registration = Database['public']['Tables']['registrations']['Row']
export type Attendee = Database['public']['Tables']['attendees']['Row']
export type Ticket = Database['public']['Tables']['tickets']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type ScanLog = Database['public']['Tables']['scan_logs']['Row']
export type User = Database['public']['Tables']['users']['Row']
