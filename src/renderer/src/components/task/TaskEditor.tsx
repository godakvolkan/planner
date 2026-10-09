import * as React from 'react'
import {
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Folder,
  Link2,
  Clock,
  Flag,
  Footprints,
  Hash,
  Plus,
  Repeat,
  Scissors,
  Tag as TagIcon,
  Zap,
  MapPin,
  Lightbulb,
  Timer,
  Trash2,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import type { Area, Energy, FirstStepType, Priority, RecurrenceRule, Tag, Task, TaskPatch } from '../../../../shared/types'
import { useApp } from '@/lib/app-context'
import { CONTEXTS } from '../../../../shared/context'
import { suggestEstimate } from '../../../../shared/estimation'
import type { TaskContext } from '../../../../shared/types'
import { addDays, today } from '../../../../shared/dates'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { deleteTask } from '@/lib/actions'
import { areaColor } from '@/lib/areas'
import { formatMinutes } from '@/lib/format'
import { cn } from '@/lib/utils'

interface TaskEditorProps {
  task: Task | null
  areas: Area[]
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}

const ESTIMATES = [15, 30, 45, 60, 90, 120, 180]
const PRIORITIES: { value: Priority; label: string; className: string }[] = [
  { value: 1, label: 'Düşük', className: 'text-muted-foreground' },
  { value: 2, label: 'Orta', className: 'text-priority-medium' },
  { value: 3, label: 'Yüksek', className: 'text-priority-high' },
  { value: 4, label: 'Acil', className: 'text-priority-high' }
]
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const RULES: { value: RecurrenceRule | 'none'; label: string }[] = [
  { value: 'none', label: 'Tekrarlamaz' },
  { value: 'daily', label: 'Her gün' },
  { value: 'weekdays', label: 'Hafta içi' },
  { value: 'weekly', label: 'Haftanın günleri' },
  { value: 'monthly', label: 'Her ay' }
]

const fieldInput =
  'h-9 rounded-lg border bg-background/50 px-3 text-[13px] outline-none transition-colors focus:border-ring/60 focus:ring-2 focus:ring-ring/20 [color-scheme:inherit]'

function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-[112px_1fr] items-start gap-3 py-2">
      <div className="flex h-9 items-center gap-2 text-[12.5px] font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Pill({ active, onClick, children, className }: { active?: boolean; onClick: () => void; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors',
        active ? 'border-ring/50 bg-primary/15 text-primary' : 'text-muted-foreground hover:border-ring/30 hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TaskEditor({ task, areas, open, onOpenChange, onSaved }: TaskEditorProps): React.JSX.Element {
  const [title, setTitle] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [areaId, setAreaId] = React.useState<number | null>(null)
  const [priority, setPriority] = React.useState<Priority>(1)
  const [energyLevel, setEnergyLevel] = React.useState<Energy | null>(null)
  const [context, setContext] = React.useState<TaskContext | null>(null)
  const [hintUsed, setHintUsed] = React.useState(false)
  const { askBreakdown, estimation } = useApp()
  const [estimateMin, setEstimateMin] = React.useState<number | null>(null)
  const [firstStep, setFirstStep] = React.useState('')
  const [target, setTarget] = React.useState<string | null>(null)
  const [targetType, setTargetType] = React.useState<FirstStepType | null>(null)
  const [linkDraft, setLinkDraft] = React.useState<string | null>(null)
  const [scheduledDate, setScheduledDate] = React.useState<string | null>(null)
  const [scheduledTime, setScheduledTime] = React.useState<string | null>(null)
  const [deadline, setDeadline] = React.useState<string | null>(null)
  const [tagIds, setTagIds] = React.useState<number[]>([])
  const [allTags, setAllTags] = React.useState<Tag[]>([])
  const [newTag, setNewTag] = React.useState('')
  const [subtasks, setSubtasks] = React.useState<Task[]>([])
  const [newSubtask, setNewSubtask] = React.useState('')
  const [rule, setRule] = React.useState<RecurrenceRule | 'none'>('none')
  const [weekdays, setWeekdays] = React.useState<number[]>([])
  const [dayOfMonth, setDayOfMonth] = React.useState(1)
  const [saving, setSaving] = React.useState(false)
  const todayStr = today()

  const loadSubtasks = React.useCallback((id: number) => {
    window.api.tasks.list({ parentId: id }).then(setSubtasks, () => setSubtasks([]))
  }, [])

  React.useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setNotes(task.notes ?? '')
    setAreaId(task.areaId)
    setPriority(task.priority)
    setEnergyLevel(task.energyLevel)
    setContext(task.context)
    setHintUsed(false)
    setEstimateMin(task.estimateMin)
    setFirstStep(task.firstStep ?? '')
    setTarget(task.firstStepTarget)
    setTargetType(task.firstStepType)
    setLinkDraft(null)
    setScheduledDate(task.scheduledDate)
    setScheduledTime(task.scheduledTime)
    setDeadline(task.deadline)
    setTagIds(task.tags.map((t) => t.id))
    setNewTag('')
    setNewSubtask('')
    setRule('none')
    setWeekdays([])
    setDayOfMonth(Number(task.scheduledDate?.slice(8) ?? 1) || 1)
    loadSubtasks(task.id)
    window.api.tags.list().then(setAllTags, () => setAllTags([]))
    if (task.recurrenceId) {
      window.api.recurrences.list().then((rules) => {
        const r = rules.find((x) => x.id === task.recurrenceId)
        if (r) {
          setRule(r.rule)
          setWeekdays(r.weekdays)
          setDayOfMonth(r.dayOfMonth ?? 1)
        }
      }, () => undefined)
    }
  }, [task, loadSubtasks])

  if (!task) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    )
  }

  const save = async (): Promise<void> => {
    if (!title.trim()) {
      toast.error('Başlık boş olamaz.')
      return
    }
    if (rule === 'weekly' && weekdays.length === 0) {
      toast.error('Haftanın en az bir gününü seç.')
      return
    }
    setSaving(true)
    try {
      const patch: TaskPatch = {
        title: title.trim(),
        notes: notes.trim() || null,
        areaId,
        priority,
        energyLevel,
        context,
        estimateMin,
        firstStep: firstStep.trim() || null,
        firstStepTarget: target,
        firstStepType: target ? targetType : null,
        scheduledDate,
        scheduledTime: scheduledDate ? scheduledTime : null,
        deadline,
        tagIds
      }
      // Tarih verilen Inbox görevi planlanmış olur; tarihi silinen planlı görev Inbox'a döner
      if (scheduledDate && task.status === 'inbox') patch.status = 'planned'
      if (!scheduledDate && task.scheduledDate && !task.plannedWeek && task.status === 'planned') patch.status = 'inbox'
      await window.api.tasks.update(task.id, patch)

      if (rule !== 'none' && !task.recurrenceId) {
        if (subtasks.length > 0) {
          toast("Alt görevi olan bir görev tekrarlayana dönüştürülemez", { description: 'Görevin diğer değişiklikleri kaydedildi.' })
        } else {
          await window.api.recurrences.create({
            title: title.trim(),
            areaId,
            priority,
            estimateMin,
            firstStep: firstStep.trim() || null,
            time: scheduledTime,
            rule,
            weekdays,
            dayOfMonth,
            startDate: scheduledDate && scheduledDate > todayStr ? scheduledDate : todayStr
          })
          // Kural bugün/yarın için kendi örneklerini üretir; çift görünmesin diye orijinal kaldırılır
          await window.api.tasks.delete(task.id)
          toast.success('Tekrarlayan göreve dönüştürüldü', { description: RULES.find((r) => r.value === rule)?.label })
        }
      }
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('Görev kaydedilemedi. Tekrar dene.')
    } finally {
      setSaving(false)
    }
  }

  const addSubtask = async (): Promise<void> => {
    const t = newSubtask.trim()
    if (!t) return
    try {
      await window.api.tasks.create({ title: t, parentId: task.id })
      setNewSubtask('')
      loadSubtasks(task.id)
      onSaved()
    } catch {
      toast.error('Alt görev eklenemedi.')
    }
  }

  const toggleSubtask = async (s: Task): Promise<void> => {
    try {
      if (s.status === 'done') await window.api.tasks.uncomplete(s.id)
      else await window.api.tasks.complete(s.id)
      loadSubtasks(task.id)
      onSaved()
    } catch {
      toast.error('Alt görev güncellenemedi.')
    }
  }

  const addTag = async (): Promise<void> => {
    const name = newTag.trim()
    if (!name) return
    try {
      const created = await window.api.tags.create(name)
      setAllTags((prev) => (prev.some((t) => t.id === created.id) ? prev : [...prev, created]))
      setTagIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]))
      setNewTag('')
    } catch {
      toast.error('Etiket eklenemedi.')
    }
  }

  const doneSubtasks = subtasks.filter((s) => s.status === 'done').length
  // Kendi geçmişine göre tahmin önerisi; kabul edilince (veya görev değişene kadar) bir daha önerilmez
  const estimateHint = hintUsed ? null : suggestEstimate(estimation, areaId, estimateMin)

  return (
    // Ekranın ortasında pencere; içerik kendi içinde kayar, alttaki düğmeler sabit
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(88vh,860px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            save()
          }
        }}
      >
        <DialogTitle className="sr-only">Görevi düzenle</DialogTitle>
        <DialogDescription className="sr-only">Görevin ayrıntılarını değiştir</DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 max-sm:px-4">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={1}
            placeholder="Görev başlığı"
            className="field-sizing-content w-full resize-none bg-transparent pr-8 text-[22px] font-semibold leading-snug tracking-tight outline-none placeholder:text-muted-foreground/60"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            {task.status === 'done' && (
              <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-medium text-success">
                <Check className="size-3" /> Tamamlandı
              </span>
            )}
            {task.postponeCount > 0 && <span className="rounded-full bg-muted px-2 py-0.5">{task.postponeCount} kez ertelendi</span>}
            {task.actualMin > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5">
                Gerçek {formatMinutes(task.actualMin)}
                {task.estimateMin ? ` · tahmin ${formatMinutes(task.estimateMin)}` : ''}
              </span>
            )}
            {task.recurrenceId && (
              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <Repeat className="size-3" /> Tekrarlayan
              </span>
            )}
          </div>

          <div className="mt-5 divide-y divide-border/60 border-y border-border/60">
            <Row icon={CalendarDays} label="Tarih">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill active={scheduledDate === todayStr} onClick={() => setScheduledDate(todayStr)}>
                  Bugün
                </Pill>
                <Pill active={scheduledDate === addDays(todayStr, 1)} onClick={() => setScheduledDate(addDays(todayStr, 1))}>
                  Yarın
                </Pill>
                <input type="date" className={cn(fieldInput, 'w-[140px]')} value={scheduledDate ?? ''} onChange={(e) => setScheduledDate(e.target.value || null)} />
                {scheduledDate && (
                  <button type="button" aria-label="Tarihi kaldır" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" onClick={() => setScheduledDate(null)}>
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </Row>
            <Row icon={Clock} label="Saat">
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  disabled={!scheduledDate}
                  className={cn(fieldInput, 'w-[120px] disabled:opacity-50')}
                  value={scheduledTime ?? ''}
                  onChange={(e) => setScheduledTime(e.target.value || null)}
                />
                {!scheduledDate && <span className="text-[12px] text-muted-foreground">Önce tarih seç</span>}
                {scheduledTime && (
                  <button type="button" aria-label="Saati kaldır" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" onClick={() => setScheduledTime(null)}>
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </Row>
            <Row icon={Timer} label="Süre">
              <div className="flex flex-wrap items-center gap-1.5">
                {ESTIMATES.map((m) => (
                  <Pill key={m} active={estimateMin === m} onClick={() => setEstimateMin(estimateMin === m ? null : m)}>
                    {formatMinutes(m)}
                  </Pill>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    placeholder="dk"
                    className={cn(fieldInput, 'w-[72px]')}
                    value={estimateMin != null && !ESTIMATES.includes(estimateMin) ? estimateMin : ''}
                    onChange={(e) => setEstimateMin(e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : null)}
                  />
                </div>
              </div>
            </Row>
            {estimateHint && (
              <div className="-mt-1 mb-1 ml-[124px] flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-2 text-[12.5px]">
                <Lightbulb className="size-3.5 shrink-0 text-primary" />
                <span className="flex-1">
                  {estimateHint.basis === 'area' ? 'Bu alandaki' : 'Genelde'} işlerin tahminin {estimateHint.ratio.toFixed(1).replace('.', ',')} katı sürüyor
                  <span className="text-muted-foreground"> ({estimateHint.n} işe göre)</span>.
                </span>
                <button type="button" className="shrink-0 font-semibold text-primary hover:underline" onClick={() => {
                    setEstimateMin(estimateHint.suggestedMin)
                    setHintUsed(true)
                  }}>
                  {formatMinutes(estimateHint.suggestedMin)} yap
                </button>
              </div>
            )}
            <Row icon={Flag} label="Öncelik">
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <Pill key={p.value} active={priority === p.value} onClick={() => setPriority(p.value)} className={priority === p.value ? '' : p.className}>
                    {p.label}
                  </Pill>
                ))}
              </div>
            </Row>
            <Row icon={MapPin} label="Nerede">
              <div className="flex flex-wrap gap-1.5">
                <Pill active={context === null} onClick={() => setContext(null)}>
                  Her yer
                </Pill>
                {CONTEXTS.map((c) => (
                  <Pill key={c.id} active={context === c.id} onClick={() => setContext(c.id)}>
                    {c.emoji} {c.label}
                  </Pill>
                ))}
              </div>
            </Row>
            <Row icon={Zap} label="Enerji">
              <div className="flex flex-wrap gap-1.5">
                {([
                  [null, 'Otomatik'],
                  ['low', '😴 Düşük'],
                  ['medium', '🙂 Orta'],
                  ['high', '🔥 Yüksek']
                ] as [Energy | null, string][]).map(([v, label]) => (
                  <Pill key={label} active={energyLevel === v} onClick={() => setEnergyLevel(v)}>
                    {label}
                  </Pill>
                ))}
              </div>
            </Row>
            <Row icon={Hash} label="Alan">
              <Select value={areaId ? String(areaId) : 'none'} onValueChange={(v) => setAreaId(v === 'none' ? null : Number(v))}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Alan yok</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      <span className="size-2 rounded-full" style={{ background: areaColor(a) }} /> {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row icon={Flag} label="Teslim">
              <div className="flex items-center gap-1.5">
                <input type="date" className={cn(fieldInput, 'w-[150px]')} value={deadline ?? ''} onChange={(e) => setDeadline(e.target.value || null)} />
                {deadline && (
                  <button type="button" aria-label="Teslim tarihini kaldır" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent" onClick={() => setDeadline(null)}>
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </Row>
            <Row icon={Footprints} label="İlk adım">
              <div className="space-y-2">
                <input
                  value={firstStep}
                  onChange={(e) => setFirstStep(e.target.value)}
                  placeholder="Başlamak için ilk fiziksel adım, örn. Word dosyasını aç"
                  className={cn(fieldInput, 'w-full')}
                />
                {target ? (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.07] px-2.5 py-1.5 text-[12.5px]">
                    {targetType === 'url' ? (
                      <Link2 className="size-3.5 shrink-0 text-primary" />
                    ) : targetType === 'folder' ? (
                      <Folder className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <FileText className="size-3.5 shrink-0 text-primary" />
                    )}
                    <span className="min-w-0 flex-1 truncate" title={target}>
                      {target}
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-1 font-medium text-primary hover:underline"
                      onClick={async () => {
                        await window.api.tasks.update(task.id, { firstStepTarget: target, firstStepType: targetType })
                        const r = await window.api.tasks.openFirstStep(task.id)
                        if (!r.ok) toast.error(r.error ?? 'Açılamadı.')
                      }}
                    >
                      <ExternalLink className="size-3" /> Aç
                    </button>
                    <button
                      type="button"
                      aria-label="Hedefi kaldır"
                      onClick={() => {
                        setTarget(null)
                        setTargetType(null)
                      }}
                    >
                      <X className="size-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : linkDraft !== null ? (
                  <input
                    autoFocus
                    value={linkDraft}
                    onChange={(e) => setLinkDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.stopPropagation()
                        const v = linkDraft.trim()
                        const url = /^(https?:|mailto:)/i.test(v) ? v : v ? `https://${v}` : ''
                        if (url) {
                          setTarget(url)
                          setTargetType('url')
                        }
                        setLinkDraft(null)
                      } else if (e.key === 'Escape') {
                        e.stopPropagation()
                        setLinkDraft(null)
                      }
                    }}
                    placeholder="https://… yapıştır, Enter"
                    className={cn(fieldInput, 'w-full')}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] text-muted-foreground">Başla'ya basınca açılsın:</span>
                    <Pill
                      onClick={async () => {
                        const p = await window.api.files.pick('file')
                        if (p) {
                          setTarget(p)
                          setTargetType('file')
                        }
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <FileText className="size-3.5" /> Dosya
                      </span>
                    </Pill>
                    <Pill
                      onClick={async () => {
                        const p = await window.api.files.pick('folder')
                        if (p) {
                          setTarget(p)
                          setTargetType('folder')
                        }
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Folder className="size-3.5" /> Klasör
                      </span>
                    </Pill>
                    <Pill onClick={() => setLinkDraft('')}>
                      <span className="flex items-center gap-1">
                        <Link2 className="size-3.5" /> Bağlantı
                      </span>
                    </Pill>
                  </div>
                )}
              </div>
            </Row>
            <Row icon={TagIcon} label="Etiketler">
              <div className="flex flex-wrap items-center gap-1.5">
                {allTags.map((t) => {
                  const on = tagIds.includes(t.id)
                  return (
                    <Pill key={t.id} active={on} onClick={() => setTagIds((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}>
                      #{t.name}
                    </Pill>
                  )
                })}
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      addTag()
                    }
                  }}
                  placeholder="+ etiket"
                  className={cn(fieldInput, 'h-8 w-[110px]')}
                />
              </div>
            </Row>
            <Row icon={Repeat} label="Tekrar">
              <div className="space-y-2">
                <Select value={rule} onValueChange={(v) => setRule(v as RecurrenceRule | 'none')} disabled={!!task.recurrenceId}>
                  <SelectTrigger className="h-9 w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rule === 'weekly' && (
                  <div className="flex gap-1">
                    {WEEKDAYS.map((label, i) => {
                      const day = i + 1 // 1 = Pazartesi … 7 = Pazar
                      const on = weekdays.includes(day)
                      return (
                        <Pill
                          key={day}
                          active={on}
                          className="w-10 px-0"
                          onClick={() => !task.recurrenceId && setWeekdays((prev) => (on ? prev.filter((d) => d !== day) : [...prev, day]))}
                        >
                          {label}
                        </Pill>
                      )
                    })}
                  </div>
                )}
                {rule === 'monthly' && (
                  <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    Ayın
                    <input
                      type="number"
                      min={1}
                      max={31}
                      disabled={!!task.recurrenceId}
                      className={cn(fieldInput, 'w-[70px]')}
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                    />
                    . günü
                  </label>
                )}
                {rule !== 'none' && !task.recurrenceId && (
                  <p className="text-[11.5px] text-muted-foreground">Kaydedince her tekrarda yeni bir görev otomatik oluşturulur.</p>
                )}
              </div>
            </Row>
          </div>

          <div className="mt-5">
            <div className="section-label mb-2 flex items-center justify-between">
              <span>Alt görevler</span>
              {subtasks.length > 0 ? (
                <span className="tabular">{doneSubtasks}/{subtasks.length}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false)
                    askBreakdown(task)
                  }}
                  className="flex items-center gap-1 normal-case tracking-normal text-primary hover:underline"
                >
                  <Scissors className="size-3" /> Parçalara böl
                </button>
              )}
            </div>
            {subtasks.length > 0 && (
              <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-brand" style={{ width: `${(doneSubtasks / subtasks.length) * 100}%` }} />
              </div>
            )}
            <div className="flex flex-col">
              {subtasks.map((s) => (
                <div key={s.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-accent/50">
                  <button
                    type="button"
                    aria-label={s.status === 'done' ? 'Geri al' : 'Tamamla'}
                    onClick={() => toggleSubtask(s)}
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]',
                      s.status === 'done' ? 'border-transparent bg-brand text-white' : 'border-muted-foreground/40 hover:border-primary'
                    )}
                  >
                    {s.status === 'done' && <Check className="size-2.5" strokeWidth={3} />}
                  </button>
                  <span className={cn('flex-1 text-[13.5px]', s.status === 'done' && 'text-muted-foreground line-through')}>{s.title}</span>
                  <button
                    type="button"
                    aria-label="Alt görevi sil"
                    onClick={() => window.api.tasks.delete(s.id).then(() => { loadSubtasks(task.id); onSaved() }, () => toast.error('Silinemedi.'))}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2.5 px-1 py-1">
                <Plus className="size-4 text-muted-foreground" />
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.ctrlKey) {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                  placeholder="Alt görev ekle, Enter"
                  className="h-8 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70"
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="section-label mb-2">Notlar</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bağlantılar, ayrıntılar…"
              className="min-h-[96px] w-full resize-y rounded-xl border bg-background/50 px-3 py-2.5 text-[13.5px] outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-popover px-6 py-4 max-sm:px-4">
          <Button
            variant="ghost"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onOpenChange(false)
              deleteTask(task)
            }}
          >
            <Trash2 className="size-4" /> Sil
          </Button>
          <span className="ml-auto mr-1 text-[11.5px] text-muted-foreground">Ctrl+Enter</span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button disabled={saving} className="border-0 bg-brand px-5 font-semibold text-white" onClick={save}>
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
