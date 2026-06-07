"""
Turno Sales — Scraper de leads via Google Places API (Text Search)

Uso:
  python scraper.py --niche barbershop --city "Ciudad de México" --limit 60
  python scraper.py --niche psychology  --city "Guadalajara"      --limit 40
  python scraper.py --all               --city "Monterrey"        --limit 30

Requiere .env con:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_PLACES_API_KEY
"""

import argparse
import math
import os
import time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GOOGLE_KEY   = os.environ["GOOGLE_PLACES_API_KEY"]

SEARCH_TERMS = {
    "barbershop":    ["barbería", "barber shop", "peluquería"],
    "psychology":    ["psicólogo", "consultorio psicología", "terapeuta psicológico"],
    "dentistry":     ["dentista", "clínica dental", "odontólogo"],
    "physiotherapy": ["fisioterapia", "fisioterapeuta", "rehabilitación física"],
}

PLACES_URL = "https://maps.googleapis.com/maps/api/place"


def score(rating: float, review_count: int) -> int:
    if not rating or not review_count:
        return 0
    return round(rating * math.log10(review_count + 1) * 10)


def text_search(query: str, city: str, page_token: str = "") -> dict:
    params = {
        "query": f"{query} en {city}",
        "key": GOOGLE_KEY,
        "language": "es",
        "region": "mx",
    }
    if page_token:
        params["pagetoken"] = page_token
    r = requests.get(f"{PLACES_URL}/textsearch/json", params=params, timeout=10)
    r.raise_for_status()
    return r.json()


def place_details(place_id: str) -> dict:
    params = {
        "place_id": place_id,
        "fields": "name,formatted_phone_number,international_phone_number,website,formatted_address",
        "key": GOOGLE_KEY,
        "language": "es",
    }
    r = requests.get(f"{PLACES_URL}/details/json", params=params, timeout=10)
    r.raise_for_status()
    return r.json().get("result", {})


def fetch_leads(query: str, city: str, niche: str, limit: int) -> list[dict]:
    leads = []
    page_token = ""

    while len(leads) < limit:
        data = text_search(query, city, page_token)
        results = data.get("results", [])

        for r in results:
            if len(leads) >= limit:
                break

            place_id = r.get("place_id", "")
            name     = r.get("name", "")
            rating   = r.get("rating", 0.0)
            reviews  = r.get("user_ratings_total", 0)
            address  = r.get("formatted_address", "")
            maps_url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"

            # Detalles adicionales (teléfono, website)
            details = place_details(place_id) if place_id else {}
            raw_phone = (
                details.get("international_phone_number")
                or details.get("formatted_phone_number")
                or ""
            )
            phone = raw_phone.replace("+", "").replace(" ", "").replace("-", "") if raw_phone else None
            # Normalizar a formato MX (521XXXXXXXXXX)
            if phone and phone.startswith("52") and len(phone) == 12:
                pass  # ya está bien
            elif phone and len(phone) == 10:
                phone = f"52{phone}"

            leads.append({
                "business_name":   name,
                "phone":           phone,
                "whatsapp_number": phone,
                "city":            city,
                "state":           None,
                "niche":           niche,
                "address":         address or None,
                "website":         details.get("website") or None,
                "rating":          round(float(rating), 1) if rating else None,
                "review_count":    int(reviews) if reviews else None,
                "score":           score(float(rating), int(reviews)),
                "google_place_id": place_id or None,
                "google_maps_url": maps_url,
                "status":          "scraped",
            })
            time.sleep(0.1)  # respetar rate limit de Details API

        # Siguiente página
        next_token = data.get("next_page_token")
        if not next_token or len(leads) >= limit:
            break
        time.sleep(2)  # Google requiere ~2s antes de usar el next_page_token
        page_token = next_token

    return leads


def save_to_supabase(db, leads: list[dict]) -> tuple[int, int]:
    inserted = skipped = 0
    for lead in leads:
        try:
            if lead.get("google_place_id"):
                db.table("leads").upsert(lead, on_conflict="google_place_id").execute()
            else:
                existing = (
                    db.table("leads")
                    .select("id")
                    .eq("business_name", lead["business_name"])
                    .eq("city", lead["city"])
                    .execute()
                )
                if existing.data:
                    skipped += 1
                    continue
                db.table("leads").insert(lead).execute()
            inserted += 1
        except Exception as e:
            print(f"  ✗ Error guardando '{lead['business_name']}': {e}")
    return inserted, skipped


def main():
    parser = argparse.ArgumentParser(description="Turno Sales — Google Places Scraper")
    parser.add_argument("--niche",  choices=list(SEARCH_TERMS.keys()), help="Nicho a scrapear")
    parser.add_argument("--all",    action="store_true", help="Scrapear todos los nichos")
    parser.add_argument("--city",   required=True, help="Ciudad objetivo (ej: 'Ciudad de México')")
    parser.add_argument("--limit",  type=int, default=30, help="Máximo de leads por término de búsqueda")
    args = parser.parse_args()

    if not args.niche and not args.all:
        parser.error("Especifica --niche o --all")

    niches = list(SEARCH_TERMS.keys()) if args.all else [args.niche]
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    total_inserted = 0

    for niche in niches:
        print(f"\n── {niche.upper()} en {args.city} ──")
        all_leads: list[dict] = []

        for term in SEARCH_TERMS[niche]:
            print(f"  Buscando: {term}...")
            leads = fetch_leads(term, args.city, niche, args.limit)
            all_leads.extend(leads)
            print(f"  → {len(leads)} resultados")

        # Deduplicar por place_id o nombre
        seen: set[str] = set()
        unique: list[dict] = []
        for lead in all_leads:
            key = lead.get("google_place_id") or lead["business_name"].lower()
            if key not in seen:
                seen.add(key)
                unique.append(lead)

        print(f"  Únicos: {len(unique)}")
        ins, skip = save_to_supabase(db, unique)
        print(f"  ✓ {ins} guardados · {skip} ya existían")
        total_inserted += ins

    print(f"\n✅ Total guardados: {total_inserted}")


if __name__ == "__main__":
    main()
