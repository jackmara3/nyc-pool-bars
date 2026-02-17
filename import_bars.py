#!/usr/bin/env python3
"""
Import 58 pool bars from CSV into Supabase.
Fetches neighborhoods via Google Places API.
Preserves existing bar IDs so reviews stay connected.

Usage:
  python3 import_bars.py

Prerequisites:
  pip3 install requests

Before running:
  Run the schema migration SQL in Supabase SQL Editor (see supabase-schema.sql)
"""

import csv
import json
import re
import time
import requests

# ─── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://rbbmvnpxgyspsxatcnke.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_nwLMCKrH5DZM-gxGZJE0-w_ZFC-pmI7"
GOOGLE_API_KEY = "AIzaSyDqMQ20cbuHg_031zsxAPEDlPz2NsOJxgo"
CSV_FILE = "Pool Bar Rankings - Sheet5-3.csv"

# Headers for Supabase REST API
SUPABASE_HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

# Existing bar name → ID mapping (to preserve review links)
EXISTING_IDS = {
    "Macdougal St": "macdougal-st",
    "Barrow's Pub": "barrows-pub",
    "Rays": "rays",
    "Cellar Dog": "cellar-dog",
    "Trionas on Sullivan": "trionas-on-sullivan",
    "Bleeker Street Bar": "bleeker-street-bar",
    "Lucy's": "lucys",
    "Mcswiggins": "mcswiggins",
    "Mulligans Pub": "mulligans",
    "The Shannon": "the-shannon",
    "Louise & Jerrys": "louise-and-jerrys",
    "The Ale House": "the-ale-house",
    "Madd Hatter": "madd-hatter",
    "South House": "south-house",
}


def slugify(name):
    """Convert bar name to URL-friendly slug ID."""
    s = name.lower().strip()
    s = s.replace("&", "and").replace("'", "").replace("'", "")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def get_bar_id(name):
    """Get the bar ID, using existing mapping or generating a new slug."""
    if name in EXISTING_IDS:
        return EXISTING_IDS[name]
    return slugify(name)


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
        return f"${amount_float:.0f}/game", "per game"


def fetch_place_details(place_id):
    """Fetch neighborhood and hours from Google Places API (New)."""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    params = {
        "fields": "addressComponents,regularOpeningHours",
        "key": GOOGLE_API_KEY,
    }

    try:
        resp = requests.get(url, params=params)
        if resp.status_code != 200:
            print(f"  Google API error {resp.status_code}: {resp.text[:200]}")
            return None, None

        data = resp.json()

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

        # If no neighborhood found, try locality
        if not neighborhood:
            for comp in components:
                types = comp.get("types", [])
                if "locality" in types:
                    neighborhood = comp.get("longText") or comp.get("shortText")
                    break

        # Extract hours
        hours_data = data.get("regularOpeningHours")

        return neighborhood, json.dumps(hours_data) if hours_data else None

    except Exception as e:
        print(f"  Error fetching place details: {e}")
        return None, None


def parse_csv():
    """Read and parse the CSV file."""
    bars = []
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["Bar Name"].strip()
            address = row["Address"].strip()
            latlong = row["Lat / Long"].strip()
            place_id = row["Place ID"].strip()
            price_raw = row["Price"].strip()
            pay_method = row["Pay by method"].strip()
            table_type = row["Table Type"].strip()
            tables_raw = row["Tables"].strip()

            # Parse lat/long
            parts = latlong.split(",")
            lat = float(parts[0].strip())
            lng = float(parts[1].strip())

            # Parse price
            price, price_type = parse_price(price_raw, pay_method)

            # Parse table count
            table_count = None
            if tables_raw:
                try:
                    table_count = int(tables_raw)
                except ValueError:
                    pass

            bar_id = get_bar_id(name)

            bars.append({
                "id": bar_id,
                "name": name,
                "address": address,
                "lat": lat,
                "lng": lng,
                "place_id": place_id or None,
                "price": price,
                "price_type": price_type,
                "table_count": table_count,
                "table_brand": table_type or None,
                "neighborhood": None,  # Will be fetched from Google
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


def delete_old_bars(new_ids):
    """Delete bars that are no longer in the CSV (only those without reviews)."""
    # First get all current bar IDs
    url = f"{SUPABASE_URL}/rest/v1/bars?select=id"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print(f"  Error fetching current bars: {resp.text[:200]}")
        return

    current_ids = {b["id"] for b in resp.json()}
    ids_to_remove = current_ids - set(new_ids)

    if not ids_to_remove:
        print("  No old bars to remove.")
        return

    for bar_id in ids_to_remove:
        # Check if bar has reviews
        check_url = f"{SUPABASE_URL}/rest/v1/reviews?bar_id=eq.{bar_id}&select=id&limit=1"
        check_resp = requests.get(check_url, headers=headers)
        if check_resp.status_code == 200 and len(check_resp.json()) > 0:
            print(f"  Keeping {bar_id} (has reviews)")
            continue

        del_url = f"{SUPABASE_URL}/rest/v1/bars?id=eq.{bar_id}"
        del_headers = {**headers, "Content-Type": "application/json"}
        del_resp = requests.delete(del_url, headers=del_headers)
        if del_resp.status_code in (200, 204):
            print(f"  Deleted old bar: {bar_id}")
        else:
            print(f"  Error deleting {bar_id}: {del_resp.status_code}")


def main():
    print("=" * 60)
    print("NYC Pool Bars - CSV Import")
    print("=" * 60)

    # 1. Parse CSV
    print("\n[1/4] Parsing CSV...")
    bars = parse_csv()
    print(f"  Found {len(bars)} bars")

    # Check for duplicate IDs
    ids = [b["id"] for b in bars]
    dupes = set(x for x in ids if ids.count(x) > 1)
    if dupes:
        print(f"  WARNING: Duplicate IDs found: {dupes}")
        # Append number to dupes
        seen = {}
        for bar in bars:
            if bar["id"] in dupes:
                count = seen.get(bar["id"], 0)
                if count > 0:
                    bar["id"] = f"{bar['id']}-{count+1}"
                seen[bar["id"].split("-")[0] if "-" not in bar["id"] else "-".join(bar["id"].split("-")[:-1])] = count + 1

    # 2. Fetch neighborhoods from Google Places
    print("\n[2/4] Fetching neighborhoods from Google Places API...")
    for i, bar in enumerate(bars):
        place_id = bar.get("place_id")
        if not place_id:
            # Fallback: derive from address
            addr = bar["address"]
            if "Hoboken" in addr:
                bar["neighborhood"] = "Hoboken"
            elif "Jersey City" in addr:
                bar["neighborhood"] = "Downtown Jersey City"
            elif "Brooklyn" in addr:
                bar["neighborhood"] = "Brooklyn"
            else:
                bar["neighborhood"] = "New York"
            print(f"  [{i+1}/{len(bars)}] {bar['name']} → {bar['neighborhood']} (no Place ID, fallback)")
            continue

        neighborhood, hours_data = fetch_place_details(place_id)

        if neighborhood:
            bar["neighborhood"] = neighborhood
        else:
            # Fallback from address
            addr = bar["address"]
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
            bar["hours_last_updated"] = "now()"

        print(f"  [{i+1}/{len(bars)}] {bar['name']} → {bar['neighborhood']}")

        # Rate limit: Google Places API allows ~600 requests/min
        time.sleep(0.15)

    # 3. Delete old bars not in CSV
    print("\n[3/4] Cleaning up old bars...")
    new_ids = [b["id"] for b in bars]
    delete_old_bars(new_ids)

    # 4. Upsert all bars
    print("\n[4/4] Upserting bars into Supabase...")

    # Clean up hours_last_updated for Supabase (can't use now() in REST API)
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).isoformat()
    for bar in bars:
        if bar.get("hours_last_updated") == "now()":
            bar["hours_last_updated"] = now_str

    upsert_bars(bars)

    print(f"\n{'=' * 60}")
    print(f"Done! Imported {len(bars)} bars.")
    print(f"{'=' * 60}")

    # Print summary
    with_reviews = [b for b in bars if b["id"] in EXISTING_IDS.values()]
    print(f"\n  Bars with existing reviews: {len(with_reviews)}")
    print(f"  New bars (no reviews): {len(bars) - len(with_reviews)}")
    with_hours = [b for b in bars if b.get("hours_data")]
    print(f"  Bars with hours data: {len(with_hours)}")
    no_price = [b for b in bars if not b.get("price")]
    print(f"  Bars with no price: {len(no_price)}")
    no_tables = [b for b in bars if not b.get("table_count")]
    print(f"  Bars with no table count: {len(no_tables)}")


if __name__ == "__main__":
    main()
