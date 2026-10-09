import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Coffee, Footprints, Pause, Play, Settings2, SkipForward, Target, Timer, X } from 'lucide-react'
import { toast } from 'sonner'
import { today } from '../../../shared/dates'
import { rankTasks } from '../../../shared/planning'
import { PHASE_LABEL, cycleIndex, isRunning } from '../../../shared/pomodoro'
import type { Task } from '../../../shared/types'
import { Page, EmptyState } from '@/components/common/Page'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData, useNow } from '@/lib/data'
import { formatClock, formatMinutes } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { cn } from '@/lib/utils'
import { openFirstStep } from '@/lib/actions'
import { usePomodoro } from '@/lib/pomodoro'
import { sget, sset } from '@/lib/storage'
import { filterByContext } from '../../../shared/context'

type FocusMode = 'free' | 'pomodoro'

function useFocusMode(): [FocusMode, (m: FocusMode) => void] {
  const [mode, setMode] = React.useState<FocusMode>(() => (sget('focusMode') as FocusMode) || 'pomodoro')
  const set = (m: FocusMode): void => {
    setMode(m)
    sset('focusMode', m)
  }
  return [mode, set]
}

const GRADIENTS = {
  focus: ['var(--brand-teal)', 'var(--brand-blue)', 'var(--brand-violet)'],
  rest: ['oklch(0.82 0.13 160)', 'oklch(0.76 0.14 182)', 'oklch(0.72 0.12 210)']
}

function Ring({
  progress,
  over,
  tone = 'focus',
  size = 320,
  children
}: {
  progress: number
  over?: boolean
  tone?: keyof typeof GRADIENTS
  size?: number
  children: React.ReactNode
}): React.JSX.Element {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const id = `ring-${tone}`
  const [a, b, d] = GRADIENTS[tone]
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} />
            <stop offset="50%" stopColor={b} />
            <stop offset="100%" stopColor={d} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--warning)' : `url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          style={{ filter: `drop-shadow(0 0 14px color-mix(in oklch, ${b} 55%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

function ModeSwitch({ mode, onChange }: { mode: FocusMode; onChange: (m: FocusMode) => void }): React.JSX.Element {
  return (
    <div className="no-drag flex rounded-xl border bg-card/60 p-1">
      {(
        [
          ['pomodoro', 'Pomodoro', Timer],
          ['free', 'Serbest', Target]
        ] as const
      ).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
            mode === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="size-3.5" /> {label}
        </button>
      ))}
    </div>
  )
}

function TaskHeader({ task }: { task: Task }): React.JSX.Element {
  const { areas } = useApp()
  const area = findArea(areas, task.areaId)
  return (
    <>
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted-foreground">
        {area && <span className="size-2 rounded-full" style={{ background: areaColor(area) }} />}
        {area?.name ?? 'Odak'}
      </div>
      <h1 className="mt-2 max-w-2xl px-6 text-center text-[28px] font-semibold tracking-tight">{task.title}</h1>
      {task.firstStep && (
        <button
          type="button"
          disabled={!task.firstStepTarget}
          onClick={() => openFirstStep(task)}
          className="mt-3 flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[13px] enabled:hover:bg-primary/15"
        >
          <Footprints className="size-3.5 text-primary" /> {task.firstStep}
          {task.firstStepTarget && <span className="text-primary">↗</span>}
        </button>
      )}
    </>
  )
}

async function completeTask(task: Task, minutes: number): Promise<void> {
  await window.api.tasks.complete(task.id)
  refreshAll()
  const actual = task.actualMin + minutes
  const diff = task.estimateMin ? actual - task.estimateMin : null
  toast.success('Tamamlandı', {
    description:
      diff === null
        ? `${formatMinutes(actual) || '1dk'} çalıştın.`
        : `Tahmin ${formatMinutes(task.estimateMin)} · Gerçek ${formatMinutes(actual) || '0dk'} (${diff >= 0 ? '+' : '−'}${formatMinutes(Math.abs(diff)) || '0dk'})`
  })
}

/** Pomodoro ekranı: odak / mola fazları, tur noktaları */
function PomodoroView({ mode, setMode }: { mode: FocusMode; setMode: (m: FocusMode) => void }): React.JSX.Element {
  const p = usePomodoro()
  const { stopFocus } = useApp()
  const navigate = useNavigate()
  const s = p.state!
  const task = useData(() => window.api.tasks.get(s.taskId), [s.taskId]).data
  const isWork = s.phase === 'work'
  const running = isRunning(s)
  const progress = 1 - p.remaining / s.durationSec
  const cycle = cycleIndex(s, p.config)
  const doneInSeries = s.completedWork % p.config.cyclesBeforeLong

  const finish = async (): Promise<void> => {
    if (!task) return
    const minutes = isWork && running ? await stopFocus() : 0
    await p.stop()
    await completeTask(task, minutes)
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.1] blur-3xl transition-colors duration-1000"
        style={{ background: isWork ? 'var(--brand-blue)' : 'oklch(0.76 0.14 175)' }}
      />
      <div className="drag absolute inset-x-0 top-0 flex h-16 items-start justify-center pt-4">
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>

      {task && <TaskHeader task={task} />}

      <div className="mt-6 flex items-center gap-3">
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wider',
            isWork ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success'
          )}
        >
          {isWork ? <Target className="size-3.5" /> : <Coffee className="size-3.5" />}
          {PHASE_LABEL[s.phase]}
        </span>
        <span className="flex items-center gap-1.5" aria-label={`${cycle}. tur, ${p.config.cyclesBeforeLong} turda bir uzun mola`}>
          {Array.from({ length: p.config.cyclesBeforeLong }, (_, i) => {
            const filled = i < doneInSeries || (!isWork && doneInSeries === 0 && s.completedWork > 0)
            const current = isWork && i === doneInSeries
            return (
              <span
                key={i}
                className={cn(
                  'size-2.5 rounded-full transition-all',
                  filled ? 'bg-brand' : current ? 'bg-primary/40 ring-2 ring-primary/50' : 'bg-muted'
                )}
              />
            )
          })}
        </span>
      </div>

      <div className="mt-5">
        <Ring progress={s.waiting ? 0 : progress} tone={isWork ? 'focus' : 'rest'}>
          <div>
            <div className={cn('text-[60px] font-semibold tracking-tight tabular', !running && !s.waiting && 'opacity-60')}>{formatClock(p.remaining)}</div>
            <div className="text-[13px] text-muted-foreground">
              {s.waiting ? (isWork ? 'Mola bitti' : 'Odak turu bitti') : !running ? 'Duraklatıldı' : isWork ? `${cycle}. tur · ${s.completedWork} tamamlandı` : p.tip}
            </div>
          </div>
        </Ring>
      </div>

      <div className="mt-7 flex items-center gap-3">
        {s.waiting ? (
          <Button size="lg" className="h-12 gap-2 rounded-xl border-0 bg-brand px-8 font-semibold text-white glow" onClick={p.resume}>
            <Play className="size-4 fill-white" /> {isWork ? 'Odağa başla' : 'Molayı başlat'}
          </Button>
        ) : running ? (
          <Button variant="outline" size="lg" className="h-12 gap-2 rounded-xl px-6" onClick={p.pause}>
            <Pause className="size-4" /> Duraklat
          </Button>
        ) : (
          <Button size="lg" className="h-12 gap-2 rounded-xl border-0 bg-brand px-6 font-semibold text-white glow" onClick={p.resume}>
            <Play className="size-4 fill-white" /> Devam
          </Button>
        )}
        <Button variant="outline" size="lg" className="h-12 gap-2 rounded-xl px-5" onClick={p.skip} title={isWork ? 'Molaya geç' : 'Molayı atla'}>
          <SkipForward className="size-4" /> {isWork ? 'Molaya geç' : 'Molayı atla'}
        </Button>
        <Button size="lg" variant="outline" className="h-12 gap-2 rounded-xl px-5" onClick={finish} disabled={!task}>
          <Check className="size-4" /> Görevi bitir
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-4 text-[12px] text-muted-foreground">
        <span>
          {p.config.workMin} dk odak · {p.config.shortMin} dk mola · her {p.config.cyclesBeforeLong} turda {p.config.longMin} dk
        </span>
        <button type="button" onClick={() => navigate('/settings#pomodoro')} className="flex items-center gap-1 hover:text-foreground">
          <Settings2 className="size-3.5" /> Ayarla
        </button>
        <button type="button" onClick={p.stop} className="flex items-center gap-1 hover:text-foreground">
          <X className="size-3.5" /> Pomodoro'yu kapat
        </button>
      </div>
    </div>
  )
}

export function PageFocus(): React.JSX.Element {
  const { session, sessionTask, startFocus, stopFocus, areas, currentContext } = useApp()
  const pomodoro = usePomodoro()
  const [mode, setMode] = useFocusMode()
  const navigate = useNavigate()
  const now = useNow(1000)
  const todayStr = today()
  const tasks = useData(() => window.api.tasks.list({ view: 'today' })).data ?? []
  const energy = useData(() => window.api.stats.day()).data?.energy ?? null
  const candidates = rankTasks(filterByContext(tasks, currentContext), { date: todayStr, minuteOfDay: now.getHours() * 60 + now.getMinutes(), activeTaskId: null }, energy).slice(0, 6)

  if (pomodoro.state) return <PomodoroView mode={mode} setMode={setMode} />

  const begin = async (t: Task): Promise<void> => {
    if (t.firstStepTarget) await openFirstStep(t)
    if (mode === 'pomodoro') await pomodoro.start(t.id)
    else await startFocus(t.id)
  }

  if (!session || !sessionTask) {
    return (
      <Page title="Focus" subtitle="Tek bir işe odaklan" actions={<ModeSwitch mode={mode} onChange={setMode} />}>
        {candidates.length === 0 ? (
          <EmptyState icon={Target} title="Odaklanacak bir görev yok." description="Bugüne bir görev ekleyince burada görünür." action={<Button onClick={() => navigate('/today')}>Bugün'e git</Button>} />
        ) : (
          <div className="mx-auto max-w-xl">
            <p className="mb-4 text-[13.5px] text-muted-foreground">
              {mode === 'pomodoro'
                ? `Pomodoro: ${pomodoro.config.workMin} dk odak, ${pomodoro.config.shortMin} dk mola. Hangisiyle başlıyoruz?`
                : 'Serbest odak: süre sınırı yok, tahminle karşılaştırılır. Hangisiyle başlıyoruz?'}
            </p>
            <div className="flex flex-col gap-2">
              {candidates.map((t, i) => {
                const area = findArea(areas, t.areaId)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => begin(t)}
                    className={cn(
                      'group flex items-center gap-4 rounded-2xl border bg-card/60 px-5 py-4 text-left transition-all hover:border-ring/50 hover:bg-card',
                      i === 0 && 'surface-hero'
                    )}
                  >
                    <span className={cn('grid size-10 place-items-center rounded-xl', i === 0 ? 'bg-brand text-white glow' : 'bg-muted text-muted-foreground group-hover:text-primary')}>
                      {mode === 'pomodoro' ? <Timer className="size-4" /> : <Play className="size-4 fill-current" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">{t.title}</div>
                      <div className="mt-0.5 flex items-center gap-3 text-[12.5px] text-muted-foreground">
                        {t.estimateMin ? (
                          <span>
                            {formatMinutes(t.estimateMin)}
                            {mode === 'pomodoro' && ` ≈ ${Math.max(1, Math.round(t.estimateMin / pomodoro.config.workMin))} tur`}
                          </span>
                        ) : null}
                        {area && (
                          <span className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full" style={{ background: areaColor(area) }} /> {area.name}
                          </span>
                        )}
                      </div>
                    </div>
                    {i === 0 && <span className="text-[11.5px] font-medium text-primary">Önerilen</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Page>
    )
  }

  // Serbest odak (süre sınırı yok)
  const elapsed = (now.getTime() - new Date(session.startedAt).getTime()) / 1000
  const total = elapsed + sessionTask.actualMin * 60
  const est = (sessionTask.estimateMin ?? 0) * 60
  const over = est > 0 && total > est

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-[0.08] blur-3xl" />
      <div className="drag absolute inset-x-0 top-0 flex h-16 items-start justify-center pt-4">
        <ModeSwitch
          mode="free"
          onChange={(m) => {
            setMode(m)
            // Çalışan serbest odağı aynı görevle Pomodoro'ya çevir
            if (m === 'pomodoro') pomodoro.start(sessionTask.id)
          }}
        />
      </div>
      <TaskHeader task={sessionTask} />
      <div className="mt-8">
        <Ring progress={est ? total / est : (elapsed % 3600) / 3600} over={over}>
          <div>
            <div className="text-[56px] font-semibold tracking-tight tabular">{formatClock(total)}</div>
            <div className={cn('text-[13px] text-muted-foreground', over && 'text-warning')}>
              {est
                ? over
                  ? `Tahmin ${formatMinutes(Math.round((total - est) / 60)) || '1dk'} aşıldı`
                  : `${formatMinutes(Math.ceil((est - total) / 60)) || '1dk'} kaldı · tahmin ${formatMinutes(sessionTask.estimateMin)}`
                : 'Tahmini süre yok'}
            </div>
          </div>
        </Ring>
      </div>
      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" size="lg" className="h-12 gap-2 rounded-xl px-6" onClick={() => stopFocus()}>
          <Pause className="size-4" /> Duraklat
        </Button>
        <Button
          size="lg"
          className="h-12 gap-2 rounded-xl border-0 bg-brand px-8 font-semibold text-white glow"
          onClick={async () => completeTask(sessionTask, await stopFocus())}
        >
          <Check className="size-4" /> Bitir
        </Button>
      </div>
      <p className="mt-6 text-[12px] text-muted-foreground">Duraklatınca süre kaydedilir; görev listede kalır.</p>
    </div>
  )
}
