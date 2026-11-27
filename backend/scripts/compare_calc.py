"""比较前端 calc.ts 与后端 calc.py 的计算结果。

    node frontend/scripts/calc_dump.ts 2026-11-20 > /tmp/ts.json
    python backend/scripts/dump_calc.py 2026-11-20 > /tmp/py.json
    python backend/scripts/compare_calc.py /tmp/ts.json /tmp/py.json
"""

from __future__ import annotations

import json
import math
import sys
from typing import Any


def diff(a: Any, b: Any, path: str = "$") -> list[str]:
    problems: list[str] = []
    if isinstance(a, dict) and isinstance(b, dict):
        for key in a.keys() | b.keys():
            if key not in a:
                problems.append(f"{path}.{key}: 缺失（TS 有，PY 没有）")
            elif key not in b:
                problems.append(f"{path}.{key}: 缺失（PY 有，TS 没有）")
            else:
                problems.extend(diff(a[key], b[key], f"{path}.{key}"))
        return problems
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            problems.append(f"{path}: 长度不同 TS={len(a)} PY={len(b)}")
            return problems
        for i, (x, y) in enumerate(zip(a, b)):
            problems.extend(diff(x, y, f"{path}[{i}]"))
        return problems
    if isinstance(a, bool) or isinstance(b, bool):
        if a != b:
            problems.append(f"{path}: TS={a!r} PY={b!r}")
        return problems
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if not math.isclose(float(a), float(b), rel_tol=0, abs_tol=1e-9):
            problems.append(f"{path}: TS={a!r} PY={b!r}")
        return problems
    if a != b:
        problems.append(f"{path}: TS={a!r} PY={b!r}")
    return problems


def main() -> None:
    if len(sys.argv) < 3:
        print("用法: compare_calc.py <ts.json> <py.json>")
        raise SystemExit(2)

    with open(sys.argv[1], encoding="utf-8") as fh:
        ts = json.load(fh)
    with open(sys.argv[2], encoding="utf-8") as fh:
        py = json.load(fh)

    problems = diff(ts, py)
    if problems:
        print(f"PARITY_FAIL: {len(problems)} 处差异")
        for p in problems[:40]:
            print("  -", p)
        raise SystemExit(1)

    print("PARITY_OK: 前端 calc.ts 与后端 calc.py 结果一致")


if __name__ == "__main__":
    main()
