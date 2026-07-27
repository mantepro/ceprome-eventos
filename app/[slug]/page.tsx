import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getOrgBySlug } from '@/lib/queries/events'
import { publicBasePath } from '@/lib/org-domain'

type Params = Promise<{ slug: string }>

export default async function OrgRootPage({ params }: { params: Params }) {
  const { slug } = await params
  const org = await getOrgBySlug(slug)
  const basePath = publicBasePath(org, (await headers()).get('host'))
  redirect(`${basePath}/eventos`)
}
