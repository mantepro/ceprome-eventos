import type { Metadata } from 'next'
import { ConfirmInvitePage } from '@/components/auth/confirm-invite-page'

export const metadata: Metadata = { title: 'Activar cuenta — CEPROME' }

type SearchParams = Promise<{ token_hash?: string; type?: string }>

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { token_hash, type } = await searchParams
  return <ConfirmInvitePage tokenHash={token_hash ?? ''} type={type ?? ''} />
}
