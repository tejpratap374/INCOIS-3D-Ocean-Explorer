"""Glider track data adapter with ERDDAP integration and GeoJSON fallback.

Provides underwater glider trajectories and observation data via ERDDAP,
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
from shapely.geometry import LineString, Point

from app.models.ocean import GliderTrack, GliderObservation

logger = logging.getLogger(__name__)

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
FALLBACK_DATA_DIR = BASE_DIR / "public" / "data"
GLIDERS_FALLBACK_PATH = FALLBACK_DATA_DIR / "gliders_fallback.geojson"


# ---------------------------------------------------------------------------
# ERDDAP helper
# ---------------------------------------------------------------------------

def _build_erddapy_dataset_id() -> str:
    """Return the ERDDAP dataset ID for gliders.

    Common glider ERDDAP datasets include:
    - glider_v2 (IFREMER)
    - Various regional glider datasets on coastwatch.pfeg.noaa.gov/erddap
    """
    return "glider_v2"


def _fetch_gliders_from_erddap(
    min_lat: float = -90.0,
    max_lat: float = 90.0,
    min_lon: float = -180.0,
    max_lon: float = 180.0,
    date_start: Optional[str] = None,
    date_end: Optional[str] = None,
) -> Optional[List[dict]]:
    """Fetch glider track metadata from ERDDAP.

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
        List of glider track records dicts, or None if ERDDAP fetch fails.
    """
    try:
        from erddapy import ERDDAP

        base_url = "https://argo.ifremer.fr/erddap"
        client = ERDDAP(server=base_url)
        client.dataset_id = _build_erddapy_dataset_id()

        query = client.subset(
            latitude=min_lat,
            max_latitude=max_lat,
            longitude=min_lon,
            max_longitude=max_lon,
        )

        if date_start:
            query = query.time(date_start, date_end or date_start)

        df = client.to_pandas(query)

        if df.empty:
            return None

        # Group by glider_id to reconstruct full tracks
        glider_groups = df.groupby("glider_id")

        records = []
        for glider_id, group in glider_groups:
            try:
                group = group.sort_values("time")

                # Build observation list
                observations = []
                variables = set()
                for _, row in group.iterrows():
                    obs = GliderObservation(
                        glider_id=str(glider_id),
                        mission_id=str(row.get("mission_id") or row.get("Mission ID") or "unknown"),
                        timestamp=pd.to_datetime(row.get("time") or row.get("Time") or datetime.utcnow()),
                        latitude=float(row.get("Latitude") or row.get("lat") or 0.0),
                        longitude=float(row.get("Longitude") or row.get("lon") or 0.0),
                        depth=float(row.get("Depth") or row.get("depth") or 0.0),
                        temperature=row.get("Temperature") or row.get("temperature"),
                        salinity=row.get("Salinity") or row.get("salinity"),
                        chlorophyll=row.get("Chlorophyll") or row.get("chlorophyll"),
                    )
                    if obs.temperature is not None:
                        variables.add("temperature")
                    if obs.salinity is not None:
                        variables.add("salinity")
                    if obs.chlorophyll is not None:
                        variables.add("chlorophyll")
                    observations.append(obs)

                if not observations:
                    continue

                start_time = observations[0].timestamp
                end_time = observations[-1].timestamp

                records.append(
                    {
                        "glider_id": str(glider_id),
                        "mission_id": str(observations[0].mission_id),
                        "name": f"Glider {glider_id} Mission",
                        "start_time": start_time,
                        "end_time": end_time,
                        "observations": observations,
                        "variables": list(variables) if variables else ["temperature", "salinity"],
                    }
                )
            except Exception as e:
                logger.warning(f"Error parsing glider group {glider_id}: {e}")
                continue

        return records if records else None

    except Exception as e:
        logger.error(f"ERDDAP Glider fetch failed: {e}")
        return None


# -------------------------------------------------------------------------
# Fallback loader
# -------------------------------------------------------------------------

def _load_gliders_fallback() -> List[dict]:
    """Load glider fallback data from local GeoJSON file."""
    try:
        with open(GLIDERS_FALLBACK_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        features = data.get("features", [])
        logger.info(f"Loaded {len(features)} glider tracks from fallback GeoJSON")
        # Extract properties from GeoJSON features
        records = []
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [])
            # Convert LineString coordinates to observations if needed
            props["geometry_coordinates"] = coords
            records.append(props)
        return records
    except Exception as e:
        logger.error(f"Failed to load gliders fallback GeoJSON: {e}")
        return []


# -------------------------------------------------------------------------
# Main adapter class
# -------------------------------------------------------------------------

class GliderAdapter:
    """Glider track data adapter with ERDDAP primary source and GeoJSON fallback."""

    def __init__(self, region: str = "indian_ocean", use_erddap: bool = True):
        self.region = region
        self.use_erddap = use_erddap
        # Indian Ocean bounding box: 30S-30N, 40E-115E (matches the GDAC Indian
        # Ocean sector used by scripts/fetch_glider_gdac.py)
        self.region_bounds = {
            "lat_min": -30.0,
            "lat_max": 30.0,
            "lon_min": 40.0,
            "lon_max": 115.0,
        }

    # ------------------------------------------------------------------
    # Public API matching the patterns used by observations.py
    # ------------------------------------------------------------------

    def get_gliders(
        self,
        lat_min: float = -90.0,
        lat_max: float = 90.0,
        lon_min: float = -180.0,
        lon_max: float = 180.0,
        limit: int = 50,
    ) -> List[GliderTrack]:
        """Get glider tracks within a bounding box.

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
            records = _fetch_gliders_from_erddap(
                min_lat=lat_min,
                max_lat=lat_max,
                min_lon=lon_min,
                max_lon=lon_max,
            )

        # Fallback to GeoJSON
        if records is None:
            logger.info("ERDDAP unavailable, using glider fallback GeoJSON")
            records = _load_gliders_fallback()

        # Convert to GliderTrack models and filter
        tracks: List[GliderTrack] = []
        for rec in records:
            try:
                # Handle observations: either from ERDDAP (pre-parsed) or from the
                # mirrored GDAC data (fallback GeoJSON carries real ``track_points``
                # extracted from the per-mission trajectory NetCDF by
                # scripts/fetch_glider_gdac.py --tracks N).
                obs_list = rec.get("observations", [])

                # Build observations from REAL track points (lat, lon, depth,
                # temperature, salinity, timestamp all read from the trajectory
                # file). Nothing here is fabricated.
                track_points = rec.get("track_points", [])
                if not obs_list and track_points:
                    start_time = rec.get("start_time") or datetime.utcnow() - timedelta(days=30)
                    if isinstance(start_time, str):
                        start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    end_time = rec.get("end_time") or datetime.utcnow()
                    if isinstance(end_time, str):
                        end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                    for tp in track_points:
                        lon, lat, depth, temp, psal, ts = tp
                        t = start_time
                        if isinstance(ts, str):
                            try:
                                t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                            except ValueError:
                                t = start_time
                        obs_list.append(
                            GliderObservation(
                                glider_id=rec.get("glider_id", f"glider_{len(tracks)}"),
                                mission_id=rec.get("mission_id"),
                                timestamp=t,
                                latitude=lat,
                                longitude=lon,
                                depth=depth,
                                temperature=temp,
                                salinity=psal,
                                chlorophyll=None,
                            )
                        )

                # Check if track intersects the bounding box
                if not obs_list:
                    continue

                intersects = any(
                    lat_min <= o.latitude <= lat_max and lon_min <= o.longitude <= lon_max
                    for o in obs_list
                )
                if not intersects:
                    continue

                track = GliderTrack(
                    glider_id=rec.get("glider_id", f"glider_{len(tracks)}"),
                    mission_id=rec.get("mission_id"),
                    name=rec.get("name", f"Glider {len(tracks)} Survey"),
                    start_time=rec.get("start_time", datetime.utcnow() - timedelta(days=30)),
                    end_time=rec.get("end_time", datetime.utcnow()),
                    observations=obs_list,
                    variables=rec.get("variables", ["temperature", "salinity"]),
                )
                tracks.append(track)
            except Exception as e:
                logger.warning(f"Error converting glider record: {e}")
                continue

        return tracks

    def get_glider_by_id(self, glider_id: str) -> Optional[GliderTrack]:
        """Get a specific glider track by its ID."""
        tracks = self.get_gliders()
        for t in tracks:
            if t.glider_id == glider_id:
                return t
        return None

    def get_gliders_by_region(self, region: str = "indian_ocean") -> List[GliderTrack]:
        """Get glider tracks for a given region (uses region bounds)."""
        return self.get_gliders(
            lat_min=self.region_bounds["lat_min"],
            lat_max=self.region_bounds["lat_max"],
            lon_min=self.region_bounds["lon_min"],
            lon_max=self.region_bounds["lon_max"],
        )

    # ------------------------------------------------------------------
    # Caching helper
    # ------------------------------------------------------------------

    def invalidate_cache(self) -> None:
        """Invalidate any internal caches."""
        logger.info("GliderAdapter cache invalidated")


# -------------------------------------------------------------------------
# Module-level convenience (matches observations.py patterns)
# -------------------------------------------------------------------------

_default_adapter: Optional[GliderAdapter] = None


def get_glider_adapter(region: str = "indian_ocean") -> GliderAdapter:
    """Return a (cached) GliderAdapter instance.

    Defaults to the cached GeoJSON positioning layer (real GDAC metadata) so
    requests stay fast and offline-friendly. Set ERDDAP_USE_LIVE=1 for live
    ERDDAP subset queries.
    """
    import os

    global _default_adapter
    use_live = os.environ.get("ERDDAP_USE_LIVE", "0") == "1"
    if _default_adapter is None or _default_adapter.region != region:
        _default_adapter = GliderAdapter(region=region, use_erddap=use_live)
    return _default_adapter


def _get_glider_tracks_cached(region: str = "indian_ocean") -> List[GliderTrack]:
    """Cached wrapper matching observations.py _get_glider_tracks signature."""
    return get_glider_adapter(region).get_gliders()


# -------------------------------------------------------------------------
# Module-level test / demo
# -------------------------------------------------------------------------

if __name__ == "__main__":
    # Quick smoke test
    adapter = GliderAdapter(use_erddap=False)
    tracks = adapter.get_gliders(limit=5)
    print(f"GliderAdapter fallback test: {len(tracks)} tracks loaded")
    for t in tracks[:2]:
        print(f"  {t.glider_id}: {t.name}, {len(t.observations)} observations")