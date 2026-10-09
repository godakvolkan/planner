import * as React from 'react'
import { CalendarDays, Clock, CornerDownLeft, Flag, Hash, Lightbulb, Plus, Sparkles, Timer } from 'lucide-react'
import { contextMeta } from '../../../../shared/context'
import { suggestEstimate } from '../../../../shared/estimation'
import { toast } from 'sonner'
import { parseQuickAdd } from '../../../../shared/quickAdd'
import { today } from '../../../../shared/dates'
import type { TaskInput } from '../../../../shared/types'
import { cn } from '@/lib/utils'
import { formatMinutes, relativeDay } from '@/lib/format'
import { areaColor } from '@/lib/areas'
import { useApp } from '@/lib/app-context'
import { refreshAll, useShortcut } from '@/lib/data'
import { KeyCombo } from '@/components/common/KeyCombo'

interface QuickAddProps {
  /** Tarih yazılmazsa bu tarihe planlanır (ör. Bugün sayfası). Verilmezse Inbox'a düşer. */
  defaultDate?: string
  placeholder?: string
  autoFocusKey?: string
  className?: string
}

const PRIORITY_LABEL = { 1: 'Düşük', 2: 'Orta', 3: 'Yüksek', 4: 'Acil' } as const

function Chip({ icon: Icon, children, color }: { icon: React.ElementType; children: React.ReactNode; color?: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11.5px] font-medium text-primary">
      <Icon className="size-3" style={color ? { color } : undefined} />
      {children}
    </span>
  )
}

export function QuickAdd({ defaultDate, placeholder, className }: QuickAddProps): React.JSX.Element {
  const { areas, bindings, estimation } = useApp()
  const [useHint, setUseHint] = React.useState(false)
  const [value, setValue] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const parsed = React.useMemo(() => parseQuickAdd(value, areas, new Date(), { defaultDate }), [value, areas, defaultDate])
  const area = areas.find((a) => a.name === parsed.areaName)
  const todayStr = today()
  const date = parsed.scheduledDate ?? defaultDate ?? null
  const hint = suggestEstimate(estimation, area?.id ?? null, parsed.estimateMin)
  React.useEffect(() => setUseHint(false), [parsed.estimateMin, area?.id])

  useShortcut(bindings.newTask, () => inputRef.current?.focus())

  const submit = async (): Promise<void> => {
    if (!parsed.title || busy) return
    setBusy(true)
    try {
      const tagIds: number[] = []
      for (const name of parsed.tags) tagIds.push((await window.api.tags.create(name)).id)
      const input: TaskInput = {
        title: parsed.title,
        scheduledDate: date,
        scheduledTime: parsed.scheduledTime,
        estimateMin: useHint && hint ? hint.suggestedMin : parsed.estimateMin,
        areaId: area?.id ?? null,
        priority: parsed.priority ?? 1,
        context: parsed.context,
        tagIds
      }
      await window.api.tasks.create(input)
      setValue('')
      refreshAll()
      toast.success(date ? `${relativeDay(date, todayStr)} için planlandı` : "Inbox'a eklendi", { description: parsed.title })
    } catch {
      toast.error('Görev eklenemedi. Tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  const hasMeta = !!value.trim() && (date || parsed.scheduledTime || parsed.estimateMin || area || parsed.priority || parsed.tags.length || parsed.context)

  return (
    <div
      className={cn(
        'surface group/qa overflow-hidden transition-all focus-within:border-ring/50 focus-within:shadow-[0_0_0_4px_var(--surface-glow)]',
        className
      )}
    >
      <div className="flex items-center gap-3 px-4">
        <span className="grid size-6 place-items-center rounded-lg bg-brand text-white glow">
          <Plus className="size-4" strokeWidth={2.5} />
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              setValue('')
              e.currentTarget.blur()
            }
          }}
          placeholder={placeholder ?? 'Ne yapman gerekiyor?  örn. "yarın 14:00 proje raporu 2 saat"'}
          className="h-12 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-muted-foreground/70"
        />
        {value ? (
          <kbd className="flex items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <CornerDownLeft className="size-3" /> Ekle
          </kbd>
        ) : (
          <KeyCombo combo={bindings.newTask} />
        )}
      </div>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 border-t border-border/60 px-4 transition-all',
          hasMeta ? 'max-h-20 py-2 opacity-100' : 'max-h-0 border-transparent py-0 opacity-0'
        )}
      >
        <Sparkles className="mr-0.5 size-3.5 text-brand-teal" />
        {date && <Chip icon={CalendarDays}>{relativeDay(date, todayStr)}</Chip>}
        {parsed.scheduledTime && <Chip icon={Clock}>{parsed.scheduledTime}</Chip>}
        {parsed.estimateMin && <Chip icon={Timer}>{formatMinutes(useHint && hint ? hint.suggestedMin : parsed.estimateMin)}</Chip>}
        {hint && (
          <button
            type="button"
            onClick={() => setUseHint((u) => !u)}
            title={`${hint.basis === 'area' ? 'Bu alandaki' : 'Genelde'} işlerin tahminin ${hint.ratio} katı sürüyor (${hint.n} işe göre)`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium transition-colors',
              useHint ? 'border-warning/50 bg-warning/15 text-warning' : 'border-dashed border-warning/50 text-warning hover:bg-warning/10'
            )}
          >
            <Lightbulb className="size-3" />
            {useHint ? `${formatMinutes(hint.suggestedMin)} olarak eklenecek` : `Senin hızınla ≈ ${formatMinutes(hint.suggestedMin)}`}
          </button>
        )}
        {parsed.context && <Chip icon={Sparkles}>{contextMeta(parsed.context)?.emoji} {contextMeta(parsed.context)?.label}</Chip>}
        {area && (
          <Chip icon={Hash} color={areaColor(area)}>
            {area.name}
          </Chip>
        )}
        {parsed.priority && <Chip icon={Flag}>{PRIORITY_LABEL[parsed.priority]}</Chip>}
        {parsed.tags.map((t) => (
          <Chip key={t} icon={Hash}>
            {t}
          </Chip>
        ))}
        {!date && <span className="text-[11.5px] text-muted-foreground">Tarih yok → Inbox</span>}
      </div>
    </div>
  )
}
