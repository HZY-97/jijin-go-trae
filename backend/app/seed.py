"""种子数据：把前端 mock.ts 的 6 只基金 / 费率 / 20 笔流水转成后端初始数据。

首次启动时写入 funds.json 与 trades.json，保证 demo 场景（6 只持仓、4 次做 T）与之前一致。
"""

from __future__ import annotations

from typing import Any

from . import store

SEED_FUNDS: list[dict[str, Any]] = [
    {
        "code": "161725",
        "name": "招商中证白酒指数(LOF)A",
        "category": "指数型",
        "company": "招商基金",
    },
    {
        "code": "110022",
        "name": "易方达消费行业股票",
        "category": "股票型",
        "company": "易方达基金",
    },
    {
        "code": "005827",
        "name": "易方达蓝筹精选混合",
        "category": "混合型",
        "company": "易方达基金",
    },
    {
        "code": "001618",
        "name": "天弘中证食品饮料指数A",
        "category": "指数型",
        "company": "天弘基金",
    },
    {
        "code": "320007",
        "name": "诺安成长混合",
        "category": "混合型",
        "company": "诺安基金",
    },
    {
        "code": "260108",
        "name": "景顺长城新兴成长混合",
        "category": "混合型",
        "company": "景顺长城基金",
    },
]

SEED_FEES: dict[str, dict[str, Any]] = {
    "161725": {
        "subscribeRate": 0.12,
        "dailyHoldRate": 0.6,
        "redeemTiers": [
            {"minDays": 0, "maxDays": 6, "rate": 1.5},
            {"minDays": 7, "maxDays": 29, "rate": 0.75},
            {"minDays": 30, "maxDays": None, "rate": 0},
        ],
        "minSubscribe": 10,
    },
    "110022": {
        "subscribeRate": 0.15,
        "dailyHoldRate": 1.2,
        "redeemTiers": [
            {"minDays": 0, "maxDays": 6, "rate": 1.5},
            {"minDays": 7, "maxDays": 29, "rate": 0.75},
            {"minDays": 30, "maxDays": None, "rate": 0},
        ],
        "minSubscribe": 10,
    },
    "005827": {
        "subscribeRate": 0.15,
        "dailyHoldRate": 1.2,
        "redeemTiers": [
            {"minDays": 0, "maxDays": 6, "rate": 1.5},
            {"minDays": 7, "maxDays": 364, "rate": 0.5},
            {"minDays": 365, "maxDays": None, "rate": 0},
        ],
        "minSubscribe": 10,
    },
    "001618": {
        "subscribeRate": 0.1,
        "dailyHoldRate": 0.5,
        "redeemTiers": [
            {"minDays": 0, "maxDays": 6, "rate": 1.5},
            {"minDays": 7, "maxDays": 29, "rate": 0.75},
            {"minDays": 30, "maxDays": None, "rate": 0},
        ],
        "minSubscribe": 10,
    },
    "320007": {
        "subscribeRate": 0.15,
        "dailyHoldRate": 1.2,
        "redeemTiers": [
            {"minDays": 0, "maxDays": 6, "rate": 1.5},
            {"minDays": 7, "maxDays": 29, "rate": 0.75},
            {"minDays": 30, "maxDays": None, "rate": 0},
        ],
        "minSubscribe": 10,
    },
    "260108": {
        "subscribeRate": 0.12,
        "dailyHoldRate": 1.2,
        "redeemTiers": [
            {"minDays": 0, "maxDays": 6, "rate": 1.5},
            {"minDays": 7, "maxDays": 364, "rate": 0.5},
            {"minDays": 365, "maxDays": None, "rate": 0},
        ],
        "minSubscribe": 10,
    },
}

SEED_TRADES: list[dict[str, Any]] = [
    {"id": "t1", "fundCode": "161725", "date": "2026-02-10", "side": "buy", "shares": 20000, "nav": 0.642, "amount": 12840, "feeRate": 0.12, "fee": 15.41, "note": "建仓"},
    {"id": "t2", "fundCode": "161725", "date": "2026-04-18", "side": "buy", "shares": 15000, "nav": 0.518, "amount": 7770, "feeRate": 0.12, "fee": 9.32, "note": "加仓"},
    {"id": "t3", "fundCode": "161725", "date": "2026-06-22", "side": "sell", "shares": 10000, "nav": 0.562, "amount": 5620, "feeRate": 0.75, "fee": 42.15, "note": "做T卖出"},
    {"id": "t4", "fundCode": "161725", "date": "2026-06-26", "side": "buy", "shares": 10000, "nav": 0.531, "amount": 5310, "feeRate": 0.12, "fee": 6.37, "note": "做T买回"},
    {"id": "t5", "fundCode": "161725", "date": "2026-09-14", "side": "sell", "shares": 12000, "nav": 0.601, "amount": 7212, "feeRate": 0.75, "fee": 54.09, "note": "做T卖出"},
    {"id": "t6", "fundCode": "161725", "date": "2026-09-18", "side": "buy", "shares": 12000, "nav": 0.564, "amount": 6768, "feeRate": 0.12, "fee": 8.12, "note": "做T买回"},
    {"id": "t7", "fundCode": "161725", "date": "2026-11-06", "side": "buy", "shares": 8000, "nav": 0.59, "amount": 4720, "feeRate": 0.12, "fee": 5.66, "note": "加仓"},
    {"id": "t8", "fundCode": "110022", "date": "2026-01-15", "side": "buy", "shares": 3000, "nav": 2.86, "amount": 8580, "feeRate": 0.15, "fee": 12.87},
    {"id": "t9", "fundCode": "110022", "date": "2026-03-28", "side": "sell", "shares": 1000, "nav": 3.12, "amount": 3120, "feeRate": 0.75, "fee": 23.4, "note": "做T卖出"},
    {"id": "t10", "fundCode": "110022", "date": "2026-04-02", "side": "buy", "shares": 1000, "nav": 3.01, "amount": 3010, "feeRate": 0.15, "fee": 4.52, "note": "做T买回"},
    {"id": "t11", "fundCode": "110022", "date": "2026-07-20", "side": "buy", "shares": 1500, "nav": 2.94, "amount": 4410, "feeRate": 0.15, "fee": 6.62, "note": "加仓"},
    {"id": "t12", "fundCode": "110022", "date": "2026-10-25", "side": "sell", "shares": 1200, "nav": 3.24, "amount": 3888, "feeRate": 0.75, "fee": 29.16, "note": "做T卖出"},
    {"id": "t13", "fundCode": "110022", "date": "2026-10-29", "side": "buy", "shares": 1200, "nav": 3.15, "amount": 3780, "feeRate": 0.15, "fee": 5.67, "note": "做T买回"},
    {"id": "t14", "fundCode": "005827", "date": "2026-03-05", "side": "buy", "shares": 8000, "nav": 1.286, "amount": 10288, "feeRate": 0.15, "fee": 15.43},
    {"id": "t15", "fundCode": "005827", "date": "2026-05-18", "side": "buy", "shares": 6000, "nav": 1.402, "amount": 8412, "feeRate": 0.15, "fee": 12.62},
    {"id": "t16", "fundCode": "001618", "date": "2026-08-12", "side": "buy", "shares": 10000, "nav": 0.784, "amount": 7840, "feeRate": 0.1, "fee": 7.84},
    {"id": "t17", "fundCode": "320007", "date": "2026-02-26", "side": "buy", "shares": 5000, "nav": 1.05, "amount": 5250, "feeRate": 0.15, "fee": 7.88},
    {"id": "t18", "fundCode": "320007", "date": "2026-11-17", "side": "sell", "shares": 2000, "nav": 1.024, "amount": 2048, "feeRate": 0.75, "fee": 15.36, "note": "做T卖出"},
    {"id": "t19", "fundCode": "260108", "date": "2026-04-16", "side": "buy", "shares": 4000, "nav": 2.21, "amount": 8840, "feeRate": 0.12, "fee": 10.61},
    {"id": "t20", "fundCode": "260108", "date": "2026-11-17", "side": "sell", "shares": 1500, "nav": 2.168, "amount": 3252, "feeRate": 0.75, "fee": 24.39, "note": "做T卖出"},
]


def seed_if_empty() -> None:
    """首次启动时写入种子数据；已有数据则不动。"""
    if not store.list_fund_records():
        for fund in SEED_FUNDS:
            record = {
                "fund": fund,
                "fee": SEED_FEES[fund["code"]],
                "feeSource": "seed",
                "updatedAt": store.now_iso(),
            }
            store.upsert_fund_record(record)

    if not store.list_trades():
        for trade in SEED_TRADES:
            store.upsert_trade(dict(trade))


def refresh_fees_from_source() -> None:
    """把种子数据的费率换成天天基金的真实费率（只处理 feeSource == "seed" 的记录）。

    这样首次启动拿到的是真实费率而不是写死的演示值；拉取失败则保留种子费率。
    """
    from .datasources import eastmoney

    for record in store.list_fund_records():
        if record.get("feeSource") != "seed":
            continue
        try:
            fee, _stale, _err = eastmoney.fetch_fee_profile(record["fund"]["code"])
        except Exception:
            continue
        if not fee:
            continue
        record["fee"] = fee
        record["feeSource"] = "eastmoney"
        record["updatedAt"] = store.now_iso()
        store.upsert_fund_record(record)
