import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Chart, axisStyle } from '../components/Chart'
import { Badge, Card, ChangeText, StatTile } from '../components/ui'
import { IconAlert, IconClock, IconSwap } from '../components/icons'
import { mockCostCumulative, mockIndexSeries } from '../data/mock'
import { money, pct, shortDate } from '../lib/format'
import { useStore } from '../lib/store'

export function Dashboard() {
  const { holdings, summary, pairs, costCurve, trades } = useStore()

  const indexOption = useMemo(() => {
    const series = mockIndexSeries(90)
    return (dark: 'light' | 'dark') => ({
      grid: { left: 44, right: 14, top: 16, bottom: 24 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
      xAxis: {
        type: 'category',
        data: series.map((s) => s.date.slice(5)),
        boundaryGap: false,
        ...axisStyle(dark),
        axisLabel: { ...axisStyle(dark).axisLabel, interval: 29 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        ...axisStyle(dark),
        axisLabel: { ...axisStyle(dark).axisLabel, formatter: (v: number) => v.toFixed(0) },
      },
      series: [
        {
          type: 'line',
          data: series.map((s) => s.value),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          areaStyle: {
            opacity: 0.14,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: dark ? '#5b8dff' : '#2f6df6' },
                { offset: 1, color: 'rgba(47,109,246,0)' },
              ],
            },
          },
        },
      ],
    })
  }, [])

  const costOption = useMemo(() => {
    const series = mockCostCumulative(90)
    return (dark: 'light' | 'dark') => ({
      grid: { left: 48, right: 14, top: 16, bottom: 24 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: series.map((s) => s.date.slice(5)),
        boundaryGap: false,
        ...axisStyle(dark),
        axisLabel: { ...axisStyle(dark).axisLabel, interval: 29 },
      },
      yAxis: {
        type: 'value',
        ...axisStyle(dark),
        axisLabel: { ...axisStyle(dark).axisLabel, formatter: (v: number) => `¥${v}` },
      },
      series: [
        {
          type: 'line',
          data: series.map((s) => s.value),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: dark ? '#e5a13a' : '#d98207' },
          areaStyle: { opacity: 0.12, color: dark ? '#e5a13a' : '#d98207' },
        },
      ],
    })
  }, [])

  const allocationOption = useMemo(
    () => (dark: 'light' | 'dark') => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c} 元 ({d}%)' },
      legend: {
        orient: 'vertical',
        right: 4,
        top: 'center',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: dark ? '#a9b5c9' : '#4a5567', fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '76%'],
          center: ['38%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
          label: { show: false },
          data: holdings.map((h) => ({
            name: h.fund.name.slice(0, 6),
            value: h.marketValue,
          })),
        },
      ],
    }),
    [holdings],
  )

  // 待做 T 提示：已卖出但尚未买回
  const pendingT = useMemo(() => {
    const sellCount = new Map<string, number>()
    for (const t of trades) {
      if (t.side !== 'sell') continue
      sellCount.set(t.fundCode, (sellCount.get(t.fundCode) ?? 0) + 1)
    }
    const pairedCount = new Map<string, number>()
    for (const p of pairs) {
      pairedCount.set(p.fundCode, (pairedCount.get(p.fundCode) ?? 0) + 1)
    }
    return holdings
      .map((h) => ({
        holding: h,
        unmatched:
          (sellCount.get(h.fund.code) ?? 0) - (pairedCount.get(h.fund.code) ?? 0),
      }))
      .filter((x) => x.unmatched > 0)
  }, [holdings, pairs, trades])

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      {/* ===== 组合总览 ===== */}
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight sm:text-[22px]">
              组合总览
            </h1>
            <p className="mt-0.5 text-xs text-text-muted">
              {summary.positionCount} 只持仓 · {summary.tCount} 次做 T
            </p>
          </div>
        </div>

        {/* 主卡：总资产 */}
        <div className="card mb-3 overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs text-text-muted">总市值</div>
              <div className="num mt-1 text-[30px] font-semibold leading-none tracking-tight sm:text-[36px]">
                {money(summary.marketValue)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">今日</span>
                <ChangeText
                  value={summary.dayProfit}
                  text={money(summary.dayProfit)}
                />
                <ChangeText
                  value={summary.dayProfitRate}
                  text={pct(summary.dayProfitRate)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid lg:gap-x-8">
              <MiniStat label="持仓成本" value={money(summary.costAmount)} />
              <MiniStat
                label="浮动盈亏"
                value={
                  <ChangeText
                    value={summary.profit}
                    text={money(summary.profit)}
                  />
                }
                sub={
                  <ChangeText
                    value={summary.profitRate}
                    text={pct(summary.profitRate)}
                    className="text-[11px]"
                  />
                }
              />
              <MiniStat
                label="隐性成本"
                value={<span className="text-warn">{money(summary.hiddenCost)}</span>}
                sub={`占投入 ${summary.hiddenCostRate.toFixed(2)}%`}
              />
              <MiniStat
                label="做 T 净收益"
                value={
                  <ChangeText
                    value={summary.tNetProfit}
                    text={money(summary.tNetProfit)}
                  />
                }
                sub={`${summary.tCount} 次`}
              />
            </div>
          </div>
        </div>

        {/* 移动端指标块 */}
        <div className="grid grid-cols-2 gap-3 lg:hidden">
          <StatTile label="持仓成本" value={money(summary.costAmount)} />
          <StatTile
            label="浮动盈亏"
            value={money(summary.profit)}
            tone={summary.profit >= 0 ? 'up' : 'down'}
            hint={
              <ChangeText value={summary.profitRate} text={pct(summary.profitRate)} />
            }
          />
          <StatTile
            label="隐性成本"
            value={money(summary.hiddenCost)}
            tone="warn"
            hint={`占投入 ${summary.hiddenCostRate.toFixed(2)}%`}
          />
          <StatTile
            label="做 T 净收益"
            value={money(summary.tNetProfit)}
            tone={summary.tNetProfit >= 0 ? 'up' : 'down'}
            hint={`${summary.tCount} 次`}
          />
        </div>
      </div>

      {/* ===== 待处理做 T 提示 ===== */}
      {pendingT.length > 0 && (
        <div className="card border-warn/30 bg-warn-soft/40 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn">
              <IconAlert width={15} height={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-text">
                有 {pendingT.length} 只基金处于「已卖出未买回」状态
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                做 T 的收益在买回后才真正落袋。下方列出了待买回的基金，注意赎回费档位对持有天数的影响。
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {pendingT.map(({ holding, unmatched }) => (
                  <Link
                    key={holding.fund.code}
                    to={`/fund/${holding.fund.code}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs transition-colors hover:border-border-strong"
                  >
                    <span className="font-medium">{holding.fund.name}</span>
                    <Badge tone="warn">待买回 {unmatched} 笔</Badge>
                    {holding.daysToNextTier !== null && (
                      <Badge tone="info">
                        {holding.daysToNextTier}天后费率降至{' '}
                        {(holding.nextRedeemTier?.rate ?? 0).toFixed(2)}%
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 图表区 ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="大盘走势"
          subtitle="沪深300 · 近 90 日"
          className="lg:col-span-2"
        >
          <Chart option={indexOption} height={240} />
        </Card>

        <Card title="持仓分布" subtitle="按市值占比">
          {holdings.length ? (
            <Chart option={allocationOption} height={240} />
          ) : (
            <p className="py-16 text-center text-xs text-text-muted">暂无持仓</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 隐性成本构成 */}
        <Card title="隐性成本构成" subtitle="累计已发生" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <CostBlock
              label="买入费用"
              value={summary.subscribeFeePaid}
              total={summary.hiddenCost}
              color="var(--accent)"
            />
            <CostBlock
              label="卖出费用"
              value={summary.redeemFeePaid}
              total={summary.hiddenCost}
              color="var(--info)"
            />
            <CostBlock
              label="持有费（按日计提）"
              value={summary.holdFeeAccrued}
              total={summary.hiddenCost}
              color="var(--warn)"
            />
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-muted">隐性成本累计曲线（近 90 日）</span>
              <span className="num font-medium text-text">
                {money(costCurve[costCurve.length - 1]?.value ?? 0)}
              </span>
            </div>
            <Chart option={costOption} height={170} />
          </div>
        </Card>

        {/* 费率档位提醒 */}
        <Card title="赎回费率档位" subtitle="按当前持有天数">
          <div className="space-y-2.5">
            {holdings
              .filter((h) => h.holdingDays < 365)
              .slice(0, 5)
              .map((h) => {
                const currentTier =
                  h.fee.redeemTiers.find(
                    (t) =>
                      h.holdingDays >= t.minDays &&
                      (t.maxDays === null || h.holdingDays <= t.maxDays),
                  ) ?? null
                return (
                  <Link
                    key={h.fund.code}
                    to={`/fund/${h.fund.code}`}
                    className="block rounded-lg border border-border p-2.5 transition-colors hover:bg-surface-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">
                        {h.fund.name}
                      </span>
                      <Badge tone={currentTier && currentTier.rate > 0 ? 'warn' : 'down'}>
                        {currentTier ? `${currentTier.rate.toFixed(2)}%` : '免赎回费'}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                      <IconClock width={12} height={12} />
                      已持有 {h.holdingDays} 天
                      {h.daysToNextTier !== null && h.nextRedeemTier && (
                        <>
                          <span className="text-text-muted">·</span>
                          <span>
                            {h.daysToNextTier} 天后降至{' '}
                            {h.nextRedeemTier.rate.toFixed(2)}%
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                )
              })}
            {!holdings.filter((h) => h.holdingDays < 365).length && (
              <p className="py-10 text-center text-xs text-text-muted">
                所有持仓均已过收费档期
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* ===== 持仓速览 ===== */}
      <Card
        title="持仓速览"
        subtitle="按市值排序"
        action={
          <Link
            to="/holdings"
            className="text-xs font-medium text-accent hover:underline"
          >
            全部持仓
          </Link>
        }
      >
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-text-muted">
                <th className="px-4 py-2 text-left font-medium sm:px-5">基金</th>
                <th className="px-3 py-2 text-right font-medium">持有份额</th>
                <th className="px-3 py-2 text-right font-medium">成本价</th>
                <th className="px-3 py-2 text-right font-medium">净值</th>
                <th className="px-3 py-2 text-right font-medium">浮动盈亏</th>
                <th className="px-3 py-2 text-right font-medium">隐性成本</th>
                <th className="px-4 py-2 text-right font-medium sm:px-5">市值</th>
              </tr>
            </thead>
            <tbody>
              {[...holdings]
                .sort((a, b) => b.marketValue - a.marketValue)
                .map((h) => (
                  <tr
                    key={h.fund.code}
                    className="border-b border-border last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-2.5 sm:px-5">
                      <Link
                        to={`/fund/${h.fund.code}`}
                        className="block max-w-[220px] truncate font-medium hover:text-accent"
                      >
                        {h.fund.name}
                      </Link>
                      <span className="num text-[11px] text-text-muted">
                        {h.fund.code} · {h.fund.category}
                      </span>
                    </td>
                    <td className="num px-3 py-2.5 text-right text-text-secondary">
                      {h.shares.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-text-secondary">
                      {h.costPrice.toFixed(4)}
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      {h.nav.toFixed(4)}
                      {h.estimateChange !== null && (
                        <div className="text-[11px]">
                          <ChangeText
                            value={h.estimateChange}
                            text={pct(h.estimateChange)}
                          />
                        </div>
                      )}
                    </td>
                    <td className="num px-3 py-2.5 text-right">
                      <ChangeText value={h.profit} text={money(h.profit)} />
                      <div className="text-[11px]">
                        <ChangeText
                          value={h.profitRate}
                          text={pct(h.profitRate)}
                        />
                      </div>
                    </td>
                    <td className="num px-3 py-2.5 text-right text-warn">
                      {money(h.hiddenCost)}
                      <div className="text-[11px] text-text-muted">
                        {h.hiddenCostRate.toFixed(2)}%
                      </div>
                    </td>
                    <td className="num px-3 py-2.5 text-right font-medium">
                      {money(h.marketValue)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== 最近做 T ===== */}
      <Card
        title="做 T 记录"
        subtitle="卖出 → 买回，自动配对核算净收益"
        action={
          <Link
            to="/transactions"
            className="text-xs font-medium text-accent hover:underline"
          >
            全部流水
          </Link>
        }
      >
        {pairs.length === 0 ? (
          <p className="py-10 text-center text-xs text-text-muted">
            暂无做 T 记录
          </p>
        ) : (
          <div className="space-y-2">
            {pairs
              .slice()
              .reverse()
              .slice(0, 4)
              .map((p) => {
                const h = holdings.find((x) => x.fund.code === p.fundCode)
                return (
                  <Link
                    key={p.id}
                    to={`/fund/${p.fundCode}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <IconSwap width={15} height={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">
                        {h?.fund.name ?? p.fundCode}
                      </div>
                      <div className="num text-[11px] text-text-muted">
                        {shortDate(p.sell.date)} 卖 {p.sell.nav.toFixed(4)} →{' '}
                        {shortDate(p.buy.date)} 买 {p.buy.nav.toFixed(4)} · 间隔{' '}
                        {p.daysBetween} 天
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <ChangeText
                        value={p.netProfit}
                        text={money(p.netProfit)}
                        className="text-[13px] font-medium"
                      />
                      <div className="num text-[11px] text-text-muted">
                        费用 {money(p.totalFee)}
                      </div>
                    </div>
                  </Link>
                )
              })}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ============================================================
   子组件
   ============================================================ */

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="num mt-0.5 text-[15px] font-semibold">{value}</div>
      {sub && <div className="num mt-0.5 text-[11px] text-text-muted">{sub}</div>}
    </div>
  )
}

function CostBlock({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const ratio = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] text-text-muted">{label}</span>
      </div>
      <div className="num mt-1.5 text-[18px] font-semibold">{money(value)}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, ratio)}%`, background: color }}
        />
      </div>
      <div className="num mt-1 text-[11px] text-text-muted">
        占隐性成本 {ratio.toFixed(1)}%
      </div>
    </div>
  )
}
