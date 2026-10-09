import * as React from 'react'
import { comboParts } from '../../../../shared/keybindings'
import { cn } from '@/lib/utils'

/** Kısayolu tuş kapakları olarak gösterir: Ctrl + Shift + K */
export function KeyCombo({ combo, className, size = 'sm' }: { combo: string; className?: string; size?: 'sm' | 'md' }): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {comboParts(combo).map((p, i) => (
        <kbd
          key={i}
          className={cn(
            'rounded-md border border-b-2 bg-muted font-medium text-muted-foreground',
            size === 'sm' ? 'min-w-[18px] px-1 text-center text-[10.5px] leading-[16px]' : 'min-w-[26px] px-1.5 py-0.5 text-center text-[12px]'
          )}
        >
          {p}
        </kbd>
      ))}
    </span>
  )
}
