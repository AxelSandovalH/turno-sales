"""
Turno Sales — Google Maps Scraper
Uso: python scraper.py --niche barbershop --city "Ciudad de México" --limit 50
"""

import argparse
import math
import os
import re
import time
from dotenv import load_dotenv
from supabase import create_client
from playwright.sync_api import sync_playwright

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SEARCH_TERMS = {
    "barbershop":    ["barbería", "barber shop", "barbero"],
    "psychology":    ["psicólogo", "psicología", "terapeuta psicológico"],
    "dentistry":     ["dentista", "clínica dental", "odontólogo"],
    "physiotherapy": ["fisioterapia", "fisioterapeuta", "rehabilitación física"],
    "other":         ["spa", "salón de belleza", "estética"],
}


def score(rating: float, review_count: int) -> int:
    if not rating or not review_count:
        return 0
    return round(rating * math.log10(review_count + 1) * 10)


def clean_phone(raw: str) -> str:
    """Limpia y normaliza número de teléfono a formato internacional MX."""
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("52") and len(digits) == 12:
        return digits
    if len(digits) == 10:
        return f"52{digits}"
    return digits


def scrape_google_maps(page, query: str, city: str, limit: int) -> list[dict]:
    search_query = f"{query} en {city}"
    url = f"https://www.google.com/maps/search/{search_query.replace(' ', '+')}"
    print(f"  Buscando: {search_query}")

    page.goto(url, wait_until="networkidle")
    time.sleep(2)

    # Scroll para cargar más resultados
    results_panel = page.locator('[role="feed"]')
    for _ in range(5):
        results_panel.evaluate("el => el.scrollBy(0, 2000)")
        time.sleep(1.5)

    # Extraer cards de resultados
    cards = page.locator('[role="feed"] > div').all()
    leads = []

    for card in cards[:limit]:
        try:
            name_el = card.locator("a[aria-label]").first
            name = name_el.get_attribute("aria-label") or ""
            if not name:
                continue

            href = name_el.get_attribute("href") or ""
            place_id = ""
            if "place_id=" in href:
                place_id = href.split("place_id=")[1].split("&")[0]
            elif "/maps/place/" in href:
                place_id = href

            # Rating y reseñas
            rating_text = card.locator("span[aria-label*='estrella']").first.text_content() or ""
            rating = float(rating_text.replace(",", ".")) if rating_text else 0.0
            reviews_match = re.search(r"([\d,\.]+)\s*reseñas?", card.text_content() or "")
            review_count = int(reviews_match.group(1).replace(",", "").replace(".", "")) if reviews_match else 0

            # Dirección
            address_el = card.locator('[data-item-id="address"]')
            address = address_el.text_content() if address_el.count() else ""

            # Teléfono
            phone_el = card.locator('[data-item-id*="phone"]')
            raw_phone = phone_el.text_content() if phone_el.count() else ""
            phone = clean_phone(raw_phone) if raw_phone else None

            leads.append({
                "business_name": name.strip(),
                "phone": phone,
                "whatsapp_number": phone,
                "city": city,
                "address": address.strip() if address else None,
                "rating": round(rating, 1) if rating else None,
                "review_count": review_count if review_count else None,
                "google_maps_url": href if href.startswith("https") else f"https://maps.google.com{href}",
                "google_place_id": place_id or None,
                "score": score(rating, review_count),
            })
        except Exception as e:
            print(f"    Error procesando card: {e}")
            continue

    return leads


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--niche", required=True, choices=list(SEARCH_TERMS.keys()))
    parser.add_argument("--city", required=True)
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--headless", action="store_true", default=False)
    args = parser.parse_args()

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    all_leads = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        page = browser.new_page()
        page.set_extra_http_headers({"Accept-Language": "es-MX,es;q=0.9"})

        for term in SEARCH_TERMS[args.niche]:
            leads = scrape_google_maps(page, term, args.city, args.limit)
            for lead in leads:
                lead["niche"] = args.niche
                lead["state"] = None
            all_leads.extend(leads)
            time.sleep(2)

        browser.close()

    # Deduplicar por nombre
    seen = set()
    unique = []
    for lead in all_leads:
        key = lead["business_name"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(lead)

    print(f"\n✓ {len(unique)} leads únicos encontrados para {args.niche} en {args.city}")

    # Insertar en Supabase (upsert por place_id si existe)
    inserted = 0
    skipped = 0
    for lead in unique:
        try:
            if lead.get("google_place_id"):
                res = db.table("leads").upsert(lead, on_conflict="google_place_id").execute()
            else:
                # Sin place_id: insertar solo si no existe el nombre+ciudad
                existing = db.table("leads").select("id") \
                    .eq("business_name", lead["business_name"]) \
                    .eq("city", lead["city"]).execute()
                if existing.data:
                    skipped += 1
                    continue
                res = db.table("leads").insert(lead).execute()
            inserted += 1
        except Exception as e:
            print(f"  Error insertando {lead['business_name']}: {e}")

    print(f"✓ {inserted} leads guardados · {skipped} ya existían")


if __name__ == "__main__":
    main()
