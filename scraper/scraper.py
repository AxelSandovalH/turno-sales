"""
Turno Sales — Google Maps Scraper via Places API

Uso:
  python3 scraper.py --niche barbershop --city "Ciudad de México" --limit 60
  python3 scraper.py --niche psychology  --city "Guadalajara"      --limit 40
  python3 scraper.py --all               --city "Monterrey"        --limit 30

Requiere scraper/.env con:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_PLACES_API_KEY
"""

import argparse
import math
import os
import re
import time
from typing import Optional, Tuple, List, Dict
from dotenv import load_dotenv
from supabase import create_client
import requests

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GOOGLE_KEY   = os.environ["GOOGLE_PLACES_API_KEY"]

PLACES_URL = "https://maps.googleapis.com/maps/api/place"

SEARCH_TERMS = {
    "barbershop":    ["barbería", "barber shop", "peluquería"],
    "psychology":    ["psicólogo", "consultorio psicología", "terapeuta psicológico"],
    "dentistry":     ["dentista", "clínica dental", "odontólogo"],
    "physiotherapy": ["fisioterapia", "fisioterapeuta", "rehabilitación física"],
}


def score(rating: float, reviews: int) -> int:
    if not rating or not reviews:
        return 0
    return round(rating * math.log10(reviews + 1) * 10)


def normalize_phone(raw: str) -> Optional[str]:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("52") and len(digits) == 12:
        return digits
    if len(digits) == 10:
        return f"52{digits}"
    return digits or None


def text_search(query: str, city: str, page_token: str = "") -> dict:
    params = {
        "query": f"{query} en {city}",
        "key": GOOGLE_KEY,
        "language": "es",
        "region": "mx",
    }
    if page_token:
        params["pagetoken"] = page_token
    r = requests.get(f"{PLACES_URL}/textsearch/json", params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def place_details(place_id: str) -> dict:
    params = {
        "place_id": place_id,
        "fields": "name,formatted_phone_number,international_phone_number,website,formatted_address",
        "key": GOOGLE_KEY,
        "language": "es",
    }
    r = requests.get(f"{PLACES_URL}/details/json", params=params, timeout=15)
    r.raise_for_status()
    return r.json().get("result", {})


def fetch_leads(query: str, city: str, niche: str, limit: int) -> List[Dict]:
    leads = []
    page_token = ""

    while len(leads) < limit:
        data = text_search(query, city, page_token)
        status = data.get("status")

        if status == "REQUEST_DENIED":
            print(f"  ✗ API key inválida o Places API no activada: {data.get('error_message')}")
            break
        if status == "ZERO_RESULTS":
            break
        if status not in ("OK", "ZERO_RESULTS"):
            print(f"  ✗ Error API: {status}")
            break

        for r in data.get("results", []):
            if len(leads) >= limit:
                break

            place_id   = r.get("place_id", "")
            name       = r.get("name", "")
            rating     = r.get("rating", 0.0)
            reviews    = r.get("user_ratings_total", 0)
            address    = r.get("formatted_address", "")
            maps_url   = f"https://www.google.com/maps/place/?q=place_id:{place_id}"

            # Detalles: teléfono y website
            details    = place_details(place_id) if place_id else {}
            raw_phone  = (details.get("international_phone_number")
                          or details.get("formatted_phone_number") or "")
            phone      = normalize_phone(raw_phone)
            time.sleep(0.15)  # respetar rate limit

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

        next_token = data.get("next_page_token")
        if not next_token or len(leads) >= limit:
            break
        time.sleep(2)  # Google requiere ~2s antes de usar next_page_token
        page_token = next_token

    return leads


def save_to_supabase(db, leads: List[Dict]) -> Tuple[int, int]:
    inserted = skipped = 0
    for lead in leads:
        try:
            if lead.get("google_place_id"):
                db.table("leads").upsert(lead, on_conflict="google_place_id").execute()
            else:
                existing = (db.table("leads").select("id")
                            .eq("business_name", lead["business_name"])
                            .eq("city", lead["city"]).execute())
                if existing.data:
                    skipped += 1
                    continue
                db.table("leads").insert(lead).execute()
            inserted += 1
        except Exception as e:
            print(f"  ✗ Error guardando '{lead['business_name']}': {e}")
    return inserted, skipped


def main():
    parser = argparse.ArgumentParser(description="Turno Sales — Places API Scraper")
    parser.add_argument("--niche",    choices=list(SEARCH_TERMS.keys()))
    parser.add_argument("--all",      action="store_true", help="Todos los nichos")
    parser.add_argument("--city",     required=True, help="Ej: 'Ciudad de México'")
    parser.add_argument("--limit",    type=int, default=30, help="Máx leads por término")
    args = parser.parse_args()

    if not args.niche and not args.all:
        parser.error("Especifica --niche o --all")

    niches = list(SEARCH_TERMS.keys()) if args.all else [args.niche]
    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    total_inserted = 0

    for niche in niches:
        print(f"\n── {niche.upper()} en {args.city} ──")
        all_leads: List[Dict] = []

        for term in SEARCH_TERMS[niche]:
            print(f"  Buscando: '{term}'...")
            try:
                leads = fetch_leads(term, args.city, niche, args.limit)
                all_leads.extend(leads)
                print(f"  → {len(leads)} resultados")
            except requests.HTTPError as e:
                print(f"  ✗ HTTP {e.response.status_code}: {e.response.text[:200]}")

        # Deduplicar por place_id o nombre
        seen: set = set()
        unique: List[Dict] = []
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
