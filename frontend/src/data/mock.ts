import type { FeeProfile, Fund, MarketSnapshot, Trade } from '../types'

/**
 * 演示用模拟数据。后续接入后端后由 API 覆盖。
 * 场景设定：场外基金，长周期持有 + 择机做 T 稀释持仓成本。
 */

export const MOCK_FUNDS: Fund[] = [
  {
    code: '161725',
    name: '招商中证白酒指数(LOF)A',
    category: '指数型',
    company: '招商基金',
  },
  {
    code: '110022',
    name: '易方达消费行业股票',
    category: '股票型',
    company: '易方达基金',
  },
  {
    code: '005827',
    name: '易方达蓝筹精选混合',
    category: '混合型',
    company: '易方达基金',
  },
  {
    code: '001618',
    name: '天弘中证食品饮料指数A',
    category: '指数型',
    company: '天弘基金',
  },
  {
    code: '320007',
    name: '诺安成长混合',
    category: '混合型',
    company: '诺安基金',
  },
  {
    code: '260108',
    name: '景顺长城新兴成长混合',
    category: '混合型',
    company: '景顺长城基金',
  },
]

/**
 * 费率档案。
 * redeemTiers 是赎回费阶梯（按持有天数），从常见的天天基金规则抽象。
 */
export const MOCK_FEES: Record<string, FeeProfile> = {
  '161725': {
    subscribeRate: 0.12,
    dailyHoldRate: 0.6,
    redeemTiers: [
      { minDays: 0, maxDays: 6, rate: 1.5 },
      { minDays: 7, maxDays: 29, rate: 0.75 },
      { minDays: 30, maxDays: null, rate: 0 },
    ],
    minSubscribe: 10,
  },
  '110022': {
    subscribeRate: 0.15,
    dailyHoldRate: 1.2,
    redeemTiers: [
      { minDays: 0, maxDays: 6, rate: 1.5 },
      { minDays: 7, maxDays: 29, rate: 0.75 },
      { minDays: 30, maxDays: null, rate: 0 },
    ],
    minSubscribe: 10,
  },
  '005827': {
    subscribeRate: 0.15,
    dailyHoldRate: 1.2,
    redeemTiers: [
      { minDays: 0, maxDays: 6, rate: 1.5 },
      { minDays: 7, maxDays: 364, rate: 0.5 },
      { minDays: 365, maxDays: null, rate: 0 },
    ],
    minSubscribe: 10,
  },
  '001618': {
    subscribeRate: 0.1,
    dailyHoldRate: 0.5,
    redeemTiers: [
      { minDays: 0, maxDays: 6, rate: 1.5 },
      { minDays: 7, maxDays: 29, rate: 0.75 },
      { minDays: 30, maxDays: null, rate: 0 },
    ],
    minSubscribe: 10,
  },
  '320007': {
    subscribeRate: 0.15,
    dailyHoldRate: 1.2,
    redeemTiers: [
      { minDays: 0, maxDays: 6, rate: 1.5 },
      { minDays: 7, maxDays: 29, rate: 0.75 },
      { minDays: 30, maxDays: null, rate: 0 },
    ],
    minSubscribe: 10,
  },
  '260108': {
    subscribeRate: 0.12,
    dailyHoldRate: 1.2,
    redeemTiers: [
      { minDays: 0, maxDays: 6, rate: 1.5 },
      { minDays: 7, maxDays: 364, rate: 0.5 },
      { minDays: 365, maxDays: null, rate: 0 },
    ],
    minSubscribe: 10,
  },
}

/** 最新净值与估算 */
export const MOCK_NAV: Record<
  string,
  { nav: number; navDate: string; estNav: number | null; estChange: number | null; estTime: string | null }
> = {
  '161725': { nav: 0.5791, navDate: '2026-11-18', estNav: 0.5769, estChange: -0.38, estTime: '09:33' },
  '110022': { nav: 3.0100, navDate: '2026-11-18', estNav: 3.0114, estChange: -0.52, estTime: '09:33' },
  '005827': { nav: 1.3578, navDate: '2026-11-18', estNav: 1.3566, estChange: -0.44, estTime: '09:33' },
  '001618': { nav: 0.8124, navDate: '2026-11-18', estNav: 0.8091, estChange: -0.41, estTime: '09:33' },
  '320007': { nav: 0.9600, navDate: '2026-11-18', estNav: 0.9655, estChange: 0.57, estTime: '09:33' },
  '260108': { nav: 2.1460, navDate: '2026-11-18', estNav: 2.1389, estChange: -0.33, estTime: '09:33' },
}

/** 交易流水：包含长周期建仓 + 若干次做 T */
export const MOCK_TRADES: Trade[] = [
  // ── 161725 招商中证白酒：建仓 + 2 次做 T ──────────────────
  { id: 't1', fundCode: '161725', date: '2026-02-10', side: 'buy', shares: 20000, nav: 0.6420, amount: 12840, feeRate: 0.12, fee: 15.41, note: '建仓' },
  { id: 't2', fundCode: '161725', date: '2026-04-18', side: 'buy', shares: 15000, nav: 0.5180, amount: 7770, feeRate: 0.12, fee: 9.32, note: '加仓' },
  { id: 't3', fundCode: '161725', date: '2026-06-22', side: 'sell', shares: 10000, nav: 0.5620, amount: 5620, feeRate: 0.75, fee: 42.15, note: '做T卖出' },
  { id: 't4', fundCode: '161725', date: '2026-06-26', side: 'buy', shares: 10000, nav: 0.5310, amount: 5310, feeRate: 0.12, fee: 6.37, note: '做T买回' },
  { id: 't5', fundCode: '161725', date: '2026-09-14', side: 'sell', shares: 12000, nav: 0.6010, amount: 7212, feeRate: 0.75, fee: 54.09, note: '做T卖出' },
  { id: 't6', fundCode: '161725', date: '2026-09-18', side: 'buy', shares: 12000, nav: 0.5640, amount: 6768, feeRate: 0.12, fee: 8.12, note: '做T买回' },
  { id: 't7', fundCode: '161725', date: '2026-11-06', side: 'buy', shares: 8000, nav: 0.5900, amount: 4720, feeRate: 0.12, fee: 5.66, note: '加仓' },

  // ── 110022 易方达消费行业：建仓 + 1 次做 T ─────────────────
  { id: 't8', fundCode: '110022', date: '2026-01-15', side: 'buy', shares: 3000, nav: 2.8600, amount: 8580, feeRate: 0.15, fee: 12.87 },
  { id: 't9', fundCode: '110022', date: '2026-03-28', side: 'sell', shares: 1000, nav: 3.1200, amount: 3120, feeRate: 0.75, fee: 23.4, note: '做T卖出' },
  { id: 't10', fundCode: '110022', date: '2026-04-02', side: 'buy', shares: 1000, nav: 3.0100, amount: 3010, feeRate: 0.15, fee: 4.52, note: '做T买回' },
  { id: 't11', fundCode: '110022', date: '2026-07-20', side: 'buy', shares: 1500, nav: 2.9400, amount: 4410, feeRate: 0.15, fee: 6.62, note: '加仓' },
  { id: 't12', fundCode: '110022', date: '2026-10-25', side: 'sell', shares: 1200, nav: 3.2400, amount: 3888, feeRate: 0.75, fee: 29.16, note: '做T卖出' },
  { id: 't13', fundCode: '110022', date: '2026-10-29', side: 'buy', shares: 1200, nav: 3.1500, amount: 3780, feeRate: 0.15, fee: 5.67, note: '做T买回' },

  // ── 005827 易方达蓝筹精选：单笔长持 ─────────────────────────
  { id: 't14', fundCode: '005827', date: '2026-03-05', side: 'buy', shares: 8000, nav: 1.2860, amount: 10288, feeRate: 0.15, fee: 15.43 },
  { id: 't15', fundCode: '005827', date: '2026-05-18', side: 'buy', shares: 6000, nav: 1.4020, amount: 8412, feeRate: 0.15, fee: 12.62 },

  // ── 001618 食品饮料指数：近期建仓 ───────────────────────────
  { id: 't16', fundCode: '001618', date: '2026-08-12', side: 'buy', shares: 10000, nav: 0.7840, amount: 7840, feeRate: 0.1, fee: 7.84 },

  // ── 320007 诺安成长：做 T 中（已卖待买回） ──────────────────
  { id: 't17', fundCode: '320007', date: '2026-02-26', side: 'buy', shares: 5000, nav: 1.0500, amount: 5250, feeRate: 0.15, fee: 7.88 },
  { id: 't18', fundCode: '320007', date: '2026-11-17', side: 'sell', shares: 2000, nav: 1.0240, amount: 2048, feeRate: 0.75, fee: 15.36, note: '做T卖出' },

  // ── 260108 景顺长城新兴成长：做 T 中 ───────────────────────
  { id: 't19', fundCode: '260108', date: '2026-04-16', side: 'buy', shares: 4000, nav: 2.2100, amount: 8840, feeRate: 0.12, fee: 10.61 },
  { id: 't20', fundCode: '260108', date: '2026-11-17', side: 'sell', shares: 1500, nav: 2.1680, amount: 3252, feeRate: 0.75, fee: 24.39, note: '做T卖出' },
]

export const MOCK_MARKET: MarketSnapshot = {
  updatedAt: '09:33',
  indices: [
    { code: 'sh000300', name: '沪深300', price: 3950.01, change: -33.76, changePct: -0.85 },
    { code: 'sz399001', name: '深证成指', price: 10552.97, change: -106.44, changePct: -1.0 },
    { code: 'sz399006', name: '创业板指', price: 2276.46, change: -35.16, changePct: -1.52 },
    { code: 'sh000905', name: '中证500', price: 6284.17, change: -48.92, changePct: -0.77 },
    { code: 'sh000016', name: '上证50', price: 2874.36, change: -19.45, changePct: -0.67 },
  ],
}

/**
 * 构造某只基金的历史净值序列（用于走势图演示）。
 * 用确定性伪随机保证每次渲染一致。
 */
export function mockNavSeries(
  code: string,
  days = 180,
): { date: string; nav: number; accNav: number }[] {
  const base = MOCK_NAV[code]?.nav ?? 1
  const seed = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const out: { date: string; nav: number; accNav: number }[] = []
  const start = new Date()
  start.setDate(start.getDate() - days)

  // 多频正弦叠加出自然的起伏，再整体平移使末点恰好等于当前净值，
  // 这样走势图既没有末端的垂直跳变，也不会把当前值推到波谷。
  const wave: number[] = []
  for (let i = 0; i < days; i++) {
    wave.push(
      0.13 * Math.sin(i / 17 + (seed % 7)) +
        0.07 * Math.sin(i / 6.3 + (seed % 5)) +
        0.045 * Math.sin(i / 41 + (seed % 3)) +
        0.02 * Math.sin(i / 3.1),
    )
  }
  const shift = wave[days - 1]

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const p = (n: number) => String(n).padStart(2, '0')
    const nav = Number((base * (1 + wave[i] - shift)).toFixed(4))
    out.push({
      date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      nav,
      accNav: Number((nav * 1.08).toFixed(4)),
    })
  }
  return out
}

/** 大盘走势图（沪深300 近 90 日） */
export function mockIndexSeries(days = 90): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = []
  const start = new Date()
  start.setDate(start.getDate() - days)
  // 生成自然波动的序列后整体缩放，使末点落在目标点位，避免出现突兀的垂直跳变
  const raw: number[] = []
  let v = 1
  for (let i = 0; i < days; i++) {
    v *= 1 + Math.sin(i / 9) * 0.008 + (((i * 29) % 100) / 100 - 0.5) * 0.011
    raw.push(v)
  }
  const scale = 3950.01 / raw[raw.length - 1]
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const p = (n: number) => String(n).padStart(2, '0')
    out.push({
      date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      value: Number((raw[i] * scale).toFixed(2)),
    })
  }
  return out
}

/** 隐性成本按日累计曲线（演示） */
export function mockCostCumulative(days = 90): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = []
  let v = 0
  const start = new Date()
  start.setDate(start.getDate() - days)
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    v += 3.1 + Math.sin(i / 7) * 1.4 + (((i * 13) % 100) / 100) * 1.1
    const p = (n: number) => String(n).padStart(2, '0')
    out.push({
      date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      value: Number(v.toFixed(2)),
    })
  }
  return out
}
