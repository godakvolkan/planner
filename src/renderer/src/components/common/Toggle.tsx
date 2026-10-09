import * as React from 'react'
import { cn } from '@/lib/utils'

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors', checked ? 'border-transparent bg-brand' : 'bg-muted')}
    >
      <span
        className={cn(
          'absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow transition-[left]',
          checked ? 'left-[22px]' : 'left-[3px]'
        )}
      />
    </button>
  )
}
