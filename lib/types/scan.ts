export type ScanResult = {
  result: 'valid' | 'valid_pending_payment' | 'already_used' | 'pending_payment' | 'cancelled' | 'refunded' | 'not_found'
  attendee?: {
    name: string
    folio: string
    ticketType: string
    kitStation: string | null
  }
  checked_in_at?: string | null
}
