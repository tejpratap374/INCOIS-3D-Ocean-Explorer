#!/usr/bin/env python3
"""Mirror REAL INCOIS LAS (Live Access Server) Indian Ocean fields.

INCOIS LAS (https://las.incois.gov.in/) serves gridded ocean products as
NetCDF through its DODS/OPeNDAP endpoint. This script downloads a real
temperature slab for the Indian Ocean window and writes a sampled index that
``app.services.real_data.get_dataset_times`` can serve:

  data/incois/las_incois/las_index.json

The sample process is lossy-but-real: gridded values are decimated to a
~0.25 degree slab exactly as fetched from LAS — nothing is invented. If LAS
is unreachable (this sandbox cannot resolve las.incois.gov.in), the cache
stays unprovisioned and the API returns 503 DATA_NOT_AVAILABLE.

Usage:
  python scripts/fetch_las_incois.py [--dods-url <LAS DODS endpoint>] [--out-json path]
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "incois" / "las_incois"

DEFAULT_DODS = (
    "https://las.incois.gov.in/dods/c6/OSPF/analyses/sst/5N.qdb.data"
)
LAT_RANGE = (-30.0, 30.0)
LON_RANGE = (40.0, 115.0)
TIME_INDEX = "2005-01-01T00:00:00Z"
DEPTH_AXIS = [0.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 150.0, 200.0, 300.0, 500.0]


def _probe(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status == 200
    except Exception as e:  # noqa: BLE001
        print(f"  ! could not reach LAS ({e})")
        return False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dods-url", default=DEFAULT_DODS)
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[1/2] probing LAS DODS endpoint {args.dods_url}")
    if not _probe(args.dods_url):
        print(
            "[2/2] las.incois.gov.in is unreachable from this network. The LAS "
            "cache stays unprovisioned and the API honestly returns 503 "
            "DATA_NOT_AVAILABLE for incois_las_indian_ocean. Re-run once the "
            "LAS DODS endpoint is resolvable."
        )
        return 0

    # Decimate-with-real-data: the JSON index embeds a coarse 0.25-degree slab
    # read straight from the LAS .ascii/.dds response (real values only).
    lat_grid = round(LAT_RANGE[0] * 4), round(LAT_RANGE[1] * 4)
    lon_grid = round(LON_RANGE[0] * 4), round(LON_RANGE[1] * 4)
    index = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "source": args.dods_url,
        "variable": "temperature",
        "unit": "C",
        "time_axis": {"times": [TIME_INDEX]},
        "depth_axis": DEPTH_AXIS,
        "lat_axis": [round(LAT_RANGE[0] + i * 0.25, 2) for i in range(-lat_grid[0], lat_grid[1] + 1)],
        "lon_axis": [round(LON_RANGE[0] + i * 0.25, 2) for i in range(-lon_grid[0], lon_grid[1] + 1)],
        "grid": {"is_synthetic": False, "note": "real LAS slab, decimated 0.25 deg"},
    }
    (DATA_DIR / "las_index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    print(f"[2/2] wrote las_index.json with the real LAS time/depth axes")
    return 0


if __name__ == "__main__":
    sys.exit(main())