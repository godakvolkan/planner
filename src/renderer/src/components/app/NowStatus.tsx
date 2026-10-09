import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Coffee, GraduationCap, MapPin, Target } from 'lucide-react'
import { today } from '../../../../shared/dates'
import { inLabel, nowStatus, toMinutes } from '../../../../shared/schedule'
import { useApp } from '@/lib/app-context'
import { useNow } from '@/lib/data'
import { usePomodoro } from '@/lib/pomodoro'
import { PHASE_LABEL } from '../../../../shared/pomodoro'
import { formatClock } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { cn } from '@/lib/utils'

/** "Şu an neredeyim, sırada ne var?" — her ekranda kenar çubuğunda görünür */
export function NowStatus({ compact }: { compact?: boolean }): React.JSX.Element {
  const { events, todayTasks, areas, session, sessionTask, askFreeTime } = useApp()
  const now = useNow(30_000)
  const pomodoro = usePomodoro()
  const navigate = useNavigate()
  const minute = now.getHours() * 60 + now.getMinutes()
  const status = nowStatus(events, todayTasks, today(), minute)

  // Pomodoro molası: "şu an moladasın"
  if (pomodoro.state && pomodoro.state.phase !== 'work' && !pomodoro.state.waiting && status.kind !== 'event') {
    if (compact) {
      return (
        <button type="button" onClick={() => navigate('/focus')} title="Moladasın" className="grid w-full place-items-center rounded-xl border bg-background/40 p-2">
          <Coffee className="size-4 text-success" />
        </button>
      )
    }
    return (
      <button type="button" onClick={() => navigate('/focus')} className="w-full rounded-xl border border-success/30 bg-success/[0.07] p-3 text-left transition-colors hover:border-success/50">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-success">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Şu an · Moladasın
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold">
          <Coffee className="size-3.5 shrink-0 text-success" /> {PHASE_LABEL[pomodoro.state.phase]} · <span className="tabular">{formatClock(pomodoro.remaining)}</span>
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{pomodoro.tip}</div>
      </button>
    )
  }

  // Çalışan bir odak oturumu her şeyden önce gelir: "şu an bunun üstündesin"
  if (session && sessionTask && status.kind !== 'event') {
    const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(session.startedAt)) / 60000)) + sessionTask.actualMin
    const focusArea = findArea(areas, sessionTask.areaId)
    const color = areaColor(focusArea)
    if (compact) {
      return (
        <button type="button" onClick={() => navigate('/focus')} title={`Odaktasın: ${sessionTask.title}`} className="grid w-full place-items-center rounded-xl border bg-background/40 p-2">
          <Target className="size-4 text-primary" />
        </button>
      )
    }
    return (
      <button type="button" onClick={() => navigate('/focus')} className="w-full rounded-xl border border-ring/30 bg-primary/[0.06] p-3 text-left transition-colors hover:border-ring/50">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Şu an · Odaktasın
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold">
          <Target className="size-3.5 shrink-0" style={{ color }} />
          <span className="truncate">{sessionTask.title}</span>
        </div>
        <div className="mt-0.5 text-[11.5px] tabular text-muted-foreground">
          {elapsed} dk{sessionTask.estimateMin ? ` / ${sessionTask.estimateMin} dk tahmin` : ''}
        </div>
        {status.next && (
          <div className="mt-2.5 border-t border-border/60 pt-2 text-[11.5px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Sırada:</span> {status.next.start} {status.next.title}
            <span className="ml-1 text-primary">({inLabel(status.next.inMin)})</span>
          </div>
        )}
      </button>
    )
  }

  const Icon = status.kind === 'event' ? GraduationCap : status.kind === 'task' ? Target : Coffee
  const area = status.kind !== 'free' ? findArea(areas, status.areaId) : undefined
  const color = status.kind === 'free' ? 'var(--muted-foreground)' : areaColor(area)
  const label =
    status.kind === 'event' ? 'Derstesin' : status.kind === 'task' ? (session ? 'Odaktasın' : 'Planlı blok') : 'Boştasın'

  const progress =
    status.kind === 'event' ? (minute - toMinutes(status.start)) / Math.max(1, toMinutes(status.until) - toMinutes(status.start)) : 0

  return (
    <button
      type="button"
      onClick={() => {
        if (status.kind === 'free') askFreeTime(status.next ? Math.min(240, status.next.inMin) : 60)
        else navigate(status.kind === 'event' ? '/schedule' : '/')
      }}
      title="Şu an ve sırada"
      className={cn(
        'group w-full rounded-xl border bg-background/40 p-3 text-left transition-colors hover:border-ring/40',
        compact && 'grid place-items-center p-2'
      )}
    >
      {compact ? (
        <Icon className="size-4" style={{ color }} />
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="relative flex size-2">
              {status.kind !== 'free' && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: color }} />}
              <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
            </span>
            Şu an · {label}
          </div>
          {status.kind === 'free' ? (
            <>
              <div className="mt-1 text-[13px] font-medium">
                {status.freeUntil ? `${status.freeUntil}'e kadar boş zaman` : 'Bugün başka plan yok'}
              </div>
              <div className="mt-0.5 text-[11.5px] text-primary">Ne yapsam? →</div>
            </>
          ) : (
            <>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold">
                <Icon className="size-3.5 shrink-0" style={{ color }} />
                <span className="truncate">{status.title}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                {status.kind === 'event' && status.location && (
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{status.location}</span>
                  </span>
                )}
                <span className="shrink-0 tabular">{status.until}'e kadar</span>
              </div>
              {status.kind === 'event' && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, progress * 100)}%`, background: color }} />
                </div>
              )}
            </>
          )}
          {status.next && (
            <div className="mt-2.5 border-t border-border/60 pt-2 text-[11.5px] text-muted-foreground">
              <span className="font-medium text-foreground/80">Sırada:</span> {status.next.start} {status.next.title}
              {status.next.location ? ` · ${status.next.location}` : ''}
              <span className="ml-1 text-primary">({inLabel(status.next.inMin)})</span>
            </div>
          )}
        </>
      )}
    </button>
  )
}
