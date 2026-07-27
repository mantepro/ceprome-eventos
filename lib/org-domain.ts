import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function stripPort(host: string): string {
  return host.split(':')[0]
}

/**
 * Ruta base para armar URLs públicas de una organización: vacía si el host
 * actual es su dominio propio dedicado, o `/{slug}` en cualquier otro caso
 * (dominio compartido, entorno local, etc).
 */
export function publicBasePath(
  org: { slug: string; custom_domain?: string | null },
  host: string | null
): string {
  if (host && org.custom_domain && stripPort(host) === org.custom_domain) {
    return ''
  }
  return `/${org.slug}`
}

/**
 * Igual que publicBasePath, pero cuando solo se tiene el slug a mano
 * (Server Actions y Route Handlers que no cargaron la organización completa).
 */
export async function resolveBasePathBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
  host: string | null
): Promise<string> {
  const { data: org } = await supabase
    .from('organizations')
    .select('slug, custom_domain')
    .eq('slug', slug)
    .maybeSingle()

  if (!org) return `/${slug}`
  return publicBasePath(org, host)
}
