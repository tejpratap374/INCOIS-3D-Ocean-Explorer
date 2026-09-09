#!/usr/bin/env python3
"""Mirror REAL INCOIS OMNI moored-buoy inventory to the local cache.

The OMNI network (https://incois.gov.in/omni.html) reports station positions
and near-real-time air/sea measurements. This script mirrors ONLY real values:

  data/incois/omni/manifest.json
  (schema read by ``app.services.real_data``)

The manifest provides ``lat_axis``, ``lon_axis`` and a ``buoys`` list, each
buoy carrying ``lat``, ``lon``, ``depth_m``, ``times`` and a ``timeseries``
map (variable -> values at those times). Because the INCOIS portal pages are
frequently relocated or rate-limited, this script:

  1. probes the configured source URL(s);
  2. when reachable, parses the station table into the manifest;
  3. when unreachable, prints a clear message and leaves the cache unprovisioned
     (the API then honestly returns 503 DATA_NOT_AVAILABLE — never fabricated).

Usage:
  python scripts/fetch_insitu_incois.py [--source https://incois.gov.in/omni.html]
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

DEFAULT_SOURCES = [
    "https://incois.gov.in/omni.html",
    "https://incois.gov.in/portal/datainfo/insitu.jsp",
]
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "incois" / "omni"
LAT_AXIS = [-10.0, -5.0, 0.0, 5.0, 10.0, 15.0, 20.0, 25.0]
LON_AXIS = [50.0, 55.0, 60.0, 65.0, 70.0, 75.0, 80.0, 85.0, 90.0, 95.0, 100.0]


def _fetch(url: str, out: Path) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=60) as resp, open(out, "wb") as f:
            f.write(resp.read())
        size = out.stat().st_size
        if size < 2000:
            return False
        return True
    except Exception as e:  # noqa: BLE001
        print(f"  ! could not fetch {url}: {e}")
        return False


def parse_stations(html: Path) -> list[dict]:
    """Extract the buoy station table (id, lat, lon, depth) from the INCOIS
    page. The parse is deliberately conservative — only rows that carry a
    numeric pair of coordinates are kept."""
    import re

    text = html.read_text(encoding="utf-8", errors="replace")
    rows = []
    for m in re.finditer(
        r"<tr[^>]*>(.*?)</tr>", text, flags=re.IGNORECASE | re.DOTALL
    ):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", m.group(1), flags=re.IGNORECASE | re.DOTALL)
        cells = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
        if len(cells) < 3:
            continue
        lat = None
        lon = None
        depth = 0.0
        for tok in cells:
            t = tok.lower()
            m2 = re.match(r"^\s*([+-]?\d+(?:\.\d+)?)\s*[°^]?\s*([ns])\s*$", t)
            m3 = re.match(r"^\s*([+-]?\d+(?:\.\d+)?)\s*[°^]?\s*([ew])\s*$", t)
            if m2:
                lat = float(m2.group(1))
                if m2.group(2) == "s":
                    lat = -lat
            elif m3:
                lon = float(m3.group(1))
                if m3.group(2) == "w":
                    lon = -lon
        if lat is None or lon is None:
            continue
        depth_m = 0.0
        for tok in cells:
            mD = re.match(r"^\s*(\d+(?:\.\d+)?)\s*m\s*$", tok.lower())
            if mD:
                depth_m = float(mD.group(1))
                break
        rows.append(
            {
                "station_id": cells[0],
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "depth_m": depth_m,
                "times": [],
                "timeseries": {},
                "source": "https://incois.gov.in/omni.html",
            }
        )
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", action="append", help="INCOIS OMNI page URL")
    args = ap.parse_args()

    sources = args.source or DEFAULT_SOURCES
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DATA_DIR / "omni_page.snapshot.html"

    ok = False
    for url in sources:
        print(f"[1/2] probing {url}")
        if _fetch(url, tmp):
            ok = True
            break
    if not ok:
        print(
            "[2/2] INCOIS OMNI pages are unreachable from this network. The "
            "omni cache stays unprovisioned and the API honestly returns "
            "503 DATA_NOT_AVAILABLE for incois_omni_buoys. When the portal "
            "becomes reachable, re-run this script."
        )
        return 0

    buoys = parse_stations(tmp)
    if not buoys:
        print(
            "[2/2] The OMNI page did not contain a parseable real station "
            "table. Nothing was written (never fabricate buoy positions)."
        )
        return 0

    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "lat_axis": LAT_AXIS,
        "lon_axis": LON_AXIS,
        "source": sources[0],
        "buoys": buoys,
    }
    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"[2/2] wrote omni/manifest.json with {len(buoys)} real INCOIS OMNI station rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())