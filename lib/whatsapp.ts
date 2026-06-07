import type { Niche } from '@/types/database'

const SCRIPTS: Record<Niche, string> = {
  barbershop: `Hola! Te escribo de Turno 👋 Vi *{name}* en Google Maps y quería preguntarte: ¿cómo manejas actualmente las citas de tus clientes?`,
  psychology: `Hola! Te escribo de Turno 👋 Vi *{name}* en Google Maps. ¿Actualmente tus pacientes agendan citas por WhatsApp o por teléfono?`,
  dentistry: `Hola! Te escribo de Turno 👋 Vi *{name}* en Google Maps. ¿Cómo están manejando las citas y recordatorios de pacientes?`,
  physiotherapy: `Hola! Te escribo de Turno 👋 Vi *{name}* en Google Maps. ¿Cómo coordinan las citas entre sus terapeutas?`,
  other: `Hola! Te escribo de Turno 👋 Vi *{name}* en Google Maps. ¿Cómo están gestionando las citas de sus clientes?`,
}

export function buildWhatsAppURL(phone: string, businessName: string, niche: Niche | null) {
  const script = SCRIPTS[niche ?? 'other'].replace('{name}', businessName)
  const clean = phone.replace(/\D/g, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(script)}`
}
