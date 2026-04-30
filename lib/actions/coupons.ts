'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'

// ── Validate coupon (public — called from registration form) ──────────────────

export type CouponValidationResult =
  | { valid: false; error: string }
  | { valid: true; couponId: string; type: 'percentage' | 'fixed'; value: number; discountAmount: number; finalAmount: number }

export async function validateCoupon(
  code: string,
  orgId: string,
  eventId: string,
  originalPrice: number
): Promise<CouponValidationResult> {
  if (!code.trim()) return { valid: false, error: 'Ingresa un código.' }

  const supabase = createAdminClient()

  const { data: coupon } = await supabase
    .from('coupons')
    .select('id, type, value, max_uses, used_count, active, event_id')
    .eq('organization_id', orgId)
    .ilike('code', code.trim())
    .single()

  if (!coupon) return { valid: false, error: 'Código no válido.' }
  if (!coupon.active) return { valid: false, error: 'Este cupón está inactivo.' }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { valid: false, error: 'Este cupón ya alcanzó su límite de usos.' }
  }
  if (coupon.event_id !== null && coupon.event_id !== eventId) {
    return { valid: false, error: 'Este cupón no aplica para este evento.' }
  }

  const discountAmount =
    coupon.type === 'percentage'
      ? Math.min((originalPrice * coupon.value) / 100, originalPrice)
      : Math.min(coupon.value, originalPrice)

  const finalAmount = Math.max(0, originalPrice - discountAmount)

  return {
    valid: true,
    couponId: coupon.id,
    type: coupon.type as 'percentage' | 'fixed',
    value: coupon.value,
    discountAmount,
    finalAmount,
  }
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

const couponSchema = z.object({
  code: z.string().min(2, 'Mínimo 2 caracteres').max(32, 'Máximo 32 caracteres'),
  type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().positive('El valor debe ser positivo'),
  max_uses: z.union([z.coerce.number().int().positive(), z.literal('').transform(() => null)]).optional(),
  event_id: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
})

export type CouponFormState = { error?: string; errors?: Record<string, string>; success?: boolean }

export async function createCoupon(
  _prev: CouponFormState,
  formData: FormData
): Promise<CouponFormState> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const raw = {
    code: formData.get('code') as string,
    type: formData.get('type') as string,
    value: formData.get('value') as string,
    max_uses: (formData.get('max_uses') as string) || '',
    event_id: (formData.get('event_id') as string) || '',
  }

  const parsed = couponSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      errors: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
      ),
    }
  }

  const { code, type, value, max_uses, event_id } = parsed.data
  const supabase = createAdminClient()

  // Check uniqueness within org (case-insensitive)
  const { data: existing } = await supabase
    .from('coupons')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .ilike('code', code)
    .maybeSingle()

  if (existing) return { error: `Ya existe un cupón con el código "${code.toUpperCase()}".` }

  const { error } = await supabase.from('coupons').insert({
    organization_id: profile.organization_id,
    event_id: event_id ?? null,
    code: code.toUpperCase(),
    type,
    value,
    max_uses: max_uses ?? null,
  })

  if (error) return { error: 'No se pudo crear el cupón.' }

  revalidatePath('/admin/cupones')
  return { success: true }
}

export async function toggleCouponActive(
  couponId: string,
  currentActive: boolean
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('coupons')
    .update({ active: !currentActive })
    .eq('id', couponId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'No se pudo actualizar el cupón.' }

  revalidatePath('/admin/cupones')
  return {}
}

export async function deleteCoupon(couponId: string): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()

  // Prevent deleting coupons already used
  const { data: coupon } = await supabase
    .from('coupons')
    .select('used_count')
    .eq('id', couponId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!coupon) return { error: 'Cupón no encontrado.' }
  if (coupon.used_count > 0) return { error: 'No se puede eliminar un cupón que ya fue utilizado.' }

  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', couponId)
    .eq('organization_id', profile.organization_id)

  if (error) return { error: 'No se pudo eliminar el cupón.' }

  revalidatePath('/admin/cupones')
  return {}
}
