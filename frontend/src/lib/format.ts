/** 金额：¥1,234.56 */
export function money(n: number, digits = 2): string {
  const sign = n < 0 ? '-' : ''
  return (
    sign +
    '¥' +
    Math.abs(n).toLocaleString('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  )
}

/** 带正负号的金额 */
export function signedMoney(n: number, digits = 2): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return sign + '¥' + Math.abs(n).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** 百分比：+1.23% */
export function pct(n: number, digits = 2): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return sign + Math.abs(n).toFixed(digits) + '%'
}

/** 绝对百分比：1.23% */
export function absPct(n: number, digits = 2): string {
  return Math.abs(n).toFixed(digits) + '%'
}

/** 份额：12,345.67 */
export function shares(n: number, digits = 2): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** 净值：3.0100 */
export function nav(n: number): string {
  return n.toFixed(4)
}

/** 大额金额的紧凑显示：12.34万 / 1.23亿 */
export function compactMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e8) return sign + '¥' + (abs / 1e8).toFixed(2) + '亿'
  if (abs >= 1e4) return sign + '¥' + (abs / 1e4).toFixed(2) + '万'
  return money(n)
}

/** 大额数字的紧凑显示 */
export function compactNum(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e8) return sign + (abs / 1e8).toFixed(2) + '亿'
  if (abs >= 1e4) return sign + (abs / 1e4).toFixed(2) + '万'
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

/** 日期：2026-11-19 → 11月19日 */
export function shortDate(s: string): string {
  const [, m, d] = s.split('-').map(Number)
  return `${m}月${d}日`
}

/** 相对日期描述 */
export function relativeDay(s: string, now = today()): string {
  const d = days(s, now)
  if (d === 0) return '今天'
  if (d === 1) return '昨天'
  if (d === 2) return '前天'
  if (d < 0) return `${-d}天后`
  if (d < 30) return `${d}天前`
  return shortDate(s)
}

function days(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) /
      86400000,
  )
}

/** 涨跌方向 → 语义色 class */
export function trendClass(n: number): string {
  if (n > 0) return 'text-up'
  if (n < 0) return 'text-down'
  return 'text-flat'
}

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
