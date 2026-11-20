import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useTheme } from '../lib/theme'
import { ErrorBanner } from './ErrorBanner'
import {
  IconChart,
  IconCoin,
  IconDashboard,
  IconList,
  IconMoon,
  IconSettings,
  IconSun,
  IconWallet,
} from './icons'

const NAV = [
  { to: '/', label: '总览', icon: IconDashboard, end: true },
  { to: '/holdings', label: '持仓', icon: IconWallet },
  { to: '/transactions', label: '流水', icon: IconList },
  { to: '/cost', label: '成本', icon: IconCoin },
  { to: '/settings', label: '设置', icon: IconSettings },
]

const MOBILE_NAV = [
  { to: '/', label: '总览', icon: IconDashboard, end: true },
  { to: '/holdings', label: '持仓', icon: IconWallet },
  { to: '/transactions', label: '流水', icon: IconList },
  { to: '/cost', label: '成本', icon: IconCoin },
  { to: '/settings', label: '设置', icon: IconSettings },
]

export function Layout() {
  const { market, summary, holdings } = useStore()
  const { resolved, toggle } = useTheme()
  const location = useLocation()

  const isDetail = /^\/fund\//.test(location.pathname)

  // 盘中实时估值拿不到时，退回展示「最新已公布净值」
  const hasEstimate = holdings.some((h) => h.estimateNav !== null)
  const latestNavDate = holdings.reduce(
    (latest, h) => (h.navDate > latest ? h.navDate : latest),
    '',
  )

  return (
    <div className="min-h-dvh bg-canvas">
      {/* ================= 桌面侧边栏 ================= */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] flex-col border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
            <IconChart width={19} height={19} />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">基金做T助手</div>
            <div className="text-[11px] text-text-muted">长周期摊薄成本</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text'
                }`
              }
            >
              <item.icon width={17} height={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-lg bg-surface-2 px-3 py-2.5">
            <div className="text-[11px] text-text-muted">隐性成本累计</div>
            <div className="num mt-0.5 text-[15px] font-semibold text-warn">
              ¥{summary.hiddenCost.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
            </div>
            <div className="num mt-0.5 text-[11px] text-text-muted">
              占投入 {summary.hiddenCostRate.toFixed(2)}%
            </div>
          </div>
        </div>
      </aside>

      {/* ================= 主内容 ================= */}
      <div className="lg:pl-[228px]">
        {/* 顶部栏 */}
        <header className="sticky top-0 z-20 border-b border-border bg-canvas/85 backdrop-blur-md">
          {/* 大盘指数条 */}
          <div className="hidden border-b border-border bg-surface md:block">
            <div className="flex items-center gap-6 overflow-x-auto px-5 py-1.5 text-[12px]">
              {market.indices.map((idx) => (
                <div key={idx.code} className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-text-muted">{idx.name}</span>
                  <span className="num font-medium text-text">
                    {idx.price.toFixed(2)}
                  </span>
                  <span
                    className={`num ${
                      idx.changePct > 0
                        ? 'text-up'
                        : idx.changePct < 0
                          ? 'text-down'
                          : 'text-flat'
                    }`}
                  >
                    {idx.changePct > 0 ? '+' : ''}
                    {idx.changePct.toFixed(2)}%
                  </span>
                </div>
              ))}
              <span className="ml-auto shrink-0 text-[11px] text-text-muted">
                更新 {market.updatedAt}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            {isDetail && (
              <NavLink
                to="/holdings"
                className="-ml-1 flex items-center gap-1 rounded-lg px-1.5 py-1 text-text-secondary hover:text-text lg:hidden"
              >
                <span className="text-lg leading-none">‹</span>
              </NavLink>
            )}
            <div className="min-w-0 flex-1 lg:hidden">
              <div className="truncate text-[15px] font-semibold tracking-tight">
                {isDetail ? '基金详情' : '基金做T助手'}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span
                title={
                  hasEstimate
                    ? '盘中实时估值可用'
                    : '天天基金盘中估值接口已下线，仅能展示最近一个已公布净值'
                }
                className="hidden items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[11px] text-text-secondary sm:inline-flex"
              >
                <span
                  className={`live-dot h-1.5 w-1.5 rounded-full ${
                    hasEstimate ? 'bg-up' : 'bg-warn'
                  }`}
                />
                {hasEstimate
                  ? '实时估值已开启'
                  : latestNavDate
                    ? `净值已更新 · ${latestNavDate}`
                    : '盘中估值不可用'}
              </span>
              <button
                onClick={toggle}
                aria-label="切换主题"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-2 hover:text-text"
              >
                {resolved === 'dark' ? (
                  <IconSun width={16} height={16} />
                ) : (
                  <IconMoon width={16} height={16} />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-24 pt-4 sm:px-6 lg:pb-10">
          <ErrorBanner />
          <Outlet />
        </main>
      </div>

      {/* ================= 移动端底部 Tab ================= */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-text-muted'
                }`
              }
            >
              <item.icon width={19} height={19} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
