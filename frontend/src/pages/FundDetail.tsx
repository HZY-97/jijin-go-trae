import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Chart, axisStyle } from '../components/Chart'
import { Badge, Button, Card, ChangeText, StatTile } from '../components/ui'
import { IconAlert, IconArrowLeft, IconClock, IconSwap } from '../components/icons'
import { money, pct, shortDate } from '../lib/format'
import { useFundDetail } from '../lib/store'
import * as api from '../lib/api'
import type { NavPoint } from '../types'
import { FundFormModal } from './FundForm'

type Range = '30' | '90' | '180' | 'all'

export function FundDetail() {
  const { code = '' } = useParams()
  const { holding, fundTrades, fundPairs } = useFundDetail(code)
  const [range, setRange] = useState<Range>('180')
  const [editOpen, setEditOpen] = useState(false)
  const [series, setSeries] = useState<NavPoint[]>([])
  const [navLoading, setNavLoading] = useState(false)
  const [navError, setNavError] = useState<string | null>(null)

  // 真实净值曲线：来自天天基金历史净值
  useEffect(() => {
    if (!code) return
    let cancelled = false
    setNavLoading(true)
    setNavError(null)
    api
      .getNavHistory(code, range)
      .then((res) => {
        if (!cancelled) setSeries(res.points)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSeries([])
        setNavError(err instanceof Error ? err.message : '净值历史获取失败')
      })
      .finally(() => {
        if (!cancelled) setNavLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code, range])

  const navOption = useMemo(() => {
    const data = series
    return (dark: 'light' | 'dark') => ({
      grid: { left: 48, right: 14, top: 16, bottom: 24 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((s) => s.date.slice(5)),
        boundaryGap: false,
        ...axisStyle(dark),
        axisLabel: { ...axisStyle(dark).axisLabel, interval: Math.floor(data.length / 6) },
      },
      yAxis: {
        type: 'value',
        scale: true,
        ...axisStyle(dark),
        axisLabel: { ...axisStyle(dark).axisLabel, formatter: (v: number) => v.toFixed(3) },
      },
      series: [
        {
          name: '单位净值',
          type: 'line',
          data: data.map((s) => s.nav),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
        },
        {
          name: '累计净值',
          type: 'line',
          data: data.map((s) => s.accNav),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1.5, type: 'dashed' },
          itemStyle: { color: dark ? '#35b6cf' : '#0f9bb5' },
        },
        {
          name: '持仓成本价',
          type: 'line',
          data: data.map(() => holding?.costPrice ?? 0),
          showSymbol: false,
          lineStyle: { width: 1.5, type: 'dotted' },
          itemStyle: { color: dark ? '#e5a13a' : '#d98207' },
          markLine: undefined,
        },
      ],
    })
  }, [series, range, holding])

  if (!holding) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-text-muted">未找到该基金</p>
        <Link to="/holdings" className="mt-3 inline-block text-sm text-accent">
          返回持仓
        </Link>
      </div>
    )
  }

  const h = holding
  const unmatchedSells = fundTrades.filter(
    (t) => t.side === 'sell' && !fundPairs.some((p) => p.sell.id === t.id),
  )

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* 头部 */}
      <div className="card overflow-hidden">
        <div className="border-b border-border p-4 sm:p-5">
          <Link
            to="/holdings"
            className="mb-2 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            <IconArrowLeft width={13} height={13} />
            返回持仓
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[19px] font-semibold tracking-tight sm:text-[21px]">
                {h.fund.name}
              </h1>
              <div className="num mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                <span>{h.fund.code}</span>
                <span>·</span>
                <span>{h.fund.category}</span>
                <span>·</span>
                <span>{h.fund.company}</span>
              </div>
            </div>
            <Button size="sm" variant="default" onClick={() => setEditOpen(true)}>
              编辑费率
            </Button>
          </div>
        </div>

        {/* 关键指标 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-4 sm:p-5">
          <Metric
            label="最新净值"
            value={h.nav.toFixed(4)}
            sub={`${h.navDate}`}
          />
          <Metric
            label="净值日涨跌"
            value={
              h.dayChangePct !== undefined ? pct(h.dayChangePct) : '—'
            }
            sub={
              h.estimateNav !== null ? (
                <ChangeText
                  value={h.estimateChange ?? 0}
                  text={pct(h.estimateChange ?? 0)}
                />
              ) : (
                '已公布净值日涨跌幅'
              )
            }
            tone={h.dayChangePct ?? 0}
          />
          <Metric
            label="持仓成本价"
            value={h.costPrice.toFixed(4)}
            sub={`原始 ${h.rawCostPrice.toFixed(4)}`}
          />
          <Metric
            label="浮动盈亏"
            value={money(h.profit)}
            sub={
              <ChangeText value={h.profitRate} text={pct(h.profitRate)} />
            }
            tone={h.profit}
          />
        </div>
      </div>

      {/* 警示条 */}
      {unmatchedSells.length > 0 && (
        <div className="card border-warn/30 bg-warn-soft/40 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn">
              <IconAlert width={15} height={15} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">
                有 {unmatchedSells.length} 笔卖出尚未买回
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                做 T 的价差收益需要买回才能落袋。在买回前，这部分份额处于空仓状态，
                后续净值下跌你将错失收益。
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unmatchedSells.map((t) => (
                  <span
                    key={t.id}
                    className="num rounded-md border border-border bg-surface px-2 py-1 text-[11px]"
                  >
                    {t.date} 卖出 {t.shares.toLocaleString('zh-CN')} 份 @{' '}
                    {t.nav.toFixed(4)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 指标卡 */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <StatTile label="持有份额" value={h.shares.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} />
        <StatTile label="市值" value={money(h.marketValue)} />
        <StatTile label="隐性成本" value={money(h.hiddenCost)} tone="warn" hint={`占投入 ${h.hiddenCostRate.toFixed(2)}%`} />
        <StatTile label="做 T 净收益" value={money(h.tNetProfit)} tone={h.tNetProfit >= 0 ? 'up' : 'down'} hint={`${h.tCount} 次`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 净值走势 */}
        <Card
          title="净值走势"
          subtitle={`${h.fund.name} · 单位净值与累计净值`}
          className="lg:col-span-2"
          action={
            <div className="flex rounded-lg border border-border p-0.5">
              {(['30', '90', '180', 'all'] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    range === r
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {r === 'all' ? '全部' : `${r}日`}
                </button>
              ))}
            </div>
          }
        >
          {navError ? (
            <p className="py-16 text-center text-xs text-warn">
              净值历史获取失败：{navError}
            </p>
          ) : navLoading && series.length === 0 ? (
            <p className="py-16 text-center text-xs text-text-muted">
              正在加载净值曲线…
            </p>
          ) : series.length === 0 ? (
            <p className="py-16 text-center text-xs text-text-muted">
              暂无净值数据
            </p>
          ) : (
            <Chart option={navOption} height={280} />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-accent" />
              单位净值
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-t border-dashed border-info" />
              累计净值
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded border-t border-dotted border-warn" />
              持仓成本价
            </span>
          </div>
        </Card>

        {/* 费率与成本 */}
        <Card title="费率与成本" subtitle="当前生效配置">
          <div className="space-y-2.5">
            <Row label="买入费率" value={`${h.fee.subscribeRate.toFixed(2)}%`} />
            <Row
              label="每日持有成本"
              value={`${h.fee.dailyHoldRate.toFixed(2)}% / 年`}
            />
            <div>
              <div className="text-[11px] text-text-muted">赎回费率阶梯</div>
              <div className="mt-1.5 space-y-1">
                {h.fee.redeemTiers.map((t, i) => {
                  const active =
                    h.holdingDays >= t.minDays &&
                    (t.maxDays === null || h.holdingDays <= t.maxDays)
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-md px-2 py-1 text-[12px] ${
                        active
                          ? 'bg-warn-soft text-warn'
                          : 'bg-surface-2 text-text-secondary'
                      }`}
                    >
                      <span className="num">
                        {t.minDays} – {t.maxDays ?? '不限'} 天
                      </span>
                      <span className="num font-medium">
                        {t.rate.toFixed(2)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="h-px bg-border" />

            <Row label="累计买入费" value={money(h.subscribeFeePaid)} tone="warn" />
            <Row label="累计卖出费" value={money(h.redeemFeePaid)} tone="warn" />
            <Row label="累计持有费" value={money(h.holdFeeAccrued)} tone="warn" />
            <Row label="隐性成本合计" value={money(h.hiddenCost)} tone="warn" strong />

            <div className="rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-text-muted">
              <IconClock width={12} height={12} className="mr-1 inline" />
              已持有 {h.holdingDays} 天
              {h.daysToNextTier !== null && h.nextRedeemTier && (
                <>
                  ，再持有 {h.daysToNextTier} 天赎回费降至{' '}
                  {h.nextRedeemTier.rate.toFixed(2)}%
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* 做 T 记录 */}
      <Card
        title="做 T 记录"
        subtitle={`本基金已完成 ${fundPairs.length} 次做 T，净收益 ${money(h.tNetProfit)}`}
      >
        {fundPairs.length === 0 ? (
          <p className="py-10 text-center text-xs text-text-muted">
            暂无做 T 记录。卖出后 10 日内买入会自动配对。
          </p>
        ) : (
          <div className="space-y-2">
            {fundPairs
              .slice()
              .reverse()
              .map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                          <IconSwap width={14} height={14} />
                        </span>
                        <span className="text-[13px] font-medium">
                          {shortDate(p.sell.date)} → {shortDate(p.buy.date)}
                        </span>
                        <Badge tone="neutral">间隔 {p.daysBetween} 天</Badge>
                      </div>
                      <div className="num mt-1.5 text-[11px] text-text-muted">
                        卖 {p.sell.nav.toFixed(4)} × {p.sell.shares.toLocaleString('zh-CN')} 份 · 费{' '}
                        {money(p.sell.fee)} → 买 {p.buy.nav.toFixed(4)} ×{' '}
                        {p.buy.shares.toLocaleString('zh-CN')} 份 · 费 {money(p.buy.fee)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <ChangeText
                        value={p.netProfit}
                        text={money(p.netProfit)}
                        className="text-[15px] font-semibold"
                      />
                      <div className="num text-[11px] text-text-muted">
                        价差 {money(p.spreadProfit)} · 费用 {money(p.totalFee)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* 交易流水 */}
      <Card title="交易流水" subtitle={`共 ${fundTrades.length} 笔`}>
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-text-muted">
                <th className="px-4 py-2 text-left font-medium sm:px-5">日期</th>
                <th className="px-3 py-2 text-left font-medium">方向</th>
                <th className="px-3 py-2 text-right font-medium">份额</th>
                <th className="px-3 py-2 text-right font-medium">净值</th>
                <th className="px-3 py-2 text-right font-medium">金额</th>
                <th className="px-3 py-2 text-right font-medium">费用</th>
                <th className="px-4 py-2 text-left font-medium sm:px-5">备注</th>
              </tr>
            </thead>
            <tbody>
              {fundTrades
                .slice()
                .reverse()
                .map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="num px-4 py-2.5 text-text-secondary sm:px-5">
                      {t.date}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={t.side === 'buy' ? 'up' : 'down'}>
                        {t.side === 'buy' ? '买入' : '卖出'}
                      </Badge>
                    </td>
                    <td className="num px-3 py-2.5 text-right text-text-secondary">
                      {t.shares.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="num px-3 py-2.5 text-right">{t.nav.toFixed(4)}</td>
                    <td className="num px-3 py-2.5 text-right">
                      {money(t.amount)}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-warn">
                      {money(t.fee)}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted sm:px-5">
                      {t.note ?? '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <FundFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editingCode={code}
      />
    </div>
  )
}

/* ============================================================
   子组件
   ============================================================ */

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  tone?: number
}) {
  const color =
    tone === undefined || tone === 0
      ? 'text-text'
      : tone > 0
        ? 'text-up'
        : 'text-down'
  return (
    <div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className={`num mt-1 text-[19px] font-semibold ${color}`}>{value}</div>
      {sub && (
        <div className="num mt-0.5 text-[11px] text-text-muted">{sub}</div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: string
  tone?: 'warn'
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className={strong ? 'font-medium' : 'text-text-secondary'}>
        {label}
      </span>
      <span
        className={`num ${
          strong ? 'font-semibold' : 'font-medium'
        } ${tone === 'warn' ? 'text-warn' : 'text-text'}`}
      >
        {value}
      </span>
    </div>
  )
}
