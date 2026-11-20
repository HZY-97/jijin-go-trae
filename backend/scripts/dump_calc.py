"""对拍用：把后端 calc.py 的计算结果导出成 JSON，与前端 calc.ts 的输出比对。

    python scripts/dump_calc.py [asOf] > /tmp/py.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import calc, seed  # noqa: E402

# 与前端 mock.ts 的 MOCK_NAV 对应，作为对拍夹具
NAV_FIXTURES = {
    "161725": (0.5791, "2026-11-18", 0.5769, -0.38, "09:33"),
    "110022": (3.0100, "2026-11-18", 3.0114, -0.52, "09:33"),
    "005827": (1.3578, "2026-11-18", 1.3566, -0.44, "09:33"),
    "001618": (0.8124, "2026-11-18", 0.8091, -0.41, "09:33"),
    "320007": (0.9600, "2026-11-18", 0.9655, 0.57, "09:33"),
    "260108": (2.1460, "2026-11-18", 2.1389, -0.33, "09:33"),
}


def main() -> None:
    as_of = sys.argv[1] if len(sys.argv) > 1 else "2026-11-20"
    trades = seed.SEED_TRADES
    pairs = calc.pair_trades(trades)["pairs"]

    holdings = []
    for fund in seed.SEED_FUNDS:
        fee = seed.SEED_FEES[fund["code"]]
        nav, nav_date, est_nav, est_change, est_time = NAV_FIXTURES[fund["code"]]
        holding = calc.derive_holding(
            fund,
            fee,
            trades,
            nav,
            nav_date,
            est_nav,
            est_change,
            est_time,
            pairs,
            as_of,
        )
        if holding["shares"] > 0:
            holdings.append(holding)

    out = {"holdings": holdings, "pairs": pairs, "summary": calc.summarize(holdings)}
    sys.stdout.write(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
