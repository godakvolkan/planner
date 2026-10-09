import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarClock, Check, Inbox, Layers, Scale, Star, Sun, Sunrise, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { MoveTarget, Task } from '../../../shared/types'
import { today } from '../../../shared/dates'
import { Meter } from '@/components/common/Page'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData } from '@/lib/data'
import { formatDayTitle, formatMinutes, formatMinutesOrZero, greeting, relativeDay } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { cn } from '@/lib/utils'

const STEPS = [
  { title: 'Dünden kalanlar', icon: Layers, hint: 'Her biri için karar ver. Hepsini bugüne almak zorunda değilsin.' },
  { title: 'Inbox', icon: Inbox, hint: 'Aklına gelenlerden bugüne ya da bu haftaya alınacak olanlar.' },
  { title: "Bugünün 3'ü", icon: Star, hint: 'Gün bittiğinde "bunları yaptım" demek istediğin en fazla 3 iş.' }
]

function ChoiceRow({
  task,
  choices,
  onDone
}: {
  task: Task
  choices: { label: string; icon: React.ElementType; target: MoveTarget | 'delete' }[]
  onDone: (taskId: number, label: string) => void
}): React.JSX.Element {
  const { areas } = useApp()
  const area = findArea(areas, task.areaId)
  const todayStr = today()
  const act = async (target: MoveTarget | 'delete', label: string): Promise<void> => {
    try {
      if (target === 'delete') await window.api.tasks.delete(task.id)
      else await window.api.tasks.move(task.id, target)
      onDone(task.id, label)
    } catch {
      toast.error('Yapılamadı. Tekrar dene.')
    }
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
      <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: areaColor(area) }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{task.title}</div>
        <div className="text-[12px] text-muted-foreground">
          {[task.scheduledDate && `${relativeDay(task.scheduledDate, todayStr)} planlıydı`, task.estimateMin && formatMinutes(task.estimateMin), area?.name, task.postponeCount > 1 && `${task.postponeCount} kez ertelendi`]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {choices.map((c) => (
          <Button
            key={c.label}
            variant="outline"
            size="sm"
            className={cn('h-8 gap-1.5', c.target === 'delete' && 'text-muted-foreground hover:text-destructive')}
            onClick={() => act(c.target, c.label)}
          >
            <c.icon className="size-3.5" /> {c.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** Sabah planlaması: en fazla 2 dakika, her adım atlanabilir */
export function PageMorning(): React.JSX.Element {
  const navigate = useNavigate()
  const { settings } = useApp()
  const todayStr = today()
  const [step, setStep] = React.useState(0)
  const [handled, setHandled] = React.useState<Record<number, string>>({})
  const todays = useData(() => window.api.tasks.list({ view: 'today' })).data ?? []
  const inbox = useData(() => window.api.tasks.list({ view: 'inbox' })).data ?? []
  const summary = useData(() => window.api.stats.day()).data
  const note = useData(() => window.api.rituals.previousNote()).data

  const overdue = todays.filter((t) => (t.status === 'planned' || t.status === 'active') && t.scheduledDate && t.scheduledDate < todayStr)
  const open = todays.filter((t) => (t.status === 'planned' || t.status === 'active') && t.scheduledDate === todayStr)
  const top3 = open.filter((t) => t.top3Date === todayStr)
  const capacity = summary?.capacityMin ?? 300
  const remaining = summary?.remainingMin ?? 0

  const done = (id: number, label: string): void => {
    setHandled((h) => ({ ...h, [id]: label }))
    refreshAll()
  }

  const finish = async (): Promise<void> => {
    try {
      await window.api.rituals.completeMorning(todayStr)
      refreshAll()
      toast.success('Gün planlandı', { description: top3.length ? `Bugünün 3'ü: ${top3.map((t) => t.title).join(', ')}` : 'İyi çalışmalar.' })
      navigate('/')
    } catch {
      toast.error('Kaydedilemedi.')
    }
  }

  const toggleTop3 = async (t: Task): Promise<void> => {
    try {
      await window.api.tasks.setTop3(t.id, t.top3Date === todayStr ? null : todayStr)
      refreshAll()
    } catch {
      toast("Bugünün 3'ü dolu", { description: 'Önce birini çıkar.' })
    }
  }

  const pendingOverdue = overdue.filter((t) => !handled[t.id])
  const inboxSlice = inbox.filter((t) => !handled[t.id]).slice(0, 5)
  const current = STEPS[step]

  return (
    <div className="relative flex h-full flex-col overflow-y-auto">
      <div className="drag absolute inset-x-0 top-0 h-10" />
      <div className="mx-auto w-full max-w-[760px] px-8 pb-12 pt-12 max-md:px-5 max-sm:px-4 max-sm:pt-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white glow">
            <Sunrise className="size-5" />
          </span>
          <div>
            <div className="text-[12.5px] font-medium text-muted-foreground">{formatDayTitle(todayStr)}</div>
            <h1 className="text-[26px] font-semibold tracking-tight">
              {greeting()}
              {settings.userName ? `, ${settings.userName}` : ''}. Bugünü planlayalım.
            </h1>
          </div>
          <Button variant="ghost" className="ml-auto gap-1.5 text-muted-foreground" onClick={() => navigate('/')}>
            <X className="size-4" /> Şimdi değil
          </Button>
        </div>

        {note && (
          <div className="mt-5 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3 text-[13.5px]">
            <span className="text-muted-foreground">{relativeDay(note.date, todayStr)} kendine bıraktığın not: </span>
            <span className="font-medium">{note.note}</span>
          </div>
        )}

        {/* Adım göstergesi */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                i === step ? 'border-ring/50 bg-primary/10 text-primary' : i < step ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <span className={cn('grid size-6 place-items-center rounded-full text-[11px] font-semibold', i < step ? 'bg-brand text-white' : i === step ? 'bg-primary/20' : 'bg-muted')}>
                {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {s.title}
            </button>
          ))}
        </div>

        <div className="surface mt-4 p-6">
          <div className="flex items-center gap-2">
            <current.icon className="size-4 text-primary" />
            <h2 className="text-[16px] font-semibold">{current.title}</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{current.hint}</p>

          <div className="mt-4 flex flex-col gap-2">
            {step === 0 &&
              (pendingOverdue.length === 0 ? (
                <div className="rounded-xl bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">Dünden kalan iş yok. Temiz başlangıç.</div>
              ) : (
                <>
                  {pendingOverdue.map((t) => (
                    <ChoiceRow
                      key={t.id}
                      task={t}
                      onDone={done}
                      choices={[
                        { label: 'Bugün', icon: Sun, target: { to: 'today' } },
                        { label: 'Yarın', icon: ArrowRight, target: { to: 'tomorrow' } },
                        { label: 'Inbox', icon: Inbox, target: { to: 'inbox' } },
                        { label: 'Sil', icon: Trash2, target: 'delete' }
                      ]}
                    />
                  ))}
                  {pendingOverdue.length > 1 && (
                    <Button
                      variant="ghost"
                      className="self-start"
                      onClick={async () => {
                        for (const t of pendingOverdue) await window.api.tasks.move(t.id, { to: 'today' })
                        pendingOverdue.forEach((t) => done(t.id, 'Bugün'))
                      }}
                    >
                      Hepsini bugüne al
                    </Button>
                  )}
                </>
              ))}

            {step === 1 &&
              (inboxSlice.length === 0 ? (
                <div className="rounded-xl bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">Inbox temiz.</div>
              ) : (
                <>
                  {inboxSlice.map((t) => (
                    <ChoiceRow
                      key={t.id}
                      task={t}
                      onDone={done}
                      choices={[
                        { label: 'Bugün', icon: Sun, target: { to: 'today' } },
                        { label: 'Bu hafta', icon: CalendarClock, target: { to: 'thisWeek' } },
                        { label: 'Sonra', icon: Layers, target: { to: 'later' } },
                        { label: 'Sil', icon: Trash2, target: 'delete' }
                      ]}
                    />
                  ))}
                  {inbox.length > 5 && <div className="text-[12px] text-muted-foreground">Inbox'ta {inbox.length - 5} görev daha var; onlar beklesin.</div>}
                </>
              ))}

            {step === 2 && (
              <>
                {open.length === 0 ? (
                  <div className="rounded-xl bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">Bugüne planlı görev yok. Önceki adımlardan birkaçını bugüne alabilirsin.</div>
                ) : (
                  open.map((t) => {
                    const on = t.top3Date === todayStr
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTop3(t)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                          on ? 'border-warning/40 bg-warning/10' : 'bg-card/60 hover:border-ring/40'
                        )}
                      >
                        <Star className={cn('size-4 shrink-0', on ? 'fill-warning text-warning' : 'text-muted-foreground')} />
                        <span className="flex-1 truncate text-[14px] font-medium">{t.title}</span>
                        <span className="text-[12px] tabular text-muted-foreground">{formatMinutes(t.estimateMin)}</span>
                      </button>
                    )
                  })
                )}
                <div className="mt-3 rounded-xl border px-4 py-3">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="text-muted-foreground">Bugünün yükü</span>
                    <span className={cn('font-medium tabular', remaining > capacity && 'text-warning')}>
                      {formatMinutesOrZero(remaining)} / {formatMinutes(capacity) || '0dk'}
                    </span>
                  </div>
                  <Meter value={remaining} max={capacity} className="mt-2" />
                  {remaining > capacity && (
                    <div className="mt-2 flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="text-warning">Plan kapasiteyi {formatMinutes(remaining - capacity)} aşıyor.</span>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/?balance=1')}>
                        <Scale className="size-3.5" /> Günü dengele
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Geri
          </Button>
          {step < STEPS.length - 1 ? (
            <Button className="gap-2 border-0 bg-brand px-6 font-semibold text-white" onClick={() => setStep((s) => s + 1)}>
              Devam <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button className="gap-2 border-0 bg-brand px-6 font-semibold text-white glow" onClick={finish}>
              <Check className="size-4" /> Planlamayı bitir
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
