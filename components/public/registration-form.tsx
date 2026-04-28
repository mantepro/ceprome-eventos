'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createRegistration } from '@/lib/actions/registration'
import type { Event, TicketType } from '@/types/database'

type Step = 1 | 2 | 3 | 4

const STEPS = ['Datos', 'Inscripción', 'Pago', 'Resumen']

const PAYMENT_OPTIONS = [
  {
    value: 'manual' as const,
    label: 'Transferencia / Depósito bancario',
    desc: 'Te enviaremos los datos bancarios por correo',
  },
  {
    value: 'online' as const,
    label: 'PayPal',
    desc: 'Pago seguro con tarjeta o cuenta PayPal',
  },
]

interface Props {
  event: Event
  ticketTypes: TicketType[]
  orgSlug: string
  orgId: string
  preselectedTypeId?: string
}

export function RegistrationForm({ event, ticketTypes, orgSlug, orgId, preselectedTypeId }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState(preselectedTypeId ?? '')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'manual' | ''>('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedType = ticketTypes.find((t) => t.id === selectedTypeId)

  function validateStep1(): string | null {
    if (!firstName.trim() || firstName.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.'
    if (!lastName.trim() || lastName.trim().length < 2) return 'El apellido debe tener al menos 2 caracteres.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido.'
    return null
  }

  function handleNext() {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setStep(2)
    } else if (step === 2) {
      if (!selectedTypeId) { setError('Selecciona un tipo de inscripción.'); return }
      setStep(3)
    } else if (step === 3) {
      if (!paymentMethod) { setError('Selecciona un método de pago.'); return }
      setStep(4)
    }
  }

  function handleBack() {
    setError('')
    setStep((step - 1) as Step)
  }

  function handleSubmit() {
    if (!paymentMethod || !selectedTypeId) return
    setError('')
    startTransition(async () => {
      const result = await createRegistration({
        orgSlug,
        orgId,
        eventId: event.id,
        ticketTypeId: selectedTypeId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        paymentMethod,
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div>
      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="María"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="García"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Teléfono <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">Selecciona tu tipo de inscripción:</p>
          {ticketTypes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay tipos de inscripción disponibles.
            </p>
          )}
          {ticketTypes.map((tt) => {
            const isSoldOut = tt.capacity !== null && tt.sold_count >= tt.capacity
            const isSelected = selectedTypeId === tt.id
            return (
              <button
                key={tt.id}
                type="button"
                disabled={isSoldOut}
                onClick={() => !isSoldOut && setSelectedTypeId(tt.id)}
                className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : isSoldOut
                    ? 'border-muted opacity-50 cursor-not-allowed'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{tt.name}</p>
                    {isSoldOut && (
                      <p className="text-xs text-muted-foreground mt-0.5">Agotado</p>
                    )}
                  </div>
                  <p className="font-bold text-right">
                    ${tt.price.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-muted-foreground">{tt.currency}</span>
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">Selecciona cómo realizarás tu pago:</p>
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPaymentMethod(opt.value)}
              className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-colors ${
                paymentMethod === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      )}

      {step === 4 && selectedType && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 divide-y text-sm">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Asistente</p>
              <p className="font-medium">{firstName} {lastName}</p>
              <p className="text-muted-foreground">{email}</p>
              {phone && <p className="text-muted-foreground">{phone}</p>}
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Inscripción</p>
              <p className="font-medium">{selectedType.name}</p>
              <p className="font-bold">${selectedType.price.toLocaleString()} {selectedType.currency}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Método de pago</p>
              <p className="font-medium">
                {paymentMethod === 'online' ? 'PayPal' : 'Transferencia / Depósito bancario'}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Al confirmar aceptas los términos y condiciones del evento.
          </p>
        </div>
      )}

      <div className={`flex mt-6 gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
        {step > 1 && (
          <Button variant="outline" onClick={handleBack} disabled={isPending}>
            Atrás
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={handleNext}>Continuar</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Procesando...' : 'Confirmar inscripción'}
          </Button>
        )}
      </div>
    </div>
  )
}

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-6 mb-8">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step
        const isActive = current === n
        const isDone = current > n
        return (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                isDone
                  ? 'bg-primary border-primary text-primary-foreground'
                  : isActive
                  ? 'border-primary text-primary'
                  : 'border-muted-foreground/30 text-muted-foreground'
              }`}
            >
              {isDone ? '✓' : n}
            </div>
            <span
              className={`text-xs ${
                isActive ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
