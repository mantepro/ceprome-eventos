'use client'

import { useState, useTransition } from 'react'
import PhoneInput from 'react-phone-number-input'
import type { E164Number } from 'libphonenumber-js/core'
import 'react-phone-number-input/style.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createRegistration } from '@/lib/actions/registration'
import { COUNTRIES_ES } from '@/lib/data/countries-es'
import type { Event, TicketType, EventField } from '@/types/database'

type Step = 1 | 2 | 3 | 4

const NORMAL_STEPS = ['Datos', 'Inscripción', 'Pago', 'Resumen']
const PREREG_STEPS = ['Datos', 'Inscripción', 'Confirmación']

interface Props {
  event: Event
  ticketTypes: TicketType[]
  orgSlug: string
  orgId: string
  preselectedTypeId?: string
  preselectedPayment?: 'preregister'
  eventFields?: EventField[]
  allowPreregistration?: boolean
}

export function RegistrationForm({
  event,
  ticketTypes,
  orgSlug,
  orgId,
  preselectedTypeId,
  preselectedPayment,
  eventFields = [],
  allowPreregistration = false,
}: Props) {
  const isPreregFlow = preselectedPayment === 'preregister'
  const [step, setStep] = useState<Step>(1)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState<E164Number | undefined>(undefined)
  const [extraData, setExtraData] = useState<Record<string, string | boolean>>({})
  const [selectedTypeId, setSelectedTypeId] = useState(preselectedTypeId ?? '')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'manual' | 'preregister' | ''>(
    preselectedPayment ?? ''
  )
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedType = ticketTypes.find((t) => t.id === selectedTypeId)
  const displaySteps = isPreregFlow ? PREREG_STEPS : NORMAL_STEPS
  const displayStep = isPreregFlow && step === 4 ? 3 : step

  const paymentOptions = [
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
    ...(allowPreregistration
      ? [
          {
            value: 'preregister' as const,
            label: 'Registrarme ahora, completar pago después',
            desc: 'Tu lugar queda reservado — recibirás instrucciones de pago por correo',
          },
        ]
      : []),
  ]

  function validateStep1(): string | null {
    if (!firstName.trim() || firstName.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.'
    if (!lastName.trim() || lastName.trim().length < 2) return 'El apellido debe tener al menos 2 caracteres.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido.'
    if (!phone) return 'El teléfono es obligatorio.'
    const phoneDigits = String(phone).replace(/\D/g, '')
    if (phoneDigits.length < 8) return 'El teléfono debe tener al menos 8 dígitos.'
    if (phoneDigits.length > 15) return 'El teléfono debe tener como máximo 15 dígitos.'
    for (const field of eventFields) {
      if (!field.required) continue
      const val = extraData[field.id]
      if (field.field_type === 'checkbox') {
        if (!val) return `El campo "${field.label}" es obligatorio.`
      } else {
        if (!val || String(val).trim() === '') return `El campo "${field.label}" es obligatorio.`
      }
    }
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
      setStep(isPreregFlow ? 4 : 3)
    } else if (step === 3) {
      if (!paymentMethod) { setError('Selecciona un método de pago.'); return }
      setStep(4)
    }
  }

  function handleBack() {
    setError('')
    if (step === 4 && isPreregFlow) {
      setStep(2)
    } else {
      setStep((step - 1) as Step)
    }
  }

  function handleSubmit() {
    if (!selectedTypeId) return
    if (!isPreregFlow && !paymentMethod) return
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
        phone: String(phone ?? ''),
        paymentMethod: isPreregFlow ? 'preregister' : (paymentMethod as 'online' | 'manual'),
        extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
      })
      if (result?.error) setError(result.error)
    })
  }

  const paymentLabel =
    paymentMethod === 'online'
      ? 'PayPal'
      : paymentMethod === 'manual'
      ? 'Transferencia / Depósito bancario'
      : paymentMethod === 'preregister'
      ? 'Completar pago después'
      : ''

  return (
    <div>
      <StepIndicator current={displayStep as Step} steps={displaySteps} />

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
                placeholder=""
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder=""
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
              placeholder=""
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <PhoneInput
              id="phone"
              defaultCountry="MX"
              value={phone}
              onChange={setPhone}
            />
          </div>

          {eventFields.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              {eventFields.map((field) => (
                <ExtraField
                  key={field.id}
                  field={field}
                  value={extraData[field.id]}
                  onChange={(val) => setExtraData((prev) => ({ ...prev, [field.id]: val }))}
                />
              ))}
            </div>
          )}
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
                    {isSoldOut && <p className="text-xs text-muted-foreground mt-0.5">Agotado</p>}
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

      {step === 3 && !isPreregFlow && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">Selecciona cómo realizarás tu pago:</p>
          {paymentOptions.map((opt) => (
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
          {isPreregFlow && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <p className="font-medium mb-1">Pre-registro</p>
              <p className="text-xs">
                Tu lugar quedará reservado. Recibirás instrucciones de pago por correo electrónico
                para completar tu inscripción.
              </p>
            </div>
          )}
          <div className="rounded-lg border bg-muted/30 divide-y text-sm">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Asistente</p>
              <p className="font-medium">
                {firstName} {lastName}
              </p>
              <p className="text-muted-foreground">{email}</p>
              {phone && <p className="text-muted-foreground">{phone}</p>}
              {eventFields.map((field) => {
                const val = extraData[field.id]
                if (val === undefined || val === '' || val === false) return null
                return (
                  <p key={field.id} className="text-muted-foreground">
                    {field.label}: {field.field_type === 'checkbox' ? 'Sí' : String(val)}
                  </p>
                )
              })}
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Inscripción</p>
              <p className="font-medium">{selectedType.name}</p>
              <p className="font-bold">
                ${selectedType.price.toLocaleString()} {selectedType.currency}
              </p>
            </div>
            {!isPreregFlow && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Método de pago</p>
                <p className="font-medium">{paymentLabel}</p>
              </div>
            )}
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
            {isPending
              ? 'Procesando...'
              : isPreregFlow
              ? 'Confirmar pre-registro'
              : 'Confirmar inscripción'}
          </Button>
        )}
      </div>
    </div>
  )
}

function ExtraField({
  field,
  value,
  onChange,
}: {
  field: EventField
  value: string | boolean | undefined
  onChange: (val: string | boolean) => void
}) {
  const helperText = (field as { helper_text?: string | null }).helper_text

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {field.field_type === 'text' && (
        <Input
          id={field.id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder=""
        />
      )}

      {field.field_type === 'textarea' && (
        <Textarea
          id={field.id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder=""
          rows={3}
        />
      )}

      {field.field_type === 'number' && (
        <Input
          id={field.id}
          type="number"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder=""
        />
      )}

      {field.field_type === 'date' && (
        <Input
          id={field.id}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.field_type === 'select' && (
        <select
          id={field.id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Selecciona una opción…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.field_type === 'country' && (
        <select
          id={field.id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Selecciona un país…</option>
          {COUNTRIES_ES.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      )}

      {field.field_type === 'radio' && (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={(value as string) === opt}
                onChange={() => onChange(opt)}
                className="h-4 w-4"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {field.field_type === 'checkbox' && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            id={field.id}
            type="checkbox"
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          {field.label}
        </label>
      )}

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}

function StepIndicator({ current, steps }: { current: Step; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-8 mb-8">
      {steps.map((label, i) => {
        const n = (i + 1) as Step
        const isActive = current === n
        const isDone = current > n
        return (
          <div key={label} className="flex flex-col items-center gap-1.5 w-16">
            <div
              className={`h-8 w-8 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-semibold leading-none border-2 transition-colors ${
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
              className={`text-xs text-center leading-tight ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
