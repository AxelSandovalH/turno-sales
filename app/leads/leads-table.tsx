'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Link2, CheckCircle2, XCircle, ExternalLink, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { buildWhatsAppURL } from '@/lib/whatsapp'
import type { Lead, Niche, LeadStatus } from '@/types/database'

const STATUS_LABEL: Record<LeadStatus, string> = {
  scraped: 'Sin contactar',
  enriched: 'Enriquecido',
  contacted: 'Contactado',
  responding: 'Respondiendo',
  negotiating: 'Negociando',
  link_sent: 'Link enviado',
  won: 'Ganado',
  lost: 'Perdido',
  no_contact: 'Sin respuesta',
}

const STATUS_COLOR: Record<LeadStatus, string> = {
  scraped: 'bg-zinc-500/10 text-zinc-400',
  enriched: 'bg-blue-500/10 text-blue-400',
  contacted: 'bg-violet-500/10 text-violet-400',
  responding: 'bg-amber-500/10 text-amber-400',
  negotiating: 'bg-orange-500/10 text-orange-400',
  link_sent: 'bg-cyan-500/10 text-cyan-400',
  won: 'bg-emerald-500/10 text-emerald-400',
  lost: 'bg-red-500/10 text-red-400',
  no_contact: 'bg-zinc-500/10 text-zinc-500',
}

const NICHE_LABEL: Record<Niche, string> = {
  barbershop: '💈 Barbería',
  psychology: '🧠 Psicología',
  dentistry: '🦷 Odontología',
  physiotherapy: '🏃 Fisioterapia',
  other: '✨ Otro',
}

export function LeadsTable({ leads, filters }: {
  leads: Lead[]
  filters: { niche?: string | null; status?: string | null; city?: string | null; q?: string | null }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(filters as Record<string, string>)
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    startTransition(() => router.push(`/leads?${params.toString()}`))
  }

  async function generatePaymentLink(lead: Lead) {
    setLoadingId(lead.id)
    const res = await fetch(`/api/leads/${lead.id}/payment-link`, { method: 'POST' })
    const data = await res.json()
    setLoadingId(null)
    if (!res.ok) { toast.error(data.error ?? 'Error al generar link'); return }
    await navigator.clipboard.writeText(data.url)
    toast.success('Link copiado al portapapeles')
    router.refresh()
  }

  async function updateStatus(lead: Lead, status: LeadStatus) {
    const res = await fetch(`/api/leads/${lead.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { toast.error('Error al actualizar'); return }
    toast.success(status === 'won' ? '🎉 Lead ganado!' : 'Actualizado')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar negocio..."
            defaultValue={filters.q ?? ''}
            onChange={e => applyFilter('q', e.target.value)}
            className="pl-8 h-8 w-48 text-sm"
          />
        </div>
        <Select value={filters.niche ?? 'all'} onValueChange={v => applyFilter('niche', v ?? '')}>
          <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Nicho" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los nichos</SelectItem>
            {Object.entries(NICHE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status ?? 'all'} onValueChange={v => applyFilter('status', v ?? '')}>
          <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="Ciudad..."
          defaultValue={filters.city ?? ''}
          onChange={e => applyFilter('city', e.target.value)}
          className="h-8 w-36 text-sm"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Negocio</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Nicho</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Ciudad</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Score</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Status</th>
              <th className="px-4 py-3 text-xs text-muted-foreground font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  No hay leads. Corre el scraper para poblar la tabla.
                </td>
              </tr>
            )}
            {leads.map(lead => (
              <tr
                key={lead.id}
                className="hover:bg-muted/10 cursor-pointer"
                onClick={() => router.push(`/leads/${lead.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium">{lead.business_name}</p>
                      {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
                    </div>
                    {lead.google_maps_url && (
                      <a
                        href={lead.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {lead.niche ? NICHE_LABEL[lead.niche] : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{lead.city ?? '—'}</td>
                <td className="px-4 py-3">
                  {lead.score !== null ? (
                    <span className="text-xs font-semibold text-violet-400">{lead.score}</span>
                  ) : '—'}
                  {lead.rating && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ★{lead.rating} ({lead.review_count})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs ${STATUS_COLOR[lead.status]}`}>
                    {STATUS_LABEL[lead.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {/* WhatsApp */}
                    {(lead.whatsapp_number ?? lead.phone) && (
                      <a
                        href={buildWhatsAppURL(
                          (lead.whatsapp_number ?? lead.phone)!,
                          lead.business_name,
                          lead.niche,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-500 hover:text-emerald-400"
                          title="Abrir WhatsApp"
                          onClick={() => updateStatus(lead, 'contacted')}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}

                    {/* Generar link de pago */}
                    {lead.stripe_payment_link ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-cyan-400"
                        title="Copiar link de pago"
                        onClick={async () => {
                          await navigator.clipboard.writeText(lead.stripe_payment_link!)
                          toast.success('Link copiado')
                        }}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-cyan-400"
                        title="Generar link de pago"
                        disabled={loadingId === lead.id}
                        onClick={() => generatePaymentLink(lead)}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Ganado */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-emerald-400"
                      title="Marcar como ganado"
                      onClick={() => updateStatus(lead, 'won')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>

                    {/* Perdido */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      title="Marcar como perdido"
                      onClick={() => updateStatus(lead, 'lost')}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
