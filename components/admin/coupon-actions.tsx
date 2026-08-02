'use client'

import { useTransition } from 'react'
import { toggleCouponActive, archiveCoupon, deleteCoupon } from '@/lib/actions/coupons'
import { Button } from '@/components/ui/button'

interface Props {
  couponId: string
  active: boolean
  archived: boolean
  usedCount: number
  onArchiveChange?: (archived: boolean) => void
}

export function CouponActions({ couponId, active, archived, usedCount, onArchiveChange }: Props) {
  const [toggling, startToggle] = useTransition()
  const [archiving, startArchive] = useTransition()
  const [deleting, startDelete] = useTransition()
  const busy = toggling || archiving || deleting

  function handleToggle() {
    startToggle(async () => {
      const result = await toggleCouponActive(couponId, active)
      if (result.error) alert(result.error)
    })
  }

  function handleArchive(nextArchived: boolean) {
    startArchive(async () => {
      const result = await archiveCoupon(couponId, nextArchived)
      if (result.error) { alert(result.error); return }
      onArchiveChange?.(nextArchived)
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar este cupón?')) return
    startDelete(async () => {
      const result = await deleteCoupon(couponId)
      if (result.error) alert(result.error)
    })
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {active ? 'Activo' : 'Inactivo'}
      </span>
      <Button size="sm" variant="outline" onClick={handleToggle} disabled={busy}>
        {toggling ? '…' : active ? 'Desactivar' : 'Activar'}
      </Button>
      <Button size="sm" variant="outline" onClick={() => handleArchive(!archived)} disabled={busy}>
        {archiving ? '…' : archived ? 'Desarchivar' : 'Archivar'}
      </Button>
      {usedCount === 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleDelete}
          disabled={busy}
          className="text-destructive hover:text-destructive"
        >
          {deleting ? '…' : 'Eliminar'}
        </Button>
      )}
    </div>
  )
}
