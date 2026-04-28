import { cn } from '../../utils/cn'

export function Skeleton({ className, style }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-slate-200/90 dark:bg-slate-700/70',
        className
      )}
      style={style}
      aria-hidden
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/[0.07]"
      />
    </div>
  )
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-700/80 dark:bg-slate-900/60 dark:shadow-none">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-9 w-20" />
      <Skeleton className="mt-4 h-2 w-32" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <Skeleton className={cn('h-4', i % 3 === 0 ? 'max-w-[160px]' : i % 3 === 1 ? 'max-w-[100px]' : 'max-w-[72px]')} />
        </td>
      ))}
    </tr>
  )
}

/** Placeholder for chart cards while data loads */
export function ChartCardSkeleton({ className }) {
  const bars = [42, 68, 52, 88, 61, 74, 48]
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-end gap-2 px-1" style={{ height: 240 }}>
        {bars.map((h, i) => (
          <Skeleton key={i} className="min-h-[24px] flex-1 rounded-t-md rounded-b-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between gap-2 px-1">
        {bars.map((_, i) => (
          <Skeleton key={i} className="h-2 flex-1 max-w-[36px]" />
        ))}
      </div>
    </div>
  )
}

/** Line-chart style skeleton */
export function LineChartSkeleton() {
  return (
    <div className="flex h-[280px] flex-col justify-end gap-0 px-2">
      <div className="relative flex flex-1 items-end justify-between gap-2 border-b border-l border-slate-200/80 pb-0 pl-2 dark:border-slate-700/80">
        <Skeleton className="absolute bottom-8 left-[8%] right-[8%] h-[1px] opacity-40" />
        <Skeleton className="absolute bottom-[35%] left-[8%] right-[8%] h-[1px] opacity-30" />
        <Skeleton className="absolute bottom-[60%] left-[8%] right-[8%] h-[1px] opacity-25" />
        {[28, 45, 38, 62, 52, 48].map((h, i) => (
          <div key={i} className="flex flex-1 flex-col justify-end">
            <Skeleton className="w-full rounded-t-sm" style={{ height: `${h}%`, minHeight: 32 }} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between px-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-7" />
        ))}
      </div>
    </div>
  )
}

/** Donut / pie style skeleton */
export function PieChartSkeleton() {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <div className="relative flex h-48 w-48 items-center justify-center">
        <Skeleton className="absolute h-40 w-40 rounded-full" />
        <Skeleton className="relative z-[1] h-24 w-24 rounded-full bg-surface dark:bg-slate-950" />
      </div>
    </div>
  )
}
