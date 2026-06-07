import { createServiceClient } from '@/lib/supabase'
import { LeadsTable } from './leads-table'

export const dynamic = 'force-dynamic'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string; status?: string; city?: string; q?: string }>
}) {
  const { niche, status, city, q } = await searchParams
  const db = createServiceClient()

  let query = db
    .from('leads')
    .select('*')
    .order('score', { ascending: false })
    .limit(200)

  if (niche) query = query.eq('niche', niche)
  if (status) query = query.eq('status', status)
  if (city) query = query.ilike('city', `%${city}%`)
  if (q) query = query.ilike('business_name', `%${q}%`)

  const { data: leads } = await query

  // Conteos para el header
  const { data: counts } = await db
    .from('leads')
    .select('status')

  const total = counts?.length ?? 0
  const won = counts?.filter(l => l.status === 'won').length ?? 0
  const active = counts?.filter(l => ['contacted', 'responding', 'negotiating', 'link_sent'].includes(l.status)).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} total · {active} activos · {won} ganados
          </p>
        </div>
      </div>

      <LeadsTable leads={leads ?? []} filters={{ niche, status, city, q }} />
    </div>
  )
}
