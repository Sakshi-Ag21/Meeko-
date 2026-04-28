import { cn } from '../../utils/cn'

export function Table({ className, children }) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/80 dark:bg-slate-900/60 dark:shadow-none',
        className
      )}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

export function TableHead({ children }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
        {children}
      </tr>
    </thead>
  )
}

export function TableHeader({ children, className }) {
  return (
    <th
      className={cn(
        'px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
        className
      )}
    >
      {children}
    </th>
  )
}

export function TableBody({ children }) {
  return <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
}

export function TableRow({ children, className, onClick }) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/50',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </tr>
  )
}

export function TableCell({ children, className }) {
  return (
    <td className={cn('px-5 py-4 text-slate-700 dark:text-slate-300', className)}>{children}</td>
  )
}
