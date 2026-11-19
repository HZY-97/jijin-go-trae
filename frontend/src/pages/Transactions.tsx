import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ChangeText, EmptyState } from '../components/ui'
import { IconFilter, IconPlus, IconSwap } from '../components/icons'
import { money, pct, relativeDay } from '../lib/format'
import { useStore } from '../lib/store'

type Filter = 'all' | 'buy' | 'sell' | 't'

export function Transactions() {
  const { trades, pairs, holdings } = useStore()
  const [filter, setFilter] = useState<Filter>('all')

  const pairedTradeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const p of pairs) {
      ids.add(p.sell.id)
      ids.add(p.buy.id)
    }
    return ids
  }, [pairs])

  const filtered = useMemo(() => {
    const list = [...trades].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    )
    switch (filter) {
      case 'buy':
        return list.filter((t) => t.side === 'buy')
      case 'sell':
        return list.filter((t) => t.side === 'sell')
      case 't':
        return list.filter((t) => pairedTradeIds.has(t.id))
      default:
        return list
    }
  }, [trades, filter, pairedTradeIds])

  const fundName = (code: string) =>
    holdings.find((h) => h.fund.code === code)?.fund.name ?? code

  const totalFee = filtered.reduce((s, t) => s + t.fee, 0)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight sm:text-[22px]">
            交易流水
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            共 {trades.length} 笔 · 当前筛选费用合计 {money(totalFee)}
          </p>
        </div>
        <Button variant="primary">
          <IconPlus width={15} height={15} />
          记一笔
        </Button>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
          <IconFilter width={13} height={13} />
        </span>
        {(
          [
            ['all', '全部'],
            ['buy', '买入'],
            ['sell', '卖出'],
            ['t', '做 T 配对'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === k
                ? 'bg-accent text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState title="没有符合条件的流水" description="换个筛选条件试试" />
        </Card>
      ) : (
        <>
          {/* 桌面表格 */}
          <Card className="hidden lg:block" bodyClass="">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] text-text-muted">
                    <th className="px-5 py-2.5 text-left font-medium">日期</th>
                    <th className="px-3 py-2.5 text-left font-medium">基金</th>
                    <th className="px-3 py-2.5 text-left font-medium">方向</th>
                    <th className="px-3 py-2.5 text-right font-medium">份额</th>
                    <th className="px-3 py-2.5 text-right font-medium">净值</th>
                    <th className="px-3 py-2.5 text-right font-medium">金额</th>
                    <th className="px-3 py-2.5 text-right font-medium">费率</th>
                    <th className="px-3 py-2.5 text-right font-medium">费用</th>
                    <th className="px-5 py-2.5 text-left font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border last:border-0 hover:bg-surface-2"
                    >
                      <td className="num px-5 py-3 text-text-secondary">
                        {t.date}
                        <div className="text-[11px] text-text-muted">
                          {relativeDay(t.date)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to={`/fund/${t.fundCode}`}
                          className="block max-w-[200px] truncate font-medium hover:text-accent"
                        >
                          {fundName(t.fundCode)}
                        </Link>
                        <span className="num text-[11px] text-text-muted">
                          {t.fundCode}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={t.side === 'buy' ? 'up' : 'down'}>
                          {t.side === 'buy' ? '买入' : '卖出'}
                        </Badge>
                        {pairedTradeIds.has(t.id) && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-accent">
                            <IconSwap width={11} height={11} />
                            T
                          </span>
                        )}
                      </td>
                      <td className="num px-3 py-3 text-right text-text-secondary">
                        {t.shares.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="num px-3 py-3 text-right">{t.nav.toFixed(4)}</td>
                      <td className="num px-3 py-3 text-right">{money(t.amount)}</td>
                      <td className="num px-3 py-3 text-right text-text-muted">
                        {t.feeRate.toFixed(2)}%
                      </td>
                      <td className="num px-3 py-3 text-right text-warn">
                        {money(t.fee)}
                      </td>
                      <td className="px-5 py-3 text-text-muted">{t.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 移动端时间线 */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((t) => (
              <div key={t.id} className="card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={t.side === 'buy' ? 'up' : 'down'}>
                        {t.side === 'buy' ? '买入' : '卖出'}
                      </Badge>
                      {pairedTradeIds.has(t.id) && (
                        <Badge tone="accent">
                          <IconSwap width={10} height={10} />
                          T
                        </Badge>
                      )}
                      <span className="num text-[11px] text-text-muted">
                        {t.date}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[13px] font-medium">
                      {fundName(t.fundCode)}
                    </div>
                    <div className="num mt-0.5 text-[11px] text-text-muted">
                      {t.shares.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 份 @{' '}
                      {t.nav.toFixed(4)} · 费率 {t.feeRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-[14px] font-semibold">
                      {money(t.amount)}
                    </div>
                    <div className="num text-[11px] text-warn">费 {money(t.fee)}</div>
                  </div>
                </div>
                {t.note && (
                  <div className="mt-2 border-t border-border pt-2 text-[11px] text-text-muted">
                    {t.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 做 T 汇总 */}
      <Card title="做 T 汇总" subtitle={`${pairs.length} 次已完成配对`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryBox
            label="做 T 次数"
            value={`${pairs.length} 次`}
            hint={`覆盖 ${new Set(pairs.map((p) => p.fundCode)).size} 只基金`}
          />
          <SummaryBox
            label="价差收益合计"
            value={money(pairs.reduce((s, p) => s + p.spreadProfit, 0))}
            hint="未扣费用"
          />
          <SummaryBox
            label="净收益合计"
            value={money(pairs.reduce((s, p) => s + p.netProfit, 0))}
            hint={`费用 ${money(pairs.reduce((s, p) => s + p.totalFee, 0))}`}
            accent
          />
        </div>
        {pairs.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {pairs
              .slice()
              .reverse()
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-[13px]">
                    {fundName(p.fundCode)}
                    <span className="num ml-2 text-[11px] text-text-muted">
                      {p.sell.date} → {p.buy.date}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="num text-[11px] text-text-muted">
                      收益 {pct(p.netRate)}
                    </span>
                    <ChangeText
                      value={p.netProfit}
                      text={money(p.netProfit)}
                      className="text-[13px] font-medium"
                    />
                  </span>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function SummaryBox({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div
        className={`num mt-1 text-[19px] font-semibold ${accent ? 'text-up' : 'text-text'}`}
      >
        {value}
      </div>
      {hint && <div className="num mt-0.5 text-[11px] text-text-muted">{hint}</div>}
    </div>
  )
}
