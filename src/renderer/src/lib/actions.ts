import { toast } from 'sonner'
import type { MoveTarget, Task, TaskInput } from '../../../shared/types'
import { refreshAll } from './data'

const fail = (msg: string) => (): void => {
  toast.error(msg)
}

/** Görevin taşınmadan önceki planını geri yazar */
function restorePlan(task: Task): Promise<Task> {
  return window.api.tasks.update(task.id, {
    status: task.status,
    scheduledDate: task.scheduledDate,
    scheduledTime: task.scheduledTime,
    plannedWeek: task.plannedWeek
  })
}

const MOVE_LABEL: Record<MoveTarget['to'], string> = {
  today: 'Bugüne alındı',
  tomorrow: 'Yarına taşındı',
  thisWeek: 'Bu haftaya alındı',
  later: 'Sonraya bırakıldı',
  inbox: "Inbox'a geri gönderildi",
  date: 'Tarih değişti'
}

/** Bu sayıda ertelemeden sonra "Bunu neden yapmıyorum?" sorulur */
export const POSTPONE_ASK_AT = 3

export async function moveTask(task: Task, target: MoveTarget): Promise<void> {
  try {
    const moved = await window.api.tasks.move(task.id, target)
    refreshAll()
    if (moved.postponeCount >= POSTPONE_ASK_AT && moved.postponeCount > task.postponeCount) {
      window.dispatchEvent(new CustomEvent('cc:postponed', { detail: moved }))
    }
    toast(MOVE_LABEL[target.to], {
      description: task.title,
      action: { label: 'Geri al', onClick: () => restorePlan(task).then(refreshAll, fail('Geri alınamadı.')) }
    })
  } catch {
    toast.error('Görev taşınamadı. Tekrar dene.')
  }
}

export async function toggleDone(task: Task): Promise<void> {
  const done = task.status === 'done'
  try {
    if (done) await window.api.tasks.uncomplete(task.id)
    else await window.api.tasks.complete(task.id)
    refreshAll()
    if (!done) {
      toast.success('Tamamlandı', {
        description: task.title,
        action: { label: 'Geri al', onClick: () => window.api.tasks.uncomplete(task.id).then(refreshAll, fail('Geri alınamadı.')) }
      })
    }
  } catch {
    toast.error('Görev güncellenemedi.')
  }
}

const toInput = (t: Task, parentId: number | null = t.parentId): TaskInput => ({
  title: t.title,
  notes: t.notes,
  areaId: t.areaId,
  status: t.status,
  priority: t.priority,
  deadline: t.deadline,
  scheduledDate: t.scheduledDate,
  scheduledTime: t.scheduledTime,
  plannedWeek: t.plannedWeek,
  estimateMin: t.estimateMin,
  firstStep: t.firstStep,
  firstStepTarget: t.firstStepTarget,
  firstStepType: t.firstStepType,
  parentId,
  waitingFor: t.waitingFor,
  followUpDate: t.followUpDate,
  tagIds: t.tags.map((x) => x.id)
})

export async function deleteTask(task: Task): Promise<void> {
  try {
    const subtasks = await window.api.tasks.list({ parentId: task.id })
    await window.api.tasks.delete(task.id)
    refreshAll()
    toast('Görev silindi', {
      description: task.title,
      action: {
        label: 'Geri al',
        onClick: async () => {
          try {
            const restored = await window.api.tasks.create(toInput(task))
            for (const s of subtasks) {
              const sub = await window.api.tasks.create(toInput(s, restored.id))
              if (s.status === 'done') await window.api.tasks.complete(sub.id)
            }
            if (task.status === 'done') await window.api.tasks.complete(restored.id)
            refreshAll()
          } catch {
            toast.error('Geri alınamadı.')
          }
        }
      }
    })
  } catch {
    toast.error('Görev silinemedi.')
  }
}

export async function toggleTop3(task: Task, date: string): Promise<void> {
  try {
    await window.api.tasks.setTop3(task.id, task.top3Date === date ? null : date)
    refreshAll()
  } catch {
    toast("Bugünün 3'ü dolu", { description: 'Önce birini listeden çıkar.' })
  }
}

/** İlk adımın hedefini (dosya / klasör / bağlantı) açar */
export async function openFirstStep(task: Task): Promise<boolean> {
  if (!task.firstStepTarget) return false
  try {
    const r = await window.api.tasks.openFirstStep(task.id)
    if (!r.ok) toast.error(r.error ?? 'Açılamadı.', { description: task.firstStepTarget })
    return r.ok
  } catch {
    toast.error('Açılamadı.')
    return false
  }
}
