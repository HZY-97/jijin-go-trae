import { useState } from 'react'
import { Badge, Button, Card } from '../components/ui'
import { IconMonitor, IconMoon, IconSun } from '../components/icons'
import { useTheme, type ThemeMode } from '../lib/theme'
import { useStore } from '../lib/store'

export function Settings() {
  const { mode, setMode } = useTheme()
  const { summary, holdings, trades } = useStore()
  const [pairDays, setPairDays] = useState(10)
  const [autoFetch, setAutoFetch] = useState(true)
  const [freq, setFreq] = useState(30)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight sm:text-[22px]">
          设置
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          单用户本地使用 · 数据保存在本机
        </p>
      </div>

      {/* 外观 */}
      <Card title="外观" subtitle="默认跟随系统，可手动覆盖">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['light', '浅色', IconSun],
              ['dark', '深色', IconMoon],
              ['system', '跟随系统', IconMonitor],
            ] as [ThemeMode, string, typeof IconSun][]
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                mode === value
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-text-secondary hover:bg-surface-2'
              }`}
            >
              <Icon width={18} height={18} />
              <span className="text-[12px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* 数据刷新 */}
      <Card title="数据刷新" subtitle="实时估值与净值更新频率">
        <div className="space-y-4">
          <ToggleRow
            label="自动刷新实时估值"
            desc="交易时段内自动轮询基金估值与大盘指数"
            checked={autoFetch}
            onChange={setAutoFetch}
          />
          <div className="h-px bg-border" />
          <div>
            <div className="text-[13px] font-medium">刷新间隔</div>
            <div className="mt-2 flex gap-2">
              {[15, 30, 60, 120].map((s) => (
                <button
                  key={s}
                  onClick={() => setFreq(s)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    freq === s
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-text-secondary hover:bg-surface-2'
                  }`}
                >
                  {s} 秒
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 做 T 规则 */}
      <Card title="做 T 规则" subtitle="自动配对卖出与买回">
        <div className="space-y-4">
          <div>
            <div className="text-[13px] font-medium">配对时间窗口</div>
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
              卖出后在此天数内买入同一只基金，自动识别为一次做 T。
            </p>
            <div className="mt-2 flex gap-2">
              {[3, 5, 10, 20].map((d) => (
                <button
                  key={d}
                  onClick={() => setPairDays(d)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    pairDays === d
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-text-secondary hover:bg-surface-2'
                  }`}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-border" />
          <ToggleRow
            label="赎回费档位提醒"
            desc="当某只基金即将进入更低赎回费档位时提示"
            checked={true}
            onChange={() => {}}
          />
          <ToggleRow
            label="做 T 未买回提醒"
            desc="卖出后超过配对窗口仍未买回时提示"
            checked={true}
            onChange={() => {}}
          />
        </div>
      </Card>

      {/* 数据管理 */}
      <Card title="数据管理" subtitle="本地 SQLite 数据库">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="基金" value={`${holdings.length}`} />
            <Stat label="交易流水" value={`${trades.length}`} />
            <Stat label="隐性成本" value={`¥${summary.hiddenCost.toFixed(0)}`} />
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <div className="text-[12px] font-medium">数据库位置</div>
            <code className="mt-1 block text-[11px] break-all text-text-muted">
              ~/jijin-go/data/jijin.db
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default">导出数据 (JSON)</Button>
            <Button variant="default">导入数据</Button>
            <Button variant="danger">清空所有数据</Button>
          </div>
        </div>
      </Card>

      {/* 关于 */}
      <Card title="关于">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-medium">基金做 T 助手</div>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              长周期持有场外基金，通过择时做 T 稀释持仓成本，
              并把买入费、每日持有费、卖出费这些隐性成本完整摊开。
            </p>
          </div>
          <Badge tone="accent">v0.1.0 · 原型</Badge>
        </div>
      </Card>
    </div>
  )
}

/* ============================================================
   子组件
   ============================================================ */

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-surface-3'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="num mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  )
}
