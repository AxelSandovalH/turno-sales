"""
Turno Sales — Enriquecedor de teléfonos
Abre la ficha de Google Maps de cada lead sin teléfono y extrae el número.

Uso:
  python3 enrich.py
  python3 enrich.py --headless
"""

import argparse
import os
import re
import time
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def normalize_phone(raw: str) -> Optional[str]:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("52") and len(digits) == 12:
        return digits
    if len(digits) == 10:
        return f"52{digits}"
    return digits or None


def extract_phone(page) -> Optional[str]:
    """Intenta extraer teléfono de la ficha de Google Maps."""

    # Método 1: botón/link con data-item-id de teléfono
    try:
        el = page.locator('[data-item-id*="phone"]').first
        if el.count():
            text = el.text_content() or ""
            phone = normalize_phone(text)
            if phone:
                return phone
    except Exception:
        pass

    # Método 2: aria-label que contenga teléfono
    try:
        el = page.locator('[aria-label*="Teléfono"]').first
        if el.count():
            label = el.get_attribute("aria-label") or ""
            m = re.search(r"[\d\s\-\+\(\)]{7,}", label)
            if m:
                phone = normalize_phone(m.group())
                if phone:
                    return phone
    except Exception:
        pass

    # Método 3: buscar patrón de teléfono en el HTML completo
    try:
        content = page.content()
        patterns = [
            r'\+52\s?\d{2}\s?\d{4}\s?\d{4}',
            r'52\d{10}',
            r'\(\d{2,3}\)\s?\d{3,4}[\s\-]\d{4}',
            r'\d{2,3}[\s\-]\d{4}[\s\-]\d{4}',
        ]
        for pattern in patterns:
            m = re.search(pattern, content)
            if m:
                phone = normalize_phone(m.group())
                if phone and len(phone) >= 10:
                    return phone
    except Exception:
        pass

    return None


def main():
    parser = argparse.ArgumentParser(description="Enriquecedor de teléfonos")
    parser.add_argument("--headless", action="store_true", default=False)
    args = parser.parse_args()

    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Obtener leads sin teléfono que tengan URL de Maps
    res = (db.table("leads")
           .select("id, business_name, city, google_maps_url, google_place_id")
           .is_("phone", "null")
           .not_.is_("google_maps_url", "null")
           .execute())

    leads = res.data
    print(f"📋 {len(leads)} leads sin teléfono\n")

    if not leads:
        print("✅ Todos los leads tienen teléfono")
        return

    enriched = 0
    failed   = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        ctx  = browser.new_context(locale="es-MX", timezone_id="America/Mexico_City")
        page = ctx.new_page()

        # Aceptar cookies una vez
        try:
            page.goto("https://www.google.com/maps", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
            page.click("button:has-text('Aceptar todo')", timeout=3000)
        except Exception:
            pass

        for i, lead in enumerate(leads, 1):
            name = lead["business_name"]
            url  = lead["google_maps_url"]
            print(f"  [{i}/{len(leads)}] {name} ({lead['city']})...")

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(2500)

                phone = extract_phone(page)

                if phone:
                    db.table("leads").update({
                        "phone": phone,
                        "whatsapp_number": phone,
                        "updated_at": "now()",
                    }).eq("id", lead["id"]).execute()
                    print(f"     ✓ {phone}")
                    enriched += 1
                else:
                    print(f"     — Sin teléfono")
                    failed += 1

            except PlaywrightTimeout:
                print(f"     ✗ Timeout")
                failed += 1
            except Exception as e:
                print(f"     ✗ Error: {e}")
                failed += 1

            time.sleep(1.5)

        browser.close()

    print(f"\n✅ Enriquecidos: {enriched} | Sin teléfono: {failed}")


if __name__ == "__main__":
    main()
