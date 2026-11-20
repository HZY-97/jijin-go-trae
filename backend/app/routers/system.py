"""系统级接口：健康检查、导入导出、清空。"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from .. import calc, config, store
from ..models import ImportIn

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": "0.1.0",
        "asOf": calc.today(),
        "dataDir": str(config.DATA_DIR),
        "cacheDir": str(config.CACHE_DIR),
        "funds": len(store.list_fund_records()),
        "trades": len(store.list_trades()),
    }


@router.get("/export")
def export_data() -> dict[str, Any]:
    return {
        "version": 1,
        "exportedAt": store.now_iso(),
        "funds": store.list_fund_records(),
        "trades": store.list_trades(),
        "settings": store.get_settings(),
    }


@router.post("/import")
def import_data(payload: ImportIn) -> dict[str, Any]:
    funds = payload.funds
    trades = payload.trades
    if not funds and not trades:
        raise HTTPException(status_code=400, detail="导入内容为空")

    for record in funds:
        store.upsert_fund_record(record)
    for trade in trades:
        store.upsert_trade(trade)
    if payload.settings:
        store.put_settings(payload.settings)

    return {
        "importedFunds": len(funds),
        "importedTrades": len(trades),
    }


@router.delete("/data")
def clear_data(confirm: bool = False) -> dict[str, Any]:
    if not confirm:
        raise HTTPException(status_code=400, detail="需要 confirm=true 才会清空")
    store.funds_store.write({"version": 1, "updatedAt": store.now_iso(), "items": []})
    store.trades_store.write({"version": 1, "updatedAt": store.now_iso(), "items": []})
    return {"cleared": True}
