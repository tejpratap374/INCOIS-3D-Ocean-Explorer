"""Analysis endpoints (model vs observation comparison) — real data only."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.api.datasets import _godas_adapter
from app.api.observations import _get_argo_floats
from app.models.ocean import OceanField
from app.services.comparison import ComparisonService
from app.services.real_data import DataNotAvailable

router = APIRouter(prefix="/api/comparison", tags=["analysis"])

_COMPARISON = ComparisonService()


@router.get("")
async def compare_model_observation(
    dataset: str = Query("godas_indian_ocean"),
    variable: str = Query("temperature"),
    time: Optional[str] = Query(None),
    depth_min: float = Query(0.0),
    depth_max: float = Query(2000.0),
    lat_min: float = Query(-5.0),
    lat_max: float = Query(25.0),
    lon_min: float = Query(55.0),
    lon_max: float = Query(100.0),
):
    """Compare real GODAS model fields against real Argo float positions.

    A pair is formed only where a real observation value is mirrored for a
    float (see scripts/fetch_argo_gdac.py); otherwise the result reports
    ``sample_count: 0`` with a note — the endpoint never fabricates
    observations.
    """
    adapter = _godas_adapter()
    if adapter is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": (
                    "GODAS NetCDF cache missing. Run scripts/fetch_godas_sample.py "
                    "or set OCEAN_DATA_FILE."
                ),
            },
        )

    times = adapter.get_times()
    if time:
        try:
            time_dt = datetime.fromisoformat(time.replace("Z", "+00:00").split("+")[0])
        except ValueError:
            time_dt = times[0]
    else:
        time_dt = times[0]

    try:
        lat, lon, data, vmin, vmax, vmean = adapter.get_field(
            variable=variable,
            time=time_dt,
            depth=None,
            lat_range=(lat_min, lat_max),
            lon_range=(lon_min, lon_max),
            resolution=80,
        )
    except DataNotAvailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"error_code": "DATA_NOT_AVAILABLE", "message": str(exc)},
        ) from exc

    field = OceanField(
        variable=variable,
        unit=adapter.variable_unit(variable),
        time=time_dt,
        depth=None,
        min_value=vmin,
        max_value=vmax,
        mean_value=vmean,
        latitude=lat.tolist(),
        longitude=lon.tolist(),
        data=data.tolist(),
        is_synthetic=False,
        source="NCEP GODAS reanalysis (real)",
    )

    floats = _get_argo_floats()
    # Attach the REAL per-float profile values (from mirrored GDAC NetCDF) so
    # the comparison can form genuine model-vs-observation pairs where the
    # profiles were downloaded (scripts/fetch_argo_gdac.py --profiles N).
    from app.adapters.argo_adapter import get_argo_adapter

    argo_prof_adapter = get_argo_adapter()
    for fl in floats:
        try:
            real_prof = argo_prof_adapter.get_profile(fl)
        except Exception:  # noqa: BLE001 - DataNotAvailable or undecodable
            real_prof = None
        if real_prof is not None:
            setattr(fl, "_real_profile", real_prof)
    result = _COMPARISON.compute_comparison(field, floats, depth_min, depth_max, variable)
    return result.model_dump(mode="json")


@router.get("/metadata")
async def get_comparison_metadata():
    """Get metadata about available comparison variables and ranges."""
    adapter = _godas_adapter()
    if adapter is None:
        raise HTTPException(
            status_code=503,
            detail={
                "error_code": "DATA_NOT_AVAILABLE",
                "message": "GODAS cache missing — comparison unavailable.",
            },
        )
    try:
        n_argo = len(_get_argo_floats())
    except DataNotAvailable:
        n_argo = 0
    return {
        "variables": adapter.get_variables(),
        "depth_range": [0.0, float(max(adapter.get_depths() or [2000.0]))],
        "available_argo_floats": n_argo,
        "model_dataset": "NCEP GODAS reanalysis (real)",
    }