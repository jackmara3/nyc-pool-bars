#!/usr/bin/env python3
"""
Import 44 additional pool bars from CSV into Supabase.
Fetches address, coordinates, and neighborhood via Google Places API.
Does NOT delete or modify any existing bars or reviews.

Usage:
  python3 import_bars_2.py

Prerequisites:
  pip3 install requests
"""

import csv
import json
import re
import time
import requests
from datetime import datetime, timezone

# ─── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://rbbmvnpxgyspsxatcnke.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_nwLMCKrH5DZM-gxGZJE0-w_ZFC-pmI7"
GOOGLE_API_KEY = "AIzaSyDqMQ20cbuHg_031zsxAPEDlPz2NsOJxgo"
CSV_FILE = "Pool_Bar_Rankings_-_Sheet6.csv"

# Headers for Supabase REST API
SUPABASE_HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}


def slugify(name):
    """Convert bar name to URL-friendly slug ID."""
    s = name.lower().strip()
    s = s.replace("&", "and").replace("'", "").replace("\u2019", "")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def parse_price(price_str, pay_method):
    """Parse price from CSV into display format and price_type."""
    if not price_str or price_str.strip() == "":
        return None, None

    price_str = price_str.strip()

    if price_str.lower() == "free" or price_str == "$0.00":
        return "Free", "free"

    # Parse dollar amount
    amount = price_str.replace("$", "").strip()
    try:
        amount_float = float(amount)
    except ValueError:
        return price_str, pay_method or "per game"

    # Format based on pay method
    method = (pay_method or "").strip().lower()
    if "hour" in method:
        if "person" in method:
            return f"${amount_float:.0f}/hour", "per hour per person"
        return f"${amount_float:.0f}/hour", "per hour"
    else:
        # Show cents if not a round dollar
        if amount_float == int(amount_float):
            return f"${int(amount_float)}/game", "per game"
        else:
            return f"${amount_float:.2f}/game", "per game"


def fetch_place_details(place_id):
    """Fetch address, coordinates, neighborhood, and hours from Google Places API."""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    params = {
        "fields": "formattedAddress,location,addressComponents,regularOpeningHours",
        "key": GOOGLE_API_KEY,
    }

    try:
        resp = requests.get(url, params=params)
        if resp.status_code != 200:
            print(f"  Google API error {resp.status_code}: {resp.text[:200]}")
            return None, None, None, None, None

        data = resp.json()

        # Extract address
        address = data.get("formattedAddress")

        # Extract coordinates
        location = data.get("location", {})
        lat = location.get("latitude")
        lng = location.get("longitude")

        # Extract neighborhood from address components
        neighborhood = None
        components = data.get("addressComponents", [])
        for comp in components:
            types = comp.get("types", [])
            if "neighborhood" in types:
                neighborhood = comp.get("longText") or comp.get("shortText")
                break
            if "sublocality_level_1" in types or "sublocality" in types:
                neighborhood = comp.get("longText") or comp.get("shortText")

        # Fallback to locality
        if not neighborhood:
            for comp in components:
                types = comp.get("types", [])
                if "locality" in types:
                    neighborhood = comp.get("longText") or comp.get("shortText")
                    break

        # Extract hours
        hours_data = data.get("regularOpeningHours")

        return address, lat, lng, neighborhood, json.dumps(hours_data) if hours_data else None

    except Exception as e:
        print(f"  Error fetching place details: {e}")
        return None, None, None, None, None


def parse_csv():
    """Read and parse the CSV file."""
    bars = []
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["Bar Name"].strip()
            place_id = row["Place ID"].strip()
            price_raw = row["Price"].strip()
            pay_method = row["Pay by method"].strip()
            table_type = row["Table Type"].strip()
            tables_raw = row["Tables"].strip()

            # Parse price
            price, price_type = parse_price(price_raw, pay_method)

            # Parse table count
            table_count = None
            if tables_raw:
                try:
                    table_count = int(tables_raw)
                except ValueError:
                    pass

            bar_id = slugify(name)

            bars.append({
                "id": bar_id,
                "name": name,
                "place_id": place_id or None,
                "price": price,
                "price_type": price_type,
                "table_count": table_count,
                "table_brand": table_type or None,
                "address": None,
                "lat": None,
                "lng": None,
                "neighborhood": None,
                "hours_data": None,
                "hours_last_updated": None,
            })

    return bars


def upsert_bars(bars):
    """Upsert bars into Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/bars"

    # Upsert in batches of 10
    batch_size = 10
    for i in range(0, len(bars), batch_size):
        batch = bars[i : i + batch_size]
        resp = requests.post(url, headers=SUPABASE_HEADERS, json=batch)
        if resp.status_code not in (200, 201):
            print(f"  Error upserting batch {i}: {resp.status_code} {resp.text[:300]}")
        else:
            print(f"  Upserted bars {i+1}-{i+len(batch)}")


def main():
    print("=" * 60)
    print("NYC Pool Bars - CSV Import (44 Additional Bars)")
    print("=" * 60)

    # 1. Parse CSV
    print("\n[1/3] Parsing CSV...")
    bars = parse_csv()
    print(f"  Found {len(bars)} bars")

    # Check for duplicate IDs
    ids = [b["id"] for b in bars]
    dupes = set(x for x in ids if ids.count(x) > 1)
    if dupes:
        print(f"  WARNING: Duplicate IDs found: {dupes}")
        seen = {}
        for bar in bars:
            if bar["id"] in dupes:
                count = seen.get(bar["id"], 0)
                if count > 0:
                    bar["id"] = f"{bar['id']}-{count+1}"
                seen[bar["id"]] = count + 1

    # 2. Fetch address, coordinates, neighborhood, hours from Google Places
    print("\n[2/3] Fetching details from Google Places API...")
    for i, bar in enumerate(bars):
        place_id = bar.get("place_id")
        if not place_id:
            print(f"  [{i+1}/{len(bars)}] {bar['name']} — no Place ID, skipping API call")
            continue

        address, lat, lng, neighborhood, hours_data = fetch_place_details(place_id)

        if address:
            bar["address"] = address
        if lat is not None and lng is not None:
            bar["lat"] = lat
            bar["lng"] = lng
        if neighborhood:
            bar["neighborhood"] = neighborhood
        else:
            # Fallback from address
            addr = bar.get("address") or ""
            if "Hoboken" in addr:
                bar["neighborhood"] = "Hoboken"
            elif "Jersey City" in addr:
                bar["neighborhood"] = "Downtown Jersey City"
            elif "Brooklyn" in addr:
                bar["neighborhood"] = "Brooklyn"
            else:
                bar["neighborhood"] = "New York"

        if hours_data:
            bar["hours_data"] = hours_data
            bar["hours_last_updated"] = datetime.now(timezone.utc).isoformat()

        print(f"  [{i+1}/{len(bars)}] {bar['name']} → {bar.get('neighborhood', '?')} ({bar.get('address', 'no address')[:50]})")

        # Rate limit
        time.sleep(0.15)

    # Check for bars missing critical data
    missing_addr = [b for b in bars if not b.get("address")]
    missing_coords = [b for b in bars if b.get("lat") is None]
    if missing_addr:
        print(f"\n  WARNING: {len(missing_addr)} bars missing address: {[b['name'] for b in missing_addr]}")
    if missing_coords:
        print(f"  WARNING: {len(missing_coords)} bars missing coordinates: {[b['name'] for b in missing_coords]}")

    # 3. Upsert all bars (no deleting existing bars)
    print("\n[3/3] Upserting bars into Supabase...")
    upsert_bars(bars)

    print(f"\n{'=' * 60}")
    print(f"Done! Imported {len(bars)} additional bars.")
    print(f"{'=' * 60}")

    # Print summary
    with_hours = [b for b in bars if b.get("hours_data")]
    print(f"\n  Bars with hours data: {len(with_hours)}")
    no_price = [b for b in bars if not b.get("price")]
    print(f"  Bars with no price: {len(no_price)}")
    no_tables = [b for b in bars if not b.get("table_count")]
    print(f"  Bars with no table count: {len(no_tables)}")


if __name__ == "__main__":
    main()
