import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { stripPort } from '@/lib/org-domain'

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/superadmin')
  const isScanRoute = pathname.startsWith('/scan')
  const isAuthRoute = pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')
  const isNextInternal = pathname.startsWith('/_next')

  if ((isAdminRoute || isScanRoute) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  // Dominio propio dedicado — reescribe (sin cambiar la URL visible) anteponiendo
  // /{slug} para que siga resolviendo por el sistema de rutas [slug] existente.
  const isReservedRoute = isAdminRoute || isScanRoute || isAuthRoute || isApiRoute || isNextInternal
  if (!isReservedRoute) {
    const host = stripPort(request.headers.get('host') ?? '')
    if (host) {
      const { data: org } = await supabase
        .from('organizations')
        .select('slug')
        .eq('custom_domain', host)
        .eq('active', true)
        .maybeSingle()

      if (org && pathname !== `/${org.slug}` && !pathname.startsWith(`/${org.slug}/`)) {
        const url = request.nextUrl.clone()
        url.pathname = `/${org.slug}${pathname}`
        return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
