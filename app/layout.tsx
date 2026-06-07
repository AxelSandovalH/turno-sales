import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import { LogOut } from 'lucide-react'
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
          <aside className="w-52 shrink-0 border-r border-border flex flex-col py-5 px-3">
            <div className="px-3 mb-6">
              <span className="text-sm font-semibold tracking-tight">Turno Sales</span>
            </div>
            <nav className="flex-1 flex flex-col gap-1">
              <a href="/leads"    className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Leads</a>
              <a href="/pipeline" className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Pipeline</a>
              <a href="/stats"    className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">Stats</a>
            </nav>
            <LogoutButton />
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

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
        Cerrar sesión
      </button>
    </form>
  )
}
