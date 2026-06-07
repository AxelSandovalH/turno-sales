import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { note } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Nota vacía' }, { status: 400 })

  const db = createServiceClient()
  await db.from('sales_activity').insert({ lead_id: id, action: 'note', note })

  return NextResponse.json({ ok: true })
}
