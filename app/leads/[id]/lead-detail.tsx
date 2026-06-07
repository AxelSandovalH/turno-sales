'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, MessageCircle, Link2, CheckCircle2, XCircle, ExternalLink, MapPin, Star } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { buildWhatsAppURL } from '@/lib/whatsapp'
import { CallButton } from '@/components/call-button'
import type { Lead, SalesActivity, LeadStatus, Niche } from '@/types/database'

const STATUS_LABEL: Record<LeadStatus, string> = {
  scraped: 'Sin contactar', enriched: 'Enriquecido', contacted: 'Contactado',
  responding: 'Respondiendo', negotiating: 'Negociando', link_sent: 'Link enviado',
  won: 'Ganado', lost: 'Perdido', no_contact: 'Sin respuesta',
}
const STATUS_COLOR: Record<LeadStatus, string> = {
  scraped: 'bg-zinc-500/10 text-zinc-400', enriched: 'bg-blue-500/10 text-blue-400',
  contacted: 'bg-violet-500/10 text-violet-400', responding: 'bg-amber-500/10 text-amber-400',
  negotiating: 'bg-orange-500/10 text-orange-400', link_sent: 'bg-cyan-500/10 text-cyan-400',
  won: 'bg-emerald-500/10 text-emerald-400', lost: 'bg-red-500/10 text-red-400',
  no_contact: 'bg-zinc-500/10 text-zinc-500',
}
const NICHE_LABEL: Record<Niche, string> = {
  barbershop: '💈 Barbería', psychology: '🧠 Psicología', dentistry: '🦷 Odontología',
  physiotherapy: '🏃 Fisioterapia', other: '✨ Otro',
}
const ALL_STATUSES = Object.keys(STATUS_LABEL) as LeadStatus[]

export function LeadDetail({ lead, activity }: { lead: Lead; activity: SalesActivity[] }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [loadingLink, setLoadingLink] = useState(false)

  async function updateStatus(status: LeadStatus) {
    const res = await fetch(`/api/leads/${lead.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { toast.error('Error al actualizar'); return }
    toast.success(status === 'won' ? '🎉 Lead ganado!' : 'Status actualizado')
    router.refresh()
  }

  async function addNote() {
    if (!note.trim()) return
    const res = await fetch(`/api/leads/${lead.id}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    if (!res.ok) { toast.error('Error al guardar nota'); return }
    toast.success('Nota guardada')
    setNote('')
    router.refresh()
  }

  async function generatePaymentLink() {
    setLoadingLink(true)
    const res = await fetch(`/api/leads/${lead.id}/payment-link`, { method: 'POST' })
    const data = await res.json()
    setLoadingLink(false)
    if (!res.ok) { toast.error(data.error ?? 'Error'); return }
    await navigator.clipboard.writeText(data.url)
    toast.success('Link copiado al portapapeles')
    router.refresh()
  }

  const waPhone = lead.whatsapp_number ?? lead.phone

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/leads">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight">{lead.business_name}</h1>
            <Badge variant="outline" className={`text-xs ${STATUS_COLOR[lead.status]}`}>
              {STATUS_LABEL[lead.status]}
            </Badge>
            {lead.niche && <span className="text-sm text-muted-foreground">{NICHE_LABEL[lead.niche]}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            {lead.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.city}</span>}
            {lead.rating && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                {lead.rating} ({lead.review_count} reseñas)
              </span>
            )}
            {lead.score && <span className="text-violet-400 font-semibold">Score {lead.score}</span>}
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2">
        {waPhone && (
          <CallButton
            phone={waPhone}
            leadId={lead.id}
            businessName={lead.business_name}
            onCallStarted={() => updateStatus('contacted')}
          />
        )}

        {waPhone && (
          <a
            href={buildWhatsAppURL(waPhone, lead.business_name, lead.niche)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => updateStatus('contacted')}
          >
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </a>
        )}

        {lead.stripe_payment_link ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-cyan-400 border-cyan-400/30"
            onClick={async () => {
              await navigator.clipboard.writeText(lead.stripe_payment_link!)
              toast.success('Link copiado')
            }}
          >
            <Link2 className="h-4 w-4" />
            Copiar link de pago
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-2" onClick={generatePaymentLink} disabled={loadingLink}>
            <Link2 className="h-4 w-4" />
            {loadingLink ? 'Generando...' : 'Generar link de pago'}
          </Button>
        )}

        {lead.google_maps_url && (
          <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Ver en Maps
            </Button>
          </a>
        )}

        <Button size="sm" variant="outline" className="gap-2 text-emerald-400 border-emerald-400/30"
          onClick={() => updateStatus('won')}>
          <CheckCircle2 className="h-4 w-4" />Ganado
        </Button>
        <Button size="sm" variant="outline" className="gap-2 text-red-400 border-red-400/30"
          onClick={() => updateStatus('lost')}>
          <XCircle className="h-4 w-4" />Perdido
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Ficha */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Información</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Teléfono" value={lead.phone} />
            <Row label="WhatsApp" value={lead.whatsapp_number} />
            <Row label="Dirección" value={lead.address} />
            <Row label="Ciudad" value={lead.city} />
            <Row label="Estado" value={lead.state} />
            {lead.website && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Website</span>
                <a href={lead.website} target="_blank" rel="noopener noreferrer"
                  className="text-violet-400 hover:underline text-right truncate max-w-[180px]">
                  {lead.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Cambiar status</label>
              <Select value={lead.status} onValueChange={v => updateStatus(v as LeadStatus)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lead.stripe_payment_link && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Link de pago</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={lead.stripe_payment_link}
                    className="flex-1 text-xs bg-muted/30 border border-border rounded px-2 py-1 truncate"
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                    onClick={async () => {
                      await navigator.clipboard.writeText(lead.stripe_payment_link!)
                      toast.success('Copiado')
                    }}>
                    <Link2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notas */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Agregar nota</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Notas de la llamada, interés, objeciones..."
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <Button size="sm" onClick={addNote} disabled={!note.trim()}>Guardar nota</Button>
        </CardContent>
      </Card>

      {/* Actividad */}
      {activity.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Historial</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activity.map(a => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  {a.action === 'note' && <p className="text-foreground">{a.note}</p>}
                  {a.action === 'status_change' && (
                    <p className="text-muted-foreground">
                      Status: <span className="text-foreground">{STATUS_LABEL[a.from_status as LeadStatus]}</span>
                      {' → '}
                      <span className="text-foreground">{STATUS_LABEL[a.to_status as LeadStatus]}</span>
                    </p>
                  )}
                  {a.action === 'link_sent' && <p className="text-cyan-400">Link de pago generado</p>}
                  {a.action === 'whatsapp_sent' && <p className="text-emerald-400">WhatsApp abierto</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(a.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}
