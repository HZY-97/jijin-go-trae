import * as echarts from 'echarts/core'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useMemo, useRef } from 'react'
import { useTheme } from '../lib/theme'

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  CanvasRenderer,
])

/**
 * ECharts 包装：自动跟随明暗主题，并注入统一的设计 token。
 * 仅注册用到的图表与组件，避免打包整个 echarts。
 */
export function Chart({
  option,
  height = 260,
  className = '',
}: {
  option: (theme: 'light' | 'dark') => Record<string, unknown>
  height?: number | string
  className?: string
}) {
  const { resolved } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  const merged = useMemo(() => {
    const isDark = resolved === 'dark'
    const base = {
      color: isDark
        ? ['#5b8dff', '#2ec48a', '#f2555b', '#e5a13a', '#35b6cf', '#a78bfa']
        : ['#2f6df6', '#17a673', '#dc2f36', '#d98207', '#0f9bb5', '#7c5cf0'],
      backgroundColor: 'transparent',
      textStyle: {
        color: isDark ? '#a9b5c9' : '#4a5567',
        fontFamily:
          "'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        fontSize: 11,
      },
      animationDuration: 420,
      tooltip: {
        backgroundColor: isDark ? '#1b2740' : '#ffffff',
        borderColor: isDark ? '#33435f' : '#e4e8ee',
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: isDark ? '#e8edf6' : '#0d1526', fontSize: 12 },
        extraCssText:
          'box-shadow: 0 8px 32px rgba(13,21,38,.14); border-radius: 10px;',
      },
    }
    return { ...base, ...option(resolved) }
  }, [option, resolved])

  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, {
        renderer: 'canvas',
      })
    }
    chartRef.current.setOption(merged, { notMerge: true })
  }, [merged])

  // 容器尺寸变化时重绘（响应式布局切换时必需）
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(() => chartRef.current?.resize())
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{ height, width: '100%' }}
      className={className}
    />
  )
}

/** 通用坐标轴配置 */
export function axisStyle(theme: 'light' | 'dark') {
  const dark = theme === 'dark'
  return {
    axisLine: { lineStyle: { color: dark ? '#33435f' : '#e4e8ee' } },
    axisTick: { show: false },
    axisLabel: { color: dark ? '#6f7d95' : '#8a93a3', fontSize: 10 },
    splitLine: { lineStyle: { color: dark ? '#22304a' : '#eef1f5', type: 'dashed' as const } },
  }
}
