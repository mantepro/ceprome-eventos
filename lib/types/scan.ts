export type ScanResult = {
  result: 'valid' | 'already_used' | 'pending_payment' | 'cancelled' | 'not_found'
  attendee?: {
    name: string
    folio: string
    ticketType: string
    kitStation: string | null
  }
  checked_in_at?: string | null
}
