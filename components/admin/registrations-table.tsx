'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown, ColumnsSettings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateRegistrationStatus, updateAttendeeExtraData } from '@/lib/actions/registrations'
import { confirmPayment, type PaymentMethod } from '@/lib/actions/payments'
import { PaymentMethodModal } from '@/components/admin/payment-actions'
import { formatCurrency, formatDateShort, formatTime } from '@/lib/utils'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { RegistrationRow, OrgField } from '@/lib/queries/admin'

type SortCol = 'folio' | 'name' | 'event' | 'ticket_type' | 'amount' | 'status' | 'date'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',  className: 'bg-amber-100 text-amber-800' },
  paid:      { label: 'Pagado',     className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  draft:     { label: 'Borrador',   className: 'bg-gray-100 text-gray-600' },
}

const METHOD_LABELS: Record<string, string> = {
  manual:        'Transferencia / Depósito',
  transferencia: 'Transferencia',
  deposito:      'Depósito',
  paypal:        'PayPal',
  taquilla:      'Taquilla',
  otro:          'Otro',
}

const METHOD_SHORT: Record<string, string> = {
  manual:        'Transf./Dep.',
  transferencia: 'Transf.',
  deposito:      'Depósito',
  paypal:        'PayPal',
  taquilla:      'Taquilla',
  otro:          'Otro',
}

const PAGE_SIZE = 25

// Columns order matches table rendering order
const TOGGLEABLE_COLS = [
  { id: 'ticket_type', label: 'Tipo de acceso' },
  { id: 'acceso',      label: 'Acceso' },
  { id: 'date',        label: 'Fecha' },
  { id: 'pais',        label: 'País' },
  { id: 'amount',      label: 'Monto' },
  { id: 'method',      label: 'Método' },
  { id: 'phone',       label: 'Teléfono' },
  { id: 'event',       label: 'Evento' },
] as const

// Zebra row backgrounds
const ROW_BG = ['#ffffff', '#f9fafb'] as const

// Sticky column constants — body rows (horizontal only)
const STICKY_FOLIO  = { position: 'sticky' as const, left: 0,   zIndex: 2, minWidth: 116 }
const STICKY_NOMBRE = { position: 'sticky' as const, left: 116, zIndex: 2, minWidth: 200 }
const STICKY_PAGO   = { position: 'sticky' as const, left: 316, zIndex: 2, minWidth: 160 }
// Header cells: doubly sticky (vertical top:0 + horizontal left:X) with solid opaque background
const BG_HEAD      = '#f9fafb'
const SHADOW_RIGHT = '2px 0 4px -1px rgba(0,0,0,0.08)'
const SHADOW_LEFT  = '-2px 0 4px -1px rgba(0,0,0,0.08)'
const TH_BASE      = { position: 'sticky' as const, top: 0, zIndex: 3,  backgroundColor: BG_HEAD, whiteSpace: 'nowrap' as const }
const TH_FOLIO     = { ...STICKY_FOLIO,  top: 0, zIndex: 11, backgroundColor: BG_HEAD, whiteSpace: 'nowrap' as const }
const TH_NOMBRE    = { ...STICKY_NOMBRE, top: 0, zIndex: 11, backgroundColor: BG_HEAD, whiteSpace: 'nowrap' as const }
const TH_PAGO      = { ...STICKY_PAGO,   top: 0, zIndex: 11, backgroundColor: BG_HEAD, whiteSpace: 'nowrap' as const, boxShadow: SHADOW_RIGHT }
// Sticky-right "Ver" column
const TH_VER = { position: 'sticky' as const, right: 0, top: 0, zIndex: 12, backgroundColor: BG_HEAD, boxShadow: SHADOW_LEFT }
const TD_VER = { position: 'sticky' as const, right: 0, zIndex: 2, boxShadow: SHADOW_LEFT }

interface Props {
  registrations: RegistrationRow[]
  orgFields: OrgField[]
  orgId: string
}

export function RegistrationsTable({ registrations: initial, orgFields, orgId }: Props) {
  const [registrations, setRegistrations] = useState(initial)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ticketTypeFilter, setTicketTypeFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(
    new Set(['phone', 'event', 'amount', 'method'])
  )
  const [showColPicker, setShowColPicker] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null)
  const [confirmLoading, startConfirmLoading] = useTransition()
  const colPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showColPicker) return
    function handleClick(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showColPicker])

  // Realtime: update check-in status when a ticket is scanned
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`tickets-checkin-${orgId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const n = payload.new as {
            registration_id: string
            status: 'pending' | 'active' | 'used' | 'cancelled'
            checked_in_at: string | null
          }
          setRegistrations((prev) =>
            prev.map((r) => {
              if (r.id !== n.registration_id) return r
              const tickets = r.tickets.map((t) => ({
                ...t,
                status: n.status,
                checked_in_at: n.checked_in_at,
              }))
              return { ...r, tickets }
            })
          )
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId])

  const internalFields = useMemo(() => orgFields.filter((f) => f.scope === 'internal'), [orgFields])

  // Field with field_type 'country' — drives the País column and filter
  const countryField = useMemo(
    () => orgFields.find((f) => f.field_type === 'country') ?? null,
    [orgFields]
  )

  const singleEventId = useMemo(() => {
    if (eventFilter !== 'all') return eventFilter
    const ids = new Set(registrations.map((r) => (r as { event_id: string }).event_id).filter(Boolean))
    return ids.size === 1 ? Array.from(ids)[0] : null
  }, [eventFilter, registrations])

  // Exclude country field from dynamic participant columns — it has its own dedicated column
  const visibleParticipantFields = useMemo(
    () => (singleEventId
      ? orgFields.filter((f) =>
          f.event_id === singleEventId &&
          f.scope === 'participant' &&
          f.field_type !== 'country'
        )
      : []),
    [orgFields, singleEventId]
  )

  const uniqueEvents = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of registrations) {
      const ev = (r.events as { id: string; name: string } | null)
      if (ev?.id) map.set(ev.id, ev.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [registrations])

  const uniqueTicketTypes = useMemo(() => {
    const set = new Set<string>()
    for (const r of registrations) {
      const t = (r.tickets as { ticket_types: { name: string } | null }[])?.[0]?.ticket_types
      if (t?.name) set.add(t.name)
    }
    return Array.from(set)
  }, [registrations])

  const uniqueCountries = useMemo(() => {
    if (!countryField) return []
    const set = new Set<string>()
    for (const r of registrations) {
      const att = (r.attendees as { extra_data: Record<string, unknown> | null }[])?.[0]
      const v = att?.extra_data?.[countryField.id]
      if (typeof v === 'string' && v.trim()) set.add(v.trim())
    }
    return Array.from(set).sort()
  }, [registrations, countryField])

  const filtered = useMemo(() => {
    let result = registrations
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((r) => {
        const att = (r.attendees as { first_name: string; last_name: string; email: string }[])?.[0]
        return (
          r.folio.toLowerCase().includes(q) ||
          att?.first_name?.toLowerCase().includes(q) ||
          att?.last_name?.toLowerCase().includes(q) ||
          att?.email?.toLowerCase().includes(q)
        )
      })
    }
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter)
    if (ticketTypeFilter !== 'all') {
      result = result.filter((r) => {
        const t = (r.tickets as { ticket_types: { name: string } | null }[])?.[0]?.ticket_types
        return t?.name === ticketTypeFilter
      })
    }
    if (eventFilter !== 'all') {
      result = result.filter((r) => (r as { event_id: string }).event_id === eventFilter)
    }
    if (countryFilter !== 'all' && countryField) {
      result = result.filter((r) => {
        const att = (r.attendees as { extra_data: Record<string, unknown> | null }[])?.[0]
        return att?.extra_data?.[countryField.id] === countryFilter
      })
    }
    return result
  }, [registrations, search, statusFilter, ticketTypeFilter, eventFilter, countryFilter, countryField])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'folio') {
        cmp = a.folio.localeCompare(b.folio)
      } else if (sortCol === 'name') {
        const aA = (a.attendees as { first_name: string; last_name: string }[])?.[0]
        const bA = (b.attendees as { first_name: string; last_name: string }[])?.[0]
        cmp = `${aA?.first_name ?? ''} ${aA?.last_name ?? ''}`.localeCompare(
          `${bA?.first_name ?? ''} ${bA?.last_name ?? ''}`
        )
      } else if (sortCol === 'event') {
        cmp = ((a.events as { name: string } | null)?.name ?? '').localeCompare(
          (b.events as { name: string } | null)?.name ?? ''
        )
      } else if (sortCol === 'ticket_type') {
        const aT = (a.tickets as { ticket_types: { name: string } | null }[])?.[0]?.ticket_types?.name ?? ''
        const bT = (b.tickets as { ticket_types: { name: string } | null }[])?.[0]?.ticket_types?.name ?? ''
        cmp = aT.localeCompare(bT)
      } else if (sortCol === 'amount') {
        cmp = a.total_amount - b.total_amount
      } else if (sortCol === 'status') {
        cmp = a.status.localeCompare(b.status)
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  function resetPage() { setPage(1) }

  async function handleStatusChange(regId: string, newStatus: string) {
    const s = newStatus as 'draft' | 'pending' | 'cancelled'
    setRegistrations((prev) => prev.map((r) => (r.id === regId ? { ...r, status: s } : r)))
    await updateRegistrationStatus(regId, s)
  }

  function handlePaidWithMethod(method: string) {
    const regId = pendingConfirm
    if (!regId) return
    setPendingConfirm(null)
    startConfirmLoading(async () => {
      const result = await confirmPayment(regId, method as PaymentMethod)
      if (result.error) { alert(result.error); return }
      setRegistrations((prev) => prev.map((r) => (r.id === regId ? { ...r, status: 'paid' } : r)))
    })
  }

  function handleInternalSave(regId: string, attendeeId: string, updates: Record<string, string | boolean>) {
    setRegistrations((prev) =>
      prev.map((r) => {
        if (r.id !== regId) return r
        const attendees = r.attendees.map((a, i) => {
          if (i !== 0) return a
          const current = (a.extra_data as Record<string, unknown>) ?? {}
          return { ...a, extra_data: { ...current, ...updates } as typeof a.extra_data }
        })
        return { ...r, attendees }
      })
    )
  }

  function handleExport() {
    const params = new URLSearchParams()
    if (eventFilter !== 'all') params.set('eventId', eventFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    window.location.href = `/api/admin/export/inscritos?${params}`
  }

  function toggleCol(id: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const show = (id: string) => !hiddenCols.has(id)

  const hasActiveFilters = search || statusFilter !== 'all' || ticketTypeFilter !== 'all' || eventFilter !== 'all' || countryFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setTicketTypeFilter('all')
    setEventFilter('all')
    setCountryFilter('all')
    resetPage()
  }

  return (
    <div className="space-y-4">
      <PaymentMethodModal
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={handlePaidWithMethod}
        isPending={confirmLoading}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por folio, nombre o correo…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage() }}
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <div className="relative" ref={colPickerRef}>
            <Button variant="outline" size="sm" onClick={() => setShowColPicker((v) => !v)} className="gap-1.5">
              <ColumnsSettings className="h-3.5 w-3.5" />
              Columnas
            </Button>
            {showColPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-44 rounded-md border bg-popover p-2 shadow-md">
                {TOGGLEABLE_COLS.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded"
                  >
                    <input
                      type="checkbox"
                      checked={show(col.id)}
                      onChange={() => toggleCol(col.id)}
                      className="h-3.5 w-3.5"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); resetPage() }}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        {uniqueTicketTypes.length > 0 && (
          <Select value={ticketTypeFilter} onValueChange={(v) => { setTicketTypeFilter(v); resetPage() }}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Tipo de acceso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {uniqueTicketTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {uniqueEvents.length > 1 && (
          <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); resetPage() }}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Evento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los eventos</SelectItem>
              {uniqueEvents.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {uniqueCountries.length > 0 && (
          <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); resetPage() }}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="País" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los países</SelectItem>
              {uniqueCountries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {sorted.length} resultado{sorted.length !== 1 ? 's' : ''}
        {sorted.length !== registrations.length && ` de ${registrations.length} total`}
      </p>

      {paged.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="font-medium">Sin resultados</p>
          <p className="text-sm mt-1">Ajusta los filtros o la búsqueda.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground" style={{ backgroundColor: BG_HEAD, position: 'sticky', top: 0, zIndex: 3 }}>
              <tr>
                {/* ── Sticky: Folio ── */}
                <SortTH col="folio" active={sortCol} dir={sortDir} onSort={handleSort} style={TH_FOLIO}>
                  Folio
                </SortTH>
                {/* ── Sticky: Nombre ── */}
                <SortTH col="name" active={sortCol} dir={sortDir} onSort={handleSort} style={TH_NOMBRE}>
                  Nombre
                </SortTH>
                {/* ── Sticky: Pago (Estado + Monto + Método unificados) ── */}
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={TH_PAGO}>
                  Pago
                </th>
                {show('ticket_type') && <SortTH col="ticket_type" active={sortCol} dir={sortDir} onSort={handleSort} className="whitespace-nowrap" style={TH_BASE}>Tipo</SortTH>}
                {show('acceso')      && <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={TH_BASE}>Acceso</th>}
                {show('date')        && <SortTH col="date" active={sortCol} dir={sortDir} onSort={handleSort} className="whitespace-nowrap" style={TH_BASE}>Fecha</SortTH>}
                {show('pais') && countryField && <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={TH_BASE}>País</th>}
                {show('amount')      && <SortTH col="amount" active={sortCol} dir={sortDir} onSort={handleSort} className="text-right whitespace-nowrap" style={TH_BASE}>Monto</SortTH>}
                {show('method')      && <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={TH_BASE}>Método</th>}
                {show('phone')       && <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={TH_BASE}>Teléfono</th>}
                {show('event')       && <SortTH col="event" active={sortCol} dir={sortDir} onSort={handleSort} className="whitespace-nowrap" style={TH_BASE}>Evento</SortTH>}
                {visibleParticipantFields.map((f) => (
                  <th key={f.id} className="px-4 py-3 text-left font-medium text-xs"
                    style={{ position: 'sticky', top: 0, zIndex: 3, backgroundColor: BG_HEAD }}>
                    <div style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.label}>
                      {f.label}
                    </div>
                  </th>
                ))}
                {internalFields.length > 0 && (
                  <th className="px-4 py-3 text-left font-medium text-purple-700"
                    style={{ position: 'sticky', top: 0, zIndex: 3, backgroundColor: BG_HEAD, whiteSpace: 'nowrap' }}>
                    Campos internos
                  </th>
                )}
                <th className="px-4 py-3" style={TH_VER}></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((reg, idx) => (
                <RegistrationRowItem
                  key={reg.id}
                  reg={reg}
                  rowIndex={idx}
                  participantFields={visibleParticipantFields}
                  internalFields={internalFields.filter(
                    (f) => (f as { event_id: string }).event_id === (reg as { event_id: string }).event_id
                  )}
                  hiddenCols={hiddenCols}
                  countryFieldId={countryField?.id ?? null}
                  onStatusChange={handleStatusChange}
                  onRequestPaidConfirm={(regId) => setPendingConfirm(regId)}
                  onInternalSave={handleInternalSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}

function SortTH({
  col, active, dir, onSort, children, className = '', style,
}: {
  col: SortCol; active: SortCol; dir: 'asc' | 'desc'
  onSort: (col: SortCol) => void
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`} style={style}>
      <button onClick={() => onSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {children}
        {active === col
          ? dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </button>
    </th>
  )
}

function RegistrationRowItem({
  reg, rowIndex, participantFields, internalFields, hiddenCols, countryFieldId,
  onStatusChange, onRequestPaidConfirm, onInternalSave,
}: {
  reg: RegistrationRow
  rowIndex: number
  participantFields: OrgField[]
  internalFields: OrgField[]
  hiddenCols: Set<string>
  countryFieldId: string | null
  onStatusChange: (id: string, status: string) => Promise<void>
  onRequestPaidConfirm: (regId: string) => void
  onInternalSave: (regId: string, attendeeId: string, updates: Record<string, string | boolean>) => void
}) {
  const [statusPending, startStatus] = useTransition()
  const attendee = (reg.attendees as {
    id: string; first_name: string; last_name: string; email: string; phone?: string | null
    extra_data: Record<string, unknown> | null
  }[])?.[0]
  const ticket = (reg.tickets as {
    status: string; checked_in_at: string | null
    ticket_types: { name: string; currency: string } | null
  }[])?.[0]
  const ticketType = ticket?.ticket_types
  const eventName = (reg.events as { name: string } | null)?.name
  const s = STATUS_LABELS[reg.status] ?? { label: reg.status, className: 'bg-gray-100 text-gray-600' }
  const hasInternalValues = internalFields.some((f) => attendee?.extra_data?.[f.id] != null)
  const show = (id: string) => !hiddenCols.has(id)

  const rowBg = ROW_BG[rowIndex % 2]

  function handleStatus(newStatus: string) {
    if (newStatus === 'paid') {
      onRequestPaidConfirm(reg.id)
      return
    }
    startStatus(async () => { await onStatusChange(reg.id, newStatus) })
  }

  return (
    <tr className="transition-colors hover:bg-muted/30" style={{ backgroundColor: rowBg }}>
      {/* ── Sticky: Folio ── */}
      <td className="px-4 py-3" style={{ ...STICKY_FOLIO, backgroundColor: rowBg }}>
        <Link href={`/admin/inscritos/${reg.id}`} className="font-mono font-medium hover:underline text-xs">
          {reg.folio}
        </Link>
      </td>
      {/* ── Sticky: Nombre ── */}
      <td className="px-4 py-3" style={{ ...STICKY_NOMBRE, backgroundColor: rowBg }}>
        {attendee ? (
          <div>
            <p className="font-medium">{attendee.first_name} {attendee.last_name}</p>
            <p className="text-muted-foreground text-xs">{attendee.email}</p>
          </div>
        ) : <span className="text-muted-foreground">—</span>}
      </td>
      {/* ── Sticky: Pago (estado + monto • método) ── */}
      <td className="px-4 py-3" style={{ ...STICKY_PAGO, backgroundColor: rowBg, boxShadow: SHADOW_RIGHT }}>
        <select
          value={reg.status}
          onChange={(e) => handleStatus(e.target.value)}
          disabled={statusPending}
          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-1 focus:ring-ring ${s.className}`}
        >
          <option value="draft">Borrador</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
          {formatCurrency(reg.total_amount, ticketType?.currency ?? 'USD')}
          {reg.payment_method ? ` • ${METHOD_SHORT[reg.payment_method] ?? reg.payment_method}` : ''}
        </p>
      </td>
      {show('ticket_type') && <td className="px-4 py-3 text-muted-foreground text-xs">{ticketType?.name ?? '—'}</td>}
      {show('acceso') && (
        <td className="px-4 py-3 text-xs">
          {ticket?.status === 'used' && ticket.checked_in_at
            ? <span className="text-green-700 font-medium">✓ {formatTime(ticket.checked_in_at)}</span>
            : <span className="text-muted-foreground">—</span>}
        </td>
      )}
      {show('date')   && <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateShort(reg.created_at)}</td>}
      {show('pais') && countryFieldId && (
        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
          {(attendee?.extra_data?.[countryFieldId] as string | undefined) ?? '—'}
        </td>
      )}
      {show('amount') && <td className="px-4 py-3 text-right font-medium text-xs">{formatCurrency(reg.total_amount, ticketType?.currency ?? 'USD')}</td>}
      {show('method') && <td className="px-4 py-3 text-muted-foreground text-xs">{reg.payment_method ? (METHOD_LABELS[reg.payment_method] ?? reg.payment_method) : '—'}</td>}
      {show('phone')  && <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{attendee?.phone ?? '—'}</td>}
      {show('event')  && <td className="px-4 py-3 text-muted-foreground text-xs">{eventName ?? '—'}</td>}
      {participantFields.map((f) => {
        const extra = (attendee?.extra_data as Record<string, unknown>) ?? {}
        const v = extra[f.id]
        const display = v === true ? 'Sí' : v === false ? 'No' : v != null ? String(v) : '—'
        return (
          <td key={f.id} className="px-4 py-3 text-xs" style={{ backgroundColor: rowBg }}>
            <span style={{ display: 'block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={display !== '—' ? display : undefined}>{display}</span>
          </td>
        )
      })}
      {internalFields.length > 0 && (
        <td className="px-4 py-3" style={{ backgroundColor: rowBg }}>
          {attendee && (
            <InternalFieldsDialog
              reg={reg}
              attendee={attendee}
              fields={internalFields}
              hasValues={hasInternalValues}
              onSave={(updates) => onInternalSave(reg.id, attendee.id, updates)}
            />
          )}
        </td>
      )}
      <td className="px-4 py-3 text-right" style={{ ...TD_VER, backgroundColor: rowBg }}>
        <Link href={`/admin/inscritos/${reg.id}`} className="text-xs text-primary hover:underline">Ver</Link>
      </td>
    </tr>
  )
}

function InternalFieldsDialog({
  reg, attendee, fields, hasValues, onSave,
}: {
  reg: RegistrationRow
  attendee: { id: string; first_name: string; last_name: string; extra_data: Record<string, unknown> | null }
  fields: OrgField[]
  hasValues: boolean
  onSave: (updates: Record<string, string | boolean>) => void
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [isPending, startSave] = useTransition()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const init: Record<string, string | boolean> = {}
    for (const f of fields) {
      const v = attendee.extra_data?.[f.id]
      init[f.id] = (v as string | boolean) ?? (f.field_type === 'checkbox' ? false : '')
    }
    setValues(init)
    setError('')
  }, [open, fields, attendee.extra_data])

  function handleSave() {
    startSave(async () => {
      const result = await updateAttendeeExtraData(attendee.id, values)
      if (result.error) { setError(result.error); return }
      onSave(values)
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs hover:underline ${hasValues ? 'text-purple-700 font-medium' : 'text-muted-foreground'}`}
      >
        {hasValues ? 'Ver / editar' : 'Agregar'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Campos internos</DialogTitle>
            <p className="text-sm text-muted-foreground">{attendee.first_name} {attendee.last_name}</p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {fields.map((f) => (
              <div key={f.id} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                {f.field_type === 'textarea' ? (
                  <Textarea value={(values[f.id] as string) ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} rows={2} />
                ) : f.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={(values[f.id] as boolean) ?? false} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.checked }))} className="h-4 w-4 rounded" />
                    {f.label}
                  </label>
                ) : f.field_type === 'select' ? (
                  <select value={(values[f.id] as string) ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">Selecciona…</option>
                    {(f.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <Input
                    type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                    value={(values[f.id] as string) ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>{isPending ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
