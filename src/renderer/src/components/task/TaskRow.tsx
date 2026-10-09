import * as React from 'react'
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Flag,
  Hourglass,
  Inbox,
  ListChecks,
  MoreHorizontal,
  Play,
  Repeat,
  Scissors,
  Star,
  Sun,
  Trash2
} from 'lucide-react'
import type { Task } from '../../../../shared/types'
import { today } from '../../../../shared/dates'
import { cn } from '@/lib/utils'
import { formatMinutes, relativeDay } from '@/lib/format'
import { areaColor, findArea } from '@/lib/areas'
import { useApp } from '@/lib/app-context'
import { formatCombo, matchesCombo } from '../../../../shared/keybindings'
import { recording } from '@/lib/data'
import { contextMeta } from '../../../../shared/context'
import { deleteTask, moveTask, openFirstStep, toggleDone, toggleTop3 } from '@/lib/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type TaskRowMode = 'inbox' | 'today' | 'list'

interface TaskRowProps {
  task: Task
  mode?: TaskRowMode
  showDate?: boolean
  selected?: boolean
  onSelect?: () => void
  /** Alışkanlık zinciri (arka arkaya kaç kez yapıldı) */
  streak?: number
}

const PRIORITY: Record<number, { label: string; className: string } | null> = {
  1: null,
  2: { label: 'Orta', className: 'text-priority-medium' },
  3: { label: 'Yüksek', className: 'text-priority-high' },
  4: { label: 'Acil', className: 'text-priority-high' }
}

function IconAction({
  label,
  onClick,
  children,
  active
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className={cn(
            'grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            active && 'text-warning'
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function TaskRow({ task, mode = 'list', showDate, selected, onSelect, streak }: TaskRowProps): React.JSX.Element {
  const { areas, openTask, startFocus, session, askWaiting, askBreakdown, bindings: kb } = useApp()
  const area = findArea(areas, task.areaId)
  const done = task.status === 'done'
  const todayStr = today()
  const isTop3 = task.top3Date === todayStr
  const running = session?.taskId === task.id
  const overdue = !!task.scheduledDate && task.scheduledDate < todayStr && !done
  const priority = PRIORITY[task.priority]

  // Kısayollar Ayarlar → Klavye kısayolları'ndan değiştirilebilir
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.target !== e.currentTarget || recording.active) return
    const is = (combo: string): boolean => matchesCombo(e.nativeEvent, combo)
    if (is(kb.taskOpen)) openTask(task)
    else if (is(kb.taskComplete)) toggleDone(task)
    else if (is(kb.taskFocus)) startFocus(task.id)
    else if (is(kb.taskDelete)) deleteTask(task)
    else if (is(kb.taskWaiting) && task.status !== 'done') askWaiting(task)
    else if (is(kb.taskToday)) moveTask(task, { to: 'today' })
    else if (is(kb.taskTomorrow)) moveTask(task, { to: 'tomorrow' })
    else if (is(kb.taskWeek)) moveTask(task, { to: 'thisWeek' })
    else if (is(kb.taskLater)) moveTask(task, { to: 'later' })
    else if (is(kb.taskTop3) && task.status !== 'done') toggleTop3(task, todayStr)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-selected={selected || undefined}
      onClick={() => {
        onSelect?.()
        openTask(task)
      }}
      onKeyDown={onKeyDown}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all',
        'hover:border-border hover:bg-card/70 focus-visible:border-ring/50 focus-visible:bg-card/70 focus-visible:outline-none',
        'data-[selected]:border-ring/40 data-[selected]:bg-card',
        running && 'border-ring/40 bg-primary/5'
      )}
    >
      {/* Alan rengi şeridi */}
      <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full opacity-80" style={{ background: areaColor(area) }} />

      <button
        type="button"
        aria-label={done ? 'Tamamlanmadı olarak işaretle' : 'Tamamla'}
        onClick={(e) => {
          e.stopPropagation()
          toggleDone(task)
        }}
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition-all',
          done
            ? 'border-transparent bg-brand text-white'
            : 'border-muted-foreground/40 hover:border-primary hover:bg-primary/10'
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isTop3 && !done && <Star className="size-3.5 shrink-0 fill-warning text-warning" />}
          <span className={cn('truncate text-[14px] font-medium', done && 'text-muted-foreground line-through')}>{task.title}</span>
          {running && (
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Odakta
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          {task.scheduledTime && (
            <span className="flex items-center gap-1 tabular">
              <Clock className="size-3" /> {task.scheduledTime}
            </span>
          )}
          {task.estimateMin ? <span className="tabular">{formatMinutes(task.estimateMin)}</span> : null}
          {streak !== undefined && (
            <span className="flex items-center gap-0.5 font-medium text-warning tabular" title="Alışkanlık zinciri: arka arkaya kaç kez yapıldı">
              🔥 {streak}
            </span>
          )}
          {area && <span>{area.name}</span>}
          {task.context && <span title={contextMeta(task.context)?.label}>{contextMeta(task.context)?.emoji}</span>}
          {showDate && task.scheduledDate && (
            <span className={cn('flex items-center gap-1', overdue && 'text-priority-high')}>
              <CalendarDays className="size-3" /> {relativeDay(task.scheduledDate, todayStr)}
            </span>
          )}
          {!showDate && overdue && <span className="text-priority-high">{relativeDay(task.scheduledDate!, todayStr)} kaldı</span>}
          {task.deadline && (
            <span className={cn('flex items-center gap-1', task.deadline <= todayStr && !done && 'text-priority-high')}>
              <Flag className="size-3" /> {relativeDay(task.deadline, todayStr)}
            </span>
          )}
          {task.subtaskCount > 0 && (
            <span className="flex items-center gap-1 tabular">
              <ListChecks className="size-3" /> {task.subtaskDoneCount}/{task.subtaskCount}
            </span>
          )}
          {task.recurrenceId && <Repeat className="size-3" aria-label="Tekrarlayan" />}
          {task.status === 'waiting' && task.waitingFor && (
            <span className="flex items-center gap-1 text-primary">
              <Hourglass className="size-3" /> {task.waitingFor}
              {task.followUpDate && <span className="text-muted-foreground">· takip {relativeDay(task.followUpDate, todayStr).toLocaleLowerCase('tr-TR')}</span>}
            </span>
          )}
          {task.firstStepTarget && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openFirstStep(task)
              }}
              className="flex items-center gap-1 text-primary hover:underline"
              title={task.firstStepTarget}
            >
              <ExternalLink className="size-3" /> {task.firstStepType === 'url' ? 'Bağlantı' : task.firstStepType === 'folder' ? 'Klasör' : 'Dosya'}
            </button>
          )}
          {priority && <span className={cn('font-medium', priority.className)}>{priority.label}</span>}
        </div>
      </div>

      {/* Hover aksiyonları: fareyle de her şey yapılabilsin */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-focus-visible:opacity-100',
          isTop3 && mode === 'today' && 'opacity-100'
        )}
      >
        {mode === 'inbox' && (
          <>
            <IconAction label={`Bugün (${formatCombo(kb.taskToday)})`} onClick={() => moveTask(task, { to: 'today' })}>
              <Sun className="size-4" />
            </IconAction>
            <IconAction label={`Yarın (${formatCombo(kb.taskTomorrow)})`} onClick={() => moveTask(task, { to: 'tomorrow' })}>
              <ArrowRight className="size-4" />
            </IconAction>
            <IconAction label={`Bu hafta (${formatCombo(kb.taskWeek)})`} onClick={() => moveTask(task, { to: 'thisWeek' })}>
              <CalendarClock className="size-4" />
            </IconAction>
          </>
        )}
        {mode === 'today' && !done && (
          <IconAction label={`${isTop3 ? "Bugünün 3'ünden çıkar" : "Bugünün 3'üne ekle"} (${formatCombo(kb.taskTop3)})`} active={isTop3} onClick={() => toggleTop3(task, todayStr)}>
            <Star className={cn('size-4', isTop3 && 'fill-warning')} />
          </IconAction>
        )}
        {!done && (
          <IconAction label={`Odaklan (${formatCombo(kb.taskFocus)})`} onClick={() => startFocus(task.id)}>
            <Play className="size-4" />
          </IconAction>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Diğer"
              onClick={(e) => e.stopPropagation()}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => moveTask(task, { to: 'today' })}>
              <Sun /> Bugün <DropdownMenuShortcut>{formatCombo(kb.taskToday)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => moveTask(task, { to: 'tomorrow' })}>
              <ArrowRight /> Yarın <DropdownMenuShortcut>{formatCombo(kb.taskTomorrow)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => moveTask(task, { to: 'thisWeek' })}>
              <CalendarClock /> Bu hafta <DropdownMenuShortcut>{formatCombo(kb.taskWeek)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => moveTask(task, { to: 'later' })}>
              <MoreHorizontal /> Sonra <DropdownMenuShortcut>{formatCombo(kb.taskLater)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            {task.status !== 'inbox' && (
              <DropdownMenuItem onSelect={() => moveTask(task, { to: 'inbox' })}>
                <Inbox /> Inbox'a gönder
              </DropdownMenuItem>
            )}
            {task.status !== 'done' && task.subtaskCount === 0 && task.parentId === null && (
              <DropdownMenuItem onSelect={() => askBreakdown(task)}>
                <Scissors /> Parçalara böl
              </DropdownMenuItem>
            )}
            {task.status !== 'done' && task.status !== 'waiting' && (
              <DropdownMenuItem onSelect={() => askWaiting(task)}>
                <Hourglass /> Bekliyor olarak işaretle <DropdownMenuShortcut>{formatCombo(kb.taskWaiting)}</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
            {task.status === 'waiting' && (
              <DropdownMenuItem onSelect={() => moveTask(task, { to: 'today' })}>
                <Check /> Geldi, bugün ilgilen
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => deleteTask(task)}>
              <Trash2 /> Sil <DropdownMenuShortcut>{formatCombo(kb.taskDelete)}</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
