import * as React from 'react'
import { CalendarClock, Hourglass, Inbox, Layers } from 'lucide-react'
import { Page, Section, EmptyState } from '@/components/common/Page'
import { TaskRow } from '@/components/task/TaskRow'
import { QuickAdd } from '@/components/task/QuickAdd'
import { useData } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { KeyCombo } from '@/components/common/KeyCombo'

type Tab = 'inbox' | 'week' | 'later' | 'waiting'

const TABS: { id: Tab; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, hint: 'Aklına gelen her şey, henüz planlanmadı.' },
  { id: 'week', label: 'Bu hafta', icon: CalendarClock, hint: 'Bu hafta yapılacak, günü belli değil.' },
  { id: 'later', label: 'Sonra', icon: Layers, hint: 'Bir gün. Acelesi yok.' },
  { id: 'waiting', label: 'Bekleyenler', icon: Hourglass, hint: 'Başkasından beklediklerin. Takip günü gelince Bugün listene düşer.' }
]

const KEYS = [
  ['taskToday', 'Bugün'],
  ['taskTomorrow', 'Yarın'],
  ['taskWeek', 'Bu hafta'],
  ['taskLater', 'Sonra'],
  ['taskWaiting', 'Bekliyor'],
  ['taskDelete', 'Sil']
] as const

export function PageInbox(): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>('inbox')
  const { bindings } = useApp()
  const inbox = useData(() => window.api.tasks.list({ view: 'inbox' })).data ?? []
  const week = useData(() => window.api.tasks.list({ view: 'week' })).data ?? []
  const later = useData(() => window.api.tasks.list({ view: 'later' })).data ?? []
  const waiting = useData(() => window.api.tasks.list({ view: 'waiting' })).data ?? []
  const lists: Record<Tab, typeof inbox> = { inbox, week: week.filter((t) => !t.scheduledDate), later, waiting }
  const list = lists[tab]
  const current = TABS.find((t) => t.id === tab)!

  return (
    <Page
      title="Inbox"
      subtitle="Yakala, sonra karar ver"
      actions={
        <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-xl border bg-card/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors max-sm:px-2.5',
                tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <t.icon className="size-3.5 max-sm:hidden" />
              {t.label}
              <span className="text-[11px] tabular opacity-70">{lists[t.id].length}</span>
            </button>
          ))}
        </div>
      }
    >
      <QuickAdd placeholder="Aklındakini yaz, Enter…  tarih yazarsan doğrudan planlanır" />

      <Section
        title={current.label}
        count={list.length}
        action={
          tab === 'inbox' && list.length > 0 ? (
            <span className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground max-md:hidden">
              {KEYS.map(([action, l]) => (
                <span key={action} className="flex items-center gap-1">
                  <KeyCombo combo={bindings[action]} />
                  {l}
                </span>
              ))}
            </span>
          ) : undefined
        }
      >
        {list.length === 0 ? (
          <EmptyState
            icon={current.icon}
            title={tab === 'inbox' ? 'Inbox temiz.' : 'Burada bir şey yok.'}
            description={tab === 'inbox' ? 'Aklına bir şey gelince yaz; uygulama arka plandayken de hızlı ekleme kısayoluyla ekleyebilirsin.' : current.hint}
          />
        ) : (
          <>
            <p className="mb-2 px-1 text-[12.5px] text-muted-foreground">
              {current.hint} Satırın üstüne gel ya da Tab ile seçip kısayola bas.
            </p>
            <div className="flex flex-col gap-0.5">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} mode="inbox" />
              ))}
            </div>
          </>
        )}
      </Section>
    </Page>
  )
}
