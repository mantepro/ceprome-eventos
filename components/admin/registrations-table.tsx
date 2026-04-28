'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
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
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { RegistrationRow, OrgField } from '@/lib/queries/admin'

type SortCol = 'folio' | 'name' | 'event' | 'ticket_type' | 'amount' | 'status' | 'date'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',  className: 'bg-amber-100 text-amber-800' },
  paid:      { label: 'Pagado',     className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  draft:     { label: 'Borrador',   className: 'bg-gray-100 text-gray-600' },
}

const METHOD_LABELS: Record<string, string> = {
  manual: 'Transferencia',
  online: 'PayPal',
}

const PAGE_SIZE = 25

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
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const internalFields = useMemo(() => orgFields.filter(f => f.scope === 'internal'), [orgFields])

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

  const filtered = useMemo(() => {
    let result = registrations

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(r => {
        const att = (r.attendees as { first_name: string; last_name: string; email: string }[])?.[0]
        return (
          r.folio.toLowerCase().includes(q) ||
          att?.first_name?.toLowerCase().includes(q) ||
          att?.last_name?.toLowerCase().includes(q) ||
          att?.email?.toLowerCase().includes(q)
        )
      })
    }

    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter)

    if (ticketTypeFilter !== 'all') {
      result = result.filter(r => {
        const t = (r.tickets as { ticket_types: { name: string } | null }[])?.[0]?.ticket_types
        return t?.name === ticketTypeFilter
      })
    }

    if (eventFilter !== 'all') {
      result = result.filter(r => (r as { event_id: string }).event_id === eventFilter)
    }

    return result
  }, [registrations, search, statusFilter, ticketTypeFilter, eventFilter])

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
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  function resetPage() { setPage(1) }

  async function handleStatusChange(regId: string, newStatus: string) {
    const s = newStatus as 'draft' | 'pending' | 'paid' | 'cancelled'
    setRegistrations(prev =>
      prev.map(r => r.id === regId ? { ...r, status: s } : r)
    )
    await updateRegistrationStatus(regId, s)
  }

  function handleInternalSave(regId: string, attendeeId: string, updates: Record<string, string | boolean>) {
    setRegistrations(prev =>
      prev.map(r => {
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por folio, nombre o correo…"
          value={search}
          onChange={e => { setSearch(e.target.value); resetPage() }}
          className="sm:max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={handleExport}>
          Exportar Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); resetPage() }}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        {uniqueTicketTypes.length > 0 && (
          <Select value={ticketTypeFilter} onValueChange={v => { setTicketTypeFilter(v); resetPage() }}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Tipo de acceso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {uniqueTicketTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {uniqueEvents.length > 1 && (
          <Select value={eventFilter} onValueChange={v => { setEventFilter(v); resetPage() }}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los eventos</SelectItem>
              {uniqueEvents.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(search || statusFilter !== 'all' || ticketTypeFilter !== 'all' || eventFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setTicketTypeFilter('all'); setEventFilter('all'); resetPage() }}
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
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <SortTH col="folio" active={sortCol} dir={sortDir} onSort={handleSort}>Folio</SortTH>
                <SortTH col="name" active={sortCol} dir={sortDir} onSort={handleSort}>Asistente</SortTH>
                <SortTH col="event" active={sortCol} dir={sortDir} onSort={handleSort}>Evento</SortTH>
                <SortTH col="ticket_type" active={sortCol} dir={sortDir} onSort={handleSort}>Tipo</SortTH>
                <SortTH col="amount" active={sortCol} dir={sortDir} onSort={handleSort} className="text-right">Monto</SortTH>
                <th className="px-4 py-3 text-left font-medium">Método</th>
                <SortTH col="status" active={sortCol} dir={sortDir} onSort={handleSort}>Estado</SortTH>
                <SortTH col="date" active={sortCol} dir={sortDir} onSort={handleSort}>Fecha</SortTH>
                {internalFields.length > 0 && (
                  <th className="px-4 py-3 text-left font-medium text-purple-700">Campos internos</th>
                )}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map(reg => (
                <RegistrationRow
                  key={reg.id}
                  reg={reg}
                  internalFields={internalFields.filter(f => (f as { event_id: string }).event_id === (reg as { event_id: string }).event_id)}
                  onStatusChange={handleStatusChange}
                  onInternalSave={handleInternalSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}

function SortTH({
  col,
  active,
  dir,
  onSort,
  children,
  className = '',
}: {
  col: SortCol
  active: SortCol
  dir: 'asc' | 'desc'
  onSort: (col: SortCol) => void
  children: React.ReactNode
  className?: string
}) {
  const isActive = active === col
  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  )
}

function RegistrationRow({
  reg,
  internalFields,
  onStatusChange,
  onInternalSave,
}: {
  reg: RegistrationRow
  internalFields: OrgField[]
  onStatusChange: (id: string, status: string) => Promise<void>
  onInternalSave: (regId: string, attendeeId: string, updates: Record<string, string | boolean>) => void
}) {
  const [statusPending, startStatus] = useTransition()
  const attendee = (reg.attendees as {
    id: string; first_name: string; last_name: string; email: string; extra_data: Record<string, unknown> | null
  }[])?.[0]
  const ticketType = (reg.tickets as { ticket_types: { name: string; currency: string } | null }[])?.[0]?.ticket_types
  const eventName = (reg.events as { name: string } | null)?.name
  const s = STATUS_LABELS[reg.status] ?? { label: reg.status, className: 'bg-gray-100 text-gray-600' }
  const hasInternalValues = internalFields.some(f => attendee?.extra_data?.[f.id] != null)

  function handleStatus(newStatus: string) {
    startStatus(async () => {
      await onStatusChange(reg.id, newStatus)
    })
  }

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/admin/inscritos/${reg.id}`}
          className="font-mono font-medium hover:underline text-xs"
        >
          {reg.folio}
        </Link>
      </td>
      <td className="px-4 py-3">
        {attendee ? (
          <div>
            <p className="font-medium">{attendee.first_name} {attendee.last_name}</p>
            <p className="text-muted-foreground text-xs">{attendee.email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{eventName ?? '—'}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{ticketType?.name ?? '—'}</td>
      <td className="px-4 py-3 text-right font-medium text-xs">
        {formatCurrency(reg.total_amount, ticketType?.currency ?? 'USD')}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {reg.payment_method ? METHOD_LABELS[reg.payment_method] ?? reg.payment_method : '—'}
      </td>
      <td className="px-4 py-3">
        <select
          value={reg.status}
          onChange={e => handleStatus(e.target.value)}
          disabled={statusPending}
          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-1 focus:ring-ring ${s.className}`}
        >
          <option value="draft">Borrador</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateShort(reg.created_at)}</td>
      {internalFields.length > 0 && (
        <td className="px-4 py-3">
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
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/inscritos/${reg.id}`}
          className="text-xs text-primary hover:underline"
        >
          Ver
        </Link>
      </td>
    </tr>
  )
}

function InternalFieldsDialog({
  reg,
  attendee,
  fields,
  hasValues,
  onSave,
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
            <p className="text-sm text-muted-foreground">
              {attendee.first_name} {attendee.last_name}
            </p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {fields.map(f => (
              <div key={f.id} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                {f.field_type === 'textarea' ? (
                  <Textarea
                    value={(values[f.id] as string) ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                    rows={2}
                  />
                ) : f.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(values[f.id] as boolean) ?? false}
                      onChange={e => setValues(v => ({ ...v, [f.id]: e.target.checked }))}
                      className="h-4 w-4 rounded"
                    />
                    {f.label}
                  </label>
                ) : f.field_type === 'select' ? (
                  <select
                    value={(values[f.id] as string) ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">Selecciona…</option>
                    {(f.options ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                    value={(values[f.id] as string) ?? ''}
                    onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
