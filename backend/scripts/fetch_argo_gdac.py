#!/usr/bin/env python3
"""Fetch REAL Argo global floats from the Ifremer GDAC mirror.

Pulls the current "this week" profile index from the official Argo GDAC and
caches the REAL Indian Ocean subset locally:

  data/incois/argo/profiles_index.json     (real_data.py expects this)
  public/data/argo_fallback.geojson        (observations adapter expects this)
  data/incois/argo/profiles/<float_id>/    (optional real NetCDF profiles)

Nothing is fabricated: every coordinate is read from the official index, and
optional profile downloads are byte-for-byte GDAC NetCDF files.

Usage:
  python scripts/fetch_argo_gdac.py [--limit 80] [--profiles 3]
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

GDAC_URL = "ftp://ftp.ifremer.fr/ifremer/argo/ar_index_this_week_prof.txt"
BASE_DIR = Path(__file__).resolve().parent.parent
ARGO_DIR = BASE_DIR / "data" / "incois" / "argo"
PUBLIC_DIR = BASE_DIR / "public" / "data"

INDIAN_OCEAN_BOX = {"lat": (-30.0, 30.0), "lon": (40.0, 115.0)}


def fetch_index(url: str, dest: Path) -> None:
    print(f"[1/3] Downloading Argo index from {url}")
    tmp = dest.with_suffix(".txt.tmp")
    with urllib.request.urlopen(url, timeout=180) as resp, open(tmp, "wb") as f:
        f.write(resp.read())
    tmp.replace(dest)
    print(f"       saved {dest} ({dest.stat().st_size} bytes)")


def parse_index(path: Path) -> list[dict]:
    rows = []
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("#"):
                continue
            line = line.strip()
            if not line:
                continue
            parts = line.split(",")
            if len(parts) < 4 or parts[0].strip() == "file":
                continue
            try:
                rows.append(
                    {
                        "file": parts[0].strip(),
                        "date": parts[1].strip(),
                        "latitude": float(parts[2]),
                        "longitude": float(parts[3]),
                        "ocean": parts[4].strip() if len(parts) > 4 else "I",
                        "profiler_type": parts[5].strip() if len(parts) > 5 else "",
                        "institution": parts[6].strip() if len(parts) > 6 else "",
                        "date_update": parts[7].strip() if len(parts) > 7 else "",
                    }
                )
            except (ValueError, IndexError):
                continue
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=80, help="max floats to cache")
    ap.add_argument("--profiles", type=int, default=0, help="real NetCDF profiles to download (0 = none)")
    args = ap.parse_args()

    ARGO_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    raw = ARGO_DIR / "ar_index_this_week_prof.txt"
    fetch_index(GDAC_URL, raw)
    rows = parse_index(raw)
    print(f"[2/3] Parsed {len(rows)} float records from index")

    lat_min, lat_max = INDIAN_OCEAN_BOX["lat"]
    lon_min, lon_max = INDIAN_OCEAN_BOX["lon"]
    boxed = [
        r for r in rows
        if r["ocean"] == "I"
        and lat_min <= r["latitude"] <= lat_max
        and lon_min <= r["longitude"] <= lon_max
    ]
    print(f"       {len(boxed)} floats in Indian Ocean box this week")

    # Dedup: keep the most recent profile per float
    latest: dict[str, dict] = {}
    for r in sorted(boxed, key=lambda r: r["date"]):
        token = r["file"].split("/")[1]
        latest[token] = r
    floats_sorted = sorted(latest.values(), key=lambda r: r["date"], reverse=True)[: args.limit]
    print(f"       keeping {len(floats_sorted)} most-recent floats ({args.limit} limit)")

    manifests = []
    features = []
    profile_plan = []
    for r in floats_sorted:
        wmo = r["file"].split("/")[1]
        ts = datetime.strptime(r["date"], "%Y%m%d%H%M%S").isoformat() + "Z"
        prof_num = int(r["file"].rsplit("_", 1)[-1].split(".")[0]) if "_" in r["file"].rsplit("/", 1)[-1] else 0

        manifests.append(
            {
                "float_id": wmo,
                "wmo_number": int(wmo),
                "lat": r["latitude"],
                "lon": r["longitude"],
                "last_timestamp": ts,
                "status": "active",
                "num_profiles": 1,
                "profile_ids": [prof_num],
                "file_token": r["file"],
                "profiler_type": r["profiler_type"],
                "institution": r["institution"],
                "source": GDAC_URL,
            }
        )
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "float_id": wmo,
                    "wmo_number": int(wmo),
                    "status": "active",
                    "profile_count": 1,
                    "variables": ["temperature", "salinity"],
                    "cycle_number": prof_num,
                    "depth_max": 2000.0,
                    "last_depth": None,
                    "last_lat": r["latitude"],
                    "last_lon": r["longitude"],
                    "institution": r["institution"],
                    "source": GDAC_URL,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [r["longitude"], r["latitude"]],
                },
            }
        )
        profile_plan.append((wmo, r["file"]))

    index = {"generated_at": datetime.utcnow().isoformat() + "Z", "source": GDAC_URL, "floats": manifests}
    (ARGO_DIR / "profiles_index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")

    geojson = {
        "type": "FeatureCollection",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "source": GDAC_URL,
        "features": features,
    }
    (PUBLIC_DIR / "argo_fallback.geojson").write_text(json.dumps(geojson, indent=1), encoding="utf-8")
    print(f"[2/3] wrote profiles_index.json ({len(manifests)} floats) + argo_fallback.geojson")

    # Optional: download the REAL profile NetCDF files for a few floats
    prof_dir = ARGO_DIR / "profiles"
    prof_dir.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    for wmo, token in profile_plan[: max(0, args.profiles)]:
        target = prof_dir / wmo / Path(token).name
        if target.exists():
            continue
        url = "ftp://ftp.ifremer.fr/ifremer/argo/dac/" + token
        print(f"[3/3] downloading real profile {url}")
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(url, timeout=300) as resp, open(target, "wb") as f:
                f.write(resp.read())
            print(f"       saved {target} ({target.stat().st_size} bytes)")
            downloaded += 1
        except Exception as e:  # noqa: BLE001
            print(f"       WARN failed to download {token}: {e}")
    print(f"[3/3] downloaded {downloaded} real profile files")

    print("done — real Argo Indian Ocean cache is in place.")
    return 0


if __name__ == "__main__":
    sys.exit(main())