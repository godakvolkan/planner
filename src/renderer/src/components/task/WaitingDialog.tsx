import * as React from 'react'
import { Hourglass } from 'lucide-react'
import { toast } from 'sonner'
import { addDays, today } from '../../../../shared/dates'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { refreshAll } from '@/lib/data'
import { relativeDay } from '@/lib/format'
import { cn } from '@/lib/utils'

const QUICK = [1, 3, 7]

/** "Ahmet'ten e-posta bekliyorum" — benim yapmayacağım ama takip etmem gereken iş */
export function WaitingDialog(): React.JSX.Element {
  const { waitingTask: task, closeWaiting } = useApp()
  const todayStr = today()
  const [who, setWho] = React.useState('')
  const [followUp, setFollowUp] = React.useState<string>(addDays(todayStr, 3))

  React.useEffect(() => {
    if (!task) return
    setWho(task.waitingFor ?? '')
    setFollowUp(task.followUpDate ?? addDays(todayStr, 3))
  }, [task, todayStr])

  const save = async (): Promise<void> => {
    if (!task) return
    if (!who.trim()) return void toast.error('Kimi veya neyi beklediğini yaz.')
    const before = { status: task.status, scheduledDate: task.scheduledDate, scheduledTime: task.scheduledTime, plannedWeek: task.plannedWeek }
    try {
      await window.api.tasks.setWaiting(task.id, who.trim(), followUp || null)
      refreshAll()
      closeWaiting()
      toast('Bekleyenlere eklendi', {
        description: followUp ? `${relativeDay(followUp, todayStr)} takip için Bugün listene düşecek.` : task.title,
        action: { label: 'Geri al', onClick: () => window.api.tasks.update(task.id, before).then(refreshAll, () => toast.error('Geri alınamadı.')) }
      })
    } catch {
      toast.error('Kaydedilemedi.')
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && closeWaiting()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hourglass className="size-5 text-primary" /> Bekliyor olarak işaretle
          </DialogTitle>
          <DialogDescription className="truncate">{task?.title}</DialogDescription>
        </DialogHeader>
        <label className="text-[12.5px] text-muted-foreground">
          Kimi / neyi bekliyorsun?
          <input
            autoFocus
            value={who}
            onChange={(e) => setWho(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="örn. Hocadan geri dönüş, Ahmet'ten e-posta"
            className="mt-1 h-10 w-full rounded-lg border bg-background/50 px-3 text-[14px] text-foreground outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <div>
          <div className="mb-1.5 text-[12.5px] text-muted-foreground">Ne zaman takip edeyim?</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK.map((d) => {
              const date = addDays(todayStr, d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFollowUp(date)}
                  className={cn(
                    'h-8 rounded-lg border px-3 text-[12.5px] font-medium',
                    followUp === date ? 'border-ring/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {d === 1 ? 'Yarın' : d === 7 ? '1 hafta' : `${d} gün`}
                </button>
              )
            })}
            <input
              type="date"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className="h-8 rounded-lg border bg-background/50 px-2 text-[12.5px] outline-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={closeWaiting}>
            Vazgeç
          </Button>
          <Button className="border-0 bg-brand font-semibold text-white" onClick={save}>
            Bekleyenlere ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
