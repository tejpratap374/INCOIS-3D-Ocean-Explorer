"""System health and metadata endpoints."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["system"])


@router.get("/api/health")
async def health_check():
    """Service health check."""
    settings = get_settings()
    return {
        "status": "online",
        "service": settings.api_title,
        "version": settings.api_version,
        "debug": settings.debug,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/api/metadata")
async def get_metadata():
    """Get service-level metadata."""
    settings = get_settings()
    return {
        "title": settings.api_title,
        "version": settings.api_version,
        "organization": "INCOIS",
        "parent_ministry": "Ministry of Earth Sciences (MoES)",
        "platform": "INCOIS Ocean Explorer",
        "build_timestamp": datetime.utcnow().isoformat(),
        "api_docs": "/docs",
        "openapi_schema": "/openapi.json",
    }


@router.get("/api/system/status")
async def system_status():
    """Get system component status."""
    from app.api.datasets import _godas_adapter, godas_meta

    godas = godas_meta()
    sources = [
        {"id": "godas_indian_ocean", "available": godas["is_data_available"]},
        {"id": "ww3_waves", "available": _wave_cache_exists()},
    ]
    for src in ["argo_global_ifremer", "ifremer_global_gliders", "incois_las_indian_ocean",
                "copernicus_global_multyear_phy_001_030", "incois_omni_buoys"]:
        try:
            from app.services.real_data import get_dataset_times
            get_dataset_times(src)
            sources.append({"id": src, "available": True})
        except Exception:  # noqa: BLE001 - cache missing
            sources.append({"id": src, "available": False})

    return {
        "api": {"status": "online", "uptime": "ok"},
        "data_service": {"status": "online", "adapter": "real-data-only"},
        "renderer": {"status": "client-side", "engine": "WebGL via Three.js"},
        "sources": sources,
        "data_freshness": datetime.utcnow().isoformat(),
        "cache_status": "ok",
    }


def _wave_cache_exists() -> bool:
    from pathlib import Path
    return (
        Path(__file__).resolve().parent.parent.parent
        / "data" / "model_db" / "wave" / "ww3_snapshot.json"
    ).exists()
