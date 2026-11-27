"""FastAPI 应用入口。

    uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, seed
from .routers import funds, portfolio, settings, system, trades


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    config.ensure_dirs()
    seed.seed_if_empty()
    seed.refresh_fees_from_source()
    yield


app = FastAPI(
    title="基金做 T 助手 API",
    version="0.1.0",
    description="真实行情 + 本地 JSON 账本，计算全部在后端完成。",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router, prefix="/api")
app.include_router(portfolio.router, prefix="/api")
app.include_router(funds.router, prefix="/api")
app.include_router(trades.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
