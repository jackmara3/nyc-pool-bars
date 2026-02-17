#!/usr/bin/env python3
"""
Fix "Manhattan" neighborhoods by mapping zip codes to specific NYC neighborhoods.
Only updates bars where neighborhood is currently "Manhattan".
"""

import re
import requests

SUPABASE_URL = "https://rbbmvnpxgyspsxatcnke.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_nwLMCKrH5DZM-gxGZJE0-w_ZFC-pmI7"

ZIP_TO_NEIGHBORHOOD = {
    "10001": "Midtown",
    "10002": "Lower East Side",
    "10003": "East Village",
    "10009": "East Village",
    "10010": "Gramercy",
    "10011": "Chelsea",
    "10012": "Greenwich Village",
    "10013": "SoHo",
    "10014": "West Village",
    "10016": "Murray Hill",
    "10018": "Hell's Kitchen",
    "10019": "Midtown West",
    "10028": "Upper East Side",
    "10038": "Financial District",
    "10128": "Upper East Side",
}

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}


def main():
    # Fetch all bars with neighborhood = "Manhattan"
    url = f"{SUPABASE_URL}/rest/v1/bars?neighborhood=eq.Manhattan&select=id,name,address,neighborhood"
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Error fetching bars: {resp.status_code} {resp.text[:200]}")
        return

    bars = resp.json()
    print(f"Found {len(bars)} bars with neighborhood = 'Manhattan'\n")

    updated = 0
    unmatched = []

    for bar in bars:
        address = bar.get("address") or ""
        # Extract 5-digit zip code from address
        match = re.search(r"\b(\d{5})\b", address)
        if not match:
            unmatched.append(bar)
            continue

        zip_code = match.group(1)
        neighborhood = ZIP_TO_NEIGHBORHOOD.get(zip_code)

        if not neighborhood:
            unmatched.append(bar)
            continue

        # Update in Supabase
        patch_url = f"{SUPABASE_URL}/rest/v1/bars?id=eq.{bar['id']}"
        patch_resp = requests.patch(patch_url, headers=HEADERS, json={"neighborhood": neighborhood})
        if patch_resp.status_code in (200, 204):
            print(f"  {bar['name']}: Manhattan → {neighborhood} (zip {zip_code})")
            updated += 1
        else:
            print(f"  ERROR updating {bar['name']}: {patch_resp.status_code} {patch_resp.text[:200]}")

    print(f"\nUpdated {updated} bars.")

    if unmatched:
        print(f"\n{len(unmatched)} bars could not be matched to a neighborhood:")
        for bar in unmatched:
            address = bar.get("address") or "no address"
            match = re.search(r"\b(\d{5})\b", address)
            zip_code = match.group(1) if match else "no zip"
            print(f"  - {bar['name']} | {address} | zip: {zip_code}")


if __name__ == "__main__":
    main()
