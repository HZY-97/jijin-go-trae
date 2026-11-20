"""路径与运行时配置。"""

from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
NAV_CACHE_DIR = CACHE_DIR / "nav"
QUOTE_CACHE_DIR = CACHE_DIR / "quote"
FEE_CACHE_DIR = CACHE_DIR / "fee"

FUNDS_FILE = DATA_DIR / "funds.json"
TRADES_FILE = DATA_DIR / "trades.json"
SETTINGS_FILE = DATA_DIR / "settings.json"
INDEX_CACHE_FILE = CACHE_DIR / "index.json"

# 固定 +08:00，避免依赖系统 tzdata
CN_TZ = "Asia/Shanghai"
CN_UTC_OFFSET_HOURS = 8

# 磁盘缓存 TTL（秒）
TTL_QUOTE = 600  # 基金最新净值 / 涨跌幅
TTL_INDEX = 60  # 大盘指数
TTL_NAV_HISTORY = 6 * 3600  # 历史净值序列
TTL_FEE = 7 * 24 * 3600  # 费率档案

HTTP_TIMEOUT = 20.0
HTTP_RETRIES = 2

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

# 本地单用户工具，允许任意来源（前端走 vite 代理时同源，直连时用得到）
CORS_ORIGINS = ["*"]


def ensure_dirs() -> None:
    for path in (DATA_DIR, CACHE_DIR, NAV_CACHE_DIR, QUOTE_CACHE_DIR, FEE_CACHE_DIR):
        path.mkdir(parents=True, exist_ok=True)
