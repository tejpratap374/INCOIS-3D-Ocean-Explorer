"""Ocean field data endpoints — real data only.

2D field / profile / timeseries / vector responses always trace to real
cached data:

  * ``godas_indian_ocean``   — REAL NetCDF GODAS reanalysis snapshot
    (data/model_db/godas) via the NetCDF adapter.
  * slab-backed sources      — ``incois_las_indian_ocean``,
    ``copernicus_global_multyear_phy_001_030``, ``incois_omni_buoys`` served
    through :mod:`app.services.real_data` from the indexed slabs under
    ``data/incois``.
  * in-situ sources          — ``argo_global_ifremer``,
    ``ifremer_global_gliders`` are NOT gridded fields; queries for them return
    503 ``DATA_NOT_AVAILABLE`` here (positions live in /api/observations).

When a real cache is missing, endpoints return 503 ``DATA_NOT_AVAILABLE`` —
they never fabricate a value. The ``/api/data/query`` POST endpoint returns a
``[time][depth][space]`` volume for the depth-slice visualization.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.adapters.netcdf import DataAdapter
from app.api.datasets import (
    _godas_adapter,
    get_dataset_domain,
    get_dataset_meta,
)
from app.models.ocean import DepthProfile, OceanField, TimeSeries, TimeSeriesPoint
from app.services import real_data
from app.services.real_data import DataNotAvailable, FieldQuery

router = APIRouter(prefix="/api", tags=["data"])

# Datasets that provide 2D gridded fields (model outputs + buoy nets).
_FIELD_DATASETS = {
    "godas_indian_ocean",
    "incois_roms_io",
    "incois_las_indian_ocean",
    "copernicus_global_multyear_phy_001_030",
    "incois_omni_buoys",
}

# Datasets that support vertical profiles from the real model grid.
_PROFILE_DATASETS = {"godas_indian_ocean"}


# ── helpers ────────────────────────────────────────────────────────────────

def _json_clean(value):
    """JSON-compliant value: NaN/Inf -> None (missing cell), else unchanged."""
    if value is None:
        return None
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return value
    return value


def _clean_grid(data: np.ndarray) -> list:
    """Convert a 2D numpy field to list-of-lists with NaN -> None."""
    return [[_json_clean(float(v)) for v in row] for row in data.tolist()]


def _parse_time(time_str: Optional[str]) -> Optional[datetime]:
    if not time_str:
        return None
    try:
        return datetime.fromisoformat(time_str.replace("Z", "+00:00").split("+")[0])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}")


class _SlabAdapter(DataAdapter):
    """DataAdapter facade over the real slab sources in app.services.real_data.

    Thin adapter so the generic field-flow in this module can serve the
    INCOIS LAS / Copernicus / OMNI indexed slabs with the same code paths as
    the GODAS NetCDF adapter. Raises :class:`DataNotAvailable` when the real
    cache is missing — never fabricates data.
    """

    def __init__(self, dataset_id: str):
        self.dataset_id = dataset_id
        self._variables = None
        self._times = None
        self._depths = None

    # ── metadata ────────────────────────────────────────────────────────

    def get_variables(self) -> list[str]:
        if self._variables is None:
            self._variables = [
                v["id"] for v in real_data.get_dataset_variables(self.dataset_id)
            ]
        return list(self._variables)

    def get_times(self) -> list[datetime]:
        if self._times is None:
            raw = real_data.get_dataset_times(self.dataset_id)
            parsed = []
            for t in raw:
                if isinstance(t, datetime):
                    parsed.append(t)
                else:
                    parsed.append(
                        datetime.fromisoformat(t.replace("Z", "+00:00").split("+")[0])
                    )
            self._times = parsed
        return list(self._times)

    def get_depths(self) -> list[float]:
        if self._depths is None:
            self._depths, _, _ = real_data.get_dataset_depths(self.dataset_id)
        return list(self._depths)

    def get_latitude_range(self) -> tuple[float, float]:
        d = get_dataset_domain(self.dataset_id)
        return d["lat_min"], d["lat_max"]

    def get_longitude_range(self) -> tuple[float, float]:
        d = get_dataset_domain(self.dataset_id)
        return d["lon_min"], d["lon_max"]

    def variable_unit(self, variable: str) -> str:
        for v in real_data.get_dataset_variables(self.dataset_id):
            if v["id"] == variable:
                return v.get("units", "")
        return ""

    def depth_metadata(self, depth: Optional[float]) -> dict:
        requested = 0.0 if depth is None else float(depth)
        return {
            "requested_depth": requested,
            "actual_depth": requested,
            "selection_method": "nearest from real slab",
        }

    # ── data ────────────────────────────────────────────────────────────

    def get_field(
        self,
        variable: str,
        time: datetime | None = None,
        depth: float | None = None,
        lat_range: tuple[float, float] | None = None,
        lon_range: tuple[float, float] | None = None,
        resolution: int | None = None,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, float, float, float]:
        if lat_range is None:
            lat_range = self.get_latitude_range()
        if lon_range is None:
            lon_range = self.get_longitude_range()
        target_time = time.isoformat() if time else None

        field = real_data.query_field(
            FieldQuery(
                dataset_id=self.dataset_id,
                variable=variable,
                lat_range=lat_range,
                lon_range=lon_range,
                depth=depth,
                time=target_time,
            )
        )
        data = np.asarray(field["data"], dtype=float)
        data = np.where(data == -999.0, np.nan, data)
        lats = np.asarray(field["lat"], dtype=float)
        lons = np.asarray(field["lon"], dtype=float)
        if resolution and data.size and data.ndim == 2:
            ly, lx = data.shape
            if max(ly, lx) > resolution:
                s = max(1, int(math.ceil(max(ly, lx) / resolution)))
                data = data[::s, ::s]
                lats = lats[::s]
                lons = lons[::s]
        if not np.isfinite(data).any():
            vmin = vmax = vmean = 0.0
        else:
            vmin = float(np.nanmin(data))
            vmax = float(np.nanmax(data))
            vmean = float(np.nanmean(data))
        return lats, lons, data, vmin, vmax, vmean

    def get_profile(
        self,
        variable: str,
        time: datetime,
        latitude: float,
        longitude: float,
    ) -> tuple[np.ndarray, np.ndarray]:
        raise DataNotAvailable(
            f"{self.dataset_id} does not serve point profiles from the real cache. "
            "Use the godas_indian_ocean dataset for depth profiles."
        )


# ── adapter resolution ────────────────────────────────────────────────────

def _adapter_for(dataset: str, require_available: bool = True) -> DataAdapter:
    """Return the real-data adapter for a dataset ID (GODAS NetCDF or slab)."""
    if dataset in ("godas_indian_ocean", "incois_roms_io"):
        adapter = _godas_adapter()
        if adapter is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "error_code": "DATA_NOT_AVAILABLE",
                    "message": (
                        "Dataset 'godas_indian_ocean' has no local NetCDF cache. "
                        "Run 'python scripts/fetch_godas_sample.py' or set the "
                        "OCEAN_DATA_FILE setting to a real NetCDF path."
                    ),
                },
            )
        return adapter
    if dataset in ("incois_las_indian_ocean", "copernicus_global_multyear_phy_001_030", "incois_omni_buoys"):
        return _SlabAdapter(dataset)
    raise HTTPException(
        status_code=503,
        detail={
            "error_code": "DATA_NOT_AVAILABLE",
            "message": (
                f"Dataset '{dataset}' does not provide real gridded fields. "
                "Position streams are available under /api/observations."
            ),
        },
    )


def _field_label(dataset: str, adapter: DataAdapter) -> str:
    if dataset == "godas_indian_ocean":
        return f"GODAS reanalysis (real) — {adapter.path.name}"
    if dataset == "incois_las_indian_ocean":
        return "INCOIS LAS (real) — data/incois/las_incois"
    if dataset == "copernicus_global_multyear_phy_001_030":
        return "Copernicus Marine reanalysis (real) — data/incois/copernicus_phy_001_030"
    if dataset == "incois_omni_buoys":
        return "INCOIS OMNI buoys (real) — data/incois/omni"
    return "real data"


# ── field ─────────────────────────────────────────────────────────────────

@router.get("/data")
async def get_ocean_field(
    dataset: str = Query("godas_indian_ocean", description="Dataset ID"),
    variable: str = Query("temperature", description="Variable name"),
    time: Optional[str] = Query(None, description="ISO datetime"),
    depth: Optional[float] = Query(None, description="Depth in meters"),
    lat_min: Optional[float] = Query(None, description="Latitude minimum"),
    lat_max: Optional[float] = Query(None, description="Latitude maximum"),
    lon_min: Optional[float] = Query(None, description="Longitude minimum"),
    lon_max: Optional[float] = Query(None, description="Longitude maximum"),
    resolution: int = Query(160, description="Grid resolution", ge=20, le=200),
    region: str = Query("indian_ocean", description="Region ID for default bounds"),
):
    """Get a 2D real ocean field for visualization.

    Returns lat/lon arrays and a 2D data array ready for WebGL texture
    rendering. Missing caches return 503 ``DATA_NOT_AVAILABLE``.
    """
    if dataset not in _FIELD_DATASETS:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset '{dataset}' does not provide 2D fields. "
                   f"Available: {sorted(_FIELD_DATASETS)}",
        )

    adapter = _adapter_for(dataset)

    try:
        if variable not in adapter.get_variables():
            avail = ", ".join(sorted(adapter.get_variables()))
            raise HTTPException(status_code=400, detail=f"Unknown variable: {variable}. Available: {avail}")
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc

    # Effective bounds: explicit params take precedence, else dataset domain.
    ds_domain = get_dataset_domain(dataset)
    eff_lat_min = lat_min if lat_min is not None else ds_domain["lat_min"]
    eff_lat_max = lat_max if lat_max is not None else ds_domain["lat_max"]
    eff_lon_min = lon_min if lon_min is not None else ds_domain["lon_min"]
    eff_lon_max = lon_max if lon_max is not None else ds_domain["lon_max"]

    time_dt = _parse_time(time)
    depth_meta = adapter.depth_metadata(depth)

    try:
        lat, lon, data2d, vmin, vmax, vmean = adapter.get_field(
            variable=variable,
            time=time_dt,
            depth=depth_meta["actual_depth"],
            lat_range=(eff_lat_min, eff_lat_max),
            lon_range=(eff_lon_min, eff_lon_max),
            resolution=resolution,
        )
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc

    data_exists = bool(lat.size > 0 and lon.size > 0 and data2d.size > 0)
    if data_exists:
        actual_lat_min = float(lat.min())
        actual_lat_max = float(lat.max())
        actual_lon_min = float(lon.min())
        actual_lon_max = float(lon.max())
        latitude_list = lat.tolist()
        longitude_list = lon.tolist()
        data_list = _clean_grid(data2d)
    else:
        actual_lat_min = ds_domain["lat_min"]
        actual_lat_max = ds_domain["lat_min"]
        actual_lon_min = ds_domain["lon_min"]
        actual_lon_max = ds_domain["lon_min"]
        latitude_list = []
        longitude_list = []
        data_list = []

    coverage = {
        "region_id": region,
        "spatial_bounds": {
            "lat_min": actual_lat_min,
            "lat_max": actual_lat_max,
            "lon_min": actual_lon_min,
            "lon_max": actual_lon_max,
        },
        "data_exists": data_exists,
    }

    try:
        unit = adapter.variable_unit(variable)
    except Exception:  # noqa: BLE001
        unit = ""

    return OceanField(
        variable=variable,
        unit=unit,
        time=time_dt or datetime.now(timezone.utc),
        depth=depth,
        requested_depth=depth_meta["requested_depth"],
        actual_depth=depth_meta["actual_depth"],
        selection_method=depth_meta["selection_method"],
        min_value=vmin,
        max_value=vmax,
        mean_value=vmean,
        latitude=latitude_list,
        longitude=longitude_list,
        data=data_list,
        is_synthetic=False,
        source=_field_label(dataset, adapter),
    ).model_dump(mode="json") | {"coverage": coverage}


# ── profile / timeseries ──────────────────────────────────────────────────

@router.get("/profile")
async def get_depth_profile(
    variable: str = Query("temperature", description="Variable"),
    time: Optional[str] = Query(None, description="ISO datetime"),
    latitude: float = Query(..., description="Latitude", ge=-90, le=90),
    longitude: float = Query(..., description="Longitude", ge=-180, le=180),
    dataset: str = Query("godas_indian_ocean", description="Dataset ID"),
):
    """Get a vertical profile at a specific location and time (real data)."""
    adapter = _adapter_for(dataset)
    try:
        if variable not in adapter.get_variables():
            avail = ", ".join(sorted(adapter.get_variables()))
            raise HTTPException(status_code=400, detail=f"Unknown variable: {variable}. Available: {avail}")
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc

    time_dt = _parse_time(time)
    if time_dt is None:
        try:
            time_dt = adapter.get_times()[0]
        except DataNotAvailable as exc:
            raise HTTPException(
                status_code=503,
                detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
            ) from exc

    try:
        depths, values = adapter.get_profile(variable, time_dt, latitude, longitude)
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        unit = adapter.variable_unit(variable)
    except Exception:  # noqa: BLE001
        unit = ""

    raw_vals = values.tolist() if hasattr(values, "tolist") else list(values)
    raw_depths = depths.tolist() if hasattr(depths, "tolist") else list(depths)

    valid_depths = []
    valid_values = []
    for d, v in zip(raw_depths, raw_vals):
        cd = _json_clean(d)
        cv = _json_clean(v)
        if cd is not None and cv is not None:
            valid_depths.append(float(cd))
            valid_values.append(float(cv))

    return DepthProfile(
        variable=variable,
        unit=unit,
        depth=valid_depths,
        values=valid_values,
        latitude=latitude,
        longitude=longitude,
        time=time_dt,
        is_synthetic=False,
    ).model_dump(mode="json")


@router.get("/timeseries")
async def get_time_series(
    variable: str = Query("temperature", description="Variable"),
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    depth: float = Query(0.0, description="Depth in meters"),
    start: Optional[str] = Query(None, description="Start time ISO"),
    end: Optional[str] = Query(None, description="End time ISO"),
    dataset: str = Query("godas_indian_ocean", description="Dataset ID"),
):
    """Get a time series at a specific location and depth (real GODAS steps).

    Built from the real cached model steps at the nearest grid cell; when the
    real cache is missing the endpoint returns 503 ``DATA_NOT_AVAILABLE``.
    """
    adapter = _adapter_for(dataset)
    try:
        times = adapter.get_times()
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    if not times:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": "No real time steps."},
        )

    start_dt = _parse_time(start) or times[0]
    end_dt = _parse_time(end) or times[-1]

    try:
        if variable not in adapter.get_variables():
            avail = ", ".join(sorted(adapter.get_variables()))
            raise HTTPException(status_code=400, detail=f"Unknown variable: {variable}. Available: {avail}")
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc

    points = []
    for t in times:
        if not (start_dt <= t <= end_dt):
            continue
        try:
            _, _, data2d, _, _, _ = adapter.get_field(
                variable=variable,
                time=t,
                depth=depth,
                lat_range=(latitude - 0.5, latitude + 0.5),
                lon_range=(longitude - 0.5, longitude + 0.5),
                resolution=20,
            )
        except DataNotAvailable:
            continue
        except KeyError:
            continue
        if data2d.size:
            finite = data2d[np.isfinite(data2d)]
            if finite.size:
                points.append(TimeSeriesPoint(time=t, value=float(finite.mean())))

    if not points:
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": f"No real {variable} values near ({latitude}, {longitude}) "
                           f"between {start_dt.isoformat()} and {end_dt.isoformat()}.",
            },
        )

    try:
        unit = adapter.variable_unit(variable)
    except Exception:  # noqa: BLE001
        unit = ""

    return TimeSeries(
        variable=variable,
        unit=unit,
        latitude=latitude,
        longitude=longitude,
        depth=depth,
        points=points,
        is_synthetic=False,
    ).model_dump(mode="json")


# ── vectors ───────────────────────────────────────────────────────────────

@router.get("/vectors")
async def get_current_vectors(
    dataset: str = Query("godas_indian_ocean", description="Dataset ID"),
    time: Optional[str] = Query(None, description="ISO datetime"),
    depth: Optional[float] = Query(None, description="Depth in meters"),
    lat_min: Optional[float] = Query(None, description="Latitude minimum"),
    lat_max: Optional[float] = Query(None, description="Latitude maximum"),
    lon_min: Optional[float] = Query(None, description="Longitude minimum"),
    lon_max: Optional[float] = Query(None, description="Longitude maximum"),
    spacing: int = Query(8, description="Grid spacing for vectors", ge=3, le=30),
    region: str = Query("indian_ocean", description="Region ID for default bounds"),
):
    """Get real current velocity vectors on a regular grid (GODAS u/v)."""
    adapter = _adapter_for(dataset)
    ds_domain = get_dataset_domain(dataset)
    eff_lat_min = lat_min if lat_min is not None else ds_domain["lat_min"]
    eff_lat_max = lat_max if lat_max is not None else ds_domain["lat_max"]
    eff_lon_min = lon_min if lon_min is not None else ds_domain["lon_min"]
    eff_lon_max = lon_max if lon_max is not None else ds_domain["lon_max"]

    try:
        times = adapter.get_times()
        time_dt = _parse_time(time) or times[0]
        depth_meta = adapter.depth_metadata(depth)
        field_depth = depth_meta["actual_depth"]
        u_lats, u_lons, u_data, _, _, _ = adapter.get_field(
            variable="uo",
            time=time_dt,
            depth=field_depth,
            lat_range=(eff_lat_min, eff_lat_max),
            lon_range=(eff_lon_min, eff_lon_max),
            resolution=spacing * 8,
        )
        v_lats, v_lons, v_data, _, _, _ = adapter.get_field(
            variable="vo",
            time=time_dt,
            depth=field_depth,
            lat_range=(eff_lat_min, eff_lat_max),
            lon_range=(eff_lon_min, eff_lon_max),
            resolution=spacing * 8,
        )
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc
    except KeyError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Dataset '{dataset}' cannot serve vectors: {exc}",
        ) from exc

    # Subsample to the requested spacing using every 8th cell of the resolved grid.
    step = 8
    u_lats_sub = u_lats[::step]
    u_lons_sub = u_lons[::step]
    u_sub = np.asarray(u_data)[::step, ::step]
    v_sub = np.asarray(v_data)[::step, ::step]

    vectors = []
    for i in range(u_sub.shape[0]):
        for j in range(u_sub.shape[1]):
            uij, vij = u_sub[i, j], v_sub[i, j]
            if not (np.isfinite(uij) and np.isfinite(vij)):
                continue
            vectors.append(
                {
                    "lat": float(u_lats_sub[i]),
                    "lon": float(u_lons_sub[j]),
                    "u": float(uij),
                    "v": float(vij),
                    "speed": float(np.hypot(uij, vij)),
                }
            )

    return {
        "dataset": dataset,
        "time": time_dt.isoformat(),
        "depth": depth_meta["requested_depth"],
        "actual_depth": depth_meta["actual_depth"],
        "selection_method": depth_meta["selection_method"],
        "count": len(vectors),
        "vectors": vectors,
        "region": region,
        "is_synthetic": False,
        "source": _field_label(dataset, adapter),
    }


# ── depth-slice volume endpoint ───────────────────────────────────────────

class DepthRange(BaseModel):
    min: float = Field(0, ge=0)
    max: float = Field(1000, ge=0)


class DataQueryRequest(BaseModel):
    """Request schema for data queries.

    Returns a ``[time][depth][space]`` volume — the contract used by the
    depth-slice visualization (horizontal slices, vertical sections and
    3D volume rendering).
    """
    dataset_id: str = Field(..., min_length=1)
    variable: str = Field(..., min_length=1)
    depth_range: Optional[Tuple[float, float]] = None
    time: Optional[str] = None
    lat_range: Tuple[float, float]
    lon_range: Tuple[float, float]
    depth_levels: Optional[int] = Field(None, ge=2, le=50)

    @field_validator("lat_range")
    @classmethod
    def validate_lat_range(cls, v: Tuple[float, float]) -> Tuple[float, float]:
        if not (-90 <= v[0] <= 90 and -90 <= v[1] <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        if v[0] >= v[1]:
            raise ValueError("lat_range[0] must be < lat_range[1]")
        return v

    @field_validator("lon_range")
    @classmethod
    def validate_lon_range(cls, v: Tuple[float, float]) -> Tuple[float, float]:
        if not (-180 <= v[0] <= 180 and -180 <= v[1] <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        if v[0] >= v[1]:
            raise ValueError("lon_range[0] must be < lon_range[1]")
        return v


@router.post("/data/query", response_model=dict)
async def query_data_volume(request: DataQueryRequest) -> dict:
    """Query a real ocean variable and return the ``[time][depth][space]`` volume.

    Layered on :class:`_SlabAdapter` / the NETCDF adapter so both GODAS and the
    slab sources contribute. Any missing cache returns
    503 ``DATA_NOT_AVAILABLE`` — never a fabricated volume.
    """
    if request.dataset_id not in _FIELD_DATASETS:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset '{request.dataset_id}' is not a real gridded field source. "
                   f"Available: {sorted(_FIELD_DATASETS)}",
        )

    adapter = _adapter_for(request.dataset_id)
    try:
        times = adapter.get_times()
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc

    target_times = []
    if request.time:
        parsed = _parse_time(request.time)
        if parsed is not None:
            target_times.append(parsed)
    if not target_times:
        target_times = times[:1]

    try:
        depth_levels, depth_min, depth_max = real_data.get_dataset_depths(request.dataset_id)
    except DataNotAvailable:
        depth_levels, depth_min, depth_max = [], None, None
    if not depth_levels:
        depth_levels = adapter.get_depths()
        if depth_levels:
            depth_min, depth_max = min(depth_levels), max(depth_levels)
    if not depth_levels:
        depth_levels = [request.depth_range[0] if request.depth_range else 0.0]

    depths_sel = depth_levels
    if request.depth_range:
        dmin, dmax = request.depth_range
        depths_sel = [d for d in depth_levels if dmin <= d <= dmax]
        if request.depth_levels and len(depths_sel) > request.depth_levels:
            depths_sel = depths_sel[:: max(1, len(depths_sel) // request.depth_levels)][: request.depth_levels]
    if not depths_sel:
        depths_sel = [depth_min if request.depth_range is None else request.depth_range[0]]

    time_field = target_times[0]
    depth_meta = adapter.depth_metadata(depths_sel[0])
    try:
        lats, lons, first, _, _, _ = adapter.get_field(
            variable=request.variable,
            time=time_field,
            depth=depth_meta["actual_depth"],
            lat_range=request.lat_range,
            lon_range=request.lon_range,
            resolution=100,
        )
    except (DataNotAvailable, KeyError, FileNotFoundError) as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": str(exc) if isinstance(exc, (DataNotAvailable, FileNotFoundError)) else str(exc),
            },
        ) from exc

    volume = []
    for t in target_times:
        time_slices = []
        for d in depths_sel:
            try:
                _, _, data2d, _, _, _ = adapter.get_field(
                    variable=request.variable,
                    time=t,
                    depth=d,
                    lat_range=request.lat_range,
                    lon_range=request.lon_range,
                    resolution=100,
                )
            except (DataNotAvailable, KeyError):
                data2d = np.full(first.shape, np.nan)
            data2d = np.asarray(data2d)
            if data2d.shape != first.shape:
                data2d = np.full(first.shape, np.nan)
            time_slices.append(_clean_grid(data2d))
        volume.append(time_slices)

    valid_range = [0.0, 1.0]
    try:
        unit = adapter.variable_unit(request.variable)
    except Exception:  # noqa: BLE001
        unit = ""

    return {
        "dataset_id": request.dataset_id,
        "variable": request.variable,
        "units": unit,
        "time": [t.isoformat() for t in target_times],
        "depth": [float(d) for d in depths_sel],
        "lat": [float(x) for x in lats],
        "lon": [float(x) for x in lons],
        "data": volume,  # [time][depth][space]
        "valid_range": valid_range,
        "is_synthetic": False,
        "source": _field_label(request.dataset_id, adapter),
    }


# ── vertical transect endpoint ───────────────────────────────────────────────

class VerticalTransectRequest(BaseModel):
    """Request schema for vertical cross-section (transect) queries.

    Returns a 2D depth-vs-distance slice along a fixed latitude or longitude.
    """
    dataset_id: str = Field(..., min_length=1)
    variable: str = Field(..., min_length=1)
    time: Optional[str] = None
    axis: str = Field(..., pattern="^(lat|lon)$", description="Fixed axis: 'lat' for longitude transect, 'lon' for latitude transect")
    fixed_value: float = Field(..., description="Latitude value for lon transect, or longitude value for lat transect")
    traverse_min: float = Field(..., description="Start of traverse axis (lon for lat transect, lat for lon transect)")
    traverse_max: float = Field(..., description="End of traverse axis")
    depth_min: float = Field(0, ge=0)
    depth_max: float = Field(4000, ge=0)
    depth_levels: int = Field(20, ge=2, le=50)
    traverse_points: int = Field(50, ge=10, le=200)


@router.get("/data/vertical", response_model=dict)
async def query_vertical_transect(
    dataset_id: str = Query(..., description="Dataset ID"),
    variable: str = Query(..., description="Variable name"),
    time: Optional[str] = Query(None, description="ISO datetime"),
    axis: str = Query(..., pattern="^(lat|lon)$", description="Fixed axis"),
    fixed_value: float = Query(..., description="Fixed latitude or longitude value"),
    traverse_min: float = Query(..., description="Traverse axis minimum"),
    traverse_max: float = Query(..., description="Traverse axis maximum"),
    depth_min: float = Query(0, ge=0),
    depth_max: float = Query(4000, ge=0),
    depth_levels: int = Query(20, ge=2, le=50),
    traverse_points: int = Query(50, ge=10, le=200),
) -> dict:
    """Query a vertical cross-section (depth vs distance along a transect).

    For axis='lon': fixed longitude, traverse latitude from traverse_min to traverse_max
    For axis='lat': fixed latitude, traverse longitude from traverse_min to traverse_max
    """
    if dataset_id not in _FIELD_DATASETS:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset '{dataset_id}' is not a real gridded field source. "
                   f"Available: {sorted(_FIELD_DATASETS)}",
        )

    adapter = _adapter_for(dataset_id)
    try:
        times = adapter.get_times()
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc

    target_times = []
    if time:
        parsed = _parse_time(time)
        if parsed is not None:
            target_times.append(parsed)
    if not target_times:
        target_times = times[:1]

    time_field = target_times[0]

    # Get depth levels from dataset
    try:
        all_depths, _, _ = real_data.get_dataset_depths(dataset_id)
    except DataNotAvailable:
        all_depths = adapter.get_depths()
    if not all_depths:
        all_depths = np.linspace(depth_min, depth_max, depth_levels).tolist()

    # Select depth levels within range
    depths_sel = [d for d in all_depths if depth_min <= d <= depth_max]
    if len(depths_sel) > depth_levels:
        step = max(1, len(depths_sel) // depth_levels)
        depths_sel = depths_sel[::step][:depth_levels]
    if not depths_sel:
        depths_sel = [depth_min]

    # Generate traverse axis coordinates
    traverse_coords = np.linspace(traverse_min, traverse_max, traverse_points)

    # Determine lat/lon ranges based on axis
    if axis == 'lon':
        # Fixed longitude, traverse latitude
        lat_range = (float(traverse_min), float(traverse_max))
        lon_range = (float(fixed_value), float(fixed_value))
        traverse_axis_name = 'latitude'
    else:
        # Fixed latitude, traverse longitude
        lat_range = (float(fixed_value), float(fixed_value))
        lon_range = (float(traverse_min), float(traverse_max))
        traverse_axis_name = 'longitude'

    # Fetch first slice to get grid shape
    depth_meta = adapter.depth_metadata(depths_sel[0])
    try:
        lats, lons, first, _, _, _ = adapter.get_field(
            variable=variable,
            time=time_field,
            depth=depth_meta["actual_depth"],
            lat_range=lat_range,
            lon_range=lon_range,
            resolution=traverse_points,
        )
    except (DataNotAvailable, KeyError, FileNotFoundError) as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": str(exc) if isinstance(exc, (DataNotAvailable, FileNotFoundError)) else str(exc),
            },
        ) from exc

    # Build 2D slice: [depth][traverse_distance]
    slice_data = []
    for d in depths_sel:
        try:
            _, _, data2d, _, _, _ = adapter.get_field(
                variable=variable,
                time=time_field,
                depth=d,
                lat_range=lat_range,
                lon_range=lon_range,
                resolution=traverse_points,
            )
        except (DataNotAvailable, KeyError):
            data2d = np.full(first.shape, np.nan)
        data2d = np.asarray(data2d)
        if data2d.shape != first.shape:
            data2d = np.full(first.shape, np.nan)
        # Take the middle row/column since we queried a thin range
        if axis == 'lon':
            # Fixed lon, traverse lat - take middle column
            mid_col = data2d.shape[1] // 2
            slice_data.append(_clean_grid(data2d[:, mid_col:mid_col+1]).flatten())
        else:
            # Fixed lat, traverse lon - take middle row
            mid_row = data2d.shape[0] // 2
            slice_data.append(_clean_grid(data2d[mid_row:mid_row+1, :]).flatten())

    valid_range = [0.0, 1.0]
    try:
        unit = adapter.variable_unit(variable)
    except Exception:
        unit = ""

    return {
        "dataset_id": dataset_id,
        "variable": variable,
        "units": unit,
        "time": time_field.isoformat(),
        "depth": [float(d) for d in depths_sel],
        "traverse_axis": traverse_axis_name,
        "traverse_coords": [float(c) for c in traverse_coords],
        "fixed_axis": "longitude" if axis == 'lon' else "latitude",
        "fixed_value": float(fixed_value),
        "data": slice_data,  # [depth][traverse]
        "valid_range": valid_range,
        "is_synthetic": False,
        "source": _field_label(dataset_id, adapter),
    }