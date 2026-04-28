import { useTheme } from '../providers/ThemeProvider'

export function useChartColors() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    isDark,
    grid: isDark ? '#334155' : '#e2e8f0',
    tick: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? '#475569' : '#e2e8f0',
    tooltipLabel: isDark ? '#f1f5f9' : '#0f172a',
    dotStroke: isDark ? '#1e293b' : '#ffffff',
    pieSegmentStroke: isDark ? '#0f172a' : '#ffffff',
  }
}
