'use client'

import { useState, useEffect, useRef } from 'react'
import { Phone, PhoneOff, PhoneMissed } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type CallState = 'idle' | 'connecting' | 'ringing' | 'ongoing' | 'ended'

interface Props {
  phone: string
  leadId: string
  businessName: string
  onCallStarted?: () => void
}

export function CallButton({ phone, leadId, businessName, onCallStarted }: Props) {
  const [state, setState] = useState<CallState>('idle')
  const [duration, setDuration] = useState(0)
  const deviceRef = useRef<unknown>(null)
  const callRef   = useRef<unknown>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function startCall() {
    setState('connecting')
    try {
      // Importar el SDK dinámicamente (solo en browser)
      const { Device } = await import('@twilio/voice-sdk')

      // Obtener token
      const res = await fetch('/api/twilio/token')
      const { token } = await res.json()

      const device = new Device(token, { logLevel: 'error' })
      deviceRef.current = device

      await device.register()
      setState('ringing')

      // Normalizar número
      const to = phone.startsWith('+') ? phone : `+${phone}`

      const call = await device.connect({
        params: { To: to },
      })
      callRef.current = call

      call.on('accept', () => {
        setState('ongoing')
        setDuration(0)
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
        onCallStarted?.()
        // Registrar en actividad
        fetch(`/api/leads/${leadId}/note`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: `📞 Llamada iniciada a ${businessName}` }),
        })
      })

      call.on('disconnect', () => endCall('ended'))
      call.on('cancel',     () => endCall('ended'))
      call.on('reject',     () => endCall('ended'))

    } catch (err) {
      console.error(err)
      toast.error('Error al iniciar la llamada')
      setState('idle')
    }
  }

  function endCall(nextState: CallState = 'ended') {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    const call = callRef.current as { disconnect?: () => void } | null
    call?.disconnect?.()
    const device = deviceRef.current as { destroy?: () => void } | null
    device?.destroy?.()
    deviceRef.current = null
    callRef.current   = null

    setState(nextState)
    setTimeout(() => setState('idle'), 3000)

    if (duration > 0) {
      const mins = Math.floor(duration / 60)
      const secs = duration % 60
      const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
      fetch(`/api/leads/${leadId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: `📞 Llamada terminada · Duración: ${label}` }),
      })
    }
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  if (state === 'idle') {
    return (
      <Button
        size="sm"
        className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
        onClick={startCall}
      >
        <Phone className="h-4 w-4" />
        Llamar
      </Button>
    )
  }

  if (state === 'connecting' || state === 'ringing') {
    return (
      <Button size="sm" variant="outline" className="gap-2 text-blue-400 border-blue-400/30" disabled>
        <Phone className="h-4 w-4 animate-pulse" />
        {state === 'connecting' ? 'Conectando...' : 'Llamando...'}
      </Button>
    )
  }

  if (state === 'ongoing') {
    return (
      <Button
        size="sm"
        className="gap-2 bg-red-600 hover:bg-red-500 text-white"
        onClick={() => endCall()}
      >
        <PhoneOff className="h-4 w-4" />
        Colgar · {formatDuration(duration)}
      </Button>
    )
  }

  // ended
  return (
    <Button size="sm" variant="outline" className="gap-2 text-muted-foreground" disabled>
      <PhoneMissed className="h-4 w-4" />
      Llamada terminada
    </Button>
  )
}
