#!/usr/bin/env python3
"""Fetch REAL glider missions from the Ifremer glider GDAC mirror.

Pulls the official trajectory directory file (glider_traj_index.txt) and caches
the REAL mission catalog locally:

  data/incois/gliders/manifest.json      (real_data.py expects this)
  public/data/gliders_fallback.geojson   (observations adapter expects this)

Every mission entry is read from the official GDAC index — the trajectories,
deployment positions and time coverage are REAL. If no real missions exist in
the requested region (the GDAC currently has none in the Indian Ocean), the
catalog is created anyway and the API honestly reports zero tracks there
(503 DATA_NOT_AVAILABLE), never fabricated geometry.

Usage:
  python scripts/fetch_glider_gdac.py [--limit 200]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

GDAC_URL = "ftp://ftp.ifremer.fr/ifremer/glider/v2/glider_traj_index.txt"
GDAC_ROOT = "ftp://ftp.ifremer.fr/ifremer/glider/v2"
BASE_DIR = Path(__file__).resolve().parent.parent
GLIDER_DIR = BASE_DIR / "data" / "incois" / "gliders"
PUBLIC_DIR = BASE_DIR / "public" / "data"


def fetch_index(url: str, dest: Path) -> None:
    print(f"[1/2] Downloading glider index from {url}")
    tmp = dest.with_suffix(".tmp")
    with urllib.request.urlopen(url, timeout=180) as resp, open(tmp, "wb") as f:
        f.write(resp.read())
    tmp.replace(dest)
    print(f"       saved {dest} ({dest.stat().st_size} bytes)")


def _iso_utc(raw: str) -> str:
    """Normalise a GDAC timestamp ('YYYYMMDDHHMMSS' or ISO) to ISO-8601 UTC."""
    s = (raw or "").strip()
    if not s:
        return ""
    if s.endswith("Z") or ("T" in s and "-" in s):
        return s
    if len(s) == 14 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}T{s[8:10]}:{s[10:12]}:{s[12:14]}Z"
    return s


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=200, help="max missions to cache")
    ap.add_argument(
        "--tracks",
        type=int,
        default=5,
        help="download `--tracks` real trajectory NetCDFs and extract track points "
        "(Indian Ocean missions only)",
    )
    args = ap.parse_args()

    GLIDER_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    raw = GLIDER_DIR / "glider_traj_index.txt"
    fetch_index(GDAC_URL, raw)

    rows: list[dict] = []
    with open(raw, newline="", encoding="utf-8", errors="replace") as f:
        lines = [l for l in f if not l.startswith("#") and l.strip()]
    for row in csv.DictReader(lines):
        cleaned = {
            k: (",".join(map(str, v)) if isinstance(v, list) else (v or "")).strip()
            for k, v in row.items()
        }
        if cleaned.get("file"):
            rows.append(cleaned)
    print(f"[2/2] parsed {len(rows)} real glider missions from GDAC index")

    def num(x):
        try:
            return float(x)
        except (TypeError, ValueError):
            return None

    missions = []
    features = []
    seen = set()
    for row in rows:
        file_token = row["file"]
        mission_key = file_token.split("/")[1] if file_token.startswith("/") else file_token.split("/")[0]
        if mission_key in seen:
            continue
        seen.add(mission_key)
        lat = num(row.get("deployment_start_latitude"))
        lon = num(row.get("deployment_start_longitude"))
        start = _iso_utc(row.get("deployment_start_date") or row.get("time_coverage_start") or "")
        end = _iso_utc(row.get("time_coverage_end") or "")
        wmo = row.get("wmo", "")
        missions.append(
            {
                "mission_id": mission_key,
                "glider_id": mission_key,
                "wmo": wmo,
                "file_token": file_token,
                "deployment_start_date": start,
                "deployment_latitude": lat,
                "deployment_longitude": lon,
                "start_time": start,
                "end_time": end,
                "owning_institution": row.get("owning_institution", ""),
                "program": row.get("program", ""),
                "glider_model": row.get("glider_model", ""),
                "parameter": row.get("parameter", ""),
                "source": GDAC_URL,
            }
        )
        if lat is not None and lon is not None:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "glider_id": mission_key,
                        "mission_id": mission_key,
                        "wmo": wmo,
                        "name": mission_key,
                        "start_time": start,
                        "end_time": end,
                        "owning_institution": row.get("owning_institution", ""),
                        "status": "active",
                        "variables": ["temperature", "salinity"],
                        "source": GDAC_URL,
                    },
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                }
            )

    missions = missions[: args.limit]
    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "source": GDAC_URL,
        "missions": missions,
    }
    (GLIDER_DIR / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")

    geojson = {
        "type": "FeatureCollection",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "source": GDAC_URL,
        "features": features[: args.limit],
    }
    (PUBLIC_DIR / "gliders_fallback.geojson").write_text(json.dumps(geojson, indent=1), encoding="utf-8")

    if args.tracks > 0:
        _extract_real_tracks(missions, features, geojson, args.tracks)

    in_io = sum(
        1 for m in missions
        if m["deployment_latitude"] is not None and -30 <= m["deployment_latitude"] <= 30
        and 40 <= m["deployment_longitude"] <= 115
    )
    print(f"[2/2] wrote manifest.json ({len(missions)} missions) + gliders_fallback.geojson")
    print(f"      Indian Ocean missions present in the real GDAC catalog: {in_io}")
    print("      (0 means the observations endpoint will honestly report 503 in that region.)")
    return 0


def _extract_real_tracks(
    missions: list[dict], features: list[dict], geojson: dict, count: int
) -> None:
    """Download per-mission trajectory NetCDFs and append REAL track points.

    A track point is [lon, lat, depth, temperature, salinity, timestamp] read
    straight from the GDAC trajectory file (POSITION_QC == 1 positions only).
    The points are decimated so the cache stays small; every value stays real.
    """
    io = [
        m for m in missions
        if m["deployment_latitude"] is not None and -30 <= m["deployment_latitude"] <= 30
        and 40 <= m["deployment_longitude"] <= 115
    ]
    for mission in io[:count]:
        token = mission["file_token"].lstrip("/")
        # The trajectory file sits beside the mission's profiles directory.
        url = f"{GDAC_ROOT}/{token}"
        name = Path(token).name
        tmp = GLIDER_DIR / f"{name}.tmp.nc"
        dest = GLIDER_DIR / name
        try:
            print(f"       fetching real trajectory {token}")
            with urllib.request.urlopen(url, timeout=180) as resp, open(tmp, "wb") as f:
                f.write(resp.read())
            tmp.replace(dest)
        except Exception as e:  # noqa: BLE001
            print(f"       ! could not fetch {url}: {e}")
            continue

        rows = _extract_track_rows(dest, mission["mission_id"])
        if not rows:
            print(f"       ! no QC-passing positions in {name}; skipping real track")
            continue
        print(f"       extracted {len(rows)} real track points from {name}")
        for feat in features:
            if feat["properties"].get("mission_id") == mission["mission_id"]:
                feat["properties"]["track_points"] = rows
                break
    payload = dict(geojson)
    payload["features"] = features
    (PUBLIC_DIR / "gliders_fallback.geojson").write_text(
        json.dumps(payload, indent=1), encoding="utf-8"
    )


def _extract_track_rows(nc_path: Path, mission_id: str) -> list[list]:
    """Read lat/lon/depth/temp/sal/time rows from a REAL trajectory NetCDF."""
    try:
        import numpy as np
        import xarray as xr
    except ImportError:
        print("       ! xarray/numpy missing; install this project's requirements")
        return []
    try:
        ds = xr.open_dataset(nc_path)
        lat = np.asarray(ds["LATITUDE"].values, dtype=float)
        lon = np.asarray(ds["LONGITUDE"].values, dtype=float)
        depth = np.abs(np.asarray(ds["PRES"].values, dtype=float))
        temp = np.asarray(ds["TEMP"].values, dtype=float)
        psal = np.asarray(ds["PSAL"].values, dtype=float)
        pos_qc = ds.get("POSITION_QC")
        qc = np.asarray(pos_qc.values, dtype=str) if pos_qc is not None else None
        temp_qc = ds.get("TEMP_QC")
        if temp_qc is None:
            temp_qc = ds.get("TEMP_ADJUSTED_QC")
        psal_qc = ds.get("PSAL_QC")
        if psal_qc is None:
            psal_qc = ds.get("PSAL_ADJUSTED_QC")
        good_temp = (
            np.char.find(np.asarray(temp_qc.values, dtype=str).astype(str), "1") >= 0
            if temp_qc is not None
            else np.ones_like(lat, dtype=bool)
        )
        good_psal = (
            np.char.find(np.asarray(psal_qc.values, dtype=str).astype(str), "1") >= 0
            if psal_qc is not None
            else np.ones_like(lat, dtype=bool)
        )
        time_vals = ds["TIME"].values
    except Exception as e:  # noqa: BLE001
        print(f"       ! could not read {nc_path.name}: {e}")
        return []

    good = (lat != 0.0) & (lon != 0.0) & np.isfinite(lat) & np.isfinite(lon)
    if qc is not None and qc.size:
        good &= np.char.find(qc.astype(str), "1") >= 0
    idx = np.where(good)[0]
    if idx.size == 0:
        return []
    step = max(1, idx.size // 200)
    picked = idx[::step]
    rows: list[list] = []
    for i in picked:
        t = time_vals[i]
        ts = str(t) if not hasattr(t, "isoformat") else t.isoformat()
        temp_val = float(temp[i]) if (np.isfinite(temp[i]) and good_temp[i]) else None
        psal_val = float(psal[i]) if (np.isfinite(psal[i]) and good_psal[i]) else None
        rows.append(
            [round(float(lon[i]), 4), round(float(lat[i]), 4),
             round(float(depth[i]), 1), temp_val, psal_val, str(ts).replace(" ", "T")]
        )
    return rows


if __name__ == "__main__":
    sys.exit(main())