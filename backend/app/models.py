"""请求体模型（pydantic 只用于入参校验，响应体手写 dict 以对齐前端类型）。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RedeemTierIn(BaseModel):
    minDays: int = Field(ge=0)
    maxDays: int | None = None
    rate: float = Field(ge=0)


class FeeProfileIn(BaseModel):
    subscribeRate: float = Field(default=0, ge=0)
    dailyHoldRate: float = Field(default=0, ge=0)
    redeemTiers: list[RedeemTierIn] = Field(default_factory=list)
    minSubscribe: float = Field(default=0, ge=0)


class FundIn(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=64)
    category: str = ""
    company: str = ""


class FundUpsertIn(BaseModel):
    fund: FundIn
    fee: FeeProfileIn


class FeeUpdateIn(BaseModel):
    fee: FeeProfileIn


class TradeIn(BaseModel):
    fundCode: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    side: Literal["buy", "sell"]
    shares: float = Field(gt=0)
    nav: float = Field(ge=0)
    amount: float | None = Field(default=None, ge=0)
    feeRate: float | None = Field(default=None, ge=0)
    fee: float | None = Field(default=None, ge=0)
    note: str | None = None


class SettingsIn(BaseModel):
    pairMaxGapDays: int | None = Field(default=None, ge=1, le=180)
    autoRefresh: bool | None = None
    refreshSeconds: int | None = Field(default=None, ge=5, le=3600)
    remindTier: bool | None = None
    remindPendingT: bool | None = None


class ImportIn(BaseModel):
    funds: list[dict] = Field(default_factory=list)
    trades: list[dict] = Field(default_factory=list)
    settings: dict = Field(default_factory=dict)
