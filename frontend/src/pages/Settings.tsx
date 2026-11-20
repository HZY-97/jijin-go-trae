import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card } from '../components/ui'
import { IconMonitor, IconMoon, IconSun } from '../components/icons'
import { useTheme, type ThemeMode } from '../lib/theme'
import { useStore } from '../lib/store'
import * as api from '../lib/api'
import type { HealthInfo } from '../types'

export function Settings() {
  const { mode, setMode } = useTheme()
  const { summary, holdings, trades, settings, saveSettings, refresh, source } =
    useStore()
  const [health, setHealth] = useState<HealthInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(
    null,
  )
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api
      .getHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [source])

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setMessage(null)
    try {
      await fn()
    } catch (err) {
      setMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : '操作失败',
      })
    } finally {
      setBusy(null)
    }
  }

  function handleExport() {
    return run('export', async () => {
      const data = await api.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fund-t-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMessage({ tone: 'ok', text: '已导出备份文件' })
    })
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run('import', async () => {
      const parsed = JSON.parse(await file.text())
      const res = await api.importData({
        funds: Array.isArray(parsed.funds) ? parsed.funds : [],
        trades: Array.isArray(parsed.trades) ? parsed.trades : [],
        settings: parsed.settings ?? {},
      })
      await refresh()
      setMessage({
        tone: 'ok',
        text: `已导入 ${res.importedFunds} 只基金、${res.importedTrades} 笔流水`,
      })
    })
  }

  function handleClear() {
    if (!window.confirm('确定清空全部基金与流水？该操作不可撤销。')) return
    void run('clear', async () => {
      await api.clearData()
      await refresh()
      setMessage({ tone: 'ok', text: '已清空全部数据' })
    })
  }

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

      {message && (
        <div
          className={`rounded-lg border px-3 py-2 text-[12px] ${
            message.tone === 'ok'
              ? 'border-accent-border bg-accent-soft text-accent'
              : 'border-up/30 bg-up-soft text-up'
          }`}
        >
          {message.text}
        </div>
      )}

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
      <Card title="数据刷新" subtitle="净值与大盘指数的更新节奏">
        <div className="space-y-4">
          <ToggleRow
            label="自动刷新"
            desc="按设定间隔重新拉取净值与大盘指数"
            checked={settings.autoRefresh}
            onChange={(v) => void saveSettings({ autoRefresh: v })}
          />
          <div className="h-px bg-border" />
          <div>
            <div className="text-[13px] font-medium">刷新间隔</div>
            <div className="mt-2 flex gap-2">
              {[15, 30, 60, 120].map((s) => (
                <button
                  key={s}
                  onClick={() => void saveSettings({ refreshSeconds: s })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.refreshSeconds === s
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
              卖出后在此天数内买入同一只基金，自动识别为一次做 T。修改后立即重新配对。
            </p>
            <div className="mt-2 flex gap-2">
              {[3, 5, 10, 20].map((d) => (
                <button
                  key={d}
                  onClick={() => void saveSettings({ pairMaxGapDays: d })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.pairMaxGapDays === d
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
            checked={settings.remindTier}
            onChange={(v) => void saveSettings({ remindTier: v })}
          />
          <ToggleRow
            label="做 T 未买回提醒"
            desc="卖出后超过配对窗口仍未买回时提示"
            checked={settings.remindPendingT}
            onChange={(v) => void saveSettings({ remindPendingT: v })}
          />
        </div>
      </Card>

      {/* 数据管理 */}
      <Card title="数据管理" subtitle="本地 JSON 文件">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="基金" value={`${holdings.length}`} />
            <Stat label="交易流水" value={`${trades.length}`} />
            <Stat label="隐性成本" value={`¥${summary.hiddenCost.toFixed(0)}`} />
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <div className="text-[12px] font-medium">数据文件位置</div>
            <code className="num mt-1 block text-[11px] break-all text-text-muted">
              {health ? `${health.dataDir}/{funds,trades,settings}.json` : '后端未连接'}
            </code>
            {health && (
              <div className="num mt-1 text-[11px] text-text-muted">
                缓存目录 {health.cacheDir} · 后端版本 v{health.version}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              onClick={() => void handleExport()}
              disabled={busy === 'export' || source === 'mock'}
            >
              {busy === 'export' ? '导出中…' : '导出数据 (JSON)'}
            </Button>
            <Button
              variant="default"
              onClick={() => fileRef.current?.click()}
              disabled={busy === 'import' || source === 'mock'}
            >
              {busy === 'import' ? '导入中…' : '导入数据'}
            </Button>
            <Button
              variant="danger"
              onClick={handleClear}
              disabled={busy === 'clear' || source === 'mock'}
            >
              {busy === 'clear' ? '清空中…' : '清空所有数据'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
            />
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
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              行情与费率来自天天基金 / 新浪财经；盘中实时估值接口已下线，
              页面展示的是最近一个已公布净值。
            </p>
          </div>
          <Badge tone="accent">v0.1.0</Badge>
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
