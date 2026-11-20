/**
 * 领域模型 —— 围绕“长周期做 T 稀释持仓成本 + 隐性成本可见化”设计。
 *
 * 核心概念：
 *  - FeeProfile：一只基金的费率档案。买入费率、每日持有费（按日计提）、卖出费率（阶梯）。
 *  - Trade：一笔买入或卖出。卖出与随后的买入可配对成一次「做 T」。
 *  - TPair：一次做 T 的配对结果，单独核算这次 T 的净收益（价差 − 双边费用）。
 */

/** 卖出（赎回）费率阶梯：按持有天数分档 */
export interface RedeemTier {
  /** 持有天数下限（含） */
  minDays: number
  /** 持有天数上限（含）；null 表示无上限 */
  maxDays: number | null
  /** 赎回费率，单位 % */
  rate: number
}

/** 一只基金的费率档案 */
export interface FeeProfile {
  /** 买入（申购）费率 %，已含平台折扣 */
  subscribeRate: number
  /** 每日持有成本，年化 %（管理费 + 托管费 + 销售服务费），按日计提 */
  dailyHoldRate: number
  /** 卖出（赎回）费率阶梯 */
  redeemTiers: RedeemTier[]
  /** 单笔最低申购金额 */
  minSubscribe: number
}

/** 场外基金基本信息 */
export interface Fund {
  code: string
  name: string
  /** 基金类型，如 混合型 / 股票型 / 债券型 / 指数型 */
  category: string
  /** 基金公司 */
  company: string
}

/** 一笔交易流水 */
export interface Trade {
  id: string
  fundCode: string
  /** YYYY-MM-DD */
  date: string
  /** buy = 买入/申购；sell = 卖出/赎回 */
  side: 'buy' | 'sell'
  /** 份额 */
  shares: number
  /** 成交净值 */
  nav: number
  /** 净金额（不含费） */
  amount: number
  /** 费率 % */
  feeRate: number
  /** 费用金额 */
  fee: number
  /** 备注 */
  note?: string
}

/** 一次做 T 的配对 */
export interface TPair {
  id: string
  fundCode: string
  /** 卖出腿 */
  sell: Trade
  /** 买入腿 */
  buy: Trade
  /** 价差收益 = (卖价 − 买价) × 份数 */
  spreadProfit: number
  /** 双边费用合计 */
  totalFee: number
  /** 净收益 = 价差收益 − 双边费用 */
  netProfit: number
  /** 净收益率（相对买入金额） */
  netRate: number
  /** 持有天数跨度 */
  daysBetween: number
}

/** 持仓（由交易流水推导） */
export interface Holding {
  fund: Fund
  fee: FeeProfile
  /** 持有份额 */
  shares: number
  /** 摊薄后的持仓成本价（含买入费与持有费） */
  costPrice: number
  /** 原始成本价（不含费，用于对比） */
  rawCostPrice: number
  /** 最新单位净值 */
  nav: number
  /** 净值日期 */
  navDate: string
  /** 实时估算净值；非交易时段为 null */
  estimateNav: number | null
  /** 实时估算涨跌幅 % */
  estimateChange: number | null
  /** 估值时间戳 */
  estimateTime: string | null
  /** 市值 */
  marketValue: number
  /** 浮动盈亏（含已计提持有费） */
  profit: number
  /** 浮动盈亏率 % */
  profitRate: number
  /** 累计买入费用 */
  subscribeFeePaid: number
  /** 累计卖出费用 */
  redeemFeePaid: number
  /** 累计已计提持有费 */
  holdFeeAccrued: number
  /** 隐性成本合计 */
  hiddenCost: number
  /** 隐性成本占投入比 % */
  hiddenCostRate: number
  /** 持仓天数 */
  holdingDays: number
  /** 下一档赎回费率（按已持有天数） */
  nextRedeemTier: RedeemTier | null
  /** 距下一档还有几天 */
  daysToNextTier: number | null
  /** 该基金完成的做 T 次数 */
  tCount: number
  /** 该基金做 T 累计净收益 */
  tNetProfit: number
  /** 已公布净值日涨跌幅 %（盘中估值不可得时，用它折算当日盈亏） */
  dayChangePct?: number
}

/** 大盘指数 */
export interface IndexQuote {
  code: string
  name: string
  price: number
  change: number
  changePct: number
}

/** 大盘/板块热度，用于做 T 参考 */
export interface MarketSnapshot {
  indices: IndexQuote[]
  updatedAt: string
}

/* ============================================================
   后端接口返回结构
   ============================================================ */

/** 组合汇总 */
export interface PortfolioSummary {
  marketValue: number
  costAmount: number
  profit: number
  profitRate: number
  hiddenCost: number
  subscribeFeePaid: number
  redeemFeePaid: number
  holdFeeAccrued: number
  hiddenCostRate: number
  dayProfit: number
  dayProfitRate: number
  tCount: number
  tNetProfit: number
  positionCount: number
}

/** 基金 + 费率档案 + 来源 */
export interface FundRecord {
  fund: Fund
  fee: FeeProfile
  /** manual = 手工填写；eastmoney = 自动抓取 */
  feeSource: string
  updatedAt: string
}

/** 净值曲线上的一个点 */
export interface NavPoint {
  date: string
  nav: number
  accNav: number
  changePct: number
}

/** 聚合接口的元信息 */
export interface ApiMeta {
  generatedAt: string
  /** live = 全部实时；stale = 用了缓存旧值；degraded = 有数据源不可用 */
  source: 'live' | 'stale' | 'degraded'
  warnings: string[]
  fundStatus: {
    code: string
    navDate: string
    fetchedAt: string
    stale: boolean
  }[]
}

/** GET /api/portfolio 的完整响应 */
export interface PortfolioResponse {
  asOf: string
  holdings: Holding[]
  trades: Trade[]
  pairs: TPair[]
  market: MarketSnapshot
  summary: PortfolioSummary
  costCurve: { date: string; value: number }[]
  meta: ApiMeta
}

/** 应用设置 */
export interface AppSettings {
  pairMaxGapDays: number
  autoRefresh: boolean
  refreshSeconds: number
  remindTier: boolean
  remindPendingT: boolean
}

/** GET /api/health */
export interface HealthInfo {
  status: string
  version: string
  asOf: string
  dataDir: string
  cacheDir: string
  funds: number
  trades: number
}
