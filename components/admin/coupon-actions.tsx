'use client'

import { useTransition } from 'react'
import { toggleCouponActive, deleteCoupon } from '@/lib/actions/coupons'
import { Button } from '@/components/ui/button'

interface Props {
  couponId: string
  active: boolean
  usedCount: number
}

export function CouponActions({ couponId, active, usedCount }: Props) {
  const [toggling, startToggle] = useTransition()
  const [deleting, startDelete] = useTransition()
  const busy = toggling || deleting

  function handleToggle() {
    startToggle(async () => {
      const result = await toggleCouponActive(couponId, active)
      if (result.error) alert(result.error)
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
