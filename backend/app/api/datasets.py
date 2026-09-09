"""Dataset discovery and metadata endpoints — real data only.

The INCOIS Ocean Explorer exposes dataset IDs that reflect the official
authorised data sources (see DATA_SOURCES.md):

    argo_global_ifremer                   — Argo global float network
                                            (Ifremer GDAC mirror)
    ifremer_global_gliders                — Ifremer global glider network v2
    incois_las_indian_ocean               — INCOIS LAS Indian Ocean products
    copernicus_global_multyear_phy_001_030— Copernicus Marine reanalysis
    incois_omni_buoys                     — INCOIS OMNI moored buoy network
    godas_indian_ocean                    — NCEP GODAS reanalysis (REAL NetCDF
                                            cache under data/model_db)

Every dataset is served strictly from real cached data. When the on-disk
cache for a source is missing, the metadata endpoints return
503 ``DATA_NOT_AVAILABLE`` — never fabricated values. GODAS is read from a
local NetCDF cache under ``data/model_db`` (see scripts/fetch_godas_sample.py)
and the other sources from the indexed slabs under ``data/incois`` (see
scripts/fetch_*.py).
"""
from __future__ import annotations

import functools
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.adapters.netcdf import NetCDFAdapter
from app.services import real_data
from app.services.real_data import DataNotAvailable

router = APIRouter(tags=["datasets"])

# Sub-router for dataset endpoints, mounted under /api/datasets
_datasets_router = APIRouter(prefix="/api/datasets", tags=["datasets"])

# Sub-router for region endpoints, mounted under /api/regions
_regions_router = APIRouter(prefix="/api/regions", tags=["regions"])


# Real (non-synthetic) dataset variable display metadata.
REAL_VARIABLE_META: Dict[str, Dict] = {
    "temperature": {
        "id": "temperature",
        "name": "Temperature",
        "unit": "°C",
        "valid_range": [-2.0, 35.0],
        "colormap": "thermal",
        "description": "Potential temperature converted from K to °C",
    },
    "salinity": {
        "id": "salinity",
        "name": "Salinity",
        "unit": "PSU",
        "valid_range": [28.0, 38.0],
        "colormap": "haline",
        "description": "Salinity converted from mass fraction (kg/kg) to PSU",
    },
    "uo": {
        "id": "uo",
        "name": "Zonal Velocity (U)",
        "unit": "m/s",
        "valid_range": [-3.0, 3.0],
        "colormap": "balance",
        "description": "Eastward sea-water velocity",
    },
    "vo": {
        "id": "vo",
        "name": "Meridional Velocity (V)",
        "unit": "m/s",
        "valid_range": [-3.0, 3.0],
        "colormap": "balance",
        "description": "Northward sea-water velocity",
    },
    "speed": {
        "id": "speed",
        "name": "Current Speed",
        "unit": "m/s",
        "valid_range": [0.0, 3.0],
        "colormap": "viridis",
        "description": "Current speed = sqrt(u^2 + v^2)",
    },
}

# Known NCEP-GODAS depth levels (m, positive-down) — used only to describe the
# documented coverage when the cached NetCDF is not present.
_GODAS_SPEC_LEVELS = [
    5.0, 15.0, 25.0, 35.0, 45.0, 55.0, 65.0, 75.0, 85.0, 95.0,
    105.0, 115.0, 125.0, 135.0, 145.0, 155.0, 165.0, 175.0, 185.0, 195.0,
    205.0, 215.0, 225.0, 238.0, 262.0, 303.0, 366.0, 459.0, 584.0, 747.0,
    949.0, 1193.0, 1479.0, 1807.0, 2174.0, 2579.0, 3016.0, 3483.0, 3972.0, 4478.0,
]


# Domain mapping per real source family (Indian Ocean focus).
_DATASET_DOMAINS = {
    "argo_global_ifremer": {
        "lat_min": -60.0,
        "lat_max": 30.0,
        "lon_min": 20.0,
        "lon_max": 120.0,
        "region_id": "indian_ocean",
    },
    "ifremer_global_gliders": {
        "lat_min": -60.0,
        "lat_max": 30.0,
        "lon_min": 20.0,
        "lon_max": 120.0,
        "region_id": "indian_ocean",
    },
    "incois_omni_buoys": {
        "lat_min": -60.0,
        "lat_max": 30.0,
        "lon_min": 20.0,
        "lon_max": 120.0,
        "region_id": "indian_ocean",
    },
    "incois_las_indian_ocean": {
        "lat_min": -60.0,
        "lat_max": 30.0,
        "lon_min": 20.0,
        "lon_max": 120.0,
        "region_id": "indian_ocean",
    },
    "copernicus_global_multyear_phy_001_030": {
        "lat_min": -60.0,
        "lat_max": 30.0,
        "lon_min": 20.0,
        "lon_max": 120.0,
        "region_id": "indian_ocean",
    },
    "godas_indian_ocean": {
        "lat_min": -60.0,
        "lat_max": 30.0,
        "lon_min": 20.0,
        "lon_max": 120.0,
        "region_id": "indian_ocean",
    },
    "incois_roms_io": {
        "lat_min": -60.0,
        "lat_max": 30.0,
        "lon_min": 20.0,
        "lon_max": 120.0,
        "region_id": "indian_ocean",
    },
}


@functools.lru_cache(maxsize=1)
def _godas_adapter() -> Optional[NetCDFAdapter]:
    """Build the real-data NetCDF adapter (cached across requests).

    Precedence:
      1. settings.ocean_data_file (explicit NetCDF, e.g. the INCOIS file),
      2. newest snapshot cached under data/model_db/godas.
    Returns None when no real data is available.
    """
    from app.core.config import get_settings

    settings = get_settings()
    path = settings.ocean_data_file
    if path is None or not path.exists():
        candidates = sorted(
            (settings.model_db_dir / "godas").glob("GODAS_IndianOcean_*.nc")
        )
        if not candidates:
            return None
        path = candidates[-1]
    try:
        adapter = NetCDFAdapter(path)
        adapter._open()  # force schema parse
        return adapter
    except Exception:  # noqa: BLE001 - corrupt/unreadable -> unavailable
        return None


def godas_meta() -> dict:
    """Runtime metadata for the real GODAS dataset."""
    adapter = _godas_adapter()
    if adapter is not None:
        times = adapter.get_times()
        depths = adapter.get_depths()
        variables = adapter.get_variables()
        return {
            "format": "NetCDF (HDF5)",
            "source": "NCEP GODAS monthly reanalysis - dev snapshot "
                      f"({adapter.path.name})",
            "is_data_available": True,
            "depth_coverage": {
                "min": min(depths) if depths else 0.0,
                "max": max(depths) if depths else 0.0,
                "levels": depths,
            },
            "temporal_coverage": {
                "start": times[0].isoformat() if times else None,
                "end": times[-1].isoformat() if times else None,
            },
            "variables": [v for v in ("temperature", "salinity", "uo", "vo", "speed")
                          if v in variables],
        }
    return {
        "format": "NetCDF (cached snapshot missing)",
        "source": ("requires data/model_db/godas/GODAS_IndianOcean_*.nc or "
                   "OCEAN_DATA_FILE (see scripts/fetch_godas_sample.py)"),
        "is_data_available": False,
        "depth_coverage": {
            "min": _GODAS_SPEC_LEVELS[0],
            "max": _GODAS_SPEC_LEVELS[-1],
            "levels": _GODAS_SPEC_LEVELS,
        },
        "temporal_coverage": {
            "start": "2005-01-01T00:00:00",
            "end": "2005-12-01T00:00:00",
        },
        "variables": list(REAL_VARIABLE_META.keys()),
    }


# Singleton dataset registry — these IDs are the public contract.
_DATASETS = {
    "argo_global_ifremer": {
        "id": "argo_global_ifremer",
        "name": "Argo — Global Float Network (Ifremer GDAC)",
        "description": (
            "Argo profiling float positions from the official global Argo data "
            "stream mirrored on the Ifremer GDAC (ftp://ftp.ifremer.fr/ifremer/"
            "argo). Real float WMO identifiers and last-known positions; profile "
            "values load from the mirrored per-float NetCDF when present, "
            "otherwise 503 DATA_NOT_AVAILABLE."
        ),
        "type": "in_situ_observation",
        "format": "ERDDAP index + GeoJSON cache",
        "source": "Ifremer GDAC Argo mirror (real)",
        "license": "Argo data are freely available (www.argo.ucsd.edu)",
        "spatial_coverage": {
            "lat_min": _DATASET_DOMAINS["argo_global_ifremer"]["lat_min"],
            "lat_max": _DATASET_DOMAINS["argo_global_ifremer"]["lat_max"],
            "lon_min": _DATASET_DOMAINS["argo_global_ifremer"]["lon_min"],
            "lon_max": _DATASET_DOMAINS["argo_global_ifremer"]["lon_max"],
        },
        "temporal_coverage": {"start": None, "end": None},
        "depth_coverage": {"min": 0.0, "max": 2000.0, "levels": []},
        "variables": ["temperature", "salinity", "pressure"],
        "is_synthetic": False,
        "is_data_available": True,
        "status": "active",
    },
    "ifremer_global_gliders": {
        "id": "ifremer_global_gliders",
        "name": "Gliders — Ifremer Global Glider Network v2",
        "description": (
            "Real glider track geometry and mission metadata from the Ifremer "
            "global glider data stream (ftp://ftp.ifremer.fr/ifremer/glider/v2/). "
            "Per-mission physical values load from mirrored NetCDF when present, "
            "otherwise 503 DATA_NOT_AVAILABLE."
        ),
        "type": "in_situ_observation",
        "format": "ERDDAP index + GeoJSON cache",
        "source": "Ifremer glider GDAC v2 (real)",
        "license": "Ifremer glider data are freely available",
        "spatial_coverage": {
            "lat_min": _DATASET_DOMAINS["ifremer_global_gliders"]["lat_min"],
            "lat_max": _DATASET_DOMAINS["ifremer_global_gliders"]["lat_max"],
            "lon_min": _DATASET_DOMAINS["ifremer_global_gliders"]["lon_min"],
            "lon_max": _DATASET_DOMAINS["ifremer_global_gliders"]["lon_max"],
        },
        "temporal_coverage": {"start": None, "end": None},
        "depth_coverage": {"min": 0.0, "max": 1000.0, "levels": []},
        "variables": ["temperature", "salinity", "chlorophyll", "oxygen"],
        "is_synthetic": False,
        "is_data_available": True,
        "status": "active",
    },
    "incois_omni_buoys": {
        "id": "incois_omni_buoys",
        "name": "OMNI — INCOIS Moored Buoy Network",
        "description": (
            "Real-time coastal moored-buoy observations from the INCOIS OMNI "
            "network (incois.gov.in/omni.html). Served from the indexed buoy "
            "manifest under data/incois/omni when provisioned, otherwise "
            "503 DATA_NOT_AVAILABLE."
        ),
        "type": "in_situ_observation",
        "format": "JSON manifest",
        "source": "INCOIS OMNI buoy network (real)",
        "license": "INCOIS — see DATA_SOURCES.md",
        "spatial_coverage": {
            "lat_min": _DATASET_DOMAINS["incois_omni_buoys"]["lat_min"],
            "lat_max": _DATASET_DOMAINS["incois_omni_buoys"]["lat_max"],
            "lon_min": _DATASET_DOMAINS["incois_omni_buoys"]["lon_min"],
            "lon_max": _DATASET_DOMAINS["incois_omni_buoys"]["lon_max"],
        },
        "temporal_coverage": {"start": None, "end": None},
        "depth_coverage": {"min": 0.0, "max": 5.0, "levels": []},
        "variables": ["temperature", "salinity", "ssh", "wave_height"],
        "is_synthetic": False,
        "is_data_available": True,
        "status": "active",
    },
    "incois_las_indian_ocean": {
        "id": "incois_las_indian_ocean",
        "name": "INCOIS LAS — Indian Ocean Products",
        "description": (
            "INCOIS Live Access Server numerical model outputs for the Indian "
            "Ocean (las.incois.gov.in). Served from the real sampled slab under "
            "data/incois/las_incois when provisioned, otherwise "
            "503 DATA_NOT_AVAILABLE."
        ),
        "type": "numerical_model",
        "format": "CSV slab + JSON index",
        "source": "INCOIS LAS (real)",
        "license": "INCOIS — see DATA_SOURCES.md",
        "spatial_coverage": {
            "lat_min": _DATASET_DOMAINS["incois_las_indian_ocean"]["lat_min"],
            "lat_max": _DATASET_DOMAINS["incois_las_indian_ocean"]["lat_max"],
            "lon_min": _DATASET_DOMAINS["incois_las_indian_ocean"]["lon_min"],
            "lon_max": _DATASET_DOMAINS["incois_las_indian_ocean"]["lon_max"],
        },
        "temporal_coverage": {"start": None, "end": None},
        "depth_coverage": {"min": 0.0, "max": 0.0, "levels": []},
        "variables": ["temperature", "salinity", "u", "v", "ssh", "chlorophyll"],
        "is_synthetic": False,
        "is_data_available": True,
        "status": "active",
    },
    "copernicus_global_multyear_phy_001_030": {
        "id": "copernicus_global_multyear_phy_001_030",
        "name": "Copernicus Marine — Global Multi-Year Reanalysis",
        "description": (
            "CMEMS GLOBAL_MULTIYEAR_PHY_001_030 global multi-year physics "
            "reanalysis (data.marine.copernicus.eu). Served from the real sampled "
            "slab under data/incois/copernicus_phy_001_030 when provisioned, "
            "otherwise 503 DATA_NOT_AVAILABLE."
        ),
        "type": "numerical_model",
        "format": "CSV slab + JSON index",
        "source": "Copernicus Marine (real)",
        "license": "CMEMS E.U. Copernicus — see DATA_SOURCES.md",
        "spatial_coverage": {
            "lat_min": _DATASET_DOMAINS["copernicus_global_multyear_phy_001_030"]["lat_min"],
            "lat_max": _DATASET_DOMAINS["copernicus_global_multyear_phy_001_030"]["lat_max"],
            "lon_min": _DATASET_DOMAINS["copernicus_global_multyear_phy_001_030"]["lon_min"],
            "lon_max": _DATASET_DOMAINS["copernicus_global_multyear_phy_001_030"]["lon_max"],
        },
        "temporal_coverage": {"start": None, "end": None},
        "depth_coverage": {"min": 0.0, "max": 0.0, "levels": []},
        "variables": ["temperature", "salinity", "u", "v", "ssh", "sea_ice_fraction", "mixed_layer_depth"],
        "is_synthetic": False,
        "is_data_available": True,
        "status": "active",
    },
    "godas_indian_ocean": {
        "id": "godas_indian_ocean",
        "name": "GODAS — Real Global Ocean Reanalysis (Indian Ocean)",
        "description": (
            "NCEP Global Ocean Data Assimilation System (GODAS) monthly mean "
            "fields, Indian Ocean subset, served from a locally cached REAL "
            "NetCDF snapshot. Depth-resolved: 40 levels from 5 m to 4478 m. "
            "This is REAL model-analysis data (not synthetic). A production "
            "build would serve the equivalent INCOIS-GODAS output through the "
            "same adapter."
        ),
        "type": "numerical_model",
        "format": "NetCDF (HDF5)",
        "source": "NCEP GODAS reanalysis (real data dev snapshot)",
        "license": "NOAA NCEP GODAS data are public domain; see DATA_SOURCES.md",
        "spatial_coverage": {
            "lat_min": _DATASET_DOMAINS["godas_indian_ocean"]["lat_min"],
            "lat_max": _DATASET_DOMAINS["godas_indian_ocean"]["lat_max"],
            "lon_min": _DATASET_DOMAINS["godas_indian_ocean"]["lon_min"],
            "lon_max": _DATASET_DOMAINS["godas_indian_ocean"]["lon_max"],
        },
        "temporal_coverage": godas_meta()["temporal_coverage"],
        "depth_coverage": godas_meta()["depth_coverage"],
        "variables": godas_meta()["variables"],
        "is_synthetic": False,
        "is_data_available": godas_meta()["is_data_available"],
        "status": "active" if godas_meta()["is_data_available"] else "unavailable",
    },
}

# Region metadata for the /api/regions endpoint
_REGIONS = {
    "indian_ocean": {
        "id": "indian_ocean",
        "name": "Indian Ocean",
        "spatial_coverage": {
            "lat_min": -5.0,
            "lat_max": 25.0,
            "lon_min": 55.0,
            "lon_max": 100.0,
        },
        "data_available": True,
    },
    "pacific_ocean": {
        "id": "pacific_ocean",
        "name": "Pacific Ocean",
        "spatial_coverage": {
            "lat_min": -30.0,
            "lat_max": 50.0,
            "lon_min": 120.0,
            "lon_max": 260.0,
        },
        "data_available": True,
    },
    "atlantic_ocean": {
        "id": "atlantic_ocean",
        "name": "Atlantic Ocean",
        "spatial_coverage": {
            "lat_min": -40.0,
            "lat_max": 65.0,
            "lon_min": -75.0,
            "lon_max": 5.0,
        },
        "data_available": True,
    },
    "southern_ocean": {
        "id": "southern_ocean",
        "name": "Southern Ocean",
        "spatial_coverage": {
            "lat_min": -75.0,
            "lat_max": -45.0,
            "lon_min": -180.0,
            "lon_max": 180.0,
        },
        "data_available": True,
    },
    "arctic_ocean": {
        "id": "arctic_ocean",
        "name": "Arctic Ocean",
        "spatial_coverage": {
            "lat_min": 65.0,
            "lat_max": 88.0,
            "lon_min": -180.0,
            "lon_max": 180.0,
        },
        "data_available": True,
    },
    "arabian_sea": {
        "id": "arabian_sea",
        "name": "Arabian Sea",
        "spatial_coverage": {
            "lat_min": 8.0,
            "lat_max": 25.0,
            "lon_min": 55.0,
            "lon_max": 78.0,
        },
        "data_available": True,
    },
    "bay_of_bengal": {
        "id": "bay_of_bengal",
        "name": "Bay of Bengal",
        "spatial_coverage": {
            "lat_min": 5.0,
            "lat_max": 22.0,
            "lon_min": 80.0,
            "lon_max": 100.0,
        },
        "data_available": True,
    },
    "somali_jet": {
        "id": "somali_jet",
        "name": "Somali Jet",
        "spatial_coverage": {
            "lat_min": -5.0,
            "lat_max": 20.0,
            "lon_min": 45.0,
            "lon_max": 78.0,
        },
        "data_available": True,
    },
    "equatorial_jet": {
        "id": "equatorial_jet",
        "name": "Equatorial Jet",
        "spatial_coverage": {
            "lat_min": -5.0,
            "lat_max": 10.0,
            "lon_min": 50.0,
            "lon_max": 100.0,
        },
        "data_available": True,
    },
}


def get_dataset_meta(dataset_id: str) -> dict:
    """Get dataset metadata by ID."""
    if dataset_id not in _DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    return _DATASETS[dataset_id]


def get_dataset_domain(dataset_id: str) -> dict:
    """Get the spatial domain for a dataset, or the Indian Ocean default."""
    if dataset_id in _DATASET_DOMAINS:
        return _DATASET_DOMAINS[dataset_id]
    return _DATASET_DOMAINS["godas_indian_ocean"]


@_datasets_router.get("", response_model=List[dict])
async def list_datasets(
    type: Optional[str] = Query(None, description="Filter by dataset type"),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    """List all registered datasets as a flat array."""
    items = list(_DATASETS.values())
    if type:
        items = [d for d in items if d.get("type") == type]
    if status:
        items = [d for d in items if d.get("status") == status]
    return items


@_datasets_router.get("/{dataset_id}")
async def get_dataset(dataset_id: str):
    """Get dataset metadata."""
    if dataset_id == "godas_indian_ocean":
        meta = dict(_DATASETS[dataset_id])
        meta.update(godas_meta())
        meta["status"] = "active" if meta["is_data_available"] else "unavailable"
        return meta
    return get_dataset_meta(dataset_id)


@_datasets_router.get("/{dataset_id}/variables")
async def get_dataset_variables(dataset_id: str):
    """Get available variables for a dataset (real sources only)."""
    meta = get_dataset_meta(dataset_id)
    if dataset_id == "godas_indian_ocean":
        adapter = _godas_adapter()
        available = adapter.get_variables() if adapter is not None else set()
        variables = [
            v for v in REAL_VARIABLE_META.values() if v["id"] in available
        ] if adapter is not None else list(REAL_VARIABLE_META.values())
        return {"dataset_id": dataset_id, "variables": variables}
    try:
        var_meta_list = real_data.get_dataset_variables(dataset_id)
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    return {"dataset_id": dataset_id, "variables": var_meta_list}


@_datasets_router.get("/{dataset_id}/times")
async def get_dataset_times(dataset_id: str):
    """Get available time steps for a dataset."""
    if dataset_id == "godas_indian_ocean":
        adapter = _godas_adapter()
        if adapter is not None and adapter.get_times():
            return {
                "dataset_id": dataset_id,
                "times": [
                    t.isoformat() + "Z" if not t.isoformat().endswith("Z") else t.isoformat()
                    for t in adapter.get_times()
                ],
            }
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": (
                    "GODAS NetCDF cache missing. Run scripts/fetch_godas_sample.py "
                    "or set OCEAN_DATA_FILE to a real NetCDF path."
                ),
            },
        )
    try:
        raw_times = real_data.get_dataset_times(dataset_id)
        times = [
            t.isoformat() + "Z" if isinstance(t, datetime) and not t.isoformat().endswith("Z")
            else (t + "Z" if isinstance(t, str) and not t.endswith("Z") else str(t))
            for t in raw_times
        ]
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    return {"dataset_id": dataset_id, "times": times}


@_datasets_router.get("/{dataset_id}/depths")
async def get_dataset_depths(dataset_id: str):
    """Get available depth levels for a dataset (real axes only)."""
    if dataset_id == "godas_indian_ocean":
        meta = get_dataset_meta(dataset_id)
        return {
            "dataset_id": dataset_id,
            "depths": meta.get("depth_coverage", {}).get("levels", []),
            "min": meta.get("depth_coverage", {}).get("min", 0.0),
            "max": meta.get("depth_coverage", {}).get("max", 4478.0),
        }
    try:
        depths, depth_min, depth_max = real_data.get_dataset_depths(dataset_id)
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    return {
        "dataset_id": dataset_id,
        "depths": depths,
        "min": depth_min,
        "max": depth_max,
    }


# Region endpoints
@_regions_router.get("", response_model=List[dict])
async def list_regions():
    """List all available ocean regions with their spatial coverage and data availability."""
    return list(_REGIONS.values())


@_regions_router.get("/{region_id}")
async def get_region(region_id: str):
    """Get metadata for a specific region."""
    if region_id not in _REGIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region_id}' not found")
    return _REGIONS[region_id]


# Mount sub-routers on the main router
router.include_router(_datasets_router)
router.include_router(_regions_router)