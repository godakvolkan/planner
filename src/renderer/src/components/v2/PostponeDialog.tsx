import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { POSTPONE_REASONS, type PostponeReason } from '../../../../shared/v2'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { refreshAll } from '@/lib/data'
import { deleteTask } from '@/lib/actions'
import { cn } from '@/lib/utils'

/** "Bunu neden yapmıyorum?" — 3. ertelemede bir kez sorulur, cevaba göre somut bir sonraki adım önerir */
export function PostponeDialog(): React.JSX.Element {
  const { postponedTask: task, closePostponed, askBreakdown, openTask, startFocus } = useApp()
  const navigate = useNavigate()
  const [picked, setPicked] = React.useState<PostponeReason | null>(null)
  React.useEffect(() => setPicked(null), [task?.id])

  const choose = async (reason: PostponeReason): Promise<void> => {
    if (!task) return
    setPicked(reason)
    try {
      await window.api.tasks.setPostponeReason(task.id, reason)
    } catch {
      // nedenin kaydedilmemesi akışı bozmasın
    }
  }

  const advice = POSTPONE_REASONS.find((r) => r.id === picked)
  const act = (fn: () => void): void => {
    closePostponed()
    fn()
  }

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && closePostponed()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" /> Bunu {task?.postponeCount} kez erteledin
          </DialogTitle>
          <DialogDescription className="truncate">{task?.title} · Sorun değil; nedenini bilmek bir sonraki adımı kolaylaştırır.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1.5">
          {POSTPONE_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => choose(r.id)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                picked === r.id ? 'border-ring/50 bg-primary/15 text-primary' : 'hover:border-ring/40'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {advice && task && (
          <div className="rounded-xl border border-primary/25 bg-primary/[0.07] p-3">
            <div className="text-[13px]">{advice.advice}</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {picked === 'too_big' && (
                <Button size="sm" className="border-0 bg-brand text-white" onClick={() => act(() => askBreakdown(task))}>
                  Parçalara böl
                </Button>
              )}
              {picked === 'unclear' && (
                <Button size="sm" className="border-0 bg-brand text-white" onClick={() => act(() => openTask(task))}>
                  İlk adımı yaz
                </Button>
              )}
              {picked === 'no_time' && (
                <Button size="sm" className="border-0 bg-brand text-white" onClick={() => act(() => navigate('/planner'))}>
                  Takvimde yer aç
                </Button>
              )}
              {picked === 'boring' && (
                <Button
                  size="sm"
                  className="border-0 bg-brand text-white"
                  onClick={() =>
                    act(async () => {
                      await startFocus(task.id)
                      navigate('/focus')
                    })
                  }
                >
                  25 dk odak başlat
                </Button>
              )}
              {picked === 'not_important' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      act(async () => {
                        await window.api.tasks.update(task.id, { priority: 1 })
                        await window.api.tasks.move(task.id, { to: 'later' })
                        refreshAll()
                        toast('Sonraya bırakıldı, önceliği düşürüldü')
                      })
                    }
                  >
                    Önceliği düşür, sonraya bırak
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => act(() => deleteTask(task))}>
                    Sil
                  </Button>
                </>
              )}
              {picked === 'other' && (
                <Button size="sm" variant="outline" onClick={() => act(() => openTask(task))}>
                  Not ekle
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={closePostponed}>
                Tamam
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
