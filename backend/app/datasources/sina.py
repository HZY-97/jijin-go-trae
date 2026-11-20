"""新浪财经指数行情（GBK 编码，必须带 Referer 否则 403）。"""

from __future__ import annotations

import re
from typing import Any

from .. import config
from . import base

INDEX_URL = "https://hq.sinajs.cn/list={codes}"
INDEX_HEADERS = {"Referer": "https://finance.sina.com.cn/"}

DEFAULT_INDEXES = [
    ("sh000300", "沪深300"),
    ("sz399001", "深证成指"),
    ("sz399006", "创业板指"),
    ("sh000905", "中证500"),
    ("sh000016", "上证50"),
]


def _parse_line(line: str) -> dict[str, Any] | None:
    m = re.match(r'var hq_str_(\w+)="(.*)";', line.strip())
    if not m:
        return None
    code, payload = m.group(1), m.group(2)
    if not payload:
        return None
    parts = payload.split(",")
    if len(parts) < 6:
        return None
    try:
        name = parts[0]
        prev_close = float(parts[2])
        price = float(parts[3])
    except (ValueError, IndexError):
        return None
    # 开盘前新浪对部分指数返回现价 0（只有昨收），此时沿用昨收，避免算出 -100%
    if price <= 0:
        price = prev_close
    change = round(price - prev_close, 4)
    change_pct = round(change / prev_close * 100, 4) if prev_close else 0.0
    date = parts[30] if len(parts) > 30 else ""
    time = parts[31] if len(parts) > 31 else ""
    updated_at = f"{date} {time}".strip()
    return {
        "code": code,
        "name": name,
        "price": price,
        "change": change,
        "changePct": change_pct,
        "updatedAt": updated_at,
    }


def fetch_indices(force: bool = False) -> tuple[dict[str, Any], bool, str | None]:
    """返回 MarketSnapshot。"""
    cache = base.DiskCache(config.INDEX_CACHE_FILE, config.TTL_INDEX)

    def fetcher() -> dict[str, Any]:
        codes = ",".join(code for code, _ in DEFAULT_INDEXES)
        raw = base.get_bytes(INDEX_URL.format(codes=codes), headers=INDEX_HEADERS)
        text = raw.decode("gbk", errors="replace")
        indices: list[dict[str, Any]] = []
        updated_at = ""
        for line in text.splitlines():
            item = _parse_line(line)
            if item is None:
                continue
            if not updated_at and item["updatedAt"]:
                updated_at = item["updatedAt"]
            indices.append(
                {
                    "code": item["code"],
                    "name": item["name"],
                    "price": item["price"],
                    "change": item["change"],
                    "changePct": item["changePct"],
                }
            )
        if not indices:
            raise base.SourceError("指数行情解析失败")
        return {"indices": indices, "updatedAt": updated_at}

    data, stale, error = base.cached(cache, fetcher, force=force)
    if data is None:
        # 兜底：用默认名称构造空快照，避免页面崩掉
        data = {
            "indices": [
                {"code": c, "name": n, "price": 0, "change": 0, "changePct": 0}
                for c, n in DEFAULT_INDEXES
            ],
            "updatedAt": "",
        }
    return data, stale, error