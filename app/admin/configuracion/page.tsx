import { getCurrentUserProfile } from '@/lib/queries/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { OrgSettingsForm } from '@/components/admin/org-settings-form'

export const metadata = { title: 'Configuración — CEPROME Admin' }

export default async function ConfiguracionPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const supabase = createAdminClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('email, phone, whatsapp_contact')
    .eq('id', profile.organization_id)
    .single()

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ajustes generales de la organización
        </p>
      </div>

      <OrgSettingsForm
        currentEmail={org?.email ?? null}
        currentPhone={org?.phone ?? null}
        currentWhatsapp={org?.whatsapp_contact ?? null}
      />
    </div>
  )
}
