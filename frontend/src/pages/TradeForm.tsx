import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui'
import { daysBetween, matchRedeemTier, today } from '../lib/calc'
import * as api from '../lib/api'
import { useStore } from '../lib/store'
import type { Trade } from '../types'

/**
 * 记一笔 / 编辑流水的表单。
 * 金额与费率可以自动推导（份额 × 净值、按费率档案匹配赎回档位），
 * 后端也会在缺省时用同样的规则补全。
 */

interface FormState {
  fundCode: string
  date: string
  side: 'buy' | 'sell'
  shares: string
  nav: string
  amount: string
  feeRate: string
  note: string
}

function emptyForm(fundCode = ''): FormState {
  return {
    fundCode,
    date: today(),
    side: 'buy',
    shares: '',
    nav: '',
    amount: '',
    feeRate: '',
    note: '',
  }
}

export function TradeFormModal({
  open,
  onClose,
  editingTrade,
}: {
  open: boolean
  onClose: () => void
  editingTrade?: Trade | null
}) {
  const { funds, trades, refresh, source } = useStore()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [amountTouched, setAmountTouched] = useState(false)
  const [feeTouched, setFeeTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 只在打开弹窗时初始化表单，后台刷新 store 不应该清掉用户正在填的内容
  const fundsRef = useRef(funds)
  useEffect(() => {
    fundsRef.current = funds
  }, [funds])

  useEffect(() => {
    if (!open) return
    if (editingTrade) {
      setForm({
        fundCode: editingTrade.fundCode,
        date: editingTrade.date,
        side: editingTrade.side,
        shares: String(editingTrade.shares),
        nav: String(editingTrade.nav),
        amount: String(editingTrade.amount),
        feeRate: String(editingTrade.feeRate),
        note: editingTrade.note ?? '',
      })
      setAmountTouched(true)
      setFeeTouched(true)
    } else {
      setForm(emptyForm(fundsRef.current[0]?.fund.code ?? ''))
      setAmountTouched(false)
      setFeeTouched(false)
    }
    setError(null)
  }, [open, editingTrade])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const record = funds.find((f) => f.fund.code === form.fundCode)

  /** 按费率档案推算的费率：买入取申购费率，卖出按持有天数匹配赎回档位 */
  const autoFeeRate = useMemo(() => {
    if (!record) return 0
    if (form.side === 'buy') return record.fee.subscribeRate
    const firstBuy = trades
      .filter((t) => t.fundCode === form.fundCode && t.side === 'buy')
      .map((t) => t.date)
      .sort()[0]
    const days = firstBuy ? Math.max(0, daysBetween(firstBuy, form.date)) : 0
    return matchRedeemTier(record.fee.redeemTiers, days)?.rate ?? 0
  }, [record, form.side, form.fundCode, form.date, trades])

  const shares = Number(form.shares) || 0
  const nav = Number(form.nav) || 0
  const autoAmount = Math.round(shares * nav * 100) / 100
  const amount = amountTouched ? Number(form.amount) || 0 : autoAmount
  const feeRate = feeTouched ? Number(form.feeRate) || 0 : autoFeeRate
  const fee = Math.round(amount * (feeRate / 100) * 100) / 100

  const canSubmit =
    form.fundCode !== '' &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.date) &&
    shares > 0 &&
    nav >= 0 &&
    !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const payload: api.TradePayload = {
      fundCode: form.fundCode,
      date: form.date,
      side: form.side,
      shares,
      nav,
      amount,
      feeRate,
    }
    if (form.note.trim()) payload.note = form.note.trim()
    try {
      if (editingTrade) await api.updateTrade(editingTrade.id, payload)
      else await api.createTrade(payload)
      await refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">
              {editingTrade ? '编辑流水' : '记一笔'}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              金额与费率会自动推导，也可手工覆盖
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* 基金 */}
          <label className="block">
            <span className="text-[12px] font-medium text-text-secondary">基金</span>
            <select
              value={form.fundCode}
              onChange={(e) => {
                set('fundCode', e.target.value)
                setAmountTouched(false)
                setFeeTouched(false)
              }}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] outline-none focus:border-accent"
            >
              <option value="">请选择基金</option>
              {funds.map((f) => (
                <option key={f.fund.code} value={f.fund.code}>
                  {f.fund.name}（{f.fund.code}）
                </option>
              ))}
            </select>
            {funds.length === 0 && (
              <span className="mt-1 block text-[11px] text-text-muted">
                还没有基金，请先到「设置 → 添加基金」创建
              </span>
            )}
          </label>

          {/* 方向 */}
          <div>
            <span className="text-[12px] font-medium text-text-secondary">方向</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(
                [
                  ['buy', '买入 / 申购'],
                  ['sell', '卖出 / 赎回'],
                ] as ['buy' | 'sell', string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    set('side', v)
                    setFeeTouched(false)
                  }}
                  className={`h-9 rounded-lg border text-[13px] font-medium transition-colors ${
                    form.side === v
                      ? v === 'buy'
                        ? 'border-up/40 bg-up-soft text-up'
                        : 'border-down/40 bg-down-soft text-down'
                      : 'border-border bg-surface text-text-secondary hover:bg-surface-2'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-medium text-text-secondary">日期</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="num mt-1 h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-text-secondary">份额</span>
              <input
                type="number"
                step="0.01"
                value={form.shares}
                onChange={(e) => {
                  set('shares', e.target.value)
                  setAmountTouched(false)
                }}
                placeholder="1000"
                className="num mt-1 h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] outline-none placeholder:text-text-muted focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-text-secondary">
                成交净值
              </span>
              <input
                type="number"
                step="0.0001"
                value={form.nav}
                onChange={(e) => {
                  set('nav', e.target.value)
                  setAmountTouched(false)
                }}
                placeholder="1.2345"
                className="num mt-1 h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] outline-none placeholder:text-text-muted focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-text-secondary">金额</span>
              <div className="mt-1 flex h-9 items-center rounded-lg border border-border bg-surface-2 px-2.5 focus-within:border-accent">
                <input
                  type="number"
                  step="0.01"
                  value={form.amount || (autoAmount || '')}
                  onChange={(e) => {
                    setAmountTouched(true)
                    set('amount', e.target.value)
                  }}
                  className="num w-full bg-transparent text-[13px] outline-none"
                />
                <span className="ml-1 shrink-0 text-[11px] text-text-muted">元</span>
              </div>
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-text-secondary">费率</span>
              <div className="mt-1 flex h-9 items-center rounded-lg border border-border bg-surface-2 px-2.5 focus-within:border-accent">
                <input
                  type="number"
                  step="0.01"
                  value={form.feeRate || (autoFeeRate || '')}
                  onChange={(e) => {
                    setFeeTouched(true)
                    set('feeRate', e.target.value)
                  }}
                  className="num w-full bg-transparent text-[13px] outline-none"
                />
                <span className="ml-1 shrink-0 text-[11px] text-text-muted">%</span>
              </div>
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-text-secondary">
                备注（可选）
              </span>
              <input
                type="text"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="做T卖出"
                className="mt-1 h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] outline-none placeholder:text-text-muted focus:border-accent"
              />
            </label>
          </div>

          {/* 汇总 */}
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="text-xs font-semibold text-text">本笔测算</div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Box label="成交金额" value={`¥${amount.toFixed(2)}`} />
              <Box label="费率" value={`${feeRate.toFixed(2)}%`} />
              <Box label="费用" value={`¥${fee.toFixed(2)}`} accent />
            </div>
            {!feeTouched && (
              <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
                费率按当前费率档案自动匹配
                {form.side === 'sell' ? '（按最早买入日计算持有天数）' : ''}
                ，留空即用自动值。
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-up/30 bg-up-soft px-3 py-2 text-[12px] text-up">
              {error}
            </div>
          )}
          {source === 'mock' && (
            <div className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn">
              后端未连接，当前无法保存。启动后端服务后再试。
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {submitting ? '保存中…' : editingTrade ? '保存修改' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Box({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="text-[11px] text-text-muted">{label}</div>
      <div
        className={`num mt-0.5 text-[15px] font-semibold ${
          accent ? 'text-warn' : 'text-text'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
