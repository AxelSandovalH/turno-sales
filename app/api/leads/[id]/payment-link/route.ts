import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import type { Lead } from '@/types/database'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db.from('leads').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  const lead = data as Lead

  // Si ya tiene link, devolver el existente
  if (lead.stripe_payment_link) {
    return NextResponse.json({ url: lead.stripe_payment_link })
  }

  const priceId = process.env.TURNO_PRICE_ID
  if (!priceId) return NextResponse.json({ error: 'TURNO_PRICE_ID no configurado' }, { status: 500 })

  try {
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        lead_id: lead.id,
        business_name: lead.business_name,
        phone: lead.whatsapp_number ?? lead.phone ?? '',
        niche: lead.niche ?? 'other',
      },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${process.env.NEXT_PUBLIC_TURNO_URL}/onboarding` },
      },
    })

    await db.from('leads').update({
      stripe_payment_link: paymentLink.url,
      status: 'link_sent',
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    await db.from('sales_activity').insert({
      lead_id: id,
      action: 'link_sent',
      from_status: lead.status,
      to_status: 'link_sent',
    })

    return NextResponse.json({ url: paymentLink.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
