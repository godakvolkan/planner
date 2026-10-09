import * as React from 'react'
import { ChevronLeft, ChevronRight, GripVertical, Inbox, Layers, CalendarClock, Check, GraduationCap, MapPin, ListTodo, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { addDays, isoWeekday, parseDate, today, weekStart } from '../../../shared/dates'
import type { FixedEvent, Task } from '../../../shared/types'
import { busyMinutes, eventsOn } from '../../../shared/schedule'
import { DEFAULT_ESTIMATE } from '../../../shared/planning'
import { Page } from '@/components/common/Page'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { refreshAll, useData, useNow } from '@/lib/data'
import { formatMinutes, formatShortDate, weekdayShort } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { cn } from '@/lib/utils'
import { useNarrow } from '@/lib/layout'

const HOUR_PX = 56
const SNAP = 15
/** Çakışan blokların kademe kayması */
const CASCADE_PX = 14
const DRAG_TYPE = 'application/x-cc-task'

const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const toTime = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

type ViewMode = 'week' | 'day'

/** Çakışan blokları yan yana dizer: her bloğa sütun (lane) ve o gruptaki sütun sayısı verir */
function layoutBlocks(tasks: Task[]): Map<number, { lane: number; lanes: number }> {
  const items = tasks
    .map((t) => ({ t, start: toMin(t.scheduledTime!), end: toMin(t.scheduledTime!) + Math.max(t.estimateMin ?? DEFAULT_ESTIMATE, SNAP) }))
    .sort((a, b) => a.start - b.start || b.end - a.end)
  const result = new Map<number, { lane: number; lanes: number }>()
  let group: typeof items = []
  let groupEnd = -1
  const flush = (): void => {
    const laneEnds: number[] = []
    const lanesOf = new Map<number, number>()
    for (const it of group) {
      let lane = laneEnds.findIndex((end) => end <= it.start)
      if (lane === -1) lane = laneEnds.push(0) - 1
      laneEnds[lane] = it.end
      lanesOf.set(it.t.id, lane)
    }
    for (const it of group) result.set(it.t.id, { lane: lanesOf.get(it.t.id)!, lanes: laneEnds.length })
    group = []
  }
  for (const it of items) {
    if (group.length && it.start >= groupEnd) flush()
    group.push(it)
    groupEnd = Math.max(groupEnd, it.end)
  }
  flush()
  return result
}

async function schedule(taskId: number, date: string, time: string | null, clash?: FixedEvent): Promise<void> {
  try {
    if (clash) toast.warning(`Bu saatte ${clash.title} var`, { description: `${clash.startTime}–${clash.endTime}${clash.location ? ' · ' + clash.location : ''}. Yine de planlandı.` })
    await window.api.tasks.update(taskId, { status: 'planned', scheduledDate: date, scheduledTime: time, plannedWeek: null })
    refreshAll()
  } catch {
    toast.error('Planlanamadı. Tekrar dene.')
  }
}

function PanelTask({ task }: { task: Task }): React.JSX.Element {
  const { areas, openTask } = useApp()
  const area = findArea(areas, task.areaId)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, String(task.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => openTask(task)}
      className="group flex cursor-grab items-center gap-2 rounded-lg border bg-card/70 px-2.5 py-2 text-[12.5px] transition-colors hover:border-ring/40 active:cursor-grabbing"
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: areaColor(area) }} />
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      {task.estimateMin ? <span className="shrink-0 text-[11px] tabular text-muted-foreground">{formatMinutes(task.estimateMin)}</span> : null}
    </div>
  )
}

function Block({
  task,
  dayStartMin,
  dayEndMin,
  lane,
  lanes
}: {
  task: Task
  dayStartMin: number
  dayEndMin: number
  lane: number
  lanes: number
}): React.JSX.Element {
  const { areas, openTask } = useApp()
  const area = findArea(areas, task.areaId)
  const start = toMin(task.scheduledTime!)
  const [estimate, setEstimate] = React.useState(task.estimateMin ?? DEFAULT_ESTIMATE)
  const [resizing, setResizing] = React.useState(false)
  const justResized = React.useRef(0)
  React.useEffect(() => setEstimate(task.estimateMin ?? DEFAULT_ESTIMATE), [task.estimateMin])
  // Görünür aralığın sonunda kesilir; taşmaz
  const height = (Math.min(Math.max(estimate, SNAP), Math.max(SNAP, dayEndMin - start)) / 60) * HOUR_PX
  const done = task.status === 'done'
  const color = areaColor(area)

  const onResizeStart = (e: React.PointerEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    setResizing(true)
    const startY = e.clientY
    const initial = estimate
    let latest = initial
    const move = (ev: PointerEvent): void => {
      const delta = ((ev.clientY - startY) / HOUR_PX) * 60
      latest = Math.max(SNAP, Math.round((initial + delta) / SNAP) * SNAP)
      setEstimate(latest)
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setResizing(false)
      justResized.current = Date.now()
      if (latest !== initial) window.api.tasks.update(task.id, { estimateMin: latest }).then(refreshAll, () => toast.error('Süre kaydedilemedi.'))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      draggable={!resizing}
      onDragStart={(e) => {
        if (resizing) return e.preventDefault()
        e.dataTransfer.setData(DRAG_TYPE, String(task.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={() => {
        // Boyutlandırmanın bitişindeki tıklama düzenleyiciyi açmasın
        if (Date.now() - justResized.current < 300) return
        openTask(task)
      }}
      className={cn(
        'group absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-[12px] shadow-sm transition-shadow hover:z-10 hover:shadow-lg',
        done && 'opacity-55',
        resizing && 'z-20 shadow-lg ring-2 ring-ring/50'
      )}
      style={{
        top: ((start - dayStartMin) / 60) * HOUR_PX + 1,
        height: height - 2,
        left: lanes > 1 ? 3 + lane * CASCADE_PX : 3,
        right: 3,
        zIndex: lanes > 1 ? lane + 1 : undefined,
        boxShadow: lanes > 1 && lane > 0 ? '0 0 0 1.5px var(--card), 0 4px 12px -4px rgb(0 0 0 / 0.4)' : undefined,
        borderLeftColor: color,
        background: `color-mix(in oklch, ${color} 20%, var(--card))`
      }}
    >
      <div className={cn('flex items-center gap-1 font-semibold leading-tight', done && 'line-through')}>
        {done && <Check className="size-3 shrink-0" />}
        <span className="truncate">{task.title}</span>
      </div>
      {height > 34 && (
        <div className="mt-0.5 truncate text-[11px] tabular text-foreground/70">
          {task.scheduledTime} – {toTime(start + estimate)}
        </div>
      )}
      {resizing && (
        <div className="absolute bottom-1 right-1.5 rounded bg-background/80 px-1 text-[10.5px] font-semibold tabular">{formatMinutes(estimate)}</div>
      )}
      <div
        onPointerDown={onResizeStart}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        title="Süreyi değiştirmek için sürükle"
        className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
        style={{ background: `linear-gradient(transparent, color-mix(in oklch, ${color} 40%, transparent))` }}
      />
    </div>
  )
}

function EventBlock({ event, dayStartMin }: { event: FixedEvent; dayStartMin: number }): React.JSX.Element {
  const { areas } = useApp()
  const color = areaColor(findArea(areas, event.areaId))
  const start = toMin(event.startTime)
  const end = toMin(event.endTime)
  return (
    <div
      className="pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-lg border border-dashed px-2 py-1 text-[11.5px]"
      style={{
        top: ((start - dayStartMin) / 60) * HOUR_PX + 1,
        height: ((end - start) / 60) * HOUR_PX - 2,
        borderColor: `color-mix(in oklch, ${color} 55%, transparent)`,
        background: `repeating-linear-gradient(135deg, color-mix(in oklch, ${color} 14%, transparent) 0 6px, transparent 6px 12px)`
      }}
    >
      <div className="flex items-center gap-1 font-semibold text-foreground/80">
        <GraduationCap className="size-3 shrink-0" style={{ color }} />
        <span className="truncate">{event.title}</span>
      </div>
      {event.location && (
        <div className="flex items-center gap-1 truncate text-[10.5px] text-muted-foreground">
          <MapPin className="size-2.5 shrink-0" /> {event.location}
        </div>
      )}
    </div>
  )
}

function DayColumn({
  date,
  tasks,
  events,
  dayStartMin,
  dayEndMin,
  workStart,
  workEnd,
  isToday,
  nowMin
}: {
  date: string
  tasks: Task[]
  events: FixedEvent[]
  /** Görünür aralık (görevlere ve derslere göre genişler) */
  dayStartMin: number
  dayEndMin: number
  /** Ayarlardaki gün başlangıcı / bitişi; dışı soluk gösterilir */
  workStart: number
  workEnd: number
  isToday: boolean
  nowMin: number
}): React.JSX.Element {
  const { openTask } = useApp()
  const [hover, setHover] = React.useState<number | null>(null)
  const timed = tasks.filter((t) => t.scheduledTime)
  const layout = React.useMemo(() => layoutBlocks(timed), [timed])

  const minuteFromY = (clientY: number, el: HTMLElement): number => {
    const rect = el.getBoundingClientRect()
    const raw = dayStartMin + ((clientY - rect.top) / HOUR_PX) * 60
    return Math.min(dayEndMin - SNAP, Math.max(dayStartMin, Math.floor(raw / SNAP) * SNAP))
  }

  const createAt = async (minute: number): Promise<void> => {
    try {
      const t = await window.api.tasks.create({ title: 'Yeni görev', scheduledDate: date, scheduledTime: toTime(minute), estimateMin: 30, status: 'planned' })
      refreshAll()
      openTask(t)
    } catch {
      toast.error('Görev eklenemedi.')
    }
  }

  const minuteAt = (e: React.DragEvent): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = dayStartMin + ((e.clientY - rect.top) / HOUR_PX) * 60
    return Math.min(dayEndMin - SNAP, Math.max(dayStartMin, Math.floor(raw / SNAP) * SNAP))
  }

  return (
    <div
      className={cn('relative border-l border-border/60', isToday && 'bg-primary/[0.035]')}
      style={{ height: ((dayEndMin - dayStartMin) / 60) * HOUR_PX }}
      title="Çift tıkla: bu saate görev ekle"
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget) return
        createAt(minuteFromY(e.clientY, e.currentTarget))
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        setHover(minuteAt(e))
      }}
      onDragLeave={() => setHover(null)}
      onDrop={(e) => {
        const id = Number(e.dataTransfer.getData(DRAG_TYPE))
        const minute = minuteAt(e)
        setHover(null)
        const clash = events.find((ev) => minute >= toMin(ev.startTime) && minute < toMin(ev.endTime))
        if (id) schedule(id, date, toTime(minute), clash)
      }}
    >
      {/* Çalışma saatleri dışı */}
      {workStart > dayStartMin && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-muted/35" style={{ height: ((workStart - dayStartMin) / 60) * HOUR_PX }} />
      )}
      {workEnd < dayEndMin && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-muted/35" style={{ height: ((dayEndMin - workEnd) / 60) * HOUR_PX }} />
      )}
      {hover !== null && (
        <div
          className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed border-primary/60 bg-primary/10 text-[11px] font-semibold text-primary"
          style={{ top: ((hover - dayStartMin) / 60) * HOUR_PX, height: (30 / 60) * HOUR_PX }}
        >
          <span className="px-1.5">{toTime(hover)}</span>
        </div>
      )}
      {events.map((ev) => (
        <EventBlock key={ev.id} event={ev} dayStartMin={dayStartMin} />
      ))}
      {timed.map((t) => {
        const l = layout.get(t.id) ?? { lane: 0, lanes: 1 }
        return <Block key={t.id} task={t} dayStartMin={dayStartMin} dayEndMin={dayEndMin} lane={l.lane} lanes={l.lanes} />
      })}
      {isToday && nowMin >= dayStartMin && nowMin <= dayEndMin && (
        <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: ((nowMin - dayStartMin) / 60) * HOUR_PX }}>
          <div className="relative h-[2px] bg-brand">
            <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-brand-teal" />
          </div>
        </div>
      )}
    </div>
  )
}

/** Hafta görünümünde dar pencerede gün sütununun en küçük genişliği */
const DAY_MIN_PX = 88

export function PagePlanner(): React.JSX.Element {
  const { settings, events } = useApp()
  const now = useNow()
  const todayStr = today()
  // Çok dar pencerede gün görünümüyle başla
  const [mode, setMode] = React.useState<ViewMode>(() => (window.innerWidth < 640 ? 'day' : 'week'))
  // Dar pencerede Planlanacaklar paneli yan sütun değil, açılır katman
  const narrow = useNarrow(1200)
  const [panelOpen, setPanelOpen] = React.useState(false)
  React.useEffect(() => setPanelOpen(false), [narrow])
  const [anchor, setAnchor] = React.useState(todayStr)
  const [expanded, setExpanded] = React.useState(false)
  const days = mode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i)) : [anchor]
  const from = days[0]
  const to = days[days.length - 1]

  const tasks = useData(() => window.api.tasks.list({ view: 'range', from, to }), [from, to]).data ?? []
  const capacities = useData(() => window.api.capacity.list()).data ?? []
  const inbox = useData(() => window.api.tasks.list({ view: 'inbox' })).data ?? []
  const week = useData(() => window.api.tasks.list({ view: 'week', date: anchor }), [anchor]).data ?? []
  const later = useData(() => window.api.tasks.list({ view: 'later' })).data ?? []
  const weekUndated = week.filter((t) => !t.scheduledDate)

  const workStart = toMin(settings.dayStart)
  const workEnd = toMin(settings.dayEnd)
  // Görünür aralık: ayarlardaki gün + bu günlerdeki en erken / en geç görev ve ders (tam saate yuvarlanır)
  const inView = tasks.filter((t) => t.scheduledTime && days.includes(t.scheduledDate!) && t.parentId === null)
  const viewEvents = days.flatMap((d) => eventsOn(events, d))
  const dayStartMin = Math.max(
    0,
    Math.floor(Math.min(workStart, ...inView.map((t) => toMin(t.scheduledTime!)), ...viewEvents.map((e) => toMin(e.startTime))) / 60) * 60
  )
  const dayEndMin = Math.min(
    24 * 60,
    Math.ceil(
      Math.max(
        workEnd,
        ...inView.map((t) => toMin(t.scheduledTime!) + Math.max(t.estimateMin ?? DEFAULT_ESTIMATE, SNAP)),
        ...viewEvents.map((e) => toMin(e.endTime))
      ) / 60
    ) * 60
  )
  const hours = Array.from({ length: Math.ceil((dayEndMin - dayStartMin) / 60) }, (_, i) => dayStartMin + i * 60)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Açılışta şu anki saate kaydır; daha erken saatli bir görev varsa onu da göster
  const scrolled = React.useRef(false)
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el || scrolled.current || !tasks.length) return
    const starts = tasks.filter((t) => t.scheduledTime && t.status !== 'done').map((t) => toMin(t.scheduledTime!))
    const target = Math.min(nowMin, ...starts) - 45
    el.scrollTop = Math.max(0, ((target - dayStartMin) / 60) * HOUR_PX)
    // Hafta yatay kayıyorsa bugünün sütununu ortala
    const col = el.querySelector<HTMLElement>(`[data-day="${todayStr}"]`)
    if (col && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, col.offsetLeft - 56 - (el.clientWidth - 56 - col.offsetWidth) / 2)
    scrolled.current = true
  }, [tasks, nowMin, dayStartMin, todayStr])

  const step = mode === 'week' ? 7 : 1
  const rangeLabel =
    mode === 'week' ? `${formatShortDate(from)} – ${formatShortDate(to)}` : parseDate(anchor).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  const byDay = (d: string): Task[] => tasks.filter((t) => t.scheduledDate === d && t.parentId === null)
  const capacityOf = (d: string): number => {
    const base = capacities.find((c) => c.weekday === isoWeekday(d))?.minutes ?? 300
    return Math.max(0, base - busyMinutes(events, d))
  }

  const panelGroups: { title: string; icon: React.ElementType; list: Task[] }[] = [
    { title: 'Bu hafta', icon: CalendarClock, list: weekUndated },
    { title: 'Inbox', icon: Inbox, list: inbox },
    { title: 'Sonra', icon: Layers, list: later }
  ]

  return (
    <Page
      wide
      title="Planlayıcı"
      subtitle={rangeLabel}
      className="pb-6"
      actions={
        <>
          {narrow && (
            <Button variant="outline" className="gap-2" aria-expanded={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
              <ListTodo className="size-4" /> Planlanacaklar
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular">{weekUndated.length + inbox.length + later.length}</span>
            </Button>
          )}
          <div className="flex rounded-xl border bg-card/60 p-1">
            {(['day', 'week'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[13px] font-medium',
                  mode === m ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'day' ? 'Gün' : 'Hafta'}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-xl border bg-card/60 p-1">
            <Button variant="ghost" size="icon-sm" aria-label="Önceki" onClick={() => setAnchor(addDays(anchor, -step))}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(todayStr)}>
              Bugün
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Sonraki" onClick={() => setAnchor(addDays(anchor, step))}>
              <ChevronRight />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-2 print:hidden ml-1" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Çıktı / PDF
          </Button>
        </>
      }
    >
      <div className="relative flex h-full min-h-0 gap-4">
        {/* Planlanacaklar paneli: geniş pencerede sütun, dar pencerede takvimin üstünde açılır katman */}
        {narrow && panelOpen && <div className="absolute inset-0 z-40 rounded-2xl bg-background/40 backdrop-blur-[2px] print:hidden" onClick={() => setPanelOpen(false)} />}
        <aside
          className={cn(
            'surface flex w-[250px] shrink-0 flex-col overflow-hidden print:hidden',
            narrow && 'absolute inset-y-0 left-0 z-50 w-[min(300px,100%)] shadow-2xl',
            narrow && !panelOpen && 'hidden'
          )}
          // Sürükleme başlayınca katmanı kapat ki görev takvime bırakılabilsin
          onDragStart={() => narrow && setTimeout(() => setPanelOpen(false), 0)}
        >
          <div className="border-b px-4 py-3">
            <div className="text-[13px] font-semibold">Planlanacaklar</div>
            <div className="text-[11.5px] text-muted-foreground">Takvime sürükle bırak</div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-3">
            {panelGroups.map((g) => (
              <div key={g.title}>
                <div className="section-label mb-1.5 flex items-center gap-1.5 px-1">
                  <g.icon className="size-3" /> {g.title}
                  <span className="ml-auto tabular">{g.list.length}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {g.list.length === 0 && <div className="px-1 text-[12px] text-muted-foreground/70">Boş</div>}
                  {g.list.map((t) => (
                    <PanelTask key={t.id} task={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Takvim */}
        <div className="surface flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Tek kaydırma alanı: dar pencerede hafta yatay kayar, gün başlıkları ve saatler sabit kalır */}
          <div ref={scrollRef} data-hscroll className="relative min-h-0 flex-1 overflow-auto">
          <div style={{ minWidth: 56 + days.length * (days.length > 1 ? DAY_MIN_PX : 0) }}>
          {/* Gün başlıkları + tüm gün satırı */}
          <div className="sticky top-0 z-30 grid border-b bg-card" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div className="sticky left-0 z-10 bg-card" />
            {days.map((d) => {
              const list = byDay(d)
              const planned = list.filter((t) => t.status !== 'done').reduce((a, t) => a + (t.estimateMin ?? 0), 0)
              const cap = capacityOf(d)
              const isToday = d === todayStr
              return (
                <div key={d} data-day={d} className={cn('border-l border-border/60 px-2.5 pb-2 pt-3', isToday && 'bg-primary/[0.035]')}>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-[11px] font-semibold uppercase tracking-wider', isToday ? 'text-primary' : 'text-muted-foreground')}>
                      {weekdayShort(d)}
                    </span>
                    <span
                      className={cn(
                        'grid size-6 place-items-center rounded-full text-[13px] font-semibold tabular',
                        isToday && 'bg-brand text-white'
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" title={`${formatMinutes(planned) || '0dk'} / ${formatMinutes(cap)}`}>
                    <div className={cn('h-full', planned > cap ? 'bg-warning' : 'bg-brand')} style={{ width: `${Math.min(100, cap ? (planned / cap) * 100 : 0)}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="sticky left-0 z-10 flex items-center justify-end bg-card pr-2 text-[10px] text-muted-foreground">tüm gün</div>
            {days.map((d) => (
              <div
                key={d}
                className="min-h-9 space-y-1 border-l border-t border-border/60 p-1"
                onDragOver={(e) => e.dataTransfer.types.includes(DRAG_TYPE) && e.preventDefault()}
                onDrop={(e) => {
                  const id = Number(e.dataTransfer.getData(DRAG_TYPE))
                  if (id) schedule(id, d, null)
                }}
              >
                <AllDayList tasks={byDay(d).filter((t) => !t.scheduledTime)} expanded={expanded} onToggle={() => setExpanded((x) => !x)} />
              </div>
            ))}
          </div>

          {/* Saat ızgarası */}
          <div className="relative">
            <div className="grid pb-3 pt-2.5" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
              <div className="sticky left-0 z-20 bg-card">
                {hours.map((h) => (
                  <div key={h} className="relative text-right" style={{ height: HOUR_PX }}>
                    <span className={cn('absolute -top-2 right-2 text-[10.5px] tabular', h < workStart || h >= workEnd ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
                      {toTime(h)}
                    </span>
                  </div>
                ))}
                <span className="absolute -bottom-2 right-2 text-[10.5px] tabular text-muted-foreground/50">{dayEndMin === 1440 ? '24:00' : toTime(dayEndMin)}</span>
              </div>
              {days.map((d) => (
                <div key={d} className="relative">
                  {/* saat çizgileri */}
                  <div className="pointer-events-none absolute inset-0">
                    {[...hours, dayEndMin].map((h, i) => (
                      <div key={h} className="border-t border-border/50" style={{ position: 'absolute', top: i * HOUR_PX, left: 0, right: 0 }} />
                    ))}
                  </div>
                  <DayColumn
                    date={d}
                    tasks={byDay(d)}
                    events={eventsOn(events, d)}
                    dayStartMin={dayStartMin}
                    dayEndMin={dayEndMin}
                    workStart={workStart}
                    workEnd={workEnd}
                    isToday={d === todayStr}
                    nowMin={nowMin}
                  />
                </div>
              ))}
            </div>
          </div>
          </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

const ALL_DAY_LIMIT = 3

function AllDayList({ tasks, expanded, onToggle }: { tasks: Task[]; expanded: boolean; onToggle: () => void }): React.JSX.Element {
  const shown = expanded ? tasks : tasks.slice(0, ALL_DAY_LIMIT)
  return (
    <>
      {shown.map((t) => (
        <AllDayChip key={t.id} task={t} />
      ))}
      {tasks.length > ALL_DAY_LIMIT && (
        <button type="button" onClick={onToggle} className="w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/10">
          {expanded ? 'Daha az' : `+${tasks.length - ALL_DAY_LIMIT} daha`}
        </button>
      )}
    </>
  )
}

function AllDayChip({ task }: { task: Task }): React.JSX.Element {
  const { areas, openTask } = useApp()
  const color = areaColor(findArea(areas, task.areaId))
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, String(task.id))}
      onClick={() => openTask(task)}
      title={task.title}
      className={cn(
        'cursor-grab truncate rounded-md border-l-2 px-1.5 py-0.5 text-[11.5px] font-medium',
        task.status === 'done' && 'line-through opacity-55'
      )}
      style={{ borderLeftColor: color, background: `color-mix(in oklch, ${color} 16%, var(--card))` }}
    >
      {task.title}
    </div>
  )
}
