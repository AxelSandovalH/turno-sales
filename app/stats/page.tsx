import { createServiceClient } from '@/lib/supabase'
import type { Lead, Niche } from '@/types/database'

export const dynamic = 'force-dynamic'

const NICHE_LABEL: Record<Niche, string> = {
  barbershop: '💈 Barbería', psychology: '🧠 Psicología', dentistry: '🦷 Odontología',
  physiotherapy: '🏃 Fisioterapia', other: '✨ Otro',
}

function pct(a: number, b: number) {
  if (!b) return '0%'
  return `${Math.round((a / b) * 100)}%`
}

export default async function StatsPage() {
  const db = createServiceClient()
  const { data: leads } = await db.from('leads').select('status, niche, city, score, created_at')

  const all = (leads ?? []) as Pick<Lead, 'status' | 'niche' | 'city' | 'score' | 'created_at'>[]

  const total     = all.length
  const won       = all.filter(l => l.status === 'won').length
  const lost      = all.filter(l => l.status === 'lost').length
  const active    = all.filter(l => ['contacted','responding','negotiating','link_sent'].includes(l.status)).length
  const linkSent  = all.filter(l => l.status === 'link_sent').length
  const untouched = all.filter(l => l.status === 'scraped').length

  // Por nicho
  const niches = Object.keys(NICHE_LABEL) as Niche[]
  const byNiche = niches.map(n => {
    const group = all.filter(l => l.niche === n)
    const wonN  = group.filter(l => l.status === 'won').length
    return { niche: n, total: group.length, won: wonN, cr: pct(wonN, group.length) }
  }).filter(n => n.total > 0).sort((a, b) => b.total - a.total)

  // Por ciudad (top 8)
  const cityMap: Record<string, { total: number; won: number }> = {}
  for (const l of all) {
    if (!l.city) continue
    if (!cityMap[l.city]) cityMap[l.city] = { total: 0, won: 0 }
    cityMap[l.city].total++
    if (l.status === 'won') cityMap[l.city].won++
  }
  const byCityArr = Object.entries(cityMap)
    .map(([city, v]) => ({ city, ...v, cr: pct(v.won, v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Métricas del pipeline de ventas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Total leads"  value={total}     />
        <KPI label="Sin tocar"    value={untouched}  sub={pct(untouched, total)} />
        <KPI label="Activos"      value={active}     sub={pct(active, total)} color="text-violet-400" />
        <KPI label="Link enviado" value={linkSent}   sub={pct(linkSent, total)} color="text-cyan-400" />
        <KPI label="Ganados"      value={won}        sub={pct(won, total)} color="text-emerald-400" />
        <KPI label="Perdidos"     value={lost}       sub={pct(lost, total)} color="text-red-400" />
      </div>

      {/* Conversión global */}
      <div className="rounded-xl border border-border p-5 space-y-3">
        <p className="text-sm font-medium">Embudo global</p>
        <div className="space-y-2">
          {[
            { label: 'Scraped → Contactado',   a: active + linkSent + won + lost, b: total },
            { label: 'Contactado → Link',       a: linkSent + won,                b: active + linkSent + won + lost },
            { label: 'Link → Ganado',           a: won,                           b: linkSent + won },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-48 shrink-0">{row.label}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full"
                  style={{ width: pct(row.a, row.b) }}
                />
              </div>
              <span className="text-xs font-semibold w-10 text-right">{pct(row.a, row.b)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Por nicho */}
        <div className="rounded-xl border border-border p-5 space-y-3">
          <p className="text-sm font-medium">Por nicho</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left py-1 font-medium">Nicho</th>
                <th className="text-right py-1 font-medium">Leads</th>
                <th className="text-right py-1 font-medium">Ganados</th>
                <th className="text-right py-1 font-medium">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byNiche.map(row => (
                <tr key={row.niche}>
                  <td className="py-2">{NICHE_LABEL[row.niche]}</td>
                  <td className="py-2 text-right text-muted-foreground">{row.total}</td>
                  <td className="py-2 text-right text-emerald-400 font-medium">{row.won}</td>
                  <td className="py-2 text-right text-violet-400 font-semibold">{row.cr}</td>
                </tr>
              ))}
              {byNiche.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-xs">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Por ciudad */}
        <div className="rounded-xl border border-border p-5 space-y-3">
          <p className="text-sm font-medium">Por ciudad (top 8)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left py-1 font-medium">Ciudad</th>
                <th className="text-right py-1 font-medium">Leads</th>
                <th className="text-right py-1 font-medium">Ganados</th>
                <th className="text-right py-1 font-medium">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byCityArr.map(row => (
                <tr key={row.city}>
                  <td className="py-2">{row.city}</td>
                  <td className="py-2 text-right text-muted-foreground">{row.total}</td>
                  <td className="py-2 text-right text-emerald-400 font-medium">{row.won}</td>
                  <td className="py-2 text-right text-violet-400 font-semibold">{row.cr}</td>
                </tr>
              ))}
              {byCityArr.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-xs">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, sub, color = 'text-foreground' }: {
  label: string; value: number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-border p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
