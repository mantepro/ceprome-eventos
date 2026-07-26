import Link from 'next/link'
import Image from 'next/image'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { getOrgBySlug } from '@/lib/queries/events'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const org = await getOrgBySlug(slug)

  return (
    <div className={`${jakarta.variable} font-public-site min-h-screen bg-background`}>
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link href={`/${slug}/eventos`} className="flex items-center gap-2.5">
            {org.logo_url ? (
              <div className="relative h-10 w-40">
                <Image
                  src={org.logo_url}
                  alt={org.name}
                  fill
                  className="object-contain object-left"
                  sizes="160px"
                />
              </div>
            ) : (
              <span className="font-semibold text-foreground">{org.name}</span>
            )}
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className="bg-[#585857] text-white">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
          {org.logo_url ? (
            <Image
              src={org.logo_url}
              alt={org.name}
              width={120}
              height={32}
              className="h-8 w-auto object-contain brightness-0 invert"
            />
          ) : (
            <span className="font-semibold">{org.name}</span>
          )}
          <p className="text-center text-sm text-white/80 sm:text-right">
            © {new Date().getFullYear()} {org.name}. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
