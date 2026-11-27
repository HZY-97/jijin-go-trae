import type {
  AppSettings,
  FeeProfile,
  Fund,
  FundRecord,
  HealthInfo,
  MarketSnapshot,
  NavPoint,
  PortfolioResponse,
  Trade,
} from '../types'

/**
 * 后端 API 客户端。
 * 开发时前端跑在 5180，通过 vite proxy 把 /api 转发到 127.0.0.1:8000。
 */

const BASE = '/api'
const DEFAULT_TIMEOUT = 15000

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeout = DEFAULT_TIMEOUT,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    if (!res.ok) {
      let detail = `请求失败（HTTP ${res.status}）`
      try {
        const body = await res.json()
        if (typeof body?.detail === 'string') detail = body.detail
      } catch {
        /* 响应体不是 JSON，保留默认文案 */
      }
      throw new ApiError(detail, res.status)
    }

    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('请求超时，后端没有响应', 0)
    }
    throw new ApiError('无法连接后端服务（127.0.0.1:8000）', 0)
  } finally {
    clearTimeout(timer)
  }
}

function body(data: unknown): string {
  return JSON.stringify(data)
}

/* ============================================================
   系统
   ============================================================ */

export function getHealth(): Promise<HealthInfo> {
  return request<HealthInfo>('/health')
}

export function exportData(): Promise<{
  version: number
  exportedAt: string
  funds: FundRecord[]
  trades: Trade[]
  settings: AppSettings
}> {
  return request('/export')
}

export function importData(payload: {
  funds: FundRecord[]
  trades: Trade[]
  settings: Partial<AppSettings>
}): Promise<{ importedFunds: number; importedTrades: number }> {
  return request('/import', { method: 'POST', body: body(payload) })
}

export function clearData(): Promise<{ cleared: boolean }> {
  return request('/data?confirm=true', { method: 'DELETE' })
}

/* ============================================================
   组合
   ============================================================ */

export function getPortfolio(options?: {
  refresh?: boolean
}): Promise<PortfolioResponse> {
  const q = options?.refresh ? '?refresh=true' : ''
  return request<PortfolioResponse>(`/portfolio${q}`)
}

export function getMarket(): Promise<MarketSnapshot> {
  return request<MarketSnapshot>('/market')
}

/* ============================================================
   基金
   ============================================================ */

export function listFunds(): Promise<FundRecord[]> {
  return request<FundRecord[]>('/funds')
}

export function upsertFund(
  fund: Fund,
  fee: FeeProfile,
): Promise<FundRecord> {
  return request<FundRecord>('/funds', { method: 'POST', body: body({ fund, fee }) })
}

export function updateFee(code: string, fee: FeeProfile): Promise<FundRecord> {
  return request<FundRecord>(`/funds/${code}`, {
    method: 'PUT',
    body: body({ fee }),
  })
}

export function deleteFund(code: string): Promise<{ removed: boolean; removedTrades: number }> {
  return request(`/funds/${code}`, { method: 'DELETE' })
}

/** 从天天基金抓取费率档案（不入库，仅供表单预览） */
export function getAutoFee(code: string): Promise<{
  code: string
  fee: FeeProfile
  source: string
  fund?: Fund
  quote?: { nav?: number; navDate?: string; [k: string]: unknown }
  stale?: boolean
  warning?: string
}> {
  return request(`/funds/${code}/fee/auto`, {}, 30000)
}

export function getNavHistory(
  code: string,
  range: '30' | '90' | '180' | 'all' = '180',
): Promise<{
  code: string
  points: NavPoint[]
  stale: boolean
  warning: string | null
}> {
  return request(`/funds/${code}/nav-history?range=${range}`, {}, 30000)
}

/* ============================================================
   流水
   ============================================================ */

export interface TradePayload {
  fundCode: string
  date: string
  side: 'buy' | 'sell'
  shares: number
  nav: number
  amount?: number
  feeRate?: number
  fee?: number
  note?: string
}

export function listTrades(fundCode?: string): Promise<{ trades: Trade[] }> {
  const q = fundCode ? `?fundCode=${encodeURIComponent(fundCode)}` : ''
  return request<{ trades: Trade[] }>(`/trades${q}`)
}

export function createTrade(payload: TradePayload): Promise<{ trade: Trade }> {
  return request<{ trade: Trade }>('/trades', { method: 'POST', body: body(payload) })
}

export function updateTrade(
  id: string,
  payload: TradePayload,
): Promise<{ trade: Trade }> {
  return request<{ trade: Trade }>(`/trades/${id}`, {
    method: 'PUT',
    body: body(payload),
  })
}

export function deleteTrade(id: string): Promise<{ deleted: boolean; id: string }> {
  return request(`/trades/${id}`, { method: 'DELETE' })
}

/* ============================================================
   设置
   ============================================================ */

export function getSettings(): Promise<AppSettings> {
  return request<AppSettings>('/settings')
}

export function putSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  return request<AppSettings>('/settings', { method: 'PUT', body: body(patch) })
}
