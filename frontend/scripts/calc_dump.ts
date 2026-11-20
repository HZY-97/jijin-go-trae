/**
 * 对拍用：把前端 calc.ts 的计算结果导出成 JSON，供后端 Python 实现比对。
 *
 *   node scripts/calc_dump.ts [asOf] > /tmp/ts.json
 */
import { MOCK_FUNDS, MOCK_FEES, MOCK_NAV, MOCK_TRADES } from '../src/data/mock.ts'
import { deriveHolding, pairTrades, summarize } from '../src/lib/calc.ts'

const asOf = process.argv[2] ?? '2026-11-20'

const { pairs } = pairTrades(MOCK_TRADES)

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
    asOf,
  )
}).filter((h) => h.shares > 0)

const out = {
  holdings,
  pairs,
  summary: summarize(holdings),
}

process.stdout.write(JSON.stringify(out, null, 2))
