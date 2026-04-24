import Link from 'next/link'
import Image from 'next/image'
import { getOrgBySlug } from '@/lib/queries/events'

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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center">
          <Link href={`/${slug}/eventos`} className="flex items-center gap-2.5">
            {org.logo_url && (
              <Image
                src={org.logo_url}
                alt={org.name}
                width={28}
                height={28}
                className="rounded object-contain"
              />
            )}
            <span className="font-semibold text-sm">{org.name}</span>
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
