"""交易流水接口。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..models import TradeIn
from ..services import trades

router = APIRouter(tags=["trades"])


@router.get("/trades")
def list_trades(fundCode: str | None = None) -> dict[str, Any]:
    return {"trades": trades.list_trades(fundCode)}


@router.post("/trades")
def create_trade(payload: TradeIn) -> dict[str, Any]:
    return {"trade": trades.create_trade(payload.model_dump())}


@router.put("/trades/{trade_id}")
def update_trade(trade_id: str, payload: TradeIn) -> dict[str, Any]:
    trade = trades.update_trade(trade_id, payload.model_dump())
    if trade is None:
        raise HTTPException(status_code=404, detail=f"未找到流水 {trade_id}")
    return {"trade": trade}


@router.delete("/trades/{trade_id}")
def delete_trade(trade_id: str) -> dict[str, Any]:
    if not trades.delete_trade(trade_id):
        raise HTTPException(status_code=404, detail=f"未找到流水 {trade_id}")
    return {"deleted": True, "id": trade_id}
