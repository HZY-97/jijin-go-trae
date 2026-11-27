import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Chart, axisStyle } from '../components/Chart'
import { Badge, Card, ChangeText } from '../components/ui'
import { money } from '../lib/format'
import { useStore } from '../lib/store'

export function CostAnalysis() {
  const { holdings, summary, pairs } = useStore()

  /** 成本 vs 收益对比：每个基金的隐性成本占其投入的比例 */
  const ratioOption = useMemo(() => {
    const list = [...holdings].sort((a, b) => b.hiddenCostRate - a.hiddenCostRate)
    return (dark: 'light' | 'dark') => ({
      grid: { left: 120, right: 40, top: 10, bottom: 24 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: { name: string; value: number }[]) =>
          `${params[0].name}<br/>隐性成本占比 ${params[0].value.toFixed(2)}%`,
      },
      xAxis: {
        type: 'value',
        ...axisStyle(dark),
        axisLabel: { ...axisStyle(dark).axisLabel, formatter: '{value}%' },
      },
      yAxis: {
        type: 'category',
        data: list.map((h) => h.fund.name.replace(/[（(].*$/, '').slice(0, 8)),
        ...axisStyle(dark),
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: list.map((h) => h.hiddenCostRate),
          barWidth: 14,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: dark ? '#e5a13a' : '#d98207',
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            color: dark ? '#a9b5c9' : '#4a5567',
            fontSize: 10,
          },
        },
      ],
    })
  }, [holdings])

  /** 成本构成饼图 */
  const breakdownOption = useMemo(
    () => (dark: 'light' | 'dark') => ({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: {
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: dark ? '#a9b5c9' : '#4a5567', fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['54%', '78%'],
          center: ['36%', '50%'],
          itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
          label: { show: false },
          data: [
            {
              name: '买入费用',
              value: summary.subscribeFeePaid,
              itemStyle: { color: dark ? '#5b8dff' : '#2f6df6' },
            },
            {
              name: '卖出费用',
              value: summary.redeemFeePaid,
              itemStyle: { color: dark ? '#35b6cf' : '#0f9bb5' },
            },
            {
              name: '持有费',
              value: summary.holdFeeAccrued,
              itemStyle: { color: dark ? '#e5a13a' : '#d98207' },
            },
          ],
        },
      ],
    }),
    [summary],
  )

  /** 每只基金的隐性成本绝对值 */
  const costBars = [...holdings].sort((a, b) => b.hiddenCost - a.hiddenCost)

  /** 组合加权年化持有成本率（%），按各基金市值加权 */
  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0)
  const annualHoldRate =
    totalValue > 0
      ? holdings.reduce(
          (s, h) => s + h.fee.dailyHoldRate * h.marketValue,
          0,
        ) / totalValue
      : 0
  /** 每天流失的比例（%）：年化率摊到 365 天 */
  const dailyHoldRate = annualHoldRate / 365
  const dailyHoldAmount = (totalValue * annualHoldRate) / 100 / 365

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight sm:text-[22px]">
          成本分析
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          把看不见的成本摊开：买入费、卖出费、每日计提的持有费
        </p>
      </div>

      {/* 总览 */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs text-text-muted">累计隐性成本</div>
            <div className="num mt-1 text-[30px] font-semibold leading-none tracking-tight text-warn sm:text-[34px]">
              {money(summary.hiddenCost)}
            </div>
            <div className="num mt-2 text-xs text-text-muted">
              占总投入 {summary.hiddenCostRate.toFixed(2)}%
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <Box
              label="买入费用"
              value={summary.subscribeFeePaid}
              hint="一次性"
              color="var(--accent)"
            />
            <Box
              label="卖出费用"
              value={summary.redeemFeePaid}
              hint="做 T 赎回产生"
              color="var(--info)"
            />
            <Box
              label="持有费"
              value={summary.holdFeeAccrued}
              hint="按日计提"
              color="var(--warn)"
            />
          </div>
        </div>

        {/* 关键洞察 */}
        <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-3">
          <Insight
            title="每天都在流失"
            value={`${money(dailyHoldAmount)} / 天`}
            desc={`组合加权年化持有成本 ${annualHoldRate.toFixed(2)}%，折合每日计提 ${dailyHoldRate.toFixed(4)}%，这是无法通过择时规避的固定损耗。`}
          />
          <Insight
            title="做 T 覆盖了多少次"
            value={`${summary.tCount} 次`}
            desc={`做 T 净收益 ${money(summary.tNetProfit)}，相当于抵消了 ${summary.hiddenCost > 0 ? Math.round((summary.tNetProfit / summary.hiddenCost) * 100) : 0}% 的隐性成本。`}
          />
          <Insight
            title="费率最高的基金"
            value={
              costBars[0]?.fund.name.replace(/[（(].*$/, '').slice(0, 10) ?? '—'
            }
            desc={
              costBars[0]
                ? `隐性成本占比 ${costBars[0].hiddenCostRate.toFixed(2)}%，是优先优化对象。`
                : '暂无数据'
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="成本构成" subtitle="按费用类型">
          <Chart option={breakdownOption} height={260} />
        </Card>
        <Card title="隐性成本占比" subtitle="各基金对比（占其投入比）">
          <Chart option={ratioOption} height={260} />
        </Card>
      </div>

      {/* 明细表 */}
      <Card title="成本明细" subtitle="按基金拆分">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-text-muted">
                <th className="px-4 py-2.5 text-left font-medium sm:px-5">基金</th>
                <th className="px-3 py-2.5 text-right font-medium">买入费</th>
                <th className="px-3 py-2.5 text-right font-medium">卖出费</th>
                <th className="px-3 py-2.5 text-right font-medium">持有费</th>
                <th className="px-3 py-2.5 text-right font-medium">合计</th>
                <th className="px-3 py-2.5 text-right font-medium">占投入比</th>
                <th className="px-4 py-2.5 text-right font-medium sm:px-5">做 T 净收益</th>
              </tr>
            </thead>
            <tbody>
              {costBars.map((h) => (
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
                      {h.fund.code}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 text-right text-text-secondary">
                    {money(h.subscribeFeePaid)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-text-secondary">
                    {money(h.redeemFeePaid)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-text-secondary">
                    {money(h.holdFeeAccrued)}
                  </td>
                  <td className="num px-3 py-2.5 text-right font-medium text-warn">
                    {money(h.hiddenCost)}
                  </td>
                  <td className="num px-3 py-2.5 text-right">
                    <span
                      className={
                        h.hiddenCostRate > 1 ? 'text-warn font-medium' : 'text-text-secondary'
                      }
                    >
                      {h.hiddenCostRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 text-right sm:px-5">
                    {h.tCount > 0 ? (
                      <ChangeText
                        value={h.tNetProfit}
                        text={money(h.tNetProfit)}
                      />
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-2 text-[13px] font-medium">
                <td className="px-4 py-2.5 sm:px-5">合计</td>
                <td className="num px-3 py-2.5 text-right">
                  {money(summary.subscribeFeePaid)}
                </td>
                <td className="num px-3 py-2.5 text-right">
                  {money(summary.redeemFeePaid)}
                </td>
                <td className="num px-3 py-2.5 text-right">
                  {money(summary.holdFeeAccrued)}
                </td>
                <td className="num px-3 py-2.5 text-right text-warn">
                  {money(summary.hiddenCost)}
                </td>
                <td className="num px-3 py-2.5 text-right">
                  {summary.hiddenCostRate.toFixed(2)}%
                </td>
                <td className="num px-3 py-2.5 text-right sm:px-5">
                  <ChangeText
                    value={summary.tNetProfit}
                    text={money(summary.tNetProfit)}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* 做 T 收益 vs 隐性成本 */}
      <Card
        title="做 T 收益 vs 隐性成本"
        subtitle="做 T 赚的，能不能覆盖掉手续费"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-text-muted">做 T 净收益</div>
            <div className="num mt-1 text-[22px] font-semibold text-up">
              {money(summary.tNetProfit)}
            </div>
            <div className="num mt-1 text-[11px] text-text-muted">
              {pairs.length} 次配对，胜率{' '}
              {pairs.length
                ? Math.round(
                    (pairs.filter((p) => p.netProfit > 0).length / pairs.length) * 100,
                  )
                : 0}
              %
            </div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-text-muted">隐性成本</div>
            <div className="num mt-1 text-[22px] font-semibold text-warn">
              {money(summary.hiddenCost)}
            </div>
            <div className="num mt-1 text-[11px] text-text-muted">
              买入 {money(summary.subscribeFeePaid)} · 卖出{' '}
              {money(summary.redeemFeePaid)} · 持有 {money(summary.holdFeeAccrued)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
          <span className="text-[13px] text-text-secondary">净额</span>
          <span className="flex items-center gap-2">
            <ChangeText
              value={summary.tNetProfit - summary.hiddenCost}
              text={money(summary.tNetProfit - summary.hiddenCost)}
              className="text-[15px] font-semibold"
            />
            <Badge tone="neutral">
              {summary.tNetProfit >= summary.hiddenCost
                ? '做 T 已覆盖隐性成本'
                : '尚未覆盖隐性成本'}
            </Badge>
          </span>
        </div>
      </Card>
    </div>
  )
}

function Box({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: number
  hint: string
  color: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[11px] text-text-muted">{label}</span>
      </div>
      <div className="num mt-1 text-[17px] font-semibold">{money(value)}</div>
      <div className="text-[11px] text-text-muted">{hint}</div>
    </div>
  )
}

function Insight({
  title,
  value,
  desc,
}: {
  title: string
  value: string
  desc: string
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] text-text-muted">{title}</div>
      <div className="num mt-0.5 truncate text-[14px] font-semibold">{value}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{desc}</p>
    </div>
  )
}
