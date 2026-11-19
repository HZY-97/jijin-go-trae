import { useEffect, useMemo, useState } from 'react'
import { Badge, Button } from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import { MOCK_FEES, MOCK_FUNDS, MOCK_NAV } from '../data/mock'
import type { RedeemTier } from '../types'

/**
 * 添加 / 编辑基金的费率配置表单。
 * 这是整个应用的核心输入：隐性成本核算完全依赖这里填写的费率。
 */

interface FormState {
  code: string
  name: string
  category: string
  company: string
  subscribeRate: string
  dailyHoldRate: string
  minSubscribe: string
  redeemTiers: RedeemTier[]
}

function emptyForm(): FormState {
  return {
    code: '',
    name: '',
    category: '混合型',
    company: '',
    subscribeRate: '0.15',
    dailyHoldRate: '1.2',
    minSubscribe: '10',
    redeemTiers: [
      { minDays: 0, maxDays: 6, rate: 1.5 },
      { minDays: 7, maxDays: 29, rate: 0.75 },
      { minDays: 30, maxDays: null, rate: 0 },
    ],
  }
}

export function FundFormModal({
  open,
  onClose,
  editingCode,
}: {
  open: boolean
  onClose: () => void
  editingCode?: string
}) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    if (editingCode) {
      const fund = MOCK_FUNDS.find((f) => f.code === editingCode)
      const fee = MOCK_FEES[editingCode]
      if (fund && fee) {
        setForm({
          code: fund.code,
          name: fund.name,
          category: fund.category,
          company: fund.company,
          subscribeRate: String(fee.subscribeRate),
          dailyHoldRate: String(fee.dailyHoldRate),
          minSubscribe: String(fee.minSubscribe),
          redeemTiers: fee.redeemTiers.map((t) => ({ ...t })),
        })
        return
      }
    }
    setForm(emptyForm())
    setSearch('')
  }, [open, editingCode])

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return MOCK_FUNDS.filter(
      (f) =>
        f.code.includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.company.toLowerCase().includes(q),
    ).slice(0, 6)
  }, [search])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const setTier = (i: number, patch: Partial<RedeemTier>) =>
    setForm((f) => ({
      ...f,
      redeemTiers: f.redeemTiers.map((t, idx) =>
        idx === i ? { ...t, ...patch } : t,
      ),
    }))

  const addTier = () =>
    setForm((f) => {
      const last = f.redeemTiers[f.redeemTiers.length - 1]
      const start = (last?.maxDays ?? last?.minDays ?? 0) + 1
      return {
        ...f,
        redeemTiers: [
          ...f.redeemTiers,
          { minDays: start, maxDays: null, rate: 0 },
        ],
      }
    })

  const removeTier = (i: number) =>
    setForm((f) => ({
      ...f,
      redeemTiers: f.redeemTiers.filter((_, idx) => idx !== i),
    }))

  // 预估年化隐性成本（按 10 万元持有一年估算，帮助用户理解费率影响）
  const preview = useMemo(() => {
    const sub = Number(form.subscribeRate) || 0
    const hold = Number(form.dailyHoldRate) || 0
    const principal = 100000
    const buy = (principal * sub) / 100
    const yearly = (principal * hold) / 100
    return { buy, yearly, total: buy + yearly }
  }, [form.subscribeRate, form.dailyHoldRate])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop sm:rounded-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">
              {editingCode ? '编辑基金费率' : '添加基金'}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              费率决定隐性成本核算，请按基金合同填写
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

        {/* 内容 */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* 基金选择 */}
          <section className="space-y-2.5">
            <Label>基金代码 / 名称</Label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="输入代码或名称搜索，如 161725 / 白酒"
              className="h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-[13px] outline-none placeholder:text-text-muted focus:border-accent"
            />
            {results.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border">
                {results.map((f) => (
                  <button
                    key={f.code}
                    onClick={() => {
                      set('code', f.code)
                      set('name', f.name)
                      set('category', f.category)
                      set('company', f.company)
                      setSearch('')
                    }}
                    className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface-2"
                  >
                    <span className="text-[13px] font-medium">{f.name}</span>
                    <span className="num text-[11px] text-text-muted">
                      {f.code} · {f.company}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {form.code && (
              <div className="rounded-lg border border-accent-border bg-accent-soft px-3 py-2">
                <div className="text-[13px] font-medium text-accent">{form.name}</div>
                <div className="num mt-0.5 text-[11px] text-text-secondary">
                  {form.code} · {form.category} · {form.company} · 最新净值{' '}
                  {MOCK_NAV[form.code]?.nav.toFixed(4) ?? '—'}
                </div>
              </div>
            )}
          </section>

          <div className="h-px bg-border" />

          {/* 费率配置 */}
          <section className="space-y-3">
            <SectionTitle text="费率配置" />
            <p className="-mt-1 text-xs leading-relaxed text-text-muted">
              这三项决定了你在整个持有周期里真正付出的成本。
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="买入（申购）费率"
                suffix="%"
                value={form.subscribeRate}
                onChange={(v) => set('subscribeRate', v)}
                hint="已含平台折扣"
              />
              <Field
                label="每日持有成本"
                suffix="%/年"
                value={form.dailyHoldRate}
                onChange={(v) => set('dailyHoldRate', v)}
                hint="管理费+托管费+销售服务费"
              />
              <Field
                label="最低申购金额"
                suffix="元"
                value={form.minSubscribe}
                onChange={(v) => set('minSubscribe', v)}
              />
            </div>
          </section>

          {/* 赎回费阶梯 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label>卖出（赎回）费率阶梯</Label>
              <Button size="sm" variant="ghost" onClick={addTier}>
                <IconPlus width={13} height={13} />
                添加档位
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-text-muted">
              按持有天数分档。持有天数越长，通常赎回费越低 —— 这也是做 T 择时的依据。
            </p>

            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 border-b border-border bg-surface-2 px-3 py-2 text-[11px] text-text-muted">
                <span>持有天数起</span>
                <span>持有天数止</span>
                <span>赎回费率 %</span>
                <span />
              </div>
              {form.redeemTiers.map((t, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-b border-border px-3 py-2 last:border-0"
                >
                  <input
                    type="number"
                    value={t.minDays}
                    onChange={(e) =>
                      setTier(i, { minDays: Number(e.target.value) })
                    }
                    className="num h-8 w-full rounded-md border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    value={t.maxDays ?? ''}
                    placeholder="不限"
                    onChange={(e) =>
                      setTier(i, {
                        maxDays: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="num h-8 w-full rounded-md border border-border bg-surface px-2 text-[13px] outline-none placeholder:text-text-muted focus:border-accent"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={t.rate}
                    onChange={(e) => setTier(i, { rate: Number(e.target.value) })}
                    className="num h-8 w-full rounded-md border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => removeTier(i)}
                    aria-label="删除档位"
                    disabled={form.redeemTiers.length <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-up-soft hover:text-up disabled:opacity-30"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 成本预估 */}
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="text-xs font-semibold text-text">
              持有 10 万元一年的隐性成本预估
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Preview label="买入费（一次性）" value={preview.buy} />
              <Preview label="持有费（一年）" value={preview.yearly} />
              <Preview label="合计" value={preview.total} accent />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
              持有费按日计提，这里按 365 天估算；赎回费未计入，因为取决于你何时卖出。
            </p>
          </section>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          <Badge tone="accent">本地保存 · 单用户</Badge>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button variant="primary" onClick={onClose} disabled={!form.code}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   表单原子组件
   ============================================================ */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[13px] font-medium text-text">{children}</span>
  )
}

function SectionTitle({ text }: { text: string }) {
  return (
    <h3 className="text-[13px] font-semibold tracking-wide text-text-muted uppercase">
      {text}
    </h3>
  )
}

function Field({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-text-secondary">{label}</span>
      <div className="mt-1 flex h-9 items-center rounded-lg border border-border bg-surface px-2.5 focus-within:border-accent">
        <input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="num w-full bg-transparent text-[13px] outline-none"
        />
        {suffix && (
          <span className="ml-1 shrink-0 text-[11px] text-text-muted">{suffix}</span>
        )}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-text-muted">{hint}</span>}
    </label>
  )
}

function Preview({
  label,
  value,
  accent,
}: {
  label: string
  value: number
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
        ¥{value.toLocaleString('zh-CN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  )
}
