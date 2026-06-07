import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Turno Sales',
  description: 'Pipeline de ventas — Turno',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground font-[family-name:var(--font-geist-sans)]">
        <div className="flex h-screen">
          <aside className="w-52 shrink-0 border-r border-border flex flex-col py-5 px-3 gap-1">
            <div className="px-3 mb-4">
              <span className="text-sm font-semibold tracking-tight">Turno Sales</span>
            </div>
            <a href="/leads" className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Leads</a>
            <a href="/pipeline" className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Pipeline</a>
            <a href="/stats" className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Stats</a>
          </aside>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
        <Toaster richColors />
      </body>
    </html>
  )
}
