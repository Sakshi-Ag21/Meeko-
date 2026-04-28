import { cn } from '../../utils/cn'

export function Card({ className, children, padding = 'md', ...props }) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  }
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white shadow-card transition-shadow duration-200 hover:shadow-card-md dark:border-slate-700/80 dark:bg-slate-900/60 dark:shadow-none dark:hover:shadow-lg dark:hover:shadow-black/20',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }) {
  return <div className={cn('mb-4 flex flex-col gap-1', className)}>{children}</div>
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={cn('text-sm font-semibold text-slate-800 dark:text-slate-100', className)}>{children}</h3>
  )
}

export function CardDescription({ className, children }) {
  return <p className={cn('text-sm text-slate-500 dark:text-slate-400', className)}>{children}</p>
}
