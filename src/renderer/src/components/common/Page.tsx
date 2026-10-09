import * as React from 'react'
import { cn } from '@/lib/utils'

/** Her sayfanın ortak iskeleti: sürüklenebilir başlık + kaydırılabilir içerik */
export function Page({
  title,
  subtitle,
  actions,
  children,
  className,
  wide
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Planlayıcı gibi tam genişlik isteyen sayfalar */
  wide?: boolean
}): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Dar pencerede eylemler başlığın altına iner; üst çubuk olduğu için üst boşluk küçülür */}
      <header className="drag flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-3 px-8 pb-5 pt-9 max-md:px-5 max-sm:px-4 max-sm:pb-4 max-sm:pt-4">
        <div className="min-w-[min(100%,220px)] flex-1">
          {subtitle && <div className="mb-1 truncate text-[12.5px] font-medium text-muted-foreground">{subtitle}</div>}
          <h1 className="truncate text-[26px] font-semibold tracking-tight max-sm:text-[22px]">{title}</h1>
        </div>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn('min-h-0 flex-1 overflow-y-auto px-8 pb-10 max-md:px-5 max-sm:px-4 max-sm:pb-6', className)}>
        <div className={cn(wide ? 'h-full' : 'mx-auto max-w-[1040px]')}>{children}</div>
      </div>
    </div>
  )
}

export function Section({
  title,
  count,
  action,
  children,
  className
}: {
  title: React.ReactNode
  count?: number
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cn('mt-7', className)}>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="section-label flex shrink-0 items-center gap-2">
          {title}
          {count !== undefined && <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] tabular">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** İnce gradyan ilerleme çubuğu; %100'ü aşarsa uyarı rengine döner */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }): React.JSX.Element {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const over = max > 0 && value > max
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', over ? 'bg-warning' : 'bg-brand')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ElementType
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('surface p-4', className)}>
      <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-tight tabular">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Icon className="size-5" />
      </div>
      <div className="mt-4 text-[15px] font-semibold">{title}</div>
      {description && <div className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
