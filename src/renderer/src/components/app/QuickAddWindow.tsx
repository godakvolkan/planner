import * as React from 'react'
import { CalendarDays, Check, Clock, CornerDownLeft, Flag, Hash, Plus, Sparkles, Timer } from 'lucide-react'
import logo from '@/assets/logo.png'
import { parseQuickAdd } from '../../../../shared/quickAdd'
import { today } from '../../../../shared/dates'
import { useApp } from '@/lib/app-context'
import { formatMinutes, relativeDay } from '@/lib/format'
import { areaColor } from '@/lib/areas'
import { cn } from '@/lib/utils'

const PRIORITY_LABEL = { 1: 'Düşük', 2: 'Orta', 3: 'Yüksek', 4: 'Acil' } as const

/**
 * Her yerden açılan küçük hızlı ekleme penceresi (Ctrl+Space).
 * Enter → ekler ve kapanır · Shift+Enter → ekler, açık kalır · Esc → kapanır
 */
export function QuickAddWindow(): React.JSX.Element {
  const { areas } = useApp()
  const [value, setValue] = React.useState('')
  const [saved, setSaved] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const parsed = React.useMemo(() => parseQuickAdd(value, areas), [value, areas])
  const area = areas.find((a) => a.name === parsed.areaName)
  const todayStr = today()

  React.useEffect(() => {
    document.documentElement.classList.add('quick-window')
    const focus = (): void => {
      setSaved(null)
      setError(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    focus()
    return window.api.quick.onShown(focus)
  }, [])

  const close = (): void => {
    setValue('')
    window.api.quick.close()
  }

  const submit = async (keepOpen: boolean): Promise<void> => {
    if (!parsed.title) return
    try {
      const tagIds: number[] = []
      for (const name of parsed.tags) tagIds.push((await window.api.tags.create(name)).id)
      await window.api.tasks.create({
        title: parsed.title,
        scheduledDate: parsed.scheduledDate,
        scheduledTime: parsed.scheduledTime,
        estimateMin: parsed.estimateMin,
        areaId: area?.id ?? null,
        priority: parsed.priority ?? 1,
        tagIds
      })
      const where = parsed.scheduledDate ? relativeDay(parsed.scheduledDate, todayStr) : 'Inbox'
      setValue('')
      setError(null)
      setSaved(`${parsed.title} → ${where}`)
      if (!keepOpen) setTimeout(close, 650)
    } catch {
      setError('Eklenemedi. Tekrar dene.')
    }
  }

  const chips: { icon: React.ElementType; label: string; color?: string }[] = []
  if (parsed.scheduledDate) chips.push({ icon: CalendarDays, label: relativeDay(parsed.scheduledDate, todayStr) })
  if (parsed.scheduledTime) chips.push({ icon: Clock, label: parsed.scheduledTime })
  if (parsed.estimateMin) chips.push({ icon: Timer, label: formatMinutes(parsed.estimateMin) })
  if (area) chips.push({ icon: Hash, label: area.name, color: areaColor(area) })
  if (parsed.priority) chips.push({ icon: Flag, label: PRIORITY_LABEL[parsed.priority] })
  for (const t of parsed.tags) chips.push({ icon: Hash, label: t })

  return (
    <div className="flex h-full items-start p-2">
      <div className="surface-hero w-full overflow-hidden !rounded-2xl">
        <div className="drag flex items-center gap-3 px-4 pt-1">
          <img src={logo} alt="" className="size-7 rounded-lg" draggable={false} />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setSaved(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit(e.shiftKey)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
            placeholder='Ne yapman gerekiyor?  örn. "yarın 14:00 rapor 2 saat"'
            className="no-drag h-14 flex-1 bg-transparent text-[16px] font-medium outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="flex items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <CornerDownLeft className="size-3" /> Ekle
          </kbd>
        </div>
        <div className="flex h-11 items-center gap-1.5 border-t border-border/60 px-4 text-[12px]">
          {saved ? (
            <span className="flex items-center gap-1.5 font-medium text-success">
              <Check className="size-4" /> {saved}
            </span>
          ) : error ? (
            <span className="font-medium text-destructive">{error}</span>
          ) : value.trim() ? (
            <>
              <Sparkles className="size-3.5 text-brand-teal" />
              {chips.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  <c.icon className="size-3" style={c.color ? { color: c.color } : undefined} /> {c.label}
                </span>
              ))}
              {!parsed.scheduledDate && <span className="text-muted-foreground">Tarih yok → Inbox</span>}
            </>
          ) : (
            <span className={cn('flex items-center gap-3 text-muted-foreground')}>
              <span className="flex items-center gap-1">
                <Plus className="size-3" /> Enter: ekle ve kapat
              </span>
              <span>Shift+Enter: ekle, açık kalsın</span>
              <span>Esc: kapat</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
