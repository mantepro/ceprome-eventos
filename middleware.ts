import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/scan/:path*',
  ],
}
