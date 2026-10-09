import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, CircleCheckBig, Clock, Flag, Footprints, GraduationCap, Hourglass, MapPin, Moon, Scissors, Play, Scale, Sparkles, StickyNote, Star, Sun, Sunrise, Timer, X } from 'lucide-react'
import { inLabel, nowStatus } from '../../../shared/schedule'
import { isLarge } from '../../../shared/v2'
import { CONTEXTS, filterByContext } from '../../../shared/context'
import type { Energy } from '../../../shared/types'
import { toast } from 'sonner'
import { today } from '../../../shared/dates'
import { rankTasks, suggestBalance } from '../../../shared/planning'
import type { Task } from '../../../shared/types'
import { Page, Meter, Section, EmptyState } from '@/components/common/Page'
import { CapacityPicker } from '@/components/common/CapacityPicker'
import { TaskRow } from '@/components/task/TaskRow'
import { QuickAdd } from '@/components/task/QuickAdd'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData, useNow } from '@/lib/data'
import { formatDayTitle, formatMinutes, formatMinutesOrZero, greeting, relativeDay } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { moveTask, openFirstStep, toggleDone } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { sget, sset } from '@/lib/storage'

const ENERGY: { id: Energy; label: string; emoji: string }[] = [
  { id: 'low', label: 'Düşük', emoji: '😴' },
  { id: 'medium', label: 'Normal', emoji: '🙂' },
  { id: 'high', label: 'Yüksek', emoji: '🔥' }
]

/** "Neredesin?" — seçilen bağlamda yapılamayacak işler önerilerden çıkar */
function ContextRow({ hidden }: { hidden: number }): React.JSX.Element {
  const { currentContext, setCurrentContext } = useApp()
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <span>Neredesin?</span>
      <button
        type="button"
        onClick={() => setCurrentContext(null)}
        className={cn('rounded-full border px-2.5 py-0.5 transition-colors', !currentContext ? 'border-ring/50 bg-primary/15 font-medium text-primary' : 'hover:text-foreground')}
      >
        Her yer
      </button>
      {CONTEXTS.map((c) => (
        <button
          key={c.id}
          type="button"
          title={c.label}
          onClick={() => setCurrentContext(currentContext === c.id ? null : c.id)}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors',
            currentContext === c.id ? 'border-ring/50 bg-primary/15 font-medium text-primary' : 'hover:border-ring/40 hover:text-foreground'
          )}
        >
          <span>{c.emoji}</span>
          {currentContext === c.id && c.label}
        </button>
      ))}
      {hidden > 0 && <span className="ml-1 text-[11.5px]">· {hidden} iş başka yerde yapılabilir, gizlendi</span>}
    </div>
  )
}

/** "Bugün nasılsın?" — sıralamayı enerjiye göre hafifçe değiştirir */
function EnergyRow({ energy }: { energy: Energy | null }): React.JSX.Element {
  const set = async (e: Energy): Promise<void> => {
    try {
      await window.api.stats.setEnergy(today(), energy === e ? null : e)
      refreshAll()
      if (energy !== e) {
        toast(e === 'low' ? 'Küçük ve kolay işler öne alındı' : e === 'high' ? 'Büyük ve zor işler öne alındı' : 'Normal sıralama', {
          description: e === 'low' ? 'Büyük işleri zorlamadan, bitirilebilecek olanlarla ilerle.' : undefined
        })
      }
    } catch {
      toast.error('Kaydedilemedi.')
    }
  }
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
      <span>Bugün nasılsın?</span>
      {ENERGY.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => set(e.id)}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2.5 py-0.5 transition-colors',
            energy === e.id ? 'border-ring/50 bg-primary/15 font-medium text-primary' : 'hover:border-ring/40 hover:text-foreground'
          )}
        >
          <span>{e.emoji}</span> {e.label}
        </button>
      ))}
    </div>
  )
}

function NowCard({ task }: { task: Task }): React.JSX.Element {
  const { areas, startFocus, session, openTask, askBreakdown } = useApp()
  const navigate = useNavigate()
  const area = findArea(areas, task.areaId)
  const running = session?.taskId === task.id
  const todayStr = today()

  return (
    <div className="surface-hero overflow-hidden p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand opacity-[0.12] blur-3xl" />
      <div className="flex items-center gap-2">
        <span className="section-label !text-primary">Şu anda</span>
        {task.top3Date === todayStr && (
          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
            <Star className="size-3 fill-warning" /> Bugünün 3'ü
          </span>
        )}
      </div>

      <button type="button" onClick={() => openTask(task)} className="mt-3 block text-left">
        <h2 className="text-[30px] font-semibold leading-tight tracking-tight">{task.title}</h2>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
        {task.estimateMin ? (
          <span className="flex items-center gap-1.5">
            <Timer className="size-4" /> {formatMinutes(task.estimateMin)} tahmini
          </span>
        ) : null}
        {task.scheduledTime && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" /> {task.scheduledTime}
          </span>
        )}
        {area && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: areaColor(area) }} /> {area.name}
          </span>
        )}
        {task.deadline && (
          <span className={cn('flex items-center gap-1.5', task.deadline <= todayStr && 'text-priority-high')}>
            <Flag className="size-4" /> Teslim {relativeDay(task.deadline, todayStr).toLocaleLowerCase('tr-TR')}
          </span>
        )}
        {task.actualMin > 0 && (
          <span className="flex items-center gap-1.5">
            <CircleCheckBig className="size-4" /> {formatMinutes(task.actualMin)} çalışıldı
          </span>
        )}
      </div>

      {task.firstStep && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 py-3">
          <Footprints className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 text-[13.5px]">
            <span className="text-muted-foreground">İlk adım: </span>
            <span className="font-medium">{task.firstStep}</span>
          </div>
          {task.firstStepTarget && (
            <button
              type="button"
              onClick={() => openFirstStep(task)}
              className="shrink-0 rounded-lg px-2 py-1 text-[12.5px] font-medium text-primary hover:bg-primary/10"
            >
              {task.firstStepType === 'url' ? 'Bağlantıyı aç' : task.firstStepType === 'folder' ? 'Klasörü aç' : 'Dosyayı aç'} ↗
            </button>
          )}
        </div>
      )}

      {isLarge(task) && (
        <button
          type="button"
          onClick={() => askBreakdown(task)}
          className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/30 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-primary/[0.06]"
        >
          <Scissors className="size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Bu görev büyük görünüyor.</span>{' '}
            <span className="text-muted-foreground">{task.postponeCount >= 2 ? `${task.postponeCount} kez ertelendi. ` : ''}Parçalara bölelim mi?</span>
          </span>
        </button>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          className="h-11 gap-2 rounded-xl border-0 bg-brand px-6 text-[14.5px] font-semibold text-white glow hover:opacity-95"
          onClick={async () => {
            if (!running) {
              if (task.firstStepTarget) await openFirstStep(task)
              await startFocus(task.id)
            }
            navigate('/focus')
          }}
        >
          <Play className="size-4 fill-white" /> {running ? 'Odağa dön' : 'Başla'}
        </Button>
        <Button variant="ghost" size="lg" className="h-11 gap-2 rounded-xl" onClick={() => toggleDone(task)}>
          <Check className="size-4" /> Tamamla
        </Button>
        <Button variant="ghost" size="lg" className="h-11 gap-2 rounded-xl text-muted-foreground" onClick={() => moveTask(task, { to: 'tomorrow' })}>
          <ArrowRight className="size-4" /> Yarına
        </Button>
      </div>
    </div>
  )
}

function BalanceDialog({
  open,
  onOpenChange,
  tasks,
  capacity
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tasks: Task[]
  capacity: number
}): React.JSX.Element {
  const { session } = useApp()
  const now = useNow()
  const suggestions = React.useMemo(
    () =>
      suggestBalance(tasks, capacity, {
        date: today(),
        minuteOfDay: now.getHours() * 60 + now.getMinutes(),
        activeTaskId: session?.taskId ?? null
      }),
    [tasks, capacity, now, session]
  )
  const [picked, setPicked] = React.useState<Set<number>>(new Set())
  React.useEffect(() => setPicked(new Set(suggestions.map((s) => s.task.id))), [suggestions])
  const freed = suggestions.filter((s) => picked.has(s.task.id)).reduce((a, s) => a + (s.task.estimateMin ?? 30), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" /> Günü dengele
          </DialogTitle>
          <DialogDescription>
            Bugünün 3'ü, saatli bloklar ve teslimi yakın işler korunur. Seçtiklerin yarına taşınır.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {suggestions.length === 0 && (
            <div className="rounded-xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
              Taşınabilecek bir iş yok. Korunan işler kapasiteyi aşıyor; birinin süresini kısaltmayı dene.
            </div>
          )}
          {suggestions.map(({ task, reason }) => {
            const on = picked.has(task.id)
            return (
              <button
                type="button"
                key={task.id}
                onClick={() =>
                  setPicked((p) => {
                    const n = new Set(p)
                    if (on) n.delete(task.id)
                    else n.add(task.id)
                    return n
                  })
                }
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  on ? 'border-ring/40 bg-primary/[0.07]' : 'opacity-70 hover:opacity-100'
                )}
              >
                <span className={cn('grid size-4 place-items-center rounded border', on && 'border-transparent bg-brand text-white')}>
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate text-[13.5px] font-medium">{task.title}</span>
                <span className="text-[12px] text-muted-foreground">{reason}</span>
                <span className="w-12 text-right text-[12px] tabular text-muted-foreground">{formatMinutes(task.estimateMin ?? 30)}</span>
              </button>
            )
          })}
        </div>
        <DialogFooter className="items-center">
          {freed > 0 && <span className="mr-auto text-[12.5px] text-muted-foreground">{formatMinutes(freed)} boşalacak</span>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={picked.size === 0}
            className="border-0 bg-brand text-white"
            onClick={async () => {
              const moved = suggestions.filter((s) => picked.has(s.task.id)).map((s) => s.task)
              try {
                for (const t of moved) await window.api.tasks.move(t.id, { to: 'tomorrow' })
                refreshAll()
                onOpenChange(false)
                toast.success(`${moved.length} görev yarına taşındı`, {
                  action: {
                    label: 'Geri al',
                    onClick: async () => {
                      for (const t of moved) await window.api.tasks.update(t.id, { scheduledDate: t.scheduledDate, scheduledTime: t.scheduledTime })
                      refreshAll()
                    }
                  }
                })
              } catch {
                toast.error('Taşınamadı. Tekrar dene.')
              }
            }}
          >
            Yarına taşı
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const isDismissed = (kind: string, date: string): boolean => sget(`dismiss:${kind}:${date}`) === '1'

/** Sabah planlama ve akşam gün kapanışı davetleri: küçük, kapatılabilir, zorlamaz */
function RitualInvite(): React.JSX.Element | null {
  const { settings } = useApp()
  const navigate = useNavigate()
  const now = useNow()
  const date = today()
  const ritual = useData(() => window.api.rituals.get(date), [date]).data
  const [, force] = React.useReducer((x: number) => x + 1, 0)
  if (!settings.ritualsEnabled || !ritual) return null
  const minute = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = settings.dayStart.split(':').map(Number)
  const [eh, em] = settings.dayEnd.split(':').map(Number)
  const evening = minute >= eh * 60 + em - 60
  const kind = evening ? 'shutdown' : 'morning'
  if (evening ? ritual.shutdownDoneAt : ritual.morningDoneAt || minute < sh * 60 + sm - 120) return null
  if (isDismissed(kind, date)) return null
  const dismiss = (): void => {
    sset(`dismiss:${kind}:${date}`, '1')
    force()
  }
  const Icon = evening ? Moon : Sunrise
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] px-4 py-3">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{evening ? 'Günü kapatma zamanı' : 'Bugünü planlayalım mı?'}</div>
        <div className="text-[12.5px] text-muted-foreground">
          {evening ? 'Kalanları yerleştir, yarına tek satır not bırak. 1 dakika.' : "Dünden kalanlar, Inbox ve Bugünün 3'ü. 2 dakika."}
        </div>
      </div>
      <Button className="border-0 bg-brand font-semibold text-white" onClick={() => navigate(evening ? '/shutdown' : '/morning')}>
        {evening ? 'Günü kapat' : 'Planla'}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Şimdi değil" onClick={dismiss}>
        <X />
      </Button>
    </div>
  )
}

function YesterdayNote(): React.JSX.Element | null {
  const note = useData(() => window.api.rituals.previousNote()).data
  if (!note) return null
  return (
    <div className="mb-4 flex items-center gap-2 px-1 text-[13px]">
      <StickyNote className="size-4 shrink-0 text-primary" />
      <span className="text-muted-foreground">{relativeDay(note.date, today())} kendine not bıraktın:</span>
      <span className="truncate font-medium">{note.note}</span>
    </div>
  )
}

function ClassBanner(): React.JSX.Element | null {
  const { events, todayTasks, areas } = useApp()
  const now = useNow(30_000)
  const s = nowStatus(events, todayTasks, today(), now.getHours() * 60 + now.getMinutes())
  if (s.kind !== 'event') return null
  const color = areaColor(findArea(areas, s.areaId))
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: `color-mix(in oklch, ${color} 45%, transparent)`, background: `color-mix(in oklch, ${color} 10%, var(--card))` }}>
      <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: color }}>
        <GraduationCap className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Şu an derstesin</div>
        <div className="truncate text-[14.5px] font-semibold">
          {s.title}
          {s.location && (
            <span className="ml-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
              <MapPin className="size-3.5" /> {s.location}
            </span>
          )}
        </div>
      </div>
      <div className="text-right text-[12.5px]">
        <div className="font-semibold tabular">{s.until}'e kadar</div>
        {s.next && <div className="text-muted-foreground">Sonra: {s.next.title} ({inLabel(s.next.inMin)})</div>}
      </div>
    </div>
  )
}

export function PageNow(): React.JSX.Element {
  const { settings, session, askFreeTime, currentContext } = useApp()
  const now = useNow()
  const todayStr = today()
  const tasks = useData(() => window.api.tasks.list({ view: 'today' })).data
  const summary = useData(() => window.api.stats.day()).data
  const location = useLocation()
  const [balanceOpen, setBalanceOpen] = React.useState(() => new URLSearchParams(location.search).get('balance') === '1')

  const ranked = React.useMemo(
    () =>
      rankTasks(
        filterByContext(tasks ?? [], currentContext),
        {
          date: todayStr,
          minuteOfDay: now.getHours() * 60 + now.getMinutes(),
          activeTaskId: session?.taskId ?? null
        },
        summary?.energy ?? null
      ),
    [tasks, todayStr, now, session, summary?.energy, currentContext]
  )
  const [current, ...rest] = ranked
  const next = rest.slice(0, 3)
  const capacity = summary?.capacityMin ?? 300
  const remaining = summary?.remainingMin ?? 0
  const over = remaining - capacity
  const open = (tasks ?? []).filter((t) => t.status === 'planned' || t.status === 'active')

  return (
    <Page
      title={`${greeting(now)}${settings.userName ? `, ${settings.userName}` : ''}.`}
      subtitle={formatDayTitle(todayStr)}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-2 px-1">
            <EnergyRow energy={summary?.energy ?? null} />
            <ContextRow
              hidden={(tasks ?? []).filter((t) => (t.status === 'planned' || t.status === 'active') && !filterByContext([t], currentContext).length).length}
            />
          </div>
          <RitualInvite />
          <YesterdayNote />
          <ClassBanner />
          {current ? (
            <NowCard task={current} />
          ) : (
            <div className="surface-hero p-7">
              <span className="section-label !text-primary">Şu anda</span>
              <h2 className="mt-3 text-[26px] font-semibold tracking-tight">
                {tasks && tasks.length > 0 ? 'Bugünlük her şey tamam. 🎉' : 'Bugün için planlanmış bir şey yok.'}
              </h2>
              <p className="mt-2 text-[13.5px] text-muted-foreground">Aşağıya bir görev yaz, ya da Inbox'tan bir şey seç.</p>
            </div>
          )}

          <QuickAdd className="mt-5" defaultDate={todayStr} placeholder='Bugüne ekle…  örn. "15:00 toplantı hazırlığı 30 dk"' />

          {next.length > 0 && (
            <Section title="Sonra" count={rest.length}>
              <div className="flex flex-col gap-0.5">
                {next.map((t) => (
                  <TaskRow key={t.id} task={t} mode="today" />
                ))}
              </div>
            </Section>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="surface p-5">
            <div className="flex items-center justify-between">
              <span className="section-label">Bugün</span>
              <Sun className="size-4 text-muted-foreground" />
            </div>
            <CapacityPicker busyMin={summary?.busyMin ?? 0}>
              <button type="button" title="Bugün kaç saatin var? Değiştirmek için tıkla" className="mt-3 flex items-baseline gap-1.5 rounded-lg text-left hover:opacity-80">
                <span className="text-[28px] font-semibold tracking-tight tabular">{formatMinutesOrZero(remaining)}</span>
                <span className="text-[13px] text-muted-foreground underline decoration-dotted underline-offset-4">/ {formatMinutes(capacity) || '0dk'}</span>
              </button>
            </CapacityPicker>
            <Meter value={remaining} max={capacity} className="mt-3" />
            <div className="mt-2 text-[12.5px] text-muted-foreground">
              {summary ? `${summary.openCount} açık görev · ${summary.doneCount} tamamlandı` : '…'}
            </div>
            {over > 0 && (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3">
                <div className="text-[13px] font-medium text-warning">Planın {formatMinutes(over)} fazla.</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">Gün sıkışıyor; birkaç işi yarına almak ister misin?</div>
                <Button size="sm" variant="outline" className="mt-2.5 w-full gap-2" onClick={() => setBalanceOpen(true)}>
                  <Scale className="size-3.5" /> Günü dengele
                </Button>
              </div>
            )}
          </div>

          <button type="button" onClick={() => askFreeTime()} className="surface group p-5 text-left transition-colors hover:border-ring/40">
            <div className="flex items-center justify-between">
              <span className="section-label">Kaç dakikan var?</span>
              <Hourglass className="size-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <div className="mt-2 text-[12.5px] text-muted-foreground">Boş süreni söyle, o süreye sığan işleri seçeyim.</div>
            <div className="mt-3 flex gap-1.5">
              {[15, 30, 60].map((m) => (
                <span
                  key={m}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    askFreeTime(m)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && askFreeTime(m)}
                  className="rounded-lg border px-2.5 py-1 text-[12.5px] font-medium hover:border-ring/50 hover:text-primary"
                >
                  {formatMinutes(m)}
                </span>
              ))}
            </div>
          </button>

          <div className="surface p-5">
            <div className="flex items-center justify-between">
              <span className="section-label">Odak</span>
              <Sparkles className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-[28px] font-semibold tracking-tight tabular">{formatMinutesOrZero(summary?.actualMin ?? 0)}</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">bugün odaklanılan süre</div>
          </div>

          {ranked.length === 0 && tasks && tasks.length === 0 && (
            <EmptyState icon={Sun} title="Temiz bir gün" description="N tuşuyla hızlıca görev ekle." />
          )}
        </aside>
      </div>
      <BalanceDialog open={balanceOpen} onOpenChange={setBalanceOpen} tasks={open} capacity={capacity} />
    </Page>
  )
}
