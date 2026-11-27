"""JSON 文件存储：原子写 + 进程内锁 + 崩溃备份。

单用户本地使用，一个进程内并发访问即可，用 threading.RLock 串行化读改写。
写入流程：写临时文件 → flush + fsync → os.replace 原子替换；替换前把旧文件复制成 .bak。
"""

from __future__ import annotations

import json
import os
import shutil
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from . import config

CN_TZ = timezone(timedelta(hours=config.CN_UTC_OFFSET_HOURS))

_LOCK = threading.RLock()


def now_iso() -> str:
    """当前时间（+08:00）的 ISO 字符串。"""
    return datetime.now(CN_TZ).isoformat(timespec="seconds")


def today_str() -> str:
    return datetime.now(CN_TZ).strftime("%Y-%m-%d")


class JsonStore:
    """单个 JSON 文件的读写器。"""

    def __init__(self, path: Path, default: Callable[[], Any]) -> None:
        self.path = path
        self.default = default
        self.lock = _LOCK

    def read(self) -> Any:
        with self.lock:
            if not self.path.exists():
                data = self.default()
                self._write_unlocked(data)
                return data
            try:
                with self.path.open("r", encoding="utf-8") as fh:
                    return json.load(fh)
            except (json.JSONDecodeError, OSError):
                # 文件损坏时回退到备份，再不行就用默认值
                bak = self.path.with_suffix(self.path.suffix + ".bak")
                if bak.exists():
                    try:
                        with bak.open("r", encoding="utf-8") as fh:
                            return json.load(fh)
                    except (json.JSONDecodeError, OSError):
                        pass
                data = self.default()
                self._write_unlocked(data)
                return data

    def write(self, data: Any) -> None:
        with self.lock:
            self._write_unlocked(data)

    def update(self, mutator: Callable[[Any], Any]) -> Any:
        """在锁内读 → 改 → 写，返回 mutator 的返回值。"""
        with self.lock:
            data = self.read()
            result = mutator(data)
            self._write_unlocked(data)
            return result

    def _write_unlocked(self, data: Any) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            try:
                shutil.copy2(self.path, self.path.with_suffix(self.path.suffix + ".bak"))
            except OSError:
                pass
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, self.path)


def _default_funds() -> dict[str, Any]:
    return {"version": 1, "updatedAt": now_iso(), "items": []}


def _default_trades() -> dict[str, Any]:
    return {"version": 1, "updatedAt": now_iso(), "items": []}


def _default_settings() -> dict[str, Any]:
    return {
        "version": 1,
        "pairMaxGapDays": 10,
        "autoRefresh": True,
        "refreshSeconds": 30,
        "remindTier": True,
        "remindPendingT": True,
    }


funds_store = JsonStore(config.FUNDS_FILE, _default_funds)
trades_store = JsonStore(config.TRADES_FILE, _default_trades)
settings_store = JsonStore(config.SETTINGS_FILE, _default_settings)


# ============================================================
# 仓库层
# ============================================================


def list_fund_records() -> list[dict[str, Any]]:
    return funds_store.read()["items"]


def get_fund_record(code: str) -> dict[str, Any] | None:
    for item in funds_store.read()["items"]:
        if item["fund"]["code"] == code:
            return item
    return None


def upsert_fund_record(record: dict[str, Any]) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        for idx, item in enumerate(data["items"]):
            if item["fund"]["code"] == record["fund"]["code"]:
                data["items"][idx] = record
                break
        else:
            data["items"].append(record)
        data["updatedAt"] = now_iso()
        return record

    return funds_store.update(mutate)


def delete_fund_record(code: str) -> bool:
    def mutate(data: dict[str, Any]) -> bool:
        before = len(data["items"])
        data["items"] = [i for i in data["items"] if i["fund"]["code"] != code]
        data["updatedAt"] = now_iso()
        return len(data["items"]) != before

    return funds_store.update(mutate)


def list_trades() -> list[dict[str, Any]]:
    return trades_store.read()["items"]


def get_trade(trade_id: str) -> dict[str, Any] | None:
    for item in trades_store.read()["items"]:
        if item["id"] == trade_id:
            return item
    return None


def upsert_trade(trade: dict[str, Any]) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        for idx, item in enumerate(data["items"]):
            if item["id"] == trade["id"]:
                data["items"][idx] = trade
                break
        else:
            data["items"].append(trade)
        data["updatedAt"] = now_iso()
        return trade

    return trades_store.update(mutate)


def delete_trade(trade_id: str) -> bool:
    def mutate(data: dict[str, Any]) -> bool:
        before = len(data["items"])
        data["items"] = [i for i in data["items"] if i["id"] != trade_id]
        data["updatedAt"] = now_iso()
        return len(data["items"]) != before

    return trades_store.update(mutate)


def get_settings() -> dict[str, Any]:
    data = settings_store.read()
    base = _default_settings()
    base.update({k: v for k, v in data.items() if k in base})
    return base


def put_settings(patch: dict[str, Any]) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        for key, value in patch.items():
            if key in _default_settings() and key != "version":
                data[key] = value
        data["updatedAt"] = now_iso()
        return data

    settings_store.update(mutate)
    return get_settings()
