import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, Hourglass, Play } from 'lucide-react'
import { toast } from 'sonner'
import { today } from '../../../../shared/dates'
import { fitToTime } from '../../../../shared/v2'
import { DEFAULT_ESTIMATE } from '../../../../shared/planning'
import { toTime } from '../../../../shared/schedule'
import { contextMeta, filterByContext } from '../../../../shared/context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData } from '@/lib/data'
import { formatMinutes } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { openFirstStep } from '@/lib/actions'
import { cn } from '@/lib/utils'

const PRESETS = [15, 30, 45, 60, 90, 120, 180]

/** "Kaç dakikam var?" — boş süreye en iyi sığan işler */
export function FreeTimeDialog(): React.JSX.Element {
  const { freeTime, closeFreeTime, todayTasks, areas, session, startFocus, currentContext } = useApp()
  const navigate = useNavigate()
  const open = freeTime !== undefined
  const [minutes, setMinutes] = React.useState(30)
  React.useEffect(() => {
    if (typeof freeTime === 'number') setMinutes(Math.max(5, Math.min(480, freeTime)))
  }, [freeTime])
  const summary = useData(() => window.api.stats.day(), [open]).data
  const now = new Date()
  const date = today()
  const plan = React.useMemo(
    () => fitToTime(filterByContext(todayTasks, currentContext), minutes, { date, minuteOfDay: now.getHours() * 60 + now.getMinutes(), activeTaskId: session?.taskId ?? null }, summary?.energy ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayTasks, minutes, date, session?.taskId, summary?.energy, currentContext]
  )

  const start = async (): Promise<void> => {
    const first = plan.tasks[0]
    if (!first) return
    if (first.firstStepTarget) await openFirstStep(first)
    await startFocus(first.id)
    closeFreeTime()
    navigate('/focus')
  }

  /** Şu andan itibaren arka arkaya takvime yerleştirir (5 dakikaya yuvarlanmış) */
  const schedule = async (): Promise<void> => {
    const before = plan.tasks.map((t) => ({ id: t.id, scheduledDate: t.scheduledDate, scheduledTime: t.scheduledTime }))
    let cursor = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5
    try {
      for (const t of plan.tasks) {
        await window.api.tasks.update(t.id, { status: 'planned', scheduledDate: date, scheduledTime: toTime(Math.min(cursor, 23 * 60 + 55)), plannedWeek: null })
        cursor += t.estimateMin ?? DEFAULT_ESTIMATE
      }
      refreshAll()
      closeFreeTime()
      toast.success(`${plan.tasks.length} görev takvime yerleştirildi`, {
        description: `${toTime(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5)} – ${toTime(Math.min(cursor, 1439))}`,
        action: {
          label: 'Geri al',
          onClick: async () => {
            for (const b of before) await window.api.tasks.update(b.id, { scheduledDate: b.scheduledDate, scheduledTime: b.scheduledTime })
            refreshAll()
          }
        }
      })
    } catch {
      toast.error('Yerleştirilemedi.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeFreeTime()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hourglass className="size-5 text-primary" /> Kaç dakikan var?
          </DialogTitle>
          <DialogDescription>Bu süreye en iyi sığan işleri seçiyorum: önce önemli olanlar, kısa aralıkta küçük işler.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              className={cn(
                'h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors',
                minutes === m ? 'border-ring/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {formatMinutes(m)}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={PRESETS.includes(minutes) ? '' : minutes}
              placeholder="dk"
              onChange={(e) => e.target.value && setMinutes(Math.max(5, Math.min(480, Math.round(Number(e.target.value)))))}
              className="h-9 w-[70px] rounded-lg border bg-background/50 px-2 text-[13px] text-foreground outline-none focus:border-ring/60"
            />
            dk
          </label>
        </div>

        <div className="rounded-xl border">
          <div className="flex items-baseline justify-between border-b px-4 py-2.5">
            <span className="section-label">{formatMinutes(minutes)}lık plan</span>
            <span className="text-[12px] tabular text-muted-foreground">
              {formatMinutes(plan.totalMin) || '0dk'} dolu{plan.freeMin > 0 ? ` · ${formatMinutes(plan.freeMin)} boş` : ''}
            </span>
          </div>
          {plan.tasks.length === 0 ? (
            <div className="px-4 py-4 text-[13px] text-muted-foreground">Bu süreye sığan bir iş yok. Daha uzun bir süre seç ya da kısa bir görev ekle.</div>
          ) : (
            <div className="divide-y divide-border/60">
              {plan.tasks.map((t, i) => {
                const area = findArea(areas, t.areaId)
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold', i === 0 ? 'bg-brand text-white' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: areaColor(area) }} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{t.title}</span>
                    <span className="text-[12px] tabular text-muted-foreground">{formatMinutes(t.estimateMin ?? DEFAULT_ESTIMATE)}</span>
                  </div>
                )
              })}
            </div>
          )}
          {/* Doluluk çubuğu */}
          <div className="h-1.5 overflow-hidden rounded-b-xl bg-muted">
            <div className="h-full bg-brand" style={{ width: `${Math.min(100, (plan.totalMin / Math.max(1, minutes)) * 100)}%` }} />
          </div>
        </div>
        {currentContext && (
          <p className="text-[12px] text-muted-foreground">
            {contextMeta(currentContext)?.emoji} {contextMeta(currentContext)?.label} bağlamında yapılabilecek işler seçildi.
          </p>
        )}
        {summary?.energy && summary.energy !== 'medium' && (
          <p className="text-[12px] text-muted-foreground">
            Enerjin {summary.energy === 'low' ? 'düşük: küçük ve kolay işler' : 'yüksek: büyük işler'} öne alındı.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={closeFreeTime}>
            Vazgeç
          </Button>
          <Button variant="outline" className="gap-2" disabled={!plan.tasks.length} onClick={schedule}>
            <CalendarPlus className="size-4" /> Takvime yerleştir
          </Button>
          <Button className="gap-2 border-0 bg-brand font-semibold text-white" disabled={!plan.tasks.length} onClick={start}>
            <Play className="size-4 fill-white" /> İlkiyle başla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
