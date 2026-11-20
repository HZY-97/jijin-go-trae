"""组合聚合：拉行情 → 做T配对 → 推导持仓 → 汇总 → 隐性成本曲线。"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from typing import Any

from .. import calc, store
from ..datasources import eastmoney, sina

_COST_CURVE_DAYS = 90


def _fetch_quotes(codes: list[str], force: bool) -> dict[str, dict[str, Any]]:
    """并发拉取基金最新净值。返回 code → quote（失败的基金不进字典）。"""
    if not codes:
        return {}
    with ThreadPoolExecutor(max_workers=min(8, len(codes))) as pool:
        results = list(pool.map(lambda c: eastmoney.fetch_basic(c, force=force), codes))
    quotes: dict[str, dict[str, Any]] = {}
    for code, (data, _stale, _err) in zip(codes, results):
        if data:
            quotes[code] = data
    return quotes


def _fetch_nav_histories(
    codes: list[str], force: bool
) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    """并发拉取历史净值（用于成本曲线）。"""
    if not codes:
        return {}, []
    with ThreadPoolExecutor(max_workers=min(6, len(codes))) as pool:
        results = list(pool.map(lambda c: eastmoney.fetch_nav_history(c, force=force), codes))
    histories: dict[str, list[dict[str, Any]]] = {}
    errors: list[str] = []
    for code, (data, _stale, err) in zip(codes, results):
        if data:
            histories[code] = data
        elif err:
            errors.append(f"{code} 历史净值获取失败：{err}")
    return histories, errors


def build_cost_curve(
    fund_records: list[dict[str, Any]],
    trades: list[dict[str, Any]],
    quotes: dict[str, dict[str, Any]],
    histories: dict[str, list[dict[str, Any]]],
    as_of: str,
    days: int = _COST_CURVE_DAYS,
) -> list[dict[str, Any]]:
    """隐性成本按日累计曲线。

    - 申购费 / 赎回费：按费用实际发生日累加
    - 持有费：按买入腿逐日计提，金额用当日净值估算
    """
    end = calc.parse_date(as_of)
    start = end - timedelta(days=days)

    nav_by_date: dict[str, dict[str, float]] = {}
    for code, points in histories.items():
        nav_by_date[code] = {p["date"]: p["nav"] for p in points}

    buys_by_code: dict[str, list[dict[str, Any]]] = {}
    for trade in trades:
        if trade["side"] == "buy":
            buys_by_code.setdefault(trade["fundCode"], []).append(trade)

    fee_by_code = {r["fund"]["code"]: r["fee"] for r in fund_records}

    curve: list[dict[str, Any]] = []
    for offset in range(days + 1):
        current = start + timedelta(days=offset)
        day = current.strftime("%Y-%m-%d")
        total = 0.0

        for trade in trades:
            if trade["date"] <= day:
                total += trade["fee"]

        for code, legs in buys_by_code.items():
            rate = fee_by_code.get(code, {}).get("dailyHoldRate", 0)
            if not rate:
                continue
            nav_map = nav_by_date.get(code, {})
            nav = nav_map.get(day)
            if nav is None:
                quote = quotes.get(code)
                nav = quote["nav"] if quote else None
            if nav is None:
                continue
            for leg in legs:
                if leg["date"] > day:
                    continue
                held = (current - calc.parse_date(leg["date"])).days
                if held <= 0:
                    continue
                total += calc.daily_hold_fee(leg["shares"] * nav, rate, held)

        curve.append({"date": day, "value": calc.round2(total)})

    return curve


def build_portfolio(as_of: str | None = None, force: bool = False) -> dict[str, Any]:
    """一次拿全：持仓 / 流水 / 做T配对 / 大盘 / 汇总 / 成本曲线。"""
    as_of = as_of or calc.today()
    warnings: list[str] = []
    degraded = False

    records = store.list_fund_records()
    trades = store.list_trades()
    settings = store.get_settings()

    codes = [r["fund"]["code"] for r in records]
    quotes = _fetch_quotes(codes, force)
    for code in codes:
        if code not in quotes:
            degraded = True
            warnings.append(f"{code} 最新净值获取失败，持仓按最后已知数据估算")

    pairs = calc.pair_trades(trades, settings["pairMaxGapDays"])["pairs"]

    holdings: list[dict[str, Any]] = []
    for record in records:
        fund = record["fund"]
        code = fund["code"]
        quote = quotes.get(code)
        nav = quote["nav"] if quote else 0.0
        nav_date = quote["navDate"] if quote else ""
        change_pct = quote["changePct"] if quote else None

        holding = calc.derive_holding(
            fund,
            record["fee"],
            trades,
            nav,
            nav_date,
            None,
            None,
            None,
            pairs,
            as_of,
            day_change_pct=change_pct,
        )
        if holding["shares"] > 0:
            holdings.append(holding)

    market, market_stale, market_err = sina.fetch_indices(force)
    if market_stale:
        warnings.append(f"大盘指数使用缓存数据：{market_err}")
    elif market_err:
        degraded = True
        warnings.append(f"大盘指数获取失败：{market_err}")

    histories, history_errors = _fetch_nav_histories(codes, force)
    warnings.extend(history_errors)
    if history_errors:
        degraded = True

    cost_curve = build_cost_curve(records, trades, quotes, histories, as_of)

    source = "live"
    if degraded:
        source = "degraded"
    elif market_stale:
        source = "stale"

    return {
        "asOf": as_of,
        "holdings": holdings,
        "trades": trades,
        "pairs": pairs,
        "market": market,
        "summary": calc.summarize(holdings),
        "costCurve": cost_curve,
        "meta": {
            "generatedAt": store.now_iso(),
            "source": source,
            "warnings": warnings,
            "fundStatus": [
                {
                    "code": code,
                    "navDate": quotes[code]["navDate"] if code in quotes else "",
                    "fetchedAt": store.now_iso(),
                    "stale": code not in quotes,
                }
                for code in codes
            ],
        },
    }


def fund_detail(code: str, as_of: str | None = None) -> dict[str, Any] | None:
    """单只基金的档案 + 行情 + 持仓。"""
    as_of = as_of or calc.today()
    record = store.get_fund_record(code)
    if record is None:
        return None

    quote, _stale, _err = eastmoney.fetch_basic(code)
    trades = store.list_trades()
    settings = store.get_settings()
    pairs = calc.pair_trades(trades, settings["pairMaxGapDays"])["pairs"]

    holding = calc.derive_holding(
        record["fund"],
        record["fee"],
        trades,
        quote["nav"] if quote else 0.0,
        quote["navDate"] if quote else "",
        None,
        None,
        None,
        pairs,
        as_of,
        day_change_pct=quote["changePct"] if quote else None,
    )

    return {
        "fund": record["fund"],
        "fee": record["fee"],
        "feeSource": record.get("feeSource", "manual"),
        "updatedAt": record.get("updatedAt", ""),
        "quote": quote,
        "holding": holding,
        "trades": [t for t in trades if t["fundCode"] == code],
        "pairs": [p for p in pairs if p["fundCode"] == code],
    }
