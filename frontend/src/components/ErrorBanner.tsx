import { IconAlert } from './icons'
import { useStore } from '../lib/store'

/**
 * 顶部状态横幅：
 *  - 后端离线 → 提示当前是演示数据（写入功能不可用）
 *  - 数据源降级 → 展示后端返回的 warnings（用了缓存旧值等）
 */
export function ErrorBanner() {
  const { source, meta, error, refresh } = useStore()

  if (source === 'api' && (!meta || meta.source === 'live') && !error) return null

  const offline = source === 'mock'
  const warnings = meta?.warnings ?? []

  return (
    <div
      className={`mb-4 flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-xs ${
        offline
          ? 'border-warn/30 bg-warn-soft/40'
          : 'border-info/30 bg-info-soft/40'
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
          offline ? 'bg-warn-soft text-warn' : 'bg-info-soft text-info'
        }`}
      >
        <IconAlert width={14} height={14} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-text">
          {offline ? '后端未连接，当前显示演示数据' : '部分数据源降级'}
        </div>
        <div className="mt-0.5 leading-relaxed text-text-secondary">
          {offline ? (
            <>
              无法访问后端服务（127.0.0.1:8000），新增/编辑流水等写操作暂不可用。
              {error ? <span className="ml-1 text-text-muted">（{error}）</span> : null}
            </>
          ) : (
            <>
              净值/费率来自本地缓存，可能不是最新值。
              {warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-text-muted">
                  {warnings.slice(0, 4).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => void refresh()}
        className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text"
      >
        重试连接
      </button>
    </div>
  )
}
