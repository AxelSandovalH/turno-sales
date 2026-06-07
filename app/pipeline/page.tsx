import { createServiceClient } from '@/lib/supabase'
import { PipelineBoard } from './pipeline-board'

export const dynamic = 'force-dynamic'

const COLUMNS = [
  { status: 'scraped',     label: 'Sin contactar',  color: 'border-zinc-600' },
  { status: 'contacted',   label: 'Contactado',     color: 'border-violet-500' },
  { status: 'responding',  label: 'Respondiendo',   color: 'border-amber-500' },
  { status: 'negotiating', label: 'Negociando',     color: 'border-orange-500' },
  { status: 'link_sent',   label: 'Link enviado',   color: 'border-cyan-500' },
  { status: 'won',         label: 'Ganado',         color: 'border-emerald-500' },
]

export default async function PipelinePage() {
  const db = createServiceClient()

  const { data: leads } = await db
    .from('leads')
    .select('id, business_name, phone, whatsapp_number, niche, city, score, status, stripe_payment_link, rating, review_count')
    .not('status', 'in', '("lost","no_contact")')
    .order('score', { ascending: false })

  const byStatus = COLUMNS.map(col => ({
    ...col,
    leads: (leads ?? []).filter(l => l.status === col.status),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {leads?.length ?? 0} leads activos
        </p>
      </div>
      <PipelineBoard columns={byStatus} />
    </div>
  )
}
