'use client'

import { useMemo, useState } from 'react'
import { CouponActions } from '@/components/admin/coupon-actions'
import { formatDateShort } from '@/lib/utils'
import type { CouponRow } from '@/lib/queries/admin'

interface Props {
  coupons: CouponRow[]
}

export function CouponsTable({ coupons: initial }: Props) {
  const [coupons, setCoupons] = useState(initial)
  const [showArchived, setShowArchived] = useState(false)

  const visible = useMemo(
    () => (showArchived ? coupons : coupons.filter((c) => !c.archived)),
    [coupons, showArchived]
  )

  function handleArchiveChange(couponId: string, archived: boolean) {
    setCoupons((prev) => prev.map((c) => (c.id === couponId ? { ...c, archived } : c)))
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Mostrar archivados
      </label>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <p className="font-medium">Sin cupones para mostrar</p>
          <p className="text-sm mt-1">Ajusta el filtro de arriba o crea uno nuevo.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-left font-medium">Evento</th>
                <th className="px-4 py-3 text-center font-medium">Beca</th>
                <th className="px-4 py-3 text-left font-medium">Aprobado por</th>
                <th className="px-4 py-3 text-left font-medium">Motivo</th>
                <th className="px-4 py-3 text-right font-medium">Usos</th>
                <th className="px-4 py-3 text-left font-medium">Creado</th>
                <th className="px-4 py-3 text-right font-medium">Estado / Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((c) => {
                const eventName = (c.events as { name: string } | null)?.name
                const usageText =
                  c.max_uses !== null
                    ? `${c.used_count} / ${c.max_uses}`
                    : `${c.used_count} / ∞`
                const exhausted = c.max_uses !== null && c.used_count >= c.max_uses

                return (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-sm">{c.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.type === 'percentage' ? 'Porcentaje' : 'Monto fijo'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {c.type === 'percentage' ? `${c.value}%` : `$${c.value.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {eventName ?? <span className="italic">Global</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.count_as_scholarship ? (
                        <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.approved_by ?? <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.description ? (
                        <span
                          className="block max-w-[200px] truncate"
                          title={c.description}
                        >
                          {c.description}
                        </span>
                      ) : (
                        <span className="italic">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${exhausted ? 'text-destructive' : ''}`}>
                      {usageText}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateShort(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CouponActions
                        couponId={c.id}
                        active={c.active}
                        archived={c.archived}
                        usedCount={c.used_count}
                        onArchiveChange={(archived) => handleArchiveChange(c.id, archived)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
