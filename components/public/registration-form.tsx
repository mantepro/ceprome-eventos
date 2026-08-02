'use client'

import { useState, useTransition } from 'react'
import PhoneInput, { getCountryCallingCode, type Country } from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import es from 'react-phone-number-input/locale/es.json'
import type { E164Number, CountryCode } from 'libphonenumber-js/core'
import 'react-phone-number-input/style.css'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createRegistration } from '@/lib/actions/registration'
import { validateCoupon, type CouponValidationResult } from '@/lib/actions/coupons'
import { COUNTRIES_ES } from '@/lib/data/countries-es'
import { COUNTRY_NAME_TO_ISO } from '@/lib/data/country-codes'
import type { Event, TicketType, EventField } from '@/types/database'

type Step = 1 | 2 | 3 | 4
type Bubble = 1 | 2 | 3

const STEPS = ['Datos personales', 'Acceso y pago', 'Congreso']

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  1: { title: 'Datos personales', subtitle: 'Cuéntanos quién eres para generar tu inscripción.' },
  2: { title: 'Tipo de acceso', subtitle: 'Elige el pase con el que asistirás al congreso.' },
  3: { title: 'Método de pago', subtitle: 'Elige cómo quieres completar tu pago. Ninguna opción te cobra automáticamente hasta que tú lo confirmes.' },
  4: { title: 'Revisa tu inscripción', subtitle: 'Confirma que todo esté correcto antes de continuar.' },
}

function toBubble(step: Step): Bubble {
  if (step === 1) return 1
  if (step === 4) return 3
  return 2
}

const OTHER_OPTION = 'Otro'

function resolveFieldValue(
  field: EventField,
  raw: string | boolean | string[],
  otherText: string
): string | boolean | string[] {
  if (!field.allow_other) return raw
  if (Array.isArray(raw)) {
    if (!raw.includes(OTHER_OPTION)) return raw
    return raw.map((v) => (v === OTHER_OPTION ? `${OTHER_OPTION}: ${otherText.trim()}` : v))
  }
  if (raw === OTHER_OPTION) return `${OTHER_OPTION}: ${otherText.trim()}`
  return raw
}

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
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>('MX')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [extraData, setExtraData] = useState<Record<string, string | boolean | string[]>>({})
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})
  const [selectedTypeId, setSelectedTypeId] = useState(preselectedTypeId ?? '')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'manual' | 'preregister' | ''>(
    preselectedPayment ?? ''
  )
  const [couponCode, setCouponCode] = useState('')
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponPending, startCouponTransition] = useTransition()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedType = ticketTypes.find((t) => t.id === selectedTypeId)
  const currentBubble = toBubble(step)
  const stepCopy = STEP_COPY[step]
  const phonePairField =
    eventFields.find((f) => f.pair_with_phone) ?? eventFields.find((f) => f.field_type === 'country')
  const otherFields = eventFields.filter((f) => f.id !== phonePairField?.id)

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
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) return 'Los correos no coinciden.'
    if (!phone) return 'El teléfono es obligatorio.'
    const phoneDigits = String(phone).replace(/\D/g, '')
    if (phoneDigits.length < 8) return 'El teléfono debe tener al menos 8 dígitos.'
    if (phoneDigits.length > 15) return 'El teléfono debe tener como máximo 15 dígitos.'
    for (const field of eventFields) {
      if (!field.required) continue
      const val = extraData[field.id]
      if (field.field_type === 'checkbox') {
        if (!val) return `El campo "${field.label}" es obligatorio.`
      } else if (field.field_type === 'multiselect') {
        const arr = Array.isArray(val) ? val : []
        if (arr.length === 0) return `El campo "${field.label}" es obligatorio.`
        if (field.allow_other && arr.includes(OTHER_OPTION) && !otherTexts[field.id]?.trim()) {
          return `Escribe el texto de "Otro" en el campo "${field.label}".`
        }
      } else {
        if (!val || String(val).trim() === '') return `El campo "${field.label}" es obligatorio.`
        if (field.allow_other && val === OTHER_OPTION && !otherTexts[field.id]?.trim()) {
          return `Escribe el texto de "Otro" en el campo "${field.label}".`
        }
      }
    }
    return null
  }

  function handleExtraFieldChange(field: EventField, val: string | boolean | string[]) {
    setExtraData((prev) => ({ ...prev, [field.id]: val }))
    if (field.field_type === 'country' && typeof val === 'string' && val) {
      const iso = COUNTRY_NAME_TO_ISO[val]
      if (iso) setPhoneCountry(iso as CountryCode)
    }
  }

  function handleSelectType(id: string) {
    setSelectedTypeId(id)
    setCouponResult(null)
    setCouponError('')
    setCouponCode('')
  }

  function handleApplyCoupon() {
    if (!selectedTypeId || !selectedType) return
    setCouponError('')
    setCouponResult(null)
    startCouponTransition(async () => {
      const result = await validateCoupon(couponCode, orgId, event.id, selectedType.price, selectedType.currency)
      if (!result.valid) {
        setCouponError(result.error)
      } else {
        setCouponResult(result)
      }
    })
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

    const finalExtraData: Record<string, string | boolean | string[]> = {}
    for (const field of eventFields) {
      const raw = extraData[field.id]
      if (raw === undefined) continue
      finalExtraData[field.id] = resolveFieldValue(field, raw, otherTexts[field.id] ?? '')
    }

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
        extraData: Object.keys(finalExtraData).length > 0 ? finalExtraData : undefined,
        couponCode: couponResult?.valid ? couponCode.trim() : undefined,
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
    <div className="mx-auto max-w-2xl">
      <StepIndicator current={currentBubble} />

      {step !== 4 && (
        <div className="mb-4 rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-800 text-center">
          🔒 No se te cobrará nada hasta que elijas y confirmes tu método de pago.
        </div>
      )}

      <div className="rounded-lg border bg-white p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{stepCopy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{stepCopy.subtitle}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#a22944]">Datos de contacto</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">
                <span className="leading-snug">Nombre<span className="text-destructive ml-1">*</span></span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder=""
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">
                <span className="leading-snug">Apellido<span className="text-destructive ml-1">*</span></span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder=""
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">
              <span className="leading-snug">Correo electrónico<span className="text-destructive ml-1">*</span></span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=""
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmEmail">
              <span className="leading-snug">Confirmar correo electrónico<span className="text-destructive ml-1">*</span></span>
            </Label>
            <Input
              id="confirmEmail"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder=""
            />
          </div>
          <div className={phonePairField ? 'grid gap-4 sm:grid-cols-2' : ''}>
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                <span className="leading-snug">Teléfono<span className="text-destructive ml-1">*</span></span>
              </Label>
              <PhoneInput
                key={phoneCountry}
                id="phone"
                defaultCountry={phoneCountry}
                onCountryChange={(c) => setPhoneCountry(c ?? 'MX')}
                value={phone}
                onChange={setPhone}
                numberInputProps={{ maxLength: 15, placeholder: '10 dígitos' }}
                flags={flags}
                labels={es}
                countrySelectComponent={CountrySelectWithCallingCode}
                international={false}
              />
              <p className="text-xs text-muted-foreground">
                Selecciona la lada de tu teléfono.
              </p>
            </div>
            {phonePairField && (
              <ExtraField
                field={phonePairField}
                value={extraData[phonePairField.id]}
                onChange={(val) => handleExtraFieldChange(phonePairField, val)}
                otherText={otherTexts[phonePairField.id] ?? ''}
                onOtherTextChange={(text) => setOtherTexts((prev) => ({ ...prev, [phonePairField.id]: text }))}
              />
            )}
          </div>

          {otherFields.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              {otherFields.map((field, i) => {
                const prevSection = otherFields[i - 1]?.section
                const showSectionHeading = !!field.section && field.section !== prevSection
                return (
                  <div key={field.id}>
                    {showSectionHeading && (
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide text-[#a22944] mb-3 ${
                          i > 0 ? 'mt-8 pt-4 border-t' : ''
                        }`}
                      >
                        {field.section}
                      </p>
                    )}
                    <ExtraField
                      field={field}
                      value={extraData[field.id]}
                      onChange={(val) => handleExtraFieldChange(field, val)}
                      otherText={otherTexts[field.id] ?? ''}
                      onOtherTextChange={(text) => setOtherTexts((prev) => ({ ...prev, [field.id]: text }))}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
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
                onClick={() => !isSoldOut && handleSelectType(tt.id)}
                className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-colors ${
                  isSelected
                    ? 'border-[#a22944] bg-[#a22944]/5'
                    : isSoldOut
                    ? 'border-muted opacity-50 cursor-not-allowed'
                    : 'border-border hover:border-[#a22944]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{tt.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Acceso completo a todas las actividades del congreso.
                    </p>
                    {isSoldOut && <p className="text-xs text-muted-foreground mt-0.5">Agotado</p>}
                  </div>
                  <p className="text-xl font-bold text-right shrink-0">
                    ${tt.price.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-muted-foreground">{tt.currency}</span>
                  </p>
                </div>
              </button>
            )
          })}

          {selectedTypeId && (
            <div className="pt-3 border-t space-y-2">
              <p className="text-sm text-muted-foreground">¿Tienes un código de descuento?</p>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponError('') }}
                  placeholder="Ej. EARLY2027"
                  className="font-mono uppercase"
                  maxLength={32}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyCoupon}
                  disabled={couponPending || !couponCode.trim()}
                >
                  {couponPending ? '…' : 'Aplicar'}
                </Button>
              </div>
              {couponError && (
                <p className="text-xs text-destructive">{couponError}</p>
              )}
              {couponResult?.valid && (
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                  <p className="font-medium">
                    Descuento aplicado:{' '}
                    {couponResult.type === 'percentage'
                      ? `${couponResult.value}%`
                      : `$${couponResult.value.toLocaleString()}`}
                  </p>
                  <p className="text-xs mt-0.5">
                    Precio final: <strong>${couponResult.finalAmount.toLocaleString()}</strong>{' '}
                    {selectedType?.currency}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && !isPreregFlow && (
        <div className="space-y-3">
          {selectedType && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Vas a pagar</p>
              <p className="font-medium">{selectedType.name}</p>
              {couponResult?.valid ? (
                <div>
                  <p className="text-sm text-muted-foreground line-through">
                    ${selectedType.price.toLocaleString()} {selectedType.currency}
                  </p>
                  <p className="font-bold text-green-700">
                    ${couponResult.finalAmount.toLocaleString()} {selectedType.currency}
                    <span className="text-xs font-normal text-green-600 ml-1">
                      (cupón {couponResult.type === 'percentage' ? `${couponResult.value}%` : `$${couponResult.value}`} aplicado)
                    </span>
                  </p>
                </div>
              ) : (
                <p className="font-bold">
                  ${selectedType.price.toLocaleString()} {selectedType.currency}
                </p>
              )}
            </div>
          )}
          {paymentOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPaymentMethod(opt.value)}
              className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-colors ${
                paymentMethod === opt.value
                  ? 'border-[#a22944] bg-[#a22944]/5'
                  : 'border-border hover:border-[#a22944]/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <p className="font-medium">{opt.label}</p>
                {opt.value === 'online' && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">INMEDIATO</Badge>
                )}
                {opt.value === 'manual' && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">48 H</Badge>
                )}
              </div>
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
                const raw = extraData[field.id]
                if (
                  raw === undefined ||
                  raw === '' ||
                  raw === false ||
                  (Array.isArray(raw) && raw.length === 0)
                ) return null
                const resolved = resolveFieldValue(field, raw, otherTexts[field.id] ?? '')
                const display = field.field_type === 'checkbox'
                  ? 'Sí'
                  : Array.isArray(resolved)
                  ? resolved.join(', ')
                  : String(resolved)
                return (
                  <p key={field.id} className="text-muted-foreground">
                    {field.label}: {display}
                  </p>
                )
              })}
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Inscripción</p>
              <p className="font-medium">{selectedType.name}</p>
              {couponResult?.valid ? (
                <div>
                  <p className="text-sm text-muted-foreground line-through">
                    ${selectedType.price.toLocaleString()} {selectedType.currency}
                  </p>
                  <p className="font-bold text-green-700">
                    ${couponResult.finalAmount.toLocaleString()} {selectedType.currency}
                    <span className="text-xs font-normal text-green-600 ml-1">
                      (cupón {couponResult.type === 'percentage' ? `${couponResult.value}%` : `$${couponResult.value}`} aplicado)
                    </span>
                  </p>
                </div>
              ) : (
                <p className="font-bold">
                  ${selectedType.price.toLocaleString()} {selectedType.currency}
                </p>
              )}
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

        <div className={`flex items-center mt-6 gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
          {step > 1 && (
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleBack} disabled={isPending}>
                Atrás
              </Button>
              <span className="text-xs text-muted-foreground">
                Paso {currentBubble} de {STEPS.length}
              </span>
            </div>
          )}
          {step < 4 ? (
            <Button onClick={handleNext} className="bg-[#a22944] text-white hover:bg-[#8a2239]">
              Continuar
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-[#a22944] text-white hover:bg-[#8a2239]"
            >
              {isPending
                ? 'Procesando...'
                : isPreregFlow
                ? 'Confirmar pre-registro'
                : 'Confirmar inscripción'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface CountrySelectOption {
  value?: Country
  label: string
  divider?: boolean
}

function DefaultCountrySelectArrow() {
  return <div className="PhoneInputCountrySelectArrow" />
}

function CountrySelectWithCallingCode({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  className,
  iconComponent: Icon,
  arrowComponent: Arrow,
  ...rest
}: {
  value?: Country
  onChange: (value?: Country) => void
  options: CountrySelectOption[]
  disabled?: boolean
  readOnly?: boolean
  className?: string
  iconComponent?: React.ComponentType<{ country?: Country; label?: string }>
  arrowComponent?: React.ComponentType
  [key: string]: unknown
}) {
  const ArrowComponent = Arrow ?? DefaultCountrySelectArrow
  const selectedOption = options.find((opt) => (opt.value ?? undefined) === (value ?? undefined))

  return (
    <div className="PhoneInputCountry">
      <select
        {...rest}
        value={value || 'ZZ'}
        onChange={(e) => onChange(e.target.value === 'ZZ' ? undefined : (e.target.value as Country))}
        disabled={disabled || readOnly}
        className={`PhoneInputCountrySelect${className ? ` ${className}` : ''}`}
      >
        {options.map((opt) => (
          <option
            key={opt.divider ? '|' : opt.value || 'ZZ'}
            value={opt.divider ? '|' : opt.value || 'ZZ'}
            disabled={opt.divider}
          >
            {opt.value ? `+${getCountryCallingCode(opt.value)} ${opt.label}` : opt.label}
          </option>
        ))}
      </select>
      {selectedOption && Icon && (
        <Icon aria-hidden country={value} label={selectedOption.label} />
      )}
      <ArrowComponent />
    </div>
  )
}

function ExtraField({
  field,
  value,
  onChange,
  otherText = '',
  onOtherTextChange,
}: {
  field: EventField
  value: string | boolean | string[] | undefined
  onChange: (val: string | boolean | string[]) => void
  otherText?: string
  onOtherTextChange?: (text: string) => void
}) {
  const helperText = (field as { helper_text?: string | null }).helper_text
  const optionsWithOther = field.allow_other ? [...(field.options ?? []), OTHER_OPTION] : (field.options ?? [])

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id}>
        <span className="leading-snug">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </span>
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
        <>
          <select
            id={field.id}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Selecciona una opción…</option>
            {optionsWithOther.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {field.allow_other && value === OTHER_OPTION && (
            <Input
              value={otherText}
              onChange={(e) => onOtherTextChange?.(e.target.value)}
              placeholder="Especifica…"
              className="mt-2"
            />
          )}
        </>
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
          {optionsWithOther.map((opt) => (
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
          {field.allow_other && value === OTHER_OPTION && (
            <Input
              value={otherText}
              onChange={(e) => onOtherTextChange?.(e.target.value)}
              placeholder="Especifica…"
              className="mt-1"
            />
          )}
        </div>
      )}

      {field.field_type === 'multiselect' && (
        <div className="space-y-2">
          {optionsWithOther.map((opt) => {
            const arr = Array.isArray(value) ? value : []
            const checked = arr.includes(opt)
            return (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arr, opt]
                      : arr.filter((v) => v !== opt)
                    onChange(next)
                  }}
                  className="h-4 w-4 rounded"
                />
                {opt}
              </label>
            )
          })}
          {field.allow_other && Array.isArray(value) && value.includes(OTHER_OPTION) && (
            <Input
              value={otherText}
              onChange={(e) => onOtherTextChange?.(e.target.value)}
              placeholder="Especifica…"
              className="mt-1"
            />
          )}
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

function StepIndicator({ current }: { current: Bubble }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Bubble
        const isActive = current === n
        const isDone = current > n
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5 w-20">
              <div
                className={`h-8 w-8 shrink-0 rounded-full inline-flex items-center justify-center text-sm font-semibold leading-none border-2 transition-colors ${
                  isDone || isActive
                    ? 'bg-[#a22944] border-[#a22944] text-white'
                    : 'border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : n}
              </div>
              <span
                className={`text-xs text-center leading-tight ${isActive ? 'text-[#a22944] font-medium' : 'text-muted-foreground'}`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 sm:w-12 -mt-5 ${isDone ? 'bg-[#a22944]' : 'bg-muted-foreground/30'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
