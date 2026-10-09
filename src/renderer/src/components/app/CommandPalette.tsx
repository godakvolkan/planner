import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, CalendarRange, CircleCheck, Focus, GraduationCap, Hourglass, Inbox, LayoutGrid, Moon, Plus, Settings, Sparkles, Sun, Sunrise } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@/components/ui/command'
import { useApp } from '@/lib/app-context'
import type { Task } from '../../../../shared/types'
import { fold } from '../../../../shared/quickAdd'
import { formatMinutes } from '@/lib/format'
import { formatCombo } from '../../../../shared/keybindings'

const PAGES = [
  { to: '/', label: 'Şimdi', icon: Sparkles, action: 'navNow' as const },
  { to: '/today', label: 'Bugün', icon: Sun, action: 'navToday' as const },
  { to: '/inbox', label: 'Inbox', icon: Inbox, action: 'navInbox' as const },
  { to: '/planner', label: 'Planlayıcı', icon: CalendarRange, action: 'navPlanner' as const },
  { to: '/schedule', label: 'Ders programı', icon: GraduationCap, action: 'navSchedule' as const },
  { to: '/areas', label: 'Alanlar', icon: LayoutGrid, action: 'navAreas' as const },
  { to: '/focus', label: 'Focus', icon: Focus, action: 'navFocus' as const },
  { to: '/analytics', label: 'Analiz', icon: BarChart3, action: 'navAnalytics' as const },
  { to: '/settings', label: 'Ayarlar', icon: Settings, action: 'navSettings' as const }
]

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }): React.JSX.Element {
  const navigate = useNavigate()
  const { openTask, startFocus, settings, updateSettings, bindings, askFreeTime } = useApp()
  const [query, setQuery] = React.useState('')
  const [matches, setMatches] = React.useState<Task[]>([])

  React.useEffect(() => {
    if (open) setQuery('')
  }, [open])

  React.useEffect(() => {
    const q = query.trim()
    if (!q) return setMatches([])
    const id = setTimeout(() => {
      window.api.tasks.search(q, 8).then(setMatches, () => setMatches([]))
    }, 80)
    return () => clearTimeout(id)
  }, [query])

  const go = (fn: () => void) => () => {
    onOpenChange(false)
    fn()
  }

  const q = fold(query.trim())

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput placeholder="Görev ara, sayfaya git, komut çalıştır…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Sonuç yok.</CommandEmpty>
        {matches.length > 0 && (
          <CommandGroup heading="Görevler">
            {matches.map((t) => (
              <CommandItem key={t.id} value={`task-${t.id}`} onSelect={go(() => openTask(t))}>
                <CircleCheck className={t.status === 'done' ? 'text-success' : ''} />
                <span className={t.status === 'done' ? 'text-muted-foreground line-through' : ''}>{t.title}</span>
                <CommandShortcut>{formatMinutes(t.estimateMin)}</CommandShortcut>
              </CommandItem>
            ))}
            {matches[0] && matches[0].status !== 'done' && (
              <CommandItem value="focus-first" onSelect={go(() => startFocus(matches[0].id).then(() => navigate('/focus')))}>
                <Focus /> “{matches[0].title}” ile odaklan
                <CommandShortcut>{formatCombo(bindings.taskFocus)}</CommandShortcut>
              </CommandItem>
            )}
          </CommandGroup>
        )}
        <CommandGroup heading="Git">
          {PAGES.filter((p) => !q || fold(p.label).includes(q)).map((p) => (
            <CommandItem key={p.to} value={p.label} onSelect={go(() => navigate(p.to))}>
              <p.icon /> {p.label}
              <CommandShortcut>{formatCombo(bindings[p.action])}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Komutlar">
          <CommandItem value="new" onSelect={go(() => navigate('/inbox'))}>
            <Plus /> Yeni görev
            <CommandShortcut>{formatCombo(bindings.newTask)}</CommandShortcut>
          </CommandItem>
          <CommandItem value="free" onSelect={go(() => askFreeTime())}>
            <Hourglass /> Kaç dakikam var?
          </CommandItem>
          <CommandItem value="morning" onSelect={go(() => navigate('/morning'))}>
            <Sunrise /> Günü planla
          </CommandItem>
          <CommandItem value="shutdown" onSelect={go(() => navigate('/shutdown'))}>
            <Moon /> Günü kapat
          </CommandItem>
          <CommandItem value="shortcuts" onSelect={go(() => navigate('/settings#keys'))}>
            <Settings /> Klavye kısayollarını düzenle
          </CommandItem>
          <CommandItem
            value="theme"
            onSelect={go(() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }))}
          >
            {settings.theme === 'dark' ? <Sun /> : <Moon />} {settings.theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
