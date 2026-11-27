"""外部数据访问基础设施：HTTP 客户端 + 磁盘缓存（stale-while-error）。

缓存语义：
- 命中且未过期 → 直接返回；
- 命中但过期 → 尝试刷新；刷新失败 → 返回旧缓存并标记 stale，不抛错；
- 未命中且请求失败 → 返回 None，由调用方兜底。
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable

import httpx

from .. import config

_client = httpx.Client(
    timeout=httpx.Timeout(
        config.HTTP_TIMEOUT, connect=5.0, read=config.HTTP_TIMEOUT, write=10.0, pool=5.0
    ),
    headers={"User-Agent": config.USER_AGENT},
    follow_redirects=True,
    trust_env=True,
)


class SourceError(Exception):
    """外部数据源不可用。"""


def get_text(url: str, headers: dict[str, str] | None = None) -> str:
    last: Exception | None = None
    for attempt in range(config.HTTP_RETRIES + 1):
        try:
            resp = _client.get(url, headers=headers)
            if resp.status_code >= 500:
                raise SourceError(f"HTTP {resp.status_code}")
            resp.raise_for_status()
            return resp.text
        except (httpx.HTTPError, SourceError) as exc:
            last = exc
            if attempt < config.HTTP_RETRIES:
                time.sleep(0.6 * (attempt + 1))
    raise SourceError(f"请求失败 {url}: {last}")


def get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    text = get_text(url, headers=headers)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise SourceError(f"响应不是合法 JSON: {url}") from exc


def get_bytes(url: str, headers: dict[str, str] | None = None) -> bytes:
    last: Exception | None = None
    for attempt in range(config.HTTP_RETRIES + 1):
        try:
            resp = _client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.content
        except httpx.HTTPError as exc:
            last = exc
            if attempt < config.HTTP_RETRIES:
                time.sleep(0.6 * (attempt + 1))
    raise SourceError(f"请求失败 {url}: {last}")


# ============================================================
# 磁盘缓存
# ============================================================


class DiskCache:
    def __init__(self, path: Path, ttl: float) -> None:
        self.path = path
        self.ttl = ttl

    def read(self) -> tuple[Any, float] | None:
        """返回 (data, fetchedAt) ；没有缓存返回 None。"""
        if not self.path.exists():
            return None
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                payload = json.load(fh)
        except (json.JSONDecodeError, OSError):
            return None
        if "data" not in payload:
            return None
        return payload["data"], float(payload.get("fetchedAt", 0))

    def write(self, data: Any) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"fetchedAt": time.time(), "data": data}
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False)
        tmp.replace(self.path)


def cached(
    cache: DiskCache,
    fetcher: Callable[[], Any],
    force: bool = False,
) -> tuple[Any, bool, str | None]:
    """取缓存数据。

    返回 (data, stale, error)：
    - data 为 None 表示彻底没有数据
    - stale 为 True 表示数据来自过期缓存（刷新失败）
    - error 为本次刷新的错误信息
    """
    hit = cache.read()
    fresh = hit is not None and (time.time() - hit[1]) < cache.ttl
    if fresh and not force:
        return hit[0], False, None

    try:
        data = fetcher()
        cache.write(data)
        return data, False, None
    except Exception as exc:  # 数据源失败时降级到旧缓存
        if hit is not None:
            return hit[0], True, str(exc)
        return None, False, str(exc)
