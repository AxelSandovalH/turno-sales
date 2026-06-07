import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import type { Lead } from '@/types/database'

// Precio mensual en centavos (MXN)
const PRICE_AMOUNT = 279900 // $2,799 MXN

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

  try {
    // Crear precio dinámico por lead (no requiere price ID preconfigurado)
    const price = await stripe.prices.create({
      currency: 'mxn',
      unit_amount: PRICE_AMOUNT,
      recurring: { interval: 'month' },
      product_data: {
        name: 'Turno — Plan Mensual',
        metadata: {
          lead_id: lead.id,
          business_name: lead.business_name,
        },
      },
    })

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        lead_id: lead.id,
        business_name: lead.business_name,
        phone: lead.whatsapp_number ?? lead.phone ?? '',
        niche: lead.niche ?? 'other',
      },
      subscription_data: {
        metadata: {
          lead_id: lead.id,
          business_name: lead.business_name,
        },
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
