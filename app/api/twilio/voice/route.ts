import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const to = body.get('To') as string

  const twiml = new VoiceResponse()

  if (to) {
    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER!,
      timeout: 30,
    })
    // Si el número empieza con +, llamada a teléfono real
    dial.number({}, to.startsWith('+') ? to : `+${to}`)
  } else {
    twiml.say({ language: 'es-MX' }, 'No se especificó un número de destino.')
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
