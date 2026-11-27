"""天天基金 / 东方财富 数据源客户端。

覆盖三类数据：
- 基本信息与最新净值：fundmobapi FundMNBasicInformation / FundMNDetailInformation
- 历史净值：pingzhongdata（全量）为主，f10/lsjz（分页）为降级
- 费率档案（赎回费阶梯、申购起点、运作费用）：f10/jjfl_{code}.html
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from bs4 import BeautifulSoup

from .. import config
from . import base

CN_TZ = timezone(timedelta(hours=config.CN_UTC_OFFSET_HOURS))

MOBILE_API = "https://fundmobapi.eastmoney.com/FundMNewApi"
MOBILE_PARAMS = "deviceid=1&plat=Iphone&product=EFund&version=6.2.8"
PINGZHONG_URL = "https://fund.eastmoney.com/pingzhongdata/{code}.js"
LSJZ_URL = "https://api.fund.eastmoney.com/f10/lsjz?fundCode={code}&pageIndex={page}&pageSize={size}"
FEE_PAGE_URL = "https://fundf10.eastmoney.com/jjfl_{code}.html"

LSJZ_HEADERS = {"Referer": "https://fundf10.eastmoney.com/"}
PINGZHONG_HEADERS = {"Referer": "https://fund.eastmoney.com/"}
FEE_PAGE_HEADERS = {"Referer": "https://fund.eastmoney.com/"}

# 天天基金的基金类型前缀 → 前端使用的粗分类
CATEGORY_MAP = {
    "指数型": "指数型",
    "股票型": "股票型",
    "混合型": "混合型",
    "债券型": "债券型",
    "QDII": "QDII",
    "货币型": "货币型",
    "FOF": "FOF",
}


# ============================================================
# 通用解析工具
# ============================================================


def parse_pct(text: str | None) -> float:
    """'1.00%' → 1.0；'---' / None → 0.0；'每笔300元' → 0.0。"""
    if not text:
        return 0.0
    cleaned = text.replace("（", "(").replace("）", ")")
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", cleaned)
    if not m:
        return 0.0
    return float(m.group(1))


def _days(amount: int, unit: str) -> int:
    if unit in ("天", "日"):
        return amount
    if unit == "月":
        return amount * 30
    if unit == "年":
        return amount * 365
    return amount


def parse_holding_span(text: str) -> tuple[int, int | None] | None:
    """把赎回费阶梯的期限文本解析成 (minDays, maxDays)。

    支持「小于7天」「小于等于6天」「大于等于7天，小于365天」「大于等于730天」
    「大于等于7天，小于2年」等写法。
    """
    if not text:
        return None
    normalized = text.replace(" ", "").replace("　", "").replace("，", ",")
    if not re.search(r"[天日月年]", normalized):
        return None

    lower = 0
    upper: int | None = None

    m = re.search(r"大于等于(\d+)([天日月年])", normalized)
    if m:
        lower = _days(int(m.group(1)), m.group(2))
    else:
        m = re.search(r"大于(\d+)([天日月年])", normalized)
        if m:
            lower = _days(int(m.group(1)), m.group(2)) + 1

    m = re.search(r"小于等于(\d+)([天日月年])", normalized)
    if m:
        upper = _days(int(m.group(1)), m.group(2))
    else:
        m = re.search(r"小于(\d+)([天日月年])", normalized)
        if m:
            upper = _days(int(m.group(1)), m.group(2)) - 1

    if lower == 0 and upper is None:
        return None
    return lower, upper


def _extract_js_json(text: str, var_name: str) -> Any:
    m = re.search(rf"var\s+{re.escape(var_name)}\s*=\s*", text)
    if not m:
        return None
    try:
        value, _ = json.JSONDecoder().raw_decode(text, m.end())
    except json.JSONDecodeError:
        return None
    return value


def _epoch_to_date(epoch_ms: int) -> str:
    """pingzhongdata 的 x 是「北京时间零点」对应的 epoch，按 +08:00 还原日期。

    用 UTC 转换会整体少一天（净值日期对不上最新公布日）。
    """
    return datetime.fromtimestamp(epoch_ms / 1000, tz=CN_TZ).strftime("%Y-%m-%d")


# ============================================================
# 基本信息与最新净值
# ============================================================


def _parse_basic(code: str, payload: dict[str, Any]) -> dict[str, Any]:
    datas = payload.get("Datas") or {}
    if not datas:
        raise base.SourceError(f"基金 {code} 基本信息为空")

    ftype = str(datas.get("FTYPE") or "")
    category = ftype.split("-")[0] if "-" in ftype else ftype
    return {
        "code": code,
        "name": datas.get("SHORTNAME") or code,
        "category": CATEGORY_MAP.get(category, category or "其他"),
        "company": datas.get("JJGS") or "",
        "nav": float(datas.get("DWJZ") or 0),
        "navDate": datas.get("FSRQ") or "",
        "accNav": float(datas.get("LJJZ") or 0),
        "changePct": float(datas.get("RZDF") or 0),
        "subscribeRate": parse_pct(datas.get("RATE")),
        "sourceRate": parse_pct(datas.get("SOURCERATE")),
        "minSubscribe": float(datas.get("MINSG") or 0),
        "subscribeStatus": datas.get("SGZT") or "",
        "redeemStatus": datas.get("SHZT") or "",
        "riskLevel": datas.get("RISKLEVEL") or "",
    }


def fetch_basic(code: str, force: bool = False) -> tuple[dict[str, Any], bool, str | None]:
    cache = base.DiskCache(config.QUOTE_CACHE_DIR / f"{code}.json", config.TTL_QUOTE)

    def fetcher() -> dict[str, Any]:
        url = f"{MOBILE_API}/FundMNBasicInformation?FCODE={code}&{MOBILE_PARAMS}"
        payload = base.get_json(url)
        return _parse_basic(code, payload)

    return base.cached(cache, fetcher, force=force)


def fetch_expense(code: str, force: bool = False) -> tuple[dict[str, float], bool, str | None]:
    """管理费 / 托管费 / 销售服务费（年化 %）。"""
    cache = base.DiskCache(config.QUOTE_CACHE_DIR / f"{code}.expense.json", config.TTL_FEE)

    def fetcher() -> dict[str, float]:
        url = f"{MOBILE_API}/FundMNDetailInformation?FCODE={code}&{MOBILE_PARAMS}"
        payload = base.get_json(url)
        datas = payload.get("Datas") or {}
        if not datas:
            raise base.SourceError(f"基金 {code} 运作费用为空")
        return {
            "manageRate": parse_pct(datas.get("MGREXP")),
            "trustRate": parse_pct(datas.get("TRUSTEXP")),
            "salesRate": parse_pct(datas.get("SALESEXP")),
        }

    return base.cached(cache, fetcher, force=force)


# ============================================================
# 历史净值
# ============================================================


def _parse_pingzhong(code: str, text: str) -> list[dict[str, Any]]:
    trend = _extract_js_json(text, "Data_netWorthTrend")
    if not trend:
        raise base.SourceError(f"基金 {code} 净值序列解析失败")

    acc_trend = _extract_js_json(text, "Data_ACWorthTrend") or []
    acc_map: dict[str, float] = {}
    for item in acc_trend:
        try:
            acc_map[_epoch_to_date(int(item[0]))] = float(item[1])
        except (TypeError, ValueError, IndexError):
            continue

    points: list[dict[str, Any]] = []
    for item in trend:
        try:
            date = _epoch_to_date(int(item["x"]))
            nav = float(item["y"])
        except (KeyError, TypeError, ValueError):
            continue
        points.append(
            {
                "date": date,
                "nav": nav,
                "accNav": acc_map.get(date, nav),
                "changePct": float(item.get("equityReturn") or 0),
            }
        )
    points.sort(key=lambda p: p["date"])
    return points


def _parse_lsjz(code: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = (payload.get("Data") or {}).get("LSJZList") or []
    points: list[dict[str, Any]] = []
    for item in items:
        try:
            points.append(
                {
                    "date": item["FSRQ"],
                    "nav": float(item["DWJZ"]),
                    "accNav": float(item.get("LJJZ") or item["DWJZ"]),
                    "changePct": float(item.get("JZZZL") or 0),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    points.sort(key=lambda p: p["date"])
    return points


def fetch_nav_history(
    code: str, force: bool = False
) -> tuple[list[dict[str, Any]], bool, str | None]:
    """全量历史净值。pingzhongdata 失败时降级到 lsjz 分页接口。"""
    cache = base.DiskCache(config.NAV_CACHE_DIR / f"{code}.json", config.TTL_NAV_HISTORY)

    def fetcher() -> list[dict[str, Any]]:
        try:
            text = base.get_text(PINGZHONG_URL.format(code=code), headers=PINGZHONG_HEADERS)
            points = _parse_pingzhong(code, text)
            if points:
                return points
        except base.SourceError:
            pass

        points: list[dict[str, Any]] = []
        for page in (1, 2, 3):
            url = LSJZ_URL.format(code=code, page=page, size=200)
            payload = base.get_json(url, headers=LSJZ_HEADERS)
            batch = _parse_lsjz(code, payload)
            if not batch:
                break
            points.extend(batch)
        if not points:
            raise base.SourceError(f"基金 {code} 历史净值获取失败")
        seen: dict[str, dict[str, Any]] = {}
        for point in points:
            seen[point["date"]] = point
        return sorted(seen.values(), key=lambda p: p["date"])

    return base.cached(cache, fetcher, force=force)


# ============================================================
# 费率档案
# ============================================================


def _table_after(soup: BeautifulSoup, keyword: str) -> Any:
    """找到标题里含 keyword 的 h4，取其后的第一个 table。"""
    for heading in soup.find_all(["h4", "h3"]):
        label = heading.get_text(strip=True)
        if keyword not in label:
            continue
        table = heading.find_next("table")
        if table is not None:
            return table
    return None


def _cell_after_label(soup: BeautifulSoup, label: str) -> str | None:
    """取形如 <td>申购起点</td><td>10.00元</td> 中 label 后面那个单元格。"""
    for cell in soup.find_all("td"):
        if cell.get_text(strip=True) == label:
            sibling = cell.find_next_sibling("td")
            if sibling is not None:
                return sibling.get_text(strip=True)
    return None


def parse_fee_page(code: str, html: str) -> dict[str, Any]:
    """从 jjfl 费率页解析赎回费阶梯、申购起点、申购费率、运作费用。"""
    soup = BeautifulSoup(html, "html.parser")

    redeem_tiers: list[dict[str, Any]] = []
    redeem_table = _table_after(soup, "赎回费率")
    if redeem_table is not None:
        for row in redeem_table.select("tbody tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue
            span = parse_holding_span(cells[0].get_text(strip=True))
            if span is None:
                continue
            min_days, max_days = span
            redeem_tiers.append(
                {"minDays": min_days, "maxDays": max_days, "rate": parse_pct(cells[1].get_text())}
            )
    redeem_tiers.sort(key=lambda t: t["minDays"])

    # 申购费率：取最小金额档的折后价（单元格是「原费率 | 折后费率」）
    subscribe_rate: float | None = None
    subscribe_table = _table_after(soup, "申购费率")
    if subscribe_table is not None:
        rows = subscribe_table.select("tbody tr")
        if rows:
            cells = rows[0].find_all("td")
            if len(cells) >= 2:
                pcts = re.findall(r"(\d+(?:\.\d+)?)\s*%", cells[1].get_text())
                if pcts:
                    subscribe_rate = float(pcts[-1])

    min_subscribe: float | None = None
    raw_min = _cell_after_label(soup, "申购起点")
    if raw_min:
        m = re.search(r"(\d+(?:\.\d+)?)", raw_min)
        if m:
            min_subscribe = float(m.group(1))

    daily_hold_rate: float | None = None
    manage = _cell_after_label(soup, "管理费率")
    trust = _cell_after_label(soup, "托管费率")
    sales = _cell_after_label(soup, "销售服务费率")
    if manage is not None or trust is not None:
        daily_hold_rate = (
            parse_pct(manage) + parse_pct(trust) + parse_pct(sales)
        )

    return {
        "redeemTiers": redeem_tiers,
        "subscribeRate": subscribe_rate,
        "minSubscribe": min_subscribe,
        "dailyHoldRate": daily_hold_rate,
    }


def fetch_fee_profile(
    code: str, force: bool = False
) -> tuple[dict[str, Any], bool, str | None]:
    """抓取并组装完整费率档案，字段名与前端 FeeProfile 一致。"""
    cache = base.DiskCache(config.FEE_CACHE_DIR / f"{code}.json", config.TTL_FEE)

    def fetcher() -> dict[str, Any]:
        html = base.get_text(FEE_PAGE_URL.format(code=code), headers=FEE_PAGE_HEADERS)
        page = parse_fee_page(code, html)

        redeem_tiers = page["redeemTiers"]
        if not redeem_tiers:
            raise base.SourceError(f"基金 {code} 未解析到赎回费阶梯")

        basic: dict[str, Any] = {}
        try:
            basic, _, _ = fetch_basic(code)
        except Exception:
            basic = {}

        try:
            expense, _, _ = fetch_expense(code)
        except Exception:
            expense = {}

        daily_hold_rate = page["dailyHoldRate"]
        if daily_hold_rate is None:
            daily_hold_rate = (
                expense.get("manageRate", 0)
                + expense.get("trustRate", 0)
                + expense.get("salesRate", 0)
            )

        subscribe_rate = page["subscribeRate"]
        if subscribe_rate is None:
            subscribe_rate = basic.get("subscribeRate", 0)

        min_subscribe = page["minSubscribe"]
        if min_subscribe is None:
            min_subscribe = basic.get("minSubscribe", 0)

        return {
            "subscribeRate": subscribe_rate,
            "dailyHoldRate": daily_hold_rate,
            "redeemTiers": redeem_tiers,
            "minSubscribe": min_subscribe,
        }

    return base.cached(cache, fetcher, force=force)
