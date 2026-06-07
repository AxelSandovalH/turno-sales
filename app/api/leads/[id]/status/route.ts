import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import type { Lead } from '@/types/database'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status } = await req.json()
  const db = createServiceClient()

  const { data } = await db.from('leads').select('status').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  const lead = data as Pick<Lead, 'status'>

  await db.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)

  await db.from('sales_activity').insert({
    lead_id: id,
    action: 'status_change',
    from_status: lead.status,
    to_status: status,
  })

  return NextResponse.json({ ok: true })
}
