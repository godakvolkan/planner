import * as React from 'react'
import { Gauge, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { today } from '../../../../shared/dates'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { refreshAll, useData } from '@/lib/data'
import { formatMinutes } from '@/lib/format'
import { cn } from '@/lib/utils'

const HOURS = [1, 2, 3, 4, 5, 6, 8, 10]

/** "Bugün sadece 2 saatim var": tek güne özel kapasite. Tıklanabilir alanı children olarak alır. */
export function CapacityPicker({ children, busyMin = 0 }: { children: React.ReactNode; busyMin?: number }): React.JSX.Element {
  const date = today()
  const override = useData(() => window.api.capacity.override(date)).data ?? null
  const [open, setOpen] = React.useState(false)

  const set = async (minutes: number | null): Promise<void> => {
    try {
      await window.api.capacity.setOverride(date, minutes)
      refreshAll()
      setOpen(false)
      toast.success(minutes === null ? 'Bugün varsayılan kapasiteye döndü' : `Bugün için ${formatMinutes(minutes)} ayrıldı`)
    } catch {
      toast.error('Kapasite kaydedilemedi.')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Gauge className="size-4 text-primary" /> Bugün kaç saatin var?
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Sadece bugün için geçerli.{busyMin > 0 ? ` Ders programındaki ${formatMinutes(busyMin)} bundan ayrıca düşülür.` : ''}
        </p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => set(h * 60)}
              className={cn(
                'h-9 rounded-lg border text-[13px] font-medium transition-colors',
                override === h * 60 ? 'border-ring/50 bg-primary/15 text-primary' : 'hover:border-ring/40'
              )}
            >
              {h}s
            </button>
          ))}
        </div>
        {override !== null && (
          <button
            type="button"
            onClick={() => set(null)}
            className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> Varsayılana dön
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
