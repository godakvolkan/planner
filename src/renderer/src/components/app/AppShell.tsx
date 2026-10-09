import * as React from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarRange,
  GraduationCap,
  Focus,
  Inbox,
  LayoutGrid,
  Lock,
  Menu,
  Pause,
  Play,
  Search,
  Settings,
  Sparkles,
  Sun
} from 'lucide-react'
import logo from '@/assets/logo.png'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { recording, useNow } from '@/lib/data'
import { useLayout, type LayoutMode } from '@/lib/layout'
import { formatCombo, matchesCombo } from '../../../../shared/keybindings'
import { KeyCombo } from '@/components/common/KeyCombo'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { formatClock } from '@/lib/format'
import { usePomodoro } from '@/lib/pomodoro'
import { PHASE_LABEL, isRunning } from '../../../../shared/pomodoro'
import { CommandPalette } from './CommandPalette'
import { NowStatus } from './NowStatus'

const NAV = [
  { to: '/', label: 'Şimdi', icon: Sparkles, action: 'navNow' as const },
  { to: '/today', label: 'Bugün', icon: Sun, action: 'navToday' as const, count: 'today' as const },
  { to: '/inbox', label: 'Inbox', icon: Inbox, action: 'navInbox' as const, count: 'inbox' as const },
  { to: '/planner', label: 'Planlayıcı', icon: CalendarRange, action: 'navPlanner' as const },
  { to: '/schedule', label: 'Ders programı', icon: GraduationCap, action: 'navSchedule' as const },
  { to: '/areas', label: 'Alanlar', icon: LayoutGrid, action: 'navAreas' as const },
  { to: '/focus', label: 'Focus', icon: Focus, action: 'navFocus' as const },
  { to: '/analytics', label: 'Analiz', icon: BarChart3, action: 'navAnalytics' as const }
]

/** Üst çubukta gösterilecek sayfa adı */
const PAGE_LABEL: Record<string, string> = {
  ...Object.fromEntries(NAV.map((n) => [n.to, n.label])),
  '/settings': 'Ayarlar',
  '/search': 'Arama',
  '/morning': 'Güne başla',
  '/shutdown': 'Günü kapat'
}

function NavItem({
  to,
  label,
  icon: Icon,
  count,
  shortcut,
  rail
}: {
  to: string
  label: string
  icon: React.ElementType
  count?: number
  shortcut?: string
  /** İkon şeridi: yalnızca simge */
  rail?: boolean
}): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors',
          rail && 'justify-center px-0',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand" />}
          <Icon className={cn('size-[17px] shrink-0', isActive && 'text-primary')} />
          {!rail && <span className="flex-1 truncate">{label}</span>}
          {!!count && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px] font-semibold tabular',
                rail && 'absolute right-1 top-0.5 px-1 text-[9px]',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function PomodoroMini(): React.JSX.Element | null {
  const p = usePomodoro()
  const navigate = useNavigate()
  const s = p.state
  if (!s) return null
  const isWork = s.phase === 'work'
  const running = isRunning(s)
  const pct = (1 - p.remaining / s.durationSec) * 100
  return (
    <div className="surface-hero mx-1 mb-2 p-3">
      <button type="button" onClick={() => navigate('/focus')} className="block w-full text-left">
        <div className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider', isWork ? 'text-primary' : 'text-success')}>
          <span className={cn('size-1.5 rounded-full', isWork ? 'bg-primary' : 'bg-success', running && 'animate-pulse')} />
          Pomodoro · {PHASE_LABEL[s.phase]}
        </div>
        <div className="mt-1 text-[11.5px] text-muted-foreground">{s.waiting ? 'Başlatmanı bekliyor' : !running ? 'Duraklatıldı' : `${s.completedWork} tur tamamlandı`}</div>
      </button>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[18px] font-semibold tabular">{formatClock(p.remaining)}</span>
        <button
          type="button"
          aria-label={running ? 'Duraklat' : 'Devam'}
          onClick={() => (running ? p.pause() : p.resume())}
          className="grid size-7 place-items-center rounded-full bg-muted text-foreground hover:bg-accent"
        >
          {running ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
        </button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full', isWork ? 'bg-brand' : 'bg-success')} style={{ width: `${s.waiting ? 0 : pct}%` }} />
      </div>
    </div>
  )
}

function FocusMini(): React.JSX.Element | null {
  const { session, sessionTask, stopFocus } = useApp()
  const p = usePomodoro()
  const now = useNow(1000)
  const navigate = useNavigate()
  if (p.state) return <PomodoroMini />
  if (!session) return null
  const elapsed = (now.getTime() - new Date(session.startedAt).getTime()) / 1000
  const est = (sessionTask?.estimateMin ?? 0) * 60
  const pct = est ? Math.min(100, (elapsed / est) * 100) : 0
  return (
    <div className="surface-hero mx-1 mb-2 p-3">
      <button type="button" onClick={() => navigate('/focus')} className="block w-full text-left">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Odakta
        </div>
        <div className="mt-1 truncate text-[13px] font-medium">{sessionTask?.title ?? '…'}</div>
      </button>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[18px] font-semibold tabular">{formatClock(elapsed)}</span>
        <button
          type="button"
          aria-label="Duraklat"
          onClick={() => stopFocus()}
          className="grid size-7 place-items-center rounded-full bg-muted text-foreground hover:bg-accent"
        >
          <Pause className="size-3.5" />
        </button>
      </div>
      {est > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full', elapsed > est ? 'bg-warning' : 'bg-brand')} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { inboxCount, todayCount, settings, openTask, bindings, profile, lock } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const mode = useLayout()
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [drawer, setDrawer] = React.useState(false)

  // Çekmecede bir sayfaya geçilince ya da pencere genişleyince çekmece kapansın
  React.useEffect(() => setDrawer(false), [location.pathname, mode])

  // Kısayollar Ayarlar → Klavye kısayolları'ndan değiştirilebilir
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (recording.active) return
      if (matchesCombo(e, bindings.palette)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      const item = NAV.find((n) => matchesCombo(e, bindings[n.action]))
      if (item) {
        e.preventDefault()
        navigate(item.to)
      } else if (matchesCombo(e, bindings.navSettings)) {
        e.preventDefault()
        navigate('/settings')
      } else if (matchesCombo(e, bindings.lock)) {
        e.preventDefault()
        lock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, bindings, lock])

  // Bildirime tıklanınca ilgili sayfaya git, görev varsa aç
  React.useEffect(
    () =>
      window.api.onNavigate((route, taskId) => {
        navigate(route)
        if (taskId) window.api.tasks.get(taskId).then((t) => t && route !== '/focus' && openTask(t), () => undefined)
      }),
    [navigate, openTask]
  )

  const counts = { inbox: inboxCount, today: todayCount }

  const sidebar = (m: LayoutMode): React.JSX.Element => {
    const rail = m === 'rail'
    return (
      <>
        <div className={cn('flex h-[72px] shrink-0 items-center gap-3 pt-3', rail ? 'justify-center' : 'px-5', m !== 'drawer' && 'drag')}>
          <img src={logo} alt="" className="size-9 rounded-[10px] shadow-[0_6px_20px_-6px_oklch(0.62_0.2_258/0.7)]" draggable={false} />
          {!rail && (
            <div className="min-w-0 leading-tight">
              <div className="text-[14.5px] font-semibold tracking-tight">Control Center</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                {profile ? profile.name : settings.userName ? `Merhaba, ${settings.userName}` : 'Kişisel planlama'}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setDrawer(false)
            setPaletteOpen(true)
          }}
          title={`Ara veya komut (${formatCombo(bindings.palette)})`}
          className={cn(
            'mx-3 mt-2 flex h-9 shrink-0 items-center gap-2 rounded-lg border bg-background/40 text-[13px] text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground',
            rail ? 'justify-center' : 'px-3'
          )}
        >
          <Search className="size-4" />
          {!rail && <span className="flex-1 truncate text-left">Ara veya komut…</span>}
          {!rail && <KeyCombo combo={bindings.palette} />}
        </button>

        <div className="mx-3 mt-3 shrink-0">
          <NowStatus compact={rail} />
        </div>

        <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {NAV.map((n) => (
            <NavItem
              key={n.to}
              rail={rail}
              to={n.to}
              label={n.label}
              icon={n.icon}
              shortcut={formatCombo(bindings[n.action])}
              count={n.count ? counts[n.count] : undefined}
            />
          ))}
        </nav>

        <div className="shrink-0 px-3 pb-3">
          {!rail && <FocusMini />}
          <div className={cn('flex items-center gap-1', rail && 'flex-col')}>
            <div className={cn('min-w-0', rail ? 'w-full' : 'flex-1')}>
              <NavItem rail={rail} to="/settings" label="Ayarlar" icon={Settings} shortcut={formatCombo(bindings.navSettings)} />
            </div>
            <button
              type="button"
              onClick={() => lock()}
              title={`Kilitle${profile ? ` (${profile.name})` : ''} · ${formatCombo(bindings.lock)}`}
              aria-label="Kilitle"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Lock className="size-4" />
            </button>
          </div>
        </div>
      </>
    )
  }

  const pageLabel = PAGE_LABEL[location.pathname] ?? 'Control Center'

  return (
    <div className="app-ambient flex h-full" data-layout={mode}>
      {mode !== 'drawer' && (
        <aside
          className={cn(
            'flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl',
            mode === 'rail' ? 'w-[68px]' : 'w-[236px]'
          )}
        >
          {sidebar(mode)}
        </aside>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        {mode === 'drawer' && (
          // Dar pencere: üst çubuk. Sağda Windows pencere düğmeleri için yer bırakılır.
          <div className="drag flex h-10 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar/80 pl-2 pr-[146px] backdrop-blur-xl">
            <button
              type="button"
              aria-label="Menü"
              onClick={() => setDrawer(true)}
              className="relative grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
              <Menu className="size-[18px]" />
              {inboxCount > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />}
            </button>
            <img src={logo} alt="" className="size-6 shrink-0 rounded-md" draggable={false} />
            <span className="min-w-0 truncate text-[13px] font-semibold">{pageLabel}</span>
            <button
              type="button"
              aria-label="Ara"
              onClick={() => setPaletteOpen(true)}
              className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
          </div>
        )}
        <div className="relative min-h-0 flex-1">{children}</div>
      </main>

      {mode === 'drawer' && (
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="w-[264px] gap-0 border-sidebar-border bg-sidebar p-0 sm:max-w-[264px]">
            <SheetTitle className="sr-only">Menü</SheetTitle>
            <div className="flex h-full flex-col">{sidebar('drawer')}</div>
          </SheetContent>
        </Sheet>
      )}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
