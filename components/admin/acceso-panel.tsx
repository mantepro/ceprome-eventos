'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { LogIn, Search, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import {
  checkInTicket,
  revertCheckIn,
  registerCashPayment,
  fetchEventRegistrations,
} from '@/lib/actions/checkin'
import { formatCurrency, formatTime } from '@/lib/utils'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { AdminEvent, EventRegistrationRow } from '@/lib/queries/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

type Ticket = {
  id: string
  status: 'active' | 'cancelled' | 'pending' | 'used'
  checked_in_at: string | null
  ticket_types: { name: string; currency: string } | null
}

type Attendee = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
}

type HistoryItem = {
  regId: string
  ticketId: string
  name: string
  folio: string
  checkedInAt: string
  isPaid: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FOLIO_RE = /^REG-\d{4}-[A-Z0-9]{4}$/i

function getAttendee(reg: EventRegistrationRow): Attendee | null {
  return (reg.attendees as Attendee[])?.[0] ?? null
}

function getTicket(reg: EventRegistrationRow): Ticket | null {
  return (reg.tickets as Ticket[])?.[0] ?? null
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase()
}

function toHistoryItem(reg: EventRegistrationRow): HistoryItem | null {
  const att = getAttendee(reg)
  const ticket = getTicket(reg)
  if (!ticket?.checked_in_at) return null
  return {
    regId: reg.id,
    ticketId: ticket.id,
    name: att ? `${att.first_name} ${att.last_name}` : '—',
    folio: reg.folio,
    checkedInAt: ticket.checked_in_at,
    isPaid: reg.status === 'paid',
  }
}

function playSound(type: 'success' | 'error') {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime)
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15)
    }
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // AudioContext unavailable — silently ignore
  }
}

function updateTicketInList(
  prev: EventRegistrationRow[],
  regId: string,
  patch: { status?: string; checked_in_at?: string | null }
): EventRegistrationRow[] {
  return prev.map((r) => {
    if (r.id !== regId) return r
    return {
      ...r,
      tickets: (r.tickets as unknown[]).map((t, i) =>
        i === 0 ? { ...(t as object), ...patch } : t
      ),
    } as EventRegistrationRow
  })
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  events: AdminEvent[]
  defaultEventId: string | null
  initialRegistrations: EventRegistrationRow[]
  orgId: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AccesoPanel({ events, defaultEventId, initialRegistrations, orgId }: Props) {
  const [selectedEventId, setSelectedEventId] = useState(defaultEventId ?? '')
  const [registrations, setRegistrations] = useState(initialRegistrations)
  const [loadingRegs, setLoadingRegs] = useState(false)

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<EventRegistrationRow[]>([])
  const [activeResult, setActiveResult] = useState<EventRegistrationRow | null>(null)

  const [history, setHistory] = useState<HistoryItem[]>(() =>
    initialRegistrations
      .map(toHistoryItem)
      .filter((h): h is HistoryItem => h !== null)
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
      .slice(0, 10)
  )

  const [flashingRegId, setFlashingRegId] = useState<string | null>(null)

  const [pendingCheckinConfirm, setPendingCheckinConfirm] = useState<{
    regId: string; ticketId: string
  } | null>(null)
  const [cashPaymentTarget, setCashPaymentTarget] = useState<{
    regId: string; ticketId: string | null; amount: number; currency: string
  } | null>(null)
  const [cashDoPayment, setCashDoPayment] = useState(true)
  const [cashDoCheckIn, setCashDoCheckIn] = useState(true)

  const inputRef = useRef<HTMLInputElement>(null)
  const registrationsRef = useRef(registrations)
  useEffect(() => { registrationsRef.current = registrations }, [registrations])

  // ── Autofocus on mount ──────────────────────────────────────────────────
  useEffect(() => { inputRef.current?.focus() }, [])

  function refocusInput() {
    setTimeout(() => inputRef.current?.focus(), 120)
  }

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = registrations.length
    const checkin = registrations.filter((r) => getTicket(r)?.status === 'used').length
    const pending = registrations.filter(
      (r) => r.status === 'pending' || r.status === 'draft'
    ).length
    return { total, checkin, pending }
  }, [registrations])

  // ── Search ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = search.trim()
    if (!q) { setSearchResults([]); setActiveResult(null); return }

    const doSearch = () => {
      const lower = q.toLowerCase()
      const matches = registrations.filter((r) => {
        const att = getAttendee(r)
        return (
          r.folio.toLowerCase() === lower ||
          att?.email?.toLowerCase().includes(lower) ||
          att?.first_name?.toLowerCase().includes(lower) ||
          att?.last_name?.toLowerCase().includes(lower) ||
          `${att?.first_name ?? ''} ${att?.last_name ?? ''}`.toLowerCase().includes(lower)
        )
      })
      setSearchResults(matches)
      setActiveResult(matches.length === 1 ? matches[0] : null)
    }

    if (FOLIO_RE.test(q)) { doSearch(); return }
    const t = setTimeout(doSearch, 300)
    return () => clearTimeout(t)
  }, [search, registrations])

  // ── Keep activeResult in sync with registrations updates ───────────────
  useEffect(() => {
    if (!activeResult) return
    const updated = registrations.find((r) => r.id === activeResult.id)
    if (updated) setActiveResult(updated)
  }, [registrations]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedEventId) return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`acceso-live-${selectedEventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `event_id=eq.${selectedEventId}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string
            registration_id: string
            status: string
            checked_in_at: string | null
          }
          const o = payload.old as { status: string }

          if (n.status === 'used' && o.status !== 'used') {
            setRegistrations((prev) =>
              updateTicketInList(prev, n.registration_id, {
                status: 'used',
                checked_in_at: n.checked_in_at,
              })
            )
            const reg = registrationsRef.current.find((r) => r.id === n.registration_id)
            if (reg) {
              const att = getAttendee(reg)
              const item: HistoryItem = {
                regId: reg.id,
                ticketId: n.id,
                name: att ? `${att.first_name} ${att.last_name}` : '—',
                folio: reg.folio,
                checkedInAt: n.checked_in_at ?? new Date().toISOString(),
                isPaid: reg.status === 'paid',
              }
              setHistory((prev) => {
                if (prev.some((h) => h.ticketId === n.id)) return prev
                return [item, ...prev].slice(0, 10)
              })
            }
          } else if (n.status === 'active' && o.status === 'used') {
            setRegistrations((prev) =>
              updateTicketInList(prev, n.registration_id, {
                status: 'active',
                checked_in_at: null,
              })
            )
            setHistory((prev) => prev.filter((h) => h.ticketId !== n.id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedEventId])

  // ── Event change ────────────────────────────────────────────────────────
  async function handleEventChange(eventId: string) {
    setSelectedEventId(eventId)
    setLoadingRegs(true)
    setSearch('')
    setSearchResults([])
    setActiveResult(null)

    const regs = await fetchEventRegistrations(eventId)
    setRegistrations(regs)
    setHistory(
      regs
        .map(toHistoryItem)
        .filter((h): h is HistoryItem => h !== null)
        .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
        .slice(0, 10)
    )
    setLoadingRegs(false)
    refocusInput()
  }

  // ── Check-in actions ────────────────────────────────────────────────────
  async function executeCheckIn(regId: string, ticketId: string) {
    const now = new Date().toISOString()
    setRegistrations((prev) => updateTicketInList(prev, regId, { status: 'used', checked_in_at: now }))

    const result = await checkInTicket(ticketId)
    if (result.error) {
      setRegistrations((prev) =>
        updateTicketInList(prev, regId, { status: 'active', checked_in_at: null })
      )
      toast.error('Error al registrar check-in')
      playSound('error')
      return
    }

    const reg = registrationsRef.current.find((r) => r.id === regId)
    if (reg) {
      const att = getAttendee(reg)
      const item: HistoryItem = {
        regId: reg.id,
        ticketId,
        name: att ? `${att.first_name} ${att.last_name}` : '—',
        folio: reg.folio,
        checkedInAt: now,
        isPaid: reg.status === 'paid',
      }
      setHistory((prev) => [item, ...prev].slice(0, 10))
    }

    toast.success('✅ Check-in registrado', {
      action: { label: 'Deshacer', onClick: () => handleRevertCheckIn(regId, ticketId) },
    })
    playSound('success')
    setSearch('')
    setSearchResults([])
    setFlashingRegId(regId)
    setTimeout(() => {
      setActiveResult(null)
      setFlashingRegId(null)
      refocusInput()
    }, 450)
  }

  function handleCheckIn(regId: string, ticketId: string, isPaid: boolean) {
    if (!isPaid) { setPendingCheckinConfirm({ regId, ticketId }); return }
    executeCheckIn(regId, ticketId)
  }

  async function handleRevertCheckIn(regId: string, ticketId: string) {
    setRegistrations((prev) =>
      updateTicketInList(prev, regId, { status: 'active', checked_in_at: null })
    )
    setHistory((prev) => prev.filter((h) => h.ticketId !== ticketId))
    const result = await revertCheckIn(ticketId)
    if (result.error) toast.error('Error al revertir check-in')
    else toast.success('Check-in revertido')
  }

  async function handleConfirmCashPayment() {
    if (!cashPaymentTarget) return
    const { regId, ticketId } = cashPaymentTarget
    setCashPaymentTarget(null)

    if (cashDoPayment) {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id !== regId ? r : { ...r, status: 'paid', payment_method: 'manual' as const }
        )
      )
      const result = await registerCashPayment(regId)
      if (result.error) {
        setRegistrations((prev) =>
          prev.map((r) => (r.id !== regId ? r : { ...r, status: 'pending' }))
        )
        toast.error('Error al registrar pago')
        return
      }
    }

    if (cashDoCheckIn && ticketId) {
      await executeCheckIn(regId, ticketId)
    } else {
      toast.success('✅ Pago en efectivo registrado')
      refocusInput()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const selectedEvent = events.find((e) => e.id === selectedEventId)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Modals ── */}
      <Dialog open={pendingCheckinConfirm !== null} onOpenChange={() => setPendingCheckinConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>⚠️ Pago pendiente</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Este asistente aún no ha completado su pago. ¿Deseas registrar su entrada de todos modos?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingCheckinConfirm(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (pendingCheckinConfirm) executeCheckIn(pendingCheckinConfirm.regId, pendingCheckinConfirm.ticketId)
              setPendingCheckinConfirm(null)
            }}>
              Registrar de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashPaymentTarget !== null} onOpenChange={(open) => { if (!open) setCashPaymentTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pago en efectivo</DialogTitle></DialogHeader>
          <p className="text-sm font-semibold">
            {formatCurrency(cashPaymentTarget?.amount ?? 0, cashPaymentTarget?.currency ?? 'USD')}
          </p>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cashDoPayment} onChange={(e) => setCashDoPayment(e.target.checked)} className="h-4 w-4 rounded" />
              Marcar como pagado (método: efectivo)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cashDoCheckIn} onChange={(e) => setCashDoCheckIn(e.target.checked)} className="h-4 w-4 rounded" />
              Registrar entrada (check-in)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashPaymentTarget(null)}>Cancelar</Button>
            <Button onClick={handleConfirmCashPayment}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acceso en vivo</h1>
          {selectedEvent && (
            <p className="text-sm text-muted-foreground mt-0.5">{selectedEvent.name}</p>
          )}
        </div>
        {events.length > 1 && (
          <Select value={selectedEventId} onValueChange={handleEventChange}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Seleccionar evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total inscritos</p>
          <p className="text-2xl font-bold mt-0.5">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">✅ Presentes</p>
          <p className="text-2xl font-bold mt-0.5 text-green-700">{stats.checkin}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">🚪 Por llegar</p>
          <p className="text-2xl font-bold mt-0.5 text-blue-700">{stats.total - stats.checkin}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pago pendiente</p>
          <p className={`text-2xl font-bold mt-0.5 ${stats.pending > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
            {stats.pending}
          </p>
        </div>
      </div>

      {/* ── Search input ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, folio o escanear QR..."
          disabled={loadingRegs || !selectedEventId}
          className="w-full rounded-lg border-2 border-input bg-background pl-12 pr-4 py-4 text-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          autoComplete="off"
          spellCheck={false}
        />
        {loadingRegs && (
          <p className="text-xs text-muted-foreground mt-1.5">Cargando registros…</p>
        )}
      </div>

      {/* ── No event configured ── */}
      {!selectedEventId && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <p className="font-medium">Sin eventos activos</p>
          <p className="text-sm mt-1">No hay eventos publicados en este momento.</p>
        </div>
      )}

      {/* ── Not found ── */}
      {search.trim() && !loadingRegs && searchResults.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          <p className="font-medium">No encontrado</p>
          <p className="text-sm mt-1">No hay inscritos que coincidan con «{search.trim()}»</p>
        </div>
      )}

      {/* ── Multiple results ── */}
      {searchResults.length > 1 && !activeResult && (
        <div className="rounded-lg border divide-y">
          {searchResults.slice(0, 6).map((reg) => {
            const att = getAttendee(reg)
            const ticket = getTicket(reg)
            return (
              <button
                key={reg.id}
                onClick={() => setActiveResult(reg)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-sm">{att ? `${att.first_name} ${att.last_name}` : '—'}</p>
                  <p className="text-xs text-muted-foreground">{reg.folio} · {att?.email}</p>
                </div>
                <StatusBadge reg={reg} ticket={ticket} />
              </button>
            )
          })}
          {searchResults.length > 6 && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              +{searchResults.length - 6} más — refina la búsqueda
            </p>
          )}
        </div>
      )}

      {/* ── Single result card ── */}
      {activeResult && (
        <ResultCard
          reg={activeResult}
          isFlashing={flashingRegId === activeResult.id}
          onCheckIn={handleCheckIn}
          onCashPayment={(regId, ticketId, amount, currency) => {
            setCashDoPayment(true)
            setCashDoCheckIn(true)
            setCashPaymentTarget({ regId, ticketId, amount, currency })
          }}
          onDismiss={() => { setActiveResult(null); setSearch(''); refocusInput() }}
        />
      )}

      {/* ── Realtime indicator ── */}
      {selectedEventId && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Conectado en tiempo real
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Últimos registros
          </h2>
          <div className="rounded-lg border divide-y">
            {history.map((item) => (
              <div
                key={item.ticketId}
                className="flex items-center gap-3 px-4 py-3"
                style={{ backgroundColor: item.isPaid ? '#f0fdf4' : '#fffbeb' }}
              >
                <div
                  className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${item.isPaid ? 'bg-green-600' : 'bg-amber-500'}`}
                >
                  {initials(item.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.folio}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums">{formatTime(item.checkedInAt)}</p>
                  {!item.isPaid && <p className="text-xs text-amber-600">⚠️ Pago pendiente</p>}
                </div>
                <button
                  onClick={() => handleRevertCheckIn(item.regId, item.ticketId)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1 transition-colors"
                >
                  Deshacer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ reg, ticket }: { reg: EventRegistrationRow; ticket: Ticket | null }) {
  if (ticket?.status === 'used') {
    return (
      <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full whitespace-nowrap">
        ✅ {ticket.checked_in_at ? formatTime(ticket.checked_in_at) : 'Registrado'}
      </span>
    )
  }
  if (reg.status === 'paid') {
    return (
      <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
        Pagado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-400 px-2 py-0.5 rounded-full whitespace-nowrap">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
      Pago pendiente
    </span>
  )
}

function ResultCard({
  reg,
  isFlashing,
  onCheckIn,
  onCashPayment,
  onDismiss,
}: {
  reg: EventRegistrationRow
  isFlashing: boolean
  onCheckIn: (regId: string, ticketId: string, isPaid: boolean) => void
  onCashPayment: (regId: string, ticketId: string | null, amount: number, currency: string) => void
  onDismiss: () => void
}) {
  const att = getAttendee(reg)
  const ticket = getTicket(reg)
  const isPaid = reg.status === 'paid'
  const isCheckedIn = ticket?.status === 'used'
  const currency = ticket?.ticket_types?.currency ?? 'USD'

  return (
    <div
      className={`rounded-lg border p-5 space-y-4 transition-colors duration-300 ${isFlashing ? 'bg-green-100 border-green-400' : isCheckedIn ? (isPaid ? 'bg-[#f0fdf4]' : 'bg-[#fffbeb]') : ''}`}
    >
      {/* Info row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold">
            {att ? `${att.first_name} ${att.last_name}` : '—'}
          </p>
          <p className="text-sm text-muted-foreground">{att?.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{reg.folio}</p>
        </div>
        <StatusBadge reg={reg} ticket={ticket} />
      </div>

      {/* Ticket type + amount */}
      {ticket?.ticket_types && (
        <p className="text-sm text-muted-foreground">
          {ticket.ticket_types.name} · <span className="font-semibold text-base text-foreground">{formatCurrency(reg.total_amount, currency)}</span>
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {isCheckedIn ? (
          <>
            <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
              ✅ Entrada registrada a las {ticket?.checked_in_at ? formatTime(ticket.checked_in_at) : '—'}
              {!isPaid && <span className="text-amber-600 text-xs">⚠️ Pago pendiente</span>}
            </div>
            <button
              disabled
              className="inline-flex items-center gap-1.5 text-sm bg-muted text-muted-foreground rounded-lg px-4 py-2.5 opacity-50 cursor-not-allowed"
            >
              <LogIn className="h-4 w-4" />
              Entrada ya registrada
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => ticket && onCheckIn(reg.id, ticket.id, isPaid)}
              disabled={!ticket?.id}
              className="inline-flex items-center gap-1.5 text-sm bg-green-600 text-white rounded-lg px-4 py-2.5 hover:bg-green-700 transition-colors cursor-pointer font-medium min-h-[44px] disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              Registrar entrada
            </button>
            {!isPaid && (
              <button
                onClick={() => onCashPayment(reg.id, ticket?.id ?? null, reg.total_amount, currency)}
                className="inline-flex items-center gap-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer min-h-[44px]"
              >
                💵 Registrar pago + entrada
              </button>
            )}
          </>
        )}
        <Link
          href={`/admin/inscritos/${reg.id}`}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground px-3 py-2.5 transition-colors"
        >
          Ver detalle
        </Link>
        <button
          onClick={onDismiss}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-2 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
