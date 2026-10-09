import * as React from 'react'
import { CalendarRange, Plus, Scissors, X } from 'lucide-react'
import { toast } from 'sonner'
import { addDays, isoWeekday, today } from '../../../../shared/dates'
import { spreadOverDays, suggestBreakdown, type StepSuggestion } from '../../../../shared/v2'
import { busyMinutes } from '../../../../shared/schedule'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/common/Toggle'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData } from '@/lib/data'
import { formatMinutes, relativeDay } from '@/lib/format'

/** Büyük görevi alt görevlere böl; istenirse günlere dağıt */
export function BreakdownDialog(): React.JSX.Element {
  const { breakdownTask: task, closeBreakdown, events } = useApp()
  const [steps, setSteps] = React.useState<StepSuggestion[]>([])
  const [spread, setSpread] = React.useState(true)
  const capacities = useData(() => window.api.capacity.list()).data ?? []
  const todayStr = today()

  React.useEffect(() => {
    if (task) {
      setSteps(suggestBreakdown(task.title, task.estimateMin))
      setSpread(true)
    }
  }, [task])

  const dailyMinutes = React.useCallback(
    (date: string) => Math.max(0, (capacities.find((c) => c.weekday === isoWeekday(date))?.minutes ?? 300) - busyMinutes(events, date)),
    [capacities, events]
  )
  const start = task?.scheduledDate && task.scheduledDate > todayStr ? task.scheduledDate : todayStr
  const placed = React.useMemo(
    () => (spread ? spreadOverDays(steps, start, dailyMinutes, addDays, task?.deadline ?? null) : steps.map((step) => ({ date: start, step }))),
    [spread, steps, start, dailyMinutes, task?.deadline]
  )
  const total = steps.reduce((a, s) => a + s.estimateMin, 0)
  const lastDate = placed.at(-1)?.date
  const pastDeadline = !!task?.deadline && !!lastDate && lastDate > task.deadline

  const set = (i: number, patch: Partial<StepSuggestion>): void => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const create = async (): Promise<void> => {
    if (!task) return
    const clean = placed.filter((p) => p.step.title.trim())
    if (!clean.length) return void toast.error('En az bir adım yaz.')
    try {
      await window.api.tasks.createSubtasks(
        task.id,
        clean.map((p) => ({ title: p.step.title.trim(), estimateMin: p.step.estimateMin, scheduledDate: spread ? p.date : task.scheduledDate }))
      )
      // Üst görevin tahmini, parçaların toplamı olsun
      await window.api.tasks.update(task.id, { estimateMin: total })
      refreshAll()
      closeBreakdown()
      toast.success(`${clean.length} adıma bölündü`, {
        description: spread && lastDate ? `${relativeDay(clean[0].date, todayStr)} – ${relativeDay(lastDate, todayStr)} arasına dağıtıldı` : task.title
      })
    } catch {
      toast.error('Alt görevler oluşturulamadı.')
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && closeBreakdown()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="size-5 text-primary" /> Parçalara böl
          </DialogTitle>
          <DialogDescription className="truncate">
            {task?.title}
            {task?.estimateMin ? ` · ${formatMinutes(task.estimateMin)}` : ''}. Küçük adımlar başlamayı kolaylaştırır; öneriyi düzenleyebilirsin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {placed.map(({ step, date }, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-[12px] tabular text-muted-foreground">{i + 1}</span>
              <input
                value={step.title}
                onChange={(e) => set(i, { title: e.target.value })}
                className="h-9 flex-1 rounded-lg border bg-background/50 px-3 text-[13.5px] outline-none focus:border-ring/60"
              />
              <input
                type="number"
                min={5}
                step={5}
                value={step.estimateMin}
                onChange={(e) => set(i, { estimateMin: Math.max(5, Math.round(Number(e.target.value) || 5)) })}
                className="h-9 w-[64px] rounded-lg border bg-background/50 px-2 text-right text-[13px] tabular outline-none focus:border-ring/60"
                aria-label="Dakika"
              />
              <span className="w-[74px] truncate text-[11.5px] text-muted-foreground">{spread ? relativeDay(date, todayStr) : ''}</span>
              <button type="button" aria-label="Adımı sil" onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="ml-7 self-start gap-1.5" onClick={() => setSteps((prev) => [...prev, { title: '', estimateMin: 30 }])}>
            <Plus className="size-3.5" /> Adım ekle
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-xl border px-4 py-3">
          <div>
            <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
              <CalendarRange className="size-4 text-primary" /> Günlere dağıt
            </div>
            <div className={pastDeadline ? 'text-[12px] text-warning' : 'text-[12px] text-muted-foreground'}>
              {pastDeadline
                ? 'Teslim tarihine sığmıyor; son adımlar teslim gününe yığıldı.'
                : 'Her güne en fazla kapasitenin yarısı; dersler hesaba katılır'}
            </div>
          </div>
          <Toggle label="Günlere dağıt" checked={spread} onChange={setSpread} />
        </div>

        <DialogFooter className="items-center">
          <span className="mr-auto text-[12.5px] tabular text-muted-foreground">Toplam {formatMinutes(total) || '0dk'}</span>
          <Button variant="ghost" onClick={closeBreakdown}>
            Vazgeç
          </Button>
          <Button className="border-0 bg-brand font-semibold text-white" onClick={create}>
            Alt görevleri oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
