import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  MOCK_FEES,
  MOCK_FUNDS,
  MOCK_MARKET,
  MOCK_NAV,
  MOCK_TRADES,
} from '../data/mock'
import { deriveHolding, pairTrades, summarize } from './calc'
import * as api from './api'
import type {
  ApiMeta,
  AppSettings,
  FundRecord,
  Holding,
  MarketSnapshot,
  PortfolioSummary,
  TPair,
  Trade,
} from '../types'

export type DataSource = 'api' | 'mock'
export type StoreStatus = 'loading' | 'ready' | 'error'

interface StoreData {
  holdings: Holding[]
  trades: Trade[]
  pairs: TPair[]
  market: MarketSnapshot
  summary: PortfolioSummary
  costCurve: { date: string; value: number }[]
  funds: FundRecord[]
}

interface StoreValue extends StoreData {
  status: StoreStatus
  /** 数据来自后端还是本地演示数据 */
  source: DataSource
  meta: ApiMeta | null
  error: string | null
  settings: AppSettings
  /** 重新拉取后端数据 */
  refresh: () => Promise<void>
  /** 保存设置（写后端并立即生效） */
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

const DEFAULT_SETTINGS: AppSettings = {
  pairMaxGapDays: 10,
  autoRefresh: true,
  refreshSeconds: 30,
  remindTier: true,
  remindPendingT: true,
}

/* ============================================================
   兜底：用本地 mock 数据现算一遍，保证后端离线时页面不白屏
   ============================================================ */

function buildMockData(pairMaxGapDays: number): StoreData {
  const { pairs } = pairTrades(MOCK_TRADES, { maxGapDays: pairMaxGapDays })

  const holdings = MOCK_FUNDS.map((fund) => {
    const fee = MOCK_FEES[fund.code]
    const n = MOCK_NAV[fund.code]
    return deriveHolding(
      fund,
      fee,
      MOCK_TRADES,
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

  const funds: FundRecord[] = MOCK_FUNDS.map((fund) => ({
    fund,
    fee: MOCK_FEES[fund.code],
    feeSource: 'mock',
    updatedAt: '',
  }))

  return {
    holdings,
    trades: MOCK_TRADES,
    pairs,
    market: MOCK_MARKET,
    summary: summarize(holdings),
    costCurve,
    funds,
  }
}

/* ============================================================
   StoreProvider
   ============================================================ */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(() =>
    buildMockData(DEFAULT_SETTINGS.pairMaxGapDays),
  )
  const [status, setStatus] = useState<StoreStatus>('loading')
  const [source, setSource] = useState<DataSource>('mock')
  const [meta, setMeta] = useState<ApiMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  const inflight = useRef(false)

  const load = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    setStatus('loading')
    try {
      const [portfolio, funds, s] = await Promise.all([
        api.getPortfolio(),
        api.listFunds(),
        api.getSettings(),
      ])
      setData({
        holdings: portfolio.holdings,
        trades: portfolio.trades,
        pairs: portfolio.pairs,
        market: portfolio.market,
        summary: portfolio.summary,
        costCurve: portfolio.costCurve,
        funds,
      })
      setMeta(portfolio.meta)
      setSettings(s)
      setSource('api')
      setError(null)
      setStatus('ready')
    } catch (err) {
      setData(buildMockData(DEFAULT_SETTINGS.pairMaxGapDays))
      setMeta(null)
      setSource('mock')
      setError(err instanceof Error ? err.message : '后端不可用')
      setStatus('error')
    } finally {
      inflight.current = false
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch }
      setSettings(next)
      try {
        const saved = await api.putSettings(patch)
        setSettings(saved)
      } catch (err) {
        setError(err instanceof Error ? err.message : '设置保存失败')
      }
      await load()
    },
    [settings, load],
  )

  const value = useMemo<StoreValue>(
    () => ({
      ...data,
      status,
      source,
      meta,
      error,
      settings,
      refresh: load,
      saveSettings,
    }),
    [data, status, source, meta, error, settings, load, saveSettings],
  )

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
