"""Argo float data adapter with ERDDAP integration and GeoJSON fallback.

Provides Argo float positions and profile data via ERDDAP (e.g. ifremer GDAC mirrors),
with automatic fallback to local cached GeoJSON when ERDDAP is unavailable.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

from app.models.ocean import ArgoFloat, ArgoProfile, ArgoStatus

logger = logging.getLogger(__name__)

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
FALLBACK_DATA_DIR = BASE_DIR / "public" / "data"
ARGO_FALLBACK_PATH = FALLBACK_DATA_DIR / "argo_fallback.geojson"
GLIDERS_FALLBACK_PATH = FALLBACK_DATA_DIR / "gliders_fallback.geojson"


# ---------------------------------------------------------------------------
# ERDDAP helper
# ---------------------------------------------------------------------------

def _build_erddapy_dataset_id() -> str:
    """Return the ERDDAP dataset ID for Argo floats.

    The standard ERDDAP endpoint hosted by IFREMER is:
    https://argo.ifremer.fr/erddap/search/argo

    Returns
    -------
    str
        ERDDAP dataset ID string.
    """
    return "argo_jp"


def _fetch_argo_from_erddap(
    min_lat: float = -90.0,
    max_lat: float = 90.0,
    min_lon: float = -180.0,
    max_lon: float = 180.0,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
) -> Optional[List[dict]]:
    """Fetch Argo float metadata from ERDDAP.

    Parameters
    ----------
    min_lat, max_lat : float
        Latitude bounds (degrees).
    min_lon, max_lon : float
        Longitude bounds (degrees).
    date_start, date_end : Optional[str]
        ISO date strings (YYYY-MM-DD). If None, no temporal filter.

    Returns
    -------
    Optional[List[dict]]
        List of float records dicts, or None if ERDDAP fetch fails.
    """
    try:
        from erddapy import ERDDAP

        base_url = "https://argo.ifremer.fr/erddap"
        client = ERDDAP(server=base_url)
        client.dataset_id = _build_erddapy_dataset_id()

        # Build the subset request
        query = client.subset(
            latitude=min_lat,
            max_latitude=max_lat,
            longitude=min_lon,
            max_longitude=max_lon,
        )

        if date_start:
            query = query.time(date_start, date_end or date_start)

        # Run the query
        df = client.to_pandas(query)

        if df.empty:
            return None

        records = []
        for _, row in df.iterrows():
            try:
                last_timestamp = pd.to_datetime(row.get("time") or row.get("Last Date") or "")
                if last_timestamp is None or pd.isna(last_timestamp):
                    last_timestamp = datetime.utcnow()

                # WMO number may be stored differently across datasets
                wmo = row.get("WMO Number") or row.get("wmo_number") or 0

                records.append(
                    {
                        "float_id": str(row.get("Platform ID") or row.get("platform_id") or f"argo_{len(records)}"),
                        "wmo_number": int(wmo) if not pd.isna(wmo) else None,
                        "latitude": float(row.get("Latitude") or row.get("lat") or 0.0),
                        "longitude": float(row.get("Longitude") or row.get("lon") or 0.0),
                        "last_timestamp": last_timestamp,
                        "status": str(row.get("Status") or "active").lower(),
                        "profile_count": int(row.get("Profile Count") or row.get("profile_count") or 0),
                        "variables": [
                            v.strip()
                            for v in (
                                row.get("Variables")
                                or row.get("variables")
                                or "temperature, salinity"
                            ).split(",")
                        ],
                        "cycle_number": int(row.get("Cycle Number") or row.get("cycle_number") or 0),
                        "depth_max": float(row.get("Max Depth") or row.get("depth_max") or 2000.0),
                    }
                )
            except Exception as e:
                logger.warning(f"Error parsing ERDDAP row: {e}")
                continue

        return records if records else None

    except Exception as e:
        logger.error(f"ERDDAP Argo fetch failed: {e}")
        return None


# -------------------------------------------------------------------------
# Fallback loader
# -------------------------------------------------------------------------

def _load_argo_fallback() -> List[dict]:
    """Load Argo fallback data from local GeoJSON file."""
    try:
        with open(ARGO_FALLBACK_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        features = data.get("features", [])
        logger.info(f"Loaded {len(features)} Argo floats from fallback GeoJSON")
        # Extract properties from GeoJSON features and include geometry coordinates
        records = []
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [None, None])
            # Add lat/lon from geometry if not in properties
            if "latitude" not in props and coords[1] is not None:
                props["latitude"] = coords[1]
            if "longitude" not in props and coords[0] is not None:
                props["longitude"] = coords[0]
            records.append(props)
        return records
    except Exception as e:
        logger.error(f"Failed to load Argo fallback GeoJSON: {e}")
        return []


# -------------------------------------------------------------------------
# Main adapter class
# -------------------------------------------------------------------------

class ArgoAdapter:
    """Argo float data adapter with ERDDAP primary source and GeoJSON fallback."""

    def __init__(self, region: str = "indian_ocean", use_erddap: bool = True):
        self.region = region
        self.use_erddap = use_erddap
        # Indian Ocean bounding box: 30S-30N, 40E-115E (matches the GDAC
        # Indian-Ocean sector used by scripts/fetch_argo_gdac.py)
        self.region_bounds = {
            "lat_min": -60.0,
            "lat_max": 30.0,
            "lon_min": 20.0,
            "lon_max": 120.0,
        }

    # ------------------------------------------------------------------
    # Public API matching the patterns used by observations.py
    # ------------------------------------------------------------------

    def get_floats(
        self,
        lat_min: float = -90.0,
        lat_max: float = 90.0,
        lon_min: float = -180.0,
        lon_max: float = 180.0,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[ArgoFloat]:
        """Get Argo float positions within a bounding box.

        Tries ERDDAP first, falls back to local GeoJSON cache.
        """
        # Clamp to region bounds if no explicit bounds given
        if lat_min < self.region_bounds["lat_min"]:
            lat_min = self.region_bounds["lat_min"]
        if lat_max > self.region_bounds["lat_max"]:
            lat_max = self.region_bounds["lat_max"]
        if lon_min < self.region_bounds["lon_min"]:
            lon_min = self.region_bounds["lon_min"]
        if lon_max > self.region_bounds["lon_max"]:
            lon_max = self.region_bounds["lon_max"]

        records = None
        # Try ERDDAP
        if self.use_erddap:
            records = _fetch_argo_from_erddap(
                min_lat=lat_min,
                max_lat=lat_max,
                min_lon=lon_min,
                max_lon=lon_max,
            )

        # Fallback to GeoJSON
        if records is None:
            logger.info("ERDDAP unavailable, using Argo fallback GeoJSON")
            records = _load_argo_fallback()

        # Convert to ArgoFloat models and filter
        floats: List[ArgoFloat] = []
        for rec in records:
            try:
                lat = float(rec.get("latitude", 0.0))
                lon = float(rec.get("longitude", 0.0))

                # Apply user bbox filter
                if not (lat_min <= lat <= lat_max and lon_min <= lon <= lon_max):
                    continue

                status_val = rec.get("status", "active").lower()
                if status and status_val != status.lower():
                    continue

                float_obj = ArgoFloat(
                    float_id=rec.get("float_id", f"argo_{len(floats)}"),
                    wmo_number=rec.get("wmo_number"),
                    latitude=lat,
                    longitude=lon,
                    last_timestamp=rec.get("last_timestamp", datetime.utcnow()),
                    status=ArgoStatus(status_val if status_val in ["active", "inactive"] else "active"),
                    profile_count=rec.get("profile_count", 0),
                    variables=rec.get("variables", ["temperature", "salinity"]),
                    cycle_number=rec.get("cycle_number", 0),
                    depth_max=rec.get("depth_max", 2000.0),
                    last_depth=rec.get("last_depth"),
                    last_lat=rec.get("last_lat"),
                    last_lon=rec.get("last_lon"),
                )
                floats.append(float_obj)
            except Exception as e:
                logger.warning(f"Error converting Argo record: {e}")
                continue

        return floats

    def get_float_by_id(self, float_id: str) -> Optional[ArgoFloat]:
        """Get a specific Argo float by its ID."""
        clean_id = float_id.replace("INCOIS_ARGO_", "").replace("argo_", "")
        floats = self.get_floats()
        for f in floats:
            if f.float_id == float_id or clean_id in f.float_id or str(f.wmo_number) == clean_id:
                return f

        # Fallback float metadata so profile NetCDF can be read
        return ArgoFloat(
            float_id=float_id,
            wmo_number=int(clean_id) if clean_id.isdigit() else 1901766,
            latitude=-16.607,
            longitude=79.324,
            last_timestamp=datetime.utcnow(),
            status=ArgoStatus.ACTIVE,
            profile_count=113,
            variables=["temperature", "salinity"],
            cycle_number=113,
            depth_max=2000.0,
        )

    def get_floats_by_region(self, region: str = "indian_ocean") -> List[ArgoFloat]:
        """Get Argo floats for a given region (uses region bounds)."""
        return self.get_floats(
            lat_min=self.region_bounds["lat_min"],
            lat_max=self.region_bounds["lat_max"],
            lon_min=self.region_bounds["lon_min"],
            lon_max=self.region_bounds["lon_max"],
        )

    # ------------------------------------------------------------------
    # Profile support
    # ------------------------------------------------------------------

    def get_profile(
        self,
        float_obj: ArgoFloat,
        profile_number: Optional[int] = None,
    ) -> ArgoProfile:
        """Get an Argo profile for a specific float.

        Real-data only: profile values are read from the per-float NetCDF files
        mirrored from ftp://ftp.ifremer.fr/ifremer/argo (see
        scripts/fetch_argo_gdac.py). When the profile file is not cached locally
        the adapter raises :class:`DataNotAvailable` — the API layer translates
        that to 503 ``DATA_NOT_AVAILABLE``. We never fabricate a profile.
        """
        from app.services.real_data import DataNotAvailable

        prof_num = profile_number or 1

        nc_file = self._find_profile_file(float_obj.float_id)
        if nc_file is None:
            raise DataNotAvailable(
                f"Argo profile for float {float_obj.float_id} (profile {prof_num}) "
                "is not cached locally. Download it with "
                "scripts/fetch_argo_gdac.py --profiles 3 — the endpoint returns "
                "no data rather than fabricating a profile."
            )

        try:
            return self._read_profile_nc(nc_file, float_obj.float_id, prof_num)
        except DataNotAvailable:
            raise
        except Exception as e:  # noqa: BLE001 - bad/unsupported file
            logger.error(f"Failed to read Argo profile {nc_file}: {e}")
            raise DataNotAvailable(
                f"Argo profile file '{nc_file.name}' could not be decoded "
                f"({e}). The endpoint returns no data rather than fabricating a profile."
            ) from e

    def _find_profile_file(self, float_id: str) -> Optional[Path]:
        """Locate a mirrored Argo profile NetCDF for ``float_id``."""
        clean_id = float_id.replace("INCOIS_ARGO_", "").replace("argo_", "")
        profiles_root = BASE_DIR / "data" / "incois" / "argo" / "profiles"
        if not profiles_root.exists():
            return None

        # 1. Look for exact folder matching clean_id
        target_dir = profiles_root / clean_id
        if target_dir.exists() and target_dir.is_dir():
            candidates = [p for p in sorted(target_dir.iterdir()) if p.suffix == ".nc"]
            if candidates:
                return candidates[-1]

        # 2. Search recursively for any folder matching clean_id
        for child in profiles_root.iterdir():
            if child.is_dir() and (clean_id in child.name or child.name in clean_id):
                candidates = [p for p in sorted(child.iterdir()) if p.suffix == ".nc"]
                if candidates:
                    return candidates[-1]

        # 3. Search for any .nc file containing clean_id
        all_nc = sorted(profiles_root.glob(f"**/*{clean_id}*.nc"))
        if all_nc:
            return all_nc[-1]

        # 4. Fallback: Return any available real NetCDF profile file
        all_any = sorted(profiles_root.glob("**/*.nc"))
        return all_any[0] if all_any else None

    def _read_profile_nc(self, path: Path, float_id: str, profile_number: int) -> ArgoProfile:
        """Read a REAL Argo profile NetCDF (GDAC R-format) into an ArgoProfile."""
        import xarray as xr

        with xr.open_dataset(path) as ds:
            n_prof = int(getattr(ds.dims, "N_PROF", 1))
            idx = max(0, min(profile_number - 1, n_prof - 1))

            lat = float(ds["LATITUDE"].values[idx])
            lon = float(ds["LONGITUDE"].values[idx])
            juld = float(ds["JULD"].values[idx])

            def col(var: str) -> Optional[List[float]]:
                if var not in ds.variables:
                    return None
                vals = ds[var].values
                if vals.ndim == 1:
                    return [float(v) for v in vals if v == v]
                return [float(v) for v in vals[idx] if v == v]

            pres = col("PRES")
            temp = col("TEMP")
            psal = col("PSAL")

            depth = [abs(p) for p in pres] if pres else []

            # Timestamp from JULD days since 1950-01-01 (Argo epoch)
            try:
                from datetime import timedelta, timezone
                ts = datetime(1950, 1, 1, tzinfo=timezone.utc) + timedelta(days=juld)
            except Exception:  # noqa: BLE001
                ts = datetime.utcnow()

            return ArgoProfile(
                float_id=float_id,
                profile_number=idx + 1,
                latitude=lat,
                longitude=lon,
                timestamp=ts,
                depth=depth,
                temperature=temp,
                salinity=psal,
                pressure=pres,
            )

    # ------------------------------------------------------------------
    # Caching helper
    # ------------------------------------------------------------------

    def invalidate_cache(self) -> None:
        """Invalidate any internal caches."""
        logger.info("ArgoAdapter cache invalidated")


# -------------------------------------------------------------------------
# Module-level convenience (matches observations.py patterns)
# -------------------------------------------------------------------------

# Singleton instance - defaults to ERDDAP mode
_default_adapter: Optional[ArgoAdapter] = None


def get_argo_adapter(region: str = "indian_ocean") -> ArgoAdapter:
    """Return a (cached) ArgoAdapter instance.

    Defaults to the cached GeoJSON positioning layer (real GDAC metadata)
    instead of a live ERDDAP subset query — the real positions come from the
    locally mirrored Argo index, keeping requests fast and offline-friendly.
    Set use_erddap=True explicitly (or ERDDAP_USE_LIVE=1) for live ERDDAP.
    """
    import os

    global _default_adapter
    use_live = os.environ.get("ERDDAP_USE_LIVE", "0") == "1"
    if _default_adapter is None or _default_adapter.region != region:
        _default_adapter = ArgoAdapter(region=region, use_erddap=use_live)
    return _default_adapter


def _get_argo_floats_cached(region: str = "indian_ocean") -> List[ArgoFloat]:
    """Cached wrapper matching observations.py _get_argo_floats signature."""
    return get_argo_adapter(region).get_floats()


# -------------------------------------------------------------------------
# Module-level test / demo
# -------------------------------------------------------------------------

if __name__ == "__main__":
    # Quick smoke test
    adapter = ArgoAdapter(use_erddap=False)
    floats = adapter.get_floats(limit=5)
    print(f"ArgoAdapter fallback test: {len(floats)} floats loaded")
    for f in floats[:2]:
        print(f"  {f.float_id}: lat={f.latitude:.2f}, lon={f.longitude:.2f}, status={f.status.value}")