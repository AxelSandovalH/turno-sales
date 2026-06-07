'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageCircle, Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildWhatsAppURL } from '@/lib/whatsapp'
import type { Niche, LeadStatus } from '@/types/database'

const NICHE_EMOJI: Record<Niche, string> = {
  barbershop: '💈', psychology: '🧠', dentistry: '🦷',
  physiotherapy: '🏃', other: '✨',
}

interface LeadCard {
  id: string
  business_name: string
  phone: string | null
  whatsapp_number: string | null
  niche: string | null
  city: string | null
  score: number | null
  status: string
  stripe_payment_link: string | null
  rating: number | null
  review_count: number | null
}

interface Column {
  status: string
  label: string
  color: string
  leads: LeadCard[]
}

export function PipelineBoard({ columns }: { columns: Column[] }) {
  const router = useRouter()

  async function moveCard(leadId: string, toStatus: LeadStatus) {
    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus }),
    })
    if (!res.ok) { toast.error('Error al mover'); return }
    router.refresh()
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    toast.success('Link copiado')
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(col => (
        <div key={col.status} className="shrink-0 w-64">
          {/* Column header */}
          <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color}`}>
            <span className="text-sm font-medium">{col.label}</span>
            <Badge variant="outline" className="text-xs">{col.leads.length}</Badge>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {col.leads.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                Vacío
              </div>
            )}
            {col.leads.map(lead => {
              const waPhone = lead.whatsapp_number ?? lead.phone
              return (
                <div
                  key={lead.id}
                  className="bg-card border border-border rounded-xl p-3 space-y-2 cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{lead.business_name}</p>
                      {lead.city && <p className="text-[11px] text-muted-foreground mt-0.5">{lead.city}</p>}
                    </div>
                    <span className="text-base shrink-0">
                      {lead.niche ? NICHE_EMOJI[lead.niche as Niche] : ''}
                    </span>
                  </div>

                  {/* Score + rating */}
                  {(lead.score || lead.rating) && (
                    <div className="flex items-center gap-2 text-[11px]">
                      {lead.score && <span className="text-violet-400 font-semibold">#{lead.score}</span>}
                      {lead.rating && <span className="text-muted-foreground">★{lead.rating} ({lead.review_count})</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1" onClick={e => e.stopPropagation()}>
                    {waPhone && (
                      <a
                        href={buildWhatsAppURL(waPhone, lead.business_name, lead.niche as Niche)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => moveCard(lead.id, 'contacted')}
                      >
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-500">
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    {lead.stripe_payment_link && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-cyan-400"
                        onClick={() => copyLink(lead.stripe_payment_link!)}>
                        <Link2 className="h-3 w-3" />
                      </Button>
                    )}

                    {/* Move buttons */}
                    <div className="ml-auto flex gap-1">
                      {col.status !== 'won' && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-emerald-400 text-[10px]"
                          title="Marcar ganado"
                          onClick={() => moveCard(lead.id, 'won')}>
                          ✓
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-red-400 text-[10px]"
                        title="Marcar perdido"
                        onClick={() => moveCard(lead.id, 'lost')}>
                        ✕
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
