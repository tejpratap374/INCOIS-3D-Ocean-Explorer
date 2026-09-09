"""Comparison service for model vs observation analysis."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

import numpy as np

from app.models.ocean import ArgoFloat, ComparisonResult, OceanField


class ComparisonService:
    """Compute model vs observation comparison statistics."""

    @staticmethod
    def _real_observation_value(
        f: ArgoFloat, variable: str, depth_min: float, depth_max: float
    ) -> Optional[float]:
        """Return a real observation value for ``f`` within the depth window.

        ``f`` carries a ``_real_profile`` (an :class:`ArgoProfile` read from a
        mirrored GDAC NetCDF) when ``scripts/fetch_argo_gdac.py --profiles`` has
        downloaded it. Returns None when no real value is available — the pair
        is skipped, never fabricated.
        """
        prof = getattr(f, "_real_profile", None)
        if prof is None:
            return None
        series: Optional[List[float]] = {
            "temperature": prof.temperature,
            "salinity": prof.salinity,
            "pressure": prof.pressure,
        }.get(variable)
        if not series or not prof.depth:
            return None
        # Pick the shallowest real value inside the requested depth window.
        best: Optional[float] = None
        for depth, value in zip(prof.depth, series):
            if depth_min <= depth <= depth_max:
                best = float(value)
                break
        return best

    @staticmethod
    def compute_comparison(
        field: OceanField,
        argo_floats: List[ArgoFloat],
        depth_min: float = 0.0,
        depth_max: float = 2000.0,
        variable: str = "temperature",
    ) -> ComparisonResult:
        """Compute statistics comparing model field against Argo observations.

        Real-data only: pairs are formed only where a REAL observation value is
        available for the float (passed in via ``observation_values`` on the
        result — see ``real_data`` docs). This implementation samples the model
        at the float positions; genuine observation values are provided by the
        caller from the mirrored Argo NetCDF when present. Nothing is fabricated.
        """
        model_vals: List[float] = []
        obs_vals: List[float] = []
        obs_lats: List[float] = []
        obs_lons: List[float] = []

        # Bilinear interpolation of model field to float positions
        lat_arr = np.array(field.latitude)
        lon_arr = np.array(field.longitude)
        field_arr = np.asarray(field.data, dtype=float)

        if field_arr.size == 0 or float(np.nanmin(field_arr)) == float("nan"):
            return ComparisonResult(
                variable=variable,
                depth_min=depth_min,
                depth_max=depth_max,
                time=field.time,
                sample_count=0,
                mean_bias=0.0,
                rmse=0.0,
                mae=0.0,
                min_diff=0.0,
                max_diff=0.0,
                note=(
                    "Model field empty or all-NaN — no model/observation pairs "
                    "are possible for this window."
                ),
            )

        for f in argo_floats:
            lat, lon = f.latitude, f.longitude
            lat_idx = int(np.argmin(np.abs(lat_arr - lat)))
            lon_idx = int(np.argmin(np.abs(lon_arr - lon)))
            m_val = field_arr[lat_idx][lon_idx]
            if not np.isfinite(m_val):
                continue
            # A real observation value is attached only when the per-float
            # profile NetCDF was mirrored; otherwise we do not form a pair.
            obs_val = ComparisonService._real_observation_value(
                f, variable, depth_min, depth_max
            )
            if obs_val is None:
                continue
            model_vals.append(float(m_val))
            obs_vals.append(float(obs_val))
            obs_lats.append(lat)
            obs_lons.append(lon)

        if not model_vals:
            return ComparisonResult(
                variable=variable,
                depth_min=depth_min,
                depth_max=depth_max,
                time=field.time,
                sample_count=0,
                mean_bias=0.0,
                rmse=0.0,
                mae=0.0,
                min_diff=0.0,
                max_diff=0.0,
                note=(
                    "No real Argo observation values are mirrored for these "
                    "floats yet. Run scripts/fetch_argo_gdac.py to download the "
                    "per-float NetCDF profiles — the comparison never fabricates "
                    "observations."
                ),
            )

        model_arr = np.array(model_vals)
        obs_arr = np.array(obs_vals)
        diff = obs_arr - model_arr

        rmse = float(np.sqrt(np.mean(diff**2)))
        mae = float(np.mean(np.abs(diff)))
        mean_bias = float(np.mean(diff))

        # Pearson correlation
        if len(model_arr) > 1:
            cov = np.mean((model_arr - np.mean(model_arr)) * (obs_arr - np.mean(obs_arr)))
            std_prod = np.std(model_arr) * np.std(obs_arr)
            correlation = float(cov / std_prod) if std_prod > 0 else None
        else:
            correlation = None

        return ComparisonResult(
            variable=variable,
            depth_min=depth_min,
            depth_max=depth_max,
            time=field.time,
            sample_count=len(model_vals),
            mean_bias=mean_bias,
            rmse=rmse,
            mae=mae,
            min_diff=float(np.min(diff)),
            max_diff=float(np.max(diff)),
            correlation=correlation,
            model_values=model_vals,
            observation_values=obs_vals,
            observation_latitudes=obs_lats,
            observation_longitudes=obs_lons,
        )
