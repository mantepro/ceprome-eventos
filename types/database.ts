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
          whatsapp_contact: string | null
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
          whatsapp_contact?: string | null
          active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
        Relationships: []
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
          allow_preregistration: boolean
          invoice_instructions: string | null
          transfer_instructions: string | null
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
          allow_preregistration?: boolean
          invoice_instructions?: string | null
          transfer_instructions?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'events_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'ticket_types_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ticket_types_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'registrations_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registrations_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'attendees_registration_id_fkey'
            columns: ['registration_id']
            isOneToOne: false
            referencedRelation: 'registrations'
            referencedColumns: ['id']
          }
        ]
      }
      kit_delivery_stations: {
        Row: {
          id: string
          event_id: string
          organization_id: string
          name: string
          description: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          organization_id: string
          name: string
          description?: string | null
          active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['kit_delivery_stations']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'kit_delivery_stations_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          }
        ]
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
          kit_station_id: string | null
          kit_delivered: boolean
          kit_delivered_at: string | null
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
          kit_station_id?: string | null
          kit_delivered?: boolean
          kit_delivered_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'tickets_registration_id_fkey'
            columns: ['registration_id']
            isOneToOne: false
            referencedRelation: 'registrations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tickets_ticket_type_id_fkey'
            columns: ['ticket_type_id']
            isOneToOne: false
            referencedRelation: 'ticket_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tickets_attendee_id_fkey'
            columns: ['attendee_id']
            isOneToOne: false
            referencedRelation: 'attendees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tickets_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          }
        ]
      }
      payments: {
        Row: {
          id: string
          registration_id: string
          organization_id: string
          amount: number
          currency: string
          method: 'paypal' | 'manual' | 'transferencia' | 'deposito' | 'taquilla' | 'otro'
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
          method: 'paypal' | 'manual' | 'transferencia' | 'deposito' | 'taquilla' | 'otro'
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          external_ref?: string | null
          verified_by?: string | null
          verified_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'payments_registration_id_fkey'
            columns: ['registration_id']
            isOneToOne: false
            referencedRelation: 'registrations'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'scan_logs_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'tickets'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'users_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      event_fields: {
        Row: {
          id: string
          event_id: string
          organization_id: string
          label: string
          field_type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'country'
          options: string[] | null
          helper_text: string | null
          required: boolean
          sort_order: number
          scope: 'participant' | 'internal'
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          organization_id: string
          label: string
          field_type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'country'
          options?: string[] | null
          helper_text?: string | null
          required?: boolean
          sort_order?: number
          scope?: 'participant' | 'internal'
          active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['event_fields']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'event_fields_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_fields_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

// Tipos derivados convenientes
export type Organization = Database['public']['Tables']['organizations']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type TicketType = Database['public']['Tables']['ticket_types']['Row']
export type KitDeliveryStation = Database['public']['Tables']['kit_delivery_stations']['Row']
export type Registration = Database['public']['Tables']['registrations']['Row']
export type Attendee = Database['public']['Tables']['attendees']['Row']
export type Ticket = Database['public']['Tables']['tickets']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type ScanLog = Database['public']['Tables']['scan_logs']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type EventField = Database['public']['Tables']['event_fields']['Row']
