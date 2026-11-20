"""基金与费率档案接口。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..datasources import eastmoney
from ..models import FeeUpdateIn, FundUpsertIn
from ..services import funds, portfolio

router = APIRouter(tags=["funds"])


def _fee_dict(fee: Any) -> dict[str, Any]:
    return {
        "subscribeRate": fee.subscribeRate,
        "dailyHoldRate": fee.dailyHoldRate,
        "redeemTiers": [
            {"minDays": t.minDays, "maxDays": t.maxDays, "rate": t.rate}
            for t in fee.redeemTiers
        ],
        "minSubscribe": fee.minSubscribe,
    }


@router.get("/funds")
def list_funds() -> list[dict[str, Any]]:
    return funds.list_funds()


@router.get("/funds/{code}")
def get_fund(code: str) -> dict[str, Any]:
    detail = portfolio.fund_detail(code)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"未找到基金 {code}")
    return detail


@router.post("/funds")
def upsert_fund(payload: FundUpsertIn) -> dict[str, Any]:
    fund = payload.fund.model_dump()
    fee = _fee_dict(payload.fee)
    record = funds.upsert_fund(fund, fee)
    return record


@router.put("/funds/{code}")
def update_fee(code: str, payload: FeeUpdateIn) -> dict[str, Any]:
    record = funds.update_fee(code, _fee_dict(payload.fee))
    if record is None:
        raise HTTPException(status_code=404, detail=f"未找到基金 {code}")
    return record


@router.delete("/funds/{code}")
def delete_fund(code: str) -> dict[str, Any]:
    result = funds.delete_fund(code)
    if not result["removed"]:
        raise HTTPException(status_code=404, detail=f"未找到基金 {code}")
    return result


@router.get("/funds/{code}/fee/auto")
def auto_fee(code: str, refresh: bool = False) -> dict[str, Any]:
    try:
        return funds.auto_fetch_fee(code, force=refresh)
    except eastmoney.base.SourceError as exc:
        raise HTTPException(status_code=502, detail=f"费率抓取失败：{exc}") from exc


@router.get("/funds/{code}/nav-history")
def nav_history(code: str, range: str = "180") -> dict[str, Any]:
    points, stale, error = eastmoney.fetch_nav_history(code)
    if not points:
        raise HTTPException(status_code=502, detail=f"历史净值获取失败：{error}")

    if range != "all":
        try:
            days = max(1, int(range))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="range 必须是数字或 all") from exc
        points = points[-days:]

    return {
        "code": code,
        "points": points,
        "stale": stale,
        "warning": error if stale else None,
    }
