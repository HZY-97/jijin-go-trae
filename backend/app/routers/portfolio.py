"""组合聚合与大盘行情。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..services import portfolio

router = APIRouter(tags=["portfolio"])


@router.get("/portfolio")
def get_portfolio(asOf: str | None = None, refresh: bool = False) -> dict[str, Any]:
    return portfolio.build_portfolio(as_of=asOf, force=refresh)


@router.get("/market")
def get_market(refresh: bool = False) -> dict[str, Any]:
    from ..datasources import sina

    data, stale, error = sina.fetch_indices(force=refresh)
    if stale and error:
        data = {**data, "warning": error}
    return data
