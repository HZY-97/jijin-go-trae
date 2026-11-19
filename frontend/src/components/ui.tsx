import type { ReactNode } from 'react'

/* ============================================================
   Card
   ============================================================ */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClass = '',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-text">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClass || 'p-4 sm:p-5'}>{children}</div>
    </section>
  )
}

/* ============================================================
   StatTile —— 指标块
   ============================================================ */

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'up' | 'down' | 'accent' | 'warn'
  icon?: ReactNode
}) {
  const toneClass = {
    default: 'text-text',
    up: 'text-up',
    down: 'text-down',
    accent: 'text-accent',
    warn: 'text-warn',
  }[tone]

  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className={`num mt-1.5 text-[22px] font-semibold leading-tight ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </div>
  )
}

/* ============================================================
   Badge
   ============================================================ */

type BadgeTone = 'neutral' | 'accent' | 'up' | 'down' | 'warn' | 'info'

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-surface-3 text-text-secondary',
    accent: 'bg-accent-soft text-accent',
    up: 'bg-up-soft text-up',
    down: 'bg-down-soft text-down',
    warn: 'bg-warn-soft text-warn',
    info: 'bg-info-soft text-info',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/* ============================================================
   ChangeText —— 带方向的涨跌数值
   ============================================================ */

export function ChangeText({
  value,
  text,
  className = '',
  showSign = true,
}: {
  value: number
  text: string
  className?: string
  showSign?: boolean
}) {
  const color = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-flat'
  const sign = showSign && value > 0 ? '+' : ''
  return <span className={`num ${color} ${className}`}>{sign}{text}</span>
}

/* ============================================================
   EmptyState
   ============================================================ */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-text-muted">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ============================================================
   Button
   ============================================================ */

export function Button({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    default:
      'bg-surface-2 text-text border border-border hover:bg-surface-3 hover:border-border-strong',
    primary:
      'bg-accent text-white hover:bg-accent-hover border border-transparent shadow-sm',
    ghost: 'bg-transparent text-text-secondary hover:bg-surface-2 border border-transparent',
    danger: 'bg-up-soft text-up border border-transparent hover:brightness-95',
  }
  const sizes = {
    sm: 'h-8 px-2.5 text-xs gap-1',
    md: 'h-9 px-3.5 text-[13px] gap-1.5',
  }
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

/* ============================================================
   SectionTitle —— 移动端分组小标题
   ============================================================ */

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h3 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
        {children}
      </h3>
      {action}
    </div>
  )
}
