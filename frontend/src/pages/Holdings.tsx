import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ChangeText, EmptyState } from '../components/ui'
import { IconPlus, IconSearch } from '../components/icons'
import { money, pct } from '../lib/format'
import { useStore } from '../lib/store'
import { FundFormModal } from './FundForm'

export function Holdings() {
  const { holdings, summary } = useStore()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...holdings].sort((a, b) => b.marketValue - a.marketValue)
    if (!q) return list
    return list.filter(
      (h) =>
        h.fund.name.toLowerCase().includes(q) ||
        h.fund.code.includes(q) ||
        h.fund.company.toLowerCase().includes(q),
    )
  }, [holdings, query])

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight sm:text-[22px]">
            持仓
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            {summary.positionCount} 只 · 总市值 {money(summary.marketValue)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted">
              <IconSearch width={15} height={15} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索基金名称或代码"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-[13px] outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <IconPlus width={15} height={15} />
            添加基金
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={query ? '没有匹配的基金' : '还没有持仓'}
            description={
              query
                ? '换个关键词试试'
                : '添加一只基金并配置它的买入费率、每日持有费与卖出费率，系统会自动核算隐性成本。'
            }
            action={
              !query && (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  <IconPlus width={15} height={15} />
                  添加基金
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* ===== 桌面端表格 ===== */}
          <Card className="hidden lg:block" bodyClass="">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] text-text-muted">
                    <th className="px-5 py-2.5 text-left font-medium">基金</th>
                    <th className="px-3 py-2.5 text-right font-medium">持有份额</th>
                    <th className="px-3 py-2.5 text-right font-medium">成本价</th>
                    <th className="px-3 py-2.5 text-right font-medium">现价 / 估值</th>
                    <th className="px-3 py-2.5 text-right font-medium">市值</th>
                    <th className="px-3 py-2.5 text-right font-medium">浮动盈亏</th>
                    <th className="px-3 py-2.5 text-right font-medium">隐性成本</th>
                    <th className="px-3 py-2.5 text-right font-medium">赎回费</th>
                    <th className="px-3 py-2.5 text-right font-medium">做 T</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => (
                    <tr
                      key={h.fund.code}
                      className="border-b border-border last:border-0 hover:bg-surface-2"
                    >
                      <td className="px-5 py-3">
                        <Link
                          to={`/fund/${h.fund.code}`}
                          className="block max-w-[240px] truncate font-medium hover:text-accent"
                        >
                          {h.fund.name}
                        </Link>
                        <span className="num text-[11px] text-text-muted">
                          {h.fund.code} · {h.fund.category}
                        </span>
                      </td>
                      <td className="num px-3 py-3 text-right text-text-secondary">
                        {h.shares.toLocaleString('zh-CN', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="num px-3 py-3 text-right text-text-secondary">
                        {h.costPrice.toFixed(4)}
                        <div className="text-[11px] text-text-muted">
                          原始 {h.rawCostPrice.toFixed(4)}
                        </div>
                      </td>
                      <td className="num px-3 py-3 text-right">
                        {h.nav.toFixed(4)}
                        {h.dayChangePct !== undefined && (
                          <div className="text-[11px]">
                            <ChangeText
                              value={h.dayChangePct}
                              text={pct(h.dayChangePct)}
                            />
                          </div>
                        )}
                      </td>
                      <td className="num px-3 py-3 text-right font-medium">
                        {money(h.marketValue)}
                      </td>
                      <td className="num px-3 py-3 text-right">
                        <ChangeText value={h.profit} text={money(h.profit)} />
                        <div className="text-[11px]">
                          <ChangeText
                            value={h.profitRate}
                            text={pct(h.profitRate)}
                          />
                        </div>
                      </td>
                      <td className="num px-3 py-3 text-right">
                        <span className="text-warn">{money(h.hiddenCost)}</span>
                        <div className="text-[11px] text-text-muted">
                          买 {money(h.subscribeFeePaid)} · 持{' '}
                          {money(h.holdFeeAccrued)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <CurrentTierBadge holding={h} />
                      </td>
                      <td className="num px-3 py-3 text-right">
                        {h.tCount > 0 ? (
                          <>
                            <ChangeText
                              value={h.tNetProfit}
                              text={money(h.tNetProfit)}
                            />
                            <div className="text-[11px] text-text-muted">
                              {h.tCount} 次
                            </div>
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ===== 移动端卡片 ===== */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((h) => (
              <Link
                key={h.fund.code}
                to={`/fund/${h.fund.code}`}
                className="card block p-4 transition-colors active:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">
                      {h.fund.name}
                    </div>
                    <div className="num mt-0.5 text-[11px] text-text-muted">
                      {h.fund.code} · {h.fund.category} · 持有 {h.holdingDays} 天
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-[15px] font-semibold">
                      {money(h.marketValue)}
                    </div>
                    <ChangeText
                      value={h.profitRate}
                      text={pct(h.profitRate)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                  <Cell label="成本价" value={h.costPrice.toFixed(4)} />
                  <Cell label="净值" value={h.nav.toFixed(4)} />
                  <Cell
                    label="日涨跌"
                    value={
                      h.dayChangePct !== undefined ? pct(h.dayChangePct) : '—'
                    }
                    tone={h.dayChangePct ?? 0}
                  />
                  <Cell
                    label="隐性成本"
                    value={money(h.hiddenCost)}
                    color="text-warn"
                  />
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <CurrentTierBadge holding={h} />
                  {h.tCount > 0 && (
                    <Badge tone={h.tNetProfit >= 0 ? 'up' : 'down'}>
                      做T {h.tCount} 次 · {money(h.tNetProfit)}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <FundFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}

/* ============================================================
   子组件
   ============================================================ */

function Cell({
  label,
  value,
  tone,
  color: colorOverride,
}: {
  label: string
  value: string
  tone?: number
  color?: string
}) {
  const color =
    colorOverride ??
    (tone === undefined
      ? 'text-text'
      : tone > 0
        ? 'text-up'
        : tone < 0
          ? 'text-down'
          : 'text-text')
  return (
    <div>
      <div className="text-[10px] text-text-muted">{label}</div>
      <div className={`num mt-0.5 text-[13px] font-medium ${color}`}>{value}</div>
    </div>
  )
}

export function CurrentTierBadge({
  holding,
}: {
  holding: import('../types').Holding
}) {
  const tier =
    holding.fee.redeemTiers.find(
      (t) =>
        holding.holdingDays >= t.minDays &&
        (t.maxDays === null || holding.holdingDays <= t.maxDays),
    ) ?? null

  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={tier && tier.rate > 0 ? 'warn' : 'down'}>
        {tier ? `${tier.rate.toFixed(2)}%` : '免赎回费'}
      </Badge>
      {holding.daysToNextTier !== null && holding.nextRedeemTier && (
        <span className="num text-[11px] text-text-muted">
          {holding.daysToNextTier}天后→{holding.nextRedeemTier.rate.toFixed(2)}%
        </span>
      )}
    </span>
  )
}
