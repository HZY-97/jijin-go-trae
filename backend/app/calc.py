"""calc.ts 的逐函数移植 —— 后端唯一计算真相源。

移植要点：
- JS `Math.round(x)` 等价于 `floor(x + 0.5)`（半值向 +∞ 进位），Python 内置 `round()` 是银行家舍入，
  因此自建 `_js_round`，并复刻 TS 里的 `+ Number.EPSILON` 偏移。
- 中间量不做中间舍入，只在输出点 round2 / round4，与 TS 完全一致。
- 日期用 datetime.date 做纯日期运算，无时区问题。
"""

from __future__ import annotations

import math
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any

from . import config

CN_TZ = timezone(timedelta(hours=config.CN_UTC_OFFSET_HOURS))

_EPS = sys.float_info.epsilon  # == Number.EPSILON


# ============================================================
# 日期工具
# ============================================================


def parse_date(s: str) -> date:
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))


def format_date(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def add_days(s: str, n: int) -> str:
    return format_date(parse_date(s) + timedelta(days=n))


def days_between(from_: str, to: str) -> int:
    return (parse_date(to) - parse_date(from_)).days


def today(as_of: str | None = None) -> str:
    if as_of:
        return as_of
    return datetime.now(CN_TZ).strftime("%Y-%m-%d")


# ============================================================
# 数值工具
# ============================================================


def _js_round(x: float) -> int:
    """等价于 JS 的 Math.round(x)。"""
    return math.floor(x + 0.5)


def round2(n: float) -> float:
    return _js_round((n + _EPS) * 100) / 100


def round4(n: float) -> float:
    return _js_round((n + _EPS) * 10000) / 10000


# ============================================================
# 费率计算
# ============================================================


def match_redeem_tier(tiers: list[dict[str, Any]], days: int) -> dict[str, Any] | None:
    for t in tiers:
        max_days = t.get("maxDays")
        if days >= t["minDays"] and (max_days is None or days <= max_days):
            return t
    return None


def next_tier(
    tiers: list[dict[str, Any]], days: int
) -> dict[str, Any] | None:
    """找出下一个更有利的费率档位（天数为 0 的档位通常费率更低）。"""
    current = match_redeem_tier(tiers, days)
    current_rate = current["rate"] if current else math.inf
    candidates = [
        t for t in tiers if t["minDays"] > days and t["rate"] < current_rate
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda t: t["minDays"])
    tier = candidates[0]
    return {"tier": tier, "inDays": tier["minDays"] - days}


def subscribe_fee(amount: float, rate: float) -> float:
    return round2(amount * (rate / 100))


def redeem_fee(amount: float, tier: dict[str, Any] | None) -> float:
    if not tier:
        return 0
    return round2(amount * (tier["rate"] / 100))


def daily_hold_fee(market_value: float, annual_rate: float, days: int = 1) -> float:
    return round2((market_value * (annual_rate / 100)) / 365 * days)


# ============================================================
# 做 T 配对
# ============================================================

DEFAULT_MAX_GAP_DAYS = 10


def pair_trades(
    trades: list[dict[str, Any]], max_gap_days: int = DEFAULT_MAX_GAP_DAYS
) -> dict[str, Any]:
    """识别做 T 配对：同基金、卖前买后、间隔 ≤ maxGapDays、FIFO。

    返回 {"pairs": [...], "unmatched": [...]}。
    """
    ordered = sorted(trades, key=lambda t: parse_date(t["date"]))

    pairs: list[dict[str, Any]] = []
    consumed: set[str] = set()
    unmatched: list[dict[str, Any]] = []

    by_fund: dict[str, list[dict[str, Any]]] = {}
    for t in ordered:
        by_fund.setdefault(t["fundCode"], []).append(t)

    for fund_code, items in by_fund.items():
        sells = [t for t in items if t["side"] == "sell"]
        buys = [t for t in items if t["side"] == "buy"]

        for sell in sells:
            if sell["id"] in consumed:
                continue

            sell_date = parse_date(sell["date"])
            best: dict[str, Any] | None = None
            best_gap = math.inf

            for buy in buys:
                if buy["id"] in consumed:
                    continue
                if parse_date(buy["date"]) <= sell_date:
                    continue
                gap = days_between(sell["date"], buy["date"])
                if gap > max_gap_days:
                    continue
                if gap < best_gap:
                    best_gap = gap
                    best = buy

            if best is None:
                unmatched.append(sell)
                continue

            t_shares = min(sell["shares"], best["shares"])
            spread_profit = round2((sell["nav"] - best["nav"]) * t_shares)
            sell_fee_portion = round2((sell["feeRate"] / 100) * sell["nav"] * t_shares)
            buy_fee_portion = round2((best["feeRate"] / 100) * best["nav"] * t_shares)
            total_fee = round2(sell_fee_portion + buy_fee_portion)
            net_profit = round2(spread_profit - total_fee)
            buy_amount = round2(best["nav"] * t_shares)

            pairs.append(
                {
                    "id": f"tp-{sell['id']}-{best['id']}",
                    "fundCode": fund_code,
                    "sell": sell,
                    "buy": best,
                    "spreadProfit": spread_profit,
                    "totalFee": total_fee,
                    "netProfit": net_profit,
                    "netRate": round2((net_profit / buy_amount) * 100) if buy_amount > 0 else 0,
                    "daysBetween": best_gap,
                }
            )

            consumed.add(sell["id"])
            consumed.add(best["id"])

    unmatched_ids = {t["id"] for t in unmatched}
    for t in ordered:
        if t["id"] not in consumed and t["id"] not in unmatched_ids:
            unmatched.append(t)

    return {"pairs": pairs, "unmatched": unmatched}


# ============================================================
# 持仓推导
# ============================================================


def derive_holding(
    fund: dict[str, Any],
    fee: dict[str, Any],
    trades: list[dict[str, Any]],
    nav: float,
    nav_date: str,
    estimate_nav: float | None = None,
    estimate_change: float | None = None,
    estimate_time: str | None = None,
    t_pairs: list[dict[str, Any]] | None = None,
    as_of: str | None = None,
    day_change_pct: float | None = None,
) -> dict[str, Any]:
    as_of = as_of or today()
    t_pairs = t_pairs or []

    mine = sorted(
        [t for t in trades if t["fundCode"] == fund["code"]],
        key=lambda t: parse_date(t["date"]),
    )

    shares = 0.0
    cost_amount = 0.0
    subscribe_fee_paid = 0.0
    redeem_fee_paid = 0.0
    hold_fee_accrued = 0.0
    first_buy_date: str | None = None

    for t in mine:
        if t["side"] == "buy":
            shares += t["shares"]
            cost_amount += t["amount"] + t["fee"]
            subscribe_fee_paid += t["fee"]
            if first_buy_date is None:
                first_buy_date = t["date"]
        else:
            avg_cost = cost_amount / shares if shares > 0 else 0
            cost_amount -= avg_cost * t["shares"]
            shares -= t["shares"]
            redeem_fee_paid += t["fee"]

    # 持有费：按买入腿逐段计提
    for t in mine:
        if t["side"] != "buy":
            continue
        days = max(0, days_between(t["date"], as_of))
        value = t["shares"] * nav
        hold_fee_accrued += daily_hold_fee(value, fee["dailyHoldRate"], days)

    market_value = round2(shares * nav)
    raw_cost_amount = cost_amount - (subscribe_fee_paid + hold_fee_accrued) + redeem_fee_paid
    raw_cost_price = round4(raw_cost_amount / shares) if shares > 0 else 0
    cost_price = round4(cost_amount / shares) if shares > 0 else 0

    profit = round2(market_value - cost_amount)
    profit_rate = round2((profit / cost_amount) * 100) if cost_amount > 0 else 0

    hidden_cost = round2(subscribe_fee_paid + redeem_fee_paid + hold_fee_accrued)
    total_in = sum(t["amount"] for t in mine if t["side"] == "buy")
    hidden_cost_rate = round2((hidden_cost / total_in) * 100) if total_in > 0 else 0

    holding_days = days_between(first_buy_date, as_of) if first_buy_date else 0
    next_info = next_tier(fee["redeemTiers"], holding_days)
    my_pairs = [p for p in t_pairs if p["fundCode"] == fund["code"]]

    holding: dict[str, Any] = {
        "fund": fund,
        "fee": fee,
        "shares": round2(shares),
        "costPrice": cost_price,
        "rawCostPrice": raw_cost_price,
        "nav": nav,
        "navDate": nav_date,
        "estimateNav": estimate_nav,
        "estimateChange": estimate_change,
        "estimateTime": estimate_time,
        "marketValue": market_value,
        "profit": profit,
        "profitRate": profit_rate,
        "subscribeFeePaid": round2(subscribe_fee_paid),
        "redeemFeePaid": round2(redeem_fee_paid),
        "holdFeeAccrued": round2(hold_fee_accrued),
        "hiddenCost": hidden_cost,
        "hiddenCostRate": hidden_cost_rate,
        "holdingDays": holding_days,
        "nextRedeemTier": next_info["tier"] if next_info else None,
        "daysToNextTier": next_info["inDays"] if next_info else None,
        "tCount": len(my_pairs),
        "tNetProfit": round2(sum(p["netProfit"] for p in my_pairs)),
    }
    if day_change_pct is not None:
        holding["dayChangePct"] = day_change_pct
    return holding


# ============================================================
# 组合汇总
# ============================================================


def summarize(holdings: list[dict[str, Any]]) -> dict[str, Any]:
    market_value = sum(h["marketValue"] for h in holdings)
    cost_amount = sum(h["marketValue"] - h["profit"] for h in holdings)
    profit = sum(h["profit"] for h in holdings)

    subscribe_fee_paid = sum(h["subscribeFeePaid"] for h in holdings)
    redeem_fee_paid = sum(h["redeemFeePaid"] for h in holdings)
    hold_fee_accrued = sum(h["holdFeeAccrued"] for h in holdings)
    hidden_cost = subscribe_fee_paid + redeem_fee_paid + hold_fee_accrued

    total_in = sum(h["marketValue"] - h["profit"] for h in holdings)

    # 当日盈亏：优先用盘中估算涨跌幅，没有则用已公布日涨跌幅
    day_profit = 0.0
    for h in holdings:
        change = h.get("estimateChange")
        if change is None:
            change = h.get("dayChangePct")
        if change is None:
            continue
        day_profit += (h["marketValue"] * change) / 100

    t_count = sum(h["tCount"] for h in holdings)
    t_net_profit = sum(h["tNetProfit"] for h in holdings)

    return {
        "marketValue": round2(market_value),
        "costAmount": round2(cost_amount),
        "profit": round2(profit),
        "profitRate": round2((profit / cost_amount) * 100) if cost_amount > 0 else 0,
        "hiddenCost": round2(hidden_cost),
        "subscribeFeePaid": round2(subscribe_fee_paid),
        "redeemFeePaid": round2(redeem_fee_paid),
        "holdFeeAccrued": round2(hold_fee_accrued),
        "hiddenCostRate": round2((hidden_cost / total_in) * 100) if total_in > 0 else 0,
        "dayProfit": round2(day_profit),
        "dayProfitRate": round2((day_profit / market_value) * 100) if market_value > 0 else 0,
        "tCount": t_count,
        "tNetProfit": round2(t_net_profit),
        "positionCount": len(holdings),
    }
