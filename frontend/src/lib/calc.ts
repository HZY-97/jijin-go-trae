import type {
  FeeProfile,
  Fund,
  Holding,
  RedeemTier,
  TPair,
  Trade,
} from '../types'

/* ============================================================
   日期工具
   ============================================================ */

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return formatDate(d)
}

export function daysBetween(from: string, to: string): number {
  const ms = parseDate(to).getTime() - parseDate(from).getTime()
  return Math.round(ms / 86400000)
}

/** 今天（可用参数覆盖，便于测试与演示） */
export function today(): string {
  return formatDate(new Date())
}

/* ============================================================
   费率计算
   ============================================================ */

/** 按持有天数匹配赎回费率档位 */
export function matchRedeemTier(tiers: RedeemTier[], days: number): RedeemTier | null {
  for (const t of tiers) {
    if (days >= t.minDays && (t.maxDays === null || days <= t.maxDays)) return t
  }
  return null
}

/** 找出下一个更有利的费率档位（天数为 0 的档位通常费率更低） */
export function nextTier(
  tiers: RedeemTier[],
  days: number,
): { tier: RedeemTier; inDays: number } | null {
  const candidates = tiers
    .filter((t) => t.minDays > days && t.rate < (matchRedeemTier(tiers, days)?.rate ?? Infinity))
    .sort((a, b) => a.minDays - b.minDays)
  if (!candidates.length) return null
  return { tier: candidates[0], inDays: candidates[0].minDays - days }
}

/** 买入费用 */
export function subscribeFee(amount: number, rate: number): number {
  return round2(amount * (rate / 100))
}

/** 卖出费用 */
export function redeemFee(amount: number, tier: RedeemTier | null): number {
  if (!tier) return 0
  return round2(amount * (tier.rate / 100))
}

/** 每日持有费（按份额 × 净值 × 年化费率 / 365） */
export function dailyHoldFee(
  marketValue: number,
  annualRate: number,
  days = 1,
): number {
  return round2((marketValue * (annualRate / 100)) / 365 * days)
}

/* ============================================================
   数值工具
   ============================================================ */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000
}

/* ============================================================
   做 T 配对
   ============================================================
   规则（可在设置中调整）：
   - 同一只基金
   - 卖出腿在前，买入腿在后
   - 两腿间隔 ≤ maxGapDays（默认 10 个自然日，含周末/节假日宽限）
   - 优先配对时间最近的卖出腿（FIFO）
*/

export interface PairOptions {
  maxGapDays: number
}

export const DEFAULT_PAIR_OPTIONS: PairOptions = { maxGapDays: 10 }

/**
 * 从流水中识别做 T 配对。
 * 一次「做 T」= 先卖出一部分（或全部），随后再买回。
 */
export function pairTrades(
  trades: Trade[],
  options: PairOptions = DEFAULT_PAIR_OPTIONS,
): { pairs: TPair[]; unmatched: Trade[] } {
  const sorted = [...trades].sort(
    (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime(),
  )

  const pairs: TPair[] = []
  const consumed = new Set<string>()
  const unmatched: Trade[] = []

  // 以每只基金的卖出腿为起点，向后找最近的、份额可覆盖的买入腿
  const byFund = new Map<string, Trade[]>()
  for (const t of sorted) {
    if (!byFund.has(t.fundCode)) byFund.set(t.fundCode, [])
    byFund.get(t.fundCode)!.push(t)
  }

  for (const [fundCode, list] of byFund) {
    const sells = list.filter((t) => t.side === 'sell')
    const buys = list.filter((t) => t.side === 'buy')

    for (const sell of sells) {
      if (consumed.has(sell.id)) continue

      const sellDate = parseDate(sell.date).getTime()
      let best: Trade | null = null
      let bestGap = Infinity

      for (const buy of buys) {
        if (consumed.has(buy.id)) continue
        const buyTime = parseDate(buy.date).getTime()
        if (buyTime <= sellDate) continue
        const gap = daysBetween(sell.date, buy.date)
        if (gap > options.maxGapDays) continue
        if (gap < bestGap) {
          bestGap = gap
          best = buy
        }
      }

      if (!best) {
        unmatched.push(sell)
        continue
      }

      // 用卖出份额的一部分做 T；这里按买入腿实际份额计算，卖出多于买入的部分视为赎回减仓
      const tShares = Math.min(sell.shares, best.shares)
      const spreadProfit = round2((sell.nav - best.nav) * tShares)
      const sellFeePortion = round2((sell.feeRate / 100) * sell.nav * tShares)
      const buyFeePortion = round2((best.feeRate / 100) * best.nav * tShares)
      const totalFee = round2(sellFeePortion + buyFeePortion)
      const netProfit = round2(spreadProfit - totalFee)
      const buyAmount = round2(best.nav * tShares)

      pairs.push({
        id: `tp-${sell.id}-${best.id}`,
        fundCode,
        sell,
        buy: best,
        spreadProfit,
        totalFee,
        netProfit,
        netRate: buyAmount > 0 ? round2((netProfit / buyAmount) * 100) : 0,
        daysBetween: bestGap,
      })

      consumed.add(sell.id)
      consumed.add(best.id)
    }
  }

  for (const t of sorted) {
    if (!consumed.has(t.id) && !unmatched.includes(t)) unmatched.push(t)
  }

  return { pairs, unmatched }
}

/* ============================================================
   持仓推导
   ============================================================ */

/**
 * 由交易流水 + 费率档案 + 最新净值推导持仓。
 * 采用移动加权平均法计算摊薄成本价：
 *   成本价 = (累计买入金额 + 累计买入费 + 累计持有费 − 累计卖出金额 − 累计卖出费) / 当前份额
 */
export function deriveHolding(
  fund: Fund,
  fee: FeeProfile,
  trades: Trade[],
  nav: number,
  navDate: string,
  estimateNav: number | null,
  estimateChange: number | null,
  estimateTime: string | null,
  tPairs: TPair[] = [],
  asOf: string = today(),
): Holding {
  const mine = trades
    .filter((t) => t.fundCode === fund.code)
    .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())

  let shares = 0
  let costAmount = 0
  let subscribeFeePaid = 0
  let redeemFeePaid = 0
  let holdFeeAccrued = 0
  let firstBuyDate: string | null = null

  for (const t of mine) {
    if (t.side === 'buy') {
      shares += t.shares
      costAmount += t.amount + t.fee
      subscribeFeePaid += t.fee
      if (!firstBuyDate) firstBuyDate = t.date
    } else {
      const avgCost = shares > 0 ? costAmount / shares : 0
      costAmount -= avgCost * t.shares
      shares -= t.shares
      redeemFeePaid += t.fee
      // 赎回会让持仓天数重置，这里仅记录卖出，不改写 firstBuyDate
    }
  }

  // 持有费：按买入腿逐段计提（每笔买入的份额在其存续期内按日计提）
  const currentShares = shares
  for (const t of mine) {
    if (t.side !== 'buy') continue
    const days = Math.max(0, daysBetween(t.date, asOf))
    const value = t.shares * nav
    holdFeeAccrued += dailyHoldFee(value, fee.dailyHoldRate, days)
  }

  const marketValue = round2(currentShares * nav)
  const rawCostAmount = costAmount - (subscribeFeePaid + holdFeeAccrued) + redeemFeePaid
  const rawCostPrice = shares > 0 ? round4(rawCostAmount / shares) : 0
  const costPrice = shares > 0 ? round4(costAmount / shares) : 0

  const profit = round2(marketValue - costAmount)
  const profitRate =
    costAmount > 0 ? round2((profit / costAmount) * 100) : 0

  const hiddenCost = round2(subscribeFeePaid + redeemFeePaid + holdFeeAccrued)
  const totalIn = mine
    .filter((t) => t.side === 'buy')
    .reduce((s, t) => s + t.amount, 0)
  const hiddenCostRate = totalIn > 0 ? round2((hiddenCost / totalIn) * 100) : 0

  const holdingDays = firstBuyDate ? daysBetween(firstBuyDate, asOf) : 0
  const next = nextTier(fee.redeemTiers, holdingDays)
  const myPairs = tPairs.filter((p) => p.fundCode === fund.code)

  return {
    fund,
    fee,
    shares: round2(currentShares),
    costPrice,
    rawCostPrice,
    nav,
    navDate,
    estimateNav,
    estimateChange,
    estimateTime,
    marketValue,
    profit,
    profitRate,
    subscribeFeePaid: round2(subscribeFeePaid),
    redeemFeePaid: round2(redeemFeePaid),
    holdFeeAccrued: round2(holdFeeAccrued),
    hiddenCost,
    hiddenCostRate,
    holdingDays,
    nextRedeemTier: next?.tier ?? null,
    daysToNextTier: next?.inDays ?? null,
    tCount: myPairs.length,
    tNetProfit: round2(myPairs.reduce((s, p) => s + p.netProfit, 0)),
  }
}

/* ============================================================
   组合汇总
   ============================================================ */

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

export function summarize(holdings: Holding[]): PortfolioSummary {
  const marketValue = holdings.reduce((s, h) => s + h.marketValue, 0)
  const costAmount = holdings.reduce((s, h) => s + h.marketValue - h.profit, 0)
  const profit = holdings.reduce((s, h) => s + h.profit, 0)

  const subscribeFeePaid = holdings.reduce((s, h) => s + h.subscribeFeePaid, 0)
  const redeemFeePaid = holdings.reduce((s, h) => s + h.redeemFeePaid, 0)
  const holdFeeAccrued = holdings.reduce((s, h) => s + h.holdFeeAccrued, 0)
  const hiddenCost = subscribeFeePaid + redeemFeePaid + holdFeeAccrued

  const totalIn = holdings.reduce(
    (s, h) => s + h.marketValue - h.profit,
    0,
  )

  // 当日盈亏：按估算涨跌幅折算
  let dayProfit = 0
  for (const h of holdings) {
    if (h.estimateChange === null) continue
    dayProfit += (h.marketValue * h.estimateChange) / 100
  }

  const tCount = holdings.reduce((s, h) => s + h.tCount, 0)
  const tNetProfit = holdings.reduce((s, h) => s + h.tNetProfit, 0)

  return {
    marketValue: round2(marketValue),
    costAmount: round2(costAmount),
    profit: round2(profit),
    profitRate: costAmount > 0 ? round2((profit / costAmount) * 100) : 0,
    hiddenCost: round2(hiddenCost),
    subscribeFeePaid: round2(subscribeFeePaid),
    redeemFeePaid: round2(redeemFeePaid),
    holdFeeAccrued: round2(holdFeeAccrued),
    hiddenCostRate: totalIn > 0 ? round2((hiddenCost / totalIn) * 100) : 0,
    dayProfit: round2(dayProfit),
    dayProfitRate: marketValue > 0 ? round2((dayProfit / marketValue) * 100) : 0,
    tCount,
    tNetProfit: round2(tNetProfit),
    positionCount: holdings.length,
  }
}
