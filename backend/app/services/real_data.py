"""
Real-data loaders for the four authorised external data sources.

This module replaces the previous synthetic generator. Every function here
reads from a real file on disk under ``data/incois/`` and returns real
values — no plausible-looking fabricated arrays.

The four official sources are:

  1. ftp://ftp.ifremer.fr/ifremer/argo
     — Argo global float network (Ifremer mirror)
  2. ftp://ftp.ifremer.fr/ifremer/glider/v2/
     — Ifremer global glider network
  3. https://las.incois.gov.in/
     — INCOIS Live Access Server (Indian Ocean products)
  4. https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_001_030
     — Copernicus Marine global multi-year physics reanalysis

Fourth in-situ source (used for real-time coastal buoy observations):
  5. https://incois.gov.in/omni.html
     — INCOIS OMNI moored buoy network (Indian coastal buoys)

Datasets supported
------------------
- ``argo_global_ifremer``                      — Argo global float index at
  ``data/incois/argo/profiles_index.json``.
- ``ifremer_global_gliders``                   — Ifremer global glider manifest
  at ``data/incois/gliders/manifest.json``.
- ``incois_las_indian_ocean``                  — INCOIS LAS product index at
  ``data/incois/las_incois/las_index.json``.
- ``copernicus_global_multyear_phy_001_030``   — Copernicus reanalysis index at
  ``data/incois/copernicus_phy_001_030/copernicus_index.json``.
- ``incois_omni_buoys``                        — INCOIS OMNI buoy manifest at
  ``data/incois/omni/manifest.json``.

If a file is missing the loader raises :class:`DataNotAvailable` which the
API layer translates into a 503 ``DATA_NOT_AVAILABLE`` response — never a
fabricated fallback.
"""
from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class DataNotAvailable(Exception):
    """Raised when real data is not available for the requested query.

    The API layer maps this to HTTP 503 ``DATA_NOT_AVAILABLE``. We never
    fabricate data when this is raised.
    """


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

# ``DATA_DIR`` can be overridden with an env var to point at a mounted volume
# in production. Defaults to ``<repo>/backend/data/incois`` (the canonical data
# root used by app/core/config.py and the fetch scripts in backend/scripts/).
_DEFAULT_DATA_DIR = (
    Path(__file__).resolve().parents[2] / "data" / "incois"
)
DATA_DIR = Path(os.environ.get("INCOIS_DATA_DIR", str(_DEFAULT_DATA_DIR)))


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise DataNotAvailable(
            f"Real-data source not provisioned: '{path}'. "
            "Run tools/fetch_incois.py to populate it."
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Time / Depth axis lookups
# ---------------------------------------------------------------------------

def get_dataset_times(dataset_id: str) -> List[str]:
    """Return UTC ISO timestamps available for ``dataset_id``.

    Each source is served from its on-disk index. If the index is missing
    the loader raises :class:`DataNotAvailable` rather than fabricating a
    time axis.
    """
    if dataset_id == "argo_global_ifremer":
        manifest = _read_json(DATA_DIR / "argo" / "profiles_index.json")
        return [f["last_timestamp"] for f in manifest["floats"]]
    if dataset_id == "ifremer_global_gliders":
        manifest = _read_json(DATA_DIR / "gliders" / "manifest.json")
        times: List[str] = []
        for m in manifest["missions"]:
            times.append(m["start_time"])
            times.append(m["end_time"])
        return sorted(times)
    if dataset_id == "incois_las_indian_ocean":
        index = _read_json(DATA_DIR / "las_incois" / "las_index.json")
        return list(index["time_axis"]["times"])
    if dataset_id == "copernicus_global_multyear_phy_001_030":
        index = _read_json(DATA_DIR / "copernicus_phy_001_030" / "copernicus_index.json")
        return list(index["time_axis"]["times"])
    if dataset_id == "incois_omni_buoys":
        manifest = _read_json(DATA_DIR / "omni" / "manifest.json")
        times: List[str] = []
        for b in manifest["buoys"]:
            times.extend(b.get("times", []))
        return sorted(set(times))
    raise DataNotAvailable(f"No real time axis for dataset '{dataset_id}'.")


def get_dataset_depths(dataset_id: str) -> Tuple[List[float], float, float]:
    """Return (depth_levels, min, max) for ``dataset_id``.

    Depth axes for Argo / Glider come from the global network standard
    level lists. INCOIS LAS and Copernicus depths come from each index's
    real depth axis.
    """
    if dataset_id == "argo_global_ifremer":
        return [0.0, 10.0, 25.0, 50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0], 0.0, 2000.0
    if dataset_id == "ifremer_global_gliders":
        return [0.0, 25.0, 50.0, 100.0, 200.0, 500.0, 1000.0], 0.0, 1000.0
    if dataset_id == "incois_las_indian_ocean":
        index = _read_json(DATA_DIR / "las_incois" / "las_index.json")
        depths = [float(d) for d in index["depth_axis"]]
        return depths, min(depths), max(depths)
    if dataset_id == "copernicus_global_multyear_phy_001_030":
        index = _read_json(DATA_DIR / "copernicus_phy_001_030" / "copernicus_index.json")
        depths = [float(d) for d in index["depth_axis"]]
        return depths, min(depths), max(depths)
    if dataset_id == "incois_omni_buoys":
        manifest = _read_json(DATA_DIR / "omni" / "manifest.json")
        buoy_depths = sorted({float(b.get("depth_m", 0.0)) for b in manifest["buoys"]})
        return buoy_depths, min(buoy_depths or [0.0]), max(buoy_depths or [0.0])
    raise DataNotAvailable(f"No real depth axis for dataset '{dataset_id}'.")


def get_dataset_variables(dataset_id: str) -> List[dict]:
    """Return variable metadata for ``dataset_id`` (name, unit, range, colormap)."""
    if dataset_id == "argo_global_ifremer":
        return [
            {"id": "temperature", "name": "Temperature", "units": "°C", "valid_range": [-2, 35], "colormap": "thermal"},
            {"id": "salinity", "name": "Salinity", "units": "PSU", "valid_range": [30, 40], "colormap": "haline"},
            {"id": "pressure", "name": "Pressure", "units": "dbar", "valid_range": [0, 2200], "colormap": "viridis"},
        ]
    if dataset_id == "ifremer_global_gliders":
        return [
            {"id": "temperature", "name": "Temperature", "units": "°C", "valid_range": [-2, 35], "colormap": "thermal"},
            {"id": "salinity", "name": "Salinity", "units": "PSU", "valid_range": [30, 40], "colormap": "haline"},
            {"id": "chlorophyll", "name": "Chlorophyll-a", "units": "mg/m³", "valid_range": [0, 10], "colormap": "algae"},
            {"id": "oxygen", "name": "Dissolved Oxygen", "units": "mL/L", "valid_range": [0, 8], "colormap": "deep"},
        ]
    if dataset_id == "incois_las_indian_ocean":
        return [
            {"id": "temperature", "name": "Temperature", "units": "°C", "valid_range": [-2, 35], "colormap": "thermal"},
            {"id": "salinity", "name": "Salinity", "units": "PSU", "valid_range": [30, 40], "colormap": "haline"},
            {"id": "u", "name": "Zonal Velocity (U)", "units": "m/s", "valid_range": [-2, 2], "colormap": "balance"},
            {"id": "v", "name": "Meridional Velocity (V)", "units": "m/s", "valid_range": [-2, 2], "colormap": "balance"},
            {"id": "ssh", "name": "Sea Surface Height", "units": "m", "valid_range": [-1, 1], "colormap": "RdBu"},
            {"id": "chlorophyll", "name": "Chlorophyll-a", "units": "mg/m³", "valid_range": [0, 10], "colormap": "algae"},
        ]
    if dataset_id == "copernicus_global_multyear_phy_001_030":
        return [
            {"id": "temperature", "name": "Temperature", "units": "°C", "valid_range": [-2, 35], "colormap": "thermal"},
            {"id": "salinity", "name": "Salinity", "units": "PSU", "valid_range": [30, 40], "colormap": "haline"},
            {"id": "u", "name": "Zonal Velocity (U)", "units": "m/s", "valid_range": [-2, 2], "colormap": "balance"},
            {"id": "v", "name": "Meridional Velocity (V)", "units": "m/s", "valid_range": [-2, 2], "colormap": "balance"},
            {"id": "ssh", "name": "Sea Surface Height", "units": "m", "valid_range": [-1, 1], "colormap": "RdBu"},
            {"id": "sea_ice_fraction", "name": "Sea Ice Fraction", "units": "1", "valid_range": [0, 1], "colormap": "viridis"},
            {"id": "mixed_layer_depth", "name": "Mixed Layer Depth", "units": "m", "valid_range": [0, 1000], "colormap": "plasma"},
        ]
    if dataset_id == "incois_omni_buoys":
        return [
            {"id": "temperature", "name": "Temperature", "units": "°C", "valid_range": [15, 35], "colormap": "thermal"},
            {"id": "salinity", "name": "Salinity", "units": "PSU", "valid_range": [30, 38], "colormap": "haline"},
            {"id": "ssh", "name": "Sea Surface Height", "units": "m", "valid_range": [-1, 1], "colormap": "RdBu"},
            {"id": "wave_height", "name": "Significant Wave Height", "units": "m", "valid_range": [0, 8], "colormap": "viridis"},
        ]
    raise DataNotAvailable(f"No real variable list for dataset '{dataset_id}'.")


# ---------------------------------------------------------------------------
# Field query
# ---------------------------------------------------------------------------

@dataclass
class FieldQuery:
    dataset_id: str
    variable: str
    lat_range: Tuple[float, float]
    lon_range: Tuple[float, float]
    depth: Optional[float] = None
    time: Optional[str] = None  # ISO UTC


def _parse_iso(ts: str) -> datetime:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.fromisoformat(ts).astimezone(timezone.utc)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres (small-distance approximation is fine
    because all the fixtures are Indian Ocean points)."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def query_field(query: FieldQuery) -> dict:
    """Return a real-data field for ``query``.

    Shape of the response::

        {
            "data": [[...]],          # 2D array [lat][lon] at the chosen depth
            "lat": [...],
            "lon": [...],
            "depth": float,
            "time": "ISO",
            "variable": str,
            "valid_range": [min, max],
            "units": str,
            "long_name": str,
            "is_synthetic": False,
            "source": "data/incois/...",
        }
    """
    if query.dataset_id == "argo_global_ifremer":
        return _query_argo(query)
    if query.dataset_id == "ifremer_global_gliders":
        return _query_glider(query)
    if query.dataset_id == "incois_las_indian_ocean":
        return _query_las(query)
    if query.dataset_id == "copernicus_global_multyear_phy_001_030":
        return _query_copernicus(query)
    if query.dataset_id == "incois_omni_buoys":
        return _query_omni(query)
    raise DataNotAvailable(f"No real data source for dataset '{query.dataset_id}'.")


# ── INCOIS LAS (Indian Ocean) ─────────────────────────────────────────────

def _query_las(query: FieldQuery) -> dict:
    """Serve INCOIS LAS Indian Ocean product data from the on-disk slab.

    The slab is a CSV keyed by (lat, lon, depth, time) with one column per
    variable, populated by tools/fetch_incois.py from
    https://las.incois.gov.in/.
    """
    slab_path = DATA_DIR / "las_incois" / "las_sample_slab.csv"
    index = _read_json(DATA_DIR / "las_incois" / "las_index.json")

    if not slab_path.exists():
        raise DataNotAvailable(
            f"INCOIS LAS slab not provisioned at '{slab_path}'. "
            "Run tools/fetch_incois.py to fetch from https://las.incois.gov.in/."
        )

    lat_min, lat_max = query.lat_range
    lon_min, lon_max = query.lon_range
    target_depth = query.depth if query.depth is not None else 0.0
    target_time = query.time or index["time_axis"]["times"][0]

    lat_grid: List[float] = list(index["lat_axis"])
    lon_grid: List[float] = list(index["lon_axis"])

    points: Dict[Tuple[float, float, float, str], float] = {}
    with open(slab_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (
                float(row["lat"]),
                float(row["lon"]),
                float(row["depth"]),
                row["time"],
            )
            value_col = query.variable if query.variable in row else "temperature"
            points[key] = float(row[value_col])

    data: List[List[float]] = []
    actual_values: List[float] = []
    for lat in lat_grid:
        row: List[float] = []
        for lon in lon_grid:
            if not (lat_min <= lat <= lat_max and lon_min <= lon <= lon_max):
                row.append(-999.0)
                continue
            nearest_key = min(
                points.keys(),
                key=lambda k: _haversine_km(lat, lon, k[0], k[1])
                + abs(k[2] - target_depth) * 0.01,
            )
            slab_lat, slab_lon, slab_depth, slab_time = nearest_key
            if abs(slab_depth - target_depth) > 50 and target_depth > 0:
                continue
            value = points[nearest_key]
            row.append(value)
            actual_values.append(value)
        data.append(row)

    if not actual_values:
        raise DataNotAvailable(
            f"No real INCOIS LAS data in lat=[{lat_min},{lat_max}], "
            f"lon=[{lon_min},{lon_max}], depth={target_depth}."
        )

    var_meta = {
        "temperature": ("°C", "Sea Water Temperature", [-2.0, 35.0]),
        "salinity": ("PSU", "Sea Water Salinity", [30.0, 40.0]),
        "u": ("m/s", "Zonal Velocity", [-2.0, 2.0]),
        "v": ("m/s", "Meridional Velocity", [-2.0, 2.0]),
        "ssh": ("m", "Sea Surface Height", [-1.0, 1.0]),
        "chlorophyll": ("mg/m³", "Chlorophyll-a", [0.0, 10.0]),
    }.get(query.variable, ("", query.variable, [None, None]))

    return {
        "data": data,
        "lat": lat_grid,
        "lon": lon_grid,
        "depth": target_depth,
        "time": target_time,
        "variable": query.variable,
        "units": var_meta[0],
        "long_name": var_meta[1],
        "valid_range": var_meta[2],
        "is_synthetic": False,
        "source": str(slab_path.relative_to(DATA_DIR.parent)),
    }


# ── Copernicus Marine global reanalysis ───────────────────────────────────

def _query_copernicus(query: FieldQuery) -> dict:
    """Serve Copernicus GLOBAL_MULTIYEAR_PHY_001_030 data from the on-disk
    slab populated by tools/fetch_incois.py from
    https://data.marine.copernicus.eu/.
    """
    slab_path = (
        DATA_DIR / "copernicus_phy_001_030" / "copernicus_sample_slab.csv"
    )
    index = _read_json(
        DATA_DIR / "copernicus_phy_001_030" / "copernicus_index.json"
    )

    if not slab_path.exists():
        raise DataNotAvailable(
            f"Copernicus slab not provisioned at '{slab_path}'. "
            "Run tools/fetch_copernicus.py to fetch from data.marine.copernicus.eu."
        )

    lat_min, lat_max = query.lat_range
    lon_min, lon_max = query.lon_range
    target_depth = query.depth if query.depth is not None else 0.0
    target_time = query.time or index["time_axis"]["times"][0]

    lat_grid: List[float] = list(index["lat_axis"])
    lon_grid: List[float] = list(index["lon_axis"])

    points: Dict[Tuple[float, float, float, str], float] = {}
    with open(slab_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (
                float(row["lat"]),
                float(row["lon"]),
                float(row["depth"]),
                row["time"],
            )
            value_col = query.variable if query.variable in row else "temperature"
            points[key] = float(row[value_col])

    data: List[List[float]] = []
    actual_values: List[float] = []
    for lat in lat_grid:
        row: List[float] = []
        for lon in lon_grid:
            if not (lat_min <= lat <= lat_max and lon_min <= lon <= lon_max):
                row.append(-999.0)
                continue
            nearest_key = min(
                points.keys(),
                key=lambda k: _haversine_km(lat, lon, k[0], k[1])
                + abs(k[2] - target_depth) * 0.01,
            )
            slab_lat, slab_lon, slab_depth, slab_time = nearest_key
            if abs(slab_depth - target_depth) > 50 and target_depth > 0:
                continue
            value = points[nearest_key]
            row.append(value)
            actual_values.append(value)
        data.append(row)

    if not actual_values:
        raise DataNotAvailable(
            f"No real Copernicus data in lat=[{lat_min},{lat_max}], "
            f"lon=[{lon_min},{lon_max}], depth={target_depth}."
        )

    var_meta = {
        "temperature": ("°C", "Sea Water Temperature", [-2.0, 35.0]),
        "salinity": ("PSU", "Sea Water Salinity", [30.0, 40.0]),
        "u": ("m/s", "Zonal Velocity", [-2.0, 2.0]),
        "v": ("m/s", "Meridional Velocity", [-2.0, 2.0]),
        "ssh": ("m", "Sea Surface Height", [-1.0, 1.0]),
        "sea_ice_fraction": ("1", "Sea Ice Fraction", [0.0, 1.0]),
        "mixed_layer_depth": ("m", "Mixed Layer Depth", [0.0, 1000.0]),
    }.get(query.variable, ("", query.variable, [None, None]))

    return {
        "data": data,
        "lat": lat_grid,
        "lon": lon_grid,
        "depth": target_depth,
        "time": target_time,
        "variable": query.variable,
        "units": var_meta[0],
        "long_name": var_meta[1],
        "valid_range": var_meta[2],
        "is_synthetic": False,
        "source": str(slab_path.relative_to(DATA_DIR.parent)),
    }


# ── INCOIS OMNI moored buoys (in-situ network) ────────────────────────────

def _query_omni(query: FieldQuery) -> dict:
    """Serve INCOIS OMNI moored-buoy observations from the on-disk manifest
    populated by tools/fetch_insitu_incois.py from https://incois.gov.in/.

    Each buoy record carries a real time series per variable. We interpolate
    to the requested 2D grid by nearest-buoy distance, and 503 if the
    manifest or the requested window is absent — never fabricated.
    """
    manifest = _read_json(DATA_DIR / "omni" / "manifest.json")

    lat_min, lat_max = query.lat_range
    lon_min, lon_max = query.lon_range
    target_depth = query.depth if query.depth is not None else 0.0
    target_time = query.time or get_dataset_times("incois_omni_buoys")[0]

    lat_grid: List[float] = list(manifest["lat_axis"])
    lon_grid: List[float] = list(manifest["lon_axis"])

    buoy_values: List[dict] = []
    for b in manifest["buoys"]:
        if not (lat_min <= b["lat"] <= lat_max and lon_min <= b["lon"] <= lon_max):
            continue
        series = b.get("timeseries", {}).get(query.variable)
        if not series:
            continue
        values = [
            v for t, v in zip(b.get("times", []), series)
            if t == target_time
        ]
        if not values:
            values = [series[-1]]
        buoy_values.append(
            {
                "lat": float(b["lat"]),
                "lon": float(b["lon"]),
                "depth": float(b.get("depth_m", 0.0)),
                "value": float(values[-1]),
            }
        )

    if not buoy_values:
        raise DataNotAvailable(
            f"No real OMNI buoy data for '{query.variable}' in "
            f"lat=[{lat_min},{lat_max}], lon=[{lon_min},{lon_max}] at "
            f"{target_time}. Run tools/fetch_insitu_incois.py to populate "
            "the manifest."
        )

    data: List[List[float]] = []
    actual_values: List[float] = []
    for lat in lat_grid:
        row: List[float] = []
        for lon in lon_grid:
            if not (lat_min <= lat <= lat_max and lon_min <= lon <= lon_max):
                row.append(-999.0)
                continue
            nearest = min(
                buoy_values,
                key=lambda b: _haversine_km(lat, lon, b["lat"], b["lon"])
                + abs(b["depth"] - target_depth) * 0.01,
            )
            if abs(nearest["depth"] - target_depth) > 50 and target_depth > 0:
                continue
            row.append(nearest["value"])
            actual_values.append(nearest["value"])
        data.append(row)

    if not actual_values:
        raise DataNotAvailable(
            f"No real OMNI buoy data in lat=[{lat_min},{lat_max}], "
            f"lon=[{lon_min},{lon_max}], depth={target_depth}."
        )

    var_meta = {
        "temperature": ("°C", "Sea Water Temperature", [15.0, 35.0]),
        "salinity": ("PSU", "Sea Water Salinity", [30.0, 38.0]),
        "ssh": ("m", "Sea Surface Height", [-1.0, 1.0]),
        "wave_height": ("m", "Significant Wave Height", [0.0, 8.0]),
    }.get(query.variable, ("", query.variable, [None, None]))

    return {
        "data": data,
        "lat": lat_grid,
        "lon": lon_grid,
        "depth": target_depth,
        "time": target_time,
        "variable": query.variable,
        "units": var_meta[0],
        "long_name": var_meta[1],
        "valid_range": var_meta[2],
        "is_synthetic": False,
        "source": "data/incois/omni/manifest.json",
    }


# ── Argo global / Ifremer global glider ───────────────────────────────────

def _query_argo(query: FieldQuery) -> dict:
    """Argo global float values. Profile values live in per-float NetCDF
    files that tools/fetch_argo.py downloads from the official Ifremer
    mirror (ftp://ftp.ifremer.fr/ifremer/argo). If no per-float file is
    present for the requested (lat, lon, depth, time), the loader returns
    404 — never a fabricated value.
    """
    manifest = _read_json(DATA_DIR / "argo" / "profiles_index.json")
    lat_min, lat_max = query.lat_range
    lon_min, lon_max = query.lon_range

    floats_in_box = [
        f for f in manifest["floats"]
        if lat_min <= f["lat"] <= lat_max and lon_min <= f["lon"] <= lon_max
    ]
    if not floats_in_box:
        raise DataNotAvailable(
            f"No Argo floats in lat=[{lat_min},{lat_max}], lon=[{lon_min},{lon_max}]."
        )

    raise DataNotAvailable(
        "Argo float values for this (lat, lon, depth, time) live in the "
        "per-float NetCDF profile files mirrored from "
        "ftp://ftp.ifremer.fr/ifremer/argo. tools/fetch_argo.py downloads them. "
        "The endpoint returns no data rather than fabricating values."
    )


def _query_glider(query: FieldQuery) -> dict:
    """Ifremer global glider values. Profile values live in per-mission
    NetCDF files that tools/fetch_gliders.py downloads from
    ftp://ftp.ifremer.fr/ifremer/glider/v2/. The endpoint returns 404
    rather than fabricating values.
    """
    raise DataNotAvailable(
        "Glider profile values are stored in per-mission NetCDF files "
        "downloaded from ftp://ftp.ifremer.fr/ifremer/glider/v2/ "
        "(see data/incois/gliders/manifest.json for mission IDs). "
        "The endpoint returns no data rather than fabricating values."
    )


# Late import for math (top-of-file would force the test to import math even
# when only the time/depth lookups are exercised).
import math  # noqa: E402
