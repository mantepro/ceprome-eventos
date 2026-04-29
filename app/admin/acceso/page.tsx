'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccesoPage() {
  const [stats, setStats] = useState<{ checkedIn: number; totalPaid: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadStats() {
      const [ticketRes, regRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'used'),
        supabase
          .from('registrations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'paid'),
      ])
      setStats({
        checkedIn: ticketRes.count ?? 0,
        totalPaid: regRes.count ?? 0,
      })
      setLoading(false)
    }

    loadStats()

    const channel = supabase
      .channel('acceso-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const updated = payload.new as { status: string }
          const prev = payload.old as { status: string }
          if (updated.status === 'used' && prev.status !== 'used') {
            setStats((s) => s ? { ...s, checkedIn: s.checkedIn + 1 } : s)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const pct = stats && stats.totalPaid > 0
    ? Math.round((stats.checkedIn / stats.totalPaid) * 100)
    : 0

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Acceso en vivo</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Se actualiza en tiempo real al escanear QR en la entrada.
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 w-48 bg-muted rounded-lg" />
          <div className="h-3 w-full bg-muted rounded-full" />
        </div>
      ) : stats ? (
        <div className="space-y-6">
          <div className="flex items-end gap-3">
            <p className="text-8xl font-bold tabular-nums leading-none">{stats.checkedIn}</p>
            <div className="pb-2 text-muted-foreground">
              <p className="text-2xl font-semibold">de {stats.totalPaid}</p>
              <p className="text-sm">asistentes</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Check-in completado</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-primary rounded-full h-2.5 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-1">Han entrado</p>
              <p className="text-2xl font-bold text-green-700">{stats.checkedIn}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-1">Aún no llegan</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {stats.totalPaid - stats.checkedIn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Conectado en tiempo real
          </div>
        </div>
      ) : null}
    </div>
  )
}
