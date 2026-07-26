'use client'

import { useEffect, useState } from 'react'

interface Props {
  targetDate: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

const UNITS: Array<{ key: keyof TimeLeft; label: string }> = [
  { key: 'days', label: 'DÍAS' },
  { key: 'hours', label: 'HORAS' },
  { key: 'minutes', label: 'MIN' },
  { key: 'seconds', label: 'SEG' },
]

export function CountdownTimer({ targetDate }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates SSR-safe dashes with the real countdown on mount
    setTimeLeft(getTimeLeft(targetDate))
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate))
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return (
    <div className="grid grid-cols-4 gap-2">
      {UNITS.map((unit) => (
        <div
          key={unit.key}
          className="flex flex-col items-center justify-center rounded-lg bg-white/15 py-2.5"
        >
          <span className="text-xl font-bold tabular-nums sm:text-2xl">
            {timeLeft ? String(timeLeft[unit.key]).padStart(2, '0') : '--'}
          </span>
          <span className="mt-0.5 text-[10px] font-medium tracking-wide text-white/80">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  )
}
