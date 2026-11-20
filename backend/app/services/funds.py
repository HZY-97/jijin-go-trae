"""基金与费率档案的读写服务。"""

from __future__ import annotations

from typing import Any

from .. import store
from ..datasources import eastmoney


def list_funds() -> list[dict[str, Any]]:
    return store.list_fund_records()


def get_fund(code: str) -> dict[str, Any] | None:
    return store.get_fund_record(code)


def upsert_fund(
    fund: dict[str, Any], fee: dict[str, Any], fee_source: str = "manual"
) -> dict[str, Any]:
    record = {
        "fund": fund,
        "fee": fee,
        "feeSource": fee_source,
        "updatedAt": store.now_iso(),
    }
    return store.upsert_fund_record(record)


def update_fee(code: str, fee: dict[str, Any]) -> dict[str, Any] | None:
    record = store.get_fund_record(code)
    if record is None:
        return None
    record["fee"] = fee
    record["feeSource"] = "manual"
    record["updatedAt"] = store.now_iso()
    return store.upsert_fund_record(record)


def delete_fund(code: str) -> dict[str, Any]:
    """删除基金，同时清掉它的流水（持仓是由流水推导出来的）。"""
    removed = store.delete_fund_record(code)
    trades = [t for t in store.list_trades() if t["fundCode"] == code]
    for trade in trades:
        store.delete_trade(trade["id"])
    return {"removed": removed, "removedTrades": len(trades)}


def auto_fetch_fee(code: str, force: bool = False) -> dict[str, Any]:
    """从天天基金抓取费率档案（不入库，供表单预览）。"""
    fee, stale, error = eastmoney.fetch_fee_profile(code, force=force)
    if fee is None:
        raise eastmoney.base.SourceError(error or "费率抓取失败")

    result: dict[str, Any] = {"code": code, "fee": fee, "source": "eastmoney"}
    try:
        basic, _s, _e = eastmoney.fetch_basic(code, force=force)
        result["fund"] = {
            "code": code,
            "name": basic["name"],
            "category": basic["category"],
            "company": basic["company"],
        }
        result["quote"] = basic
    except Exception:
        pass
    if stale:
        result["stale"] = True
        result["warning"] = error
    return result
