"""设置接口。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from .. import store
from ..models import SettingsIn

router = APIRouter(tags=["settings"])


@router.get("/settings")
def get_settings() -> dict[str, Any]:
    return store.get_settings()


@router.put("/settings")
def put_settings(payload: SettingsIn) -> dict[str, Any]:
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    return store.put_settings(patch)
