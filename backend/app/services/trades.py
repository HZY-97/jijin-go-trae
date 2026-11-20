"""交易流水服务：自动补全金额与费用。"""

from __future__ import annotations

import uuid
from typing import Any

from .. import calc, store


def list_trades(fund_code: str | None = None) -> list[dict[str, Any]]:
    trades = store.list_trades()
    if fund_code:
        trades = [t for t in trades if t["fundCode"] == fund_code]
    return sorted(trades, key=lambda t: (t["date"], t["id"]), reverse=True)


def _first_buy_date(trades: list[dict[str, Any]], fund_code: str) -> str | None:
    dates = [t["date"] for t in trades if t["fundCode"] == fund_code and t["side"] == "buy"]
    return min(dates) if dates else None


def _auto_fee_rate(payload: dict[str, Any], fee_profile: dict[str, Any] | None) -> float:
    """按买入/卖出方向取费率档案里的费率。"""
    if not fee_profile:
        return 0.0
    if payload["side"] == "buy":
        return fee_profile["subscribeRate"]

    all_trades = store.list_trades()
    first_buy = _first_buy_date(all_trades, payload["fundCode"]) or payload["date"]
    days = max(0, calc.days_between(first_buy, payload["date"]))
    tier = calc.match_redeem_tier(fee_profile["redeemTiers"], days)
    return tier["rate"] if tier else 0.0


def _build_trade(payload: dict[str, Any], trade_id: str) -> dict[str, Any]:
    record = store.get_fund_record(payload["fundCode"])
    fee_profile = record["fee"] if record else None

    shares = float(payload["shares"])
    nav = float(payload["nav"])
    amount = payload.get("amount")
    amount = calc.round2(float(amount)) if amount is not None else calc.round2(shares * nav)

    fee_rate = payload.get("feeRate")
    if fee_rate is None:
        fee_rate = _auto_fee_rate(payload, fee_profile)
    fee_rate = float(fee_rate)

    fee = payload.get("fee")
    fee = calc.round2(float(fee)) if fee is not None else calc.round2(amount * (fee_rate / 100))

    trade: dict[str, Any] = {
        "id": trade_id,
        "fundCode": payload["fundCode"],
        "date": payload["date"],
        "side": payload["side"],
        "shares": shares,
        "nav": nav,
        "amount": amount,
        "feeRate": fee_rate,
        "fee": fee,
    }
    note = payload.get("note")
    if note:
        trade["note"] = note
    return trade


def create_trade(payload: dict[str, Any]) -> dict[str, Any]:
    trade = _build_trade(payload, "t" + uuid.uuid4().hex[:12])
    return store.upsert_trade(trade)


def update_trade(trade_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    if store.get_trade(trade_id) is None:
        return None
    trade = _build_trade(payload, trade_id)
    return store.upsert_trade(trade)


def delete_trade(trade_id: str) -> bool:
    return store.delete_trade(trade_id)
