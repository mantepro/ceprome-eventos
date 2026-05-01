'use client'

import { useTransition } from 'react'
import { toggleUserActive } from '@/lib/actions/users'
import { Button } from '@/components/ui/button'

interface Props {
  userId: string
  active: boolean
}

export function UserToggleActive({ userId, active }: Props) {
  const [pending, start] = useTransition()

  function handleToggle() {
    start(async () => {
      const result = await toggleUserActive(userId, active)
      if (result.error) alert(result.error)
    })
  }

  return (
    <Button size="sm" variant="outline" onClick={handleToggle} disabled={pending}>
      {pending ? '…' : active ? 'Desactivar' : 'Activar'}
    </Button>
  )
}
