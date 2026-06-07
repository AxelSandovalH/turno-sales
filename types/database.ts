export type LeadStatus =
  | 'scraped'
  | 'enriched'
  | 'contacted'
  | 'responding'
  | 'negotiating'
  | 'link_sent'
  | 'won'
  | 'lost'
  | 'no_contact'

export type Niche =
  | 'barbershop'
  | 'psychology'
  | 'dentistry'
  | 'physiotherapy'
  | 'other'

export interface Lead {
  id: string
  business_name: string
  phone: string | null
  whatsapp_number: string | null
  city: string | null
  state: string | null
  niche: Niche | null
  google_maps_url: string | null
  google_place_id: string | null
  rating: number | null
  review_count: number | null
  address: string | null
  website: string | null
  score: number | null
  status: LeadStatus
  assigned_to: string | null
  notes: string | null
  stripe_payment_link: string | null
  stripe_session_id: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
}

export interface SalesActivity {
  id: string
  lead_id: string
  action: 'status_change' | 'note' | 'called' | 'whatsapp_sent' | 'link_sent'
  from_status: string | null
  to_status: string | null
  note: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<Lead, 'id'>>
      }
      sales_activity: {
        Row: SalesActivity
        Insert: Omit<SalesActivity, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<SalesActivity, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
