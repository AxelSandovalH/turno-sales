import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { LeadDetail } from './lead-detail'

interface Props { params: Promise<{ id: string }> }

export default async function LeadPage({ params }: Props) {
  const { id } = await params
  const db = createServiceClient()

  const [{ data: lead }, { data: activity }] = await Promise.all([
    db.from('leads').select('*').eq('id', id).single(),
    db.from('sales_activity').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
  ])

  if (!lead) notFound()

  return <LeadDetail lead={lead} activity={activity ?? []} />
}
