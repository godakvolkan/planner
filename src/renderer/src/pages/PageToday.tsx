import * as React from 'react'
import { ChevronDown, Sun } from 'lucide-react'
import { today } from '../../../shared/dates'
import type { Task } from '../../../shared/types'
import { Page, Meter, Section, EmptyState } from '@/components/common/Page'
import { TaskRow } from '@/components/task/TaskRow'
import { QuickAdd } from '@/components/task/QuickAdd'
import { CapacityPicker } from '@/components/common/CapacityPicker'
import { useData } from '@/lib/data'
import { formatDayTitle, formatMinutes, formatMinutesOrZero } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { formatCombo } from '../../../shared/keybindings'

export function PageToday(): React.JSX.Element {
  const todayStr = today()
  const { bindings } = useApp()
  const tasks = useData(() => window.api.tasks.list({ view: 'today' })).data ?? []
  const doneToday = useData(() => window.api.tasks.list({ view: 'range', from: todayStr, to: todayStr })).data ?? []
  const summary = useData(() => window.api.stats.day()).data
  const recurrences = useData(() => window.api.recurrences.list()).data ?? []
  const [showDone, setShowDone] = React.useState(false)

  const open = tasks.filter((t) => t.status === 'planned' || t.status === 'active')
  const top3 = open.filter((t) => t.top3Date === todayStr)
  const overdue = open.filter((t) => t.top3Date !== todayStr && t.scheduledDate! < todayStr)
  const timed = open
    .filter((t) => t.top3Date !== todayStr && t.scheduledDate === todayStr && t.scheduledTime)
    .sort((a, b) => a.scheduledTime!.localeCompare(b.scheduledTime!))
  const rest = open.filter((t) => t.top3Date !== todayStr && t.scheduledDate === todayStr && !t.scheduledTime)
  const waiting = tasks.filter((t) => t.status === 'waiting')
  const done = doneToday.filter((t) => t.status === 'done' && t.parentId === null)

  const capacity = summary?.capacityMin ?? 300
  const remaining = summary?.remainingMin ?? 0

  const group = (title: string, list: Task[], hint?: string): React.ReactNode =>
    list.length > 0 && (
      <Section title={title} count={list.length} action={hint && <span className="text-[11.5px] text-muted-foreground">{hint}</span>}>
        <div className="flex flex-col gap-0.5">
          {list.map((t) => {
            const rec = t.recurrenceId ? recurrences.find((r) => r.id === t.recurrenceId) : null
            return <TaskRow key={t.id} task={t} mode="today" streak={rec?.isHabit ? (rec.currentStreak ?? 0) : undefined} />
          })}
        </div>
      </Section>
    )

  return (
    <Page
      title="Bugün"
      subtitle={formatDayTitle(todayStr)}
      actions={
        <CapacityPicker busyMin={summary?.busyMin ?? 0}>
          <button type="button" title="Bugün kaç saatin var? Değiştirmek için tıkla" className="surface flex w-[260px] flex-col gap-2 px-4 py-3 text-left transition-colors hover:border-ring/40">
            <div className="flex w-full items-baseline justify-between text-[12.5px]">
              <span className="text-muted-foreground">Kapasite</span>
              <span className={cn('font-medium tabular', remaining > capacity && 'text-warning')}>
                {formatMinutesOrZero(remaining)} / {formatMinutes(capacity) || '0dk'}
              </span>
            </div>
            <Meter value={remaining} max={capacity} className="w-full" />
          </button>
        </CapacityPicker>
      }
    >
      <QuickAdd defaultDate={todayStr} placeholder='Bugüne ekle…  örn. "14:00 ödev 45 dk #üniversite"' />

      {open.length === 0 && waiting.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={Sun}
            title={done.length ? 'Bugünlük hepsi bitti.' : 'Bugün için planlanmış bir şey yok.'}
            description={done.length ? `${done.length} görev tamamlandı. Dinlenmeyi hak ettin.` : "Yukarıya yaz ya da Inbox'tan B tuşuyla bugüne al."}
          />
        </div>
      )}

      {group("Bugünün 3'ü", top3, 'En önemli işler')}
      {group('Dünden kalanlar', overdue)}
      {group('Saatli', timed)}
      {group(
        'Diğer',
        rest,
        rest.length ? `${formatCombo(bindings.taskTomorrow)}: yarına · ${formatCombo(bindings.taskTop3)}: önemli · ${formatCombo(bindings.taskFocus)}: odaklan` : undefined
      )}
      {group('Takip et', waiting)}

      {done.length > 0 && (
        <section className="mt-7">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="section-label flex items-center gap-2 px-1 hover:text-foreground"
          >
            <ChevronDown className={cn('size-3.5 transition-transform', !showDone && '-rotate-90')} />
            Tamamlanan
            <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] tabular">{done.length}</span>
          </button>
          {showDone && (
            <div className="mt-2 flex flex-col gap-0.5">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </section>
      )}
    </Page>
  )
}
