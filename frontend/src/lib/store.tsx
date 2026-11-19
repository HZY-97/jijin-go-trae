import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  MOCK_FUNDS,
  MOCK_FEES,
  MOCK_MARKET,
  MOCK_NAV,
  MOCK_TRADES,
} from '../data/mock'
import { deriveHolding, pairTrades, summarize } from './calc'
import type { Holding, MarketSnapshot, Trade } from '../types'

interface StoreValue {
  holdings: Holding[]
  trades: Trade[]
  pairs: ReturnType<typeof pairTrades>['pairs']
  market: MarketSnapshot
  summary: ReturnType<typeof summarize>
  /** 组合的隐性成本按日累计（用于总览图） */
  costCurve: { date: string; value: number }[]
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trades] = useState<Trade[]>(MOCK_TRADES)

  const value = useMemo<StoreValue>(() => {
    const { pairs } = pairTrades(trades)

    const holdings = MOCK_FUNDS.map((fund) => {
      const fee = MOCK_FEES[fund.code]
      const n = MOCK_NAV[fund.code]
      return deriveHolding(
        fund,
        fee,
        trades,
        n.nav,
        n.navDate,
        n.estNav,
        n.estChange,
        n.estTime,
        pairs,
      )
    }).filter((h) => h.shares > 0)

    // 隐性成本按日累计（简化为按日线性计提的演示曲线）
    const dailyHold = holdings.reduce((s, h) => s + h.holdFeeAccrued, 0)
    const totalHidden = holdings.reduce((s, h) => s + h.hiddenCost, 0)
    const oneOff = totalHidden - dailyHold

    const costCurve: { date: string; value: number }[] = []
    const start = new Date()
    start.setDate(start.getDate() - 60)
    for (let i = 0; i <= 60; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const p = (n: number) => String(n).padStart(2, '0')
      const ratio = i / 60
      costCurve.push({
        date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        value: Number((oneOff * Math.min(1, ratio * 3) + dailyHold * ratio).toFixed(2)),
      })
    }

    return {
      holdings,
      trades,
      pairs,
      market: MOCK_MARKET,
      summary: summarize(holdings),
      costCurve,
    }
  }, [trades])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/** 单只基金详情数据 */
export function useFundDetail(code: string) {
  const { holdings, trades, pairs } = useStore()
  const holding = holdings.find((h) => h.fund.code === code) ?? null
  const fundTrades = trades.filter((t) => t.fundCode === code)
  const fundPairs = pairs.filter((p) => p.fundCode === code)
  return { holding, fundTrades, fundPairs }
}
