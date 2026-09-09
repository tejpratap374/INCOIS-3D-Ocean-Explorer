"""In-situ observation endpoints (Argo, Gliders) — real data only.

Positions and tracks come from the real Argo / glider networks through the
ERDDAP-capable adapters with the cached GeoJSON positioning metadata as the
offline source. Profile values are served only when the corresponding
per-float / per-mission NetCDF has been mirrored locally; otherwise the
endpoint returns 503 ``DATA_NOT_AVAILABLE`` — it never fabricates a value.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.adapters.argo_adapter import get_argo_adapter
from app.adapters.glider_adapter import get_glider_adapter
from app.models.ocean import ArgoFloat, GliderTrack
from app.services.real_data import DataNotAvailable

router = APIRouter(prefix="/api/observations", tags=["observations"])

# Real-positioning adapters: ERDDAP primary, GeoJSON caching layer fallback.
_ARGO_ADAPTERS: Dict[str, object] = {}
_GLIDER_ADAPTERS: Dict[str, object] = {}


def _get_argo_floats(region: str = "indian_ocean") -> List[ArgoFloat]:
    if region not in _ARGO_ADAPTERS:
        _ARGO_ADAPTERS[region] = get_argo_adapter(region=region)
    adapter = _ARGO_ADAPTERS[region]
    return adapter.get_floats_by_region(region=region)


def _get_glider_tracks(region: str = "indian_ocean") -> List[GliderTrack]:
    if region not in _GLIDER_ADAPTERS:
        _GLIDER_ADAPTERS[region] = get_glider_adapter(region=region)
    adapter = _GLIDER_ADAPTERS[region]
    return adapter.get_gliders_by_region(region=region)


@router.get("/argo")
async def get_argo_floats(
    lat_min: float = Query(-90.0, ge=-90, le=90),
    lat_max: float = Query(90.0, ge=-90, le=90),
    lon_min: float = Query(-180.0, ge=-180, le=180),
    lon_max: float = Query(180.0, ge=-180, le=180),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    region: str = Query("indian_ocean", description="Region ID for Argo float distribution"),
):
    """Get real Argo float positions within a bounding box."""
    adapter = get_argo_adapter(region=region)
    floats = adapter.get_floats(
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        status=status,
        limit=limit,
    )
    if not floats:
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": (
                    "No real Argo float positions cached for this window. Run "
                    "scripts/fetch_argo_gdac.py to mirror the Ifremer GDAC "
                    "float index (ftp://ftp.ifremer.fr/ifremer/argo)."
                ),
            },
        )
    return {
        "count": len(floats),
        "total": len(floats),
        "floats": [f.model_dump(mode="json") for f in floats],
        "source": "Argo / Ifremer GDAC (real positions)",
    }


@router.get("/argo/{float_id}")
async def get_argo_float(
    float_id: str,
    region: str = Query("indian_ocean", description="Region ID for Argo float distribution"),
):
    """Get a specific Argo float by ID (real position metadata)."""
    adapter = get_argo_adapter(region=region)
    float_obj = adapter.get_float_by_id(float_id)
    if float_obj is None:
        raise HTTPException(status_code=404, detail=f"Float not found: {float_id}")
    return float_obj.model_dump(mode="json")


@router.get("/argo/{float_id}/profile")
async def get_argo_profile(
    float_id: str,
    profile: Optional[int] = Query(None, description="Profile number"),
    region: str = Query("indian_ocean", description="Region ID for Argo float distribution"),
):
    """Get an Argo profile for a specific float (real data only).

    Served from the per-float NetCDF mirrored from the Ifremer GDAC when
    present, otherwise 503 ``DATA_NOT_AVAILABLE``. Never fabricated.
    """
    adapter = get_argo_adapter(region=region)
    float_obj = adapter.get_float_by_id(float_id)
    if float_obj is None:
        raise HTTPException(status_code=404, detail=f"Float not found: {float_id}")
    try:
        profile_obj = adapter.get_profile(float_obj, profile)
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    return profile_obj.model_dump(mode="json")


@router.get("/gliders")
async def get_gliders(
    lat_min: float = Query(-90.0, ge=-90, le=90),
    lat_max: float = Query(90.0, ge=-90, le=90),
    lon_min: float = Query(-180.0, ge=-180, le=180),
    lon_max: float = Query(180.0, ge=-180, le=180),
    limit: int = Query(50, ge=1, le=200),
    region: str = Query("indian_ocean", description="Region ID for glider track distribution"),
):
    """Get real glider tracks within a bounding box."""
    adapter = get_glider_adapter(region=region)
    tracks = adapter.get_gliders(
        lat_min=lat_min,
        lat_max=lat_max,
        lon_min=lon_min,
        lon_max=lon_max,
        limit=limit,
    )
    if not tracks:
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": (
                    "No real glider tracks cached for this window. Run "
                    "scripts/fetch_glider_gdac.py to mirror the Ifremer glider "
                    "manifest (ftp://ftp.ifremer.fr/ifremer/glider/v2/)."
                ),
            },
        )
    return {
        "count": len(tracks),
        "tracks": [t.model_dump(mode="json") for t in tracks],
        "source": "Ifremer global glider network (real tracks)",
    }


@router.get("/gliders/{glider_id}")
async def get_glider(
    glider_id: str,
    region: str = Query("indian_ocean", description="Region ID for glider track distribution"),
):
    """Get a specific glider track (real geometry)."""
    adapter = get_glider_adapter(region=region)
    track = adapter.get_glider_by_id(glider_id)
    if track is None:
        raise HTTPException(status_code=404, detail=f"Glider not found: {glider_id}")
    return track.model_dump(mode="json")


@router.get("/status")
async def get_observations_status(
    region: str = Query("indian_ocean", description="Region ID for observation networks"),
):
    """Get summary status of all real observation networks."""
    argo = _get_argo_floats(region=region)
    gliders = _get_glider_tracks(region=region)
    active_argo = sum(1 for f in argo if f.status.value == "active")
    return {
        "region": region,
        "argo": {
            "total": len(argo),
            "active": active_argo,
            "inactive": len(argo) - active_argo,
        },
        "gliders": {
            "total": len(gliders),
            "active": len([t for t in gliders if t.observations]),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "Argo / Ifremer GDAC + Ifremer glider v2 (real)",
    }